import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { captureFrame, processPhoto } from '@/lib/imaging'
import { enqueuePhoto, subscribeToQueue, clearRejection } from '@/lib/uploadQueue'
import { buzz, playShutter } from '@/lib/shutter'
import { supportsGetUserMedia } from '@/lib/ua'

type CameraState = 'idle' | 'starting' | 'ready' | 'denied' | 'unsupported'

export default function Camera() {
  const { t } = useI18n()
  const { guest } = useAuth()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)

  const [state, setState] = useState<CameraState>(supportsGetUserMedia() ? 'idle' : 'unsupported')
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [credits, setCredits] = useState<number | null>(null)
  const [pending, setPending] = useState(0)
  const [rejection, setRejection] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)
  const [busy, setBusy] = useState(false)

  const refreshCredits = useCallback(async () => {
    const { data } = await supabase.rpc('my_credits_remaining')
    if (typeof data === 'number') setCredits(data)
  }, [])

  useEffect(() => {
    void refreshCredits()
    return subscribeToQueue((s) => {
      setPending(s.pending)
      setRejection(s.lastRejection)
      // A drained queue may mean credits moved (or were refunded).
      if (s.pending === 0) void refreshCredits()
    })
  }, [refreshCredits])

  // Release the camera when leaving the screen — otherwise the indicator light
  // stays on and the battery drains for the rest of the day.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  async function startCamera(which: 'environment' | 'user' = facing) {
    setState('starting')
    // Release the previous camera first — a phone will not hand out the front
    // and rear lens at the same time.
    streamRef.current?.getTracks().forEach((track) => track.stop())
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: which }, width: { ideal: 1920 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setFacing(which)
      setState('ready')
    } catch {
      setState('denied')
    }
  }

  function flipCamera() {
    void startCamera(facing === 'environment' ? 'user' : 'environment')
  }

  async function store(blob: Blob, source: 'capture' | 'upload') {
    if (!guest) return
    const processed = await processPhoto(blob)
    await enqueuePhoto({
      kind: 'disposable',
      source,
      guestId: guest.id,
      full: processed.full,
      thumb: processed.thumb,
      width: processed.width,
      height: processed.height,
      bytes: processed.bytes,
    })
    // Optimistic: the RPC is the real arbiter, but the counter should respond
    // to the tap rather than to a round trip to Tokyo.
    setCredits((c) => (c === null ? c : Math.max(0, c - (source === 'capture' ? 1 : 2))))
  }

  async function shoot() {
    if (busy || !videoRef.current) return
    setBusy(true)

    // Fire feedback first — it is the only thing the guest gets.
    playShutter()
    buzz()
    setFlash(true)
    setTimeout(() => setFlash(false), 140)

    try {
      const blob = await captureFrame(videoRef.current)
      await store(blob, 'capture')
    } catch {
      // Swallowed on purpose: a failed frame should not produce an error
      // screen mid-party. The credit is only spent once the RPC runs.
    } finally {
      setBusy(false)
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>, source: 'capture' | 'upload') {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      await store(file, source)
      if (source === 'capture') {
        playShutter()
        buzz()
      }
    } finally {
      setBusy(false)
    }
  }

  const out = credits !== null && credits <= 0

  return (
    <div className="px-6 py-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl">{t('camera.title')}</h1>
        <p className="text-sm text-ink-muted">
          {credits === null ? '' : t('camera.creditsLeft', { n: credits })}
        </p>
      </header>

      <div className="relative mt-6 aspect-[3/4] overflow-hidden rounded-card bg-ink">
        {/*
          The video is laid out at full size and genuinely playing — a 1px,
          opacity-0 element gets throttled or never decoded on iOS, so
          drawImage kept copying one stale frame and every photo came out
          identical. It is hidden by the opaque panel stacked on top instead
          of by being shrunk away, which keeps the capture live and the
          viewfinder just as blank.
        */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-ink" aria-hidden />

        {/* Viewfinder frame, deliberately empty. */}
        <div className="absolute inset-5 rounded border border-paper-raised/25" />
        <div className="absolute inset-0 flex items-center justify-center px-10 text-center">
          <p className="text-sm leading-relaxed text-paper-raised/55">
            {state === 'ready' ? t('camera.blindHint') : t('camera.permissionBody')}
          </p>
        </div>
        {flash && <div className="absolute inset-0 bg-paper-raised" aria-hidden />}
      </div>

      {out && <p className="mt-4 text-center text-sm text-ink-muted">{t('camera.noCredits')}</p>}

      {rejection?.includes('quota_exceeded') && (
        <p role="alert" className="mt-4 text-center text-sm text-danger">
          {t('camera.noCredits')}{' '}
          <button onClick={clearRejection} className="underline underline-offset-4">
            {t('app.cancel')}
          </button>
        </p>
      )}

      <div className="mt-8 flex flex-col items-center gap-5">
        {state === 'idle' && (
          <button
            type="button"
            onClick={() => void startCamera()}
            className="rounded-card bg-ink px-6 py-3 text-paper-raised"
          >
            {t('camera.permissionTitle')}
          </button>
        )}

        {state === 'starting' && <p className="text-sm text-ink-faint">{t('app.loading')}</p>}

        {state === 'ready' && (
          // The shutter is the anchor: it stays dead centre, and the flip
          // button and hint hang off it. Laying them out in a row instead
          // pushed the shutter ~30px right of centre, which looks like a
          // mistake on a screen that is otherwise symmetrical.
          <div className="flex w-full justify-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => void shoot()}
                disabled={busy || out}
                aria-label={t('camera.shoot')}
                className="h-20 w-20 rounded-full border-4 border-ink bg-paper-raised transition-transform active:scale-95 disabled:opacity-30"
              />

              {/* Flip to the front lens — most of what a wedding disposable
                  actually gets pointed at is the person holding it. */}
              <button
                type="button"
                onClick={flipCamera}
                aria-label={t('camera.flip')}
                className="absolute top-1/2 right-full mr-5 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-rule text-ink-muted transition-colors active:bg-paper-sunk"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M20 12a8 8 0 0 1-13.7 5.7M4 12a8 8 0 0 1 13.7-5.7" />
                  <path d="M17.5 2.8v3.9h-3.9M6.5 21.2v-3.9h3.9" />
                </svg>
              </button>

              {/* With no preview there is nothing on screen that reads as
                  "camera", so point at the control that takes the photo. */}
              {!out && (
                <span
                  className="pointer-events-none absolute top-1/2 left-full ml-1 flex w-24 -translate-y-1/2 items-center gap-1 text-ink-faint"
                  aria-hidden
                >
                  <svg viewBox="0 0 40 34" className="h-8 w-8 shrink-0" fill="none">
                    <path
                      d="M37 6C30 3 14 3 6 14"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M4 18l1.4-5.2 5 2"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-xs leading-snug">{t('camera.tapHint')}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {(state === 'denied' || state === 'unsupported') && (
          <>
            <p className="text-center text-sm text-ink-muted">{t('camera.permissionDenied')}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || out}
              className="rounded-card bg-ink px-6 py-3 text-paper-raised disabled:opacity-30"
            >
              {t('camera.shoot')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => void onFile(e, 'capture')}
              className="hidden"
            />
          </>
        )}

        <button
          type="button"
          onClick={() => libraryInputRef.current?.click()}
          disabled={busy || (credits !== null && credits < 2)}
          className="text-sm text-ink-muted underline underline-offset-4 disabled:opacity-40"
        >
          {t('camera.upload')}
        </button>
        <input
          ref={libraryInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => void onFile(e, 'upload')}
          className="hidden"
        />

        {pending > 0 && (
          <p className="text-xs text-ink-faint">{t('camera.queued', { n: pending })}</p>
        )}
      </div>
    </div>
  )
}

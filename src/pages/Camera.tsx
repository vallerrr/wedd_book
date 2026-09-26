import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { captureFrame, processPhoto } from '@/lib/imaging'
import { enqueuePhoto, subscribeToQueue, clearRejection } from '@/lib/uploadQueue'
import { buzz, playShutter } from '@/lib/shutter'
import { isIOS, supportsGetUserMedia } from '@/lib/ua'

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
  // Brief confirmation after a shot. With no preview and no image to look at,
  // guests could not tell whether the tap had registered at all.
  const [justSaved, setJustSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  // Whether guests get a viewfinder at all. Off is the true disposable feel;
  // the couple can turn it on if aiming blind proves too frustrating. Either
  // way the captured photos stay hidden until the reveal — that is enforced in
  // the database, not here.
  const [livePreview, setLivePreview] = useState(false)

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('app_settings')
      .select('camera_live_preview')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setLivePreview(data.camera_live_preview)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const refreshCredits = useCallback(async () => {
    const { data } = await supabase.rpc('my_credits_remaining')
    if (typeof data === 'number') setCredits(data)
  }, [])

  useEffect(() => {
    void refreshCredits()
    return subscribeToQueue((s) => {
      setPending(s.pending)
      setRejection(s.lastRejection)
      // Refresh on every queue event, not only on an empty queue. Credits are
      // spent per photo as the RPC runs, so waiting for the whole queue to
      // drain left the counter reading full for as long as anything was still
      // in flight — and stuck at the old number for good if one photo could
      // not finish. This RPC is a single integer.
      void refreshCredits()
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

  // Re-acquire the stream when the phone is turned. On Android this is enough
  // on its own — the OS hands back a buffer matching the new orientation. On
  // iOS it is not: the orientation is fixed when the camera is first granted
  // and a restart does not change it, which is why captureFrame also rotates a
  // stale buffer back. Keeping the restart still helps, because it leaves the
  // buffer and the device agreeing on Android so no correction is applied.
  useEffect(() => {
    if (state !== 'ready') return

    let timer: number | undefined
    const onRotate = () => {
      window.clearTimeout(timer)
      // Rotation fires repeatedly through the animation; wait for it to settle.
      timer = window.setTimeout(() => void startCamera(facing), 350)
    }

    screen.orientation?.addEventListener('change', onRotate)
    window.addEventListener('orientationchange', onRotate)
    return () => {
      window.clearTimeout(timer)
      screen.orientation?.removeEventListener('change', onRotate)
      window.removeEventListener('orientationchange', onRotate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, facing])

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
    setTimeout(() => setFlash(false), 160)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1600)

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
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1600)
    } finally {
      setBusy(false)
    }
  }

  const out = credits !== null && credits <= 0

  return (
    <div className="px-6 py-8">
      {/* The count is shown large inside the frame, so repeating it up here
          would just be noise. */}
      <h1 className="text-2xl">{t('camera.title')}</h1>

      {/* iOS honours the physical rotation lock even in Safari, so a locked
          phone keeps reporting portrait and landscape shots come out rotated.
          Nothing in the app can detect or override it — the guest has to turn
          it off — so say so before they try. */}
      {state === 'ready' && isIOS() && (
        <p className="mt-4 text-center text-xs leading-snug text-ink-faint">
          {t('camera.rotationLock')}
        </p>
      )}

      <div className="relative mt-3 aspect-[3/4] overflow-hidden rounded-card bg-ink">
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
        {!livePreview && <div className="absolute inset-0 bg-ink" aria-hidden />}

        {/* Viewfinder frame, deliberately empty. */}
        <div className="absolute inset-5 rounded border border-paper-raised/25" />

        {/* Which lens is live. With nothing on screen there is otherwise no
            way to tell whether you are about to shoot yourself or the room. */}
        {state === 'ready' && (
          <span className="absolute top-8 left-8 rounded-full border border-paper-raised/25 px-2.5 py-1 text-[11px] tracking-wide text-paper-raised/60">
            {facing === 'user' ? t('camera.front') : t('camera.back')}
          </span>
        )}
        {/* With a live preview there is a picture here; explaining that there
            isn't one would be nonsense. */}
        {/* The count lives inside the frame, against the dark, because that is
            where guests are looking — and it is the only running feedback that
            a shot actually landed. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
          {state === 'ready' ? (
            justSaved ? (
              <p className="text-2xl text-paper-raised">{t('camera.saved')}</p>
            ) : (
              <>
                {credits !== null && (
                  <>
                    <span className="text-6xl leading-none font-light text-paper-raised/90 tabular-nums">
                      {credits}
                    </span>
                    <span className="mt-2 text-sm text-paper-raised/60">
                      {t('camera.leftToday')}
                    </span>
                  </>
                )}
                {!livePreview && (
                  <p className="mt-6 text-xs leading-relaxed text-paper-raised/40">
                    {t('camera.blindHint')}
                  </p>
                )}
              </>
            )
          ) : (
            <p className="text-sm leading-relaxed text-paper-raised/55">
              {t('camera.permissionBody')}
            </p>
          )}
        </div>
      </div>

      {/* Full-screen, not just the frame: the blink is the loudest signal that
          a photo was taken, and it should be impossible to miss. */}
      {flash && (
        <div className="pointer-events-none fixed inset-0 z-50 bg-paper-raised" aria-hidden />
      )}

      {out && <p className="mt-4 text-center text-sm text-ink-muted">{t('camera.noCredits')}</p>}

      {/* Anything the queue gives up on has to be said out loud. A rejection
          that only rendered for quota_exceeded meant an identity that had
          stopped resolving looked exactly like a working camera: the shutter
          fired, the counter moved, and the photo quietly went nowhere. */}
      {rejection && (
        <p role="alert" className="mt-4 text-center text-sm text-danger">
          {rejection.includes('quota_exceeded')
            ? t('camera.noCredits')
            : t('camera.uploadStuck')}{' '}
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

        {/* 'starting' covers the restart after a rotation as well as the very
            first start. The shutter stays on screen and disabled rather than
            disappearing, so rotating the phone doesn't make the button vanish
            under your thumb — and a tap mid-restart cannot capture a frame
            from the stream that is being torn down. */}
        {(state === 'ready' || state === 'starting') && (
          // The shutter is the anchor: it stays dead centre, and the flip
          // button and hint hang off it. Laying them out in a row instead
          // pushed the shutter ~30px right of centre, which looks like a
          // mistake on a screen that is otherwise symmetrical.
          <div className="flex w-full justify-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => void shoot()}
                disabled={busy || out || state === 'starting'}
                aria-label={t('camera.shoot')}
                className="h-20 w-20 rounded-full border-4 border-ink bg-paper-raised transition-transform active:scale-95 disabled:opacity-30"
              />

              {/* Flip to the front lens — most of what a wedding disposable
                  actually gets pointed at is the person holding it. */}
              <button
                type="button"
                onClick={flipCamera}
                disabled={state === 'starting'}
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
                  {/* Just the curve — the arrowhead read as clutter at this
                      size and never quite lined up with the button. */}
                  <svg viewBox="0 0 40 26" className="h-7 w-8 shrink-0" fill="none">
                    <path
                      d="M38 5C30 1 12 3 3 17"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
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

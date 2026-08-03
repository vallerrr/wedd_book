import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/i18n'
import { supabase } from '@/lib/supabase'
import { signedUrl, signedUrls } from '@/lib/photos'

type FeedRow = {
  id: string
  thumb_path: string | null
  storage_path: string
  display_mode: string
  author: string | null
  mine: boolean
  created_at: string
}

type State = { open: boolean; reveal_at: string | null; waiting_count: number }

function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!target) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])

  if (!target) return null
  const ms = new Date(target).getTime() - now
  if (ms <= 0) return null
  const total = Math.floor(ms / 1000)
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

export default function Gallery() {
  const { t, locale } = useI18n()
  const [state, setState] = useState<State | null>(null)
  const [photos, setPhotos] = useState<FeedRow[]>([])
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map())
  const [mineOnly, setMineOnly] = useState(false)
  // Holds only an id, never a copy of the row. Keeping a copy meant the
  // author label kept showing your name after you switched a photo to
  // anonymous, because the list refreshed underneath and the copy did not.
  const [lightbox, setLightbox] = useState<{ id: string; url: string } | null>(null)
  const [loading, setLoading] = useState(true)
  // A failed load must not be mistaken for a closed gallery: the locked screen
  // says "not revealed yet", which would be a flat lie if the request simply
  // never arrived — and indistinguishable from the real thing for a guest.
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    const [stateRes, feedRes] = await Promise.all([
      supabase.rpc('gallery_state'),
      supabase.rpc('gallery_feed'),
    ])

    if (stateRes.error) {
      setFailed(true)
      setLoading(false)
      return
    }

    const st = Array.isArray(stateRes.data)
      ? (stateRes.data[0] as State)
      : (stateRes.data as State | null)
    setFailed(false)
    setState(st ?? null)
    const rows = (feedRes.data ?? []) as FeedRow[]
    setPhotos(rows)
    setLoading(false)
    setThumbs(await signedUrls(rows.map((r) => r.thumb_path)))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const countdown = useCountdown(state?.open ? null : (state?.reveal_at ?? null))

  // The reveal may pass while someone is sitting on this screen.
  useEffect(() => {
    if (!state || state.open || !state.reveal_at) return
    const ms = new Date(state.reveal_at).getTime() - Date.now()
    if (ms <= 0 || ms > 2 ** 31 - 1) return
    const id = setTimeout(() => void load(), ms + 1000)
    return () => clearTimeout(id)
  }, [state, load])

  const shown = useMemo(
    () => (mineOnly ? photos.filter((p) => p.mine) : photos),
    [photos, mineOnly],
  )

  async function toggleAnonymous(row: FeedRow) {
    const next = row.display_mode === 'anonymous' ? 'named' : 'anonymous'
    setPhotos((ps) =>
      ps.map((p) => (p.id === row.id ? { ...p, display_mode: next, author: null } : p)),
    )
    await supabase.from('photos').update({ display_mode: next }).eq('id', row.id)
    // The author name is resolved server-side, so re-read it rather than
    // trying to reconstruct it here.
    await load()
  }

  async function openLightbox(row: FeedRow) {
    const url = await signedUrl(row.storage_path)
    if (url) setLightbox({ id: row.id, url })
  }

  const lightboxRow = lightbox ? photos.find((p) => p.id === lightbox.id) : undefined

  if (loading) return <p className="px-6 py-8 text-sm text-ink-faint">{t('app.loading')}</p>

  if (failed) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-5 px-8 text-center">
        <p className="text-ink-muted">{t('gallery.loadFailed')}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            void load()
          }}
          className="rounded-card border border-rule px-5 py-2.5 text-sm"
        >
          {t('app.retry')}
        </button>
      </div>
    )
  }

  if (!state?.open) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center px-8 text-center">
        <h1 className="text-3xl">{t('gallery.lockedTitle')}</h1>
        {countdown ? (
          <p className="mt-6 font-mono text-4xl tracking-tight tabular-nums">
            {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:
            {String(countdown.seconds).padStart(2, '0')}
          </p>
        ) : (
          <p className="mt-4 text-ink-muted">{t('gallery.lockedSoon')}</p>
        )}
        {state && state.waiting_count > 0 && (
          <p className="mt-6 text-sm text-ink-faint">
            {t('gallery.waiting', { n: state.waiting_count })}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="px-6 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl">{t('gallery.title')}</h1>
        <div className="flex gap-1 rounded-full border border-rule p-0.5 text-sm">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setMineOnly(v)}
              className={`rounded-full px-3 py-1 ${
                mineOnly === v ? 'bg-ink text-paper-raised' : 'text-ink-muted'
              }`}
            >
              {v ? t('gallery.mine') : t('gallery.all')}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-10 text-sm text-ink-faint">{t('gallery.empty')}</p>
      ) : (
        <ul className="mt-6 grid grid-cols-3 gap-1.5">
          {shown.map((row) => {
            const url = row.thumb_path ? thumbs.get(row.thumb_path) : null
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => void openLightbox(row)}
                  className="block aspect-square w-full overflow-hidden rounded bg-paper-sunk"
                >
                  {url && (
                    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {lightboxRow && lightbox && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink/95">
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="self-end p-5 text-2xl text-paper-raised/70"
            aria-label={t('app.back')}
          >
            ×
          </button>
          <div className="flex flex-1 items-center justify-center px-4">
            <img src={lightbox.url} alt="" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="safe-bottom flex items-center justify-between px-6 pt-4">
            <span className="text-sm text-paper-raised/70">
              {lightboxRow.author ?? t('gallery.anonymous')}
              {' · '}
              {new Date(lightboxRow.created_at).toLocaleDateString(
                locale === 'zh' ? 'zh-CN' : 'en-GB',
                { day: 'numeric', month: 'short', timeZone: 'Asia/Shanghai' },
              )}
            </span>
            {/* Only your own photos are yours to rename. */}
            {lightboxRow.mine && (
              <button
                type="button"
                onClick={() => void toggleAnonymous(lightboxRow)}
                className="text-sm text-paper-raised underline underline-offset-4"
              >
                {lightboxRow.display_mode === 'anonymous'
                  ? t('gallery.showName')
                  : t('gallery.anonymous')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

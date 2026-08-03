import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { processPhoto } from '@/lib/imaging'
import { enqueuePhoto, subscribeToQueue } from '@/lib/uploadQueue'
import { signedUrl } from '@/lib/photos'
import type { Database } from '@/lib/database.types'

type Question = Database['public']['Tables']['bingo_questions']['Row']
type Photo = Database['public']['Tables']['photos']['Row']

export default function BingoQuestion() {
  const { position } = useParams()
  const { t, pick } = useI18n()
  const { guest } = useAuth()

  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)

  const [question, setQuestion] = useState<Question | null>(null)
  const [answer, setAnswer] = useState<Photo | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: q } = await supabase
      .from('bingo_questions')
      .select('*')
      .eq('position', Number(position))
      .maybeSingle()
    setQuestion(q)
    if (!q) {
      setLoading(false)
      return
    }
    const { data: p } = await supabase
      .from('photos')
      .select('*')
      .eq('kind', 'bingo')
      .eq('question_id', q.id)
      .neq('status', 'hidden')
      .maybeSingle()
    setAnswer(p)
    setPreview(await signedUrl(p?.thumb_path ?? null))
    setLoading(false)
  }, [position])

  useEffect(() => {
    void load()
  }, [load])

  // The photo only exists server-side once the queue drains, so refresh when
  // it does — otherwise a just-taken answer looks like it vanished.
  useEffect(() => subscribeToQueue((s) => s.pending === 0 && void load()), [load])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>, source: 'capture' | 'upload') {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !question || !guest) return
    setBusy(true)
    try {
      const processed = await processPhoto(file)
      // Show it immediately; unlike the disposable camera, a bingo answer is
      // meant to be seen by the person who took it.
      setPreview(URL.createObjectURL(processed.thumb))
      await enqueuePhoto({
        kind: 'bingo',
        source,
        questionId: question.id,
        guestId: guest.id,
        full: processed.full,
        thumb: processed.thumb,
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
      })
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="px-6 py-8 text-sm text-ink-faint">{t('app.loading')}</p>
  if (!question) return <p className="px-6 py-8 text-sm text-ink-faint">—</p>

  return (
    <div className="px-6 py-8">
      <Link to="/bingo" className="text-sm text-ink-muted">
        ← {t('bingo.title')}
      </Link>

      <p className="mt-6 text-xs tracking-wide text-ink-faint uppercase">
        {t('bingo.number', { n: question.position })}
      </p>
      <h1 className="mt-1 text-2xl leading-snug">{pick(question.prompt_zh, question.prompt_en)}</h1>

      <div className="mt-6 aspect-square overflow-hidden rounded-card border border-rule bg-paper-sunk">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <p className="text-sm text-ink-faint">{t('bingo.noAnswerYet')}</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => cameraInput.current?.click()}
          disabled={busy}
          className="w-full rounded-card bg-ink py-3.5 text-paper-raised disabled:opacity-40"
        >
          {answer || preview ? t('bingo.replacePhoto') : t('bingo.addPhoto')}
        </button>
        <button
          type="button"
          onClick={() => libraryInput.current?.click()}
          disabled={busy}
          className="text-sm text-ink-muted underline underline-offset-4 disabled:opacity-40"
        >
          {t('bingo.fromLibrary')}
        </button>
      </div>

      {/* The OS camera, not the blind one: you are photographing a person you
          just found, so you want to see the shot — and it costs no credits. */}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void onFile(e, 'capture')}
        className="hidden"
      />
      <input
        ref={libraryInput}
        type="file"
        accept="image/*"
        onChange={(e) => void onFile(e, 'upload')}
        className="hidden"
      />

      <p className="mt-6 text-xs text-ink-faint">{t('bingo.privateHint')}</p>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { signedUrls } from '@/lib/photos'
import { queuedBingoThumbs, subscribeToQueue } from '@/lib/uploadQueue'
import type { Database } from '@/lib/database.types'

type Question = Database['public']['Tables']['bingo_questions']['Row']
type Photo = Database['public']['Tables']['photos']['Row']

export default function Bingo() {
  const { t, pick } = useI18n()
  const { guest } = useAuth()
  const guestId = guest?.id ?? null
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Photo[]>([])
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [q, a] = await Promise.all([
        supabase.from('bingo_questions').select('*').eq('active', true).order('position'),
        // RLS hands back only what this guest may see, which before review
        // night is exactly their own answers.
        supabase.from('photos').select('*').eq('kind', 'bingo').neq('status', 'hidden'),
      ])
      if (cancelled) return
      setQuestions(q.data ?? [])
      setAnswers(a.data ?? [])
      setLoading(false)
      const signed = await signedUrls((a.data ?? []).map((p) => p.thumb_path))

      // Anything still queued has no signed URL yet; show the local blob so a
      // tile the guest has already answered never looks empty. Scoped to this
      // guest: one browser can hold another guest's queued photos.
      if (guestId) {
        const local = await queuedBingoThumbs(guestId)
        for (const [questionId, blob] of local) {
          // Only for a question this guest genuinely has a row for; the row is
          // what proves the answer is theirs.
          const photo = (a.data ?? []).find((p) => p.question_id === questionId)
          const key = photo?.thumb_path
          if (key && !signed.has(key)) signed.set(key, URL.createObjectURL(blob))
        }
      }
      if (!cancelled) setThumbs(signed)
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey, guestId])

  // When the queue empties, the uploaded thumbnails exist — reload so the
  // grid stops relying on local blobs.
  useEffect(() => subscribeToQueue((s) => s.pending === 0 && setReloadKey((k) => k + 1)), [])

  const byQuestion = useMemo(() => {
    const m = new Map<string, Photo>()
    for (const p of answers) if (p.question_id) m.set(p.question_id, p)
    return m
  }, [answers])

  const done = questions.filter((q) => byQuestion.has(q.id)).length

  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl">{t('bingo.title')}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t('bingo.subtitle')}</p>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-paper-sunk">
          <div
            className="h-full bg-sage transition-[width] duration-500"
            style={{ width: `${questions.length ? (done / questions.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-sm text-ink-faint">
          {t('bingo.progress', { done, total: questions.length })}
        </span>
      </div>

      <p className="mt-3 text-xs text-ink-faint">{t('bingo.privateHint')}</p>

      {loading ? (
        <p className="mt-10 text-sm text-ink-faint">{t('app.loading')}</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3">
          {questions.map((q) => {
            const answer = byQuestion.get(q.id)
            const thumb = answer?.thumb_path ? thumbs.get(answer.thumb_path) : null
            return (
              <li key={q.id}>
                <Link
                  to={`/bingo/${q.position}`}
                  className="relative flex aspect-square flex-col justify-between overflow-hidden rounded-card border border-rule bg-paper-raised p-3"
                >
                  {thumb && (
                    <>
                      <img
                        src={thumb}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      {/* Keep the prompt readable over the photo. */}
                      <div className="absolute inset-0 bg-ink/55" />
                    </>
                  )}
                  <span
                    className={`relative text-xs leading-snug ${thumb ? 'text-paper-raised' : 'text-ink'}`}
                  >
                    {pick(q.prompt_zh, q.prompt_en)}
                  </span>
                  <span
                    className={`relative self-end text-[11px] ${thumb ? 'text-paper-raised/80' : 'text-ink-faint'}`}
                  >
                    {answer ? '✓' : q.position}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

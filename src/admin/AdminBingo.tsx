import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { signedUrls } from '@/lib/photos'
import type { Database } from '@/lib/database.types'

type Question = Database['public']['Tables']['bingo_questions']['Row']
type Photo = Database['public']['Tables']['photos']['Row']
type Guest = Database['public']['Tables']['guests']['Row']

/**
 * Review night: every guest's answer to one question, side by side.
 *
 * Built for reading aloud to a room rather than for browsing — one question at
 * a time, with arrows, because that is how the couple will actually run it.
 * Admins bypass can_view_photo, so this works before the reveal time too.
 */
export function AdminBingo() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [guests, setGuests] = useState<Map<string, Guest>>(new Map())
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const [index, setIndex] = useState(0)
  const [full, setFull] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const [q, p, g] = await Promise.all([
        supabase.from('bingo_questions').select('*').order('position'),
        supabase.from('photos').select('*').eq('kind', 'bingo').neq('status', 'hidden'),
        supabase.from('guests').select('*'),
      ])
      setQuestions(q.data ?? [])
      setPhotos(p.data ?? [])
      setGuests(new Map((g.data ?? []).map((x) => [x.id, x])))
      setLoading(false)
      // Thumbnails only — a wall of full-size images over hotel wifi in
      // Qianxi would take minutes to paint.
      setUrls(await signedUrls((p.data ?? []).map((x) => x.thumb_path)))
    })()
  }, [])

  if (loading) return <p className="text-sm text-ink-faint">Loading…</p>
  if (questions.length === 0) return <p className="text-sm text-ink-faint">No questions yet.</p>

  const question = questions[index]
  const answers = photos.filter((p) => p.question_id === question.id)

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl">Review night</h1>
        <span className="text-sm text-ink-faint">
          {index + 1} / {questions.length}
        </span>
      </div>

      <div className="mt-8 min-h-24">
        <p className="text-sm text-ink-faint">{question.prompt_zh}</p>
        <h2 className="mt-1 text-2xl leading-snug">{question.prompt_en}</h2>
        <p className="mt-2 text-sm text-ink-faint">
          {answers.length} {answers.length === 1 ? 'answer' : 'answers'}
        </p>
      </div>

      {answers.length === 0 ? (
        <p className="mt-8 text-sm text-ink-faint">Nobody answered this one.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {answers.map((p) => {
            const url = p.thumb_path ? urls.get(p.thumb_path) : null
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => void openFull(p, setFull)}
                  className="block w-full overflow-hidden rounded-card border border-rule"
                >
                  {url ? (
                    <img src={url} alt="" className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="aspect-square w-full bg-paper-sunk" />
                  )}
                </button>
                <p className="mt-1.5 text-center text-sm">
                  {guests.get(p.guest_id)?.display_name ?? '—'}
                </p>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-10 flex justify-between">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="rounded-card border border-rule px-5 py-2.5 disabled:opacity-30"
        >
          ← Previous
        </button>
        <button
          onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
          disabled={index === questions.length - 1}
          className="rounded-card bg-ink px-5 py-2.5 text-paper-raised disabled:opacity-30"
        >
          Next →
        </button>
      </div>

      {full && (
        <button
          type="button"
          onClick={() => setFull(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-6"
        >
          <img src={full} alt="" className="max-h-full max-w-full rounded-card object-contain" />
        </button>
      )}
    </div>
  )
}

async function openFull(photo: Photo, set: (url: string | null) => void) {
  const { data } = await supabase.storage.from('photos').createSignedUrl(photo.storage_path, 3600)
  if (data?.signedUrl) set(data.signedUrl)
}

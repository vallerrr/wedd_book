import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { signedUrls } from '@/lib/photos'

type Row = {
  photo_id: string
  storage_path: string
  thumb_path: string | null
  pick_count: number
  chosen_by: string[]
}

/**
 * What to take to the print shop.
 *
 * One row per photo rather than per guest, so a photo two people picked is
 * printed once and shown with both names — ordered by how many asked for it,
 * which is a reasonable proxy for what mattered most on the day.
 */
export function AdminPrints() {
  const [rows, setRows] = useState<Row[]>([])
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc('print_queue')
      const list = (data ?? []) as Row[]
      setRows(list)
      setLoading(false)
      setUrls(await signedUrls(list.map((r) => r.thumb_path)))
    })()
  }, [])

  if (loading) return <p className="text-sm text-ink-faint">Loading…</p>

  const totalPicks = rows.reduce((n, r) => n + Number(r.pick_count), 0)

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl">Prints</h1>
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print rounded-card bg-ink px-4 py-2 text-sm text-paper-raised"
        >
          Print this list
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-faint">
        {rows.length} {rows.length === 1 ? 'photo' : 'photos'} to print · {totalPicks} picks in
        total
      </p>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-ink-faint">
          Nobody has chosen any prints yet. Guests choose from the gallery once it&rsquo;s open.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3">
          {rows.map((r) => {
            const url = r.thumb_path ? urls.get(r.thumb_path) : null
            return (
              <li key={r.photo_id}>
                <div className="overflow-hidden rounded-card border border-rule">
                  {url ? (
                    <img src={url} alt="" className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="aspect-square w-full bg-paper-sunk" />
                  )}
                </div>
                <p className="mt-1.5 text-sm">
                  {r.chosen_by.join(', ')}
                  {Number(r.pick_count) > 1 && (
                    <span className="text-ink-faint"> · ×{r.pick_count}</span>
                  )}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

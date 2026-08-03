import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Settings = Database['public']['Tables']['app_settings']['Row']

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between gap-6 border-b border-rule py-5">
      <span>
        <span className="block">{label}</span>
        <span className="mt-1 block text-sm text-ink-faint">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-sage"
      />
    </label>
  )
}

export function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single()
    if (error) setError(error.message)
    else setSettings(data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function patch(update: Partial<Settings>) {
    if (!settings) return
    setSettings({ ...settings, ...update })
    setError(null)
    const { error } = await supabase.from('app_settings').update(update).eq('id', 1)
    if (error) {
      setError(error.message)
      await load()
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  if (!settings) return <p className="text-sm text-ink-faint">Loading…</p>

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl">Settings</h1>
        {saved && <span className="text-sm text-sage">saved</span>}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-sm tracking-wide text-ink-faint uppercase">Camera</h2>
        <Toggle
          label="Show a live viewfinder"
          hint="Off is the true disposable feel — guests aim blind. On lets them frame the shot. Either way photos stay hidden until the reveal."
          checked={settings.camera_live_preview}
          onChange={(v) => void patch({ camera_live_preview: v })}
        />
        <label className="flex items-center justify-between gap-6 border-b border-rule py-5">
          <span>
            <span className="block">Photos per guest per day</span>
            <span className="mt-1 block text-sm text-ink-faint">
              Resets at midnight, Guizhou time.
            </span>
          </span>
          <input
            type="number"
            min={0}
            max={200}
            value={settings.daily_photo_credits}
            onChange={(e) => void patch({ daily_photo_credits: Number(e.target.value) })}
            className="w-20 rounded-card border border-rule bg-paper-raised px-3 py-1.5 text-right outline-none focus:border-sage"
          />
        </label>
      </section>

      <section className="mt-10">
        <h2 className="text-sm tracking-wide text-ink-faint uppercase">Reveal</h2>
        <Toggle
          label="Open the gallery"
          hint="Master switch. Disposable photos also need a reveal time in the past before anyone can see them."
          checked={settings.gallery_visible}
          onChange={(v) => void patch({ gallery_visible: v })}
        />

        <label className="flex items-center justify-between gap-6 border-b border-rule py-5">
          <span>
            <span className="block">Disposable photos revealed at</span>
            <span className="mt-1 block text-sm text-ink-faint">
              Until this passes, nobody sees them — not even the guest who took them.
            </span>
          </span>
          <input
            type="datetime-local"
            value={toLocalInput(settings.disposable_reveal_at)}
            onChange={(e) => void patch({ disposable_reveal_at: fromLocalInput(e.target.value) })}
            className="rounded-card border border-rule bg-paper-raised px-3 py-1.5 outline-none focus:border-sage"
          />
        </label>

        <label className="flex items-center justify-between gap-6 border-b border-rule py-5">
          <span>
            <span className="block">Bingo review night</span>
            <span className="mt-1 block text-sm text-ink-faint">
              When everyone&rsquo;s bingo answers open up to each other.
            </span>
          </span>
          <input
            type="datetime-local"
            value={toLocalInput(settings.bingo_review_at)}
            onChange={(e) => void patch({ bingo_review_at: fromLocalInput(e.target.value) })}
            className="rounded-card border border-rule bg-paper-raised px-3 py-1.5 outline-none focus:border-sage"
          />
        </label>
      </section>

      <p className="mt-8 text-sm text-ink-faint">
        Times are entered in this device&rsquo;s timezone. The event runs on{' '}
        {settings.venue_timezone}.
      </p>
    </div>
  )
}

/** datetime-local wants "YYYY-MM-DDTHH:mm" in local time, not an ISO string. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

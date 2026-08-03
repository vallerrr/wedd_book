import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Guest } from '@/lib/auth'

export function AdminGuests() {
  const [guests, setGuests] = useState<Guest[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) setError(error.message)
    else setGuests(data ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)

    // "A & B" is two people, matching scripts/make-guests.mjs. The invite code
    // is generated server-side, so uniqueness is checked inside the same
    // transaction as the insert rather than by retrying from the browser.
    for (const person of trimmed
      .split('&')
      .map((s) => s.trim())
      .filter(Boolean)) {
      const { error } = await supabase.rpc('admin_create_guest', { p_display_name: person })
      if (error) {
        setError(error.message)
        break
      }
    }

    setName('')
    await load()
    setBusy(false)
  }

  async function setTable(id: string, table: string) {
    const { error } = await supabase.rpc('admin_update_guest', {
      p_guest_id: id,
      p_table_number: table,
    })
    if (error) setError(error.message)
    await load()
  }

  async function reset(guest: Guest) {
    if (
      !confirm(
        `Un-redeem ${guest.display_name}? Their code ${guest.invite_code} becomes usable again.`,
      )
    )
      return
    const { error } = await supabase.rpc('admin_reset_guest', { p_guest_id: guest.id })
    if (error) setError(error.message)
    await load()
  }

  async function remove(guest: Guest) {
    if (!confirm(`Delete ${guest.display_name}? Their photos go too. This cannot be undone.`))
      return
    const { error } = await supabase.rpc('admin_delete_guest', { p_guest_id: guest.id })
    if (error) setError(error.message)
    await load()
  }

  const redeemed = guests.filter((g) => g.redeemed_at).length

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl">Guests</h1>
        <Link to="/admin/qr" className="text-sm text-sage underline underline-offset-4">
          Printable QR sheet →
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-faint">
        {guests.length} invited · {redeemed} redeemed
      </p>

      <form onSubmit={onAdd} className="mt-6 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name, or “A &amp; B” for two people"
          className="flex-1 rounded-card border border-rule bg-paper-raised px-4 py-2.5 outline-none focus:border-sage"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-card bg-ink px-5 text-paper-raised disabled:opacity-30"
        >
          Add
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <table className="mt-8 w-full text-left text-sm">
        <thead className="border-b border-rule text-ink-faint">
          <tr>
            <th className="pb-2 font-normal">Name</th>
            <th className="pb-2 font-normal">Code</th>
            <th className="pb-2 font-normal">Table</th>
            <th className="pb-2 font-normal">Status</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {guests.map((g) => (
            <tr key={g.id}>
              <td className="py-2.5">{g.display_name}</td>
              <td className="py-2.5 font-mono tracking-widest">{g.invite_code}</td>
              <td className="py-2.5">
                <input
                  defaultValue={g.table_number ?? ''}
                  onBlur={(e) => void setTable(g.id, e.target.value.trim())}
                  placeholder="—"
                  size={6}
                  className="rounded border border-transparent bg-transparent px-1 outline-none hover:border-rule focus:border-sage"
                />
              </td>
              <td className="py-2.5 text-ink-faint">{g.redeemed_at ? 'redeemed' : 'not yet'}</td>
              <td className="py-2.5 text-right whitespace-nowrap">
                {g.redeemed_at && (
                  <button
                    onClick={() => void reset(g)}
                    className="text-ink-faint underline underline-offset-4 hover:text-ink"
                    title="Free the code so it can be redeemed again"
                  >
                    reset
                  </button>
                )}
                <button
                  onClick={() => void remove(g)}
                  className="ml-3 text-ink-faint underline underline-offset-4 hover:text-danger"
                >
                  delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {guests.length === 0 && (
        <p className="mt-8 text-sm text-ink-faint">
          No guests yet. Add them above, or paste <code>private/insert-guests.sql</code> into the
          Supabase SQL editor.
        </p>
      )}
    </div>
  )
}

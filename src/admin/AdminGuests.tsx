import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { generateCode } from '@/lib/codes'
import type { Guest } from '@/lib/auth'

const UNIQUE_VIOLATION = '23505'

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

  async function addGuest(displayName: string) {
    // Codes are random and short, so a collision is unlikely but possible.
    // Retry on the unique violation rather than pre-checking, which would
    // race against another admin adding someone at the same moment.
    for (let attempt = 0; attempt < 12; attempt++) {
      const { error } = await supabase
        .from('guests')
        .insert({ invite_code: generateCode(), display_name: displayName })
      if (!error) return null
      if (error.code !== UNIQUE_VIOLATION) return error.message
    }
    return 'Could not find a free invite code after several tries.'
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    // "A & B" is two people, matching scripts/make-guests.mjs.
    for (const person of trimmed
      .split('&')
      .map((s) => s.trim())
      .filter(Boolean)) {
      const err = await addGuest(person)
      if (err) {
        setError(err)
        break
      }
    }
    setName('')
    await load()
    setBusy(false)
  }

  async function setTable(id: string, table: string) {
    await supabase
      .from('guests')
      .update({ table_number: table || null })
      .eq('id', id)
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

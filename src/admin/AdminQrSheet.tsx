import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import type { Guest } from '@/lib/auth'

type Card = { guest: Guest; qr: string; url: string }

/**
 * One card per guest, sized for cutting up and handing out at the first
 * meetup. The QR carries ?c=<code> so a scan redeems with no typing; the code
 * is printed underneath as a fallback for anyone whose camera won't cooperate.
 */
export function AdminQrSheet() {
  const [cards, setCards] = useState<Card[] | null>(null)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('guests')
        .select('*')
        .order('display_name', { ascending: true })

      const origin = window.location.origin
      const built = await Promise.all(
        (data ?? []).map(async (guest) => {
          const url = `${origin}/?c=${guest.invite_code}`
          const qr = await QRCode.toDataURL(url, {
            margin: 0,
            width: 480,
            errorCorrectionLevel: 'M',
            color: { dark: '#23211eff', light: '#ffffffff' },
          })
          return { guest, qr, url }
        }),
      )
      setCards(built)
    })()
  }, [])

  if (!cards) return <p className="py-16 text-sm text-ink-faint">Loading…</p>

  return (
    <div>
      <style>{`
        @media print {
          @page { margin: 12mm; }
          .no-print { display: none !important; }
          .qr-card { break-inside: avoid; }
          body { background: #fff; }
        }
      `}</style>

      <div className="no-print mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl">QR sheet</h1>
          <p className="mt-1 text-sm text-ink-faint">
            {cards.length} cards. Print, cut, hand out at the first meetup.
          </p>
        </div>
        <div className="flex gap-4">
          <Link to="/admin/guests" className="text-sm text-ink-muted underline underline-offset-4">
            ← Guests
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-card bg-ink px-4 py-2 text-sm text-paper-raised"
          >
            Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map(({ guest, qr }) => (
          <div
            key={guest.id}
            className="qr-card flex flex-col items-center rounded-card border border-rule bg-white p-4 text-center"
          >
            <img src={qr} alt="" width={160} height={160} className="h-40 w-40" />
            <p className="mt-3 text-ink">{guest.display_name}</p>
            <p className="mt-0.5 font-mono text-lg tracking-[0.35em] text-ink-muted">
              {guest.invite_code}
            </p>
          </div>
        ))}
      </div>

      {cards.length === 0 && (
        <p className="text-sm text-ink-faint">No guests yet — add some first.</p>
      )}
    </div>
  )
}

import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useAdmin } from './useAdmin'
import { AdminLogin } from './AdminLogin'
import { AdminGuests } from './AdminGuests'
import { AdminQrSheet } from './AdminQrSheet'
import { AdminSettings } from './AdminSettings'

/**
 * Everything under /admin is one lazy chunk, so guests never download it.
 * Access is gated on a row in admin_profiles — the same check every
 * is_admin() RLS policy makes, so the UI can't grant more than the database.
 */
export default function AdminApp() {
  const { state, email, signIn, signOut } = useAdmin()

  if (state === 'loading') {
    return <p className="p-8 text-sm text-ink-faint">Loading…</p>
  }

  if (state !== 'in') {
    return (
      <div className="mx-auto w-full max-w-3xl px-6">
        <AdminLogin onSignIn={signIn} notAdmin={state === 'not-admin'} onSignOut={signOut} />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <nav className="no-print mb-8 flex items-center justify-between border-b border-rule pb-4 text-sm">
        <div className="flex gap-5">
          <Link to="/admin/guests" className="text-ink-muted hover:text-ink">
            Guests
          </Link>
          <Link to="/admin/qr" className="text-ink-muted hover:text-ink">
            QR sheet
          </Link>
          <Link to="/admin/settings" className="text-ink-muted hover:text-ink">
            Settings
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-ink-faint">{email}</span>
          <button onClick={signOut} className="text-ink-muted underline underline-offset-4">
            Sign out
          </button>
        </div>
      </nav>

      <Routes>
        <Route index element={<Navigate to="guests" replace />} />
        <Route path="guests" element={<AdminGuests />} />
        <Route path="qr" element={<AdminQrSheet />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="*" element={<Navigate to="guests" replace />} />
      </Routes>
    </div>
  )
}

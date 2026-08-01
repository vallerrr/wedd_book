import { Route, Routes } from 'react-router-dom'

/**
 * Everything under /admin is one lazy chunk so the guest bundle never pays for
 * it. Real Supabase Auth (email + password) gated on admin_profiles, wired in
 * Phase 1.
 */
export default function AdminApp() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <Routes>
        <Route path="/" element={<h1 className="text-2xl">Admin</h1>} />
        <Route path="login" element={<h1 className="text-2xl">Admin login</h1>} />
      </Routes>
    </div>
  )
}

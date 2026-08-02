import { useState } from 'react'

export function AdminLogin({
  onSignIn,
  notAdmin,
  onSignOut,
}: {
  onSignIn: (email: string, password: string) => Promise<string | null>
  notAdmin: boolean
  onSignOut: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (notAdmin) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl">Not an admin</h1>
        <p className="mt-2 text-ink-muted">
          This account is signed in but has no row in <code>admin_profiles</code>.
        </p>
        <button onClick={onSignOut} className="mt-6 text-sm text-ink-muted underline">
          Sign out
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(await onSignIn(email, password))
        setBusy(false)
      }}
      className="mx-auto max-w-sm py-16"
    >
      <h1 className="text-2xl">Admin</h1>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        autoComplete="username"
        required
        className="mt-6 w-full rounded-card border border-rule bg-paper-raised px-4 py-3 outline-none focus:border-sage"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete="current-password"
        required
        className="mt-3 w-full rounded-card border border-rule bg-paper-raised px-4 py-3 outline-none focus:border-sage"
      />

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-card bg-ink py-3 text-paper-raised disabled:opacity-40"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Loading } from './Loading'

/**
 * Bounces anyone without a redeemed invite code back to the welcome screen.
 *
 * Deliberately carries no "return to" state: React Router keeps location.state
 * in history.state, which survives reloads, so a stale value would later steer
 * the post-redeem redirect to the wrong screen.
 */
export function RequireGuest() {
  const { status } = useAuth()

  if (status === 'loading') return <Loading />
  if (status === 'anonymous') return <Navigate to="/" replace />
  return <Outlet />
}

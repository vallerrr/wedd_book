import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import { setCurrentGuest, setIdentityRecovery, startQueueWatcher } from './uploadQueue'
import type { Database } from './database.types'

export type Guest = Database['public']['Tables']['guests']['Row']

/**
 * Guests have no email or password. They sign in anonymously — which yields a
 * real Supabase JWT with a stable auth.uid() — and then redeem a 3-character
 * invite code, which binds guests.auth_user_id to that uid. Every RLS policy
 * resolves identity from that join, so nothing here needs a service key.
 *
 * The session persists in localStorage, so a guest redeems once and stays
 * signed in across all three days.
 */

export type RedeemError =
  'invalid_code' | 'code_already_used' | 'too_many_attempts' | 'offline' | 'unknown'

type AuthState =
  | { status: 'loading'; guest: null }
  | { status: 'anonymous'; guest: null }
  | { status: 'redeemed'; guest: Guest }

type AuthValue = AuthState & {
  redeem: (code: string) => Promise<{ ok: true } | { ok: false; reason: RedeemError }>
  updatePrefs: (patch: Partial<Pick<Guest, 'default_anonymous' | 'locale'>>) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

const GUEST_CACHE_KEY = 'wb.guest.v1'

function cacheGuest(guest: Guest) {
  try {
    localStorage.setItem(GUEST_CACHE_KEY, JSON.stringify(guest))
  } catch {
    // Private mode — the app still works while there is a connection.
  }
}

function readCachedGuest(): Guest | null {
  try {
    const raw = localStorage.getItem(GUEST_CACHE_KEY)
    return raw ? (JSON.parse(raw) as Guest) : null
  } catch {
    return null
  }
}

/** Map a Postgres exception from redeem_invite_code onto something we can show. */
function toRedeemError(message: string | undefined): RedeemError {
  const m = message ?? ''
  if (m.includes('invalid_code')) return 'invalid_code'
  if (m.includes('code_already_used')) return 'code_already_used'
  if (m.includes('too_many_attempts')) return 'too_many_attempts'
  if (m.includes('Failed to fetch') || m.includes('NetworkError')) return 'offline'
  return 'unknown'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start from the cached identity rather than a spinner. Offline, the guests
  // query takes ten-odd seconds to fail, and a guest staring at "Loading…"
  // inside a cave will assume the app is broken and give up. loadGuest still
  // runs and corrects this to 'anonymous' if the session is genuinely gone.
  const [state, setState] = useState<AuthState>(() => {
    const cached = readCachedGuest()
    return cached ? { status: 'redeemed', guest: cached } : { status: 'loading', guest: null }
  })
  // Collapses concurrent redeem attempts onto one request. Without this, a
  // double-fire (StrictMode, a double tap, a re-mount) can issue two
  // signInAnonymously calls — and that endpoint is rate limited per IP, which
  // all twenty guests share on hotel wifi.
  const inFlight = useRef<Promise<Awaited<ReturnType<AuthValue['redeem']>>> | null>(null)

  /**
   * Re-claim the guest this device already believes it is.
   *
   * Only one session at a time can be bound to a guest row, so whenever the
   * invite link is opened somewhere else the binding moves and this device is
   * left holding a valid token that resolves to nobody. The cached guest row
   * carries the invite code, so the repair is just redeeming it again — no
   * typing, no QR card, no admin. Returns whether the device is a guest again.
   */
  const recover = useCallback(async (): Promise<boolean> => {
    const cached = readCachedGuest()
    if (!cached?.invite_code) return false
    try {
      const { data: existing } = await supabase.auth.getSession()
      if (!existing.session) {
        const { error } = await supabase.auth.signInAnonymously()
        if (error) return false
      }
      const { data, error } = await supabase.rpc('redeem_invite_code', {
        p_code: cached.invite_code,
      })
      if (error || !data) return false
      const guest = data as unknown as Guest
      cacheGuest(guest)
      setState({ status: 'redeemed', guest })
      return true
    } catch {
      return false
    }
  }, [])

  // The upload queue calls this when an upload comes back not_a_guest.
  useEffect(() => setIdentityRecovery(recover), [recover])

  // And this to check whose photos it is allowed to send. Kept in a ref so
  // the queue always reads the identity as it is now, not as it was when the
  // watcher started.
  const guestIdRef = useRef<string | null>(null)
  guestIdRef.current = state.status === 'redeemed' ? state.guest.id : null
  useEffect(() => setCurrentGuest(() => guestIdRef.current), [])

  /** Look up the guest row bound to the current session, if any. */
  const loadGuest = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setState({ status: 'anonymous', guest: null })
      return
    }

    // RLS restricts this to the caller's own row, so no filter is needed.
    const { data, error } = await supabase.from('guests').select('*').maybeSingle()

    if (data) {
      cacheGuest(data)
      setState({ status: 'redeemed', guest: data })
      return
    }

    // Signed in, no error, but bound to no guest: the binding moved to another
    // browser. Take it back before deciding this is a stranger, otherwise a
    // guest who tapped their own link twice is sent back to the code screen
    // with photos still queued under an identity that no longer resolves.
    if (!error && (await recover())) return

    // A failed request is not the same as "no such guest". Treating it as one
    // signed guests out the moment they lost signal — which is exactly when
    // they are inside Zhijin Cave wanting to take photos. Fall back to the
    // last known identity and let the upload queue hold their shots.
    if (error) {
      const cached = readCachedGuest()
      if (cached) {
        setState({ status: 'redeemed', guest: cached })
        return
      }
    }

    setState({ status: 'anonymous', guest: null })
  }, [recover])

  useEffect(() => {
    void loadGuest()
  }, [loadGuest])

  // Start draining queued photos as soon as there is an identity to upload
  // them under. Doing it here rather than on the camera screen means a guest
  // who shot offline and later opens the app to any page still syncs.
  const watching = useRef(false)
  useEffect(() => {
    if (state.status !== 'redeemed' || watching.current) return
    watching.current = true
    startQueueWatcher()
  }, [state.status])

  const redeem = useCallback<AuthValue['redeem']>(async (code) => {
    const normalised = code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    if (!normalised) return { ok: false, reason: 'invalid_code' }
    if (inFlight.current) return inFlight.current

    const run = async (): Promise<Awaited<ReturnType<AuthValue['redeem']>>> => {
      try {
        // An anonymous session may already exist from a previous visit.
        const { data: existing } = await supabase.auth.getSession()
        if (!existing.session) {
          const { error } = await supabase.auth.signInAnonymously()
          if (error) {
            // Most likely the per-IP anonymous sign-in rate limit, which
            // twenty guests behind one hotel IP can genuinely hit.
            return { ok: false, reason: toRedeemError(error.message) }
          }
        }

        const { data, error } = await supabase.rpc('redeem_invite_code', {
          p_code: normalised,
        })
        if (error) return { ok: false, reason: toRedeemError(error.message) }

        const guest = data as unknown as Guest
        cacheGuest(guest)
        setState({ status: 'redeemed', guest })
        return { ok: true }
      } catch (e) {
        return {
          ok: false,
          reason: toRedeemError(e instanceof Error ? e.message : undefined),
        }
      }
    }

    inFlight.current = run().finally(() => {
      inFlight.current = null
    })
    return inFlight.current
  }, [])

  const updatePrefs = useCallback<AuthValue['updatePrefs']>(
    async (patch) => {
      if (state.status !== 'redeemed') return
      // Optimistic: these are cosmetic, and the network here is unreliable.
      const next = { ...state.guest, ...patch }
      cacheGuest(next)
      setState({ status: 'redeemed', guest: next })
      await supabase.from('guests').update(patch).eq('id', state.guest.id)
    },
    [state],
  )

  const signOut = useCallback(async () => {
    localStorage.removeItem(GUEST_CACHE_KEY)
    await supabase.auth.signOut()
    setState({ status: 'anonymous', guest: null })
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ ...state, redeem, updatePrefs, signOut }),
    [state, redeem, updatePrefs, signOut],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

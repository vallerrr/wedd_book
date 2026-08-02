import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
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
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    guest: null,
  })
  // Collapses concurrent redeem attempts onto one request. Without this, a
  // double-fire (StrictMode, a double tap, a re-mount) can issue two
  // signInAnonymously calls — and that endpoint is rate limited per IP, which
  // all twenty guests share on hotel wifi.
  const inFlight = useRef<Promise<Awaited<ReturnType<AuthValue['redeem']>>> | null>(null)

  /** Look up the guest row bound to the current session, if any. */
  const loadGuest = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setState({ status: 'anonymous', guest: null })
      return
    }
    // RLS restricts this to the caller's own row, so no filter is needed.
    const { data } = await supabase.from('guests').select('*').maybeSingle()
    setState(data ? { status: 'redeemed', guest: data } : { status: 'anonymous', guest: null })
  }, [])

  useEffect(() => {
    void loadGuest()
  }, [loadGuest])

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

        setState({ status: 'redeemed', guest: data as unknown as Guest })
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
      setState({ status: 'redeemed', guest: { ...state.guest, ...patch } })
      await supabase.from('guests').update(patch).eq('id', state.guest.id)
    },
    [state],
  )

  const signOut = useCallback(async () => {
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

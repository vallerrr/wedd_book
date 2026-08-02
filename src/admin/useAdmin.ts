import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * The couple sign in with a real email and password, unlike guests. Admin
 * rights come from a row in admin_profiles, which is what every is_admin()
 * RLS policy checks — so this hook only mirrors the server's answer.
 */
export function useAdmin() {
  const [state, setState] = useState<'loading' | 'out' | 'in' | 'not-admin'>('loading')
  const [email, setEmail] = useState<string | null>(null)

  const check = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user || user.is_anonymous) {
      setState('out')
      return
    }
    setEmail(user.email ?? null)
    const { data: profile } = await supabase.from('admin_profiles').select('user_id').maybeSingle()
    setState(profile ? 'in' : 'not-admin')
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  const signIn = useCallback(
    async (e: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email: e, password })
      if (error) return error.message
      await check()
      return null
    },
    [check],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setState('out')
    setEmail(null)
  }, [])

  return { state, email, signIn, signOut, recheck: check }
}

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Vite inlines these at BUILD time, so a deploy whose build environment was
 * missing them produces a bundle that can never work — and throwing here would
 * white-screen every guest with nothing in the UI to explain why.
 *
 * Report it instead and let main.tsx render something readable.
 */
export const configError =
  !url || !anonKey
    ? 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY at build time.'
    : null

export const supabase = createClient<Database>(
  url || 'https://missing.invalid',
  anonKey || 'missing',
  {
    auth: {
      // Guests redeem a code once and stay signed in across all three days.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-client-info': 'wedd-book' },
    },
  },
)

import { supabase } from './supabase'
import type { Database } from './database.types'

export type ProgramDay = Database['public']['Tables']['program_days']['Row']
export type ProgramItem = Database['public']['Tables']['program_items']['Row']
export type ContentBlock = Database['public']['Tables']['content_blocks']['Row']

export type Programme = {
  days: ProgramDay[]
  items: ProgramItem[]
  blocks: ContentBlock[]
}

const CACHE_KEY = 'wb.programme.v1'

/**
 * The itinerary has to survive no signal — guests will open it on the road to
 * Qianxi and inside a 6.6 km cave to check a hotel address.
 *
 * The service worker already caches these responses, but that only helps once
 * it is installed and only for requests it sees. Keeping a copy in
 * localStorage means a cold start with no network still renders something,
 * and it also makes the page paint instantly on repeat visits instead of
 * waiting on a round trip to Tokyo.
 */
export function readCachedProgramme(): Programme | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Programme) : null
  } catch {
    return null
  }
}

function writeCachedProgramme(data: Programme) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // Private mode or a full quota — the page still works, just not offline.
  }
}

export async function fetchProgramme(): Promise<Programme> {
  const [days, items, blocks] = await Promise.all([
    supabase.from('program_days').select('*').order('position'),
    supabase.from('program_items').select('*').order('position'),
    supabase.from('content_blocks').select('*').order('position'),
  ])

  const error = days.error ?? items.error ?? blocks.error
  if (error) throw error

  const data: Programme = {
    days: days.data ?? [],
    items: items.data ?? [],
    blocks: blocks.data ?? [],
  }
  writeCachedProgramme(data)
  return data
}

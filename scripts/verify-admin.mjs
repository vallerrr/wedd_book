/**
 * Admin write access, against the local stack.
 *
 * Exists because the initial schema created admin RLS policies without the
 * table grants underneath, so admins could read everything and write nothing —
 * and nothing caught it until an admin tried to add a guest.
 *
 *   supabase start && npm run db:reset && node scripts/verify-admin.mjs
 */
import { createClient } from '@supabase/supabase-js'

const API = 'http://127.0.0.1:54321'
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const admin = createClient(API, SERVICE, { auth: { persistSession: false } })
let pass = 0
let fail = 0
const check = (n, ok, d = '') => {
  ok ? pass++ : fail++
  console.log(`  ${ok ? '\x1b[32m✓' : '\x1b[31m✗'}\x1b[0m ${n}${d ? ' — ' + d : ''}`)
}

const email = `admin${Date.now()}@test.local`
const { data: u } = await admin.auth.admin.createUser({
  email,
  password: 'localdev1234',
  email_confirm: true,
})
await admin.from('admin_profiles').insert({ user_id: u.user.id })

const asAdmin = createClient(API, ANON, { auth: { persistSession: false } })
await asAdmin.auth.signInWithPassword({ email, password: 'localdev1234' })

console.log('\nAdmin can write')
const { data: g, error: e1 } = await asAdmin.rpc('admin_create_guest', {
  p_display_name: 'Test Person',
})
check('create a guest', !e1 && !!g?.invite_code, e1?.message ?? `code ${g?.invite_code}`)
check(
  'code uses the safe 3-char alphabet',
  /^[0-9abcdefghjkmnpqrstvwxyz]{3}$/.test(g?.invite_code ?? ''),
)

const { error: e2 } = await asAdmin.rpc('admin_update_guest', {
  p_guest_id: g.id,
  p_table_number: '4',
})
check('set a table number', !e2, e2?.message)

const { error: e3 } = await asAdmin
  .from('app_settings')
  .update({ gallery_visible: true })
  .eq('id', 1)
check('change settings (reveal times, gallery)', !e3, e3?.message)
await asAdmin.from('app_settings').update({ gallery_visible: false }).eq('id', 1)

const { error: e4 } = await asAdmin
  .from('bingo_questions')
  .update({ active: true })
  .eq('position', 1)
check('edit bingo questions', !e4, e4?.message)

const { error: e5 } = await asAdmin
  .from('program_items')
  .update({ visible: true })
  .eq('position', 1)
check('edit the programme', !e5, e5?.message)

console.log('\nGuests still cannot')
const asGuest = createClient(API, ANON, { auth: { persistSession: false } })
await asGuest.auth.signInAnonymously()
await asGuest.rpc('redeem_invite_code', { p_code: g.invite_code })

const { error: g1 } = await asGuest.rpc('admin_create_guest', { p_display_name: 'Sneaky' })
check('create guests', !!g1, g1?.message?.slice(0, 40))
// RLS makes a forbidden UPDATE affect zero rows rather than erroring, so
// assert on the stored value rather than on the absence of an error.
await asGuest.from('app_settings').update({ gallery_visible: true }).eq('id', 1)
const { data: s1 } = await admin.from('app_settings').select('gallery_visible').eq('id', 1).single()
check(
  'open the gallery early',
  s1.gallery_visible === false,
  `gallery_visible=${s1.gallery_visible}`,
)

await asGuest.from('bingo_questions').update({ prompt_en: 'hax' }).eq('position', 1)
const { data: q1 } = await admin
  .from('bingo_questions')
  .select('prompt_en')
  .eq('position', 1)
  .single()
check('rewrite bingo prompts', q1.prompt_en !== 'hax', `prompt="${q1.prompt_en.slice(0, 30)}"`)
const { error: g4 } = await asGuest.rpc('admin_delete_guest', { p_guest_id: g.id })
check('delete guests', !!g4, g4?.message?.slice(0, 40))

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)

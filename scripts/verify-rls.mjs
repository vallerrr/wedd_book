/**
 * End-to-end check of the security-critical behaviour, against the local stack.
 *
 *   supabase start && supabase db reset
 *   node scripts/verify-rls.mjs
 *
 * These are the properties that cannot be wrong on the day: the daily quota,
 * blind mode, and bingo answers staying private until review night.
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const API = 'http://127.0.0.1:54321'
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const admin = createClient(API, SERVICE, { auth: { persistSession: false } })

let passed = 0
let failed = 0

function check(name, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  \x1b[32m✓\x1b[0m ${name}`)
  } else {
    failed++
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/** A fresh anonymous session that has redeemed the given code. */
async function guestClient(code) {
  const c = createClient(API, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: authErr } = await c.auth.signInAnonymously()
  if (authErr) throw new Error(`anon sign-in failed: ${authErr.message}`)
  const { data, error } = await c.rpc('redeem_invite_code', { p_code: code })
  if (error) throw new Error(`redeem failed: ${error.message}`)
  return { client: c, guest: data }
}

async function setSettings(patch) {
  const { error } = await admin.from('app_settings').update(patch).eq('id', 1)
  if (error) throw new Error(`settings update failed: ${error.message}`)
}

async function main() {
  // ---- fixtures -----------------------------------------------------------
  await admin.from('guests').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await setSettings({
    gallery_visible: false,
    disposable_reveal_at: null,
    bingo_review_at: null,
    daily_photo_credits: 20,
    capture_cost: 1,
    upload_cost: 2,
  })

  await admin.from('guests').insert([
    { invite_code: 'aa1', display_name: 'Guest A' },
    { invite_code: 'bb2', display_name: 'Guest B' },
  ])

  const a = await guestClient('aa1')
  const b = await guestClient('bb2')

  // ---- redeeming ----------------------------------------------------------
  console.log('\nInvite codes')
  check('redeem binds the guest row', a.guest.display_name === 'Guest A')

  {
    // Same session redeeming again is idempotent, not an error.
    const { data, error } = await a.client.rpc('redeem_invite_code', { p_code: 'AA1' })
    check('re-redeem is idempotent and case-insensitive', !error && data.id === a.guest.id)
  }
  {
    const c = createClient(API, ANON, { auth: { persistSession: false } })
    await c.auth.signInAnonymously()
    const { error } = await c.rpc('redeem_invite_code', { p_code: 'aa1' })
    check('a second person cannot claim a used code', error?.message.includes('code_already_used'))
  }
  {
    const c = createClient(API, ANON, { auth: { persistSession: false } })
    await c.auth.signInAnonymously()
    const { error } = await c.rpc('redeem_invite_code', { p_code: 'zzz' })
    check('unknown code is rejected', error?.message.includes('invalid_code'))
  }

  // ---- quota --------------------------------------------------------------
  console.log('\nDaily quota (20 credits; capture 1, upload 2)')
  {
    // 25 at once — exactly 20 credits' worth must get through.
    const attempts = Array.from({ length: 25 }, () =>
      a.client.rpc('create_disposable_photo', {
        p_source: 'capture',
        p_storage_path: `${a.guest.id}/${randomUUID()}.jpg`,
      }),
    )
    const results = await Promise.all(attempts)
    const ok = results.filter((r) => !r.error).length
    const quota = results.filter((r) => r.error?.message.includes('quota_exceeded')).length
    check(`exactly 20 of 25 concurrent captures succeed (got ${ok})`, ok === 20)
    check(`the other 5 are rejected as quota_exceeded (got ${quota})`, quota === 5)

    const { data: left } = await a.client.rpc('my_credits_remaining')
    check(`credits remaining reads 0 (got ${left})`, left === 0)
  }
  {
    const { error } = await a.client.rpc('create_disposable_photo', {
      p_source: 'upload',
      p_storage_path: `${a.guest.id}/${randomUUID()}.jpg`,
    })
    check('an upload past the cap is refused too', error?.message.includes('quota_exceeded'))
  }
  {
    // Upload costs double.
    const { data: before } = await b.client.rpc('my_credits_remaining')
    await b.client.rpc('create_disposable_photo', {
      p_source: 'upload',
      p_storage_path: `${b.guest.id}/${randomUUID()}.jpg`,
    })
    const { data: after } = await b.client.rpc('my_credits_remaining')
    check(`camera-roll upload costs 2 credits (${before} → ${after})`, before - after === 2)
  }
  {
    // A failed upload gives the credit back.
    const { data: photo } = await b.client.rpc('create_disposable_photo', {
      p_source: 'capture',
      p_storage_path: `${b.guest.id}/${randomUUID()}.jpg`,
    })
    const { data: spent } = await b.client.rpc('my_credits_remaining')
    await b.client.rpc('refund_failed_photo', { p_photo_id: photo.id })
    const { data: refunded } = await b.client.rpc('my_credits_remaining')
    check(`a failed upload refunds its credit (${spent} → ${refunded})`, refunded - spent === 1)
  }

  // ---- blind mode ---------------------------------------------------------
  console.log('\nBlind mode (disposable)')
  {
    const { data } = await a.client.from('photos').select('id').eq('kind', 'disposable')
    check(
      `the owner cannot see their own disposable photos (saw ${data?.length ?? 0})`,
      data?.length === 0,
    )
  }
  {
    const { data } = await b.client.from('photos').select('id').eq('kind', 'disposable')
    check(`nobody else can see them either (saw ${data?.length ?? 0})`, data?.length === 0)
  }
  {
    // Reveal time alone is not enough — the gallery must also be open.
    await setSettings({ disposable_reveal_at: new Date(Date.now() - 1000).toISOString() })
    const { data } = await a.client.from('photos').select('id').eq('kind', 'disposable')
    check('reveal time alone does not open the gallery', data?.length === 0)

    await setSettings({ gallery_visible: true })
    const { data: after } = await a.client.from('photos').select('id').eq('kind', 'disposable')
    check(
      `reveal + gallery open makes them visible (saw ${after?.length ?? 0})`,
      (after?.length ?? 0) > 0,
    )

    await setSettings({ gallery_visible: false, disposable_reveal_at: null })
  }

  // ---- bingo --------------------------------------------------------------
  console.log('\nBingo (private until review night)')
  const { data: q } = await admin
    .from('bingo_questions')
    .select('id, position')
    .eq('position', 1)
    .single()
  {
    await a.client.rpc('upsert_bingo_photo', {
      p_question_id: q.id,
      p_source: 'capture',
      p_storage_path: `${a.guest.id}/${randomUUID()}.jpg`,
    })
    const { data: left } = await a.client.rpc('my_credits_remaining')
    check(`bingo photos cost no credits (still ${left})`, left === 0)
  }
  {
    const { data } = await a.client.from('photos').select('id').eq('kind', 'bingo')
    check('you always see your own bingo answer', data?.length === 1)
  }
  {
    const { data } = await b.client.from('photos').select('id').eq('kind', 'bingo')
    check(`others cannot see it before review night (saw ${data?.length ?? 0})`, data?.length === 0)
  }
  {
    // Re-answering replaces rather than adds.
    await a.client.rpc('upsert_bingo_photo', {
      p_question_id: q.id,
      p_source: 'upload',
      p_storage_path: `${a.guest.id}/${randomUUID()}.jpg`,
    })
    const { data } = await a.client.from('photos').select('id').eq('kind', 'bingo')
    check(`replacing leaves exactly one live answer (saw ${data?.length ?? 0})`, data?.length === 1)

    const { count } = await admin
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'bingo')
      .eq('status', 'hidden')
    check('the replaced photo is retained as hidden, not deleted', count === 1)
  }
  {
    await setSettings({ bingo_review_at: new Date(Date.now() - 1000).toISOString() })
    const { data } = await b.client.from('photos').select('id').eq('kind', 'bingo')
    check(`review night opens everyone's answers (saw ${data?.length ?? 0})`, data?.length === 1)
    await setSettings({ bingo_review_at: null })
  }

  // ---- direct write attempts ---------------------------------------------
  console.log('\nDirect writes are blocked')
  {
    const { error } = await a.client.from('photos').insert({
      guest_id: a.guest.id,
      kind: 'disposable',
      source: 'capture',
      storage_path: `${a.guest.id}/${randomUUID()}.jpg`,
      local_day: '2026-09-26',
    })
    check('a guest cannot insert a photo row directly (bypassing quota)', Boolean(error))
  }
  {
    const { error } = await a.client
      .from('photo_credits')
      .update({ used: 0 })
      .eq('guest_id', a.guest.id)
    check('a guest cannot reset their own credit ledger', Boolean(error))
  }
  {
    const { error } = await a.client
      .from('guests')
      .update({ invite_code: 'hax' })
      .eq('id', a.guest.id)
    check('a guest cannot rewrite their invite code', Boolean(error))
  }
  {
    const { data } = await a.client.from('guests').select('id')
    check(`a guest sees only their own row (saw ${data?.length ?? 0})`, data?.length === 1)
  }

  // ---- storage ------------------------------------------------------------
  // The claim being tested is that blind mode holds at the byte level, not
  // just in the UI: a private bucket plus a policy that mirrors can_view_photo.
  console.log('\nStorage (private bucket)')
  const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0xff, 0xd9])], {
    type: 'image/jpeg',
  })
  const path = `${b.guest.id}/${randomUUID()}.jpg`
  {
    // The row must exist first — an upload cannot happen without a spent credit.
    const { error: rpcErr } = await b.client.rpc('create_disposable_photo', {
      p_source: 'capture',
      p_storage_path: path,
    })
    check('creating the row first succeeds', !rpcErr, rpcErr?.message)

    const { error } = await b.client.storage.from('photos').upload(path, jpeg)
    check('the owner can upload to their own path', !error, error?.message)
  }
  {
    const orphan = `${b.guest.id}/${randomUUID()}.jpg`
    const { error } = await b.client.storage.from('photos').upload(orphan, jpeg)
    check('an upload with no photo row is refused', Boolean(error))
  }
  {
    const { error } = await a.client.storage.from('photos').upload(`${b.guest.id}/x.jpg`, jpeg)
    check("a guest cannot upload into someone else's folder", Boolean(error))
  }
  {
    const { data } = await b.client.storage.from('photos').createSignedUrl(path, 60)
    check('the owner cannot sign a URL for their own blind photo', !data?.signedUrl)
  }
  {
    const { data } = await a.client.storage.from('photos').createSignedUrl(path, 60)
    check('nobody else can sign one either', !data?.signedUrl)
  }
  {
    await setSettings({
      gallery_visible: true,
      disposable_reveal_at: new Date(Date.now() - 1000).toISOString(),
    })
    const { data, error } = await b.client.storage.from('photos').createSignedUrl(path, 60)
    check('after reveal, a signed URL is issued', Boolean(data?.signedUrl), error?.message)

    if (data?.signedUrl) {
      const res = await fetch(data.signedUrl)
      check(`and the bytes actually download (HTTP ${res.status})`, res.ok)
    }
    await setSettings({ gallery_visible: false, disposable_reveal_at: null })
  }
  {
    const res = await fetch(`${API}/storage/v1/object/public/photos/${path}`)
    check(`the bucket is not public (HTTP ${res.status})`, !res.ok)
  }

  // ---- gallery feed -------------------------------------------------------
  // The feed resolves author names through a SECURITY DEFINER function, so it
  // has its own chance to leak what the table policy hides.
  console.log('\nGallery feed')
  await setSettings({ gallery_visible: false, disposable_reveal_at: null })
  // The feed only shows photos whose bytes actually landed, so promote the
  // fixtures the way the upload queue would.
  await admin.from('photos').update({ status: 'ready' }).eq('kind', 'disposable').eq('status', 'pending')
  {
    const { data } = await a.client.rpc('gallery_state')
    const st = Array.isArray(data) ? data[0] : data
    check('closed before reveal', st.open === false)

    const { data: feed } = await a.client.rpc('gallery_feed')
    check(`feed is empty before reveal (saw ${feed?.length ?? 0})`, (feed?.length ?? 0) === 0)
  }
  {
    await setSettings({
      gallery_visible: true,
      disposable_reveal_at: new Date(Date.now() - 1000).toISOString(),
    })
    const { data: feed } = await a.client.rpc('gallery_feed')
    check(`feed fills after reveal (saw ${feed?.length ?? 0})`, (feed?.length ?? 0) > 0)

    const ownedByA = feed.filter((r) => r.mine).length
    check(`"mine" marks the caller's own photos (${ownedByA} of ${feed.length})`, ownedByA > 0)

    // Guest B sees the same photos but none of them as theirs.
    const { data: feedB } = await b.client.rpc('gallery_feed')
    check('the same photos are visible to everyone', feedB.length === feed.length)
    check(
      "...and A's photos are not marked as B's",
      feedB.filter((r) => r.mine).length < feedB.length,
    )
  }
  {
    // Anonymity must be applied server-side, not left to the UI.
    const { data: feed } = await a.client.rpc('gallery_feed')
    const target = feed.find((r) => r.mine)
    await a.client.from('photos').update({ display_mode: 'anonymous' }).eq('id', target.id)

    const { data: after } = await b.client.rpc('gallery_feed')
    const seen = after.find((r) => r.id === target.id)
    check('an anonymous photo exposes no author name', seen.author === null)

    await a.client.from('photos').update({ display_mode: 'named' }).eq('id', target.id)
    const { data: renamed } = await b.client.rpc('gallery_feed')
    check('naming it again restores the author', renamed.find((r) => r.id === target.id).author !== null)
  }
  {
    // A guest may rename their own photo, never someone else's.
    const { data: feed } = await b.client.rpc('gallery_feed')
    const notMine = feed.find((r) => !r.mine)
    if (notMine) {
      await b.client.from('photos').update({ display_mode: 'anonymous' }).eq('id', notMine.id)
      const { data: after } = await b.client.rpc('gallery_feed')
      check(
        "a guest cannot anonymise someone else's photo",
        after.find((r) => r.id === notMine.id).display_mode !== 'anonymous',
      )
    }
  }
  await setSettings({ gallery_visible: false, disposable_reveal_at: null })

  // ---- public programme ---------------------------------------------------
  console.log('\nPublic programme')
  {
    const anon = createClient(API, ANON, { auth: { persistSession: false } })
    const { data, error } = await anon.from('program_days').select('day_date')
    check(
      `the itinerary is readable with no session (saw ${data?.length ?? 0} days)`,
      !error && data.length === 3,
    )

    const { data: photos } = await anon.from('photos').select('id')
    check('...but photos are not', (photos?.length ?? 0) === 0)
  }

  console.log(`\n${passed} passed, ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\n\x1b[31mharness error:\x1b[0m', e.message)
  process.exit(1)
})

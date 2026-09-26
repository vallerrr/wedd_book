import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import { supabase } from './supabase'

/**
 * Durable upload queue.
 *
 * This is the single most important piece of resilience in the app. There is
 * no signal inside Zhijin Cave and the hotel wifi may collapse entirely, so a
 * photo is written to IndexedDB *before* anything touches the network. Guests
 * keep shooting regardless; the bytes drain out whenever a connection returns,
 * even if that is after they get home.
 *
 * Order of operations per photo:
 *   1. store the blobs locally                       (survives a closed tab)
 *   2. RPC — spends the credit, creates a pending row (quota stays honest)
 *   3. upload full + thumb to Storage
 *   4. RPC — mark the row ready
 *   5. drop the local copy
 *
 * Steps 2–4 are each retried independently, so a failure part-way through
 * resumes rather than restarting or double-spending.
 */

/**
 * A photo as it is written to IndexedDB.
 *
 * Deliberately raw bytes and not a Blob. WebKit fails to structured-clone a
 * Blob into an object store in several situations — reliably in Private
 * Browsing, intermittently otherwise — and throws "Error preparing Blob/File
 * data to be stored in object store". Since the queue stores the photo before
 * it touches the network, that one throw killed every upload path at step
 * one: no photo, no credit spent, nothing sent. An ArrayBuffer clones
 * everywhere, so we carry the bytes and rebuild the Blob on the way out.
 */
export type StoredBytes = { buf: ArrayBuffer; type: string }

async function toStored(blob: Blob): Promise<StoredBytes> {
  return { buf: await blob.arrayBuffer(), type: blob.type || 'image/jpeg' }
}

/** Accepts either shape, so photos queued by an older build still upload. */
function toBlob(value: Blob | StoredBytes): Blob {
  return value instanceof Blob ? value : new Blob([value.buf], { type: value.type })
}

export type QueueItem = {
  id: string
  kind: 'disposable' | 'bingo'
  source: 'capture' | 'upload'
  questionId: string | null
  guestId: string
  full: Blob | StoredBytes
  thumb: Blob | StoredBytes
  width: number
  height: number
  bytes: number
  /** Set once the RPC has run — the credit is spent from this point on. */
  photoId: string | null
  storagePath: string
  thumbPath: string
  fullUploaded: boolean
  thumbUploaded: boolean
  attempts: number
  lastError: string | null
  createdAt: number
}

interface QueueDB extends DBSchema {
  queue: { key: string; value: QueueItem; indexes: { createdAt: number } }
}

let dbPromise: Promise<IDBPDatabase<QueueDB>> | null = null

function db() {
  dbPromise ??= openDB<QueueDB>('wedd-book', 1, {
    upgrade(database) {
      const store = database.createObjectStore('queue', { keyPath: 'id' })
      store.createIndex('createdAt', 'createdAt')
    },
  })
  return dbPromise
}

// ---------------------------------------------------------------------------
// Subscriptions — the camera screen shows how many photos are still in flight.
// ---------------------------------------------------------------------------

export type QueueStatus = {
  pending: number
  /** Terminal failures the guest should know about, e.g. quota_exceeded. */
  lastRejection: string | null
}

type Listener = (status: QueueStatus) => void
const listeners = new Set<Listener>()
let lastRejection: string | null = null

export function subscribeToQueue(fn: Listener): () => void {
  listeners.add(fn)
  void notify()
  return () => {
    listeners.delete(fn)
  }
}

async function notify() {
  const pending = await (await db()).count('queue')
  const status: QueueStatus = { pending, lastRejection }
  for (const fn of listeners) fn(status)
}

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

export async function enqueuePhoto(input: {
  kind: QueueItem['kind']
  source: QueueItem['source']
  questionId?: string | null
  guestId: string
  full: Blob
  thumb: Blob
  width: number
  height: number
  bytes: number
}): Promise<string> {
  const id = crypto.randomUUID()
  const item: QueueItem = {
    id,
    kind: input.kind,
    source: input.source,
    questionId: input.questionId ?? null,
    guestId: input.guestId,
    full: await toStored(input.full),
    thumb: await toStored(input.thumb),
    width: input.width,
    height: input.height,
    bytes: input.bytes,
    photoId: null,
    storagePath: `${input.guestId}/${id}.jpg`,
    thumbPath: `${input.guestId}/${id}_t.jpg`,
    fullUploaded: false,
    thumbUploaded: false,
    attempts: 0,
    lastError: null,
    createdAt: Date.now(),
  }

  try {
    await (await db()).put('queue', item)
  } catch (e) {
    // Private Browsing can refuse the write outright. Persisting is what
    // makes the queue survive a closed tab, but it is not what makes the
    // photo upload — so fall back to sending it straight out of memory
    // rather than losing it. A failure here has nothing to resume from, so
    // it propagates and the screen says so.
    console.warn('[queue] could not persist; uploading directly', e)
    await processItem(item)
    await notify()
    return id
  }

  await notify()
  void processQueue()
  return id
}

// ---------------------------------------------------------------------------
// Draining
// ---------------------------------------------------------------------------

/** Errors that will never succeed on retry — drop the item and tell the guest. */
function isTerminal(message: string) {
  return (
    message.includes('quota_exceeded') ||
    message.includes('bad_source') ||
    message.includes('unknown_question')
  )
}

/**
 * Re-bind this session to the guest it thinks it is. Supplied by the auth
 * layer, which owns the cached invite code; registering it here rather than
 * importing it keeps the dependency pointing one way.
 */
let recoverIdentity: (() => Promise<boolean>) | null = null

export function setIdentityRecovery(fn: () => Promise<boolean>) {
  recoverIdentity = fn
}

/**
 * Who this device is signed in as right now. Also supplied by the auth layer.
 *
 * The RPCs derive the owner from the session, never from the queue item, so a
 * photo drains under whoever happens to be signed in when the connection
 * returns. On a shared phone that silently re-attributed one guest's bingo
 * answer to another — it appeared, correctly stored, as the wrong person's
 * private answer. Items are now only sent while their owner is the one
 * signed in; everyone else's simply wait.
 */
let currentGuestId: (() => string | null) | null = null

export function setCurrentGuest(fn: () => string | null) {
  currentGuestId = fn
}

/**
 * Nothing in here may wait forever.
 *
 * fetch has no default timeout, and a phone that has drifted off hotel wifi
 * without noticing will leave a request hanging indefinitely rather than
 * failing. One hung upload used to latch `running` on for good: every later
 * kick returned at the guard, so the queue was dead for the rest of the
 * session — no photos, no bingo answers, and a credit counter frozen at
 * whatever it last read. Losing a slow request and retrying costs nothing,
 * because every step is idempotent.
 */
const STEP_TIMEOUT_MS = 20_000

// PromiseLike, not Promise: supabase-js query builders are thenables that only
// dispatch the request when awaited, so they do not satisfy Promise.
function withTimeout<T>(work: PromiseLike<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout:${label}`)), STEP_TIMEOUT_MS)
    Promise.resolve(work).then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e: unknown) => {
        clearTimeout(timer)
        reject(e instanceof Error ? e : new Error(String(e)))
      },
    )
  })
}

let running = false
let runStartedAt = 0

/** Longest a whole pass may plausibly take before we assume it died. */
const RUN_WATCHDOG_MS = 5 * 60_000

export async function processQueue(): Promise<void> {
  // Belt and braces alongside the per-step timeout: if a pass somehow stops
  // without clearing the flag, later kicks must still get through.
  if (running && Date.now() - runStartedAt < RUN_WATCHDOG_MS) return
  if (!navigator.onLine) return
  running = true
  const myRun = Date.now()
  runStartedAt = myRun

  try {
    const database = await db()
    const items = await database.getAllFromIndex('queue', 'createdAt')

    const signedInAs = currentGuestId?.() ?? null

    for (const item of items) {
      // Never upload on someone else's behalf. Leave it queued: the owner
      // signing back in on this device is what releases it.
      if (!signedInAs || item.guestId !== signedInAs) continue

      try {
        await processItem(item)
        await database.delete('queue', item.id)
        await notify()
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)

        // guests.auth_user_id holds exactly one session, so re-opening the
        // invite link anywhere else — most often the WeChat browser, because
        // that is where the link was sent — moves the binding and leaves this
        // device authenticated but nameless. It still looks signed in: the
        // guest row is cached and the credit counter still reads full. Every
        // upload then failed with not_a_guest, which used to count as
        // terminal, so the queue deleted the photo. Re-redeem and keep the
        // bytes; this pass stops either way and the next one retries.
        if (message.includes('not_a_guest')) {
          const healed = recoverIdentity ? await recoverIdentity() : false
          if (!healed) {
            lastRejection = message
            await notify()
          }
          break
        }

        if (isTerminal(message)) {
          // The credit was never spent (the RPC is what spends it), or the
          // photo can never be accepted. Keeping it would retry forever.
          await database.delete('queue', item.id)
          lastRejection = message
          await notify()
          continue
        }

        // Re-read rather than writing back the copy captured before the
        // attempt: processItem persists its progress as it goes (photoId,
        // then each uploaded blob), and spreading the stale item would
        // discard it. That left photoId null, so every retry called the RPC
        // again and died on the duplicate storage path — a photo that could
        // never finish uploading.
        const fresh = (await database.get('queue', item.id)) ?? item
        await database.put('queue', {
          ...fresh,
          attempts: fresh.attempts + 1,
          lastError: message,
        })
        await notify()
        // Network trouble affects every item, so stop rather than hammering.
        break
      }
    }
  } finally {
    // Only the newest pass may clear the flag. A pass the watchdog gave up on
    // can still return later, and it must not unlock a run that has since
    // started.
    if (runStartedAt === myRun) running = false
  }
}

/**
 * Upload one object, treating "already there" as done.
 *
 * Deliberately not `upsert: true`: that makes Storage perform an update, and
 * guests have no UPDATE policy on storage.objects — only INSERT — so every
 * upload was rejected as an RLS violation. Plain inserts are also the safer
 * grant to hold. Paths are UUIDs unique to one queue item, so an object
 * already sitting at this path can only be ours from an earlier attempt, and
 * treating that as success keeps retries idempotent.
 */
async function uploadOnce(path: string, blob: Blob) {
  const { error } = await withTimeout(
    supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' }),
    'upload',
  )
  if (!error) return

  const message = error.message.toLowerCase()
  const alreadyThere =
    message.includes('already exists') ||
    message.includes('duplicate') ||
    message.includes('resource already')
  if (!alreadyThere) throw new Error(error.message)
}

async function processItem(item: QueueItem) {
  // One mutable copy, persisted after every step. Each stage is skipped if
  // already done, so a retry resumes instead of restarting — which is what
  // stops a second credit being spent for the same photo.
  let current = { ...item }
  const save = async (patch: Partial<QueueItem>) => {
    current = { ...current, ...patch }
    try {
      await (await db()).put('queue', current)
    } catch (e) {
      // Best effort. In-memory `current` still drives the rest of this run,
      // and an item that was never persisted has no retry to stay consistent
      // with, so a failed checkpoint must not abort the upload.
      console.warn('[queue] checkpoint failed', e)
    }
  }

  // 1. Spend the credit and create the row, once and only once.
  if (!current.photoId) {
    const { data, error } = await withTimeout(
      item.kind === 'bingo'
        ? supabase.rpc('upsert_bingo_photo', {
            p_question_id: item.questionId!,
            p_source: item.source,
            p_storage_path: item.storagePath,
            p_thumb_path: item.thumbPath,
            p_width: item.width,
            p_height: item.height,
            p_bytes: item.bytes,
          })
        : supabase.rpc('create_disposable_photo', {
            p_source: item.source,
            p_storage_path: item.storagePath,
            p_thumb_path: item.thumbPath,
            p_width: item.width,
            p_height: item.height,
            p_bytes: item.bytes,
          }),
      'create',
    )

    if (error) throw new Error(error.message)

    // Persist immediately: if the upload fails next, a retry must not spend a
    // second credit for the same photo.
    await save({ photoId: (data as unknown as { id: string }).id })
  }

  // 2. Upload the bytes.
  if (!current.fullUploaded) {
    await uploadOnce(current.storagePath, toBlob(current.full))
    await save({ fullUploaded: true })
  }

  if (!current.thumbUploaded) {
    await uploadOnce(current.thumbPath, toBlob(current.thumb))
    await save({ thumbUploaded: true })
  }

  // 3. Flip the row to ready.
  const { error } = await withTimeout(
    supabase.rpc('mark_photo_ready', { p_photo_id: current.photoId! }),
    'ready',
  )
  if (error) throw new Error(error.message)
}

/**
 * The thumbnail still sitting in the queue for a bingo question, if any.
 *
 * A guest's own bingo answer is supposed to be visible to them immediately,
 * but until the bytes reach Storage there is nothing to sign a URL for — so
 * the screen went blank the moment they navigated away and back. The local
 * copy is right here; use it until the upload lands.
 *
 * guestId is required, not optional. One browser can hold queued photos for
 * more than one guest — a shared phone, or a code re-redeemed on a device
 * someone else had used — and IndexedDB is per-browser, not per-identity.
 * Without this filter the fallback showed whoever's copy happened to be in
 * the queue, which is a private answer shown to the wrong person.
 */
export async function queuedBingoThumb(
  questionId: string,
  guestId: string,
): Promise<Blob | null> {
  try {
    const items = await (await db()).getAll('queue')
    const hit = items.find(
      (i) => i.kind === 'bingo' && i.questionId === questionId && i.guestId === guestId,
    )
    return hit ? toBlob(hit.thumb) : null
  } catch {
    return null
  }
}

/** Every queued bingo thumbnail for this guest, keyed by question. */
export async function queuedBingoThumbs(guestId: string): Promise<Map<string, Blob>> {
  const out = new Map<string, Blob>()
  try {
    for (const i of await (await db()).getAll('queue')) {
      if (i.kind === 'bingo' && i.questionId && i.guestId === guestId) {
        out.set(i.questionId, toBlob(i.thumb))
      }
    }
  } catch {
    // No local queue is fine — the signed URLs cover the uploaded ones.
  }
  return out
}

export function clearRejection() {
  lastRejection = null
  void notify()
}

/**
 * Retry whenever a connection plausibly returns. Guests move between hotel
 * wifi, mobile data and no signal at all over three days, so this listens
 * broadly rather than assuming a single reconnect event.
 */
export function startQueueWatcher() {
  const kick = () => void processQueue()
  window.addEventListener('online', kick)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') kick()
  })
  // Backstop: 'online' is unreliable on mobile, and a captive portal can
  // report online while nothing actually routes.
  setInterval(kick, 30_000)
  kick()
}

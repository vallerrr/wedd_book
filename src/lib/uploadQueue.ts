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

export type QueueItem = {
  id: string
  kind: 'disposable' | 'bingo'
  source: 'capture' | 'upload'
  questionId: string | null
  guestId: string
  full: Blob
  thumb: Blob
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
    full: input.full,
    thumb: input.thumb,
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

  await (await db()).put('queue', item)
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
    message.includes('not_a_guest') ||
    message.includes('bad_source') ||
    message.includes('unknown_question')
  )
}

let running = false

export async function processQueue(): Promise<void> {
  if (running || !navigator.onLine) return
  running = true

  try {
    const database = await db()
    const items = await database.getAllFromIndex('queue', 'createdAt')

    for (const item of items) {
      try {
        await processItem(item)
        await database.delete('queue', item.id)
        await notify()
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)

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
    running = false
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
  const { error } = await supabase.storage
    .from('photos')
    .upload(path, blob, { contentType: 'image/jpeg' })
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
    await (await db()).put('queue', current)
  }

  // 1. Spend the credit and create the row, once and only once.
  if (!current.photoId) {
    const { data, error } =
      item.kind === 'bingo'
        ? await supabase.rpc('upsert_bingo_photo', {
            p_question_id: item.questionId!,
            p_source: item.source,
            p_storage_path: item.storagePath,
            p_thumb_path: item.thumbPath,
            p_width: item.width,
            p_height: item.height,
            p_bytes: item.bytes,
          })
        : await supabase.rpc('create_disposable_photo', {
            p_source: item.source,
            p_storage_path: item.storagePath,
            p_thumb_path: item.thumbPath,
            p_width: item.width,
            p_height: item.height,
            p_bytes: item.bytes,
          })

    if (error) throw new Error(error.message)

    // Persist immediately: if the upload fails next, a retry must not spend a
    // second credit for the same photo.
    await save({ photoId: (data as unknown as { id: string }).id })
  }

  // 2. Upload the bytes.
  if (!current.fullUploaded) {
    await uploadOnce(current.storagePath, current.full)
    await save({ fullUploaded: true })
  }

  if (!current.thumbUploaded) {
    await uploadOnce(current.thumbPath, current.thumb)
    await save({ thumbUploaded: true })
  }

  // 3. Flip the row to ready.
  const { error } = await supabase.rpc('mark_photo_ready', { p_photo_id: current.photoId! })
  if (error) throw new Error(error.message)
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

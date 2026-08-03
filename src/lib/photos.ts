import { supabase } from './supabase'

/**
 * Signed URLs for photos in the private bucket.
 *
 * The bucket is private, so every image needs a signed URL — and the storage
 * policy runs can_view_photo underneath, which means a request for something
 * still hidden simply fails rather than leaking. Nothing here needs to
 * re-implement the blind rules; it only asks.
 */

const TTL_SECONDS = 60 * 60
const cache = new Map<string, { url: string; expires: number }>()

export async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null

  const hit = cache.get(path)
  if (hit && hit.expires > Date.now()) return hit.url

  const { data, error } = await supabase.storage.from('photos').createSignedUrl(path, TTL_SECONDS)
  if (error || !data?.signedUrl) return null

  // Expire our copy early so a URL is never handed out moments before it dies.
  cache.set(path, { url: data.signedUrl, expires: Date.now() + (TTL_SECONDS - 300) * 1000 })
  return data.signedUrl
}

export async function signedUrls(paths: (string | null)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const results = await Promise.all(
    paths.filter(Boolean).map(async (p) => [p as string, await signedUrl(p)] as const),
  )
  for (const [path, url] of results) if (url) out.set(path, url)
  return out
}

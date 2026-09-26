import imageCompression from 'browser-image-compression'

export type ProcessedPhoto = {
  full: Blob
  thumb: Blob
  width: number
  height: number
  bytes: number
}

// Roughly 1,500 photos over three days at these sizes lands under a gigabyte,
// which is what the storage budget assumes.
const FULL = { maxWidthOrHeight: 2048, maxSizeMB: 0.6, initialQuality: 0.82 }
const THUMB = { maxWidthOrHeight: 480, maxSizeMB: 0.06, initialQuality: 0.7 }

async function dimensions(blob: Blob): Promise<{ width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(blob)
    const { width, height } = bitmap
    bitmap.close()
    return { width, height }
  } catch {
    // createImageBitmap is missing or refuses the format on some older mobile
    // Safari builds. An <img> decodes anything the browser can display.
    return await new Promise((resolve) => {
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        // Unknown beats refusing to store the photo. Dimensions are metadata.
        resolve({ width: 0, height: 0 })
      }
      img.src = url
    })
  }
}

/** Last-resort resize that uses nothing but a canvas. */
async function canvasResize(file: Blob, maxEdge: number, quality: number): Promise<Blob> {
  const { width, height } = await dimensions(file)
  if (!width || !height) throw new Error('undecodable')

  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode_failed'))
      el.src = url
    })
    ctx.drawImage(img, 0, 0, w, h)
  } finally {
    URL.revokeObjectURL(url)
  }

  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  if (!out) throw new Error('encode_failed')
  return out
}

type ResizeOpts = { maxWidthOrHeight: number; maxSizeMB: number; initialQuality: number }

/**
 * Produce one derivative, trying progressively dumber methods.
 *
 * browser-image-compression is the good path, but it spawns a web worker from
 * a blob URL and draws the photo to a canvas — and a full-resolution phone
 * photo can exceed mobile Safari's canvas area limit outright. When it threw,
 * every caller swallowed the rejection: no photo queued, no credit spent and
 * no message. The upload button simply did nothing.
 *
 * So: worker, then no worker, then a plain canvas, then the original bytes.
 * An oversized upload is not a problem. A lost photo is.
 */
async function derivative(file: File, opts: ResizeOpts, label: string): Promise<Blob> {
  const attempts: Array<() => Promise<Blob>> = [
    () => imageCompression(file, { ...opts, useWebWorker: true, fileType: 'image/jpeg' }),
    () => imageCompression(file, { ...opts, useWebWorker: false, fileType: 'image/jpeg' }),
    () => canvasResize(file, opts.maxWidthOrHeight, opts.initialQuality),
  ]

  for (const attempt of attempts) {
    try {
      const out = await attempt()
      if (out && out.size > 0) return out
    } catch {
      // Fall through to the next, dumber, method.
    }
  }

  console.warn(`[imaging] every resize failed for ${label}; storing the original`)
  return file
}

/**
 * Compress one capture into the two derivatives we store: a full-size image
 * and a thumbnail for gallery grids.
 *
 * EXIF is dropped — browser-image-compression re-encodes through a canvas and
 * does not preserve it unless asked. That is deliberate: camera-roll uploads
 * carry GPS coordinates, and guests should not be publishing where they were
 * to a shared gallery. Orientation is applied to the pixels first, so photos
 * taken sideways still come out the right way up.
 */
export async function processPhoto(input: Blob | File): Promise<ProcessedPhoto> {
  const file =
    input instanceof File
      ? input
      : new File([input], 'photo.jpg', { type: input.type || 'image/jpeg' })

  // Sequential, not Promise.all: two simultaneous full-resolution decodes are
  // what tips a phone over its memory limit in the first place.
  const full = await derivative(file, FULL, 'full')
  const thumb = await derivative(file, THUMB, 'thumb')

  const { width, height } = await dimensions(full)
  return { full, thumb, width, height, bytes: full.size }
}

/**
 * Grab a still from a live camera stream.
 *
 * The frame is drawn straight to an offscreen canvas and handed back as a
 * blob. Nothing is ever rendered back to the guest — that is the whole point
 * of the disposable camera.
 */
export async function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) throw new Error('camera_not_ready')

  // iOS fixes a stream's orientation when it is first granted and never
  // re-orients it — not even if the stream is restarted. Hold the phone
  // sideways and the landscape scene arrives rotated 90° inside a portrait
  // buffer, and a canvas capture carries no EXIF to fix it downstream.
  //
  // So compare the buffer's shape against how the device is actually held. If
  // they disagree, the buffer is stale and we rotate it back. Android, where
  // restarting the stream does re-orient it, sees them agree and is left
  // alone — the same rule covers both without sniffing for a platform.
  const angle = screen.orientation?.angle ?? 0
  const deviceLandscape = angle === 90 || angle === 270
  const bufferLandscape = width > height
  const stale = deviceLandscape !== bufferLandscape

  const canvas = document.createElement('canvas')
  canvas.width = stale ? height : width
  canvas.height = stale ? width : height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')

  if (stale) {
    // Turning the phone anticlockwise makes the world appear to turn
    // clockwise inside the buffer, so undo exactly the reported angle.
    // A landscape buffer on an upright device (angle 0) has no reported
    // angle to undo, so fall back to a quarter turn.
    const correction = deviceLandscape ? -angle : 90
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((correction * Math.PI) / 180)
    ctx.drawImage(video, -width / 2, -height / 2, width, height)
  } else {
    ctx.drawImage(video, 0, 0, width, height)
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encode_failed'))),
      'image/jpeg',
      0.92,
    )
  })
}

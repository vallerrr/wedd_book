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
  const bitmap = await createImageBitmap(blob)
  const { width, height } = bitmap
  bitmap.close()
  return { width, height }
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

  const [full, thumb] = await Promise.all([
    imageCompression(file, { ...FULL, useWebWorker: true, fileType: 'image/jpeg' }),
    imageCompression(file, { ...THUMB, useWebWorker: true, fileType: 'image/jpeg' }),
  ])

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

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')
  ctx.drawImage(video, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encode_failed'))),
      'image/jpeg',
      0.92,
    )
  })
}

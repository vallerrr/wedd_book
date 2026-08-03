/**
 * Shutter feedback.
 *
 * The camera shows no preview and no captured image, so without this a guest
 * taps and nothing at all happens — which reads as "broken", not as "blind".
 * A flash, a click and a buzz are the only confirmation they get, so all three
 * fire together and none of them can be allowed to throw.
 */

let ctx: AudioContext | null = null

export function playShutter() {
  try {
    // Created lazily inside the tap: iOS won't start an AudioContext otherwise.
    ctx ??= new AudioContext()
    void ctx.resume()

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    // Short, dry click rather than a tone — closer to a mechanical shutter.
    osc.type = 'square'
    osc.frequency.setValueAtTime(1800, now)
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.045)
    gain.gain.setValueAtTime(0.14, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)

    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.07)
  } catch {
    // Audio is a nicety; a silent shutter is still a shutter.
  }
}

export function buzz() {
  try {
    navigator.vibrate?.(18)
  } catch {
    // Not supported on iOS Safari — the flash and click carry it there.
  }
}

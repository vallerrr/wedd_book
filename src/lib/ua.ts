/**
 * WeChat's in-app browser can't reliably reach getUserMedia, so the camera
 * would fail silently and confusingly. We don't support it — but links get
 * forwarded into WeChat regardless, so gated routes show an interstitial.
 *
 * The public itinerary is exempt: reading it in WeChat is perfectly fine.
 */
export function isWeChatBrowser(): boolean {
  return /micromessenger/i.test(navigator.userAgent)
}

export function isIOS(): boolean {
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as Macintosh but has touch points
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** Whether true blind capture is possible, or we fall back to <input capture>. */
export function supportsGetUserMedia(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia)
}

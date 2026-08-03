import { registerSW } from 'virtual:pwa-register'

/**
 * Service worker registration, with one deliberate addition: reload once when
 * a new deploy takes over.
 *
 * Without it, a returning guest loads the previous version from the precache
 * and only sees the update on their *second* visit. That bit us once already —
 * a shipped fix looked like it hadn't deployed at all. During a three-day
 * event where a fix might go out on the morning of day one, "guests are a
 * version behind until they happen to reload twice" is not acceptable.
 */
export function setupPWA() {
  // clientsClaim fires controllerchange on the very first load too, when the
  // worker claims a page that had none. Only a *change* of controller means a
  // new deploy, so remember whether one was already in charge.
  const hadController = Boolean(navigator.serviceWorker?.controller)
  let reloading = false

  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })

  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // Guests leave the app open for hours at a time, so a deploy would
      // otherwise not be noticed until they closed and reopened it.
      setInterval(
        () => {
          void registration.update()
        },
        60 * 60 * 1000,
      )
    },
  })
}

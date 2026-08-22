(() => {
  const launchSplash = document.getElementById('launchSplash')
  const isStandalone = document.documentElement.dataset.pwaStandalone === 'true'
  if (launchSplash && isStandalone) {
    const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
    const exitDelay = reducedMotion ? 90 : 780
    let dismissed = false
    const dismissLaunchSplash = () => {
      if (dismissed) return
      dismissed = true
      launchSplash.classList.add('is-exiting')
      window.setTimeout(() => launchSplash.remove(), reducedMotion ? 10 : 260)
    }
    window.setTimeout(dismissLaunchSplash, exitDelay)
  } else {
    launchSplash?.remove()
  }

  if (!('serviceWorker' in navigator)) return
  if (!/^https?:$/.test(window.location.protocol)) return

  window.addEventListener('load', async () => {
    const hadController = Boolean(navigator.serviceWorker.controller)
    let reloaded = false
    const reloadAfterUpdate = () => {
      if (!hadController || reloaded) return
      reloaded = true
      window.location.reload()
    }

    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' })
      const activateWaitingWorker = () => {
        const waitingWorker = registration.waiting
        if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' })
      }
      navigator.serviceWorker.addEventListener('controllerchange', reloadAfterUpdate, { once: true })
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            installing.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })
      activateWaitingWorker()
      await registration.update()
      activateWaitingWorker()
    } catch {
      // The product remains usable online if installation is refused by the browser.
    }
  }, { once: true })
})()

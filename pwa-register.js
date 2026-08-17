(() => {
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

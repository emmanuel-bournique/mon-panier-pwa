(() => {
  if (!('serviceWorker' in navigator)) return
  if (!/^https?:$/.test(window.location.protocol)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .catch(() => {
        // The product remains usable online if installation is refused by the browser.
      })
  }, { once: true })
})()

const CACHE_NAME = 'mon-panier-runtime-v30-recipe-detail-nav-visible'
const SHELL_URLS = [
  './',
  './manifest.webmanifest',
  './mon-panier-icon-192.png',
  './mon-panier-icon-512.png',
  './apple-touch-icon.png',
  './media-v1.js',
  './grocery-cart-core.js?v=20260817-courses-create-v14',
  './personalization-core.js?v=20260808-avoid-v1',
  './card-badge-core.js?v=20260813-pilot-v1',
  './app-v1.js?v=20260820-recipe-detail-ingredient-media-v22',
  './app-v1.css?v=20260820-recipe-detail-bottom-surface-v30',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    return (await cache.match(request)) || cache.match('./')
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)
  return cached || network
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request))
    return
  }

  event.respondWith(staleWhileRevalidate(request))
})

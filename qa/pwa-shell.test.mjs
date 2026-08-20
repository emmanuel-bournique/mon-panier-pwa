import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const candidateRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

test('PWA shell exposes the install and offline contract', async () => {
  const index = await readFile(join(candidateRoot, 'index.html'), 'utf8')
  const styles = await readFile(join(candidateRoot, 'app-v1.css'), 'utf8')
  assert.match(index, /manifest\.webmanifest/, 'index.html must link the PWA manifest')
  assert.match(index, /apple-touch-icon\.png/, 'index.html must expose the iOS install icon')
  assert.match(index, /viewport-fit=cover/, 'iPhone PWA must expose the full safe-area viewport')
  assert.match(index, /<meta name="apple-mobile-web-app-capable" content="yes">/, 'iPhone PWA must explicitly enable Apple web-app mode so the translucent status-bar contract can apply')
  assert.match(index, /<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">/, 'iPhone PWA must request a translucent status bar for edge-to-edge content')
  assert.match(index, /pwa-register\.js/, 'index.html must register the service worker')
  assert.match(index, /class="desktop-preview-statusbar"/, 'desktop GitHub preview must expose a phone status-bar shell')
  assert.match(index, /class="desktop-preview-island"/, 'desktop GitHub preview must expose a Dynamic Island shell')
  assert.match(styles, /github-web-preview-shell-v1:start/, 'desktop preview shell must be versioned in the web stylesheet')
  assert.match(styles, /@media\(min-width:561px\)[\s\S]*?\.desktop-preview-statusbar\{[^}]*display:flex/, 'the fake status bar must be desktop-only')
  assert.match(styles, /@media\(max-width:560px\)\{\.desktop-preview-statusbar\{display:none!important\}\}/, 'the PWA must not draw a fake Dynamic Island on a real iPhone')
  assert.doesNotMatch(index, /n8n-server\.tailb4f72c\.ts\.net|https:\/\/[^\s"']*\/v1\/feedback/i, 'PWA must not expose the external feedback endpoint')

  const manifestPath = join(candidateRoot, 'manifest.webmanifest')
  const serviceWorkerPath = join(candidateRoot, 'sw.js')
  const registrationPath = join(candidateRoot, 'pwa-register.js')
  for (const path of [manifestPath, serviceWorkerPath, registrationPath]) {
    assert.equal(await exists(path), true, `${relative(candidateRoot, path)} must exist`)
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  assert.equal(manifest.name, 'Mon Panier')
  assert.equal(manifest.short_name, 'Mon Panier')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.scope, './')
  assert.equal(manifest.start_url, './')
  assert.deepEqual(
    manifest.icons.map(({ src, sizes, type }) => ({ src, sizes, type })),
    [
      { src: 'mon-panier-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'mon-panier-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  )

  const serviceWorker = await readFile(serviceWorkerPath, 'utf8')
  const criticalShellUrls = [
    './media-v1.js',
    './grocery-cart-core.js?v=20260817-courses-create-v14',
    './personalization-core.js?v=20260808-avoid-v1',
    './card-badge-core.js?v=20260813-pilot-v1',
    './app-v1.js?v=20260818-recipe-detail-ingredient-media-v21',
    './app-v1.css?v=20260820-github-web-v2',
  ]
  for (const url of criticalShellUrls) {
    assert.ok(index.includes(url.replace(/^\.\//, '')), `entry must version critical runtime: ${url}`)
    assert.ok(serviceWorker.includes(url), `critical offline shell missing: ${url}`)
  }
  const registrationRuntimeUrl = 'pwa-register.js?v=20260820-github-web-v2'
  assert.ok(index.includes(registrationRuntimeUrl), 'the waiting-worker bootstrap must receive a unique runtime URL')
  assert.match(serviceWorker, /const CACHE_NAME = ['"]mon-panier-runtime-github-web-v2['"]/, 'cache name must identify the GitHub web lane')
  assert.match(serviceWorker, /addEventListener\(['"]fetch['"]/)
  assert.match(serviceWorker, /cache/i)
  assert.doesNotMatch(serviceWorker, /https?:\/\//i, 'service worker must not add a remote origin')
  const registration = await readFile(registrationPath, 'utf8')
  assert.match(registration, /serviceWorker\s*\.register\(['"]\.\/sw\.js['"]/)
  assert.match(registration, /const activateWaitingWorker = \(\) => \{[\s\S]*?registration\.waiting[\s\S]*?postMessage\(\{ type: 'SKIP_WAITING' \}\)/, 'an existing waiting worker must be asked to activate')
  assert.match(registration, /await registration\.update\(\)\s*activateWaitingWorker\(\)/, 'an update discovered after registration must be asked to activate')
})

test('GitHub web lane has no active native-parity manifest', async () => {
  for (const file of ['PWA_ONLY_RUNTIME_DIVERGENCE.json', 'PWA_PARITY_MANIFEST.json', 'SOURCE_MANIFEST.json']) {
    assert.equal(await exists(join(candidateRoot, file)), false, `${file} must not be part of the active web lane`)
  }
})

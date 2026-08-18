import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const candidateRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const canonicalRoot = resolve(
  process.env.MON_PANIER_CANONICAL_ROOT ??
    '/Users/emmanuel/LocalVaults/Freelance/3_FREELANCE/03_TASKS/panier_ia/ios/MonPanierLocalV1/OpenDesignBundle',
)

async function filesUnder(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolute = join(current, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(root, absolute))
    else if (entry.isFile()) files.push(relative(root, absolute))
  }
  return files.sort()
}

async function sha256(path) {
  return await new Promise((resolveHash, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolveHash(hash.digest('hex')))
  })
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function withoutPwaAdditions(html) {
  return html
    .replace(/\n?\s*<link rel="manifest" href="manifest\.webmanifest">/g, '')
    .replace(/\n?\s*<link rel="apple-touch-icon" href="apple-touch-icon\.png">/g, '')
    .replace(/\n?\s*<script src="pwa-register\.js(?:\?v=[^"]+)?" defer><\/script>/g, '')
    .replace(/\n?\s*<meta name="mon-panier-feedback-endpoint"[^>]*>/g, '')
    .replace(/(app-v1\.css|grocery-cart-core\.js|app-v1\.js)\?v=[^"']+/g, '$1?v=PWA_CACHE_ID')
}

test('PWA shell exposes the install and offline contract', async () => {
  const index = await readFile(join(candidateRoot, 'index.html'), 'utf8')
  assert.match(index, /manifest\.webmanifest/, 'index.html must link the PWA manifest')
  assert.match(index, /apple-touch-icon\.png/, 'index.html must expose the iOS install icon')
  assert.match(index, /pwa-register\.js/, 'index.html must register the service worker')
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
    './app-v1.js?v=20260818-discover-favorite-heart-thumbnail-upper-left-v20',
    './app-v1.css?v=20260818-discover-favorite-heart-thumbnail-upper-left-v20',
  ]
  for (const url of criticalShellUrls) {
    assert.ok(index.includes(url.replace(/^\.\//, '')), `entry must version critical runtime: ${url}`)
    assert.ok(serviceWorker.includes(url), `critical offline shell missing: ${url}`)
  }
  const registrationRuntimeUrl = 'pwa-register.js?v=20260818-discover-favorite-heart-thumbnail-upper-left-v20'
  assert.ok(index.includes(registrationRuntimeUrl), 'the waiting-worker bootstrap must receive a unique runtime URL')
  assert.match(serviceWorker, /const CACHE_NAME = ['"]mon-panier-runtime-v20-discover-favorite-heart-thumbnail-upper-left['"]/, 'cache name must change when the installed-PWA runtime changes')
  assert.match(serviceWorker, /addEventListener\(['"]fetch['"]/)
  assert.match(serviceWorker, /cache/i)
  assert.doesNotMatch(serviceWorker, /https?:\/\//i, 'service worker must not add a remote origin')
  const registration = await readFile(registrationPath, 'utf8')
  assert.match(registration, /serviceWorker\s*\.register\(['"]\.\/sw\.js['"]/)
  assert.match(registration, /const activateWaitingWorker = \(\) => \{[\s\S]*?registration\.waiting[\s\S]*?postMessage\(\{ type: 'SKIP_WAITING' \}\)/, 'an existing waiting worker must be asked to activate')
  assert.match(registration, /await registration\.update\(\)\s*activateWaitingWorker\(\)/, 'an update discovered after registration must be asked to activate')
})

test('runtime files remain byte-identical to the canonical iOS bundle except declared PWA-only overrides', async () => {
  const canonicalFiles = await filesUnder(canonicalRoot)
  assert.ok(canonicalFiles.length > 0, 'canonical bundle must contain runtime files')

  const divergencePath = join(candidateRoot, 'PWA_ONLY_RUNTIME_DIVERGENCE.json')
  assert.equal(await exists(divergencePath), true, 'a PWA-only release must declare every intentional runtime divergence')
  const divergence = JSON.parse(await readFile(divergencePath, 'utf8'))
  assert.equal(divergence.scope, 'pwa_only')
  assert.equal(divergence.runtime_revision, '20260818-discover-favorite-heart-thumbnail-upper-left-v20')
  const declaredPaths = divergence.runtime_paths ?? {}
  assert.deepEqual(Object.keys(declaredPaths).sort(), ['app-v1.css', 'app-v1.js', 'sw.js'])

  for (const relativePath of canonicalFiles) {
    const canonicalPath = join(canonicalRoot, relativePath)
    const candidatePath = join(candidateRoot, relativePath)
    assert.equal(await exists(candidatePath), true, `missing canonical file: ${relativePath}`)
    if (relativePath === 'index.html') {
      const canonicalHtml = await readFile(canonicalPath, 'utf8')
      const candidateHtml = await readFile(candidatePath, 'utf8')
      assert.equal(
        withoutPwaAdditions(candidateHtml),
        withoutPwaAdditions(canonicalHtml),
        'index.html may differ only by the explicit PWA links/registration and disabled external feedback configuration',
      )
      continue
    }

    const candidateHash = await sha256(candidatePath)
    const canonicalHash = await sha256(canonicalPath)
    if (Object.hasOwn(declaredPaths, relativePath)) {
      const declared = declaredPaths[relativePath]
      assert.equal(declared.candidate_sha256, candidateHash, `declared PWA hash drift: ${relativePath}`)
      assert.equal(declared.canonical_sha256, canonicalHash, `declared canonical hash drift: ${relativePath}`)
      assert.notEqual(candidateHash, canonicalHash, `PWA-only override must represent a real divergence: ${relativePath}`)
      continue
    }

    assert.equal(candidateHash, canonicalHash, `canonical runtime drift: ${relativePath}`)
  }
})

test('candidate is the canonical static bundle, not the superseded React prototype', async () => {
  assert.equal(await exists(join(candidateRoot, 'src')), false, 'React source must not be active in the exact mirror')
  assert.equal(await exists(join(candidateRoot, 'vite.config.ts')), false, 'Vite source config must not be active in the exact mirror')
})

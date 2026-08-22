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

const parityHashPaths = {
  index_sha256: 'index.html',
  app_css_sha256: 'app-v1.css',
  app_js_sha256: 'app-v1.js',
  manifest_sha256: 'manifest.webmanifest',
  service_worker_sha256: 'sw.js',
  registration_sha256: 'pwa-register.js',
  pwa_shell_test_sha256: 'qa/pwa-shell.test.mjs',
  shopping_flow_test_sha256: 'qa/shopping-flow-regression.test.cjs',
  recipe_create_ui_contract_test_sha256: 'qa/recipe-create-ui-contract.test.cjs',
  recipe_detail_responsive_photo_test_sha256: 'qa/recipe-detail-responsive-photo.test.cjs',
  recipe_detail_native_safe_area_and_meta_spacing_test_sha256: 'qa/recipe-detail-native-safe-area-and-meta-spacing.test.cjs',
  recipe_detail_top_safe_area_test_sha256: 'qa/recipe-detail-top-safe-area.test.cjs',
  favorites_empty_state_test_sha256: 'qa/favorites-empty-state.test.cjs',
  discover_card_cart_state_test_sha256: 'qa/discover-card-cart-state.test.cjs',
  discover_card_favorite_state_test_sha256: 'qa/discover-card-favorite-state.test.cjs',
  pwa_only_runtime_divergence_sha256: 'PWA_ONLY_RUNTIME_DIVERGENCE.json',
  recipe_detail_ingredient_media_test_sha256: 'qa/recipe-detail-ingredient-media.test.cjs',
}

function versionedUrlsFromIndex(index) {
  return [...index.matchAll(/(?:href|src)="([^"?#]+\?v=[^"]+)"/g)]
    .map((match) => match[1])
    .sort()
}

function cacheNameFromWorker(serviceWorker) {
  const match = serviceWorker.match(/const CACHE_NAME = ['"]([^'"]+)['"]/)
  assert.ok(match, 'le worker doit déclarer un cache explicite')
  return match[1]
}

function assertPwaParityContract({ index, serviceWorker, divergence, parity, hashes }) {
  const candidate = parity.candidate
  const revision = divergence.runtime_revision
  const versionedUrls = candidate.versioned_runtime_urls.slice().sort()

  assert.equal(candidate.cache_name, cacheNameFromWorker(serviceWorker), 'le manifeste de parité doit déclarer le cache réellement ouvert par le worker')
  assert.ok(index.includes(`app-v1.css?v=${revision}`), 'la feuille CSS versionnée doit porter la même révision que la divergence PWA')
  assert.ok(index.includes(`pwa-register.js?v=${revision}`), 'le bootstrap du worker doit porter la même révision que la divergence PWA')
  assert.deepEqual(versionedUrlsFromIndex(index), versionedUrls, 'les URLs versionnées du manifeste doivent être exactement celles chargées par index.html')

  for (const url of versionedUrls) {
    assert.ok(index.includes(url), `index.html doit charger l’URL versionnée déclarée : ${url}`)
    if (!url.startsWith('pwa-register.js?')) {
      assert.ok(serviceWorker.includes(`./${url}`), `le shell offline doit précacher l’URL versionnée déclarée : ${url}`)
    }
  }

  for (const [field, hash] of Object.entries(hashes)) {
    assert.equal(candidate[field], hash, `le hash enregistré doit correspondre au fichier courant : ${field}`)
  }
  for (const [runtimePath, declared] of Object.entries(divergence.runtime_paths)) {
    const field = runtimePath === 'app-v1.css'
      ? 'app_css_sha256'
      : runtimePath === 'app-v1.js'
        ? 'app_js_sha256'
        : runtimePath === 'sw.js'
          ? 'service_worker_sha256'
          : null
    assert.ok(field, `la divergence PWA ne doit pas déclarer un runtime non couvert : ${runtimePath}`)
    assert.equal(declared.candidate_sha256, hashes[field], `la divergence PWA doit déclarer le hash candidat courant : ${runtimePath}`)
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
    './app-v1.js?v=20260822-discover-single-green-bubble-v44',
    './app-v1.css?v=20260822-discover-single-green-bubble-v44',
  ]
  for (const url of criticalShellUrls) {
    assert.ok(index.includes(url.replace(/^\.\//, '')), `entry must version critical runtime: ${url}`)
    assert.ok(serviceWorker.includes(url), `critical offline shell missing: ${url}`)
  }
  const registrationRuntimeUrl = 'pwa-register.js?v=20260822-discover-single-green-bubble-v44'
  assert.ok(index.includes(registrationRuntimeUrl), 'the waiting-worker bootstrap must receive a unique runtime URL')
  assert.match(serviceWorker, /const CACHE_NAME = ['"]mon-panier-runtime-v44-discover-single-green-bubble['"]/, 'cache name must change when the installed-PWA runtime changes')
  assert.match(serviceWorker, /addEventListener\(['"]fetch['"]/)
  assert.match(serviceWorker, /cache/i)
  assert.doesNotMatch(serviceWorker, /https?:\/\//i, 'service worker must not add a remote origin')
  const registration = await readFile(registrationPath, 'utf8')
  assert.match(registration, /serviceWorker\s*\.register\(['"]\.\/sw\.js['"]/)
  assert.match(registration, /const activateWaitingWorker = \(\) => \{[\s\S]*?registration\.waiting[\s\S]*?postMessage\(\{ type: 'SKIP_WAITING' \}\)/, 'an existing waiting worker must be asked to activate')
  assert.match(registration, /await registration\.update\(\)\s*activateWaitingWorker\(\)/, 'an update discovered after registration must be asked to activate')
})

test('PWA parity manifest binds cache, versioned URLs and recorded hashes to the release files', async () => {
  const index = await readFile(join(candidateRoot, 'index.html'), 'utf8')
  const serviceWorker = await readFile(join(candidateRoot, 'sw.js'), 'utf8')
  const divergence = JSON.parse(await readFile(join(candidateRoot, 'PWA_ONLY_RUNTIME_DIVERGENCE.json'), 'utf8'))
  const parity = JSON.parse(await readFile(join(candidateRoot, 'PWA_PARITY_MANIFEST.json'), 'utf8'))
  const hashes = Object.fromEntries(await Promise.all(
    Object.entries(parityHashPaths).map(async ([field, relativePath]) => [
      field,
      await sha256(join(candidateRoot, relativePath)),
    ]),
  ))

  assertPwaParityContract({ index, serviceWorker, divergence, parity, hashes })

  const cacheMismatch = structuredClone(parity)
  cacheMismatch.candidate.cache_name = 'mon-panier-runtime-stale'
  assert.throws(
    () => assertPwaParityContract({ index, serviceWorker, divergence, parity: cacheMismatch, hashes }),
    /cache réellement ouvert par le worker/,
    'la mutation du cache du manifeste doit faire échouer le contrat',
  )

  const urlMismatch = structuredClone(parity)
  urlMismatch.candidate.versioned_runtime_urls = urlMismatch.candidate.versioned_runtime_urls.filter(
    (url) => !url.startsWith('app-v1.css?'),
  )
  assert.throws(
    () => assertPwaParityContract({ index, serviceWorker, divergence, parity: urlMismatch, hashes }),
    /URLs versionnées du manifeste/,
    'la suppression d’une URL runtime du manifeste doit faire échouer le contrat',
  )
})

test('runtime files remain byte-identical to the canonical iOS bundle except declared PWA-only overrides', async () => {
  const canonicalFiles = await filesUnder(canonicalRoot)
  assert.ok(canonicalFiles.length > 0, 'canonical bundle must contain runtime files')

  const divergencePath = join(candidateRoot, 'PWA_ONLY_RUNTIME_DIVERGENCE.json')
  assert.equal(await exists(divergencePath), true, 'a PWA-only release must declare every intentional runtime divergence')
  const divergence = JSON.parse(await readFile(divergencePath, 'utf8'))
  assert.equal(divergence.scope, 'pwa_only')
  assert.equal(divergence.runtime_revision, '20260822-discover-single-green-bubble-v44')
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

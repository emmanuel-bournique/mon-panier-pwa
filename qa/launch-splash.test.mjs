import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const candidateRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

async function read(relativePath) {
  return await readFile(join(candidateRoot, relativePath), 'utf8')
}

test('standalone launch splash has a bounded, accessible visual contract', async () => {
  const index = await read('index.html')
  const css = await read('app-v1.css')
  const registration = await read('pwa-register.js')
  const splashMarkup = index.slice(index.indexOf('<div class="launch-splash"'), index.indexOf('<div class="desktop-stage"'))

  assert.match(index, /dataset\.pwaStandalone/, 'the entry must detect standalone PWA launches before first paint')
  assert.match(index, /id="launchSplash"/, 'the entry must expose one launch splash')
  assert.match(index, /class="launch-splash-basket"/, 'the splash must show the detached basket mark')
  assert.doesNotMatch(splashMarkup, /mon-panier-logo\.svg/, 'the splash must not reuse the boxed app logo')
  assert.match(index, /class="launch-splash-title"[\s\S]*?Mon Panier/, 'the splash must show the product name')
  assert.match(index, /aria-hidden="true"/, 'the decorative splash must not duplicate the app announcement')

  assert.match(css, /\.launch-splash\s*\{[\s\S]*?pointer-events:none/, 'the splash must never block a user action')
  assert.match(css, /launch-splash-(?:content|basket|title)/, 'the splash must define the clean visual layers')
  assert.match(css, /background:#fbfaf6/, 'the clean variant must use the off-white background')
  assert.doesNotMatch(css, /launch-splash-mark|launch-splash-veil|launch-splash-glint/, 'the clean variant must not draw a box or decorative streak')
  assert.match(css, /animation:\s*launch-splash/, 'the splash must have a visible entrance animation')
  assert.match(css, /\.launch-splash\.is-exiting/, 'the splash must have an explicit exit state')
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*?launch-splash/, 'reduced motion must shorten the splash animation')

  assert.match(registration, /launchSplash/, 'the bootstrap must own splash dismissal')
  assert.match(registration, /is-exiting/, 'dismissal must transition through an exit state')
  assert.match(registration, /setTimeout\(/, 'dismissal must have a bounded fallback timer')
})

test('launch splash is limited to standalone mode and does not alter product surfaces', async () => {
  const index = await read('index.html')
  const css = await read('app-v1.css')

  assert.match(index, /matchMedia\(['"]\(display-mode:\s*standalone\)['"]\)/, 'standalone detection must use the display-mode media query')
  assert.match(index, /navigator\.standalone/, 'standalone detection must cover iOS Safari')
  assert.match(index, /<main class="phone"/, 'the existing app shell must remain present')
  assert.match(index, /id="authGate"/, 'the authentication gate must remain unchanged')
  assert.doesNotMatch(css, /\.launch-splash[^}]*position:\s*fixed[^}]*\.bottom-nav/, 'the splash must not redefine bottom navigation')
})

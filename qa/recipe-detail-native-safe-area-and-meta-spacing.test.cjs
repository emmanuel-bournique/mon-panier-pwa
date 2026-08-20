'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const candidateRoot = path.join(__dirname, '..');
const cssPath = process.env.MON_PANIER_CSS_PATH
  ? path.resolve(process.env.MON_PANIER_CSS_PATH)
  : path.join(candidateRoot, 'app-v1.css');
const css = fs.readFileSync(cssPath, 'utf8');

function mobileGeometryRules() {
  const startMarker = '/* recipe-detail-mobile-geometry-v2:start */';
  const endMarker = '/* recipe-detail-mobile-geometry-v2:end */';
  const start = css.indexOf(startMarker);
  const end = css.indexOf(endMarker, start);
  assert.notEqual(start, -1, 'le correctif de détail iPhone doit être présent');
  assert.notEqual(end, -1, 'le correctif de détail iPhone doit être borné');
  return css.slice(start, end + endMarker.length);
}

test('la PWA installée utilise la même réserve que le navigateur mobile', () => {
  const rules = mobileGeometryRules();

  assert.doesNotMatch(
    rules,
    /display-mode:\s*standalone/,
    'la PWA ne doit pas avoir de deuxième chemin qui annule la réserve système',
  );
  assert.doesNotMatch(css, /--detail-header-top:\s*2px/, 'le retour et le favori ne doivent jamais remonter au sommet de l’écran');
  assert.match(rules, /--detail-system-reserve:\s*max\(60px,\s*env\(safe-area-inset-top,\s*0px\)\)/);
  assert.match(rules, /--detail-controls-top:\s*calc\(var\(--detail-system-reserve\)\s*\+\s*12px\)/);
  assert.match(rules, /--detail-copy-top:\s*84px/);
});

test('vignettes, actions et indication de défilement restent au-dessus du ruban', () => {
  const rules = mobileGeometryRules();

  assert.match(rules, /\.detail-hero-meta\s*\{[\s\S]*?bottom:\s*calc\(var\(--detail-nav-height\)\s*\+\s*var\(--detail-actions-clearance\)\)/);
  assert.match(rules, /\.detail-hero-actions\s*\{\s*bottom:\s*calc\(var\(--detail-nav-height\)\s*\+\s*36px\)!important/);
  assert.match(rules, /\.detail-scroll-cue\s*\{\s*bottom:\s*calc\(var\(--detail-nav-height\)\s*\+\s*10px\)!important/);

  for (const phone of [
    { name: 'iPhone SE', height: 667, reserve: 54, copyOffset: 78, clearance: 180 },
    { name: 'iPhone standard', height: 844, reserve: 60, copyOffset: 84, clearance: 172 },
    { name: 'iPhone grand format', height: 932, reserve: 60, copyOffset: 84, clearance: 172 },
  ]) {
    const navHeight = 78;
    const buttonBottom = phone.reserve + 12 + 48;
    const copyTop = phone.reserve + phone.copyOffset;
    const heroHeight = phone.height - phone.reserve;
    const actionsBottom = phone.reserve + heroHeight - (navHeight + 36);
    const actionsTop = actionsBottom - 102;
    const metaBottom = phone.reserve + heroHeight - (navHeight + phone.clearance);
    const metaTop = metaBottom - 47;
    const cueBottom = phone.reserve + heroHeight - (navHeight + 10);

    assert.ok(copyTop > buttonBottom, `${phone.name}: le titre doit être sous les contrôles`);
    assert.ok(actionsTop > metaBottom, `${phone.name}: les actions ne doivent pas recouvrir les vignettes`);
    assert.ok(cueBottom > actionsBottom, `${phone.name}: le repère de défilement doit rester sous les actions`);
    assert.ok(cueBottom < phone.height - navHeight, `${phone.name}: le repère de défilement doit rester au-dessus du ruban`);
    assert.ok(metaTop > copyTop, `${phone.name}: les vignettes doivent rester sous le texte de recette`);
  }
});

test('la photo et le ruban utilisent le viewport dynamique sans extension basse artificielle', () => {
  const rules = mobileGeometryRules();

  assert.match(rules, /\.desktop-stage:has\(\.detail\)\s*\{[\s\S]*?height:\s*100dvh/);
  assert.match(rules, /\.phone:has\(\.detail\)\s*\{[\s\S]*?height:\s*100dvh/);
  assert.match(rules, /\.phone:has\(\.detail\)\s+\.detail-hero\s*\{[\s\S]*?height:\s*calc\(100dvh\s*-\s*var\(--detail-system-reserve\)\)!important/);
  assert.doesNotMatch(rules, /100dvh\s*\+\s*env\(safe-area-inset-bottom/, 'la coque ne doit pas créer une bande après la navigation');
  assert.doesNotMatch(rules, /height:\s*60px!important/, 'le ruban doit garder une hauteur exploitable');
});

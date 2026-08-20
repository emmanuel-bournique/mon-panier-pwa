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
  assert.notEqual(start, -1, 'le contrat de géométrie mobile de la fiche doit être présent');
  assert.notEqual(end, -1, 'le contrat de géométrie mobile de la fiche doit être borné');
  return css.slice(start, end + endMarker.length);
}

test('la fiche réserve une bande blanche haute avant la photo', () => {
  const rules = mobileGeometryRules();

  assert.match(rules, /@media\s*\(max-width:\s*560px\)/);
  assert.match(
    rules,
    /--detail-system-reserve:\s*max\(60px,\s*env\(safe-area-inset-top,\s*0px\)\)/,
    'la réserve haute doit couvrir au minimum la barre système',
  );
  assert.match(
    rules,
    /\.scroll:has\(\.detail\)\s*\{[\s\S]*?padding:\s*var\(--detail-system-reserve\)\s+0\s+calc\(var\(--detail-nav-height\)\s*\+\s*24px\)!important/,
    'la photo doit commencer après la réserve blanche plutôt que derrière l’heure et le Wi‑Fi',
  );
  assert.match(
    rules,
    /\.phone:has\(\.detail\)\s+\.detail-hero\s*\{[\s\S]*?margin-top:\s*0!important[\s\S]*?height:\s*calc\(100dvh\s*-\s*var\(--detail-system-reserve\)\)!important/,
    'le héros doit rester sous la zone système et tenir exactement dans le viewport disponible',
  );
  assert.doesNotMatch(css, /--detail-header-top:\s*2px/, 'aucune PWA installée ne doit remonter les contrôles dans la zone système');
  assert.doesNotMatch(css, /detail-installed-pwa-safe-area-v2/, 'le faux override standalone doit être retiré');
});

test('retour, favori, titre et description occupent des bandes séparées', () => {
  const rules = mobileGeometryRules();

  assert.match(rules, /--detail-controls-top:\s*calc\(var\(--detail-system-reserve\)\s*\+\s*12px\)/);
  assert.match(rules, /\.phone:has\(\.detail\)\s+\.app-header\s*\{\s*top:\s*var\(--detail-controls-top\)!important/);
  assert.match(rules, /--detail-copy-top:\s*84px/);
  assert.match(rules, /\.detail-hero-copy\s*\{\s*top:\s*var\(--detail-copy-top\)!important/);

  const reserve = 60;
  const controlTop = reserve + 12;
  const controlBottom = controlTop + 48;
  const copyTop = reserve + 84;
  assert.ok(
    copyTop > controlBottom,
    'le titre doit démarrer sous les deux boutons, avec une marge positive',
  );
  assert.equal(copyTop - controlBottom, 24, 'la marge titre sous les boutons doit rester stable');
});

test('la navigation basse reste entière et couvre aussi la safe area inférieure', () => {
  const rules = mobileGeometryRules();

  assert.match(
    rules,
    /--detail-nav-height:\s*max\(78px,\s*calc\(72px\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)\)/,
    'la hauteur de navigation doit conserver ses commandes tout en couvrant la zone Home',
  );
  assert.match(rules, /\.phone:has\(\.detail\)::before\s*\{\s*content:\s*none;\s*display:\s*none/);
  assert.match(
    rules,
    /\.phone:has\(\.detail\)\s+\.bottom-nav\s*\{[\s\S]*?bottom:\s*0!important[\s\S]*?transform:\s*none!important[\s\S]*?pointer-events:\s*auto!important[\s\S]*?height:\s*var\(--detail-nav-height\)!important/,
    'le ruban doit rester au bord inférieur, utilisable et sans bande blanche séparée',
  );
  assert.match(
    rules,
    /\.phone:has\(\.detail\)\s+\.bottom-nav\s+\.nav-item\s*\{[\s\S]*?min-height:\s*52px!important[\s\S]*?transform:\s*none!important/,
    'les icônes ne doivent pas être décalées hors du ruban',
  );
  assert.doesNotMatch(rules, /height:\s*60px!important/, 'un ruban de 60 px recouperait les icônes sur iPhone');
});

test('le format iPhone court garde la même hiérarchie sans collision', () => {
  const rules = mobileGeometryRules();

  assert.match(
    rules,
    /@media\s*\(max-width:\s*560px\)\s*and\s*\(max-height:\s*700px\)[\s\S]*?--detail-system-reserve:\s*max\(54px,\s*env\(safe-area-inset-top,\s*0px\)\)[\s\S]*?--detail-copy-top:\s*78px[\s\S]*?--detail-actions-clearance:\s*180px/,
  );

  const reserve = 54;
  const controlBottom = reserve + 12 + 48;
  const copyTop = reserve + 78;
  assert.ok(copyTop > controlBottom, 'même un iPhone court doit placer le titre sous les contrôles');
});

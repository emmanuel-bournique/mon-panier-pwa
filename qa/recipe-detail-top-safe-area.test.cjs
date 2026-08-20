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

test('la fiche réutilise le ruban mobile normal de Découvrir, au bord inférieur', () => {
  const rules = mobileGeometryRules();

  assert.match(
    rules,
    /--detail-nav-height:\s*60px/,
    'la fiche doit réserver la même hauteur de ruban que Découvrir',
  );
  assert.match(
    css,
    /@media\s*\(max-width:\s*560px\)\s*\{[\s\S]*?\.bottom-nav\s*\{[\s\S]*?bottom:\s*0!important[\s\S]*?height:\s*60px!important[\s\S]*?padding:\s*3px\s+4px!important/,
    'la référence mobile partagée doit rester le ruban compact de 60 px',
  );
  assert.match(
    css,
    /@media\s*\(max-width:\s*560px\)\s*\{[\s\S]*?\.bottom-nav\s*\{[\s\S]*?bottom:\s*0!important[\s\S]*?height:\s*60px!important[\s\S]*?padding:\s*3px\s+4px!important[\s\S]*?\.nav-item\s*\{[\s\S]*?transform:\s*translateY\(-6px\)!important/,
    'Découvrir doit conserver le décalage compact des items, partagé par la fiche',
  );
  assert.match(rules, /\.phone:has\(\.detail\)::before\s*\{\s*content:\s*none;\s*display:\s*none/);
  assert.match(
    rules,
    /\.phone:has\(\.detail\)\s+\.bottom-nav\s*\{[\s\S]*?bottom:\s*0!important[\s\S]*?transform:\s*none!important[\s\S]*?pointer-events:\s*auto!important/,
    'le ruban de la fiche doit rester au bord inférieur et utilisable',
  );
  assert.doesNotMatch(
    rules,
    /\.phone:has\(\.detail\)\s+\.bottom-nav\s*\{[^}]*?(?:height|padding)\s*:/,
    'la fiche ne doit pas agrandir ni repadder le ruban partagé',
  );
  assert.doesNotMatch(
    rules,
    /\.phone:has\(\.detail\)\s+\.bottom-nav\s+\.nav-item\s*\{/,
    'la fiche ne doit pas déplacer les icônes par rapport à Découvrir',
  );
});

test('la surface de la fiche couvre la réserve basse sans déplacer le ruban', () => {
  const rules = mobileGeometryRules();
  const surfaceRule = rules.match(/body:has\(\.detail\)::after\s*\{([\s\S]*?)\}/)?.[1] ?? '';

  assert.notEqual(surfaceRule, '', 'la fiche doit déclarer une surface basse dédiée');
  for (const declaration of [
    /content:\s*["']{2};/,
    /position:\s*fixed;/,
    /left:\s*0;/,
    /right:\s*0;/,
    /bottom:\s*0;/,
    /height:\s*env\(safe-area-inset-bottom,\s*0px\);/,
    /z-index:\s*19;/,
    /pointer-events:\s*none;/,
  ]) {
    assert.match(surfaceRule, declaration);
  }
  assert.match(
    surfaceRule,
    /background:\s*linear-gradient\(/,
    'la réserve basse doit utiliser la même surface vitrée que le ruban',
  );
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

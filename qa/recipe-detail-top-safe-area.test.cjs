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

test('la fiche laisse la photo remplir le haut du viewport sans double réserve', () => {
  const rules = mobileGeometryRules();

  assert.match(rules, /@media\s*\(max-width:\s*560px\)/);
  assert.match(
    rules,
    /--detail-system-reserve:\s*max\(60px,\s*env\(safe-area-inset-top,\s*0px\)\)/,
    'la réserve haute doit couvrir au minimum la barre système',
  );
  assert.match(
    rules,
    /\.scroll:has\(\.detail\)\s*\{[\s\S]*?padding:\s*0\s+0\s+calc\(var\(--detail-nav-height\)\s*\+\s*24px\)!important/,
    'la fiche ne doit pas ajouter une deuxième bande blanche avant la photo',
  );
  assert.match(
    rules,
    /\.phone:has\(\.detail\)\s+\.detail-hero\s*\{[\s\S]*?margin-top:\s*0!important[\s\S]*?height:\s*100dvh!important/,
    'le héros doit remplir le viewport et laisser iOS gérer sa zone système',
  );
  assert.doesNotMatch(css, /--detail-header-top:\s*2px/, 'aucune PWA installée ne doit remonter les contrôles dans la zone système');
  assert.doesNotMatch(css, /detail-installed-pwa-safe-area-v2/, 'le faux override standalone doit être retiré');
});

test('retour, favori, titre et description occupent des bandes séparées', () => {
  const rules = mobileGeometryRules();

  assert.match(rules, /--detail-controls-top:\s*calc\(var\(--detail-system-reserve\)\s*\+\s*12px\)/);
  assert.match(rules, /\.phone:has\(\.detail\)\s+\.app-header\s*\{\s*top:\s*var\(--detail-controls-top\)!important/);
  assert.match(rules, /--detail-copy-top:\s*84px/);
  assert.match(rules, /\.detail-hero-copy\s*\{\s*top:\s*calc\(var\(--detail-copy-top\)\s*\+\s*var\(--detail-system-reserve\)\)!important/);

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
    /\.phone:has\(\.detail\)\s+\.bottom-nav\s*\{[\s\S]*?bottom:\s*0!important[\s\S]*?transform:\s*none!important[\s\S]*?pointer-events:\s*auto!important[\s\S]*?display:\s*grid!important[\s\S]*?visibility:\s*visible!important[\s\S]*?opacity:\s*1!important[\s\S]*?z-index:\s*20!important/,
    'même avec un ancien style de fiche, le ruban doit rester visible au-dessus du héros',
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

test('la fiche ne dessine pas de surface basse concurrente au ruban partagé', () => {
  const rules = mobileGeometryRules();
  assert.doesNotMatch(
    rules,
    /body:has\(\.detail\)::after\s*\{/,
    'la fiche ne doit pas peindre une bande fixe sous le ruban ou hors du viewport',
  );
  assert.match(
    rules,
    /\.phone:has\(\.detail\)\s+\.bottom-nav\s*\{[\s\S]*?z-index:\s*20!important/,
    'le ruban partagé doit rester dans sa couche normale',
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

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const candidateRoot = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(candidateRoot, 'app-v1.css'), 'utf8');

function nativeDetailRules() {
  const startMarker = '/* native-edge-to-edge-detail-v1:start */';
  const endMarker = '/* native-edge-to-edge-detail-v1:end */';
  const start = css.indexOf(startMarker);
  const end = css.indexOf(endMarker, start);
  assert.notEqual(start, -1, 'le correctif de détail iPhone doit être présent');
  assert.notEqual(end, -1, 'le correctif de détail iPhone doit être borné');
  return css.slice(start, end + endMarker.length);
}

function alignedDetailHeaderRules() {
  const startMarker = '/* detail-safe-area-header-alignment-v1:start */';
  const endMarker = '/* detail-safe-area-header-alignment-v1:end */';
  const start = css.indexOf(startMarker);
  const end = css.indexOf(endMarker, start);
  assert.notEqual(start, -1, 'le contrat d’alignement haut de la fiche doit être présent');
  assert.notEqual(end, -1, 'le contrat d’alignement haut de la fiche doit être borné');
  return css.slice(start, end + endMarker.length);
}

function installedPwaSafeAreaRules() {
  const startMarker = '/* detail-installed-pwa-safe-area-v2:start */';
  const endMarker = '/* detail-installed-pwa-safe-area-v2:end */';
  const start = css.indexOf(startMarker);
  const end = css.indexOf(endMarker, start);
  assert.notEqual(start, -1, 'le correctif du viewport PWA installé doit être présent');
  assert.notEqual(end, -1, 'le correctif du viewport PWA installé doit être borné');
  return css.slice(start, end + endMarker.length);
}

function lastClearanceValue(rules) {
  const matches = [...rules.matchAll(/--detail-actions-clearance:\s*(\d+)px/g)];
  assert.ok(matches.length, 'la réserve entre vignettes et actions doit rester explicite');
  return Number(matches.at(-1)[1]);
}

test('la photo de détail passe sous la zone haute dans une WKWebView iPhone', () => {
  const rules = nativeDetailRules();

  assert.doesNotMatch(
    rules,
    /@media\s*\(display-mode:\s*(?:standalone|fullscreen)\)/,
    'une WKWebView native ne signale pas ce display-mode : le correctif ne doit pas en dépendre',
  );
  assert.match(
    rules,
    /@media\s*\(max-width:\s*560px\)\s*\{[\s\S]*?\.phone:has\(\.detail\)\s+\.detail-hero\s*\{[\s\S]*?margin-top:\s*calc\(-1\s*\*\s*env\(safe-area-inset-top\)\)[\s\S]*?min-height:\s*calc\(100svh\s*\+\s*env\(safe-area-inset-top\)\)[\s\S]*?height:\s*calc\(100svh\s*\+\s*env\(safe-area-inset-top\)\)/,
    'sur iPhone, le héros doit continuer derrière la zone système au lieu de commencer sous une bande blanche',
  );
});

test('le fallback de fiche utilise l’inset exposé par la surface et aligne ses contrôles', () => {
  const rules = alignedDetailHeaderRules();

  assert.match(rules, /@media\s*\(max-width:\s*560px\)/);
  assert.match(
    rules,
    /--detail-header-top:max\(60px,calc\(env\(safe-area-inset-top\) \+ 2px\)\)/,
    'le retour et le favori doivent démarrer à la hauteur de la barre Découvrir, sans couvrir la Dynamic Island',
  );
  assert.match(
    rules,
    /--detail-copy-top:calc\(var\(--detail-header-top\) \+ 54px\)/,
    'le titre doit suivre les boutons sans conserver un deuxième grand décalage vertical',
  );
  assert.match(rules, /\.phone:has\(\.detail\),\.phone:has\(\.detail\) \.scroll\{background:#0d1713\}/);
  assert.match(rules, /\.phone:has\(\.detail\) \.app-header\{top:var\(--detail-header-top\)!important\}/);
  assert.match(rules, /\.detail-hero-copy\{top:var\(--detail-copy-top\)\}/);
  assert.doesNotMatch(rules, /safe-area-inset-top\) \+ 24px/, 'aucune marge artificielle de 24 px ne doit repousser le haut de la fiche');
});

test('la PWA installée ne recompte pas la zone système iPhone dans le haut de fiche', () => {
  const rules = installedPwaSafeAreaRules();

  assert.match(
    rules,
    /@media\s*\(max-width:\s*560px\)\s*and\s*\(display-mode:\s*standalone\)/,
    'le réglage ne doit cibler que la PWA installée, pas le bundle natif',
  );
  assert.match(rules, /--detail-header-top:\s*2px/, 'Retour/Favori doivent commencer juste après la réserve iPhone déjà appliquée');
  assert.match(
    rules,
    /--detail-copy-top:\s*calc\(var\(--detail-header-top\)\s*\+\s*54px\)/,
    'titre et description doivent suivre immédiatement les contrôles sans second décalage',
  );
  assert.doesNotMatch(rules, /safe-area-inset-top/, 'la PWA installée ne doit pas additionner une seconde fois les 59 px système');
});

test('les vignettes gardent le même espace que les deux boutons du détail', () => {
  const rules = nativeDetailRules();
  const buttonGap = 14;
  const actionStackHeight = 102; // 2 boutons de 44 px + leur écart de 14 px.
  const actionBaseline = 42; // Décalage fixe partagé par l’ancrage des actions et des vignettes.
  const clearance = lastClearanceValue(rules);

  assert.match(css, /\.detail-hero-actions\s*\{\s*gap:\s*14px\s*\}/, 'les deux boutons doivent rester espacés de 14 px');
  assert.equal(
    clearance,
    actionBaseline + actionStackHeight + buttonGap,
    'l’écart vignettes → Modifier doit être identique à Modifier → Ajouter',
  );
});

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
  assert.match(rules, /@media\s*\(max-width:\s*560px\)/);
  assert.match(
    rules,
    /\.phone:has\(\.detail\)\s+\.detail-hero\s*\{[\s\S]*?margin-top:\s*calc\(-1\s*\*\s*env\(safe-area-inset-top,\s*0px\)\)/,
    'le héros doit remonter sous l’inset haut lorsqu’il est disponible',
  );
  assert.match(rules, /min-height:\s*calc\(100svh\s*\+\s*env\(safe-area-inset-top,\s*0px\)\)/);
  assert.match(rules, /min-height:\s*calc\(100dvh\s*\+\s*env\(safe-area-inset-top,\s*0px\)\)/);
  assert.match(rules, /height:\s*calc\(100svh\s*\+\s*env\(safe-area-inset-top,\s*0px\)\)/);
  assert.match(rules, /height:\s*calc\(100dvh\s*\+\s*env\(safe-area-inset-top,\s*0px\)\)/);
});

test('le fallback de fiche utilise l’inset exposé par la surface et aligne ses contrôles', () => {
  const rules = alignedDetailHeaderRules();

  assert.match(rules, /@media\s*\(max-width:\s*560px\)/);
  assert.match(
    rules,
    /--detail-header-top:\s*max\(12px,\s*calc\(env\(safe-area-inset-top,\s*0px\)\s*\+\s*2px\)\)/,
    'le retour et le favori doivent suivre l’inset réellement exposé, sans décalage fixe de 60 px',
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

test('la PWA installée ne remplace jamais la zone sûre par une valeur fixe de 2 px', () => {
  assert.doesNotMatch(
    css,
    /--detail-header-top:\s*2px/,
    'un iPhone bord à bord ne doit jamais placer les contrôles sous l’heure avec une valeur fixe',
  );
  assert.doesNotMatch(
    css,
    /@media\s*\(max-width:\s*560px\)\s*and\s*\(display-mode:\s*standalone\)\s*\{[\s\S]*?--detail-header-top/,
    'la PWA installée doit partager le même contrat de safe area que les autres surfaces iPhone',
  );
});

test('la navigation installée ne recompte pas la safe area basse déjà réservée par iOS', () => {
  const startMarker = '/* Final mobile geometry — keep controls clear of iOS without adding visual dead space. */';
  const endMarker = '/* local-grocery-cart-v1:start */';
  const start = css.indexOf(startMarker);
  const end = css.indexOf(endMarker, start);

  assert.notEqual(start, -1, 'la géométrie mobile compacte doit rester identifiable');
  assert.notEqual(end, -1, 'la géométrie mobile compacte doit rester bornée avant les Courses');
  const rules = css.slice(start, end);

  assert.match(
    rules,
    /\.bottom-nav\{bottom:0!important;height:60px!important;padding:3px 4px!important\}/,
    'la navigation doit conserver sa hauteur visuelle de 60 px dans une PWA déjà cadrée par iOS',
  );
  assert.doesNotMatch(
    rules,
    /height:calc\(60px \+ env\(safe-area-inset-bottom/,
    'la navigation ne doit pas additionner une seconde fois la réserve système inférieure',
  );
  assert.doesNotMatch(css, /ios-pwa-viewport-and-nav-v3/, 'le bloc v23 qui étirait la coque et la navigation ne doit pas revenir');
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

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

function topSafeAreaRules() {
  const startMarker = '/* recipe-detail-top-safe-area-v1:start */';
  const endMarker = '/* recipe-detail-top-safe-area-v1:end */';
  const start = css.indexOf(startMarker);
  const end = css.indexOf(endMarker, start);
  assert.notEqual(start, -1, 'le contrat de safe-area haute de la fiche doit être présent');
  assert.notEqual(end, -1, 'le contrat de safe-area haute de la fiche doit être borné');
  return css.slice(start, end + endMarker.length);
}

test('la fiche ouverte place la réserve blanche en haut et rejoint le bord bas', () => {
  const rules = topSafeAreaRules();

  assert.match(rules, /@media\s*\(max-width:\s*560px\)/);
  assert.match(
    rules,
    /\.desktop-stage:has\(\.detail\)\s*\{[\s\S]*?height:\s*calc\(100dvh\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)/,
    'la surface mobile doit inclure l’inset inférieur au lieu de laisser un blanc sous la coque',
  );
  assert.match(
    rules,
    /\.phone:has\(\.detail\)\s*\{[\s\S]*?height:\s*calc\(100dvh\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)/,
    'la fiche doit occuper aussi la zone basse du téléphone',
  );
  assert.match(
    rules,
    /\.phone:has\(\.detail\)::before\s*\{[\s\S]*?content:\s*""[\s\S]*?flex:\s*0\s+0\s+env\(safe-area-inset-bottom,\s*0px\)[\s\S]*?background:\s*(?:#fff|var\(--surface\))/,
    'la réserve blanche doit être rendue comme une première bande haute',
  );

  const navMatch = rules.match(/\.phone:has\(\.detail\) \.bottom-nav\s*\{([\s\S]*?)\}/);
  assert.ok(navMatch, 'la navigation de la fiche doit avoir une règle mobile dédiée');
  assert.match(navMatch[1], /height:\s*60px\s*!important/);
  assert.match(navMatch[1], /padding:\s*3px\s+4px\s*!important/);
  assert.doesNotMatch(
    navMatch[1],
    /safe-area-inset-bottom/,
    'la navigation ne doit plus créer la bande blanche basse',
  );
});

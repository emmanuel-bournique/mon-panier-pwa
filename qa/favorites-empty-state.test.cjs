'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-v1.js'), 'utf8');

function favoritesRenderer() {
  const start = source.indexOf('  renderFavorites = function fullAppFavorites()');
  const end = source.indexOf('  const DEFAULT_DETAIL_FRAMING', start);
  assert.notEqual(start, -1, 'le rendu Favoris doit être présent');
  assert.notEqual(end, -1, 'la fin du rendu Favoris doit être présente');
  return source.slice(start, end);
}

test('l’état vide des Favoris reste direct et mène vers Découvrir', () => {
  const render = favoritesRenderer();

  assert.match(render, /: mine \? '' : `<button class="primary" onclick="setTab\('discover'\)">Accéder à Découvrir<\/button>`/);
  assert.match(render, /: mine \? 'Aucune recette personnelle' : 'Aucun favori'/);
  assert.match(render, /: mine \? 'Utilisez le bouton \+ pour en créer une\.' : ''/);
  assert.doesNotMatch(render, /Aucune recette personnelle\. Utilisez le bouton \+ pour en créer une\./);
  assert.match(render, /\$\{emptyCopy \? `<p>\$\{emptyCopy\}<\/p>` : ''\}/);
  assert.doesNotMatch(render, /Le cœur garde une recette ici\./);
});

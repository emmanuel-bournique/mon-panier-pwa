'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-v1.js'), 'utf8');

function sourceBlock(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Ancre absente : ${startMarker}`);
  assert.notEqual(end, -1, `Fin absente : ${endMarker}`);
  return source.slice(start, end);
}

test('le dernier favori ajouté apparaît en premier dans la bibliothèque', () => {
  const helperSource = sourceBlock('  function favoriteItemsMostRecentFirst', '  renderFavorites = function fullAppFavorites()').trim();
  const favoriteItemsMostRecentFirst = vm.runInNewContext(`(${helperSource})`);
  const recipes = [
    { id: 'repas-ancien', title: 'Repas ancien' },
    { id: 'repas-recent', title: 'Repas récent' },
  ];

  const ordered = favoriteItemsMostRecentFirst(recipes, ['repas-recent', 'repas-ancien']);

  assert.equal(JSON.stringify(ordered.map(recipe => recipe.id)), JSON.stringify(['repas-recent', 'repas-ancien']));
});

test('le rendu Favoris utilise l’ordre récent avant le tri visuel secondaire', () => {
  const render = sourceBlock('  renderFavorites = function fullAppFavorites()', '  const DEFAULT_DETAIL_FRAMING');

  assert.match(render, /favoriteItemsMostRecentFirst\(list, \[\.\.\.state\.favorites\]\.reverse\(\)\)/);
});

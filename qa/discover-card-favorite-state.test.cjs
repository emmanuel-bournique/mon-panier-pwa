'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app-v1.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app-v1.css'), 'utf8');

function sourceBlock(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.notEqual(from, -1, `Ancre absente : ${start}`);
  assert.notEqual(to, -1, `Fin absente : ${end}`);
  return source.slice(from, to);
}

function favoriteStatusRules() {
  const startMarker = '/* recipe-action-favorite-state-v1:start */';
  const endMarker = '/* recipe-action-favorite-state-v1:end */';
  const start = css.indexOf(startMarker);
  const end = css.indexOf(endMarker, start);
  assert.notEqual(start, -1, 'Le style du mini-cœur Favori doit être présent.');
  assert.notEqual(end, -1, 'Le style du mini-cœur Favori doit être borné.');
  return css.slice(start, end);
}

test('les cartes Découvrir signalent un favori par un mini-cœur discret sans agrandir la photo', () => {
  const labels = sourceBlock(app, '  function recipeActionCardLabel', '  function recipeActionEditIcon');
  const card = sourceBlock(app, '  card = function mealListCard', '  function ensureRecipeActionPanel');
  const favoriteSync = sourceBlock(app, '  function syncFavoriteControls', '  window.toggleFavorite');
  const cartSync = sourceBlock(app, '  function syncRecipeActionCartCards', '  function syncPersonalRecipeActionCartControls');
  const rules = favoriteStatusRules();

  assert.match(labels, /favorite \? ' — dans les favoris' : ''/);
  assert.match(labels, /inCart \? ' — dans Mon Panier' : ''/);
  assert.match(card, /const favorite = state\.favorites\.has\(source\.id\);/);
  assert.match(card, /data-favorite="\$\{favorite\}"/);
  assert.match(card, /class="recipe-action-favorite-status" aria-hidden="true"/);
  assert.match(card, /aria-label="\$\{recipeActionCardLabel\(actionLabel, favorite, inCart\)\}"/);

  assert.match(favoriteSync, /button\.dataset\.favorite = String\(favorite\);/);
  assert.match(favoriteSync, /button\.dataset\.inCart === 'true'/);
  assert.match(favoriteSync, /recipeActionCardLabel\(actionLabel, favorite, inCart\)/);
  assert.match(cartSync, /button\.dataset\.favorite === 'true'/);
  assert.match(cartSync, /recipeActionCardLabel\(actionLabel, favorite, added\)/);

  assert.match(rules, /\.recipe-action-favorite-status\{display:none;position:absolute;left:-3px;bottom:-3px;width:17px;height:17px;/);
  assert.match(rules, /\.recipe-action-favorite-status svg\{width:10px!important;height:10px!important;/);
  assert.match(rules, /\.recipe-action-btn\[data-favorite="true"\] \.recipe-action-favorite-status\{display:grid/);
  assert.doesNotMatch(rules, /width:(?:[2-9]\d|\d{3,})px/);
});

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

test('les trois points signalent immédiatement une recette déjà dans Mon Panier', () => {
  const card = sourceBlock(app, '  card = function mealListCard', '  function ensureRecipeActionPanel');
  const menu = sourceBlock(app, '  function recipeActionCartChoiceHtml', '  function renderRecipeActionPanel');
  const controls = sourceBlock(app, '  function syncDiscoverCartControls(id)', '  function applyMealListMutationForTarget');
  const marker = '/* recipe-action-cart-state-v1:start */';
  const start = css.indexOf(marker);
  const end = css.indexOf('/* recipe-action-cart-state-v1:end */', start);
  assert.notEqual(start, -1, 'Le style d’état Panier du bouton ••• doit être présent.');
  assert.notEqual(end, -1, 'Le style d’état Panier du bouton ••• doit être borné.');
  const rules = css.slice(start, end);

  assert.match(card, /const inCart = source\.personal \? personalRecipeActionInCart\(source\.id\) : discoverCartContains\(source\.id\);/);
  assert.match(card, /class="round-btn recipe-action-btn"[^>]*data-in-cart="\$\{inCart\}"/);
  assert.match(card, /const actionLabel = `Actions de la recette \$\{escapeHtml\(source\.title\)\}`;/);
  assert.match(card, /data-action-label="\$\{actionLabel\}"/);
  assert.match(card, /class="recipe-action-cart-status"/);
  assert.match(menu, /data-in-cart="\$\{added\}"/);
  assert.match(menu, /added \? 'Dans Mon Panier' : 'Ajouter au Panier'/);
  assert.match(menu, /Appuyer pour retirer/);
  assert.match(controls, /const added = discoverCartContains\(id\);/);
  assert.match(controls, /syncRecipeActionCartCards\(id, added\);/);
  assert.match(rules, /\.recipe-action-btn\[data-in-cart="true"\] \.recipe-action-cart-status\{display:grid/);
  assert.match(rules, /\.recipe-action-cart-choice\[data-in-cart="true"\]/);
});

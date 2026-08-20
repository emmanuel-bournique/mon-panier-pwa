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
  assert.match(card, /class="recipe-action-favorite-status" data-favorite="\$\{favorite\}" aria-hidden="true"/);
  assert.match(card, /aria-label="\$\{recipeActionCardLabel\(actionLabel, favorite, inCart\)\}"/);
  const favoriteMarkup = '<span class="recipe-action-favorite-status" data-favorite="${favorite}" aria-hidden="true">';
  const coverMarkup = '<div class="cover">';
  const actionMarkup = '<button type="button" class="round-btn recipe-action-btn"';
  assert.ok(card.indexOf(favoriteMarkup) > card.indexOf(coverMarkup), 'le cœur doit être rendu dans la vignette');
  assert.ok(card.indexOf(favoriteMarkup) < card.indexOf(actionMarkup), 'le cœur de vignette doit être frère du bouton •••, pas son enfant');
  assert.doesNotMatch(card, /\$\{recipeActionIcon\(\)\}<span class="recipe-action-favorite-status"/);

  assert.match(favoriteSync, /cardElement\.querySelectorAll\('\.recipe-action-favorite-status'\)/);
  assert.match(favoriteSync, /status\.dataset\.favorite = String\(favorite\);/);
  assert.match(favoriteSync, /button\.dataset\.favorite = String\(favorite\);/);
  assert.match(favoriteSync, /button\.dataset\.inCart === 'true'/);
  assert.match(favoriteSync, /recipeActionCardLabel\(actionLabel, favorite, inCart\)/);
  assert.match(cartSync, /button\.dataset\.favorite === 'true'/);
  assert.match(cartSync, /recipeActionCardLabel\(actionLabel, favorite, added\)/);

  assert.match(rules, /\.recipe-action-favorite-status\{display:none;position:absolute;z-index:4;left:6px;top:6px;width:17px;height:17px;/);
  assert.match(rules, /\.recipe-action-favorite-status svg\{width:10px!important;height:10px!important;/);
  assert.match(rules, /fill:currentColor!important;stroke:currentColor!important/);
  assert.doesNotMatch(rules, /left:-3px;top:-3px/);
  assert.match(rules, /\.recipe-action-favorite-status\[data-favorite="true"\]\{display:grid/);
  assert.doesNotMatch(rules, /width:(?:[2-9]\d|\d{3,})px/);
});

test('Découvrir utilise un bouton trois-points compact et le ruban vitré anime une bulle active commune', () => {
  const nav = sourceBlock(app, '  renderNav = function mealListNav()', '  window.prepareCartGroceries');
  const navRules = sourceBlock(css, '/* bottom-nav-whatsapp-glass-v4:start */', '/* bottom-nav-whatsapp-glass-v4:end */');
  const discoverRules = sourceBlock(css, '/* discover-card-action-compact-v2:start */', '/* discover-card-action-compact-v2:end */');

  assert.match(nav, /const activeIndex = Math\.max\(0, items\.findIndex\(\(\[id\]\) => id === active\)\);/);
  assert.match(nav, /const previousActiveIndex = Number\(nav\.dataset\.navActiveIndex\);/);
  assert.match(nav, /nav\.style\.setProperty\('--nav-active-index', String\(activeIndex\)\);/);
  assert.match(nav, /requestAnimationFrame\(\(\) => \{/);
  assert.match(nav, /<span class="nav-active-bubble" aria-hidden="true"><\/span>/);
  assert.match(nav, /items\.map\(\(\[id, label, glyph\]\)/);
  assert.match(nav, /\['discover', 'Découvrir', 'discover'\], \['favorites', 'Favoris', 'heart'\], \['cart', 'Mon panier', 'cart'\], \['groceries', 'Listes', 'list'\], \['profile', 'Profil', 'user'\]/);

  assert.match(navRules, /\.bottom-nav\s*\{[\s\S]*--nav-active-index:0/);
  assert.match(navRules, /border-radius:999px/);
  assert.match(navRules, /backdrop-filter:blur\(/);
  assert.match(navRules, /\.nav-active-bubble\s*\{[\s\S]*position:absolute/);
  assert.match(navRules, /left:calc\(4px \+ var\(--nav-active-index\) \* \(\(100% - 8px\) \/ 5\)\)/);
  assert.match(navRules, /transform:none/);
  assert.match(navRules, /transition:left\s+\.46s\s+cubic-bezier\(\.16,1\.65,\.3,1\)/);
  assert.match(navRules, /\.bottom-nav \.nav-item\.active\s*\{[\s\S]*background:transparent!important/);
  assert.match(navRules, /\.bottom-nav \.nav-item\.active:after\s*\{display:none!important/);
  assert.doesNotMatch(navRules, /transform:translateX\(var\(--nav-active-offset\)\)/);

  assert.match(discoverRules, /\[data-screen="discover-shelves"\] \.recipe-action-btn/);
  assert.match(discoverRules, /\[data-screen="discover-results"\] \.recipe-action-btn/);
  assert.match(discoverRules, /width:36px;\s*height:36px;\s*min-width:36px;\s*min-height:36px/);
  assert.match(discoverRules, /\.recipe-action-btn svg\{[\s\S]*?width:16px;\s*height:16px/);
});

test('la coque de prévisualisation respecte le viewport iPhone 14 Pro et ne dessine pas de fausse île sur mobile', () => {
  const previewRules = sourceBlock(css, '/* iphone-14-pro-preview-v1:start */', '/* iphone-14-pro-preview-v1:end */');

  assert.match(app, /ensureIPhone14ProPreviewChrome[\s\S]*class="statusbar"[\s\S]*class="dynamic-island"/);
  assert.match(app, /syncIPhone14ProPreviewScale[\s\S]*--phone-preview-scale/);
  assert.match(previewRules, /\.phone\{[\s\S]*width:393px;\s*height:852px/);
  assert.match(previewRules, /aspect-ratio:393 \/ 852/);
  assert.match(previewRules, /transform:scale\(var\(--phone-preview-scale,1\)\)/);
  assert.match(previewRules, /\.statusbar\{[\s\S]*height:59px/);
  assert.match(previewRules, /\.dynamic-island\{[\s\S]*width:126px;\s*height:37px/);
  assert.match(previewRules, /@media\(max-width:560px\)\{[\s\S]*\.statusbar\{display:none!important/);
});

test('le ruban reste au bord bas et la bulle active produit une impulsion élastique visible', () => {
  const nav = sourceBlock(app, '  renderNav = function mealListNav()', '  window.prepareCartGroceries');
  const navRules = sourceBlock(css, '/* bottom-nav-whatsapp-glass-v4:start */', '/* bottom-nav-whatsapp-glass-v4:end */');

  assert.match(nav, /const shouldAnimateBubble = hasPreviousActiveIndex && previousActiveIndex !== activeIndex;/);
  assert.match(nav, /activeBubble\.classList\.add\('is-moving'\)/);
  assert.match(nav, /nav\._navBubbleAnimationTimer/);
  assert.match(navRules, /bottom:0!important/);
  assert.match(navRules, /height:calc\(60px \+ env\(safe-area-inset-bottom,0px\)\)!important/);
  assert.match(navRules, /padding:4px 4px calc\(4px \+ env\(safe-area-inset-bottom,0px\)\)!important/);
  assert.match(navRules, /border-radius:24px/);
  assert.match(navRules, /bottom:calc\(4px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(navRules, /transition:left \.46s cubic-bezier\(\.16,1\.65,\.3,1\)/);
  assert.match(navRules, /@keyframes nav-active-bubble-spring/);
  assert.match(navRules, /\.nav-active-bubble\.is-moving\{[\s\S]*animation:nav-active-bubble-spring \.46s/);
});

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app-v1.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const mediaSource = fs.readFileSync(path.join(root, 'media-v1.js'), 'utf8');
const recipes = JSON.parse(indexSource.match(/const recipes=(.*?);\n/s)[1]);
const media = JSON.parse(mediaSource.match(/window\.__MON_PANIER_MEDIA_V1__=(.*);\s*$/s)[1]);
const groceryCore = require(path.join(root, 'grocery-cart-core.js'));

function normalizeSearch(value) {
  return String(value ?? '')
    .toLocaleLowerCase('fr')
    .replaceAll('œ', 'oe')
    .replaceAll('æ', 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`-]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function recipeById(id) {
  return recipes.find((recipe) => recipe.id === id);
}

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `La fonction active ${name}() est absente`);
  const open = source.indexOf('{', start + marker.length);
  assert.notEqual(open, -1, `Le corps de ${name}() est absent`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`Le corps de ${name}() n’est pas fermé`);
}

const detailIngredientBaseName = vm.runInNewContext(`(${extractFunction(appSource, 'detailIngredientBaseName')})`);

function evaluateFunction(name, context = {}) {
  const functionSource = extractFunction(appSource, name);
  return vm.runInNewContext(`(${functionSource})`, {
    MEDIA: media,
    GROCERY_CORE: groceryCore,
    normalizeSearch,
    detailIngredientBaseName,
    ...context,
  });
}

test('la fiche regroupe les produits canoniques sans modifier les ingrédients source', () => {
  const recipe = recipeById('r-v3-434-gateau-moka');
  const sourceSugarRows = recipe.ingredients.filter((item) => normalizeSearch(item.name) === 'sucre semoule');
  assert.equal(sourceSugarRows.length, 2, 'la fixture doit conserver les deux usages éditoriaux du sucre');

  assert.match(appSource, /const displayIngredients = detailIngredientsForDisplay\(ingredients\);/);
  assert.match(appSource, /const ingredientRows = displayIngredients\.map/);
  const detailIngredientsForDisplay = evaluateFunction('detailIngredientsForDisplay');
  const displayed = detailIngredientsForDisplay(recipe.ingredients);
  const displayedSugarRows = displayed.filter((item) => normalizeSearch(item.name) === 'sucre semoule');

  assert.equal(displayedSugarRows.length, 1, 'une fiche ne doit pas afficher deux fois le même ingrédient et la même unité');
  assert.equal(displayedSugarRows[0].qty, 162.5, 'les quantités regroupées doivent rester exactes');
  const displayedKeys = displayed.map((item) => `${normalizeSearch(item.name)}|${normalizeSearch(item.unit)}`);
  assert.equal(new Set(displayedKeys).size, displayed.length, 'la fiche ne doit pas répéter un produit canonique et son unité');
  assert.equal(displayed.length, 10, 'les variantes canoniques de la fixture doivent être regroupées');
  assert.equal(sourceSugarRows[0].qty + sourceSugarRows[1].qty, 162.5, 'les deux usages source restent disponibles pour les étapes');
  assert.equal(recipe.ingredients.length, 13, 'le regroupement ne doit pas muter la recette catalogue');
});

test('la fiche affiche un seul beurre doux pour les états de préparation du même produit', () => {
  const recipe = recipeById('r-v3-434-gateau-moka');
  const detailIngredientsForDisplay = evaluateFunction('detailIngredientsForDisplay');
  const displayed = detailIngredientsForDisplay(recipe.ingredients);
  const butterRows = displayed.filter((item) => normalizeSearch(item.name).startsWith('beurre doux'));

  assert.equal(butterRows.length, 1, 'beurre doux et beurre doux ramolli doivent devenir une seule ligne');
  assert.equal(butterRows[0].name, 'beurre doux');
  assert.equal(butterRows[0].qty, 135);
  assert.equal(recipe.ingredients.length, 13, 'la source catalogue reste inchangée');

  const preparationVariants = detailIngredientsForDisplay([
    { name: 'beurre doux', qty: 10, unit: 'g' },
    { name: 'beurre doux fondu', qty: 20, unit: 'g' },
    { name: 'beurre doux pour le moule', qty: 5, unit: 'g' },
  ]);
  assert.equal(preparationVariants.length, 1);
  assert.equal(preparationVariants[0].name, 'beurre doux');
  assert.equal(preparationVariants[0].qty, 35);
});

test('les variantes lexicales de la fiche disposent toutes d’une photo locale', () => {
  const mediaRecord = evaluateFunction('mediaRecord');
  const missing = new Set();
  const missingPaths = [];

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients || []) {
      const record = mediaRecord('ingredient', ingredient.name);
      const pathValue = record?.variants?.list?.path || record?.variants?.detail?.path || '';
      if (!record) missing.add(ingredient.name);
      else if (!pathValue || !fs.existsSync(path.join(root, pathValue))) missingPaths.push(`${ingredient.name} → ${pathValue || 'aucun chemin'}`);
    }
  }

  assert.deepEqual([...missing], [], `photos absentes pour : ${[...missing].join(', ')}`);
  assert.deepEqual(missingPaths, [], `chemins média invalides : ${missingPaths.join(', ')}`);

  for (const name of ['œufs entiers', 'sucre semoule', 'beurre doux ramolli', 'œuf entier battu']) {
    assert.ok(mediaRecord('ingredient', name), `la photo de ${name} doit être résolue`);
  }
});

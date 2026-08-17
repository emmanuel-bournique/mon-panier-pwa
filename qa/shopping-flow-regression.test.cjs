'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const groceryCore = require('../grocery-cart-core.js');

function itemByKey(items, key) {
  return items.find((item) => item.key === key);
}

test('la PWA garde chaque ingrédient nommé dans les Courses, sans règle de placard automatique', () => {
  const plan = groceryCore.buildLocalGroceryPlan([
    {
      recipeId: 'recette-complete',
      servings: 2,
      baseServings: 2,
      ingredients: [
        { id: 'pates', name: 'Pâtes', qty: 200, unit: 'g', aisle: 'Épicerie', coursesStatus: 'inclure' },
        { id: 'sel', name: 'Sel fin', qty: 2, unit: 'pincee', aisle: 'Épicerie', coursesStatus: 'inclure' },
        { id: 'huile', name: 'Huile d’olive', qty: 1, unit: 'c_a_s', aisle: 'Épicerie', coursesStatus: 'inclure' },
        { id: 'eau', name: 'Eau', qty: 500, unit: 'ml', aisle: 'Boissons', coursesStatus: 'hors_courses' },
      ],
    },
  ]);

  assert.deepEqual(plan.pantryReminders, []);
  assert.ok(itemByKey(plan.items, 'product|pates'));
  assert.ok(itemByKey(plan.items, 'product|sel-fin'));
  assert.ok(itemByKey(plan.items, 'product|huile-d-olive'));
  assert.ok(itemByKey(plan.items, 'product|eau'));
});

function recipeSelection(recipeId, ingredientName = 'Pâtes') {
  return {
    recipeId,
    selectionId: `${recipeId}--selection-1`,
    servings: 2,
    baseServings: 2,
    ingredients: [{ id: `${recipeId}-ingredient`, name: ingredientName, qty: 200, unit: 'g', aisle: 'Épicerie', coursesStatus: 'inclure' }],
  };
}

test('une liste préparée ne réactive jamais une recette en lisant son historique', () => {
  let collection = groceryCore.createGroceryListCollection({
    activeListId: 'list-default',
    lists: [{
      id: 'list-default',
      name: 'Courses du Panier',
      kind: 'basket',
      recipeSelections: [recipeSelection('recette-precedente')],
      items: [],
      checked: [],
      history: [{ type: 'generated', recipeIds: ['recette-historique'] }],
    }],
  });
  collection = groceryCore.rebuildMealListCourses(collection, 'list-default');
  collection = groceryCore.finalizeMealListPreparation(collection, 'list-default');
  collection = groceryCore.ensurePermanentBasketList(collection);

  const list = collection.lists.find((entry) => entry.id === 'list-default');
  assert.deepEqual(list.recipeSelections, []);
  assert.deepEqual(list.sourceRecipeSelections, []);
  assert.deepEqual(list.sourceRecipeIds, []);
  assert.equal(list.preparedRecipeCount, 1);
  assert.deepEqual(list.preparedRecipeSelections.map((selection) => selection.recipeId), ['recette-precedente']);
});

test('une nouvelle recette après des Courses terminées repart sans coche héritée', () => {
  let collection = groceryCore.createGroceryListCollection({
    activeListId: 'list-default',
    lists: [{
      id: 'list-default',
      name: 'Courses du Panier',
      kind: 'basket',
      recipeSelections: [recipeSelection('recette-a')],
      items: [],
      checked: [],
      history: [{ type: 'archive', id: 'historique-conserve' }],
    }],
  });
  collection = groceryCore.rebuildMealListCourses(collection, 'list-default');
  collection = groceryCore.finalizeMealListPreparation(collection, 'list-default');
  const completed = collection.lists.find((entry) => entry.id === 'list-default');
  collection = groceryCore.updateGroceryListById(collection, 'list-default', {
    checked: completed.items.map((item) => item.key),
  });
  collection = groceryCore.addMealListRecipe(collection, 'list-default', recipeSelection('recette-a'));

  const list = collection.lists.find((entry) => entry.id === 'list-default');
  assert.deepEqual(list.recipeSelections.map((selection) => selection.recipeId), ['recette-a']);
  assert.deepEqual(list.checked, []);
  assert.equal(list.preparedRecipeCount, 0);
  assert.deepEqual(list.preparedRecipeSelections, []);
  assert.deepEqual(list.history, [{ type: 'archive', id: 'historique-conserve' }]);
});

test('une nouvelle occurrence après plusieurs préparations reçoit une identité jamais réutilisée', () => {
  let collection = groceryCore.createGroceryListCollection({
    activeListId: 'list-default',
    lists: [{
      id: 'list-default',
      name: 'Courses du Panier',
      kind: 'basket',
      recipeSelections: [recipeSelection('recette-a')],
      items: [],
      checked: [],
    }],
  });
  collection = groceryCore.rebuildMealListCourses(collection, 'list-default');
  collection = groceryCore.finalizeMealListPreparation(collection, 'list-default');
  const firstCompleted = collection.lists.find((entry) => entry.id === 'list-default');
  assert.equal(firstCompleted.preparedRecipeSelections[0].selectionId, 'recette-a--selection-1');

  collection = groceryCore.addMealListRecipe(collection, 'list-default', recipeSelection('recette-a'));
  let list = collection.lists.find((entry) => entry.id === 'list-default');
  assert.deepEqual(list.recipeSelections.map((selection) => selection.selectionId), ['recette-a--selection-2']);

  collection = groceryCore.finalizeMealListPreparation(collection, 'list-default');
  const secondCompleted = collection.lists.find((entry) => entry.id === 'list-default');
  collection = groceryCore.updateGroceryListById(collection, 'list-default', {
    checked: secondCompleted.items.map((item) => item.key),
  });
  collection = groceryCore.addMealListRecipe(collection, 'list-default', recipeSelection('recette-a'));

  list = collection.lists.find((entry) => entry.id === 'list-default');
  assert.deepEqual(list.recipeSelections.map((selection) => selection.selectionId), ['recette-a--selection-3']);
  assert.deepEqual(list.checked, []);
});

function sourceBlock(source, from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.notEqual(start, -1, `Début introuvable : ${from}`);
  assert.notEqual(end, -1, `Fin introuvable : ${to}`);
  return source.slice(start, end);
}

test('réajouter depuis Découvrir ignore les recettes seulement préparées', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app-v1.js'), 'utf8');

  const contains = sourceBlock(app, '  function discoverCartContains(id)', '  function syncDiscoverCartControls(id)');
  assert.doesNotMatch(contains, /mealListPreparedRecipeSelections/);

  const toggle = sourceBlock(app, '  window.toggleDiscoverCart = function toggleDiscoverCart', '  window.addCart = function mealListAddRecipe');
  assert.doesNotMatch(toggle, /mealListPreparedRecipeSelections/);
  assert.doesNotMatch(toggle, /mealListDirectMutationCollection/);
  assert.match(toggle, /GROCERY_CORE\.addMealListRecipe\(saved, target\.id/);

  const personalContains = sourceBlock(app, '  function personalRecipeActionInCart', '  function syncPersonalRecipeActionCartControls');
  assert.doesNotMatch(personalContains, /mealListPreparedRecipeSelections/);

  const personalToggle = sourceBlock(app, '  window.toggleRecipeActionCart = function toggleRecipeActionCart', '  window.openRecipeActionEditor = function');
  assert.doesNotMatch(personalToggle, /mealListSelectionForDirectMutation/);
  assert.doesNotMatch(personalToggle, /mealListDirectMutationCollection/);
});

test('réajouter depuis Découvrir recharge la liste active avant de persister les Courses', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app-v1.js'), 'utf8');

  const refresh = sourceBlock(app, '  function applyMealListMutationForTarget', '  window.toggleDiscoverCart = function toggleDiscoverCart');
  assert.match(refresh, /collection\.activeListId === targetId/);
  assert.match(refresh, /loadActiveGroceryList\(\{ \.\.\.collection, activeListId: targetId \}\)/);
  assert.match(refresh, /applyMealListCollection\(collection\)/);

  const toggle = sourceBlock(app, '  window.toggleDiscoverCart = function toggleDiscoverCart', '  window.addCart = function mealListAddRecipe');
  assert.match(toggle, /applyMealListMutationForTarget\(updated, target\.id\)/);
  const personalToggle = sourceBlock(app, '  window.toggleRecipeActionCart = function toggleRecipeActionCart', '  window.openRecipeActionEditor = function');
  assert.match(personalToggle, /applyMealListMutationForTarget\(updated, target\.id\)/);
});

test('reprendre une archive recrée seulement le panier courant et conserve son historique', () => {
  const coffee = groceryCore.createManualLocalGroceryItem({ key: 'manual-cafe', name: 'Café' });
  const archive = { type: 'archive', id: 'archive-a-conserver' };
  let collection = groceryCore.createGroceryListCollection({
    activeListId: 'list-default',
    lists: [{
      id: 'list-default',
      name: 'Courses du Panier',
      kind: 'basket',
      recipeSelections: [recipeSelection('recette-precedente')],
      items: [coffee],
      checked: ['manual-cafe'],
      history: [archive],
    }],
  });
  collection = groceryCore.rebuildMealListCourses(collection, 'list-default');
  collection = groceryCore.finalizeMealListPreparation(collection, 'list-default');
  const completed = collection.lists.find((entry) => entry.id === 'list-default');
  collection = groceryCore.updateGroceryListById(collection, 'list-default', {
    checked: completed.items.map((item) => item.key),
  });
  collection = groceryCore.restoreMealListRecipeSelections(
    collection,
    'list-default',
    [recipeSelection('recette-reprise', 'Riz')],
  );

  const list = collection.lists.find((entry) => entry.id === 'list-default');
  assert.deepEqual(list.recipeSelections.map((selection) => selection.recipeId), ['recette-reprise']);
  assert.deepEqual(list.checked, []);
  assert.deepEqual(list.preparedRecipeSelections, []);
  assert.equal(list.preparedRecipeCount, 0);
  assert.ok(itemByKey(list.items, 'product|riz'));
  assert.ok(list.items.some((item) => item.key === 'manual-cafe'));
  assert.equal(list.items.some((item) => item.key === 'product|pates'), false);
  assert.deepEqual(list.history, [archive]);
});

test('la reprise d’historique recrée le panier durable et chaque préparation est archivée', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app-v1.js'), 'utf8');

  const archive = sourceBlock(app, '  function archiveRecipeSelections(selections)', '  window.generateGroceries = function mealListOpenCourses');
  assert.doesNotMatch(archive, /state\.archived\[0\]\?\.signature/);
  assert.match(archive, /state\.archived\.unshift/);

  const resume = sourceBlock(app, '  window.askResume = function resumeArchivedCart', '  window.generateGroceries = function mealListOpenCourses');
  assert.match(resume, /GROCERY_CORE\.restoreMealListRecipeSelections/);
  assert.match(resume, /'list-default'/);
  assert.match(resume, /state\.tab = 'cart'/);
  assert.match(resume, /persistAppState\(\)/);
  assert.doesNotMatch(resume, /state\.cart/);
});

test('la PWA restaure les ingrédients de placard des listes existantes et retire leur encart', () => {
  const legacy = groceryCore.createGroceryListCollection({
    activeListId: 'list-default',
    lists: [{
      id: 'list-default',
      name: 'Courses du Panier',
      kind: 'basket',
      items: [{ key: 'product|pates', name: 'Pâtes', q: 200, unit: 'g', aisle: 'Épicerie', source: 'recipe' }],
      checked: ['product|pates'],
      pantryReminders: ['sel'],
      preparedRecipeCount: 1,
      preparedRecipeSelections: [{
        ...recipeSelection('recette-legacy'),
        ingredients: [
          { id: 'pates', name: 'Pâtes', qty: 200, unit: 'g', aisle: 'Épicerie', coursesStatus: 'inclure' },
          { id: 'sel', name: 'Sel fin', qty: 2, unit: 'pincee', aisle: 'Épicerie', coursesStatus: 'inclure' },
        ],
      }],
    }],
  });
  const list = legacy.lists[0];
  assert.ok(itemByKey(list.items, 'product|sel-fin'));
  assert.deepEqual(list.pantryReminders, []);
  assert.deepEqual(list.checked, ['product|pates']);

  const pantry = groceryCore.separatePantryStaples([
    { key: 'product|sel-fin', name: 'Sel fin', source: 'recipe' },
  ], ['sel']);
  assert.equal(pantry.items.length, 1);
  assert.deepEqual(pantry.pantryReminders, []);

  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app-v1.js'), 'utf8');
  const screen = sourceBlock(app, '  function renderMealListScreen(origin = \'groceries\')', '  renderGroceries = function renderMealLists()');
  assert.doesNotMatch(screen, /pantry-reminder/);
  assert.doesNotMatch(screen, /À vérifier chez vous/);
});

test('une migration legacy sans snapshot conserve chaque rappel comme produit à vérifier', () => {
  const legacy = groceryCore.createGroceryListCollection({
    activeListId: 'list-default',
    lists: [{
      id: 'list-default',
      name: 'Courses du Panier',
      kind: 'basket',
      items: [],
      checked: [],
      pantryReminders: ['Sel fin', 'Huile de cuisson'],
    }],
  });
  const initial = legacy.lists[0];
  assert.deepEqual(initial.pantryReminders, []);
  assert.deepEqual(initial.items.map((item) => item.name).sort((left, right) => left.localeCompare(right, 'fr')), ['Huile de cuisson', 'Sel fin']);
  assert.ok(initial.items.every((item) => item.source === 'legacy_pantry'));
  assert.ok(initial.items.every((item) => groceryCore.formatLocalQuantity(item) === 'À vérifier'));

  const rebuilt = groceryCore.rebuildMealListCourses(legacy, 'list-default');
  const persisted = rebuilt.lists.find((list) => list.id === 'list-default');
  assert.deepEqual(persisted.items.map((item) => item.name).sort((left, right) => left.localeCompare(right, 'fr')), ['Huile de cuisson', 'Sel fin']);
  assert.ok(persisted.items.every((item) => item.source === 'legacy_pantry'));
});

test('l’export des Courses n’ajoute jamais de rappel de placard hérité', () => {
  const text = groceryCore.exportLocalGroceryList([
    { key: 'product|sel-fin', name: 'Sel fin', q: 2, unit: 'pincee', aisle: 'Épicerie', source: 'recipe' },
  ], ['sel']);

  assert.doesNotMatch(text, /À vérifier chez vous/);
  assert.match(text, /Sel fin/);
});

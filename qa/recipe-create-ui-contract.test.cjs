'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app-v1.css'), 'utf8');

function section(source, from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.notEqual(start, -1, `Début absent : ${from}`);
  assert.notEqual(end, -1, `Fin absente : ${to}`);
  return source.slice(start, end);
}

test('le formulaire de création affiche un seul titre utile et le retour des listes', () => {
  const createPanel = section(index, 'id="createRecipePanel"', 'id="submitPhotoPanel"');

  assert.match(createPanel, /class="grocery-header-back form-page-back"/);
  assert.match(createPanel, /aria-label="Retour à Découvrir"/);
  assert.match(createPanel, /<svg[^>]*aria-hidden="true"[^>]*><path d="M19 12H5M12 19l-7-7 7-7"\/><\/svg><span>Découvrir<\/span>/);
  assert.match(createPanel, /class="form-page-title form-page-title-sr-only" id="createRecipeTitle">Créer une recette<\/span>/);
  assert.match(createPanel, /<h2 id="createRecipeStepTitle">Créer une recette<\/h2>/);
  assert.doesNotMatch(createPanel, /Les bases de la recette|Donnez un nom clair et ajoutez les ingrédients un par un\./);
  assert.match(createPanel, /placeholder="Ex\. Lasagnes de maman"/);
  assert.match(createPanel, /placeholder="Ex\. La recette de famille, avec sauce tomate, bœuf et béchamel\."/);
  assert.doesNotMatch(createPanel, /soupe de lentilles|Une soupe douce/);

  const ingredients = section(index, 'function renderCreateIngredients', 'function renderCreateSteps');
  const steps = section(index, 'function renderCreateSteps', 'function createEquipmentLabel');
  const titleUpdate = section(index, 'function setCreateRecipeStep', 'function validateCreateRecipeBasics');
  const backAction = section(index, 'function createRecipeBack()', 'function createRecipeNext()');
  assert.match(ingredients, /placeholder="Ex\. feuilles de lasagne"/);
  assert.match(ingredients, /placeholder="Ex\. 12"/);
  assert.doesNotMatch(ingredients, /placeholder="Ex\. lentilles"|placeholder="Ex\. 250"/);
  assert.match(steps, /placeholder="Ex\. Faites mijoter la sauce tomate avec la viande…"/);
  assert.doesNotMatch(steps, /Faites cuire les lentilles/);
  assert.match(titleUpdate, /'Créer une recette'/);
  assert.match(titleUpdate, /createRecipeStepTitle/);
  assert.doesNotMatch(titleUpdate, /'Ajouter une recette'/);
  assert.match(backAction, /panel\.classList\.remove\('open'\);setTab\('discover'\)/);

  assert.match(css, /#createRecipePanel \.form-page-back\{[^}]*width:auto[^}]*padding:0 8px 0 0[^}]*color:var\(--green\)[^}]*font-weight:850/s);
  assert.match(css, /\.form-page-title-sr-only\{[^}]*position:absolute[^}]*width:1px[^}]*height:1px/s);
});

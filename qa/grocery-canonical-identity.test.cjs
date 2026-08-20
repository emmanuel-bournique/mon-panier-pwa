'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const groceryCore = require('../grocery-cart-core.js');

test('les états de préparation du beurre doux partagent une identité achetable', () => {
  const plain = groceryCore.canonicalPurchaseIdentity('beurre doux');
  const softened = groceryCore.canonicalPurchaseIdentity('beurre doux ramolli');

  assert.deepEqual(softened, plain);
});

test('Courses regroupe le beurre doux sans fusionner le beurre demi-sel', () => {
  const plan = groceryCore.buildLocalGroceryPlan([{
    recipeId: 'recipe-test',
    baseServings: 2,
    servings: 2,
    ingredients: [
      { name: 'beurre doux', qty: 10, unit: 'g', aisle: 'Frais' },
      { name: 'beurre doux ramolli', qty: 125, unit: 'g', aisle: 'Frais' },
      { name: 'beurre demi-sel', qty: 20, unit: 'g', aisle: 'Frais' },
    ],
  }]);

  assert.equal(plan.items.filter(item => item.key === 'product|beurre-doux').length, 1);
  assert.equal(plan.items.find(item => item.key === 'product|beurre-doux')?.name, 'beurre doux');
  assert.equal(plan.items.find(item => item.key === 'product|beurre-doux')?.quantityParts[0]?.q, 135);
  assert.equal(plan.items.filter(item => item.key === 'product|beurre-demi-sel').length, 1);
});

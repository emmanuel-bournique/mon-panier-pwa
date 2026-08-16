(function cardBadgeCoreFactory(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MonPanierCardBadgeCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function createCardBadgeCore() {
  'use strict';

  const PILOT_RULES = Object.freeze([
    ['r-v3-136-crepes-sucrees', [
      ['Petit budget', recipe => recipe?.budgetKey === 'tres_economique'],
      ['Grand classique', recipe => recipe?.tags?.includes('classique_francais')],
    ]],
    ['r-v3-118-burger-maison', [
      ['Prix accessible', recipe => recipe?.budgetKey === 'economique'],
      ['Sans four', recipe => recipe?.tags?.includes('sans_four')],
    ]],
    ['r-v3-063-oeufs-brouilles-a-la-ciboulette', [
      ['Très rapide', recipe => Number(recipe?.total) <= 15],
      ['Petit-déjeuner', recipe => recipe?.tags?.includes('petit_dejeuner')],
    ]],
    ['r-v3-091-pot-au-feu-classique', [
      ['Mijoté', recipe => recipe?.tags?.includes('mijote')],
      ['Préparé d’avance', recipe => recipe?.tags?.includes('batch_cooking')],
    ]],
    ['r-v3-147-mousse-au-chocolat', [
      ['Sans cuisson', recipe => recipe?.tags?.includes('sans_cuisson')],
      ['4 ingrédients', recipe => recipe?.ingredients?.length === 4],
    ]],
    ['r-v3-003-chili-sin-carne-aux-haricots-rouges', [
      ['Végan', recipe => recipe?.tags?.includes('vegetalien')],
      ['Préparé d’avance', recipe => recipe?.tags?.includes('batch_cooking')],
    ]],
    ['r-v3-111-pizza-margherita', [
      ['Petit budget', recipe => recipe?.budgetKey === 'tres_economique'],
      ['Grand classique', recipe => recipe?.tags?.includes('classique_italien')],
    ]],
    ['r-v3-057-salade-de-pois-chiches-concombre-et-tomate', [
      ['Très rapide', recipe => Number(recipe?.total) <= 15],
      ['Végan', recipe => recipe?.tags?.includes('vegetalien')],
    ]],
    ['r-v3-094-quiche-lorraine', [
      ['Prix accessible', recipe => recipe?.budgetKey === 'economique'],
      ['Grand classique', recipe => recipe?.tags?.includes('classique_francais')],
    ]],
    ['r-v3-061-croque-monsieur-classique', [
      ['Très rapide', recipe => Number(recipe?.total) <= 15],
      ['Une seule poêle', recipe => Array.isArray(recipe?.equipment)
        && recipe.equipment.length <= 2
        && recipe.equipment.some(item => String(item).toLocaleLowerCase('fr').includes('poêle'))],
    ]],
    ['r-v3-142-compote-de-pommes', [
      ['Petit budget', recipe => recipe?.budgetKey === 'tres_economique'],
      ['4 ingrédients', recipe => recipe?.ingredients?.length === 4],
    ]],
    ['r-v3-070-spaghetti-bolognaise', [
      ['Prix accessible', recipe => recipe?.budgetKey === 'economique'],
      ['Préparé d’avance', recipe => recipe?.tags?.includes('batch_cooking')],
    ]],
  ]);

  const PILOT_RULES_BY_ID = new Map(PILOT_RULES);

  function pilotRecipeIds() {
    return PILOT_RULES.map(([id]) => id);
  }

  function pilotBadges(recipe) {
    const rules = PILOT_RULES_BY_ID.get(recipe?.id);
    if (!rules) return null;
    return rules.filter(([, predicate]) => predicate(recipe)).map(([label]) => label);
  }

  function tagsOf(recipe) {
    return new Set(Array.isArray(recipe?.tags) ? recipe.tags : []);
  }

  const CUISINE_LABELS = Object.freeze({
    francaise: 'Cuisine française', italienne: 'Cuisine italienne', asiatique: 'Cuisine asiatique',
    mediterraneenne: 'Méditerranéen', mexicaine: 'Cuisine mexicaine', indienne: 'Cuisine indienne',
    britannique: 'Britannique', americaine: 'Américain', moyen_orient: 'Cuisine du Moyen-Orient',
  });

  function candidateBadges(recipe) {
    const tags = tagsOf(recipe);
    const total = Number(recipe?.total);
    const ingredientCount = Array.isArray(recipe?.ingredients) ? recipe.ingredients.length : 0;
    const candidates = [];
    const add = label => { if (label && !candidates.includes(label)) candidates.push(label); };

    if (recipe?.budgetKey === 'tres_economique') add('Petit budget');
    if (Number.isFinite(total) && total <= 15) add('Très rapide');
    if (tags.has('sans_cuisson')) add('Sans cuisson');
    if (tags.has('mijote')) add('Mijoté');
    if (tags.has('batch_cooking')) add('Préparé d’avance');
    if (tags.has('vegetalien')) add('Végan');
    if (tags.has('grande_tablee')) add('À partager');
    if (Number.isFinite(total) && total > 15 && total <= 30) add('Prêt en 30 min');
    if (tags.has('sans_four')) add('Sans four');
    if (recipe?.budgetKey === 'economique' && ingredientCount >= 9) add('Prix accessible');
    if (ingredientCount === 4) add('4 ingrédients');

    if (tags.has('salade') || tags.has('sans_cuisson')) add('Frais');
    if (tags.has('reconfortant')) add('Réconfortant');
    if (tags.has('four')) add('Au four');
    if (tags.has('vegetarien') && !tags.has('vegetalien')) add('Végétarien');
    if (tags.has('soupe')) add('Soupe maison');
    if (tags.has('salade')) add('Salade composée');
    if (tags.has('petit_dejeuner')) add('Petit-déjeuner');
    if (tags.has('poisson')) add('Au poisson');
    if (tags.has('volaille')) add('À la volaille');
    if (tags.has('viande')) add('À la viande');
    if (tags.has('legumineuses')) add('Légumineuses');
    if (tags.has('pates')) add('À base de pâtes');
    if (tags.has('accompagnement')) add('Accompagnement');
    if (tags.has('classique_francais') || tags.has('classique_italien') || tags.has('classique_monde')) add('Grand classique');
    if (tags.has('poele')) add('À la poêle');
    if (tags.has('casserole')) add('À la casserole');
    add(CUISINE_LABELS[recipe?.cuisine]);
    add(recipe?.category === 'plat_principal' ? 'Plat principal' : null);
    add('Cuisine maison');
    return candidates;
  }

  function cardBadges(recipe) {
    const approved = pilotBadges(recipe);
    if (approved?.length === 2) return approved;
    return candidateBadges(recipe).slice(0, 2);
  }

  return Object.freeze({ pilotRecipeIds, pilotBadges, cardBadges });
});

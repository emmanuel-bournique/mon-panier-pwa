/* Mon Panier — deterministic food-personalization core.
   Browser + Node-compatible. No network, inference, or safety claim. */
(function attachPersonalizationCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MonPanierPersonalizationCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPersonalizationCore() {
  'use strict';

  function normalize(value = '') {
    return String(value ?? '')
      .toLocaleLowerCase('fr')
      .replaceAll('œ', 'oe')
      .replaceAll('æ', 'ae')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function uniqueStrings(values = []) {
    const seen = new Set();
    const result = [];
    for (const value of values || []) {
      const clean = String(value ?? '').trim();
      const key = normalize(clean);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(clean);
    }
    return result;
  }

  function contains(text, value) {
    const haystack = normalize(text);
    const needle = normalize(value);
    return Boolean(needle && haystack.includes(needle));
  }

  function ingredientsOf(recipe = {}) {
    return Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  }

  function matchingIngredientNames(recipe, values = []) {
    const needles = uniqueStrings(values)
      .sort((left, right) => normalize(right).length - normalize(left).length);
    const names = [];
    for (const ingredient of ingredientsOf(recipe)) {
      const name = String(ingredient?.name || '').trim();
      if (name && needles.some((value) => contains(name, value))) names.push(name);
    }
    return uniqueStrings(names);
  }

  function assessRecipe(recipe, profile = {}) {
    const softAvoid = uniqueStrings(profile.avoid || []);
    const strictAvoid = uniqueStrings(profile.strictAvoid || []);
    const softAvoidMatches = matchingIngredientNames(recipe, softAvoid);
    const strictAvoidMatches = matchingIngredientNames(recipe, strictAvoid);
    return {
      compatible: strictAvoidMatches.length === 0,
      softAvoidMatches,
      strictAvoidMatches,
    };
  }

  function preferenceScore(recipe, profile = {}) {
    const text = [
      recipe?.title,
      recipe?.description,
      ...(recipe?.tags || []),
      ...ingredientsOf(recipe).map((ingredient) => ingredient?.name || ''),
    ].filter(Boolean).join(' ');
    const adored = uniqueStrings(profile.adored || []).filter((value) => contains(text, value)).length;
    const liked = uniqueStrings(profile.liked || []).filter((value) => contains(text, value)).length;
    const avoided = uniqueStrings(profile.avoid || []).filter((value) => contains(text, value)).length;
    return adored * 20 + liked * 8 - avoided * 14;
  }

  function rotationScore(id, bucket = 0) {
    let hash = 2166136261;
    for (const character of `${bucket}:${id}`) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function rankRecipes(recipes = [], profile = {}, options = {}) {
    const excluded = new Set(options.excludedIds || []);
    const limit = Math.max(0, Number(options.limit) || recipes.length);
    const bucket = Number.isFinite(options.rotationBucket) ? options.rotationBucket : Math.floor(Date.now() / (6 * 60 * 60 * 1000));
    return recipes
      .filter((recipe) => recipe && !excluded.has(recipe.id) && assessRecipe(recipe, profile).compatible)
      .map((recipe, index) => ({
        recipe,
        index,
        score: preferenceScore(recipe, profile) + (Number(recipe.total) <= 15 ? 3 : Number(recipe.total) <= 30 ? 2 : 0),
        rotation: rotationScore(recipe.id || index, bucket),
      }))
      .sort((left, right) => right.score - left.score
        || left.rotation - right.rotation
        || String(left.recipe.title || '').localeCompare(String(right.recipe.title || ''), 'fr')
        || left.index - right.index)
      .slice(0, limit)
      .map(({ recipe }) => recipe);
  }

  function adaptationKind(adaptation = {}) {
    const text = normalize(`${adaptation.label || ''} ${adaptation.instruction || ''}`);
    return /remplace|substitut/.test(text) && /\bpar\b/.test(text) ? 'substitute' : 'remove';
  }

  function cleanReplacementName(value = '') {
    return String(value || '')
      .replace(/[.;].*$/, '')
      .replace(/^(?:\d+(?:[.,]\d+)?\s*(?:kg|g|mg|l|cl|ml|piece|pieces|unite|unites)\s+)?/i, '')
      .replace(/^(?:de|d')\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function replacementName(adaptation = {}) {
    const sources = [String(adaptation.label || ''), String(adaptation.instruction || '')];
    for (const source of sources) {
      const match = source.match(/\bpar\s+(.+)$/i);
      const candidate = cleanReplacementName(match?.[1] || '');
      if (candidate) return candidate;
    }
    return '';
  }

  function findValidatedAdaptations(recipe, avoidValues = []) {
    const softMatches = matchingIngredientNames(recipe, avoidValues);
    if (!softMatches.length || !Array.isArray(recipe?.adaptations)) return [];
    const adaptations = [];
    for (const adaptation of recipe.adaptations) {
      if (normalize(adaptation?.status) !== 'validee_editorialement') continue;
      const adaptationText = `${adaptation?.label || ''} ${adaptation?.instruction || ''}`;
      const source = ingredientsOf(recipe)
        .filter((ingredient) => softMatches.some((name) => normalize(name) === normalize(ingredient?.name)) && contains(adaptationText, ingredient?.name))
        .sort((left, right) => normalize(right.name).length - normalize(left.name).length)[0];
      if (!source) continue;
      const kind = adaptationKind(adaptation);
      const candidate = {
        ...adaptation,
        kind,
        ingredientId: source.id || '',
        ingredientName: source.name,
        replacementName: kind === 'substitute' ? replacementName(adaptation) : '',
      };
      if (kind === 'substitute' && !candidate.replacementName) continue;
      adaptations.push(candidate);
    }
    return adaptations;
  }

  function adaptationKey(value = '') {
    return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ingredient';
  }

  function applyValidatedAdaptation(recipe, candidate, options = {}) {
    if (!recipe || !candidate || normalize(candidate.status) !== 'validee_editorialement') return null;
    const sourceIndex = ingredientsOf(recipe).findIndex((ingredient) =>
      (candidate.ingredientId && ingredient.id === candidate.ingredientId)
      || normalize(ingredient.name) === normalize(candidate.ingredientName),
    );
    if (sourceIndex < 0) return null;
    const original = ingredientsOf(recipe);
    const source = original[sourceIndex];
    const ingredients = original.map((ingredient) => ({
      ...ingredient,
      allergens: Array.isArray(ingredient.allergens) ? [...ingredient.allergens] : [],
    }));

    if (candidate.kind === 'remove') {
      ingredients.splice(sourceIndex, 1);
      return {
        ingredients,
        change: {
          type: 'remove_ingredient',
          before: source,
          after: null,
          adaptation: candidate.label || candidate.instruction || '',
        },
      };
    }

    if (candidate.kind !== 'substitute' || !candidate.replacementName) return null;
    const resolved = typeof options.resolveIngredient === 'function'
      ? options.resolveIngredient(candidate.replacementName, source)
      : null;
    const targetName = String(resolved?.name || candidate.replacementName).trim();
    if (!targetName) return null;
    const replacement = {
      ...source,
      id: `adaptation-${source.id || adaptationKey(source.name)}-${adaptationKey(targetName)}`,
      name: targetName,
      allergens: Array.isArray(resolved?.allergens)
        ? [...resolved.allergens]
        : [...(source.allergens || [])],
      aisle: resolved?.aisle || source.aisle,
      coursesStatus: resolved?.coursesStatus || source.coursesStatus,
      role: 'essentiel',
      adaptationSourceId: source.id || '',
      adaptationValidated: true,
    };
    ingredients.splice(sourceIndex, 1, replacement);
    return {
      ingredients,
      change: {
        type: 'substitute_ingredient',
        before: source,
        after: replacement,
        adaptation: candidate.label || candidate.instruction || '',
      },
    };
  }

  return {
    normalize,
    uniqueStrings,
    matchingIngredientNames,
    assessRecipe,
    preferenceScore,
    rankRecipes,
    findValidatedAdaptations,
    applyValidatedAdaptation,
  };
});

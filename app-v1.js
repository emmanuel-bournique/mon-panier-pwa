/* Mon Panier — Full App Functional V1
   Rebuilt components, media routing, local persistence and 15-screen demo routes. */
(() => {
  'use strict';

  const MEDIA = window.__MON_PANIER_MEDIA_V1__;
  if (!MEDIA || MEDIA.assetCount !== 1169 || MEDIA.derivativeCount !== 2338) {
    throw new Error('Mon Panier media registry unavailable or incomplete');
  }

  const APP_STATE_KEY = 'mon-panier-full-app-state-v1';
  const GROCERY_CORE = window.MonPanierGroceryCore;
  if (!GROCERY_CORE) throw new Error('Mon Panier local grocery core is unavailable');
  const PERSONALIZATION_CORE = window.MonPanierPersonalizationCore;
  if (!PERSONALIZATION_CORE) throw new Error('Mon Panier personalization core is unavailable');
  const MON_PANIER_CARD_BADGES = window.MonPanierCardBadgeCore;
  if (!MON_PANIER_CARD_BADGES) throw new Error('Mon Panier card badge core is unavailable');
  // Keep the guided preference flow active for first-run and Profile relaunches.
  const DEV_SKIP_ONBOARDING = false;
  const ONBOARDING_PREVIEW_PARAM = 'onboarding';
  const APP_MANIFEST = {
    name: 'Mon Panier — Full App Functional V1',
    mobileOnly: true,
    publicRecipes: 360,
    hiddenReserve: 126,
    mediaIdentities: 1169,
    webpDerivatives: 2338,
    localPersistence: true,
    localGroceryCart: true,
    externalProviders: false,
    backend: false,
    mediaExecution: false,
  };

  /* luna-filter-core:start */
  const LUNA_FILTER_CORE = (() => {
    const normalizeSearch = (value) => String(value ?? '')
      .toLocaleLowerCase('fr')
      .replaceAll('œ', 'oe')
      .replaceAll('æ', 'ae')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’'`-]/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');

    const singularToken = (token) => {
      if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
      return token;
    };

    const normalizedTokens = (value) => normalizeSearch(value).split(' ').filter(Boolean).map(singularToken);
    const normalizedPhrase = (value) => normalizedTokens(value).join(' ');

    function matchesSearch(recipe, query) {
      const wanted = normalizedPhrase(query);
      if (!wanted) return true;
      const haystack = [
        recipe?.title,
        recipe?.description,
        recipe?.category,
        ...(recipe?.mealCategories || []),
        ...(recipe?.tags || []),
        recipe?.cuisine,
        recipe?.difficulty,
        recipe?.difficultyKey,
        recipe?.budget,
        recipe?.budgetKey,
        ...(recipe?.equipment || []),
        ...(recipe?.allergens || []),
        ...derivedProteinTypes(recipe),
        ...(recipe?.ingredients || []).map((ingredient) => ingredient?.name),
      ].filter(Boolean).map(normalizedPhrase).join(' ');
      return haystack.includes(wanted);
    }

    const proteinPatterns = Object.freeze({
      volaille: /\b(poulet|dinde|canard|oie|caille|pintade|poule|poularde)\b/,
      poisson: /\b(poisson|saumon|thon|morue|cabillaud|colin|truite|maquereau|merlu|sole|dorade|sardine|anchois|hareng|lotte|crevette|moule|coquille saint jacques|fruits? de mer)\b/,
      viande: /\b(boeuf|veau|porc|agneau|mouton|biche|lapin|chevreuil|lievre|lardons?|jambon|saucisse|chorizo|viande|charcuterie|caneton)\b/,
    });

    function derivedProteinTypes(recipe) {
      const text = [
        ...(recipe?.tags || []),
        ...(recipe?.ingredients || []).map((ingredient) => ingredient?.name),
      ].filter(Boolean).map(normalizedPhrase).join(' ');
      const result = new Set();
      for (const [type, pattern] of Object.entries(proteinPatterns)) {
        if (pattern.test(text) || (recipe?.tags || []).includes(type)) result.add(type);
      }
      return result;
    }

    function dietMatch(recipe, value) {
      if (value === 'vegetarien') return (recipe?.tags || []).includes('vegetarien') || (recipe?.tags || []).includes('vegetalien');
      if (value === 'vegetalien') return (recipe?.tags || []).includes('vegetalien');
      return derivedProteinTypes(recipe).has(value);
    }

    function equipmentHasForbiddenMachine(recipe) {
      const equipment = (recipe?.equipment || []).map(normalizedPhrase).join(' ');
      return /\b(mixeur|mixer|robot|blender)\b/.test(equipment);
    }

    function matchesFilter(recipe, group, value) {
      if (group === 'time') {
        if (value === 'le15') return Number(recipe?.total) <= 15;
        if (value === 'le30') return Number(recipe?.total) <= 30;
        if (value === '16_30') return Number(recipe?.total) >= 16 && Number(recipe?.total) <= 30;
        if (value === '31_59') return Number(recipe?.total) >= 31 && Number(recipe?.total) <= 59;
        if (value === '60plus') return Number(recipe?.total) >= 60;
        return false;
      }
      if (group === 'ingredients') return value === 'six_or_less' && (recipe?.ingredients || []).length <= 6;
      if (group === 'budget') return recipe?.budgetKey === value;
      if (group === 'difficulty') return recipe?.difficultyKey === value;
      if (group === 'type') return (recipe?.tags || []).includes(value);
      if (group === 'category') return (recipe?.mealCategories || []).includes(value) || recipe?.category === value;
      if (group === 'cuisine') return recipe?.cuisine === value;
      if (group === 'diet') return dietMatch(recipe, value);
      if (group === 'protein') return derivedProteinTypes(recipe).has(value);
      if (group === 'method') {
        if (value === 'sans_four') return (recipe?.tags || []).includes('sans_four');
        if (value === 'sans_mixeur_ni_robot') return !equipmentHasForbiddenMachine(recipe);
        return (recipe?.tags || []).includes(value);
      }
      if (group === 'usage') return (recipe?.tags || []).includes(value);
      return (recipe?.tags || []).includes(value);
    }

    function matchesFilters(recipe, filters = {}) {
      return Object.entries(filters).every(([group, values]) => {
        if (!values?.size) return true;
        return [...values].some((value) => matchesFilter(recipe, group, value));
      });
    }

    return Object.freeze({
      normalizeSearch,
      matchesSearch,
      matchesFilter,
      matchesFilters,
      derivedProteinTypes,
    });
  })();
  /* luna-filter-core:end */

  /* nutrition-360-pilot-v2:start:data */
  const NUTRITION_360_PILOT_V2 = Object.freeze({
    source: 'Ciqual 2025 + logique culinaire',
    policy: "nutrition_logic_policy_v1",
    calculationSha: "9b1cbe09fa781070045283c354c2dbc9cefde55ced0c11c113017465dadd292b",
    estimateLabel: 'Valeurs estimées',
    claimsExposed: false,
    recipes: Object.freeze({
      "r-v3-069-spaghetti-carbonara": Object.freeze({ kcal: 635.0, protein: 30.8, carbs: 73.8, sugars: 2.8, fat: 22.5, saturates: 10.2, fibre: 2.9, salt: 2.25, status: 'estimated_logic' }),
      "r-v3-070-spaghetti-bolognaise": Object.freeze({ kcal: 617.0, protein: 27.3, carbs: 81.7, sugars: 9.4, fat: 18.5, saturates: 4.5, fibre: 6.8, salt: 0.49, status: 'estimated_logic' }),
      "r-v3-111-pizza-margherita": Object.freeze({ kcal: 493.0, protein: 20.5, carbs: 58.9, sugars: 3.4, fat: 19.0, saturates: 8.2, fibre: 4.6, salt: 2.08, status: 'estimated_logic' }),
      "r-v3-091-pot-au-feu-classique": Object.freeze({ kcal: 468.0, protein: 31.9, carbs: 36.1, sugars: 11.5, fat: 20.5, saturates: 6.3, fibre: 8.7, salt: 0.9, status: 'estimated_logic' }),
      "r-v3-092-boeuf-bourguignon": Object.freeze({ kcal: 512.0, protein: 33.5, carbs: 11.4, sugars: 5.5, fat: 27.0, saturates: 8.6, fibre: 3.0, salt: 1.59, status: 'estimated_logic' }),
      "r-v3-104-galette-complete-jambon-oeuf-fromage": Object.freeze({ kcal: 376.0, protein: 28.1, carbs: 7.9, sugars: 1.6, fat: 24.3, saturates: 12.6, fibre: 1.1, salt: 1.26, status: 'estimated_logic' }),
      "r-v3-094-quiche-lorraine": Object.freeze({ kcal: 294.0, protein: 12.3, carbs: 7.7, sugars: 1.7, fat: 23.7, saturates: 11.9, fibre: 0.4, salt: 1.02, status: 'estimated_logic' }),
      "r-v3-077-gratin-dauphinois": Object.freeze({ kcal: 375.0, protein: 7.2, carbs: 36.5, sugars: 4.2, fat: 20.6, saturates: 13.4, fibre: 4.9, salt: 0.2, status: 'estimated_logic' }),
      "r-v3-061-croque-monsieur-classique": Object.freeze({ kcal: 473.0, protein: 24.9, carbs: 40.7, sugars: 5.0, fat: 22.5, saturates: 12.7, fibre: 2.4, salt: 1.86, status: 'estimated_logic' }),
      "r-v3-065-omelette-jambon-fromage": Object.freeze({ kcal: 334.0, protein: 29.2, carbs: 0.4, sugars: 0.2, fat: 23.9, saturates: 11.6, fibre: 0.2, salt: 1.24, status: 'estimated_logic' }),
      "r-v3-097-tartiflette": Object.freeze({ kcal: 561.0, protein: 25.7, carbs: 34.9, sugars: 2.0, fat: 33.9, saturates: 20.9, fibre: 5.4, salt: 1.92, status: 'estimated_logic' }),
      "r-v3-017-poulet-roti-au-citron-thym-et-pommes-de-terre": Object.freeze({ kcal: 503.0, protein: 40.7, carbs: 39.8, sugars: 2.2, fat: 17.8, saturates: 3.6, fibre: 6.8, salt: 0.63, status: 'estimated_logic' }),
      "r-v3-112-lasagnes-bolognaises": Object.freeze({ kcal: 308.0, protein: 18.7, carbs: 15.1, sugars: 8.5, fat: 19.0, saturates: 10.3, fibre: 2.1, salt: 0.61, status: 'estimated_logic' }),
      "r-v3-102-steak-frites-maison": Object.freeze({ kcal: 799.0, protein: 35.7, carbs: 40.5, sugars: 2.0, fat: 53.1, saturates: 9.3, fibre: 5.5, salt: 0.32, status: 'estimated_logic' }),
      "r-v3-098-raclette-traditionnelle": Object.freeze({ kcal: 779.0, protein: 49.2, carbs: 42.8, sugars: 4.0, fat: 43.1, saturates: 28.4, fibre: 7.2, salt: 4.12, status: 'estimated_logic' }),
      "r-v3-093-coq-au-vin": Object.freeze({ kcal: 422.0, protein: 45.9, carbs: 8.6, sugars: 2.7, fat: 14.1, saturates: 4.2, fibre: 2.6, salt: 1.23, status: 'estimated_logic' }),
      "r-v3-099-cassoulet-simplifie": Object.freeze({ kcal: 570.0, protein: 29.0, carbs: 28.3, sugars: 3.4, fat: 32.2, saturates: 11.9, fibre: 26.1, salt: 2.39, status: 'estimated_logic' }),
      "r-v3-136-crepes-sucrees": Object.freeze({ kcal: 272.0, protein: 9.9, carbs: 39.9, sugars: 9.7, fat: 7.6, saturates: 4.1, fibre: 1.3, salt: 0.15, status: 'estimated_logic' }),
      "r-v3-147-mousse-au-chocolat": Object.freeze({ kcal: 264.0, protein: 8.4, carbs: 22.7, sugars: 20.4, fat: 14.8, saturates: 7.7, fibre: 2.8, salt: 0.23, status: 'estimated_logic' }),
      "r-v3-118-burger-maison": Object.freeze({ kcal: 569.0, protein: 41.4, carbs: 23.8, sugars: 5.0, fat: 32.1, saturates: 14.3, fibre: 4.4, salt: 2.79, status: 'estimated_logic' }),
      "r-v3-132-paella-poulet-et-crevettes": Object.freeze({ kcal: 465.0, protein: 37.4, carbs: 65.0, sugars: 4.2, fat: 5.3, saturates: 1.4, fibre: 3.6, salt: 0.52, status: 'estimated_logic' }),
      "r-v3-127-poulet-tikka-masala": Object.freeze({ kcal: 546.0, protein: 43.8, carbs: 61.2, sugars: 6.1, fat: 12.5, saturates: 7.1, fibre: 3.4, salt: 0.32, status: 'estimated_logic' }),
      "r-v3-124-pad-thai-au-poulet": Object.freeze({ kcal: 608.0, protein: 41.6, carbs: 73.4, sugars: 1.2, fat: 14.6, saturates: 3.5, fibre: 3.3, salt: 0.45, status: 'estimated_logic' }),
      "r-v3-131-moussaka": Object.freeze({ kcal: 455.0, protein: 30.2, carbs: 18.3, sugars: 12.3, fat: 26.6, saturates: 13.8, fibre: 7.8, salt: 0.42, status: 'estimated_logic' }),
      "r-v3-062-croque-madame": Object.freeze({ kcal: 543.0, protein: 31.3, carbs: 40.7, sugars: 5.1, fat: 27.4, saturates: 14.0, fibre: 2.4, salt: 2.01, status: 'estimated_logic' }),
      "r-v3-064-oeufs-au-plat-et-pommes-de-terre-poelees": Object.freeze({ kcal: 464.0, protein: 17.9, carbs: 40.6, sugars: 2.0, fat: 23.8, saturates: 4.8, fibre: 5.5, salt: 0.7, status: 'estimated_logic' }),
      "r-v3-067-spaghetti-sauce-tomate-et-basilic": Object.freeze({ kcal: 489.0, protein: 15.3, carbs: 82.9, sugars: 7.7, fat: 8.5, saturates: 1.4, fibre: 7.1, salt: 0.32, status: 'estimated_logic' }),
      "r-v3-068-coquillettes-jambon-et-fromage": Object.freeze({ kcal: 546.0, protein: 27.5, carbs: 64.2, sugars: 2.7, fat: 18.8, saturates: 11.1, fibre: 2.7, salt: 0.96, status: 'estimated_logic' }),
      "r-v3-071-pates-au-pesto": Object.freeze({ kcal: 661.0, protein: 18.6, carbs: 75.7, sugars: 2.9, fat: 29.8, saturates: 6.6, fibre: 4.5, salt: 0.26, status: 'estimated_logic' }),
      "r-v3-074-riz-a-la-tomate-et-oeuf": Object.freeze({ kcal: 449.0, protein: 13.8, carbs: 68.2, sugars: 4.2, fat: 12.4, saturates: 2.5, fibre: 4.1, salt: 0.25, status: 'estimated_logic' }),
      "r-v3-075-puree-de-pommes-de-terre-maison": Object.freeze({ kcal: 279.0, protein: 6.3, carbs: 39.0, sugars: 4.3, fat: 9.3, saturates: 6.6, fibre: 5.0, salt: 0.24, status: 'estimated_logic' }),
      "r-v3-076-pommes-de-terre-sautees-ail-et-persil": Object.freeze({ kcal: 282.0, protein: 5.5, carbs: 37.2, sugars: 1.9, fat: 10.5, saturates: 1.6, fibre: 6.0, salt: 0.22, status: 'estimated_logic' }),
      "r-v3-078-saucisse-puree": Object.freeze({ kcal: 524.0, protein: 16.8, carbs: 39.3, sugars: 4.4, fat: 31.8, saturates: 14.8, fibre: 5.0, salt: 1.75, status: 'estimated_logic' }),
      "r-v3-080-quesadillas-fromage-et-haricots-rouges": Object.freeze({ kcal: 638.0, protein: 31.5, carbs: 65.3, sugars: 4.1, fat: 23.8, saturates: 11.5, fibre: 17.3, salt: 2.18, status: 'estimated_logic' }),
      "r-v3-081-wraps-de-poulet-aux-crudites": Object.freeze({ kcal: 272.0, protein: 25.7, carbs: 28.0, sugars: 4.3, fat: 5.2, saturates: 1.3, fibre: 2.0, salt: 0.77, status: 'estimated_logic' }),
      "r-v3-087-salade-verte-aux-oeufs-durs": Object.freeze({ kcal: 300.0, protein: 14.9, carbs: 4.8, sugars: 4.3, fat: 24.0, saturates: 4.8, fibre: 2.0, salt: 0.35, status: 'estimated_logic' }),
      "r-v3-088-soupe-tomate-basilic": Object.freeze({ kcal: 100.0, protein: 3.5, carbs: 11.3, sugars: 6.6, fat: 3.5, saturates: 0.5, fibre: 5.0, salt: 0.14, status: 'estimated_logic' }),
      "r-v3-089-bouillon-aux-vermicelles-et-legumes": Object.freeze({ kcal: 133.0, protein: 4.5, carbs: 25.5, sugars: 4.0, fat: 0.6, saturates: 0.1, fibre: 2.7, salt: 0.3, status: 'estimated_logic' }),
      "r-v3-119-hot-dogs-maison": Object.freeze({ kcal: 366.0, protein: 18.2, carbs: 25.6, sugars: 2.8, fat: 19.3, saturates: 6.7, fibre: 4.8, salt: 3.81, status: 'estimated_logic' }),
      "r-v3-066-pates-au-beurre-et-parmesan": Object.freeze({ kcal: 559.0, protein: 18.3, carbs: 73.1, sugars: 2.7, fat: 20.3, saturates: 13.5, fibre: 2.9, salt: 0.53, status: 'estimated_logic' }),
      "r-v3-063-oeufs-brouilles-a-la-ciboulette": Object.freeze({ kcal: 199.0, protein: 13.1, carbs: 0.4, sugars: 0.3, fat: 16.1, saturates: 7.1, fibre: 0.2, salt: 0.51, status: 'estimated_logic' }),
      "r-v3-082-sandwich-au-thon-et-crudites": Object.freeze({ kcal: 452.0, protein: 29.6, carbs: 43.6, sugars: 6.1, fat: 17.2, saturates: 2.4, fibre: 4.1, salt: 1.77, status: 'estimated_logic' }),
      "r-v3-083-tartines-tomate-et-mozzarella": Object.freeze({ kcal: 425.0, protein: 17.0, carbs: 44.0, sugars: 5.4, fat: 19.0, saturates: 8.7, fibre: 4.5, salt: 1.32, status: 'estimated_logic' }),
      "r-v3-085-salade-tomate-mozzarella": Object.freeze({ kcal: 227.0, protein: 11.1, carbs: 4.8, sugars: 4.2, fat: 18.0, saturates: 8.4, fibre: 1.3, salt: 0.47, status: 'estimated_logic' }),
      "r-v3-073-spaghetti-aglio-e-olio": Object.freeze({ kcal: 734.0, protein: 17.5, carbs: 94.3, sugars: 3.8, fat: 29.4, saturates: 4.6, fibre: 7.9, salt: 0.08, status: 'estimated_logic' }),
      "r-v3-090-semoule-aux-legumes-minute": Object.freeze({ kcal: 443.0, protein: 15.0, carbs: 68.4, sugars: 4.5, fat: 9.8, saturates: 1.5, fibre: 8.2, salt: 0.39, status: 'estimated_logic' }),
      "r-v3-130-houmous-crudites-et-pain-pita": Object.freeze({ kcal: 430.0, protein: 16.7, carbs: 49.4, sugars: 6.7, fat: 14.7, saturates: 2.0, fibre: 12.8, salt: 1.29, status: 'estimated_logic' }),
      "r-v3-140-yaourt-fruits-et-granola": Object.freeze({ kcal: 545.0, protein: 10.8, carbs: 58.7, sugars: 32.9, fat: 18.4, saturates: 9.5, fibre: 9.3, salt: 0.17, status: 'estimated_logic' }),
      "r-v3-143-mug-cake-au-chocolat": Object.freeze({ kcal: 536.0, protein: 7.4, carbs: 70.3, sugars: 39.1, fat: 23.9, saturates: 16.2, fibre: 4.2, salt: 0.06, status: 'estimated_logic' }),
      "r-v3-084-salade-de-concombre-au-yaourt": Object.freeze({ kcal: 53.0, protein: 3.0, carbs: 6.7, sugars: 4.6, fat: 1.0, saturates: 0.6, fibre: 0.8, salt: 0.17, status: 'estimated_logic' }),
      "r-v3-086-carottes-rapees-vinaigrette": Object.freeze({ kcal: 128.0, protein: 0.9, carbs: 5.8, sugars: 5.1, fat: 10.4, saturates: 0.8, fibre: 3.3, salt: 0.14, status: 'estimated_logic' }),
      "r-v3-057-salade-de-pois-chiches-concombre-et-tomate": Object.freeze({ kcal: 297.0, protein: 10.0, carbs: 27.7, sugars: 8.2, fat: 13.8, saturates: 2.0, fibre: 9.9, salt: 0.86, status: 'estimated_logic' }),
      "r-v3-144-gateau-au-yaourt": Object.freeze({ kcal: 359.0, protein: 6.4, carbs: 50.9, sugars: 23.6, fat: 14.0, saturates: 1.6, fibre: 1.2, salt: 0.08, status: 'estimated_logic' }),
      "r-v3-138-pain-perdu": Object.freeze({ kcal: 361.0, protein: 11.9, carbs: 53.9, sugars: 15.7, fat: 9.9, saturates: 5.5, fibre: 3.7, salt: 1.09, status: 'estimated_logic' }),
      "r-v3-137-pancakes-moelleux": Object.freeze({ kcal: 367.0, protein: 11.5, carbs: 57.6, sugars: 12.2, fat: 9.4, saturates: 5.3, fibre: 2.0, salt: 0.15, status: 'estimated_logic' }),
      "r-v3-206-bruschettas-tomate-basilic": Object.freeze({ kcal: 231.0, protein: 5.1, carbs: 33.2, sugars: 3.1, fat: 7.7, saturates: 1.3, fibre: 3.3, salt: 1.96, status: 'estimated_logic' }),
      "r-v3-207-tapenade-d-olives-noires": Object.freeze({ kcal: 328.0, protein: 2.3, carbs: 2.4, sugars: 0.3, fat: 25.1, saturates: 3.5, fibre: 6.3, salt: 4.87, status: 'estimated_logic' }),
      "r-v3-208-guacamole-et-tortilla-chips": Object.freeze({ kcal: 150.0, protein: 5.0, carbs: 16.8, sugars: 6.9, fat: 4.0, saturates: 0.8, fibre: 4.5, salt: 1.38, status: 'estimated_logic' }),
      "r-v3-209-tzatziki-et-pain-pita": Object.freeze({ kcal: 104.0, protein: 3.7, carbs: 9.0, sugars: 3.3, fat: 5.2, saturates: 3.3, fibre: 2.0, salt: 1.29, status: 'estimated_logic' }),
      "r-v3-210-caviar-d-aubergine": Object.freeze({ kcal: 113.0, protein: 2.1, carbs: 7.0, sugars: 2.3, fat: 7.0, saturates: 1.1, fibre: 3.5, salt: 1.23, status: 'estimated_logic' }),
      "r-v3-211-mini-feuilletes-au-pesto": Object.freeze({ kcal: 569.0, protein: 29.5, carbs: 26.8, sugars: 2.4, fat: 37.2, saturates: 23.0, fibre: 2.1, salt: 3.56, status: 'estimated_logic' }),
      "r-v3-212-cake-sale-olives-et-jambon": Object.freeze({ kcal: 465.0, protein: 25.5, carbs: 46.8, sugars: 1.1, fat: 18.2, saturates: 3.6, fibre: 4.6, salt: 4.35, status: 'estimated_logic' }),
      "r-v3-123-nachos-au-guacamole": Object.freeze({ kcal: 464.0, protein: 17.6, carbs: 57.0, sugars: 6.6, fat: 14.8, saturates: 6.4, fibre: 5.1, salt: 0.68, status: 'estimated_logic' }),
      "r-v3-200-rillettes-de-thon-au-fromage-frais": Object.freeze({ kcal: 240.0, protein: 20.8, carbs: 2.8, sugars: 2.4, fat: 15.4, saturates: 8.8, fibre: 0.2, salt: 2.25, status: 'estimated_logic' }),
      "r-v3-195-oeufs-mimosa": Object.freeze({ kcal: 516.0, protein: 7.7, carbs: 4.4, sugars: 0.9, fat: 51.8, saturates: 5.6, fibre: 1.3, salt: 2.26, status: 'estimated_logic' }),
      "r-v3-109-choucroute-garnie-simplifiee": Object.freeze({ kcal: 671.0, protein: 27.2, carbs: 27.1, sugars: 1.9, fat: 42.7, saturates: 14.7, fibre: 12.3, salt: 5.19, status: 'estimated_logic' }),
      "r-v3-110-brandade-de-morue": Object.freeze({ kcal: 415.0, protein: 29.5, carbs: 35.7, sugars: 3.8, fat: 15.5, saturates: 2.9, fibre: 4.7, salt: 0.45, status: 'estimated_logic' }),
      "r-v3-149-tarte-aux-pommes": Object.freeze({ kcal: 112.0, protein: 0.7, carbs: 20.5, sugars: 19.3, fat: 2.5, saturates: 1.6, fibre: 2.1, salt: 0.01, status: 'estimated_logic' }),
      "r-v3-072-cacio-e-pepe": Object.freeze({ kcal: 560.0, protein: 23.7, carbs: 81.2, sugars: 2.9, fat: 14.3, saturates: 9.2, fibre: 3.7, salt: 2.33, status: 'estimated_logic' }),
      "r-v3-115-pates-all-amatriciana": Object.freeze({ kcal: 581.0, protein: 25.0, carbs: 78.3, sugars: 6.8, fat: 16.6, saturates: 7.9, fibre: 5.2, salt: 1.96, status: 'estimated_logic' }),
      "r-v3-116-spaghetti-alla-puttanesca": Object.freeze({ kcal: 1374.0, protein: 15.3, carbs: 82.2, sugars: 6.9, fat: 106.0, saturates: 15.9, fibre: 8.4, salt: 0.85, status: 'estimated_logic' }),
      "r-v3-113-aubergines-a-la-parmigiana": Object.freeze({ kcal: 284.0, protein: 14.5, carbs: 10.2, sugars: 9.4, fat: 18.8, saturates: 8.7, fibre: 8.1, salt: 0.55, status: 'estimated_logic' }),
      "r-v3-114-risotto-aux-champignons": Object.freeze({ kcal: 448.0, protein: 13.5, carbs: 65.7, sugars: 1.8, fat: 13.7, saturates: 9.1, fibre: 2.9, salt: 0.4, status: 'estimated_logic' }),
      "r-v3-117-arancini-a-la-mozzarella": Object.freeze({ kcal: 934.0, protein: 19.5, carbs: 97.3, sugars: 2.1, fat: 50.7, saturates: 8.3, fibre: 3.6, salt: 0.56, status: 'estimated_logic' }),
      "r-v3-013-polenta-cremeuse-aux-champignons-dores": Object.freeze({ kcal: 460.0, protein: 18.6, carbs: 55.5, sugars: 8.3, fat: 17.3, saturates: 9.2, fibre: 3.9, salt: 0.76, status: 'estimated_logic' }),
      "r-v3-007-shakshuka-douce-aux-poivrons": Object.freeze({ kcal: 246.0, protein: 13.4, carbs: 13.2, sugars: 7.0, fat: 14.4, saturates: 3.1, fibre: 6.2, salt: 0.57, status: 'estimated_logic' }),
      "r-v3-003-chili-sin-carne-aux-haricots-rouges": Object.freeze({ kcal: 309.0, protein: 15.3, carbs: 33.2, sugars: 7.8, fat: 8.6, saturates: 1.4, fibre: 20.1, salt: 0.61, status: 'estimated_logic' }),
      "r-v3-047-lasagnes-aux-epinards-et-a-la-ricotta": Object.freeze({ kcal: 596.0, protein: 26.2, carbs: 61.5, sugars: 10.0, fat: 25.0, saturates: 12.5, fibre: 9.2, salt: 1.04, status: 'estimated_logic' }),
      "r-v3-002-curry-de-lentilles-corail-aux-epinards": Object.freeze({ kcal: 459.0, protein: 24.6, carbs: 44.7, sugars: 5.5, fat: 16.5, saturates: 11.1, fibre: 16.5, salt: 0.41, status: 'estimated_logic' }),
      "r-v3-001-ratatouille-aux-pois-chiches-et-semoule": Object.freeze({ kcal: 491.0, protein: 16.2, carbs: 69.4, sugars: 9.9, fat: 13.3, saturates: 2.0, fibre: 13.0, salt: 0.62, status: 'estimated_logic' }),
      "r-v3-129-falafels-et-sauce-yaourt": Object.freeze({ kcal: 322.0, protein: 19.0, carbs: 43.2, sugars: 4.2, fat: 5.5, saturates: 1.0, fibre: 11.3, salt: 0.15, status: 'estimated_logic' }),
      "r-v3-053-minestrone-aux-haricots-blancs-et-petites-pates": Object.freeze({ kcal: 349.0, protein: 13.1, carbs: 45.8, sugars: 6.7, fat: 8.6, saturates: 1.4, fibre: 17.6, salt: 0.36, status: 'estimated_logic' }),
      "r-v3-126-ramen-simple-aux-oeufs-et-legumes": Object.freeze({ kcal: 446.0, protein: 21.4, carbs: 67.4, sugars: 1.9, fat: 8.1, saturates: 2.3, fibre: 6.0, salt: 3.24, status: 'estimated_logic' }),
      "r-v3-145-cookies-aux-pepites-de-chocolat": Object.freeze({ kcal: 398.0, protein: 5.1, carbs: 47.7, sugars: 22.6, fat: 20.5, saturates: 13.7, fibre: 2.5, salt: 0.05, status: 'estimated_logic' }),
      "r-v3-141-salade-de-fruits-frais": Object.freeze({ kcal: 167.0, protein: 1.7, carbs: 37.3, sugars: 29.7, fat: 0.6, saturates: 0.1, fibre: 6.2, salt: 0.02, status: 'estimated_logic' }),
      "r-v3-142-compote-de-pommes": Object.freeze({ kcal: 110.0, protein: 0.5, carbs: 23.4, sugars: 21.3, fat: 0.5, saturates: 0.1, fibre: 3.0, salt: 0.01, status: 'estimated_logic' }),
      "r-v3-146-crumble-aux-pommes": Object.freeze({ kcal: 443.0, protein: 3.4, carbs: 65.2, sugars: 41.2, fat: 17.4, saturates: 12.2, fibre: 3.9, salt: 0.03, status: 'estimated_logic' }),
      "r-v3-100-petit-sale-aux-lentilles": Object.freeze({ kcal: 688.0, protein: 52.9, carbs: 37.9, sugars: 3.2, fat: 31.4, saturates: 10.2, fibre: 14.5, salt: 0.25, status: 'estimated_logic' }),
      "r-v3-079-saucisses-aux-lentilles": Object.freeze({ kcal: 505.0, protein: 28.8, carbs: 35.1, sugars: 2.9, fat: 24.9, saturates: 9.2, fibre: 13.2, salt: 1.57, status: 'estimated_logic' }),
      "r-v3-135-curry-japonais-au-poulet": Object.freeze({ kcal: 582.0, protein: 38.8, carbs: 86.0, sugars: 3.8, fat: 7.1, saturates: 1.8, fibre: 7.4, salt: 0.43, status: 'estimated_logic' }),
      "r-v3-155-boulettes-de-boeuf-sauce-tomate": Object.freeze({ kcal: 586.0, protein: 41.2, carbs: 8.3, sugars: 3.9, fat: 42.7, saturates: 20.4, fibre: 2.8, salt: 2.89, status: 'estimated_logic' }),
      "r-v3-157-risotto-aux-poireaux-et-parmesan": Object.freeze({ kcal: 668.0, protein: 30.2, carbs: 63.6, sugars: 3.4, fat: 31.2, saturates: 16.7, fibre: 2.7, salt: 3.2, status: 'estimated_logic' }),
      "r-v3-160-orzo-cremeux-tomate-et-feta": Object.freeze({ kcal: 599.0, protein: 23.4, carbs: 61.6, sugars: 5.9, fat: 26.6, saturates: 14.0, fibre: 5.3, salt: 3.09, status: 'estimated_logic' }),
      "r-v3-161-dahl-de-pois-chiches-au-lait-de-coco": Object.freeze({ kcal: 348.0, protein: 9.5, carbs: 19.7, sugars: 5.0, fat: 23.8, saturates: 14.2, fibre: 8.1, salt: 1.88, status: 'estimated_logic' }),
      "r-v3-128-butter-chicken": Object.freeze({ kcal: 719.0, protein: 43.4, carbs: 61.4, sugars: 6.3, fat: 32.2, saturates: 18.8, fibre: 3.4, salt: 0.58, status: 'estimated_logic' }),
      "r-v3-120-tacos-de-boeuf": Object.freeze({ kcal: 284.0, protein: 21.6, carbs: 5.8, sugars: 4.8, fat: 19.5, saturates: 8.6, fibre: 1.5, salt: 0.84, status: 'estimated_logic' }),
      "r-v3-122-fajitas-de-poulet": Object.freeze({ kcal: 468.0, protein: 37.8, carbs: 54.7, sugars: 6.1, fat: 8.6, saturates: 1.8, fibre: 6.5, salt: 1.41, status: 'estimated_logic' }),
      "r-v3-133-fish-and-chips": Object.freeze({ kcal: 1102.0, protein: 44.1, carbs: 74.9, sugars: 3.2, fat: 61.7, saturates: 5.2, fibre: 6.9, salt: 0.53, status: 'estimated_logic' }),
      "r-v3-134-shepherd-s-pie": Object.freeze({ kcal: 457.0, protein: 26.6, carbs: 34.4, sugars: 6.5, fat: 21.3, saturates: 10.4, fibre: 6.6, salt: 0.18, status: 'estimated_logic' }),
      "r-v3-004-galettes-de-pois-chiches-et-courgette-sauce-citronnee": Object.freeze({ kcal: 306.0, protein: 14.8, carbs: 27.7, sugars: 5.1, fat: 12.8, saturates: 2.3, fibre: 8.4, salt: 0.86, status: 'estimated_logic' }),
      "r-v3-005-gratin-de-chou-fleur-et-pommes-de-terre-au-comte": Object.freeze({ kcal: 410.0, protein: 18.2, carbs: 39.9, sugars: 10.5, fat: 18.1, saturates: 11.6, fibre: 7.4, salt: 0.54, status: 'estimated_logic' }),
      "r-v3-006-omelette-aux-champignons-et-epinards": Object.freeze({ kcal: 288.0, protein: 20.1, carbs: 6.8, sugars: 2.0, fat: 19.1, saturates: 7.9, fibre: 3.7, salt: 0.98, status: 'estimated_logic' }),
      "r-v3-008-tofu-croustillant-brocoli-et-riz": Object.freeze({ kcal: 541.0, protein: 23.3, carbs: 67.2, sugars: 2.9, fat: 17.6, saturates: 2.1, fibre: 4.8, salt: 1.81, status: 'estimated_logic' }),
      "r-v3-009-aubergines-roties-au-quinoa-et-a-la-feta": Object.freeze({ kcal: 469.0, protein: 15.5, carbs: 43.4, sugars: 8.6, fat: 22.9, saturates: 8.0, fibre: 10.3, salt: 1.03, status: 'estimated_logic' }),
      "r-v3-010-patates-douces-roties-aux-haricots-noirs": Object.freeze({ kcal: 345.0, protein: 13.8, carbs: 53.7, sugars: 5.5, fat: 6.0, saturates: 1.3, fibre: 12.3, salt: 0.73, status: 'estimated_logic' }),
      "r-v3-011-chou-fleur-roti-au-curry-et-pois-chiches": Object.freeze({ kcal: 399.0, protein: 12.8, carbs: 26.2, sugars: 7.9, fat: 24.3, saturates: 10.1, fibre: 13.3, salt: 0.85, status: 'estimated_logic' }),
      "r-v3-012-mijote-de-lentilles-carottes-et-tomate": Object.freeze({ kcal: 382.0, protein: 21.9, carbs: 46.0, sugars: 7.0, fat: 8.3, saturates: 1.2, fibre: 17.8, salt: 0.35, status: 'estimated_logic' }),
      "r-v3-014-couscous-de-legumes-aux-pois-chiches": Object.freeze({ kcal: 516.0, protein: 17.4, carbs: 74.2, sugars: 8.4, fat: 13.8, saturates: 2.1, fibre: 12.4, salt: 0.78, status: 'estimated_logic' }),
      "r-v3-015-gratin-de-haricots-blancs-a-la-tomate": Object.freeze({ kcal: 360.0, protein: 13.2, carbs: 38.5, sugars: 5.1, fat: 12.0, saturates: 2.0, fibre: 22.4, salt: 0.45, status: 'estimated_logic' }),
      "r-v3-016-flan-de-courgettes-a-la-feta": Object.freeze({ kcal: 302.0, protein: 16.6, carbs: 16.4, sugars: 5.3, fat: 18.3, saturates: 8.4, fibre: 2.1, salt: 1.22, status: 'estimated_logic' }),
      "r-v3-018-poulet-basquaise-et-riz": Object.freeze({ kcal: 561.0, protein: 44.3, carbs: 69.1, sugars: 6.8, fat: 9.9, saturates: 1.9, fibre: 7.8, salt: 0.5, status: 'estimated_logic' }),
      "r-v3-019-curry-de-poulet-carottes-et-petits-pois": Object.freeze({ kcal: 656.0, protein: 44.8, carbs: 67.0, sugars: 7.2, fat: 21.1, saturates: 13.9, fibre: 6.6, salt: 0.5, status: 'estimated_logic' }),
      "r-v3-020-poulet-a-la-moutarde-et-aux-champignons": Object.freeze({ kcal: 380.0, protein: 41.9, carbs: 6.1, sugars: 2.4, fat: 20.0, saturates: 9.9, fibre: 2.7, salt: 0.52, status: 'estimated_logic' }),
      "r-v3-021-boulettes-de-dinde-tomate-et-polenta": Object.freeze({ kcal: 558.0, protein: 44.2, carbs: 64.1, sugars: 4.9, fat: 12.4, saturates: 2.4, fibre: 6.5, salt: 0.9, status: 'estimated_logic' }),
      "r-v3-022-nouilles-sautees-a-la-dinde-et-aux-legumes": Object.freeze({ kcal: 514.0, protein: 43.2, carbs: 56.3, sugars: 3.0, fat: 11.4, saturates: 1.7, fibre: 4.7, salt: 2.85, status: 'estimated_logic' }),
      "r-v3-023-couscous-de-poulet-aux-legumes": Object.freeze({ kcal: 676.0, protein: 47.7, carbs: 70.2, sugars: 7.4, fat: 20.0, saturates: 3.8, fibre: 10.6, salt: 1.06, status: 'estimated_logic' }),
      "r-v3-024-poulet-cremeux-au-paprika-haricots-verts-et-riz": Object.freeze({ kcal: 614.0, protein: 43.3, carbs: 60.8, sugars: 4.1, fat: 20.1, saturates: 9.9, fibre: 4.8, salt: 0.43, status: 'estimated_logic' }),
      "r-v3-025-soupe-de-poulet-aux-poireaux-et-petites-pates": Object.freeze({ kcal: 351.0, protein: 33.1, carbs: 37.1, sugars: 6.8, fat: 6.0, saturates: 1.2, fibre: 4.9, salt: 0.47, status: 'estimated_logic' }),
      "r-v3-026-poivrons-farcis-a-la-dinde-courgette-et-riz": Object.freeze({ kcal: 454.0, protein: 35.5, carbs: 51.5, sugars: 10.8, fat: 9.8, saturates: 1.7, fibre: 8.8, salt: 0.64, status: 'estimated_logic' }),
      "r-v3-027-gratin-de-saumon-poireaux-et-pommes-de-terre": Object.freeze({ kcal: 682.0, protein: 37.3, carbs: 35.5, sugars: 7.2, fat: 40.8, saturates: 19.1, fibre: 6.6, salt: 0.62, status: 'estimated_logic' }),
      "r-v3-028-cabillaud-au-four-tomate-courgette-et-olives": Object.freeze({ kcal: 159.0, protein: 3.7, carbs: 9.4, sugars: 5.2, fat: 10.7, saturates: 1.6, fibre: 5.5, salt: 0.65, status: 'estimated_logic' }),
      "r-v3-029-penne-au-thon-tomate-citron-et-capres": Object.freeze({ kcal: 542.0, protein: 31.7, carbs: 72.0, sugars: 5.8, fat: 11.2, saturates: 2.1, fibre: 5.5, salt: 1.11, status: 'estimated_logic' }),
      "r-v3-030-salade-de-haricots-blancs-sardines-et-tomate": Object.freeze({ kcal: 389.0, protein: 22.2, carbs: 19.4, sugars: 6.0, fat: 20.7, saturates: 4.3, fibre: 15.9, salt: 0.38, status: 'estimated_logic' }),
      "r-v3-031-colin-au-curry-coco-epinards-et-riz": Object.freeze({ kcal: 569.0, protein: 32.8, carbs: 61.8, sugars: 2.5, fat: 19.8, saturates: 13.3, fibre: 4.7, salt: 1.09, status: 'estimated_logic' }),
      "r-v3-032-truite-aux-amandes-pommes-de-terre-et-haricots-verts": Object.freeze({ kcal: 509.0, protein: 36.4, carbs: 29.4, sugars: 4.8, fat: 24.9, saturates: 6.7, fibre: 6.9, salt: 0.37, status: 'estimated_logic' }),
      "r-v3-033-parmentier-de-poisson-aux-carottes-et-petits-pois": Object.freeze({ kcal: 532.0, protein: 40.2, carbs: 54.7, sugars: 9.0, fat: 14.1, saturates: 6.4, fibre: 9.2, salt: 0.82, status: 'estimated_logic' }),
      "r-v3-034-riz-saute-aux-crevettes-petits-pois-et-citron": Object.freeze({ kcal: 483.0, protein: 30.6, carbs: 67.3, sugars: 3.0, fat: 8.6, saturates: 0.9, fibre: 4.8, salt: 0.74, status: 'estimated_logic' }),
      "r-v3-035-maquereau-roti-au-fenouil-et-a-l-orange": Object.freeze({ kcal: 526.0, protein: 33.7, carbs: 21.4, sugars: 7.5, fat: 31.8, saturates: 6.7, fibre: 13.6, salt: 0.49, status: 'estimated_logic' }),
      "r-v3-036-mijote-de-boeuf-aux-carottes-et-pommes-de-terre": Object.freeze({ kcal: 528.0, protein: 29.4, carbs: 43.0, sugars: 9.4, fat: 24.6, saturates: 6.0, fibre: 9.5, salt: 0.96, status: 'estimated_logic' }),
      "r-v3-037-keftas-de-boeuf-boulgour-et-courgettes": Object.freeze({ kcal: 574.0, protein: 31.1, carbs: 53.6, sugars: 5.7, fat: 24.0, saturates: 6.4, fibre: 9.2, salt: 0.84, status: 'estimated_logic' }),
      "r-v3-038-filet-mignon-de-porc-aux-pommes-et-moutarde": Object.freeze({ kcal: 464.0, protein: 38.9, carbs: 41.4, sugars: 9.5, fat: 14.2, saturates: 3.4, fibre: 6.7, salt: 0.39, status: 'estimated_logic' }),
      "r-v3-039-cocotte-de-boeuf-hache-et-lentilles": Object.freeze({ kcal: 439.0, protein: 31.2, carbs: 38.9, sugars: 7.4, fat: 14.6, saturates: 3.5, fibre: 14.9, salt: 0.69, status: 'estimated_logic' }),
      "r-v3-040-hachis-parmentier-aux-carottes": Object.freeze({ kcal: 564.0, protein: 28.7, carbs: 49.5, sugars: 10.9, fat: 25.9, saturates: 10.0, fibre: 9.1, salt: 0.84, status: 'estimated_logic' }),
      "r-v3-041-blanquette-de-veau-aux-champignons-et-riz": Object.freeze({ kcal: 895.0, protein: 46.3, carbs: 65.4, sugars: 4.7, fat: 47.2, saturates: 23.7, fibre: 4.4, salt: 0.58, status: 'estimated_logic' }),
      "r-v3-042-boeuf-saute-aux-poivrons-et-riz": Object.freeze({ kcal: 544.0, protein: 25.2, carbs: 62.1, sugars: 4.4, fat: 21.4, saturates: 4.9, fibre: 4.3, salt: 2.21, status: 'estimated_logic' }),
      "r-v3-043-cotelettes-de-porc-aux-haricots-blancs-et-tomate": Object.freeze({ kcal: 620.0, protein: 40.5, carbs: 22.2, sugars: 3.4, fat: 35.3, saturates: 10.4, fibre: 20.3, salt: 0.44, status: 'estimated_logic' }),
      "r-v3-044-spaghetti-a-la-courgette-tomate-et-ricotta": Object.freeze({ kcal: 508.0, protein: 17.4, carbs: 74.6, sugars: 8.7, fat: 13.5, saturates: 4.8, fibre: 6.0, salt: 0.41, status: 'estimated_logic' }),
      "r-v3-045-pates-au-brocoli-citron-et-parmesan": Object.freeze({ kcal: 579.0, protein: 22.9, carbs: 71.5, sugars: 5.2, fat: 19.3, saturates: 6.6, fibre: 7.3, salt: 0.68, status: 'estimated_logic' }),
      "r-v3-046-one-pot-pasta-aux-champignons-et-epinards": Object.freeze({ kcal: 564.0, protein: 19.6, carbs: 69.3, sugars: 4.5, fat: 21.1, saturates: 11.3, fibre: 5.8, salt: 0.65, status: 'estimated_logic' }),
      "r-v3-048-gnocchi-poeles-tomate-et-mozzarella": Object.freeze({ kcal: 507.0, protein: 17.0, carbs: 69.2, sugars: 9.2, fat: 16.5, saturates: 6.3, fibre: 7.1, salt: 2.57, status: 'estimated_logic' }),
      "r-v3-049-riz-saute-aux-oeufs-et-petits-legumes": Object.freeze({ kcal: 610.0, protein: 29.9, carbs: 65.2, sugars: 4.4, fat: 23.8, saturates: 6.5, fibre: 4.6, salt: 1.47, status: 'estimated_logic' }),
      "r-v3-050-risotto-tomate-et-petits-pois-au-parmesan": Object.freeze({ kcal: 503.0, protein: 15.5, carbs: 71.8, sugars: 5.1, fat: 15.7, saturates: 8.6, fibre: 5.5, salt: 0.59, status: 'estimated_logic' }),
      "r-v3-051-veloute-de-poireaux-et-pommes-de-terre": Object.freeze({ kcal: 225.0, protein: 7.4, carbs: 32.3, sugars: 10.4, fat: 5.7, saturates: 3.7, fibre: 6.3, salt: 0.35, status: 'estimated_logic' }),
      "r-v3-052-soupe-de-courge-et-lentilles-corail": Object.freeze({ kcal: 351.0, protein: 15.8, carbs: 35.0, sugars: 6.3, fat: 13.7, saturates: 8.9, fibre: 12.1, salt: 0.27, status: 'estimated_logic' }),
      "r-v3-054-veloute-de-carottes-gingembre-et-coco": Object.freeze({ kcal: 213.0, protein: 3.0, carbs: 14.5, sugars: 11.2, fat: 14.2, saturates: 9.7, fibre: 7.0, salt: 0.49, status: 'estimated_logic' }),
      "r-v3-055-soupe-a-l-oignon-gratinee-au-comte": Object.freeze({ kcal: 497.0, protein: 19.6, carbs: 53.0, sugars: 2.5, fat: 20.8, saturates: 13.5, fibre: 8.8, salt: 1.5, status: 'estimated_logic' }),
      "r-v3-056-salade-de-lentilles-betterave-et-chevre": Object.freeze({ kcal: 478.0, protein: 26.5, carbs: 39.7, sugars: 7.8, fat: 20.5, saturates: 7.6, fibre: 14.9, salt: 0.94, status: 'estimated_logic' }),
      "r-v3-058-salade-de-riz-au-thon-mais-et-oeufs": Object.freeze({ kcal: 559.0, protein: 29.1, carbs: 65.4, sugars: 3.6, fat: 18.9, saturates: 3.7, fibre: 3.3, salt: 1.09, status: 'estimated_logic' }),
      "r-v3-059-salade-tiede-de-pommes-de-terre-haricots-verts-et-oeufs": Object.freeze({ kcal: 383.0, protein: 13.4, carbs: 37.6, sugars: 5.6, fat: 17.1, saturates: 3.3, fibre: 7.7, salt: 0.43, status: 'estimated_logic' }),
      "r-v3-060-salade-de-boulgour-aux-legumes-rotis-et-feta": Object.freeze({ kcal: 568.0, protein: 20.3, carbs: 64.1, sugars: 8.0, fat: 21.8, saturates: 7.9, fibre: 14.0, salt: 1.38, status: 'estimated_logic' }),
      "r-v3-095-quiche-aux-poireaux": Object.freeze({ kcal: 287.0, protein: 11.0, carbs: 10.5, sugars: 3.9, fat: 22.0, saturates: 13.0, fibre: 1.7, salt: 0.26, status: 'estimated_logic' }),
      "r-v3-096-tarte-tomate-moutarde": Object.freeze({ kcal: 116.0, protein: 6.3, carbs: 11.1, sugars: 3.2, fat: 5.1, saturates: 3.1, fibre: 2.0, salt: 0.12, status: 'estimated_logic' }),
      "r-v3-101-boudin-noir-aux-pommes": Object.freeze({ kcal: 277.0, protein: 8.7, carbs: 20.0, sugars: 16.2, fat: 16.6, saturates: 7.8, fibre: 2.8, salt: 1.11, status: 'estimated_logic' }),
      "r-v3-103-cordon-bleu-maison": Object.freeze({ kcal: 578.0, protein: 56.8, carbs: 33.6, sugars: 1.6, fat: 22.0, saturates: 9.3, fibre: 2.2, salt: 1.38, status: 'estimated_logic' }),
      "r-v3-105-crepes-salees-jambon-fromage": Object.freeze({ kcal: 525.0, protein: 31.2, carbs: 52.6, sugars: 7.2, fat: 20.3, saturates: 11.3, fibre: 2.1, salt: 1.16, status: 'estimated_logic' }),
      "r-v3-106-croziflette": Object.freeze({ kcal: 711.0, protein: 30.5, carbs: 64.3, sugars: 1.8, fat: 36.9, saturates: 22.1, fibre: 3.5, salt: 1.95, status: 'estimated_logic' }),
      "r-v3-107-endives-au-jambon": Object.freeze({ kcal: 323.0, protein: 21.3, carbs: 16.4, sugars: 7.4, fat: 19.0, saturates: 12.3, fibre: 1.9, salt: 1.06, status: 'estimated_logic' }),
      "r-v3-108-tomates-farcies": Object.freeze({ kcal: 189.0, protein: 13.0, carbs: 14.5, sugars: 4.5, fat: 8.5, saturates: 2.6, fibre: 2.6, salt: 0.38, status: 'estimated_logic' }),
      "r-v3-121-burrito-haricots-rouges-et-riz": Object.freeze({ kcal: 568.0, protein: 24.1, carbs: 81.6, sugars: 3.6, fat: 12.6, saturates: 5.9, fibre: 15.0, salt: 1.15, status: 'estimated_logic' }),
      "r-v3-125-nouilles-teriyaki-aux-legumes": Object.freeze({ kcal: 360.0, protein: 12.6, carbs: 65.0, sugars: 2.5, fat: 3.9, saturates: 1.0, fibre: 5.3, salt: 2.89, status: 'estimated_logic' }),
      "r-v3-139-porridge-banane-et-cannelle": Object.freeze({ kcal: 343.0, protein: 12.1, carbs: 54.8, sugars: 23.6, fat: 6.6, saturates: 2.4, fibre: 7.8, salt: 0.16, status: 'estimated_logic' }),
      "r-v3-148-riz-au-lait": Object.freeze({ kcal: 251.0, protein: 7.9, carbs: 48.2, sugars: 24.8, fat: 2.8, saturates: 1.7, fibre: 0.5, salt: 0.21, status: 'estimated_logic' }),
      "r-v3-150-clafoutis-aux-cerises": Object.freeze({ kcal: 216.0, protein: 6.9, carbs: 35.8, sugars: 22.7, fat: 4.9, saturates: 2.3, fibre: 1.7, salt: 0.12, status: 'estimated_logic' }),
      "r-v3-165-merlu-en-papillote-aux-petits-legumes": Object.freeze({ kcal: 218.0, protein: 20.5, carbs: 8.0, sugars: 5.2, fat: 10.2, saturates: 1.9, fibre: 3.1, salt: 1.99, status: 'estimated_logic' }),
      "r-v3-167-poivrons-farcis-au-boeuf-et-au-riz": Object.freeze({ kcal: 551.0, protein: 23.4, carbs: 67.4, sugars: 7.8, fat: 20.2, saturates: 5.1, fibre: 5.0, salt: 1.73, status: 'estimated_logic' }),
      "r-v3-168-moussaka-vegetarienne-aux-lentilles": Object.freeze({ kcal: 420.0, protein: 22.8, carbs: 41.1, sugars: 7.6, fat: 14.5, saturates: 5.2, fibre: 16.1, salt: 1.34, status: 'estimated_logic' }),
      "r-v3-170-gratin-de-ravioles-aux-courgettes": Object.freeze({ kcal: 771.0, protein: 32.1, carbs: 30.5, sugars: 5.2, fat: 57.0, saturates: 33.7, fibre: 2.5, salt: 2.59, status: 'estimated_logic' }),
      "r-v3-172-gateau-au-yaourt-et-citron": Object.freeze({ kcal: 367.0, protein: 5.9, carbs: 80.5, sugars: 47.6, fat: 1.2, saturates: 0.6, fibre: 1.4, salt: 1.27, status: 'estimated_logic' }),
      "r-v3-173-fondant-au-chocolat": Object.freeze({ kcal: 823.0, protein: 9.4, carbs: 69.1, sugars: 66.0, fat: 55.6, saturates: 36.9, fibre: 3.7, salt: 1.41, status: 'estimated_logic' }),
      "r-v3-174-brownies-aux-noix": Object.freeze({ kcal: 1050.0, protein: 13.0, carbs: 60.4, sugars: 23.2, fat: 81.4, saturates: 38.5, fibre: 8.2, salt: 1.25, status: 'estimated_logic' }),
      "r-v3-175-banana-bread": Object.freeze({ kcal: 457.0, protein: 11.2, carbs: 89.2, sugars: 53.7, fat: 5.4, saturates: 1.4, fibre: 3.1, salt: 1.41, status: 'estimated_logic' }),
      "r-v3-176-carrot-cake-simplifie": Object.freeze({ kcal: 560.0, protein: 16.8, carbs: 38.6, sugars: 4.2, fat: 35.6, saturates: 4.3, fibre: 5.8, salt: 1.43, status: 'estimated_logic' }),
      "r-v3-177-madeleines-au-citron": Object.freeze({ kcal: 574.0, protein: 10.8, carbs: 34.0, sugars: 1.3, fat: 42.7, saturates: 28.4, fibre: 1.4, salt: 1.39, status: 'estimated_logic' }),
      "r-v3-178-financiers-aux-amandes": Object.freeze({ kcal: 824.0, protein: 14.8, carbs: 49.5, sugars: 47.6, fat: 61.1, saturates: 28.8, fibre: 4.5, salt: 1.45, status: 'estimated_logic' }),
      "r-v3-179-chouquettes-maison": Object.freeze({ kcal: 746.0, protein: 10.8, carbs: 78.4, sugars: 45.9, fat: 42.7, saturates: 28.4, fibre: 1.4, salt: 1.4, status: 'estimated_logic' }),
      "r-v3-180-flan-patissier": Object.freeze({ kcal: 463.0, protein: 9.2, carbs: 89.3, sugars: 48.2, fat: 7.6, saturates: 3.0, fibre: 0.4, salt: 1.48, status: 'estimated_logic' }),
      "r-v3-181-far-breton-aux-pruneaux": Object.freeze({ kcal: 380.0, protein: 13.8, carbs: 61.8, sugars: 21.2, fat: 8.2, saturates: 3.1, fibre: 3.7, salt: 1.47, status: 'estimated_logic' }),
      "r-v3-182-gateau-aux-poires": Object.freeze({ kcal: 612.0, protein: 11.0, carbs: 43.4, sugars: 8.8, fat: 42.9, saturates: 28.5, fibre: 3.8, salt: 1.4, status: 'estimated_logic' }),
      "r-v3-183-moelleux-aux-pommes-et-cannelle": Object.freeze({ kcal: 269.0, protein: 10.7, carbs: 42.0, sugars: 8.7, fat: 5.6, saturates: 1.4, fibre: 2.8, salt: 1.38, status: 'estimated_logic' }),
      "r-v3-187-semoule-au-lait-a-la-vanille": Object.freeze({ kcal: 494.0, protein: 8.0, carbs: 81.1, sugars: 50.0, fat: 3.3, saturates: 2.2, fibre: 1.7, salt: 1.32, status: 'estimated_logic' }),
      "r-v3-431-beignets-de-pommes": Object.freeze({ kcal: 769.0, protein: 5.9, carbs: 67.7, sugars: 43.4, fat: 51.1, saturates: 8.1, fibre: 4.8, salt: 0.56, status: 'estimated_logic' }),
      "r-v3-538-biscuits-de-saint-nicolas": Object.freeze({ kcal: 487.0, protein: 5.1, carbs: 54.8, sugars: 20.4, fat: 27.0, saturates: 19.2, fibre: 1.8, salt: 0.03, status: 'estimated_logic' }),
      "r-v3-543-bretzels-sucres": Object.freeze({ kcal: 689.0, protein: 12.0, carbs: 96.5, sugars: 33.0, fat: 28.0, saturates: 18.5, fibre: 4.9, salt: 0.23, status: 'estimated_logic' }),
      "r-v3-545-bugnes-lyonnaises": Object.freeze({ kcal: 556.0, protein: 6.1, carbs: 48.6, sugars: 16.4, fat: 37.1, saturates: 9.5, fibre: 1.7, salt: 0.06, status: 'estimated_logic' }),
      "r-v3-506-batonnets-de-poisson-en-croute-de-noix-de-coco": Object.freeze({ kcal: 257.0, protein: 5.4, carbs: 7.3, sugars: 2.4, fat: 22.0, saturates: 9.7, fibre: 2.9, salt: 0.99, status: 'estimated_logic' }),
      "r-v3-427-charlotte-aux-poires": Object.freeze({ kcal: 1161.0, protein: 13.6, carbs: 170.9, sugars: 117.4, fat: 45.0, saturates: 25.0, fibre: 4.8, salt: 1.12, status: 'estimated_logic' }),
      "r-v3-500-poulet-au-miso-gingembre-et-citron-vert": Object.freeze({ kcal: 493.0, protein: 36.0, carbs: 10.5, sugars: 4.6, fat: 31.7, saturates: 10.9, fibre: 1.6, salt: 0.56, status: 'estimated_logic' }),
      "r-v3-526-creme-passion-banane": Object.freeze({ kcal: 472.0, protein: 10.2, carbs: 32.9, sugars: 27.9, fat: 32.8, saturates: 20.3, fibre: 1.5, salt: 0.3, status: 'estimated_logic' }),
      "r-v3-327-crepes-farcies-facon-ficelles-picarde": Object.freeze({ kcal: 1046.0, protein: 33.9, carbs: 43.6, sugars: 9.7, fat: 80.6, saturates: 35.9, fibre: 5.8, salt: 2.29, status: 'estimated_logic' }),
      "r-v3-348-filets-de-barbue-duglere": Object.freeze({ kcal: 240.0, protein: 32.7, carbs: 7.0, sugars: 2.9, fat: 7.7, saturates: 3.9, fibre: 3.3, salt: 1.7, status: 'estimated_logic' }),
      "r-v3-347-filets-de-sole-dieppoise": Object.freeze({ kcal: 663.0, protein: 52.5, carbs: 10.0, sugars: 4.9, fat: 42.6, saturates: 27.6, fibre: 1.6, salt: 2.19, status: 'estimated_logic' }),
      "r-v3-390-foie-de-veau-a-l-anglaise": Object.freeze({ kcal: 587.0, protein: 36.3, carbs: 9.4, sugars: 0.3, fat: 43.7, saturates: 22.5, fibre: 0.6, salt: 0.38, status: 'estimated_logic' }),
      "r-v3-491-gnocchis-a-la-romaine": Object.freeze({ kcal: 269.0, protein: 16.6, carbs: 7.1, sugars: 6.3, fat: 19.5, saturates: 12.8, fibre: 0.1, salt: 1.21, status: 'estimated_logic' }),
      "r-v3-464-gombo-rapide-avec-vinaigrette-aigre-douce": Object.freeze({ kcal: 261.0, protein: 6.9, carbs: 16.8, sugars: 6.8, fat: 17.8, saturates: 2.6, fibre: 6.5, salt: 1.46, status: 'estimated_logic' }),
      "r-v3-447-gratinee-d-automne-au-calvados": Object.freeze({ kcal: 1052.0, protein: 12.1, carbs: 136.0, sugars: 122.8, fat: 48.3, saturates: 26.1, fibre: 6.3, salt: 0.26, status: 'estimated_logic' }),
      "r-v3-357-moules-mariniere": Object.freeze({ kcal: 451.0, protein: 60.6, carbs: 4.7, sugars: 0.6, fat: 19.7, saturates: 12.6, fibre: 0.6, salt: 1.85, status: 'estimated_logic' }),
      "r-v3-335-oeufs-cocotte-c-la-creme": Object.freeze({ kcal: 333.0, protein: 14.4, carbs: 2.9, sugars: 2.7, fat: 29.2, saturates: 16.1, fibre: 0.2, salt: 0.55, status: 'estimated_logic' }),
      "r-v3-337-oeufs-frits-au-bacon": Object.freeze({ kcal: 555.0, protein: 23.9, carbs: 32.6, sugars: 5.1, fat: 35.8, saturates: 8.8, fibre: 2.0, salt: 2.0, status: 'estimated_logic' }),
      "r-v3-448-omelette-harissa-et-manchego": Object.freeze({ kcal: 546.0, protein: 28.9, carbs: 6.8, sugars: 5.4, fat: 45.9, saturates: 14.1, fibre: 0.9, salt: 1.01, status: 'estimated_logic' }),
      "r-v3-544-petits-pains-au-lait": Object.freeze({ kcal: 495.0, protein: 7.9, carbs: 56.7, sugars: 10.0, fat: 25.9, saturates: 18.0, fibre: 2.6, salt: 1.32, status: 'estimated_logic' }),
      "r-v3-505-poisson-chili-au-tahini": Object.freeze({ kcal: 636.0, protein: 19.8, carbs: 53.3, sugars: 12.3, fat: 32.0, saturates: 5.2, fibre: 14.8, salt: 0.89, status: 'estimated_logic' }),
      "r-v3-518-rouleaux-au-nutella-sesame-et-noisettes": Object.freeze({ kcal: 533.0, protein: 9.1, carbs: 52.6, sugars: 18.9, fat: 31.5, saturates: 10.7, fibre: 5.6, salt: 0.37, status: 'estimated_logic' }),
      "r-v3-552-roules-aux-figues": Object.freeze({ kcal: 490.0, protein: 9.9, carbs: 89.9, sugars: 27.8, fat: 10.8, saturates: 6.4, fibre: 5.9, salt: 0.08, status: 'estimated_logic' }),
      "r-v3-352-soles-colbert": Object.freeze({ kcal: 1269.0, protein: 59.6, carbs: 44.2, sugars: 5.7, fat: 94.3, saturates: 27.7, fibre: 3.9, salt: 1.77, status: 'estimated_logic' }),
      "r-v3-418-spaghettis-au-beurre": Object.freeze({ kcal: 359.0, protein: 8.5, carbs: 59.3, sugars: 1.3, fat: 9.9, saturates: 6.3, fibre: 2.4, salt: 0.09, status: 'estimated_logic' }),
      "r-v3-371-steaks-au-poivre": Object.freeze({ kcal: 573.0, protein: 35.7, carbs: 6.1, sugars: 1.0, fat: 43.1, saturates: 19.5, fibre: 2.7, salt: 1.68, status: 'estimated_logic' }),
      "r-v3-459-tomates-de-b-uf-grillees-au-piment-ail-et-gingembre": Object.freeze({ kcal: 352.0, protein: 10.9, carbs: 32.3, sugars: 6.4, fat: 18.6, saturates: 2.8, fibre: 13.6, salt: 2.12, status: 'estimated_logic' }),
      "r-v3-473-courge-musquee-rotie-aux-lentilles-et-dolcelatte": Object.freeze({ kcal: 254.0, protein: 10.4, carbs: 23.0, sugars: 6.7, fat: 11.8, saturates: 3.8, fibre: 8.3, salt: 1.15, status: 'estimated_logic' }),
      "r-v3-468-pois-chiches-et-blettes-au-yaourt": Object.freeze({ kcal: 542.0, protein: 21.7, carbs: 54.9, sugars: 11.2, fat: 25.5, saturates: 4.3, fibre: 19.9, salt: 2.25, status: 'estimated_logic' }),
      "r-v3-494-agneau-au-four-avec-sauce-tahini-et-tomates": Object.freeze({ kcal: 679.0, protein: 40.3, carbs: 20.2, sugars: 5.5, fat: 45.5, saturates: 15.0, fibre: 7.0, salt: 2.7, status: 'estimated_logic' }),
      "r-v3-386-aiguillette-de-boeuf-braisee-bourgeoise": Object.freeze({ kcal: 1511.0, protein: 101.2, carbs: 21.6, sugars: 11.8, fat: 99.7, saturates: 36.2, fibre: 6.6, salt: 5.85, status: 'estimated_logic' }),
      "r-v3-321-allumettes-au-fromage": Object.freeze({ kcal: 689.0, protein: 17.7, carbs: 49.0, sugars: 2.2, fat: 47.6, saturates: 29.4, fibre: 2.3, salt: 0.65, status: 'estimated_logic' }),
      "r-v3-318-avocats-aux-crevettes": Object.freeze({ kcal: 481.0, protein: 17.9, carbs: 22.5, sugars: 5.5, fat: 31.6, saturates: 5.3, fibre: 3.5, salt: 0.95, status: 'estimated_logic' }),
      "r-v3-428-bavarois-rubanne": Object.freeze({ kcal: 299.0, protein: 6.1, carbs: 23.3, sugars: 22.5, fat: 19.8, saturates: 12.2, fibre: 0.1, salt: 0.15, status: 'estimated_logic' }),
      "r-v3-540-biscuits-a-l-anis": Object.freeze({ kcal: 564.0, protein: 11.3, carbs: 109.6, sugars: 64.0, fat: 8.3, saturates: 3.0, fibre: 2.3, salt: 0.14, status: 'estimated_logic' }),
      "r-v3-496-boulettes-de-viande-a-la-ricotta-et-a-l-origan": Object.freeze({ kcal: 619.0, protein: 32.3, carbs: 22.1, sugars: 8.4, fat: 42.4, saturates: 14.7, fibre: 4.7, salt: 3.89, status: 'estimated_logic' }),
      "r-v3-486-boulgour-aux-champignons-et-feta": Object.freeze({ kcal: 2155.0, protein: 63.5, carbs: 97.1, sugars: 11.5, fat: 165.1, saturates: 22.5, fibre: 23.1, salt: 0.99, status: 'estimated_logic' }),
      "r-v3-535-brownies-cafe-marron": Object.freeze({ kcal: 548.0, protein: 9.4, carbs: 37.6, sugars: 23.3, fat: 39.0, saturates: 22.2, fibre: 3.6, salt: 0.14, status: 'estimated_logic' }),
      "r-v3-400-canetons-aux-navets": Object.freeze({ kcal: 317.0, protein: 16.4, carbs: 21.9, sugars: 9.9, fat: 15.6, saturates: 8.1, fibre: 10.3, salt: 4.73, status: 'estimated_logic' }),
      "r-v3-401-canetons-a-l-orange": Object.freeze({ kcal: 294.0, protein: 10.9, carbs: 42.4, sugars: 31.2, fat: 7.9, saturates: 2.8, fibre: 6.3, salt: 2.32, status: 'estimated_logic' }),
      "r-v3-553-canneles-aux-poires": Object.freeze({ kcal: 286.0, protein: 5.2, carbs: 46.0, sugars: 34.4, fat: 8.9, saturates: 5.6, fibre: 0.7, salt: 0.21, status: 'estimated_logic' }),
      "r-v3-409-cari-de-poulet": Object.freeze({ kcal: 688.0, protein: 79.9, carbs: 9.5, sugars: 4.5, fat: 33.3, saturates: 7.9, fibre: 4.3, salt: 1.79, status: 'estimated_logic' }),
      "r-v3-365-carre-d-agneau-aux-primeurs": Object.freeze({ kcal: 1227.0, protein: 82.3, carbs: 33.9, sugars: 16.7, fat: 81.9, saturates: 37.2, fibre: 9.5, salt: 3.06, status: 'estimated_logic' }),
      "r-v3-530-carres-florentins": Object.freeze({ kcal: 388.0, protein: 5.4, carbs: 35.0, sugars: 31.0, fat: 25.0, saturates: 10.3, fibre: 2.5, salt: 0.03, status: 'estimated_logic' }),
      "r-v3-450-champignons-portobello-brioches-et-uf-poche": Object.freeze({ kcal: 498.0, protein: 11.0, carbs: 23.6, sugars: 4.0, fat: 31.3, saturates: 9.5, fibre: 1.9, salt: 1.91, status: 'estimated_logic' }),
      "r-v3-406-civets-de-lievre-a-la-francaise": Object.freeze({ kcal: 1606.0, protein: 80.1, carbs: 59.6, sugars: 24.1, fat: 91.0, saturates: 32.5, fibre: 8.3, salt: 5.85, status: 'estimated_logic' }),
      "r-v3-536-confiture-de-noel": Object.freeze({ kcal: 329.0, protein: 1.3, carbs: 74.0, sugars: 70.6, fat: 3.3, saturates: 0.3, fibre: 2.6, salt: 0.02, status: 'estimated_logic' }),
      "r-v3-369-contre-filets-entrecotes-ou-steacks-sautes-bercy": Object.freeze({ kcal: 351.0, protein: 20.1, carbs: 3.6, sugars: 2.2, fat: 28.1, saturates: 11.5, fibre: 0.4, salt: 2.27, status: 'estimated_logic' }),
      "r-v3-359-coquilles-saint-jacques-au-gratin": Object.freeze({ kcal: 474.0, protein: 5.0, carbs: 9.2, sugars: 5.0, fat: 42.2, saturates: 28.8, fibre: 2.2, salt: 0.51, status: 'estimated_logic' }),
      "r-v3-474-courge-musquee-avec-salsa-de-mais-doux-feta-et-graines-": Object.freeze({ kcal: 1684.0, protein: 53.2, carbs: 41.2, sugars: 8.4, fat: 141.9, saturates: 16.1, fibre: 20.9, salt: 1.3, status: 'estimated_logic' }),
      "r-v3-542-couronne-de-l-avent": Object.freeze({ kcal: 501.0, protein: 5.5, carbs: 51.3, sugars: 12.9, fat: 29.7, saturates: 19.0, fibre: 2.5, salt: 0.05, status: 'estimated_logic' }),
      "r-v3-433-crepes-au-sucre": Object.freeze({ kcal: 285.0, protein: 7.5, carbs: 36.3, sugars: 13.5, fat: 11.9, saturates: 6.0, fibre: 1.0, salt: 0.39, status: 'estimated_logic' }),
      "r-v3-376-cotes-d-agneau-marechale": Object.freeze({ kcal: 1194.0, protein: 70.8, carbs: 43.8, sugars: 6.2, fat: 79.7, saturates: 33.3, fibre: 8.2, salt: 2.45, status: 'estimated_logic' }),
      "r-v3-382-cotes-d-agneau-vert-pre": Object.freeze({ kcal: 2032.0, protein: 68.6, carbs: 149.6, sugars: 3.7, fat: 125.6, saturates: 39.0, fibre: 7.1, salt: 0.73, status: 'estimated_logic' }),
      "r-v3-341-darnes-de-colin-pochees-beurre-fondu": Object.freeze({ kcal: 397.0, protein: 40.6, carbs: 4.2, sugars: 3.0, fat: 24.4, saturates: 13.8, fibre: 0.9, salt: 0.75, status: 'estimated_logic' }),
      "r-v3-355-duo-de-cabillaud-et-de-morue-puree-de-pommes-de-terre-a": Object.freeze({ kcal: 974.0, protein: 44.4, carbs: 29.8, sugars: 21.0, fat: 75.3, saturates: 30.9, fibre: 5.8, salt: 1.72, status: 'estimated_logic' }),
      "r-v3-501-escalope-de-poulet-aux-graines": Object.freeze({ kcal: 1160.0, protein: 45.0, carbs: 19.7, sugars: 3.5, fat: 97.9, saturates: 15.5, fibre: 3.9, salt: 1.54, status: 'estimated_logic' }),
      "r-v3-375-escalopes-de-veau-viennoise": Object.freeze({ kcal: 1329.0, protein: 40.8, carbs: 44.2, sugars: 5.3, fat: 107.0, saturates: 29.9, fibre: 4.0, salt: 1.22, status: 'estimated_logic' }),
      "r-v3-373-escalopes-ou-cotes-de-veau-a-la-creme": Object.freeze({ kcal: 687.0, protein: 33.5, carbs: 10.6, sugars: 2.9, fat: 54.0, saturates: 30.6, fibre: 0.9, salt: 1.73, status: 'estimated_logic' }),
      "r-v3-443-feuillantine-aux-framboises-creme-legere-a-la-pistache": Object.freeze({ kcal: 1096.0, protein: 15.5, carbs: 98.1, sugars: 88.9, fat: 71.3, saturates: 34.9, fibre: 6.1, salt: 0.27, status: 'estimated_logic' }),
      "r-v3-493-filet-d-agneau-grille-aux-amandes-et-fleur-d-oranger": Object.freeze({ kcal: 899.0, protein: 42.7, carbs: 19.3, sugars: 8.4, fat: 69.3, saturates: 16.1, fibre: 6.3, salt: 1.93, status: 'estimated_logic' }),
      "r-v3-354-filets-de-saint-pierre-a-l-oseille": Object.freeze({ kcal: 861.0, protein: 73.6, carbs: 19.6, sugars: 2.7, fat: 51.1, saturates: 32.9, fibre: 1.8, salt: 2.37, status: 'estimated_logic' }),
      "r-v3-346-filets-de-sole-bonne-femme": Object.freeze({ kcal: 669.0, protein: 57.8, carbs: 5.8, sugars: 3.6, fat: 43.8, saturates: 28.0, fibre: 1.4, salt: 2.21, status: 'estimated_logic' }),
      "r-v3-551-financiers-a-la-fraise": Object.freeze({ kcal: 400.0, protein: 6.3, carbs: 43.5, sugars: 33.3, fat: 22.4, saturates: 12.0, fibre: 4.1, salt: 0.11, status: 'estimated_logic' }),
      "r-v3-445-fruits-melba": Object.freeze({ kcal: 597.0, protein: 8.5, carbs: 111.9, sugars: 105.8, fat: 13.5, saturates: 6.9, fibre: 3.3, salt: 0.19, status: 'estimated_logic' }),
      "r-v3-508-galettes-de-poisson-fume-et-panais": Object.freeze({ kcal: 443.0, protein: 33.7, carbs: 14.7, sugars: 5.2, fat: 26.8, saturates: 9.2, fibre: 6.5, salt: 0.88, status: 'estimated_logic' }),
      "r-v3-325-gnocchi-a-la-parisienne": Object.freeze({ kcal: 565.0, protein: 12.2, carbs: 32.5, sugars: 1.0, fat: 42.7, saturates: 28.2, fibre: 1.4, salt: 1.05, status: 'estimated_logic' }),
      "r-v3-423-gratin-de-pommes-de-terre-au-fromage": Object.freeze({ kcal: 603.0, protein: 15.5, carbs: 40.7, sugars: 30.1, fat: 42.6, saturates: 28.1, fibre: 6.3, salt: 1.85, status: 'estimated_logic' }),
      "r-v3-407-jambonnettes-de-canetons-a-l-orange": Object.freeze({ kcal: 637.0, protein: 45.6, carbs: 33.3, sugars: 23.3, fat: 31.5, saturates: 13.6, fibre: 5.9, salt: 3.45, status: 'estimated_logic' }),
      "r-v3-416-laitues-coeurs-de-celeri-fenouil-bulbeux": Object.freeze({ kcal: 285.0, protein: 15.9, carbs: 23.4, sugars: 9.7, fat: 12.8, saturates: 5.7, fibre: 10.5, salt: 2.77, status: 'estimated_logic' }),
      "r-v3-392-langue-de-boeuf-pochee-sauce-piquante": Object.freeze({ kcal: 446.0, protein: 31.9, carbs: 13.8, sugars: 8.5, fat: 28.2, saturates: 10.4, fibre: 3.0, salt: 1.91, status: 'estimated_logic' }),
      "r-v3-349-lotte-a-l-americaine": Object.freeze({ kcal: 562.0, protein: 64.5, carbs: 16.1, sugars: 3.6, fat: 23.8, saturates: 12.6, fibre: 4.2, salt: 3.48, status: 'estimated_logic' }),
      "r-v3-503-maquereau-avec-salsa-de-pistaches-et-cardamome": Object.freeze({ kcal: 1017.0, protein: 64.4, carbs: 12.2, sugars: 7.3, fat: 77.8, saturates: 19.7, fibre: 3.5, salt: 1.06, status: 'estimated_logic' }),
      "r-v3-356-merlans-a-l-anglaise": Object.freeze({ kcal: 663.0, protein: 9.3, carbs: 37.9, sugars: 5.2, fat: 53.1, saturates: 26.1, fibre: 3.2, salt: 1.83, status: 'estimated_logic' }),
      "r-v3-381-mixed-grill": Object.freeze({ kcal: 2238.0, protein: 77.4, carbs: 164.5, sugars: 7.9, fat: 136.7, saturates: 40.3, fibre: 11.4, salt: 2.34, status: 'estimated_logic' }),
      "r-v3-550-moelleux-a-la-pistache": Object.freeze({ kcal: 875.0, protein: 21.2, carbs: 46.4, sugars: 36.9, fat: 66.7, saturates: 23.9, fibre: 6.4, salt: 0.26, status: 'estimated_logic' }),
      "r-v3-358-moules-farcies": Object.freeze({ kcal: 613.0, protein: 62.2, carbs: 12.9, sugars: 1.2, fat: 33.9, saturates: 19.8, fibre: 1.4, salt: 2.15, status: 'estimated_logic' }),
      "r-v3-378-noisettes-d-agneau-a-la-creme-d-ail": Object.freeze({ kcal: 660.0, protein: 33.5, carbs: 8.7, sugars: 5.0, fat: 51.6, saturates: 26.0, fibre: 2.1, salt: 1.74, status: 'estimated_logic' }),
      "r-v3-338-oeufs-brouilles-portugaise": Object.freeze({ kcal: 397.0, protein: 12.0, carbs: 11.3, sugars: 3.2, fat: 33.3, saturates: 18.0, fibre: 3.9, salt: 0.8, status: 'estimated_logic' }),
      "r-v3-331-oeufs-farcis-chimay": Object.freeze({ kcal: 469.0, protein: 18.1, carbs: 16.2, sugars: 7.7, fat: 36.9, saturates: 21.1, fibre: 1.3, salt: 1.2, status: 'estimated_logic' }),
      "r-v3-332-oeufs-mollets-florentine": Object.freeze({ kcal: 634.0, protein: 32.1, carbs: 22.2, sugars: 8.1, fat: 45.0, saturates: 25.7, fibre: 6.8, salt: 3.77, status: 'estimated_logic' }),
      "r-v3-426-oeufs-a-la-neige": Object.freeze({ kcal: 248.0, protein: 7.2, carbs: 43.7, sugars: 43.1, fat: 4.8, saturates: 2.2, fibre: 0.0, salt: 0.22, status: 'estimated_logic' }),
      "r-v3-339-omelettes-aux-fines-herbes-aux-champignons-au-jambon-et": Object.freeze({ kcal: 318.0, protein: 10.7, carbs: 3.2, sugars: 1.2, fat: 29.0, saturates: 11.9, fibre: 0.5, salt: 0.61, status: 'estimated_logic' }),
      "r-v3-340-omelettes-plates-a-l-espagnole": Object.freeze({ kcal: 762.0, protein: 11.1, carbs: 7.7, sugars: 2.4, fat: 76.2, saturates: 20.6, fibre: 2.8, salt: 0.96, status: 'estimated_logic' }),
      "r-v3-388-osso-buco-milanaise": Object.freeze({ kcal: 1391.0, protein: 74.7, carbs: 85.4, sugars: 14.2, fat: 77.5, saturates: 35.0, fibre: 11.1, salt: 4.56, status: 'estimated_logic' }),
      "r-v3-451-pain-a-la-betterave-au-cumin-et-au-chevre": Object.freeze({ kcal: 363.0, protein: 8.3, carbs: 27.1, sugars: 3.4, fat: 23.9, saturates: 7.5, fibre: 3.0, salt: 0.61, status: 'estimated_logic' }),
      "r-v3-377-paves-de-biche-sautes-sauce-grand-veneur": Object.freeze({ kcal: 887.0, protein: 42.5, carbs: 20.3, sugars: 11.5, fat: 59.0, saturates: 23.6, fibre: 2.9, salt: 3.48, status: 'estimated_logic' }),
      "r-v3-193-compote-pomme-poire-maison": Object.freeze({ kcal: 88.0, protein: 0.5, carbs: 18.7, sugars: 15.8, fat: 0.4, saturates: 0.1, fibre: 3.5, salt: 0.01, status: 'estimated_logic' }),
      "r-v3-189-iles-flottantes-faciles": Object.freeze({ kcal: 283.0, protein: 10.8, carbs: 38.6, sugars: 38.0, fat: 9.4, saturates: 4.1, fibre: 0.0, salt: 0.41, status: 'estimated_logic' }),
      "r-v3-188-creme-caramel": Object.freeze({ kcal: 333.0, protein: 10.8, carbs: 51.1, sugars: 50.4, fat: 9.4, saturates: 4.1, fibre: 0.0, salt: 0.41, status: 'estimated_logic' }),
      "r-v3-194-sables-bretons": Object.freeze({ kcal: 492.0, protein: 5.7, carbs: 56.1, sugars: 23.2, fat: 27.2, saturates: 16.2, fibre: 1.4, salt: 0.04, status: 'estimated_logic' }),
      "r-v3-520-biscuits-brunsli-au-chocolat": Object.freeze({ kcal: 750.0, protein: 13.6, carbs: 95.9, sugars: 87.4, fat: 33.8, saturates: 3.4, fibre: 5.7, salt: 0.38, status: 'estimated_logic' }),
      "r-v3-513-cake-aux-myrtilles-amandes-et-citron": Object.freeze({ kcal: 407.0, protein: 4.1, carbs: 46.1, sugars: 35.5, fat: 22.7, saturates: 12.0, fibre: 2.0, salt: 0.03, status: 'estimated_logic' }),
      "r-v3-522-creme-brulee-vanille-et-citron-vert": Object.freeze({ kcal: 411.0, protein: 7.4, carbs: 33.7, sugars: 32.7, fat: 26.9, saturates: 15.9, fibre: 0.2, salt: 0.15, status: 'estimated_logic' }),
      "r-v3-521-glace-a-la-framboise-sans-baratte": Object.freeze({ kcal: 316.0, protein: 3.0, carbs: 47.4, sugars: 44.1, fat: 12.7, saturates: 7.5, fibre: 2.2, salt: 0.05, status: 'estimated_logic' }),
      "r-v3-444-glace-a-la-vanille-et-glaces-derivees": Object.freeze({ kcal: 340.0, protein: 9.0, carbs: 39.3, sugars: 38.5, fat: 16.3, saturates: 9.0, fibre: 0.1, salt: 0.21, status: 'estimated_logic' }),
      "r-v3-519-gateau-frigo-menthe-chocolat-pistache": Object.freeze({ kcal: 568.0, protein: 6.8, carbs: 55.2, sugars: 41.2, fat: 34.8, saturates: 19.3, fibre: 5.6, salt: 0.19, status: 'estimated_logic' }),
      "r-v3-434-gateau-moka": Object.freeze({ kcal: 609.0, protein: 9.6, carbs: 55.1, sugars: 41.8, fat: 38.7, saturates: 19.6, fibre: 1.6, salt: 0.18, status: 'estimated_logic' }),
      "r-v3-533-muffins-chocolat-framboise-banane": Object.freeze({ kcal: 359.0, protein: 4.3, carbs: 45.3, sugars: 37.1, fat: 17.8, saturates: 11.6, fibre: 1.8, salt: 0.09, status: 'estimated_logic' }),
      "r-v3-531-petits-pots-au-chocolat": Object.freeze({ kcal: 620.0, protein: 10.0, carbs: 49.6, sugars: 42.9, fat: 41.8, saturates: 25.4, fibre: 3.7, salt: 0.21, status: 'estimated_logic' }),
      "r-v3-440-tarte-au-chocolat": Object.freeze({ kcal: 726.0, protein: 7.3, carbs: 68.7, sugars: 39.7, fat: 45.7, saturates: 30.1, fibre: 4.1, salt: 0.2, status: 'estimated_logic' }),
      "r-v3-527-verrine-chocolat-framboise": Object.freeze({ kcal: 362.0, protein: 5.8, carbs: 37.8, sugars: 32.2, fat: 20.9, saturates: 12.3, fibre: 3.6, salt: 0.09, status: 'estimated_logic' }),
      "r-v3-436-choux-a-la-creme-eclairs-cafe-chocolat": Object.freeze({ kcal: 520.0, protein: 14.1, carbs: 53.9, sugars: 36.5, fat: 26.3, saturates: 13.3, fibre: 1.4, salt: 0.36, status: 'estimated_logic' }),
      "r-v3-515-cheesecake-au-miel-et-au-yaourt": Object.freeze({ kcal: 495.0, protein: 14.2, carbs: 40.1, sugars: 28.5, fat: 30.9, saturates: 19.6, fibre: 2.3, salt: 1.01, status: 'estimated_logic' }),
      "r-v3-509-cheesecake-sucre-et-sale-aux-cerises": Object.freeze({ kcal: 900.0, protein: 18.4, carbs: 101.5, sugars: 90.8, fat: 46.8, saturates: 19.8, fibre: 4.5, salt: 1.3, status: 'estimated_logic' }),
      "r-v3-514-clafoutis-aux-figues-et-au-thym": Object.freeze({ kcal: 269.0, protein: 2.5, carbs: 45.5, sugars: 33.2, fat: 8.0, saturates: 5.1, fibre: 2.8, salt: 0.04, status: 'estimated_logic' }),
      "r-v3-510-creme-anglaise-a-la-vanille-fraises-roties-et-rhubarbe": Object.freeze({ kcal: 287.0, protein: 2.1, carbs: 18.7, sugars: 16.8, fat: 22.6, saturates: 14.7, fibre: 1.1, salt: 0.05, status: 'estimated_logic' }),
      "r-v3-528-creme-au-chocolat-noir": Object.freeze({ kcal: 374.0, protein: 6.5, carbs: 26.6, sugars: 22.6, fat: 26.6, saturates: 16.1, fibre: 2.4, salt: 0.12, status: 'estimated_logic' }),
      "r-v3-511-fraises-roties-au-sumac-et-creme-de-yaourt": Object.freeze({ kcal: 300.0, protein: 7.5, carbs: 44.3, sugars: 40.3, fat: 10.5, saturates: 6.4, fibre: 2.9, salt: 0.18, status: 'estimated_logic' }),
      "r-v3-529-gateau-chocolat-framboise": Object.freeze({ kcal: 330.0, protein: 5.6, carbs: 44.8, sugars: 34.4, fat: 14.0, saturates: 8.3, fibre: 1.4, salt: 0.13, status: 'estimated_logic' }),
      "r-v3-541-losanges-noix-et-chocolat": Object.freeze({ kcal: 645.0, protein: 9.7, carbs: 60.5, sugars: 22.8, fat: 39.9, saturates: 22.8, fibre: 4.1, salt: 0.16, status: 'estimated_logic' }),
      "r-v3-413-legumes-glaces-a-blanc-et-petits-oignons-glaces-a-brun": Object.freeze({ kcal: 190.0, protein: 2.3, carbs: 18.3, sugars: 16.7, fat: 10.5, saturates: 7.5, fibre: 6.7, salt: 0.29, status: 'estimated_logic' }),
      "r-v3-453-soupe-refrigeree-de-concombre-chou-fleur-et-gingembre": Object.freeze({ kcal: 349.0, protein: 10.8, carbs: 13.3, sugars: 8.7, fat: 27.0, saturates: 5.3, fibre: 3.8, salt: 3.86, status: 'estimated_logic' }),
      "r-v3-305-gaspacho-andalou": Object.freeze({ kcal: 292.0, protein: 6.5, carbs: 28.3, sugars: 7.9, fat: 16.1, saturates: 2.5, fibre: 6.9, salt: 2.94, status: 'estimated_logic' }),
      "r-v3-244-chorba-aux-legumes-et-pois-chiches": Object.freeze({ kcal: 230.0, protein: 8.7, carbs: 22.7, sugars: 5.6, fat: 9.6, saturates: 1.4, fibre: 9.3, salt: 1.9, status: 'estimated_logic' }),
      "r-v3-303-potage-julienne-darblay": Object.freeze({ kcal: 246.0, protein: 2.5, carbs: 23.4, sugars: 17.5, fat: 16.3, saturates: 10.6, fibre: 4.9, salt: 0.72, status: 'estimated_logic' }),
      "r-v3-302-potage-parisien": Object.freeze({ kcal: 156.0, protein: 1.5, carbs: 24.1, sugars: 18.0, fat: 6.8, saturates: 4.4, fibre: 4.4, salt: 0.14, status: 'estimated_logic' }),
      "r-v3-304-potage-parmentier": Object.freeze({ kcal: 298.0, protein: 3.2, carbs: 28.9, sugars: 15.5, fat: 19.1, saturates: 12.0, fibre: 3.9, salt: 0.48, status: 'estimated_logic' }),
      "r-v3-306-soupe-au-pistou": Object.freeze({ kcal: 726.0, protein: 21.7, carbs: 37.3, sugars: 15.3, fat: 53.7, saturates: 9.3, fibre: 13.7, salt: 0.69, status: 'estimated_logic' }),
      "r-v3-238-soupe-de-courgettes-au-fromage-frais": Object.freeze({ kcal: 203.0, protein: 6.1, carbs: 13.9, sugars: 4.8, fat: 12.3, saturates: 5.7, fibre: 2.6, salt: 2.85, status: 'estimated_logic' }),
      "r-v3-239-soupe-de-lentilles-vertes": Object.freeze({ kcal: 373.0, protein: 21.3, carbs: 44.2, sugars: 7.7, fat: 8.5, saturates: 1.3, fibre: 17.3, salt: 1.38, status: 'estimated_logic' }),
      "r-v3-236-soupe-de-petits-pois-a-la-menthe": Object.freeze({ kcal: 227.0, protein: 6.3, carbs: 25.4, sugars: 3.5, fat: 7.8, saturates: 1.5, fibre: 3.2, salt: 2.64, status: 'estimated_logic' }),
      "r-v3-245-soupe-de-poisson-simplifiee": Object.freeze({ kcal: 252.0, protein: 28.7, carbs: 10.2, sugars: 7.0, fat: 9.9, saturates: 1.8, fibre: 5.0, salt: 1.78, status: 'estimated_logic' }),
      "r-v3-273-coleslaw-leger": Object.freeze({ kcal: 59.0, protein: 3.3, carbs: 8.7, sugars: 5.2, fat: 0.9, saturates: 0.4, fibre: 4.1, salt: 0.78, status: 'estimated_logic' }),
      "r-v3-272-concombre-a-la-creme-et-aneth": Object.freeze({ kcal: 171.0, protein: 2.4, carbs: 4.8, sugars: 3.0, fat: 15.2, saturates: 9.8, fibre: 1.0, salt: 0.98, status: 'estimated_logic' }),
      "r-v3-275-salade-d-endives-pommes-et-noix": Object.freeze({ kcal: 398.0, protein: 10.5, carbs: 17.0, sugars: 11.4, fat: 31.3, saturates: 7.4, fibre: 5.9, salt: 1.19, status: 'estimated_logic' }),
      "r-v3-276-salade-de-betteraves-et-echalotes": Object.freeze({ kcal: 139.0, protein: 3.8, carbs: 10.1, sugars: 3.3, fat: 8.5, saturates: 1.4, fibre: 4.1, salt: 0.79, status: 'estimated_logic' }),
      "r-v3-274-salade-de-fenouil-a-l-orange": Object.freeze({ kcal: 119.0, protein: 1.8, carbs: 12.2, sugars: 8.1, fat: 7.3, saturates: 1.1, fibre: 3.5, salt: 0.68, status: 'estimated_logic' }),
      "r-v3-278-salade-de-haricots-verts-aux-noisettes": Object.freeze({ kcal: 305.0, protein: 8.0, carbs: 16.0, sugars: 6.1, fat: 20.8, saturates: 2.9, fibre: 6.1, salt: 1.36, status: 'estimated_logic' }),
      "r-v3-271-salade-verte-vinaigrette-moutardee": Object.freeze({ kcal: 115.0, protein: 1.3, carbs: 3.5, sugars: 1.3, fat: 10.6, saturates: 1.6, fibre: 1.9, salt: 0.68, status: 'estimated_logic' }),
      "r-v3-277-taboule-de-chou-fleur": Object.freeze({ kcal: 153.0, protein: 3.3, carbs: 7.9, sugars: 5.8, fat: 11.4, saturates: 1.9, fibre: 4.3, salt: 0.68, status: 'estimated_logic' }),
      "r-v3-492-salade-de-surlonge-de-b-uf-et-basilic": Object.freeze({ kcal: 604.0, protein: 21.8, carbs: 18.4, sugars: 3.7, fat: 48.8, saturates: 11.5, fibre: 2.3, salt: 2.14, status: 'estimated_logic' }),
      "r-v3-467-salade-d-ufs-au-curry-et-de-chou-fleur": Object.freeze({ kcal: 194.0, protein: 2.6, carbs: 5.7, sugars: 2.9, fat: 17.9, saturates: 2.4, fibre: 2.1, salt: 1.46, status: 'estimated_logic' }),
      "r-v3-483-salade-de-sarrasin-et-haricots-verts": Object.freeze({ kcal: 241.0, protein: 10.4, carbs: 25.3, sugars: 4.4, fat: 9.8, saturates: 1.9, fibre: 8.3, salt: 1.44, status: 'estimated_logic' }),
      "r-v3-484-couscous-tomates-cerises-et-salade-d-herbes": Object.freeze({ kcal: 412.0, protein: 16.9, carbs: 20.5, sugars: 13.8, fat: 28.9, saturates: 4.1, fibre: 4.6, salt: 1.84, status: 'estimated_logic' }),
      "r-v3-319-salade-tiede-de-lapereau-aux-noisettes": Object.freeze({ kcal: 688.0, protein: 44.6, carbs: 10.7, sugars: 2.1, fat: 48.3, saturates: 6.6, fibre: 3.2, salt: 1.68, status: 'estimated_logic' }),
      "r-v3-481-pelures-de-pommes-de-terre-au-four-a-l-harissa-et-salad": Object.freeze({ kcal: 1132.0, protein: 27.7, carbs: 224.3, sugars: 5.8, fat: 11.4, saturates: 1.8, fibre: 10.3, salt: 0.76, status: 'estimated_logic' }),
      "r-v3-251-salade-de-pates-pesto-et-mozzarella": Object.freeze({ kcal: 510.0, protein: 22.4, carbs: 62.6, sugars: 5.7, fat: 18.9, saturates: 11.6, fibre: 4.0, salt: 2.4, status: 'estimated_logic' }),
      "r-v3-259-salade-falafels-crudites-et-houmous": Object.freeze({ kcal: 271.0, protein: 8.3, carbs: 28.8, sugars: 9.8, fat: 11.5, saturates: 1.7, fibre: 7.1, salt: 1.68, status: 'estimated_logic' }),
      "r-v3-252-salade-lentilles-saumon-fume-et-oeuf": Object.freeze({ kcal: 676.0, protein: 49.6, carbs: 56.8, sugars: 2.1, fat: 23.0, saturates: 4.1, fibre: 21.2, salt: 1.7, status: 'estimated_logic' }),
      "r-v3-247-salade-nicoise": Object.freeze({ kcal: 392.0, protein: 28.9, carbs: 7.3, sugars: 6.1, fat: 26.2, saturates: 4.7, fibre: 4.9, salt: 1.78, status: 'estimated_logic' }),
      "r-v3-255-salade-pommes-de-terre-saumon-et-aneth": Object.freeze({ kcal: 367.0, protein: 16.2, carbs: 35.6, sugars: 3.0, fat: 16.1, saturates: 2.6, fibre: 5.5, salt: 2.69, status: 'estimated_logic' }),
      "r-v3-253-salade-quinoa-avocat-et-mangue": Object.freeze({ kcal: 501.0, protein: 16.8, carbs: 59.1, sugars: 6.9, fat: 18.0, saturates: 2.8, fibre: 11.9, salt: 1.47, status: 'estimated_logic' }),
      "r-v3-203-betteraves-chevre-et-noix": Object.freeze({ kcal: 327.0, protein: 10.7, carbs: 7.4, sugars: 3.0, fat: 27.8, saturates: 7.4, fibre: 5.1, salt: 1.21, status: 'estimated_logic' }),
      "r-v3-198-carottes-rapees-au-citron": Object.freeze({ kcal: 136.0, protein: 1.1, carbs: 6.8, sugars: 6.2, fat: 10.4, saturates: 1.6, fibre: 3.7, salt: 0.77, status: 'estimated_logic' }),
      "r-v3-201-ceviche-de-dorade-au-citron-vert": Object.freeze({ kcal: 25.0, protein: 0.9, carbs: 2.7, sugars: 2.2, fat: 0.1, saturates: 0.0, fibre: 2.5, salt: 0.63, status: 'estimated_logic' }),
      "r-v3-202-champignons-a-la-grecque": Object.freeze({ kcal: 123.0, protein: 4.0, carbs: 6.6, sugars: 4.2, fat: 8.0, saturates: 1.2, fibre: 3.2, salt: 0.78, status: 'estimated_logic' }),
      "r-v3-196-poireaux-vinaigrette": Object.freeze({ kcal: 180.0, protein: 2.6, carbs: 8.4, sugars: 6.3, fat: 14.4, saturates: 2.2, fibre: 3.4, salt: 0.7, status: 'estimated_logic' }),
      "r-v3-462-chou-marine-a-la-moutarde-et-asperges": Object.freeze({ kcal: 329.0, protein: 7.1, carbs: 33.1, sugars: 23.9, fat: 18.6, saturates: 2.4, fibre: 7.0, salt: 0.88, status: 'estimated_logic' }),
      "r-v3-466-chou-fleur-entier-roti": Object.freeze({ kcal: 159.0, protein: 0.3, carbs: 2.4, sugars: 1.6, fat: 16.4, saturates: 7.8, fibre: 0.4, salt: 0.01, status: 'estimated_logic' }),
      "r-v3-471-choux-de-bruxelles-au-beurre-brule-et-ail-noir": Object.freeze({ kcal: 204.0, protein: 5.0, carbs: 8.4, sugars: 2.8, fat: 16.5, saturates: 5.8, fibre: 4.2, salt: 0.14, status: 'estimated_logic' }),
      "r-v3-465-fromage-de-chou-fleur-a-la-moutarde": Object.freeze({ kcal: 355.0, protein: 10.9, carbs: 5.0, sugars: 2.3, fat: 32.3, saturates: 20.9, fibre: 1.5, salt: 0.55, status: 'estimated_logic' }),
      "r-v3-472-petites-carottes-roties-a-la-harissa-et-a-la-grenade": Object.freeze({ kcal: 256.0, protein: 7.8, carbs: 16.6, sugars: 8.0, fat: 17.3, saturates: 4.6, fibre: 7.2, salt: 1.29, status: 'estimated_logic' }),
      "r-v3-470-puree-de-haricots-beurre-avec-muhammara": Object.freeze({ kcal: 916.0, protein: 8.7, carbs: 21.9, sugars: 4.3, fat: 88.2, saturates: 43.3, fibre: 8.9, salt: 1.05, status: 'estimated_logic' }),
      "r-v3-469-tofu-et-haricots-verts-avec-sauce-chraimeh": Object.freeze({ kcal: 575.0, protein: 19.0, carbs: 56.6, sugars: 12.2, fat: 25.1, saturates: 3.7, fibre: 13.3, salt: 1.71, status: 'estimated_logic' }),
      "r-v3-463-asperges-roties-aux-amandes-capres-et-aneth": Object.freeze({ kcal: 237.0, protein: 4.6, carbs: 9.5, sugars: 3.5, fat: 19.9, saturates: 6.5, fibre: 4.9, salt: 0.79, status: 'estimated_logic' }),
      "r-v3-457-aubergine-rotie-aux-anchois-et-origan": Object.freeze({ kcal: 346.0, protein: 6.2, carbs: 15.4, sugars: 6.1, fat: 29.0, saturates: 4.4, fibre: 8.5, salt: 0.92, status: 'estimated_logic' }),
      "r-v3-461-chou-roti-a-l-estragon-et-au-pecorino": Object.freeze({ kcal: 325.0, protein: 3.9, carbs: 5.6, sugars: 1.6, fat: 31.3, saturates: 6.1, fibre: 1.5, salt: 1.08, status: 'estimated_logic' }),
      "r-v3-435-choux-chantilly": Object.freeze({ kcal: 437.0, protein: 7.7, carbs: 23.1, sugars: 11.7, fat: 34.1, saturates: 22.1, fibre: 0.5, salt: 0.21, status: 'estimated_logic' }),
      "r-v3-456-courgettes-farcies-a-la-salsa-de-pignons-de-pin": Object.freeze({ kcal: 1723.0, protein: 54.7, carbs: 44.1, sugars: 12.5, fat: 143.8, saturates: 19.4, fibre: 19.9, salt: 1.93, status: 'estimated_logic' }),
      "r-v3-229-breakfast-burrito-aux-oeufs": Object.freeze({ kcal: 439.0, protein: 22.2, carbs: 39.2, sugars: 2.1, fat: 20.6, saturates: 7.6, fibre: 6.6, salt: 1.92, status: 'estimated_logic' }),
      "r-v3-228-english-breakfast-simplifie": Object.freeze({ kcal: 241.0, protein: 13.3, carbs: 12.2, sugars: 2.9, fat: 12.9, saturates: 2.6, fibre: 11.6, salt: 0.86, status: 'estimated_logic' }),
      "r-v3-233-galettes-d-avoine-a-la-pomme": Object.freeze({ kcal: 468.0, protein: 17.2, carbs: 55.7, sugars: 12.1, fat: 17.1, saturates: 4.5, fibre: 9.5, salt: 0.36, status: 'estimated_logic' }),
      "r-v3-227-omelette-petit-dejeuner-tomate-et-feta": Object.freeze({ kcal: 203.0, protein: 11.6, carbs: 3.0, sugars: 2.4, fat: 15.7, saturates: 6.9, fibre: 0.7, salt: 0.94, status: 'estimated_logic' }),
      "r-v3-223-tartines-avocat-et-oeuf-poche": Object.freeze({ kcal: 290.0, protein: 13.8, carbs: 31.0, sugars: 3.9, fat: 10.1, saturates: 2.4, fibre: 3.1, salt: 1.4, status: 'estimated_logic' }),
      "r-v3-219-granola-maison-aux-noix": Object.freeze({ kcal: 626.0, protein: 14.3, carbs: 57.6, sugars: 12.0, fat: 34.8, saturates: 4.2, fibre: 11.2, salt: 0.13, status: 'estimated_logic' }),
      "r-v3-230-muffins-myrtilles-et-yaourt": Object.freeze({ kcal: 512.0, protein: 9.2, carbs: 68.2, sugars: 30.3, fat: 22.0, saturates: 3.9, fibre: 2.4, salt: 0.22, status: 'estimated_logic' }),
      "r-v3-231-scones-nature": Object.freeze({ kcal: 437.0, protein: 8.5, carbs: 58.6, sugars: 3.2, fat: 17.9, saturates: 12.4, fibre: 2.4, salt: 1.29, status: 'estimated_logic' }),
      "r-v3-261-bagel-saumon-et-fromage-frais": Object.freeze({ kcal: 499.0, protein: 23.9, carbs: 53.5, sugars: 8.7, fat: 20.0, saturates: 8.5, fibre: 3.0, salt: 2.86, status: 'estimated_logic' }),
      "r-v3-260-club-sandwich-poulet-bacon": Object.freeze({ kcal: 679.0, protein: 37.5, carbs: 64.4, sugars: 9.6, fat: 28.0, saturates: 5.0, fibre: 4.5, salt: 2.84, status: 'estimated_logic' }),
      "r-v3-262-wrap-poulet-cesar": Object.freeze({ kcal: 516.0, protein: 40.4, carbs: 27.4, sugars: 2.2, fat: 26.3, saturates: 6.9, fibre: 2.8, salt: 1.99, status: 'estimated_logic' }),
      "r-v3-422-pommes-croquettes": Object.freeze({ kcal: 961.0, protein: 11.1, carbs: 46.5, sugars: 15.6, fat: 81.7, saturates: 19.4, fibre: 5.2, salt: 1.79, status: 'estimated_logic' }),
      "r-v3-380-cotes-de-boeuf-et-entrecotes-grillees-pommes-croquettes": Object.freeze({ kcal: 1481.0, protein: 53.2, carbs: 56.8, sugars: 23.0, fat: 114.9, saturates: 33.1, fibre: 6.5, salt: 4.64, status: 'estimated_logic' }),
      "r-v3-482-pizza-bianca-aux-pommes-de-terre-anchois-et-sauge": Object.freeze({ kcal: 1991.0, protein: 26.5, carbs: 89.1, sugars: 12.9, fat: 169.6, saturates: 50.0, fibre: 5.7, salt: 2.93, status: 'estimated_logic' }),
      "r-v3-449-frittata-de-courgettes-et-ciabatta": Object.freeze({ kcal: 525.0, protein: 21.2, carbs: 45.9, sugars: 7.8, fat: 28.1, saturates: 13.0, fibre: 4.2, salt: 2.08, status: 'estimated_logic' }),
      "r-v3-299-quiche-brocoli-cheddar": Object.freeze({ kcal: 581.0, protein: 23.5, carbs: 46.2, sugars: 3.7, fat: 32.3, saturates: 18.8, fibre: 3.7, salt: 1.51, status: 'estimated_logic' }),
      "r-v3-297-tarte-courgette-chevre": Object.freeze({ kcal: 500.0, protein: 23.4, carbs: 44.8, sugars: 3.1, fat: 25.0, saturates: 10.8, fibre: 3.0, salt: 1.6, status: 'estimated_logic' }),
      "r-v3-298-tarte-fine-oignons-et-feta": Object.freeze({ kcal: 572.0, protein: 16.1, carbs: 33.7, sugars: 2.4, fat: 40.1, saturates: 24.2, fibre: 3.9, salt: 3.06, status: 'estimated_logic' }),
      "r-v3-296-tarte-fine-tomate-ricotta": Object.freeze({ kcal: 461.0, protein: 10.5, carbs: 34.9, sugars: 6.5, fat: 29.9, saturates: 17.1, fibre: 2.8, salt: 2.07, status: 'estimated_logic' }),
      "r-v3-300-tarte-rustique-poireaux-champignons": Object.freeze({ kcal: 454.0, protein: 11.4, carbs: 61.0, sugars: 5.8, fat: 17.9, saturates: 7.3, fibre: 4.5, salt: 0.77, status: 'estimated_logic' }),
    }),
    blocked: Object.freeze({}),
  });
/* nutrition-360-pilot-v2:end:data */

  /* nutrition-360-pilot-v2:start:helpers */
  function nutrition360PilotHasEffectiveVersion(r) {
    return Boolean((r.personal && r.versionDiff) || activeSelectionVersionForRecipe(r));
  }

  function nutrition360PilotNumber(value, digits = 1) {
    return Number(value).toFixed(digits).replace('.', ',');
  }

  function nutrition360PilotCell(label, value, unit) {
    return `<div class="nutrition-pilot-cell"><span>${label}</span><strong>${value}</strong><small>${unit}</small></div>`;
  }

  window.toggleNutritionPilot = function toggleNutritionPilot(details) {
    const summary = details.querySelector('.nutrition-pilot-summary');
    const control = details.querySelector('.nutrition-pilot-control');
    if (summary) summary.setAttribute('aria-expanded', String(details.open));
    if (control) control.textContent = details.open ? '−' : '+';
    if (details.open) {
      requestAnimationFrame(() => {
        const sticky = document.querySelector('.sticky-action');
        const cardRect = details.getBoundingClientRect();
        const stickyRect = sticky?.getBoundingClientRect();
        const safeTop = 48;
        const safeBottom = stickyRect ? Math.min(window.innerHeight, stickyRect.top - 12) : window.innerHeight - 16;
        if (cardRect.top < safeTop || cardRect.bottom > safeBottom) {
          details.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
        }
      });
    }
  }

  function nutrition360PilotHtml(r) {
    const sourceId = r.originalId || r.id;
    const values = NUTRITION_360_PILOT_V2.recipes[sourceId];
    const blockedMessage = NUTRITION_360_PILOT_V2.blocked[sourceId];
    const recalculation = nutrition360PilotHasEffectiveVersion(r);
    const status = recalculation ? 'recalculation' : values ? 'estimated' : 'unavailable';
    const subtitle = recalculation
      ? 'À recalculer après modification'
      : values
        ? 'Par portion · valeurs estimées'
        : 'Nutrition non disponible';
    let content = '';
    if (recalculation) {
      content = '<p>Les valeurs de la recette originale ne sont pas réutilisées après une modification d’ingrédient.</p>';
    } else if (values) {
      const cells = [
        nutrition360PilotCell('Énergie', String(values.kcal), 'kcal'),
        nutrition360PilotCell('Protéines', nutrition360PilotNumber(values.protein), 'g'),
        nutrition360PilotCell('Glucides', nutrition360PilotNumber(values.carbs), 'g'),
        nutrition360PilotCell('Lipides', nutrition360PilotNumber(values.fat), 'g'),
        nutrition360PilotCell('Sucres', nutrition360PilotNumber(values.sugars), 'g'),
        nutrition360PilotCell('Graisses saturées', nutrition360PilotNumber(values.saturates), 'g'),
        nutrition360PilotCell('Fibres', nutrition360PilotNumber(values.fibre), 'g'),
        nutrition360PilotCell('Sel', nutrition360PilotNumber(values.salt, 2), 'g'),
      ].join('');
      content = `<div class="nutrition-pilot-grid">${cells}</div><p>Estimations calculées depuis les ingrédients et quantités de la recette. Les produits réellement utilisés peuvent faire varier les valeurs.</p>`;
    } else {
      content = `<p>${blockedMessage || 'Nutrition non disponible pour cette recette.'}</p>`;
    }
    return `<details class="nutrition-pilot-card nutrition-pilot-${status}" data-nutrition-status="${status}" ontoggle="toggleNutritionPilot(this)"><summary class="nutrition-pilot-summary" aria-expanded="false" aria-label="Afficher les détails nutritionnels pour ${escapeHtml(r.title)}"><span class="nutrition-pilot-label"><strong>Nutrition</strong><small>${subtitle}</small></span><span class="nutrition-pilot-control" aria-hidden="true">+</span></summary><div class="nutrition-pilot-content">${content}</div></details>`;
  }
  /* nutrition-360-pilot-v2:end:helpers */

  function mediaRecord(type, value) {
    const raw = String(value || '');
    const normalized = normalizeSearch(raw);
    const assetId = MEDIA.alias[`${type}:${raw}`]
      || MEDIA.alias[`${type}:${normalized}`]
      || MEDIA.names[`${type}:${normalized}`];
    const record = assetId ? MEDIA.assets[assetId] : null;
    if (!record && type === 'ingredient') return mediaRecord('product', value);
    return record;
  }

  function mediaUrl(type, value, variant = 'list') {
    const record = mediaRecord(type, value);
    return record?.variants?.[variant]?.path || record?.variants?.detail?.path || '';
  }

  function mediaImage(type, value, variant, alt, className) {
    const src = mediaUrl(type, value, variant);
    return src
      ? `<img class="${className}" src="${src}" alt="${escapeHtml(alt || '')}" decoding="async">`
      : `<span class="${className} media-placeholder" aria-hidden="true"></span>`;
  }

  function productMediaRecordForGroceryItem(item) {
    const key = String(item?.key || item?.id || '');
    if (key.startsWith('product|')) {
      const asset = MEDIA.assets[`product--${key.slice('product|'.length)}`];
      if (asset?.class === 'product') return asset;
    }
    const named = mediaRecord('product', item?.name);
    return named?.class === 'product' ? named : null;
  }

  function groceryMediaRecord(item) {
    return productMediaRecordForGroceryItem(item) || mediaRecord('ingredient', item?.name);
  }

  function mediaImageForGroceryItem(item, variant, alt, className) {
    const record = groceryMediaRecord(item);
    const src = record?.variants?.[variant]?.path || record?.variants?.detail?.path || '';
    return src
      ? `<img class="${className}" src="${src}" alt="${escapeHtml(alt || '')}" decoding="async">`
      : `<span class="${className} media-placeholder" aria-hidden="true"></span>`;
  }

  function activeSelectionVersionForRecipe(r, selectionId = state.detail?.selectionId || '') {
    const requestedSelectionId = String(selectionId || '').trim();
    if (!requestedSelectionId || typeof mealListById !== 'function' || typeof mealListSelectionFor !== 'function') return null;
    const selection = mealListSelectionFor(mealListById(state.mealListTargetId || 'list-default'), requestedSelectionId);
    if (!selection || selection.recipeId !== r.id || !Array.isArray(selection.ingredients) || !selection.ingredients.length) return null;
    return { selectionId: selection.selectionId, ingredients: selection.ingredients };
  }

  function activeIngredientsForRecipe(r, selectionId = '') {
    const selectionVersion = activeSelectionVersionForRecipe(r, selectionId);
    if (selectionVersion) return selectionVersion.ingredients;
    // Le catalogue éditorial est immuable : une version attachée à une ancienne
    // session ne doit jamais apparaître dans Découvrir. Seules les recettes
    // personnelles peuvent avoir leur propre version durable hors du Panier.
    if (r.personal && r.versionDiff?.ingredients) return r.versionDiff.ingredients;
    return r.ingredients;
  }

  function versionSummaryForRecipe(r) {
    const source = recipe(r.originalId || r.id) || r;
    const version = activeSelectionVersionForRecipe(r) || (r.personal ? r.versionDiff : null);
    const lines = version ? versionSummaryLines(source.ingredients, version.ingredients) : [];
    if (!lines.length) {
      return "";
    }
    return `<article class="version-summary"><h3>Votre version</h3><ul>${lines.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul><div class="v4-actions two"><button class="secondary" type="button" onclick="openVersionEditor('${r.id}')">Modifier</button><button class="secondary" type="button" onclick="restoreOriginal('${r.id}')">Revenir à l’original</button></div></article>`;
  }

  function detailKickerHtml(r) {
    const effectiveVersion = activeSelectionVersionForRecipe(r) || (r.personal ? r.versionDiff : null);
    const label = r.personal ? 'Ma recette' : effectiveVersion ? 'Version du panier' : '';
    return label ? `<div class="detail-kicker">${label}</div>` : '';
  }

  coverHtml = function fullAppCoverHtml(r, showBenefit = true, detail = false) {
    const benefit = cardBenefit(r);
    const src = detail ? (r.detailImage || r.image) : r.image;
    if (src) {
      const width = detail ? 1200 : 480;
      const height = detail ? 900 : 360;
      return `<img src="${src}" alt="${escapeHtml(r.title)}" width="${width}" height="${height}" loading="${detail ? 'eager' : 'lazy'}" fetchpriority="${detail ? 'high' : 'auto'}" decoding="async"><span class="cover-shade"></span>${showBenefit ? `<span class="cover-label">${escapeHtml(benefit)}</span>` : ''}`;
    }
    return `<div class="cover-fallback theme-${r.coverTheme || 'sage'}"><span class="plate-mark" aria-hidden="true"></span>${showBenefit ? `<span class="cover-label">${escapeHtml(benefit)}</span>` : ''}</div>`;
  };

  thumb = function fullAppThumb(r) {
    const src = r.image || r.detailImage;
    return src
      ? `<img class="cart-thumb" src="${src}" alt="" decoding="async">`
      : `<div class="cart-thumb cover-fallback theme-${r.coverTheme || 'sage'}"><span class="plate-mark" style="width:32px;height:32px"></span></div>`;
  };

  function resolveAdaptationIngredient(name, source) {
    const known = INGREDIENT_INDEX?.get(normalizeSearch(name));
    if (!known) return null;
    return { ...known, name: known.name || name, allergens: [...(known.allergens || [])], aisle: known.aisle || source?.aisle || 'À classer' };
  }

  function preferenceAdaptationCandidates(r) {
    const assessment = personalizationAssessment(r);
    if (!assessment.softAvoidMatches.length || !profileCompatible(r)) return [];
    return PERSONALIZATION_CORE.findValidatedAdaptations(r, assessment.softAvoidMatches);
  }

  function preferenceAdaptationHtml(r) {
    const assessment = personalizationAssessment(r);
    if (!assessment.softAvoidMatches.length || !profileCompatible(r)) return '';
    const candidates = preferenceAdaptationCandidates(r);
    const candidateActions = candidates.map((candidate, index) => `<button class="secondary" type="button" onclick="applyPreferenceAdaptation('${r.id}',${index})">${candidate.kind === 'substitute' ? `Remplacer par ${escapeHtml(candidate.replacementName)}` : 'Retirer cet ingrédient'}</button>`).join('');
    return `<aside class="preference-adaptation-card"><strong>Vous évitez ${escapeHtml(assessment.softAvoidMatches.join(', '))}</strong><p>Cette recette reste visible car cet aliment est seulement marqué « À éviter si possible ». Elle est moins prioritaire.</p>${candidates.length ? `<div class="preference-adaptation-actions"><span>Adaptation éditoriale validée</span>${candidateActions}</div>` : '<small>Aucune adaptation validée pour cette recette. Ne remplacez pas cet ingrédient automatiquement.</small>'}</aside>`;
  }

  function applyPreferenceAdaptation(id, candidateIndex = 0) {
    const displayed = recipe(id);
    const source = displayed?.originalId ? recipe(displayed.originalId) : displayed;
    if (!source || !profileCompatible(source)) {
      toast('Cette recette reste bloquée par vos contraintes strictes');
      return false;
    }
    const candidates = preferenceAdaptationCandidates(source);
    const candidate = candidates[candidateIndex];
    if (!candidate) {
      toast('Aucune adaptation validée disponible');
      return false;
    }
    const adapted = PERSONALIZATION_CORE.applyValidatedAdaptation(source, candidate, {
      resolveIngredient: (name, ingredient) => resolveAdaptationIngredient(name, ingredient),
    });
    if (!adapted) {
      toast('Adaptation non applicable sans ambiguïté');
      return false;
    }
    const original = cloneIngredients(source.ingredients);
    state.versionDraft = {
      displayId: displayed.id,
      sourceId: source.id,
      original,
      ingredients: cloneIngredients(adapted.ingredients),
      removed: original.filter(item => !adapted.ingredients.some(next => next.id === item.id)),
      adaptationNote: candidate.label || candidate.instruction || 'Adaptation éditoriale validée',
    };
    renderVersionEditor();
    versionPanel.classList.add('open');
    scheduleQa();
    return true;
  }

  cardQualityHtml = function fullAppCardQualityHtml(r, benefit) {
    if (isManualPersonalRecipe(r)) {
      const personalLabels = personalRecipeTagLabelsForRecipe(r);
      const personalMetadata = personalRecipeMetadataForCard(r);
      const ingredientCount = (Array.isArray(r.ingredients) ? r.ingredients : []).filter(item => String(item?.name || '').trim()).length;
      const ingredientLabel = ingredientCount ? `${ingredientCount} ingrédient${ingredientCount > 1 ? 's' : ''}` : '';
      const personalBadges = [...personalLabels, ingredientLabel].filter(Boolean).slice(0, 2);
      if (!personalBadges.length) return '';
      const personalBadgeHtml = personalBadges.map((label, index) => `<span class="card-quality ${index < personalLabels.length ? 'editorial' : 'factual'}">${escapeHtml(label)}</span>`).join('');
      return `<span class="card-qualities" data-personal-badges="true" data-personal-metadata="${escapeHtml(personalMetadata.join(' · '))}">${personalBadgeHtml}</span>`;
    }
    const factualBadges = MON_PANIER_CARD_BADGES.cardBadges(r);
    if (factualBadges && factualBadges.length) {
      const factualBadgeHtml = factualBadges.map(label => `<span class="card-quality factual">${escapeHtml(label)}</span>`).join('');
      const softAvoid = personalizationAssessment(r).softAvoidMatches;
      const avoidBadge = softAvoid.length ? `<span class="card-quality avoid">À adapter : ${escapeHtml(softAvoid.join(', '))}</span>` : '';
      return `<span class="card-qualities" data-factual-badges="true">${factualBadgeHtml}${avoidBadge}</span>`;
    }
    const budget = r.budgetKey === 'tres_economique'
      ? 'Petit budget'
      : r.budgetKey === 'economique'
        ? 'Prix accessible'
        : 'Budget modéré';
    const softAvoid = personalizationAssessment(r).softAvoidMatches;
    const avoidBadge = softAvoid.length ? `<span class="card-quality avoid">À adapter : ${escapeHtml(softAvoid.join(', '))}</span>` : '';
    return `<span class="card-qualities"><span class="card-quality editorial">${escapeHtml(benefit)}</span><span class="card-quality budget">${budget}</span>${avoidBadge}</span>`;
  };

  function recipeNavigationLiteral(ids = []) {
    const valid = [...new Set((ids || []).filter(id => recipe(id)))];
    return escapeHtml(JSON.stringify(valid));
  }

  card = function fullAppCard(r, navigationIds = []) {
    const favorite = state.favorites.has(r.id);
    const manual = isManualPersonalRecipe(r);
    const difficulty = difficultyLabels[r.difficultyKey] || r.difficulty || 'Facile';
    const benefit = cardBenefit(r);
    const safeId = localGroceryInlineKey(r.id);
    return `<article class="recipe-card" data-recipe-id="${r.id}" tabindex="0" role="button" aria-label="Voir ${escapeHtml(r.title)}" onclick="openDetail('${safeId}',state.tab,${recipeNavigationLiteral(navigationIds)})" onkeydown="if(event.key==='Enter')openDetail('${safeId}',state.tab,${recipeNavigationLiteral(navigationIds)})">
      <div class="cover">${coverHtml(r, false, false)}<button type="button" class="round-btn recipe-action-btn" data-favorite="${favorite}" aria-label="Actions de la recette ${escapeHtml(r.title)}" title="Actions de la recette" onclick="event.stopPropagation();openRecipeActionMenu('${safeId}',this)">${recipeActionIcon()}</button></div>
      <div class="card-body"><h3>${escapeHtml(r.title)}</h3><div class="card-meta">${manual ? (personalRecipeMetadataForCard(r).length ? `<span class="personal-card-meta" data-personal-metadata="true">${escapeHtml(personalRecipeMetadataForCard(r).join(' · '))}</span>` : '') : `<span class="time">${r.total} min · ${escapeHtml(difficulty)}</span>`}</div><div class="card-bottom">${cardQualityHtml(r, benefit)}</div></div>
    </article>`;
  };
  const discoverCard = (...args) => card(...args);
  const discoverCardRelay = discoverCard;

  renderHeader = function fullAppHeader() {
    header.className = 'app-header';
    if (state.detail) {
      const r = recipe(state.detail.id);
      header.classList.add('detail-header');
      header.innerHTML = `<button class="back" onclick="closeDetail()" aria-label="Retour">${icon('back')} Retour</button><div class="header-center">Mon Panier<i>.</i></div><div class="header-actions">${r?.personal ? '' : `<button class="icon-btn detail-favorite ${state.favorites.has(state.detail.id) ? 'on' : ''}" aria-label="Favori" onclick="toggleFavorite('${state.detail.id}')">${icon('heart')}</button>`}</div>`;
      header.querySelector('.header-center').title = r?.title || 'Mon Panier';
      return;
    }
    const titles = { favorites: 'Favoris', cart: 'Mon Panier', groceries: 'Courses', profile: 'Profil', archives: 'Derniers paniers' };
    if (state.tab === 'discover') {
      header.classList.add('discover-brand');
      header.innerHTML = `<div class="brand-line"><img class="brand-mark" src="mon-panier-logo.svg" alt="" width="48" height="48"><div class="brand-copy"><div class="brand-title"><h1>Mon Panier</h1></div></div></div><div class="header-actions"><button class="icon-btn" aria-label="Ajouter une recette" onclick="openCreateRecipe()">${icon('plus')}</button>${feedbackButton()}</div>`;
      return;
    }
    if (state.tab === 'favorites' && state.libraryView === 'personal') {
      header.innerHTML = `<h1 class="page-title">Favoris</h1><div class="header-actions"><button class="icon-btn" aria-label="Créer une recette" onclick="openCreateRecipe()">${icon('plus')}</button>${feedbackButton()}</div>`;
      return;
    }
    const action = state.tab === 'cart'
      ? `<button class="history-entry" aria-label="Ouvrir les derniers paniers" onclick="setTab('archives')">${icon('history')}<span>Historique</span></button>`
      : state.tab === 'groceries' && state.groceryView !== 'detail'
        ? `<button class="icon-btn" aria-label="Créer une nouvelle liste" onclick="openGroceryListCreator()">${icon('plus')}</button>`
        : state.tab === 'groceries' && (state.groceries.length || state.manualGroceries.length)
          ? `<button class="header-clear" aria-label="Vider toute la liste" onclick="askClearGroceries()">${icon('trash')}</button>`
          : '';
    header.innerHTML = `<h1 class="page-title">${titles[state.tab] || 'Mon Panier'}</h1><div class="header-actions">${action}${feedbackButton()}</div>`;
  };

  renderNav = function fullAppNav() {
    const items = [['discover', 'Découvrir', 'discover'], ['favorites', 'Favoris', 'heart'], ['cart', 'Mon Panier', 'cart'], ['groceries', 'Courses', 'list'], ['profile', 'Profil', 'user']];
    const active = state.tab === 'archives' ? 'cart' : state.tab;
    nav.innerHTML = items.map(([id, label, glyph]) => `<button class="nav-item ${active === id ? 'active' : ''}" data-tab="${id}" onclick="setTab('${id}')">${icon(glyph)}<span>${label}</span>${id === 'cart' && state.cart.size ? `<b class="badge-count">${state.cart.size}</b>` : ''}</button>`).join('');
  };

  renderShelf = function fullAppShelf(row) {
    const { shelf, shown } = row;
    const navigationIds = shown.map(item => item.id);
    return `<section class="shelf ${shelf.personal ? 'personal' : ''}" data-shelf="${shelf.id}"><div class="shelf-head"><div class="shelf-copy"><h2>${shelf.title}</h2><p>${shelf.sub}</p></div><button class="see-all" data-see-all="${shelf.id}" onclick="browseShelf('${shelf.id}')">Tout voir</button></div><div class="h-scroll" aria-label="${escapeHtml(shelf.title)}">${shown.map(item => discoverCardRelay(item, navigationIds)).join('')}</div></section>`;
  };

  /* luna-filter-integration:start */
  function lunaFilterMatch(recipe, filters = state.filters, search = state.search) {
    return profileCompatible(recipe)
      && LUNA_FILTER_CORE.matchesSearch(recipe, search)
      && LUNA_FILTER_CORE.matchesFilters(recipe, filters);
  }

  function lunaFilterRecipes(base = EDITORIAL_RECIPES) {
    return base.filter(recipe => lunaFilterMatch(recipe));
  }

  function catalogueMatches(base = EDITORIAL_RECIPES) {
    return lunaFilterRecipes(base);
  }

  filterRecipes = lunaFilterRecipes;

  function activeFilterLabels() {
    const labels = [];
    if (state.search.trim()) labels.push(`Recherche : ${state.search.trim()}`);
    for (const [group, values] of Object.entries(state.filters)) {
      const definition = FILTERS[group];
      for (const value of values) {
        labels.push(definition?.options.find(option => option[0] === value)?.[1] || value);
      }
    }
    return labels;
  }

  function filterRelaxations(base = EDITORIAL_RECIPES) {
    const relaxations = [];
    for (const [group, values] of Object.entries(state.filters)) {
      for (const value of values) {
        const relaxedFilters = Object.fromEntries(Object.entries(state.filters).map(([key, selected]) => [key, new Set(selected)]));
        relaxedFilters[group].delete(value);
        const count = base.filter(recipe => lunaFilterMatch(recipe, relaxedFilters)).length;
        if (count > 0) {
          const label = FILTERS[group]?.options.find(option => option[0] === value)?.[1] || value;
          relaxations.push({ group, value, label, count });
        }
      }
    }
    return relaxations;
  }

  renderFilterPanel = function lunaRenderFilterPanel() {
    const groups = document.getElementById('filterGroups');
    if (!groups) return;
    groups.innerHTML = Object.entries(FILTERS).map(([group, definition]) => `<section class="filter-group"><h3>${definition.title}</h3><div class="filter-options">${definition.options.map(([value, label]) => `<button class="filter-option ${state.filters[group].has(value) ? 'selected' : ''}" data-filter-option="${group}:${value}" onclick="toggleFilter('${group}','${value}',false);renderFilterPanel()">${label}</button>`).join('')}</div></section>`).join('');
    const filterCount = lunaFilterRecipes(EDITORIAL_RECIPES).length;
    const applyLabel = document.getElementById('filterApplyLabel');
    if (applyLabel) applyLabel.textContent = `Voir ${filterCount} recette${filterCount > 1 ? 's' : ''}`;
  };
  /* luna-filter-integration:end */

  function fullAppDiscoverBodyHtml() {
    if (hasFilters()) {
      const shelf = state.browseShelf ? SHELVES.find(item => item.id === state.browseShelf) : null;
      const catalogueBase = shelf ? EDITORIAL_RECIPES.filter(shelf.match) : EDITORIAL_RECIPES;
      const list = sortVisual(lunaFilterRecipes(catalogueBase));
      const catalogueTotal = catalogueMatches(catalogueBase).length;
      const hiddenByPreferences = catalogueTotal > list.length;
      const navigationIds = list.map(item => item.id);
      const resultCount = hiddenByPreferences
        ? `<p class="result-count result-count-detailed"><span>${list.length} compatible${list.length > 1 ? 's' : ''} avec vos préférences · ${catalogueTotal} dans le catalogue</span><button type="button" class="result-profile-link" onclick="setTab('profile')">Modifier mes préférences</button></p>`
        : `<p class="result-count">${list.length} recette${list.length > 1 ? 's' : ''} compatible${list.length > 1 ? 's' : ''}</p>`;
      if (list.length) {
        return `<div class="result-head"><div><p class="eyebrow">${shelf ? 'Rayon complet' : 'Votre recherche'}</p><h2>${shelf ? shelf.title : 'Résultats'}</h2>${resultCount}</div><button class="back-rays" onclick="clearAllFilters(false)">Tous les rayons</button></div><div class="recipe-grid">${list.map(item => discoverCard(item, navigationIds)).join('')}</div>`;
      }
      const activeLabels = activeFilterLabels();
      const relaxations = filterRelaxations(catalogueBase);
      const activeCopy = activeLabels.length ? `<p>Filtres actifs : ${activeLabels.map(escapeHtml).join(' · ')}.</p>` : '<p>Aucun résultat compatible avec cette recherche.</p>';
      const relaxationHtml = relaxations.length ? `<div class="filter-relaxations"><strong>Essayez plutôt</strong>${relaxations.map(item => `<button type="button" data-filter-relaxation="${item.group}:${item.value}" onclick="toggleFilter('${item.group}','${item.value}')">Retirer « ${escapeHtml(item.label)} » · ${item.count}</button>`).join('')}</div>` : '';
      return `<div class="result-head"><div><p class="eyebrow">${shelf ? 'Rayon complet' : 'Votre recherche'}</p><h2>Aucun résultat</h2></div><button class="back-rays" onclick="clearAllFilters(false)">Tous les rayons</button></div><div class="empty"><div class="empty-mark">${icon('search')}</div><h2>Aucun résultat compatible</h2>${activeCopy}${relaxationHtml}<button class="primary" onclick="clearAllFilters(false)">Tout effacer</button></div>`;
    }
    return homeShelfRows().map(renderShelf).join('');
  }

  renderDiscover = function fullAppDiscover() {
    const filtered = hasFilters();
    return `<section data-screen="${filtered ? 'discover-results' : 'discover-shelves'}" data-od-id="home-discover">${discoverToolLabel(filtered)}${controls()}<div class="discover-results-body" data-discover-body>${fullAppDiscoverBodyHtml()}</div></section>`;
  };

  setSearch = function fullAppSetSearch(value) {
    const next = String(value ?? '');
    state.search = next;
    state.browseShelf = null;
    const section = screen.querySelector('[data-screen^="discover-"]');
    const body = section?.querySelector('[data-discover-body]');
    const input = document.getElementById('recipeSearch');
    if (state.tab === 'discover' && !state.detail && section && body && input) {
      body.innerHTML = fullAppDiscoverBodyHtml();
      section.setAttribute('data-screen', hasFilters() ? 'discover-results' : 'discover-shelves');
      const label = section.querySelector('.discover-tool-label');
      if (label) label.outerHTML = discoverToolLabel(hasFilters());
      input.value = next;
      input.setSelectionRange(next.length, next.length);
      input.focus({ preventScroll: true });
      document.querySelector('.search-clear')?.classList.toggle('show', Boolean(next));
      return;
    }
    render();
    requestAnimationFrame(() => {
      const nextInput = document.getElementById('recipeSearch');
      if (nextInput) {
        nextInput.focus({ preventScroll: true });
        nextInput.setSelectionRange(next.length, next.length);
      }
    });
  };


  renderFavorites = function fullAppFavorites() {
    const mine = state.libraryView === 'personal';
    const personal = recipes.filter(r => r.personal);
    const collection = mine ? personal : recipes.filter(r => state.favorites.has(r.id));
    const list = libraryItems();
    const sortedList = sortVisual(list);
    const navigationIds = sortedList.map(item => item.id);
    const libraryTools = collection.length
      ? `<div class="library-tools"><input class="library-search" type="search" value="${escapeHtml(state.librarySearch)}" placeholder="Rechercher dans ${mine ? 'mes recettes' : 'mes favoris'}" oninput="setLibrarySearch(this.value)">${libraryCollectionControls(mine,collection.length)}</div>`
      : '';
    const hasLibraryFilter = !mine && collection.length > 0 && state.libraryCollection !== 'all';
    const emptyAction = state.librarySearch || hasLibraryFilter
      ? `<button class="primary" onclick="setLibrarySearch('');setLibraryCollection('all')">${state.librarySearch ? 'Effacer la recherche' : 'Effacer le filtre'}</button>`
      : mine ? '' : `<button class="primary" onclick="setTab('discover')">Découvrir</button>`;
    const emptyTitle = state.librarySearch ? 'Aucun résultat' : hasLibraryFilter ? 'Aucune recette dans ce filtre' : mine ? 'Aucune recette personnelle' : 'Aucun favori';
    const emptyCopy = state.librarySearch ? 'Essayez un autre mot ou retirez le filtre.' : hasLibraryFilter ? 'Essayez « Tout » ou un autre filtre.' : mine ? 'Aucune recette personnelle. Utilisez le bouton + pour en créer une.' : 'Le cœur garde une recette ici.';
    return `<section data-screen="favorites"><div class="library-tabs"><button class="library-tab ${mine ? '' : 'active'}" onclick="setLibraryView('favorites')">Mes favoris</button><button class="library-tab ${mine ? 'active' : ''}" onclick="setLibraryView('personal')">Mes recettes${personal.length ? ` · ${personal.length}` : ''}</button></div>${libraryTools}${list.length ? `<div class="recipe-grid">${sortedList.map(item => card(item, navigationIds)).join('')}</div>` : `<div class="empty"><div class="empty-mark">${icon(mine ? 'list' : 'heart')}</div><h2>${emptyTitle}</h2><p>${emptyCopy}</p>${emptyAction}</div>`}${mine ? renderDeletedPersonal() : ''}</section>`;
  };

  const DEFAULT_DETAIL_FRAMING = Object.freeze({ focalX: 50, focalY: 50, scale: 1.01, fit: 'cover' });
  const DETAIL_FRAMING = Object.freeze({
    'r-v3-136-crepes-sucrees': Object.freeze({ focalX: 50, focalY: 0, scale: 1, fit: 'contain' }),
    'r-v3-098-raclette-traditionnelle': Object.freeze({ focalX: 50, focalY: 0, scale: 1, fit: 'contain' }),
    'r-v3-069-spaghetti-carbonara': Object.freeze({ focalX: 50, focalY: 0, scale: 1, fit: 'contain' }),
  });

  function detailFramingStyle(recipeId) {
    const framing = { ...DEFAULT_DETAIL_FRAMING, ...(DETAIL_FRAMING[recipeId] || {}) };
    return `--detail-focal-x:${framing.focalX}%;--detail-focal-y:${framing.focalY}%;--detail-scale:${framing.scale};--detail-fit:${framing.fit}`;
  }

  renderDetail = function fullAppDetail() {
    const r = recipe(state.detail.id);
    if (!r) return '<section data-screen="recipe-detail"><div class="empty"><h2>Recette introuvable</h2></div></section>';
    const servings = state.detail.servings;
    const ingredients = activeIngredientsForRecipe(r, state.detail?.selectionId);
    const manual = isManualPersonalRecipe(r);
    const personalDetailMetadata = personalRecipeMetadataForDetail(r);
    const allergens = r.allergens.length ? r.allergens.map(x => allergenLabels[x] || x).join(', ') : 'Aucun allergène UE déclaré';
    const budgetVisual = r.budgetKey === 'tres_economique' ? ['€', 'petit budget'] : r.budgetKey === 'economique' ? ['€€', 'prix accessible'] : ['€€€', 'budget modéré'];
    const personalPhotoEditor = manual ? `<label class="personal-photo-zone-action ${r.image ? 'has-photo' : 'no-photo'}" for="personalPhotoReplace"><span>${r.image ? 'Remplacer la photo' : 'Ajouter une photo'}</span><input id="personalPhotoReplace" type="file" accept="image/*" onchange="replacePersonalPhoto(this,'${r.id}')"></label>` : '';
    const nutritionBlock = r.personal ? '' : nutrition360PilotHtml(r);
    const allergenBlock = r.personal ? '' : `<div class="allergen-note"><strong>Allergènes déclarés</strong>${escapeHtml(allergens)}. Vérifiez les produits emballés.</div>`;
    const proposal = preferenceAdaptationHtml(r);
    const equipmentLabel = name => name === 'sauteuse' ? 'poêle ou sauteuse' : name;
    const equipment = r.equipment.length ? `<div class="media-strip">${r.equipment.map(name => `<div class="media-tile">${mediaImage('utensil', name, 'list', name, 'utensil-media')}<span>${escapeHtml(equipmentLabel(name))}</span></div>`).join('')}</div>` : '<p class="detail-lead">Aucun matériel spécifique.</p>';
    const ingredientRows = ingredients.map((item, index) => `<div class="ingredient">${mediaImage('ingredient', item.name, 'list', item.name, 'ingredient-media')}<span class="ingredient-name">${escapeHtml(item.name)}<small class="ingredient-role ${item.coursesStatus !== 'inclure' ? 'home' : ''}">${item.coursesStatus !== 'inclure' ? 'hors Courses' : roleLabels[item.role] || item.role}</small></span><span class="ingredient-qty" data-detail-ingredient="${index}">${qtyText(item, servings, r.servings)}</span></div>`).join('');
    const steps = r.steps.length ? r.steps.map(step => `<div class="step"><span class="step-num">${step.number}</span><p>${escapeHtml(step.action)}<small>${step.duration ? `${step.duration} min` : 'Sans durée imposée'}${step.done ? ` · ${escapeHtml(step.done)}` : ''}</small></p></div>`).join('') : '<p class="detail-lead">Aucune étape enregistrée.</p>';
    const detailActions = `<div class="detail-primary-actions detail-hero-actions">${manual ? `<button class="recipe-edit-action" type="button" onclick="openPersonalRecipeEditor('${r.id}')">Modifier la recette</button>` : `<button class="recipe-edit-action" type="button" onclick="openVersionEditor('${r.id}')">Modifier les ingrédients</button>`}<button class="primary ${state.cart.has(r.id) ? 'success' : ''}" data-detail-add onclick="addCart('${r.id}',${servings},true)">Ajouter au Panier</button></div>`;
    return `<section class="detail detail-immersive" data-screen="recipe-detail" data-recipe-detail="${r.id}" style="${detailFramingStyle(r.id)}"><div class="detail-hero"><div class="detail-photo"><div class="cover">${coverHtml(r, false, true)}</div>${personalPhotoEditor}</div><div class="detail-hero-shade"></div><div class="detail-hero-copy">${detailKickerHtml(r)}<h2>${escapeHtml(r.title)}</h2><p class="detail-lead">${escapeHtml(r.description)}</p></div><div class="detail-hero-meta">${manual ? (personalDetailMetadata.length ? `<span class="personal-detail-meta" data-personal-detail-metadata="true"><strong>${escapeHtml(personalDetailMetadata.map(([value,label]) => label === 'préparation' ? `Prépa ${value} min` : label === 'cuisson' ? `Cuisson ${value} min` : value).join(' · '))}</strong><small>Informations renseignées</small></span>` : '') : `<span><strong>${r.total}</strong><small>min</small></span><span><strong>${escapeHtml(difficultyLabels[r.difficultyKey] || r.difficulty)}</strong><small>niveau</small></span><span><strong>${budgetVisual[0]}</strong><small>${budgetVisual[1]}</small></span>`}</div>${detailActions}<div class="detail-scroll-cue" aria-hidden="true"><span>Faire défiler</span><b>↓</b></div></div><div class="detail-content">${proposal}<div class="servings"><span>Portions</span><div class="servings-controls"><button class="qty-btn" aria-label="Retirer une portion" onclick="detailQty(-1)">−</button><strong data-detail-servings>${servings}</strong><button class="qty-btn" aria-label="Ajouter une portion" onclick="detailQty(1)">+</button></div></div>${nutritionBlock}${versionSummaryForRecipe(r)}${allergenBlock}<div class="detail-block"><h3>Matériel</h3>${equipment}</div><div class="detail-block"><h3>Ingrédients</h3><div class="ingredient-list">${ingredientRows}</div></div><div class="detail-block detail-preparation"><div class="detail-block-heading"><h3>Préparation</h3><button class="cooking-mode-button" type="button" onclick="openCooking('${r.id}')">Mode cuisine</button></div><div class="step-list">${steps}</div></div></div></section>`;
  };

  window.replacePersonalPhoto = async function replacePersonalPhoto(input, id) {
    const record = recipe(id);
    const file = input?.files?.[0];
    if (!record || !isManualPersonalRecipe(record) || !file) return false;
    const label = input.closest('label');
    if (label) label.classList.add('is-busy');
    try {
      const image = await window.compressPersonalPhoto(file);
      if (!image) throw new Error('La photo n’a pas pu être enregistrée.');
      record.image = image;
      record.imageStatus = 'personal';
      record.personalMetadataVersion = 2;
      record.personalType = 'manual';
      savePersonalLibrary();
      render();
      toast('Photo enregistrée');
      return true;
    } catch (error) {
      toast(error?.message || 'La photo n’a pas pu être enregistrée.');
      return false;
    } finally {
      if (label) label.classList.remove('is-busy');
      if (input) input.value = '';
    }
  };

  renderCart = function fullAppCart() {
    if (!state.cart.size) return `<section data-screen="cart-empty"><div class="empty"><div class="empty-mark">${icon('cart')}</div><h2>Votre Panier est vide</h2><p>Ajoutez une recette. Sa version exacte et ses portions seront conservées.</p><button class="primary" onclick="setTab('discover')">Découvrir les recettes</button><button class="link-btn" onclick="setTab('archives')">Voir les derniers paniers</button></div></section>`;
    const navigationIds = [...state.cart.keys()];
    const rows = [...state.cart].map(([id, servings]) => {
      const r = recipe(id);
      if (!r) return '';
      const version = state.cartVersions.get(id) || { label: r.personal ? 'Ma recette' : 'Originale', note: 'Version éditoriale originale' };
      return `<article class="cart-card"><div class="cart-row"><div onclick="openDetail('${id}','cart',${recipeNavigationLiteral(navigationIds)})">${thumb(r)}</div><div class="cart-info"><h3>${escapeHtml(r.title)}</h3><p class="exact-version">${escapeHtml(version.label)} · ${escapeHtml(version.note)}</p></div><div class="cart-controls"><button class="qty-btn" aria-label="Retirer une portion" onclick="cartQty('${id}',-1)">−</button><strong>${servings}</strong><button class="qty-btn" aria-label="Ajouter une portion" onclick="cartQty('${id}',1)">+</button></div></div><div class="cart-actions"><button class="remove" onclick="removeCart('${id}')">Retirer</button></div></article>`;
    }).join('');
    const portions = [...state.cart.values()].reduce((total, value) => total + value, 0);
    return `<section data-screen="cart"><div class="cart-summary"><p class="eyebrow">Vos prochains repas</p><h2>${state.cart.size} recette${state.cart.size > 1 ? 's' : ''} · ${portions} portions</h2><p>Chaque repas garde sa version exacte.</p></div><div class="cart-list">${rows}</div><div class="action-stack"><button class="primary" onclick="generateGroceries()">Préparer les Courses</button><button class="secondary" onclick="setTab('archives')">Voir les derniers paniers</button></div></section>`;
  };

  renderManualAdd = function fullAppManualAdd() {
    const suggestions = matchingProducts();
    return `<div class="manual-add"><label for="manualProduct">Ajouter un produit</label><div class="manual-line"><input class="manual-input" id="manualProduct" value="${escapeHtml(state.manualQuery)}" placeholder="Éponge, sacs-poubelle, café…" oninput="setManualQuery(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();addManualProduct()}"><button class="manual-plus" aria-label="Ajouter le produit" onclick="addManualProduct()">${icon('plus')}</button></div><div class="suggestions" id="manualSuggestions">${suggestions.map(product => `<button class="suggestion" onclick="addManualProduct('${product.id}')">${mediaImage('product', product.id, 'list', product.name, 'product-media')}<span class="suggestion-copy">${escapeHtml(product.name)}<small>${escapeHtml(product.category)}</small></span></button>`).join('')}</div></div>`;
  };

  renderGroceries = function fullAppGroceries() {
    const groups = {};
    state.groceries.forEach(item => (groups[item.aisle] ??= []).push(item));
    const total = state.groceries.length + state.manualGroceries.length;
    const remaining = Math.max(0, total - state.checked.size);
    const complete = total > 0 && remaining === 0;
    const generated = Object.entries(groups).map(([aisle, items]) => `<div class="group"><h2 class="group-title">${escapeHtml(aisle)}</h2><div class="grocery-groups">${items.map(item => {
      const done = state.checked.has(item.key); const needsReview = item.missingQty || /^(sel|poivre)\b/i.test(item.name.trim()); const showReview = needsReview && item.origins.length;
      return `<div class="grocery-item ${done ? 'checked' : ''} ${showReview ? 'has-review' : ''}" data-grocery-key="${escapeHtml(item.key)}"><button class="check" aria-label="J’ai déjà ${escapeHtml(item.name)}" onclick="toggleCheck('${item.key.replaceAll("'", "\\'")}')">${icon('check')}</button>${mediaImageForGroceryItem(item, 'list', item.name, 'grocery-media')}<div class="grocery-copy"><p class="grocery-name">${escapeHtml(item.name)}</p><span class="already-label">${done ? 'J’ai déjà' : 'À prendre'}</span><div class="origins">${item.origins.length ? `<button class="grocery-origin-summary" type="button" onclick="openGroceryOrigins('${item.key.replaceAll("'", "\\'")}')">Dans ${item.origins.length} recette${item.origins.length > 1 ? 's' : ''}</button>` : ''}</div></div><span class="grocery-qty">${purchaseQty(item)}</span>${showReview ? `<button class="origin grocery-review" type="button" aria-label="Vérifier la quantité de ${escapeHtml(item.name)}" onclick="openDetail('${item.origins[0]}','groceries')">Vérifier</button>` : ''}</div>`;
    }).join('')}</div></div>`).join('');
    const manual = state.manualGroceries.length ? `<div class="group"><h2 class="group-title">Ajoutés manuellement</h2><div class="grocery-groups">${state.manualGroceries.map(item => {
      const done = state.checked.has(item.id);
      return `<div class="grocery-item ${done ? 'checked' : ''}"><button class="check" aria-label="J’ai déjà ${escapeHtml(item.name)}" onclick="toggleCheck('${item.id}')">${icon('check')}</button>${mediaImage('product', item.name, 'list', item.name, 'grocery-media')}<div class="grocery-copy"><p class="grocery-name">${escapeHtml(item.name)}</p><span class="already-label">${done ? 'J’ai déjà' : 'Ajout manuel'}</span></div><button class="manual-remove" aria-label="Supprimer ${escapeHtml(item.name)}" onclick="removeManualProduct('${item.id}')">×</button></div>`;
    }).join('')}</div></div>` : '';
    const pantryReminder = state.pantryReminders?.length ? `<aside class="pantry-reminder"><strong>À vérifier chez vous</strong><p>${state.pantryReminders.map(escapeHtml).join(' · ')}</p><small>Ces indispensables ne sont pas ajoutés automatiquement. Ajoutez-les seulement si vous en manquez.</small></aside>` : '';
    return `<section data-screen="groceries"><div class="screen-intro"><p class="eyebrow">Liste prête à cocher</p><h2>${remaining} produit${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}</h2><p>Les quantités viennent de vos recettes et de leurs versions exactes.</p></div>${pantryReminder}${renderManualAdd()}${complete ? `<div class="done-banner">${icon('check')}<div><strong>Courses terminées</strong><span>Tous les articles sont cochés.</span></div></div>` : ''}${total ? generated + manual : `<div class="empty" style="padding-top:18px"><h2>Votre liste est vide</h2><p>Ajoutez librement vos produits ci-dessus.</p></div>`}</section>`;
  };

  authProfileHtml = function fullAppAuthProfile() {
    const auth = localAuthLoad();
    if (!auth?.verified || !auth.profile) return '';
    const initial = (auth.profile.name || 'M').trim().charAt(0).toUpperCase();
    return `<article class="profile-account-compact" data-local-auth="authenticated"><span class="profile-avatar">${escapeHtml(initial)}</span><label for="localProfileName"><span class="sr-only">Nom du profil</span><input id="localProfileName" value="${escapeHtml(auth.profile.name || '')}" placeholder="Mon profil" autocomplete="name" onblur="localProfileNameAutoSave(this)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}" aria-label="Nom du profil"></label></article>`;
  };

  function localProfileNameAutoSave(input) {
    const current = localAuthLoad();
    if (!current?.profile || !input) return false;
    const nextName = input.value.trim() || 'Mon profil';
    if (current.profile.name === nextName) return true;
    current.profile.name = nextName;
    current.profile.visibility = 'private';
    localAuthSave(current);
    toast('Nom enregistré');
    render();
    return true;
  }

  function profileValuesSummary(values, emptyLabel, group = '') {
    const unique = [...new Map(values.map(value => [preferenceKey(value), value])).values()];
    if (!unique.length) return emptyLabel;
    const visible = unique.slice(0, 2).map(value => tasteLabel(value, group));
    return `${visible.join(', ')}${unique.length > 2 ? ` +${unique.length - 2}` : ''}`;
  }

  function dietLabel(value = PROFILE.diet || 'none') {
    return ({ none: 'Omnivore', vegetarian: 'Végétarien', vegan: 'Végan' })[value] || 'Omnivore';
  }

  renderProfile = function fullAppProfile() {
    const favoriteValues = [...PROFILE.adored, ...PROFILE.liked];
    const avoidValues = [...PROFILE.avoid, ...PROFILE.strictAvoid.map(value => `${value} · strict`)];
    const signOutLink = GUEST_PILOT_MODE
      ? ''
      : (localAuthLoad()?.verified ? '<button class="profile-signout" type="button" onclick="localSignOut()">Se déconnecter</button>' : '');
    const learned = '';
    const rows = [
      ['diet', 'Régime alimentaire', dietLabel()],
      ['allergies', 'Allergies', profileValuesSummary(PROFILE.allergies, 'Aucune', 'allergies')],
      ['avoid', 'Aliments à éviter', profileValuesSummary(avoidValues, 'Aucun')],
      ['favorites', 'Goûts favoris', profileValuesSummary(favoriteValues, 'À compléter')],
    ];
    return `<section class="profile-settings" data-screen="profile">${authProfileHtml()}<article class="profile-portions"><span><strong>Portions habituelles</strong><small>Par défaut dans les recettes</small></span><div class="servings-controls"><button class="qty-btn" aria-label="Retirer une portion" onclick="setHouseholdSize(-1)">−</button><strong>${PROFILE.householdSize}</strong><button class="qty-btn" aria-label="Ajouter une portion" onclick="setHouseholdSize(1)">+</button></div></article><section class="profile-preferences" aria-labelledby="profilePreferencesTitle"><h2 id="profilePreferencesTitle">Préférences alimentaires</h2><div class="profile-setting-list"><button class="profile-setting-row profile-guided-entry" type="button" onclick="openProfileOnboarding()"><span><strong>Parcours guidé</strong><small>Ajoutez vos goûts, allergies et aliments à éviter</small></span><b aria-hidden="true">›</b></button>${rows.map(([kind, label, summary]) => `<button class="profile-setting-row" type="button" data-preference-entry="${kind}" onclick="openPreferenceEditor('${kind}')"><span><strong>${label}</strong><small>${escapeHtml(summary)}</small></span><b aria-hidden="true">›</b></button>`).join('')}</div></section>${learned}${signOutLink}</section>`;
  };

  renderArchives = function fullAppArchives() {
    const currentSelections = mealListRecipeSelections(mealListById('list-default'));
    const currentSummary = currentSelections.length
      ? `${currentSelections.length} recette${currentSelections.length > 1 ? 's' : ''} · ${currentSelections.reduce((total, selection) => total + selection.servings, 0)} portions`
      : 'Aucune recette pour le moment';
    const currentCart = `<article class="archive-current-cart"><div><p class="eyebrow">Panier actuel</p><h3>Votre sélection en cours</h3><p>${currentSummary}</p></div><button class="archive-current-cart-action" type="button" onclick="returnToCurrentCart()">Voir mon panier</button></article>`;
    const archives = state.archived.length
      ? state.archived.map((archive, index) => `<article class="archive-card"><div class="archive-top"><div><h3>Panier du ${archive.date}</h3><p>${archive.items.length} recettes · ${archive.items.reduce((total, item) => total + item[1], 0)} portions</p></div><span class="eyebrow">${index ? 'Archivé' : 'Récent'}</span></div><div class="archive-recipes">${archive.items.map(([id, servings]) => { const r = recipe(id); return r ? `<button class="archive-recipe" type="button" aria-label="Ouvrir ${escapeHtml(r.title)}" onclick="openDetail('${id}','archives')">${thumb(r)}<span>${escapeHtml(r.title)} · ${servings} portion${servings > 1 ? 's' : ''}</span></button>` : ''; }).join('')}</div><button class="secondary" onclick="askResume(${archive.id})">Reprendre ce Panier</button></article>`).join('')
      : `<div class="empty"><h2>Aucun Panier récent</h2><p>Ils apparaîtront ici après préparation des Courses.</p></div>`;
    return `<section data-screen="archives"><div class="screen-intro"><p class="eyebrow">À refaire facilement</p><h2>Vos derniers Paniers</h2><p>Chaque reprise crée une nouvelle sélection active.</p></div>${currentCart}${archives}</section>`;
  };

  window.returnToCurrentCart = function returnToCurrentCart() {
    const opened = openMealList('list-default', 'cart');
    if (opened) screen.scrollTop = 0;
    return opened;
  };

  /* cart-version-editor-close-core:start */
  const CART_VERSION_EDITOR_CLOSE_CORE = (() => {
    const canonicalIngredient = (item = {}) => ({
      id: String(item.id || ''),
      name: String(item.name || ''),
      qty: item.qty ?? null,
      unit: String(item.unit || ''),
      role: String(item.role || ''),
      coursesStatus: String(item.coursesStatus || ''),
      aisle: String(item.aisle || ''),
      allergens: [...(item.allergens || [])].map(String).sort(),
    });
    const ingredientKey = item => JSON.stringify(canonicalIngredient(item));
    const fingerprint = (draft = {}) => JSON.stringify([...(draft.ingredients || [])].map(ingredientKey).sort());
    const isDirty = (draft = {}) => Boolean(draft.openingFingerprint && fingerprint(draft) !== draft.openingFingerprint);
    return Object.freeze({ fingerprint, isDirty });
  })();
  /* cart-version-editor-close-core:end */

  renderVersionEditor = function fullAppVersionEditor() {
    const draft = state.versionDraft;
    if (!draft) return;
    versionBody.innerHTML = `${draft.adaptationNote ? `<aside class="preference-adaptation-card"><strong>Adaptation proposée, à vérifier</strong><p>${escapeHtml(draft.adaptationNote)}</p><small>Vous confirmez seulement cette version locale. L’original reste inchangé.</small></aside>` : ''}<p class="capture-note">Modifiez la vraie liste. L’original reste intact.</p><div class="ingredient-editor">${draft.ingredients.map((item, index) => `<div class="ingredient-edit-row">${mediaImage('ingredient', item.name, 'list', item.name, 'editor-media')}<span class="ingredient-edit-name">${escapeHtml(item.name)}</span><input aria-label="Quantité de ${escapeHtml(item.name)}" inputmode="decimal" value="${item.qty == null ? '' : escapeHtml(item.qty)}" onchange="updateVersionIngredient(${index},'qty',this.value)"><select aria-label="Unité de ${escapeHtml(item.name)}" onchange="updateVersionIngredient(${index},'unit',this.value)">${unitChoices(item.unit)}</select><button class="ingredient-remove" type="button" aria-label="Retirer ${escapeHtml(item.name)}" onclick="removeVersionIngredient(${index})">×</button></div>`).join('')}</div>${draft.removed.length ? `<div class="removed-zone"><h3>Retirés</h3>${draft.removed.map((item, index) => `<div class="removed-line"><span>${escapeHtml(item.name)}</span><button class="removed-undo" type="button" onclick="restoreVersionIngredient(${index})">Annuler</button></div>`).join('')}</div>` : ''}<div class="ingredient-add"><h3>Ajouter un ingrédient</h3><div class="ingredient-add-grid"><label class="ingredient-add-field"><span>Nom</span><input id="versionAddName" placeholder="Ex. courgette" aria-label="Nom du nouvel ingrédient"></label><label class="ingredient-add-field"><span>Quantité</span><input id="versionAddQty" inputmode="decimal" placeholder="Ex. 2" aria-label="Quantité du nouvel ingrédient"></label><label class="ingredient-add-field"><span>Unité</span><select id="versionAddUnit" aria-label="Unité du nouvel ingrédient">${unitChoices('piece')}</select></label></div><button class="secondary" type="button" onclick="addVersionIngredient()">Ajouter</button><p class="version-error" id="versionError" role="alert"></p></div><div class="scope-block"><button class="secondary version-personal-save" type="button" onclick="saveVersionToPersonalRecipes()">Enregistrer dans Mes recettes</button><button class="primary version-cart-submit" type="button" onclick="applyVersion()">Ajouter au Panier</button></div>`;
  };

  function cloneVersionIngredients(ingredients = []) {
    return (ingredients || []).map(item => ({ ...item, allergens: [...(item.allergens || [])] }));
  }

  function hasUsableIngredients(ingredients = []) {
    return Array.isArray(ingredients) && ingredients.some(item => String(item?.name || '').trim());
  }

  function requireVersionIngredient(ingredients) {
    if (hasUsableIngredients(ingredients)) return true;
    const error = document.getElementById('versionError');
    if (error) {
      error.textContent = 'Ajoutez au moins un ingrédient avant de continuer.';
      error.classList.add('show');
    }
    return false;
  }

  function saveVersionInPersonalLibrary(source, ingredients) {
    const savedIngredients = cloneVersionIngredients(ingredients);
    const originalId = source.originalId || source.id;
    const original = recipe(originalId) || source;
    const versionDiff = {
      sourceId: original.id,
      ingredients: cloneVersionIngredients(savedIngredients),
      diffs: versionSummaryLines(original.ingredients || [], savedIngredients),
      note: versionNote(original.ingredients || [], savedIngredients),
      createdAt: 'Aujourd’hui',
    };
    if (source.personal) {
      source.ingredients = savedIngredients;
      source.versionDiff = versionDiff;
      source.catalogueStatus = 'private';
      savePersonalLibrary();
      return source;
    }
    const saved = {
      ...source,
      id: `personal-version-${Date.now()}`,
      title: `${source.title} · ma version`,
      description: 'Copie personnelle durable. Original intact.',
      personal: true,
      originalId: source.id,
      catalogueStatus: 'private',
      ingredients: savedIngredients,
      tags: [...new Set([...(source.tags || []), 'personnelle'])],
      versionDiff,
    };
    recipes.unshift(saved);
    savePersonalLibrary();
    return saved;
  }

  window.saveVersionToPersonalRecipes = function saveVersionToPersonalRecipes() {
    const draft = state.versionDraft;
    const sourceId = state.detail?.id;
    const source = sourceId ? recipe(sourceId) : null;
    if (!draft || !source || !Array.isArray(draft.ingredients)) return false;
    const ingredients = cloneVersionIngredients(draft.ingredients);
    if (!requireVersionIngredient(ingredients)) return false;
    const unchanged = CART_VERSION_EDITOR_CLOSE_CORE.fingerprint({ ingredients }) === CART_VERSION_EDITOR_CLOSE_CORE.fingerprint({ ingredients: draft.original });
    const alreadyFavorite = state.favorites.has(source.id);
    if (unchanged) {
      if (alreadyFavorite) {
        openDialog(
          'unchangedPersonalVersionAlreadyFavorite',
          'Déjà dans vos favoris',
          'Cette recette est déjà dans vos Favoris. Modifiez des ingrédients pour créer votre propre version.',
          'Fermer',
          source.id,
          'Continuer à modifier',
        );
      } else {
        openDialog(
          'unchangedPersonalVersion',
          'Aucune modification détectée',
          'Vous n’avez modifié aucun ingrédient par rapport à l’original. Pour conserver la recette originale, ajoutez-la plutôt à vos Favoris.',
          'Ajouter aux favoris',
          source.id,
          'Continuer à modifier',
        );
      }
      return false;
    }
    const existingPersonal = draft.savedPersonalId ? recipe(draft.savedPersonalId) : null;
    const saveSource = existingPersonal || source;
    const saved = saveVersionInPersonalLibrary(saveSource, ingredients);
    state.versionDraft.savedPersonalId = saved.id;
    state.versionDraft.openingFingerprint = CART_VERSION_EDITOR_CLOSE_CORE.fingerprint(state.versionDraft);
    toast('Recette modifiée ajoutée à vos recettes', 3200);
    return true;
  };

  function cookingCue(action = '') {
    const text = normalizeSearch(action);
    if (/coupez|hachez|epluchez|rapez|melangez|preparez/.test(text)) return 'Préparer';
    if (/cuisez|dorez|chauffez|four|poele|casserole|cuisson|mijotez/.test(text)) return 'Cuire';
    if (/ajoutez|incorporez|versez|assaisonnez|melange/.test(text)) return 'Assembler';
    if (/servez|dressez|laissez refroidir|reposez/.test(text)) return 'Finaliser';
    return 'Étape suivante';
  }

  renderCook = function fullAppCook() {
    const cooking = state.cook;
    const r = recipe(cooking.id);
    const steps = r.steps.length ? r.steps : [{ action: 'Préparer les ingrédients.', duration: 0 }];
    const step = steps[cooking.index];
    const duration = Number(step.duration) || 0;
    cookProgress.style.width = `${((cooking.index + 1) / steps.length) * 100}%`;
    cookBody.innerHTML = `<span class="cook-step-label">Étape ${cooking.index + 1} sur ${steps.length}</span><h2>${escapeHtml(step.action)}</h2><p>${escapeHtml(step.done || 'Passez à la suite quand cette étape est terminée.')}</p><div class="cook-step-visual cook-step-guide"><span class="cook-step-guide-number">${String(cooking.index + 1).padStart(2, '0')}</span><div><span class="cook-step-guide-kicker">${cookingCue(step.action)}</span><strong>À faire maintenant</strong><small>${steps.length} étapes au total</small></div></div>${duration ? `<div class="timer-card"><strong>${duration} min</strong><span>Durée indicative · aucun minuteur actif</span></div>` : `<p class="capture-note">Aucune attente particulière pour cette étape.</p>`}<div class="keep-awake"><span><strong>Garder l’écran éveillé</strong><br>Simulation locale</span><button class="switch ${cooking.awake ? 'on' : ''}" onclick="toggleAwake()"><span></span></button></div>`;
    cookBack.disabled = !cooking.index;
    cookNext.textContent = cooking.index === steps.length - 1 ? 'Terminer' : 'Étape suivante';
    scheduleQa();
  };

  authGateHtml = function fullAppAuthGate() {
    const auth = localAuthLoad();
    const active = auth?.verified && auth?.profile;
    if (active) return '';
    const error = localAuthError ? `<p class="auth-entry-error" role="alert">${escapeHtml(localAuthError)}</p>` : '';
    if (auth?.pending) return `<div class="auth-entry-inner" data-local-auth="otp-pending"><div class="auth-entry-brand"><img class="auth-entry-mark" src="mon-panier-logo.svg" alt="" width="40" height="40"><span>Mon Panier</span></div><div class="auth-entry-heading"><p class="eyebrow">Vérification</p><h1 id="authGateTitle">Consultez votre e-mail</h1><p>Entrez le code envoyé à ${escapeHtml(auth.email)}.</p></div><div class="auth-entry-email"><label>Code à 6 chiffres<input id="localAuthCode" inputmode="numeric" maxlength="6" placeholder="000000"></label><button onclick="localVerifyOtp()">Entrer dans Mon Panier</button><button class="auth-entry-back" onclick="localAuthBack()">Utiliser une autre adresse</button><p class="auth-entry-proof">Prototype local : utilisez le code <strong>${LOCAL_AUTH_CODE}</strong>.</p></div>${error}<p class="auth-entry-privacy">Aucun fournisseur externe n’est contacté.</p></div>`;
    return `<div class="auth-entry-inner" data-local-auth="signed-out"><div class="auth-entry-brand"><img class="auth-entry-mark" src="mon-panier-logo.svg" alt="" width="40" height="40"><span>Mon Panier</span></div><div class="auth-entry-heading"><p class="eyebrow">Votre espace privé</p><h1 id="authGateTitle">Vos recettes.<br>Vos Courses.</h1><p>Retrouvez vos choix et partagez une liste seulement quand vous le décidez.</p></div><div class="auth-entry-providers"><button class="auth-entry-provider apple" onclick="return false">${appleAuthLogo()}<span>Continuer avec Apple</span></button><button class="auth-entry-provider google" onclick="return false">${googleAuthLogo()}<span>Continuer avec Google</span></button></div><div class="auth-entry-separator"><span>ou</span></div><div class="auth-entry-email"><label>Adresse e-mail<input id="localAuthEmail" type="email" placeholder="vous@exemple.fr"></label><button onclick="return false">Continuer par e-mail</button></div>${error}<p class="auth-entry-privacy">Vos préférences restent privées. Aucun contenu n’est publié automatiquement.</p></div>`;
  };

  function ensureFullPanels() {
    if (!document.getElementById('preferencesPanel')) {
      document.body.insertAdjacentHTML('beforeend', `<aside class="overlay preference-editor" id="preferencesPanel" role="dialog" aria-modal="true" aria-labelledby="preferencesPanelTitle"><div class="sheet"><div class="sheet-head"><button class="icon-btn" type="button" onclick="closePreferenceEditor()" aria-label="Retour">‹</button><div><p class="eyebrow">Préférences alimentaires</p><h2 id="preferencesPanelTitle">Réglage</h2></div></div><div class="full-panel-body" id="preferencesPanelBody"></div><div class="panel-sticky"><button class="primary" onclick="closePreferenceEditor()">Terminé</button></div></div></aside>`);
    }
  }

  function closeFullPanel(id) {
    document.getElementById(id)?.classList.remove('open');
    scheduleQa();
  }

  function renderShareScreen() {
    const share = localGroceryShareLoad();
    const count = localGroceryCount();
    const body = document.getElementById('sharePanelBody');
    if (!share?.active) {
      body.innerHTML = `<article class="share-hero"><div class="avatar-row"><span>C</span><span>A</span></div><h2>Partager vos Courses</h2><p>Créez une simulation locale. La liste reste privée et aucun lien ne quitte cet appareil.</p></article><div class="share-code"><strong>${count} produit${count > 1 ? 's' : ''} prêt${count > 1 ? 's' : ''}</strong><p>Seule la liste de Courses est concernée.</p><button class="primary" ${count ? '' : 'disabled'} onclick="shareInvite()">Créer l’invitation locale</button></div><div class="panel-sticky"><button class="secondary" onclick="closeFullPanel('sharePanel')">Revenir aux Courses</button></div>`;
      return;
    }
    body.innerHTML = `<article class="share-hero"><div class="avatar-row"><span>C</span><span>A</span></div><h2>Courses avec Alex</h2><p>${share.joined ? 'Vous cochez la même liste. Chacun peut quitter le partage à tout moment.' : 'Invitation locale créée. Alex doit encore rejoindre.'}</p></article><p class="eyebrow" style="margin:16px 0 6px">Membres</p><div class="share-member"><span class="profile-avatar">C</span><span><strong>Camille</strong><small>Créatrice de la liste</small></span><b>Gère</b></div><div class="share-member"><span class="profile-avatar" style="background:var(--lime);color:#111">A</span><span><strong>Alex</strong><small>${share.joined ? 'Peut cocher les produits' : 'Invitation en attente'}</small></span><b>${share.joined ? 'Participe' : 'En attente'}</b></div><div class="share-code"><strong>Invitation locale</strong><p>MP-7K2L</p>${share.joined ? `<label>Voir comme <select onchange="shareActor(this.value)"><option value="camille" ${share.actor === 'camille' ? 'selected' : ''}>Camille</option><option value="alex" ${share.actor === 'alex' ? 'selected' : ''}>Alex</option></select></label>` : `<button class="primary" onclick="shareJoin()">Rejoindre comme Alex</button>`}</div><div class="share-danger"><strong>Arrêter le partage</strong><p>La liste redevient privée. Les produits restent intacts.</p><button class="secondary" onclick="shareStop()">Arrêter</button></div><div class="panel-sticky"><button class="primary" onclick="closeFullPanel('sharePanel')">Revenir aux Courses</button></div>`;
  }

  function openShareScreen() {
    ensureFullPanels();
    renderShareScreen();
    document.getElementById('sharePanel').classList.add('open');
    scheduleQa();
  }

  function shareInvite() { localGroceryInvite(); renderShareScreen(); scheduleQa(); }
  function shareJoin() { localGroceryJoin(); renderShareScreen(); scheduleQa(); }
  function shareActor(value) { localGroceryActor(value); renderShareScreen(); scheduleQa(); }
  function shareStop() { localGroceryStop(); renderShareScreen(); scheduleQa(); }

  function preferenceSelected(kind, value) {
    const groups = kind === 'favorites'
      ? ['adored', 'liked']
      : kind === 'avoid'
        ? ['avoid', 'strictAvoid']
        : [kind];
    return groups.some(group => PROFILE[group]?.some(item => preferenceKey(item) === preferenceKey(value)));
  }

  function setDietPreference(value) {
    if (!['none', 'vegetarian', 'vegan'].includes(value)) return false;
    PROFILE.diet = value;
    saveProfile();
    const onboarding = onboardingLoad();
    onboarding.diet = value;
    onboardingSave(onboarding);
    renderPreferenceEditor();
    toast('Régime enregistré');
    return true;
  }

  function setAvoidLevel(value, level = 'soft') {
    const identity = preferenceKey(value);
    PROFILE.avoid = PROFILE.avoid.filter(item => preferenceKey(item) !== identity);
    PROFILE.strictAvoid = PROFILE.strictAvoid.filter(item => preferenceKey(item) !== identity);
    PROFILE.adored = PROFILE.adored.filter(item => preferenceKey(item) !== identity);
    PROFILE.liked = PROFILE.liked.filter(item => preferenceKey(item) !== identity);
    const target = level === 'strict' ? 'strictAvoid' : 'avoid';
    PROFILE[target].push(value);
    saveProfile();
    renderPreferenceEditor();
    toast(level === 'strict' ? 'Exclusion stricte enregistrée' : 'Aliment à éviter enregistré');
    return true;
  }

  function toggleProfilePreference(kind, value) {
    const group = kind === 'favorites' ? 'adored' : kind;
    if (!['adored', 'avoid', 'strictAvoid', 'allergies'].includes(group)) return false;
    const identity = preferenceKey(value);
    const selectedGroups = kind === 'favorites'
      ? ['adored', 'liked']
      : kind === 'avoid'
        ? ['avoid', 'strictAvoid']
        : [group];
    const selected = selectedGroups.some(key => PROFILE[key].some(item => preferenceKey(item) === identity));
    if (selected) {
      selectedGroups.forEach(key => { PROFILE[key] = PROFILE[key].filter(item => preferenceKey(item) !== identity); });
    } else {
      Object.keys(tasteGroups).forEach(key => { PROFILE[key] = PROFILE[key].filter(item => preferenceKey(item) !== identity); });
      PROFILE.avoid = PROFILE.avoid.filter(item => preferenceKey(item) !== identity);
      PROFILE.strictAvoid = PROFILE.strictAvoid.filter(item => preferenceKey(item) !== identity);
      PROFILE[group].push(value);
    }
    saveProfile();
    renderPreferenceEditor();
    toast('Préférences enregistrées');
    return true;
  }

  function clearProfileAllergies() {
    PROFILE.allergies = [];
    saveProfile();
    renderPreferenceEditor();
    toast('Aucune allergie enregistrée');
  }

  function preferenceSearch(kind, input) {
    const query = normalizeSearch(input.value.trim());
    document.querySelectorAll(`#preferencesPanel [data-preference-search]`).forEach(button => {
      button.hidden = Boolean(query) && !button.dataset.preferenceSearch.includes(query);
    });
    const add = document.getElementById('preferenceFreeAdd');
    if (add) add.disabled = !input.value.trim();
  }

  function addFreeProfilePreference(kind) {
    if (!['avoid', 'favorites'].includes(kind)) return false;
    const input = document.getElementById('preferenceSearchInput');
    const value = normalizeTaste(input?.value || '');
    if (!value) return false;
    const alreadySelected = preferenceSelected(kind, value);
    if (!alreadySelected) toggleProfilePreference(kind, value);
    else toast(`${tasteLabel(value)} est déjà sélectionné`);
    return !alreadySelected;
  }

  function avoidLevelList(values, level) {
    if (!values.length) return '<p class="preference-empty">Aucun aliment dans ce niveau.</p>';
    return `<div class="preference-level-items">${values.map(value => `<div class="preference-level-item"><span>${escapeHtml(tasteLabel(value))}</span><button type="button" class="secondary" onclick="setAvoidLevel(decodeURIComponent('${encodeURIComponent(value)}'),'${level === 'soft' ? 'strict' : 'soft'}')">${level === 'soft' ? 'Rendre strict' : 'Remettre en souple'}</button><button type="button" class="preference-remove" aria-label="Retirer ${escapeHtml(tasteLabel(value))}" onclick="toggleProfilePreference('avoid',decodeURIComponent('${encodeURIComponent(value)}'))">×</button></div>`).join('')}</div>`;
  }

  function preferenceOption(kind, value, label, image = '') {
    const selected = preferenceSelected(kind, value);
    const encoded = encodeURIComponent(value);
    const search = normalizeSearch(`${value} ${label}`);
    return `<button type="button" class="preference-option ${image ? 'with-image' : ''} ${selected ? 'selected' : ''}" data-preference-search="${escapeHtml(search)}" aria-pressed="${selected}" onclick="toggleProfilePreference('${kind}',decodeURIComponent('${encoded}'))">${image}<span>${escapeHtml(label)}</span><b aria-hidden="true">${selected ? '✓' : ''}</b></button>`;
  }

  function renderPreferenceEditor() {
    const kind = state.preferenceEditor || 'allergies';
    const body = document.getElementById('preferencesPanelBody');
    const title = document.getElementById('preferencesPanelTitle');
    if (!body || !title) return;
    if (kind === 'diet') {
      title.textContent = 'Régime alimentaire';
      body.innerHTML = `<p class="preference-help">Ce choix retire les recettes incompatibles de toutes les listes.</p><div class="preference-radio-list">${[['none','Omnivore'],['vegetarian','Végétarien'],['vegan','Végan']].map(([value,label]) => `<button type="button" class="preference-radio ${PROFILE.diet === value ? 'selected' : ''}" aria-pressed="${PROFILE.diet === value}" onclick="setDietPreference('${value}')"><span>${label}</span><b aria-hidden="true">${PROFILE.diet === value ? '✓' : ''}</b></button>`).join('')}</div>`;
      return;
    }
    if (kind === 'allergies') {
      title.textContent = 'Allergies';
      const noneSelected = !PROFILE.allergies.length;
      body.innerHTML = `<p class="preference-help strict">Filtrage strict : toute recette incompatible ou incertaine est écartée. Les adaptations ne sont jamais une garantie pour une allergie ; vérifiez toujours l’étiquette du produit.</p><button type="button" class="preference-radio ${noneSelected ? 'selected' : ''}" aria-pressed="${noneSelected}" onclick="clearProfileAllergies()"><span>Aucune allergie</span><b aria-hidden="true">${noneSelected ? '✓' : ''}</b></button><div class="preference-option-grid">${Object.entries(allergenLabels).map(([value,label]) => preferenceOption('allergies', value, tasteLabel(label))).join('')}</div>`;
      return;
    }
    const favorites = kind === 'favorites';
    title.textContent = favorites ? 'Goûts favoris' : 'Aliments à éviter';
    const selectedValues = favorites ? [...PROFILE.adored, ...PROFILE.liked] : [...PROFILE.avoid, ...PROFILE.strictAvoid];
    const sourceChoices = favorites ? TASTE_CHOICES : [...WIZARD_STEPS[1].options.map(([value,label]) => [value,label,'']), ...AVOID_CHOICES];
    const uniqueChoices = [...new Map(sourceChoices.map(choice => [preferenceKey(choice[0]), choice])).values()];
    const selected = favorites
      ? (selectedValues.length ? `<div class="preference-selected">${selectedValues.map(value => `<button type="button" onclick="toggleProfilePreference('${kind}',decodeURIComponent('${encodeURIComponent(value)}'))">${escapeHtml(tasteLabel(value))} ×</button>`).join('')}</div>` : '')
      : `<section class="preference-level"><h3>À éviter si possible</h3><p>La recette reste accessible, mais elle descend dans le classement et affiche un avertissement.</p>${avoidLevelList(PROFILE.avoid, 'soft')}</section><section class="preference-level strict"><h3>Ne jamais proposer</h3><p>Exclusion stricte dans Découvrir, les rayons et les recherches.</p>${avoidLevelList(PROFILE.strictAvoid, 'strict')}</section>`;
    body.innerHTML = `<p class="preference-help${favorites ? '' : ' strict'}">${favorites ? 'Ces choix font remonter les recettes correspondantes. Ils ne créent pas de contrainte médicale.' : 'Un aliment simplement évité n’est pas traité comme une allergie. Une adaptation n’est proposée que si elle est validée éditorialement.'}</p>${selected}<label class="preference-search" for="preferenceSearchInput"><span class="sr-only">Rechercher ou ajouter</span><input id="preferenceSearchInput" type="search" autocomplete="off" placeholder="Rechercher ou ajouter un aliment" oninput="preferenceSearch('${kind}',this)" onkeydown="if(event.key==='Enter'){event.preventDefault();addFreeProfilePreference('${kind}')}"><button id="preferenceFreeAdd" type="button" disabled onclick="addFreeProfilePreference('${kind}')">Ajouter</button></label><div class="${favorites ? 'preference-visual-grid' : 'preference-option-grid'}">${uniqueChoices.map(([value,label,recipeId]) => preferenceOption(kind, value, label, favorites && recipeId ? onboardingRecipeImage(recipeId, 'preference-choice-image') : '')).join('')}</div>`;
  }

  function openPreferenceEditor(kind) {
    if (!['diet', 'allergies', 'avoid', 'favorites'].includes(kind)) return;
    ensureFullPanels();
    state.preferenceEditor = kind;
    renderPreferenceEditor();
    document.getElementById('preferencesPanel').classList.add('open');
    scheduleQa();
  }

  function closePreferenceEditor() {
    closeFullPanel('preferencesPanel');
    state.preferenceEditor = null;
    render();
  }

  function renderPreferencesScreen() { renderPreferenceEditor(); }
  function openPreferencesScreen() { openPreferenceEditor('allergies'); }
  function openTasteFromPreferences(group) { openPreferenceEditor(group === 'adored' || group === 'liked' ? 'favorites' : group); }

  function showProfileSummary() {
    const panel = document.getElementById('expressPanel');
    const auth = localAuthLoad();
    document.getElementById('expressTitle').textContent = 'Tout est prêt.';
    document.getElementById('expressProgress').style.width = '100%';
    document.getElementById('wizardBody').innerHTML = `<div class="profile-summary-view"><p class="eyebrow">Votre profil</p><h3>Tout est prêt.</h3><p>Vérifiez vos choix. Chaque élément reste modifiable dans Profil.</p><div class="summary-card-final"><div class="summary-line-final"><i>${PROFILE.householdSize}</i><span><strong>Foyer</strong><small>${PROFILE.householdSize} personne${PROFILE.householdSize > 1 ? 's' : ''}</small></span><button onclick="closeProfileSummary();setTab('profile')">Modifier</button></div><div class="summary-line-final"><i>♡</i><span><strong>Goûts</strong><small>${escapeHtml([...PROFILE.adored, ...PROFILE.liked].slice(0, 3).join(', ') || 'À compléter')}</small></span><button onclick="closeProfileSummary();setTab('profile')">Modifier</button></div><div class="summary-line-final"><i>!</i><span><strong>À éviter</strong><small>${escapeHtml(PROFILE.avoid.slice(0, 3).join(', ') || 'Aucun')}</small></span><button onclick="closeProfileSummary();openPreferencesScreen()">Modifier</button></div><div class="summary-line-final"><i>−</i><span><strong>Allergies</strong><small>${escapeHtml(PROFILE.allergies.slice(0, 3).join(', ') || 'Aucune')}</small></span><button onclick="closeProfileSummary();openPreferencesScreen()">Modifier</button></div></div><p class="capture-note">Connecté comme ${escapeHtml(auth?.profile?.name || 'Camille')} · appareil local.</p></div>`;
    document.getElementById('wizardBack').style.display = 'none';
    const next = document.getElementById('wizardNext');
    next.textContent = 'Entrer dans Mon Panier';
    next.onclick = closeProfileSummary;
    panel.classList.add('open');
    scheduleQa();
  }

  function closeProfileSummary() {
    const panel = document.getElementById('expressPanel');
    panel.classList.remove('open');
    document.getElementById('wizardBack').style.display = '';
    document.getElementById('wizardNext').onclick = wizardNext;
    document.getElementById('expressTitle').textContent = 'Mieux choisir vos recettes';
    state.tab = 'discover';
    state.detail = null;
    render();
  }

  const coreWizardNext = wizardNext;
  wizardNext = function fullAppWizardNext() {
    const finalStep = state.wizardStep === WIZARD_STEPS.length - 1;
    coreWizardNext();
    if (finalStep) setTimeout(showProfileSummary, 0);
  };

  function serializeAppState() {
    syncActiveGroceryListFromState();
    return {
      schemaVersion: 4,
      tab: state.tab,
      detail: state.detail,
      libraryView: state.libraryView,
      librarySearch: state.librarySearch,
      libraryCollection: state.libraryCollection,
      favorites: [...state.favorites],
      cart: [...state.cart],
      archived: state.archived,
      choiceCounts: [...state.choiceCounts],
      groceries: state.groceries,
      groceryLists: state.groceryLists,
      activeGroceryListId: state.activeGroceryListId,
      groceryView: state.groceryView === 'detail' ? 'detail' : 'hub',
      pantryReminders: state.pantryReminders || [],
      manualGroceries: state.manualGroceries,
      checked: [...state.checked],
      photoSubmissions: [...state.photoSubmissions],
      cartVersions: [...state.cartVersions],
      savedAt: new Date().toISOString(),
    };
  }

  function persistAppState() {
    if (new URLSearchParams(location.search).get('demo') === '1') return;
    try { localStorage.setItem(APP_STATE_KEY, JSON.stringify(serializeAppState())); } catch (error) { console.warn('État local non enregistré', error); }
  }

  function restoreAppState() {
    if (new URLSearchParams(location.search).get('demo') === '1') return;
    try {
      const saved = JSON.parse(localStorage.getItem(APP_STATE_KEY) || 'null');
      if (!saved || ![1, 2, 3, 4].includes(saved.schemaVersion)) return;
      const validId = id => Boolean(recipe(id));
      state.tab = ['discover', 'favorites', 'cart', 'groceries', 'profile', 'archives'].includes(saved.tab) ? saved.tab : 'discover';
      state.detail = saved.detail && validId(saved.detail.id) ? saved.detail : null;
      state.libraryView = saved.libraryView === 'personal' ? 'personal' : 'favorites';
      state.librarySearch = typeof saved.librarySearch === 'string' ? saved.librarySearch : '';
      state.libraryCollection = typeof saved.libraryCollection === 'string' ? saved.libraryCollection : 'all';
      state.favorites = new Set((saved.favorites || []).filter(validId));
      state.cart = new Map((saved.cart || []).filter(([id]) => validId(id)));
      state.archived = Array.isArray(saved.archived) ? saved.archived.map(archive => ({ ...archive, items: (archive.items || []).filter(([id]) => validId(id)) })) : state.archived;
      state.choiceCounts = new Map((saved.choiceCounts || []).filter(([id]) => validId(id)));
      state.groceries = Array.isArray(saved.groceries) ? saved.groceries : [];
      state.groceryLists = Array.isArray(saved.groceryLists) ? saved.groceryLists : [];
      state.activeGroceryListId = typeof saved.activeGroceryListId === 'string' ? saved.activeGroceryListId : '';
      state.groceryView = saved.groceryView === 'detail' ? 'detail' : 'hub';
      state.pantryReminders = Array.isArray(saved.pantryReminders) ? [...saved.pantryReminders] : [];
      state.manualGroceries = Array.isArray(saved.manualGroceries) ? saved.manualGroceries : [];
      state.checked = new Set(saved.checked || []);
      state.photoSubmissions = new Set((saved.photoSubmissions || []).filter(validId));
      // Les variantes globales d'anciennes versions sont migrées vers le Panier
      // puis purgées par initializeMealLists(). Elles ne sont plus sauvegardées.
      state.variants = new Map((saved.variants || []).filter(([id]) => validId(id)));
      state.cartVersions = new Map((saved.cartVersions || []).filter(([id]) => validId(id)));
    } catch (error) { console.warn('État local ignoré', error); }
  }

  let qaTimer = 0;
  function scheduleQa() {
    clearTimeout(qaTimer);
    delete document.body.dataset.qa;
    qaTimer = setTimeout(async () => {
      const root = document.querySelector('.overlay.open') || (document.getElementById('authGate')?.classList.contains('open') ? document.getElementById('authGate') : document);
      await Promise.all([...root.querySelectorAll('img')].map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = img.onerror = resolve; })));
      const errors = [];
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) errors.push('overflow');
      if ([...root.querySelectorAll('img')].some(img => !img.complete || !img.naturalWidth)) errors.push('image');
      const small = [...root.querySelectorAll('button')].filter(button => {
        const rect = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && (rect.width < 40 || rect.height < 40);
      });
      if (small.length) errors.push(`small-target:${small.length}`);
      document.body.dataset.qa = errors.length ? `FAIL:${errors.join(',')}` : 'PASS';
      document.body.dataset.design = 'full-app-functional-v1';
      document.body.dataset.recipes = '360';
      document.body.dataset.media = '743';
    }, 450);
  }

  const RECIPE_PHOTO_SELECTOR = '.phone img';
  let recipePhotoProtectionBound = false;
  function preventRecipePhotoSaving() {
    if (!recipePhotoProtectionBound) {
      const blockImageAction = event => {
        const target = event.target;
        if (target instanceof Element && target.closest(RECIPE_PHOTO_SELECTOR)) event.preventDefault();
      };
      document.addEventListener('contextmenu', blockImageAction, true);
      document.addEventListener('dragstart', blockImageAction, true);
      document.addEventListener('selectstart', blockImageAction, true);
      recipePhotoProtectionBound = true;
    }
    document.querySelectorAll(RECIPE_PHOTO_SELECTOR).forEach(image => {
      image.draggable = false;
      image.setAttribute('draggable', 'false');
    });
  }

  const coreRender = render;
  render = function fullAppRender() {
    const result = coreRender();
    preventRecipePhotoSaving();
    persistAppState();
    scheduleQa();
    return result;
  };

  function normalizeRecipeNavigationIds(ids = [], fallbackId = '') {
    const valid = [...new Set((Array.isArray(ids) ? ids : []).filter(id => recipe(id)))];
    if (fallbackId && recipe(fallbackId) && !valid.includes(fallbackId)) valid.push(fallbackId);
    return valid.length ? valid : (recipe(fallbackId) ? [fallbackId] : []);
  }

  function openDetailWithRecipeNavigation(id, origin, navigationIds) {
    const r = recipe(id);
    if (!r) return false;
    const inherited = navigationIds == null ? state.detail?.navigation?.ids : navigationIds;
    const ids = normalizeRecipeNavigationIds(inherited, id);
    const returnScrollTop = Number.isFinite(state.detail?.returnScrollTop)
      ? state.detail.returnScrollTop
      : Math.max(0, screen?.scrollTop || 0);
    state.detail = {
      id,
      origin: origin || state.tab,
      returnScrollTop,
      servings: state.cart.get(id) || PROFILE.householdSize,
      navigation: { ids, index: Math.max(0, ids.indexOf(id)) },
    };
    render();
    screen.scrollTop = 0;
    return true;
  }

  openDetail = openDetailWithRecipeNavigation;
  window.openDetail = openDetailWithRecipeNavigation;

  function moveRecipeDetail(direction) {
    const detail = state.detail;
    if (!detail) return false;
    const ids = normalizeRecipeNavigationIds(detail.navigation?.ids, detail.id);
    const index = ids.indexOf(detail.id);
    const nextId = ids[index + direction];
    if (!nextId) {
      if (direction < 0) {
        closeDetail();
        return true;
      }
      return false;
    }
    return openDetailWithRecipeNavigation(nextId, detail.origin, ids);
  }

  function bindRecipeDetailSwipe() {
    if (!screen || screen.dataset.recipeSwipeBound === 'true') return;
    screen.dataset.recipeSwipeBound = 'true';
    const swipe = { pointerId: null, startX: 0, startY: 0, detailId: '' };
    const reset = () => {
      swipe.pointerId = null;
      swipe.startX = 0;
      swipe.startY = 0;
      swipe.detailId = '';
    };
    screen.addEventListener('pointerdown', event => {
      if (!state.detail || event.isPrimary === false || event.pointerType === 'mouse') return;
      const target = event.target instanceof Element ? event.target : null;
      const detail = target?.closest('.detail-immersive');
      if (!detail || target.closest('button,a,input,textarea,select,[contenteditable="true"],[data-no-recipe-swipe]')) return;
      swipe.pointerId = event.pointerId;
      swipe.startX = event.clientX;
      swipe.startY = event.clientY;
      swipe.detailId = state.detail.id;
    }, { passive: true });
    screen.addEventListener('pointerup', event => {
      if (swipe.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - swipe.startX;
      const deltaY = event.clientY - swipe.startY;
      const sameDetail = swipe.detailId === state.detail?.id;
      reset();
      if (!sameDetail || Math.abs(deltaX) < 56 || !(Math.abs(deltaX) > Math.abs(deltaY))) return;
      moveRecipeDetail(deltaX < 0 ? 1 : -1);
    }, { passive: true });
    screen.addEventListener('pointercancel', reset, { passive: true });
  }

  bindRecipeDetailSwipe();

  function seedDemoCart() {
    state.cart.clear();
    state.cartVersions.clear();
    state.groceries = [];
    state.pantryReminders = [];
    state.manualGroceries = [];
    state.checked.clear();
    addCart('r-v3-007-shakshuka-douce-aux-poivrons', 2);
    addCart('r-v3-017-poulet-roti-au-citron-thym-et-pommes-de-terre', 4);
  }

  function ensureDemoAuth() {
    localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify({ provider: 'demo', email: 'demo@local.test', profile: { id: 'profile-local-private', name: 'Camille', visibility: 'private' }, verified: true, localOnly: true }));
  }

  function openDemoRoute(name) {
    closeFullPanel('sharePanel');
    closeFullPanel('preferencesPanel');
    document.querySelectorAll('.overlay.open').forEach(panel => panel.classList.remove('open'));
    if (name === 'auth') {
      localStorage.removeItem(LOCAL_AUTH_KEY);
      state.tab = 'discover';
      state.detail = null;
      render();
      return;
    }
    ensureDemoAuth();
    switch (name) {
      case 'discover': setTab('discover'); break;
      case 'all': state.tab = 'discover'; state.detail = null; state.browseShelf = 'featured'; render(); break;
      case 'favorites': setTab('favorites'); break;
      case 'detail': openDetail('r-v3-007-shakshuka-douce-aux-poivrons'); break;
      case 'version': openDetail('r-v3-007-shakshuka-douce-aux-poivrons'); requestAnimationFrame(() => openVersionEditor('r-v3-007-shakshuka-douce-aux-poivrons')); break;
      case 'cook': openDetail('r-v3-007-shakshuka-douce-aux-poivrons'); requestAnimationFrame(() => openCooking('r-v3-007-shakshuka-douce-aux-poivrons')); break;
      case 'cart': seedDemoCart(); setTab('cart'); break;
      case 'groceries': seedDemoCart(); generateGroceries(); break;
      case 'share': seedDemoCart(); generateGroceries(); requestAnimationFrame(openShareScreen); break;
      case 'archives': setTab('archives'); break;
      case 'profile': setTab('profile'); break;
      case 'preferences': setTab('profile'); requestAnimationFrame(openPreferencesScreen); break;
      case 'onboarding': showProfileSummary(); break;
      case 'create': setTab('favorites'); state.libraryView = 'personal'; render(); requestAnimationFrame(openCreateRecipe); break;
      default: setTab('discover'); break;
    }
  }

  Object.assign(window, {
    closeFullPanel,
    openShareScreen,
    shareInvite,
    shareJoin,
    shareActor,
    shareStop,
    openPreferencesScreen,
    renderPreferencesScreen,
    openTasteFromPreferences,
    openPreferenceEditor,
    closePreferenceEditor,
    localProfileNameAutoSave,
    setDietPreference,
    setAvoidLevel,
    toggleProfilePreference,
    applyPreferenceAdaptation,
    clearProfileAllergies,
    preferenceSearch,
    addFreeProfilePreference,
    showProfileSummary,
    closeProfileSummary,
  });

  /* useful-onboarding-v1:start */
  const ONBOARDING_KEY = 'mon-panier-onboarding-useful-v1';
  const ONBOARDING_STEPS = 6;
  const TASTE_CHOICES = [
    ['tomate','Tomate','r-v3-067-spaghetti-sauce-tomate-et-basilic'],
    ['poulet','Poulet','r-v3-017-poulet-roti-au-citron-thym-et-pommes-de-terre'],
    ['champignon','Champignons','r-v3-114-risotto-aux-champignons'],
    ['chocolat','Chocolat','r-v3-147-mousse-au-chocolat'],
    ['pomme de terre','Pommes de terre','r-v3-077-gratin-dauphinois'],
    ['mozzarella','Mozzarella','r-v3-111-pizza-margherita'],
    ['lentille','Lentilles','r-v3-002-curry-de-lentilles-corail-aux-epinards'],
    ['poisson','Poisson','r-v3-133-fish-and-chips'],
    ['oeuf','Œufs','r-v3-065-omelette-jambon-fromage'],
    ['riz','Riz','r-v3-074-riz-a-la-tomate-et-oeuf'],
    ['courgette','Courgettes','r-v3-170-gratin-de-ravioles-aux-courgettes'],
    ['pois chiche','Pois chiches','r-v3-057-salade-de-pois-chiches-concombre-et-tomate'],
    ['saumon','Saumon','r-v3-027-gratin-de-saumon-poireaux-et-pommes-de-terre'],
    ['brocoli','Brocoli','r-v3-045-pates-au-brocoli-citron-et-parmesan'],
    ['coco','Coco','r-v3-161-dahl-de-pois-chiches-au-lait-de-coco'],
    ['pomme','Pommes','r-v3-149-tarte-aux-pommes'],
    ['banane','Banane','r-v3-139-porridge-banane-et-cannelle'],
    ['aubergine','Aubergines','r-v3-113-aubergines-a-la-parmigiana'],
    ['crevette','Crevettes','r-v3-132-paella-poulet-et-crevettes'],
    ['pâtes','Pâtes','r-v3-069-spaghetti-carbonara'],
    ['boeuf','Bœuf','r-v3-092-boeuf-bourguignon'],
    ['avocat','Avocat','r-v3-208-guacamole-et-tortilla-chips'],
    ['carotte','Carottes','r-v3-054-veloute-de-carottes-gingembre-et-coco'],
    ['épinard','Épinards','r-v3-047-lasagnes-aux-epinards-et-a-la-ricotta']
  ];
  const AVOID_CHOICES = TASTE_CHOICES.map(choice => [...choice]);
  const ALLERGY_CHOICES = [['cereales_contenant_du_gluten','Gluten'],['lait','Lait'],['oeufs','Œufs'],['arachides','Arachides'],['fruits_a_coque','Fruits à coque'],['poissons','Poisson'],['crustaces','Crustacés'],['soja','Soja'],['graines_de_sesame','Sésame'],['moutarde','Moutarde']];
  const ONBOARDING_HERO_IDS = ['r-v3-069-spaghetti-carbonara','r-v3-002-curry-de-lentilles-corail-aux-epinards','r-v3-137-pancakes-moelleux'];
  const onboardingSearch = { adored: '', avoid: '', strictAvoid: '' };
  let onboardingStep = 0;
  let onboardingForceOpen = false;
  let onboardingDismissed = false;
  let onboardingDraft = null;

  function onboardingLoad() {
    try { return JSON.parse(localStorage.getItem(ONBOARDING_KEY)) || {}; } catch { return {}; }
  }
  function onboardingSave(value) { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(value)); }
  const initialOnboarding = onboardingLoad();
  PROFILE.diet = initialOnboarding.diet || PROFILE.diet || 'none';

  let storedFoodProfile = null;
  try { storedFoodProfile = JSON.parse(localStorage.getItem('mon-panier-profile-v1') || 'null'); } catch {}
  PROFILE.strictAvoid = Array.isArray(storedFoodProfile?.strictAvoid)
    ? storedFoodProfile.strictAvoid.filter(value => typeof value === 'string').slice(0, 50)
    : [];
  PROFILE.avoid = PROFILE.avoid.filter(value => !PROFILE.strictAvoid.some(strict => preferenceKey(strict) === preferenceKey(value)));
  normalizeProfilePreferenceConflicts(PROFILE);
  saveProfile();
  profileCompatible = function usefulOnboardingProfileCompatible(r) {
    const assessment = PERSONALIZATION_CORE.assessRecipe(r, {
      avoid: PROFILE.avoid,
      strictAvoid: PROFILE.strictAvoid,
    });
    if (!assessment.compatible) return false;
    const text = normalizeSearch(ingredientText(r));
    const recipeAllergens = recipeAllergenKeys(r);
    if (PROFILE.allergies.some(value => {
      const keys = allergyKeysFor(value);
      return keys.some(key => recipeAllergens.has(key)) || (!keys.length && text.includes(normalizeSearch(value)));
    })) return false;
    if (PROFILE.diet === 'vegetarian') return r.tags.includes('vegetarien') || r.tags.includes('vegetalien');
    if (PROFILE.diet === 'vegan') return r.tags.includes('vegetalien');
    return true;
  };

  function personalizationAssessment(r) {
    return PERSONALIZATION_CORE.assessRecipe(r, {
      avoid: PROFILE.avoid,
      strictAvoid: PROFILE.strictAvoid,
    });
  }

  const baseRecommendationScore = recommendationScore;
  recommendationScore = function personalizedRecommendationScore(r) {
    const base = baseRecommendationScore(r);
    return base + PERSONALIZATION_CORE.preferenceScore(r, {
      adored: PROFILE.adored,
      liked: PROFILE.liked,
      avoid: PROFILE.avoid,
    });
  };

  const baseSortVisual = sortVisual;
  sortVisual = function personalizedSortVisual(list) {
    return [...list].sort((left, right) => {
      const preferenceDelta = recommendationScore(right) - recommendationScore(left);
      return preferenceDelta || baseSortVisual([left, right]).indexOf(left) - baseSortVisual([left, right]).indexOf(right);
    });
  };

  function profileHasPersonalSignals() {
    return Boolean(
      PROFILE.adored?.length
      || PROFILE.liked?.length
      || PROFILE.avoid?.length
      || PROFILE.strictAvoid?.length
      || PROFILE.allergies?.length
      || PROFILE.diet !== 'none',
    );
  }

  function recommendationProfile() {
    return {
      adored: [...(PROFILE.adored || [])],
      liked: [...(PROFILE.liked || [])],
      avoid: [...(PROFILE.avoid || [])],
      strictAvoid: [...(PROFILE.strictAvoid || [])],
    };
  }

  recommendations = function personalizedRecommendations() {
    const excluded = typeof discoveryExcludedIds === 'function' ? discoveryExcludedIds() : new Set();
    const pool = EDITORIAL_RECIPES.filter(profileCompatible);
    return PERSONALIZATION_CORE.rankRecipes(pool, recommendationProfile(), {
      excludedIds: excluded,
      limit: 24,
      rotationBucket: Math.floor(Date.now() / (6 * 60 * 60 * 1000)),
    });
  };

  const baseHomeShelfRowsForPersonalization = homeShelfRows;
  homeShelfRows = function personalizedHomeShelfRows(now = Date.now()) {
    const rows = baseHomeShelfRowsForPersonalization(now);
    if (!profileHasPersonalSignals()) return rows;
    const recommended = rows.find(row => row.shelf.id === 'recommended');
    if (!recommended) return rows;

    const orderedRows = [recommended, ...rows.filter(row => row !== recommended)];
    const recommendationPool = [...recommendations(), ...(recommended.full || [])];
    const used = new Set();
    return orderedRows.map(row => {
      const candidates = row.shelf.id === 'recommended'
        ? recommendationPool
        : [...(row.shown || []), ...(row.full || [])];
      const limit = row.shelf.id === 'recommended'
        ? Math.min(7, candidates.length)
        : Math.min(row.shelf.limit || 12, candidates.length);
      const shown = [];
      for (const candidate of candidates) {
        if (!candidate || used.has(candidate.id)) continue;
        used.add(candidate.id);
        shown.push(candidate);
        if (shown.length >= limit) break;
      }
      return { ...row, shown };
    }).filter(row => row.shown.length);
  };

  function removeOnboardingPreferenceIdentity(draft, value, groups = ['adored', 'liked', 'avoid', 'strictAvoid']) {
    const identity = preferenceKey(value);
    groups.forEach(group => {
      if (Array.isArray(draft[group])) draft[group] = draft[group].filter(item => preferenceKey(item) !== identity);
    });
  }
  function normalizeProfilePreferenceConflicts(profile) {
    const strictIds = new Set((profile.strictAvoid || []).map(preferenceKey));
    profile.avoid = (profile.avoid || []).filter(value => !strictIds.has(preferenceKey(value)));
    const avoidedIds = new Set([...(profile.avoid || []), ...(profile.strictAvoid || [])].map(preferenceKey));
    profile.adored = (profile.adored || []).filter(value => !avoidedIds.has(preferenceKey(value)));
    profile.liked = (profile.liked || []).filter(value => !avoidedIds.has(preferenceKey(value)));
    return profile;
  }
  function normalizeOnboardingPreferenceConflicts(draft) {
    const strictIds = new Set((draft.strictAvoid || []).map(preferenceKey));
    draft.avoid = (draft.avoid || []).filter(value => !strictIds.has(preferenceKey(value)));
    const avoidedIds = new Set([...(draft.avoid || []), ...(draft.strictAvoid || [])].map(preferenceKey));
    draft.adored = (draft.adored || []).filter(value => !avoidedIds.has(preferenceKey(value)));
    draft.liked = (draft.liked || []).filter(value => !avoidedIds.has(preferenceKey(value)));
    return draft;
  }
  function ensureOnboardingDraft() {
    if (onboardingDraft) return onboardingDraft;
    onboardingDraft = {
      diet: PROFILE.diet || 'none', householdSize: PROFILE.householdSize,
      allergies: [...PROFILE.allergies], avoid: [...PROFILE.avoid], strictAvoid: [...PROFILE.strictAvoid],
      adored: [...PROFILE.adored], liked: [...PROFILE.liked],
    };
    return normalizeOnboardingPreferenceConflicts(onboardingDraft);
  }
  function draftDietCompatible(r, draft) {
    if (draft.diet === 'vegetarian' && !(r.tags.includes('vegetarien') || r.tags.includes('vegetalien'))) return false;
    if (draft.diet === 'vegan' && !r.tags.includes('vegetalien')) return false;
    const text = normalizeSearch(ingredientText(r));
    if (draft.strictAvoid.some(value => text.includes(normalizeSearch(value)))) return false;
    const allergens = recipeAllergenKeys(r);
    return !draft.allergies.some(value => allergyKeysFor(value).some(key => allergens.has(key)));
  }
  function onboardingCompatibleCount() { const draft = ensureOnboardingDraft(); return EDITORIAL_RECIPES.filter(r => draftDietCompatible(r, draft)).length; }
  function onboardingRenderPreservingFocus() {
    const active = document.activeElement;
    const focusId = active?.classList?.contains('onboarding-search') ? active.id : '';
    const selection = focusId ? [active.selectionStart, active.selectionEnd] : null;
    const onboardingBody = document.querySelector('.onboarding-body');
    const scrollTop = onboardingBody?.scrollTop || 0;
    renderAuthGate();
    requestAnimationFrame(() => {
      const nextBody = document.querySelector('.onboarding-body');
      if (nextBody) nextBody.scrollTop = scrollTop;
      if (!focusId) return;
      const input = document.getElementById(focusId);
      if (!input) return;
      input.focus({preventScroll:true});
      if (selection && selection[0] !== null) input.setSelectionRange(selection[0], selection[1]);
    });
  }
  function onboardingToggle(group, value) {
    const draft = ensureOnboardingDraft();
    if (group === 'diet') draft.diet = value;
    else {
      const index = draft[group].findIndex(item => preferenceKey(item) === preferenceKey(value));
      if (index >= 0) draft[group].splice(index, 1);
      else {
        if (['adored', 'avoid', 'strictAvoid'].includes(group)) {
          removeOnboardingPreferenceIdentity(draft, value, ['adored', 'liked', 'avoid', 'strictAvoid']);
        }
        draft[group].push(value);
      }
    }
    onboardingRenderPreservingFocus();
  }
  function onboardingFilter(group, input) {
    onboardingSearch[group] = input.value;
    const query = normalizeSearch(input.value.trim());
    const grid = document.querySelector(`[data-onboarding-grid="${group}"]`);
    if (!grid) return;
    grid.querySelectorAll('[data-choice-search]').forEach(button => {
      button.hidden = Boolean(query) && !button.dataset.choiceSearch.includes(query);
    });
  }
  function onboardingHousehold(delta) {
    const draft = ensureOnboardingDraft();
    draft.householdSize = Math.max(1, Math.min(8, draft.householdSize + delta));
    onboardingRenderPreservingFocus();
  }
  function onboardingClearAllergies() { ensureOnboardingDraft().allergies = []; onboardingRenderPreservingFocus(); }
  function onboardingClearAvoid() { const draft = ensureOnboardingDraft(); draft.avoid = []; draft.strictAvoid = []; onboardingRenderPreservingFocus(); }
  function onboardingNext() { if (onboardingStep < ONBOARDING_STEPS - 1) { onboardingStep++; renderAuthGate(); } }
  function onboardingDestinationLabel() {
    return ({ discover: 'Découvrir', favorites: 'Favoris', cart: 'Mon panier', groceries: 'Courses', profile: 'Profil', archives: 'Derniers paniers' })[state.tab] || 'Découvrir';
  }
  function onboardingBackLabel() {
    if (onboardingStep === 0) return onboardingDestinationLabel();
    return ({ 1: 'Les repas', 2: 'Alimentation', 3: 'Sécurité', 4: 'Goûts favoris', 5: 'Portions' })[onboardingStep] || 'Retour';
  }
  function onboardingBack() {
    if (onboardingStep > 0) {
      onboardingStep--;
      renderAuthGate();
      return;
    }
    onboardingForceOpen = false;
    onboardingDismissed = true;
    render();
  }
  function onboardingSkip() { onboardingNext(); }
  function openProfileOnboarding() {
    onboardingForceOpen = true;
    onboardingDismissed = false;
    onboardingStep = 0;
    onboardingDraft = null;
    onboardingSearch.adored = '';
    onboardingSearch.avoid = '';
    onboardingSearch.strictAvoid = '';
    renderAuthGate();
  }
  function commitOnboarding() {
    const draft = normalizeOnboardingPreferenceConflicts(ensureOnboardingDraft());
    PROFILE.diet = draft.diet;
    PROFILE.householdSize = draft.householdSize;
    PROFILE.allergies = [...draft.allergies];
    PROFILE.avoid = [...draft.avoid];
    PROFILE.strictAvoid = [...draft.strictAvoid];
    PROFILE.adored = [...draft.adored];
    PROFILE.liked = [...draft.liked];
    normalizeProfilePreferenceConflicts(PROFILE);
    PROFILE.setupComplete = true;
    saveProfile();
    onboardingForceOpen = false;
    onboardingDismissed = false;
    onboardingSave({complete:true,diet:PROFILE.diet,accountPrompt:false,completedAt:new Date().toISOString()});
  }
  function onboardingFinish(mode) {
    commitOnboarding();
    if (mode === 'apple' || mode === 'google') return localSocialAuth(mode);
    if (mode === 'email') return localRequestOtp();
    toast('Vos choix sont enregistrés');
    render();
  }
  function onboardingAccountLater() {
    const entry = onboardingLoad(); entry.accountPrompt = false; entry.accountPromptReason = null; entry.accountPromptFavoriteId = null; onboardingSave(entry); render();
  }
  function setAccountPrompt(reason, extra = {}) {
    toastEl.classList.remove('show');
    const entry = onboardingLoad(); entry.accountPrompt = true; entry.accountPromptReason = reason; entry.accountPromptFavoriteId = extra.favoriteId || null; onboardingSave(entry); render();
  }
  function requestAccountForShare() { setAccountPrompt('share'); }
  function requestAccountForFavorite(id) { setAccountPrompt('favorite', {favoriteId:id}); }
  function requestAccountForCreateRecipe() { setAccountPrompt('create_recipe'); }

  function selectedClass(group, value) {
    const draft = ensureOnboardingDraft();
    return (group === 'diet' ? draft.diet === value : draft[group].some(item => preferenceKey(item) === preferenceKey(value))) ? ' selected' : '';
  }
  function onboardingChoice(group, value, label, extra = '') {
    return `<button type="button" class="onboarding-choice${selectedClass(group,value)} ${extra}" aria-pressed="${selectedClass(group,value) ? 'true' : 'false'}" onclick="onboardingToggle('${group}','${value}')"><span>${label}</span></button>`;
  }
  function onboardingRecipeImage(recipeId, className = '') {
    const item = recipe(recipeId);
    if (!item?.image) return '';
    return `<img class="${className}" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" width="480" height="360">`;
  }
  function onboardingMealMosaic(context = 'onboarding') {
    return `<div class="meal-mosaic ${context}" data-od-id="${context}-meal-mosaic" aria-label="Trois idées de plats finis">${ONBOARDING_HERO_IDS.map((id,index) => `<figure class="meal-mosaic-item meal-${index + 1}">${onboardingRecipeImage(id,'meal-mosaic-image')}</figure>`).join('')}</div>`;
  }
  function onboardingChoiceGrid(group, choices) {
    const query = normalizeSearch(onboardingSearch[group].trim());
    return `<div class="onboarding-taste-grid" data-onboarding-grid="${group}" data-od-id="${group}-choices">${choices.map(([value,label,recipeId], index) => {
      const searchText = normalizeSearch(`${value} ${label}`);
      const hidden = query && !searchText.includes(query) ? ' hidden' : '';
      return `<button type="button" class="onboarding-taste${selectedClass(group,value)}" data-choice-search="${escapeHtml(searchText)}" data-choice-index="${index}" aria-pressed="${selectedClass(group,value) ? 'true' : 'false'}" onclick="onboardingToggle('${group}','${value}')"${hidden}>${onboardingRecipeImage(recipeId,'onboarding-taste-image')}<span>${label}</span></button>`;
    }).join('')}</div>`;
  }
  function onboardingSearchField(group, placeholder) {
    const id = group === 'adored' ? 'onboardingTasteSearch' : 'onboardingAvoidSearch';
    return `<label class="onboarding-search-wrap" for="${id}"><span class="sr-only">Rechercher</span><input id="${id}" class="onboarding-search" type="search" inputmode="search" autocomplete="off" value="${escapeHtml(onboardingSearch[group])}" placeholder="${placeholder}" oninput="onboardingFilter('${group}',this)"></label>`;
  }
  function onboardingShell(title, copy, body, options = {}) {
    const progress = Math.round(((onboardingStep + 1) / ONBOARDING_STEPS) * 100);
    const nextLabel = options.nextLabel || 'Continuer';
    const eyebrow = options.eyebrow ? `<p class="eyebrow">${options.eyebrow}</p>` : '';
    return `<div class="onboarding-shell" data-onboarding-step="${onboardingStep}" data-od-id="onboarding-step-${onboardingStep}"><div class="onboarding-top"><button type="button" class="onboarding-back-link" data-onboarding-back-label="${escapeHtml(onboardingBackLabel())}" onclick="onboardingBack()" aria-label="Retour à ${escapeHtml(onboardingBackLabel())}">${icon('back')}<span>${escapeHtml(onboardingBackLabel())}</span></button><div class="onboarding-progress" aria-label="Progression"><span style="width:${progress}%"></span></div>${options.skippable === false ? '<span class="onboarding-skip-spacer"></span>' : '<button type="button" class="onboarding-skip" onclick="onboardingSkip()">Passer</button>'}</div><div class="onboarding-copy">${eyebrow}<h1 id="authGateTitle" data-od-id="onboarding-title">${title}</h1><p>${copy}</p></div><div class="onboarding-body">${body}</div>${options.hideFooter ? '' : `<div class="onboarding-footer"><span>${options.effect || `${onboardingCompatibleCount()} recettes compatibles`}</span><button type="button" class="onboarding-next" data-od-id="onboarding-next" onclick="onboardingNext()">${nextLabel} <b>→</b></button></div>`}</div>`;
  }
  function onboardingHtml() {
    const draft = ensureOnboardingDraft();
    if (onboardingStep === 0) return onboardingShell('Les repas ? On s’en occupe.', 'Des idées pour la semaine, les bonnes quantités et la liste de courses déjà prête.', `${onboardingMealMosaic()}<div class="onboarding-benefits" aria-label="Bénéfices"><span>Idées adaptées</span><span>Semaine organisée</span><span>Courses prêtes</span></div>`, {skippable:false,effect:'Vos choix restent modifiables'});
    if (onboardingStep === 1) return onboardingShell('Comment mangez-vous ?', 'Ce choix retire les recettes incompatibles du catalogue.', `<div class="onboarding-list">${onboardingChoice('diet','none','Je mange de tout','wide')}${onboardingChoice('diet','vegetarian','Végétarien','wide')}${onboardingChoice('diet','vegan','Végan','wide')}</div>`, {eyebrow:'Alimentation'});
    if (onboardingStep === 2) return onboardingShell('Des allergies ?', 'Elles bloquent strictement les recettes incompatibles ou incertaines.', `<button type="button" class="onboarding-none${draft.allergies.length ? '' : ' selected'}" onclick="onboardingClearAllergies()">Aucune allergie</button><div class="onboarding-chips">${ALLERGY_CHOICES.map(([value,label])=>onboardingChoice('allergies',value,label)).join('')}</div>`, {eyebrow:'Sécurité'});
    if (onboardingStep === 3) return onboardingShell('Qu’est-ce qui vous donne envie ?', 'Choisissez tout ce qui vous plaît. Ces goûts guideront vos idées.', `${onboardingSearchField('adored','Rechercher un goût')}${onboardingChoiceGrid('adored',TASTE_CHOICES)}`, {effect:`${draft.adored.length} goût${draft.adored.length>1?'s':''} sélectionné${draft.adored.length>1?'s':''}`});
    if (onboardingStep === 4) return onboardingShell('Pour combien cuisinez-vous ?', 'Définissez les portions habituelles, puis choisissez ce qui doit seulement être évité ou ne jamais être proposé.', `<div class="onboarding-household" data-od-id="household-stepper"><span><strong>Portions habituelles</strong><small>Modifiables dans chaque recette</small></span><div><button type="button" onclick="onboardingHousehold(-1)" aria-label="Retirer une portion">−</button><b data-household-count>${draft.householdSize}</b><button type="button" onclick="onboardingHousehold(1)" aria-label="Ajouter une portion">+</button></div></div><div class="onboarding-avoid-head"><h2>À éviter si possible</h2><button type="button" onclick="onboardingClearAvoid()">Tout effacer</button></div><p class="wizard-copy">La recette peut rester visible si l’aliment est retirable ou si une adaptation validée existe.</p>${onboardingSearchField('avoid','Rechercher un aliment')}${onboardingChoiceGrid('avoid',AVOID_CHOICES)}<div class="onboarding-avoid-head"><h2>Ne jamais proposer</h2></div><p class="wizard-copy">Exclusion stricte dans les rayons et les recherches. Ce réglage ne remplace jamais une allergie.</p>${onboardingChoiceGrid('strictAvoid',AVOID_CHOICES)}`, {effect:`${draft.avoid.length + draft.strictAvoid.length} aliment${draft.avoid.length + draft.strictAvoid.length > 1 ? 's' : ''} classé${draft.avoid.length + draft.strictAvoid.length > 1 ? 's' : ''}`});
    return onboardingShell('Tout est prêt pour commencer.', 'Vos choix restent personnels et modifiables dans Profil.', `<div class="onboarding-summary"><span><b>${onboardingCompatibleCount()}</b> recettes compatibles</span><span><b>${draft.adored.length}</b> goûts choisis</span><span><b>${draft.householdSize}</b> portion${draft.householdSize>1?'s':''}</span></div><div class="onboarding-access"><button class="onboarding-guest" type="button" data-od-id="continue-as-guest" onclick="onboardingFinish('guest')">Continuer</button></div>`, {hideFooter:true,skippable:false});
  }
  function toggleAccountProviderButtons(enabled) { document.querySelectorAll('[data-account-provider]').forEach(button => { button.disabled = !enabled; }); }
  function accountPromptAuth(mode) {
    const terms = document.getElementById('accountTerms');
    if (!terms?.checked) {
      localAuthError = 'Vous devez accepter les conditions d’utilisation pour continuer.';
      render();
      return false;
    }
    localAuthError = '';
    if (mode === 'apple' || mode === 'google') {
      localSocialAuth(mode);
      return false;
    }
    localRequestOtp();
    return false;
  }
  window.accountPromptAuth = accountPromptAuth;
  function accountPromptHtml() {
    const reason = onboardingLoad().accountPromptReason || 'share';
    const reasonCopy = reason === 'favorite' ? 'Créez votre compte pour enregistrer vos Favoris.' : reason === 'create_recipe' ? 'Créez votre compte pour enregistrer votre recette.' : 'Créez votre compte pour partager vos Courses.';
    const error = localAuthError ? `<p class="auth-entry-error" role="alert">${escapeHtml(localAuthError)}</p>` : '';
    return `<div class="onboarding-shell account-prompt"><div class="onboarding-top"><button type="button" class="onboarding-back" onclick="onboardingAccountLater()" aria-label="Retour">‹</button></div><div class="onboarding-copy"><p class="eyebrow">Votre espace privé</p><h1 id="authGateTitle">Créer un compte</h1><p>${reasonCopy}</p>${error}</div><div class="onboarding-body onboarding-access"><button class="auth-entry-provider apple" type="button" data-account-provider="true" onclick="return accountPromptAuth('apple')">${appleAuthLogo()}<span>Continuer avec Apple</span></button><button class="auth-entry-provider google" type="button" data-account-provider="true" onclick="return accountPromptAuth('google')">${googleAuthLogo()}<span>Continuer avec Google</span></button><div class="auth-entry-separator"><span>ou</span></div><label>Adresse e-mail<input id="localAuthEmail" type="email" placeholder="vous@exemple.fr"></label><button class="onboarding-email" type="button" data-account-provider="true" onclick="return accountPromptAuth('email')">Continuer par e-mail</button><label class="auth-terms"><input id="accountTerms" type="checkbox"> J’accepte les conditions d’utilisation</label><button class="onboarding-guest" type="button" onclick="onboardingAccountLater()">Pas maintenant</button></div></div>`;
  }
  const originalRenderAuthGate = renderAuthGate;
  renderAuthGate = function usefulOnboardingGate() {
    const gate = document.getElementById('authGate');
    const auth = localAuthLoad();
    const entry = onboardingLoad();
    const active = Boolean(auth?.verified && auth?.profile);
    const pending = Boolean(auth?.pending);
    const onboardingPreview = new URLSearchParams(location.search).get(ONBOARDING_PREVIEW_PARAM) === '1';
    const skipOnboardingForDevelopment = DEV_SKIP_ONBOARDING && !onboardingPreview;
    const showOnboarding = !skipOnboardingForDevelopment && !onboardingDismissed && !active && !pending && (onboardingForceOpen || !entry.complete || onboardingPreview);
    const showAccountPrompt = !GUEST_PILOT_MODE && !active && !pending && Boolean(entry.accountPrompt);
    const open = showOnboarding || showAccountPrompt || pending;
    gate.classList.toggle('open', open);
    gate.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('auth-required', open);
    if (pending) gate.innerHTML = authGateHtml();
    else if (showAccountPrompt) gate.innerHTML = accountPromptHtml();
    else if (showOnboarding) gate.innerHTML = onboardingHtml();
    else gate.innerHTML = '';
  };
  const originalOpenShareScreen = openShareScreen;
  openShareScreen = function accountAwareShareScreen() {
    if (!localAuthLoad()?.verified) return requestAccountForShare();
    originalOpenShareScreen();
  };
  Object.assign(window, {
    onboardingToggle, onboardingFilter, onboardingHousehold, onboardingNext, onboardingBack, onboardingSkip,
    onboardingClearAllergies, onboardingClearAvoid, onboardingCompatibleCount, onboardingFinish, openProfileOnboarding,
    onboardingAccountLater, toggleAccountProviderButtons, requestAccountForShare, requestAccountForFavorite, requestAccountForCreateRecipe, openShareScreen
  });
  /* useful-onboarding-v1:end */

  const COOKING_RESUME_KEY = 'mon-panier-cooking-resume-v1';
  function readLocalJson(key, fallback = null) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
  function loadCookingResume() {
    const saved = readLocalJson(COOKING_RESUME_KEY); if (!saved?.id || !recipe(saved.id)) return null;
    const steps = recipe(saved.id).steps || [], max = Math.max(0, steps.length - 1);
    return { ...saved, index: Math.max(0, Math.min(max, Number(saved.index) || 0)), awake: saved.awake !== false, timer: 0, running: false };
  }
  function saveCookingResume() {
    const c = state.cook; if (!c?.id || !recipe(c.id)) return;
    try { localStorage.setItem(COOKING_RESUME_KEY, JSON.stringify({ id: c.id, index: c.index, awake: c.awake !== false, savedAt: new Date().toISOString() })); } catch (error) { console.warn('Reprise cuisine non enregistrée', error); }
  }
  function clearCookingResume() { try { localStorage.removeItem(COOKING_RESUME_KEY); } catch {} }
  const nativeCookMove = window.cookMove;
  const nativeCloseCooking = window.closeCooking;
  const nativeCloseCookingWithToast = window.closeCookingWithToast;
  const nativeToggleAwake = window.toggleAwake;
  window.openCooking = function(id) {
    const resume = loadCookingResume();
    state.cook = resume?.id === id ? resume : { id, index: 0, awake: true, timer: 0, running: false };
    cookPanel.classList.add('open'); window.renderCook?.();
    if (resume?.id === id && resume.index > 0) toast(`Reprise à l’étape ${resume.index + 1}`);
  };
  window.cookMove = function(delta) {
    nativeCookMove?.(delta);
    if (cookPanel.classList.contains('open')) saveCookingResume(); else clearCookingResume();
  };
  window.closeCooking = function() { saveCookingResume(); nativeCloseCooking?.(); };
  window.closeCookingWithToast = function() { saveCookingResume(); nativeCloseCookingWithToast?.(); };
  window.toggleAwake = function() { nativeToggleAwake?.(); saveCookingResume(); };
  state.groceryView = state.groceryView === 'detail' ? 'detail' : 'hub';
  const nativeSetTab = setTab;
  setTab = function fullAppSetTab(tab) {
    if (tab === 'favorites') state.libraryView = 'favorites';
    if (tab === 'groceries') state.groceryView = 'hub';
    nativeSetTab(tab);
  };

  function formatPlanningRange(date = new Date()) {
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const offset = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - offset);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const format = value => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(value);
    return `${format(monday)}–${format(sunday)}`;
  }

  function generatedGroceryListName(recipeCount = 0) {
    const count = Number(recipeCount) || 0;
    const recipeLabel = `${count} recette${count > 1 ? 's' : ''}`;
    return `Planning ${formatPlanningRange()} · ${recipeLabel}`;
  }

  function groceryListSummary(list = {}) {
    const items = Array.isArray(list.items) ? list.items : [];
    const checked = new Set(Array.isArray(list.checked) ? list.checked.map(String) : []);
    const remaining = items.filter(item => !checked.has(localGroceryKey(item))).length;
    return { total: items.length, remaining, complete: items.length > 0 && remaining === 0 };
  }

  function groceryListKindLabel(list = {}) {
    if (list.kind === 'basket') return 'Créée depuis le Panier';
    if (list.id === 'list-default') return 'Liste permanente';
    return 'Liste manuelle';
  }

  function renderGroceryHub() {
    const collection = GROCERY_CORE.ensurePermanentBasketList(currentGroceryListCollection());
    applyGroceryListCollection(collection);
    const cards = collection.lists.map((list, index) => {
      const summary = groceryListSummary(list);
      const detail = summary.total
        ? `${summary.total} produit${summary.total > 1 ? 's' : ''} · ${summary.remaining} restant${summary.remaining > 1 ? 's' : ''} · ${groceryListKindLabel(list)}`
        : groceryListKindLabel(list);
      const safeId = localGroceryInlineKey(list.id);
      const statusMarkup = summary.complete ? '<span class="grocery-list-card-status complete">Terminée</span>' : '';
      return `<article class="grocery-list-card grocery-list-card-${index % 4}" data-grocery-list-id="${escapeHtml(list.id)}"><button class="grocery-list-card-open" type="button" onclick="openGroceryList('${safeId}')" aria-label="Afficher la liste ${escapeHtml(list.name)}"><span class="grocery-list-card-kicker">${escapeHtml(groceryListKindLabel(list))}</span><h2>${escapeHtml(list.name)}</h2><p>${escapeHtml(detail)}</p>${statusMarkup}<span class="grocery-list-card-arrow" aria-hidden="true">→</span></button></article>`;
    }).join('');
    return `<section class="grocery-hub" data-screen="grocery-hub"><div class="grocery-hub-intro"><p class="eyebrow">Vos listes</p><h2>Choisissez une liste</h2><p>Retrouvez vos Courses, créez une liste pour un autre besoin ou préparez un nouveau planning.</p></div><div class="grocery-list-card-grid">${cards}</div></section>`;
  }

  function groceryListDetailHeaderHtml() {
    return `<div class="grocery-detail-nav"><button type="button" class="grocery-back-hub" onclick="openGroceryHub()">${icon('back')}<span>Mes listes</span></button></div>`;
  }

  function grocerySourceRecipesHtml() {
    const active = (state.groceryLists || []).find(list => list.id === state.activeGroceryListId);
    const explicitSelections = Array.isArray(active?.recipeSelections) && active.recipeSelections.length
      ? active.recipeSelections
      : Array.isArray(active?.sourceRecipeSelections) && active.sourceRecipeSelections.length
        ? active.sourceRecipeSelections
        : [];
    const sourceIds = explicitSelections.length
      ? explicitSelections.map(selection => selection.recipeId)
      : (active?.sourceRecipeIds || []);
    const origins = [...new Map(sourceIds.map(id => recipe(id)).filter(Boolean).map(origin => [origin.id, origin])).values()];
    if (!origins.length) return '';
    const recipeThumb = origin => {
      const src = origin.image || origin.detailImage || '';
      return src
        ? `<img class="grocery-source-recipe-thumb" src="${escapeHtml(src)}" alt="" decoding="async">`
        : `<span class="grocery-source-recipe-thumb cover-fallback theme-${origin.coverTheme || 'sage'}" aria-hidden="true"><span class="plate-mark" style="width:26px;height:26px"></span></span>`;
    };
    const navigation = origins.map(item => `'${localGroceryInlineKey(item.id)}'`).join(',');
    const items = origins.map(origin => {
      const safeId = localGroceryInlineKey(origin.id);
      return `<div class="grocery-source-recipe" data-grocery-recipe-id="${escapeHtml(origin.id)}"><button type="button" class="grocery-source-recipe-open" onclick="openDetail('${safeId}','groceries',[${navigation}])"><span class="grocery-source-recipe-main">${recipeThumb(origin)}<span class="grocery-source-recipe-copy"><strong>${escapeHtml(origin.title)}</strong><small>Voir la recette</small></span></span>${icon('chevron')}</button><button type="button" class="grocery-source-recipe-delete" aria-label="Supprimer ${escapeHtml(origin.title)} de la liste" onclick="event.stopPropagation();askDeleteGroceryRecipe('${safeId}')">×</button></div>`;
    }).join('');
    return `<section class="grocery-source-recipes" data-expanded="false"><button type="button" class="grocery-source-toggle" onclick="toggleGrocerySourceRecipes()" aria-expanded="false"><span><strong>Recettes du Panier</strong><small>${origins.length} recette${origins.length > 1 ? 's' : ''}</small></span>${icon('chevron')}</button><div class="grocery-source-recipe-list">${items}</div></section>`;
  }

  window.toggleGrocerySourceRecipes = function() {
    const panel = document.querySelector('.grocery-source-recipes');
    if (!panel) return false;
    const expanded = panel.dataset.expanded === 'true';
    panel.dataset.expanded = String(!expanded);
    panel.querySelector('.grocery-source-toggle')?.setAttribute('aria-expanded', String(!expanded));
    return true;
  };

  function groceryRecipeSelectionsForList(list = {}) {
    const explicit = Array.isArray(list.recipeSelections) && list.recipeSelections.length
      ? list.recipeSelections
      : Array.isArray(list.sourceRecipeSelections) && list.sourceRecipeSelections.length
        ? list.sourceRecipeSelections
        : [];
    const selections = [];
    const seen = new Set();
    const add = raw => {
      const recipeId = String(raw?.recipeId || '').trim();
      const source = recipe(recipeId);
      if (!recipeId || seen.has(recipeId) || !source) return;
      seen.add(recipeId);
      const ingredients = Array.isArray(raw?.ingredients) && raw.ingredients.length
        ? raw.ingredients
        : activeIngredientsForRecipe(source);
      selections.push({
        recipeId,
        servings: Math.max(1, Number(raw?.servings) || source.servings || 1),
        baseServings: Math.max(1, Number(raw?.baseServings) || source.servings || 1),
        ingredients: (ingredients || []).map(ingredient => ({ ...ingredient })),
      });
    };
    explicit.forEach(add);
    if (!explicit.length) (list.sourceRecipeIds || []).forEach(recipeId => add({ recipeId }));
    return selections;
  }

  window.askDeleteGroceryRecipe = function(recipeId) {
    const active = (state.groceryLists || []).find(list => list.id === state.activeGroceryListId);
    const source = recipe(recipeId);
    if (!active || !source || !groceryRecipeSelectionsForList(active).some(selection => selection.recipeId === source.id)) return false;
    openDialog('deleteGroceryRecipe', 'Supprimer cette recette de la liste ?', `« ${source.title} » et ses ingrédients seront retirés de cette liste. La recette restera dans votre Panier.`, 'Supprimer', source.id, 'Garder');
    return true;
  };

  window.deleteGroceryRecipe = function(recipeId) {
    const saved = syncActiveGroceryListFromState();
    const active = saved.lists.find(list => list.id === saved.activeListId);
    const selectedId = String(recipeId || '').trim();
    if (!active || !selectedId) return false;
    const selections = groceryRecipeSelectionsForList(active);
    if (!selections.some(selection => selection.recipeId === selectedId)) return false;
    const result = GROCERY_CORE.removeRecipeFromLocalGroceryList({
      items: active.items,
      checkedKeys: new Set(active.checked),
      recipeId: selectedId,
      remainingSelections: selections,
    });
    const changes = {
      items: result.items,
      checked: [...result.checked],
      recipeSelections: result.sourceRecipeSelections,
      sourceRecipeSelections: result.sourceRecipeSelections,
      sourceRecipeIds: result.sourceRecipeIds,
      history: [...(active.history || []), { type: 'recipe_removed', recipeId: selectedId }],
    };
    const updated = active.id === 'list-default'
      ? GROCERY_CORE.updatePermanentBasketList(saved, changes)
      : GROCERY_CORE.updateGroceryListById(saved, active.id, changes);
    loadActiveGroceryList(updated);
    state.groceryView = 'detail';
    state.tab = 'groceries';
    state.detail = null;
    persistAppState();
    render();
    toast('Recette retirée de la liste');
    return true;
  };

  window.openGroceryHub = function() {
    syncActiveGroceryListFromState();
    state.groceryView = 'hub';
    state.tab = 'groceries';
    state.detail = null;
    persistAppState();
    render();
    screen.scrollTop = 0;
    return true;
  };

  window.openGroceryList = function(listId) {
    const saved = syncActiveGroceryListFromState();
    const switched = GROCERY_CORE.switchGroceryList(saved, listId);
    if (switched.activeListId === saved.activeListId && String(listId) !== saved.activeListId) return false;
    loadActiveGroceryList(switched);
    state.groceryView = 'detail';
    state.tab = 'groceries';
    state.detail = null;
    persistAppState();
    render();
    screen.scrollTop = 0;
    return true;
  };

  function currentGroceryListCollection() {
    return GROCERY_CORE.createGroceryListCollection({
      lists: state.groceryLists,
      activeListId: state.activeGroceryListId,
      legacyItems: state.groceries,
      legacyChecked: [...state.checked],
      legacyPantryReminders: state.pantryReminders,
    });
  }

  function applyGroceryListCollection(collection) {
    state.groceryLists = collection.lists;
    state.activeGroceryListId = collection.activeListId;
  }

  function syncActiveGroceryListFromState(historyEntry = null) {
    const collection = GROCERY_CORE.ensurePermanentBasketList(currentGroceryListCollection());
    const targetId = collection.activeListId || 'list-default';
    const target = collection.lists.find(list => list.id === targetId);
    const changes = {
      items: state.groceries,
      checked: [...state.checked],
      pantryReminders: state.pantryReminders,
      ...(historyEntry ? { history: [...(target?.history || []), { ...historyEntry }] } : {}),
    };
    const updated = targetId === 'list-default'
      ? GROCERY_CORE.updatePermanentBasketList(collection, changes)
      : GROCERY_CORE.updateGroceryListById(collection, targetId, changes);
    applyGroceryListCollection(updated);
    return updated;
  }

  function loadActiveGroceryList(collection = currentGroceryListCollection()) {
    applyGroceryListCollection(collection);
    const active = collection.lists.find(list => list.id === collection.activeListId);
    state.groceries = active ? active.items.map(item => ({ ...item })) : [];
    state.checked = new Set(active?.checked || []);
    state.pantryReminders = active ? [...(active.pantryReminders || [])] : [];
  }

  function migrateGroceryListCollection(collection = currentGroceryListCollection()) {
    let changed = false;
    const lists = collection.lists.map(list => {
      const pantryState = GROCERY_CORE.separatePantryStaples(list.items || [], list.pantryReminders || []);
      const merged = GROCERY_CORE.mergeLocalGroceryItems(pantryState.items);
      const validKeys = new Set(merged.items.map(item => localGroceryKey(item)));
      const checked = [...new Set((list.checked || [])
        .map(key => merged.keyAliases.get(String(key)) || String(key)))]
        .filter(key => validKeys.has(key));
      if (JSON.stringify([list.items || [], list.checked || [], list.pantryReminders || []]) !== JSON.stringify([merged.items, checked, pantryState.pantryReminders])) changed = true;
      return { ...list, items: merged.items, pantryReminders: pantryState.pantryReminders, checked };
    });
    return { collection: { ...collection, lists }, changed };
  }

  function initializeGroceryLists() {
    const collection = GROCERY_CORE.ensurePermanentBasketList(currentGroceryListCollection());
    const migration = migrateGroceryListCollection(collection);
    loadActiveGroceryList(migration.collection);
    if (migration.changed || collection.changed) persistAppState();
  }

  window.switchGroceryList = function(listId) {
    const saved = syncActiveGroceryListFromState();
    const switched = GROCERY_CORE.switchGroceryList(saved, listId);
    if (switched.activeListId === saved.activeListId && String(listId) !== saved.activeListId) return false;
    loadActiveGroceryList(switched);
    state.groceryView = 'detail';
    persistAppState();
    render();
    return true;
  };

  window.openGroceryListCreator = function() {
    const saved = syncActiveGroceryListFromState();
    const maxManualLists = Number(GROCERY_CORE.MAX_MANUAL_GROCERY_LISTS) || 10;
    const manualCount = saved.lists.filter(list => list.id !== 'list-default' && ['manual', 'meal'].includes(list.kind)).length;
    if (manualCount >= maxManualLists) {
      toast(`Limite de ${maxManualLists} listes manuelles atteinte`);
      return false;
    }
    ensureLocalGroceryPanels();
    const input = document.getElementById('groceryListName');
    const error = document.getElementById('groceryListCreatorError');
    if (input) input.value = '';
    if (error) error.textContent = '';
    document.getElementById('groceryListCreatorPanel').classList.add('open');
    setTimeout(() => input?.focus(), 0);
    return true;
  };

  window.closeGroceryListCreator = function() {
    document.getElementById('groceryListCreatorPanel')?.classList.remove('open');
  };

  window.saveGroceryListCreator = function() {
    const name = String(document.getElementById('groceryListName')?.value || '').trim();
    const error = document.getElementById('groceryListCreatorError');
    if (!name) {
      if (error) error.textContent = 'Indiquez un nom de liste.';
      return false;
    }
    const saved = syncActiveGroceryListFromState();
    const maxManualLists = Number(GROCERY_CORE.MAX_MANUAL_GROCERY_LISTS) || 10;
    const manualCount = saved.lists.filter(list => list.id !== 'list-default' && ['manual', 'meal'].includes(list.kind)).length;
    if (manualCount >= maxManualLists) {
      if (error) error.textContent = `Limite de ${maxManualLists} listes manuelles atteinte.`;
      return false;
    }
    const id = `manual-list-${Date.now()}`;
    const created = GROCERY_CORE.createGroceryList(saved, { id, name, kind: 'manual', items: [], checked: [], history: [] });
    if (created.lists.length === saved.lists.length) {
      if (error) error.textContent = `Limite de ${maxManualLists} listes manuelles atteinte.`;
      return false;
    }
    loadActiveGroceryList(created);
    state.groceryView = 'hub';
    state.tab = 'groceries';
    state.detail = null;
    state.mealListTargetId = created.activeListId;
    window.closeGroceryListCreator();
    persistAppState();
    render();
    toast(`Liste « ${name} » créée`);
    return true;
  };

  const nativeCartQty = window.cartQty, nativeRemoveCart = window.removeCart;
  window.cartQty = function(id, delta) { state.pantryReminders = []; nativeCartQty?.(id, delta); };
  window.removeCart = function(id) { state.pantryReminders = []; nativeRemoveCart?.(id); };
  function localGroceryKey(item = {}) {
    return String(item.key || item.id || '');
  }

  function localGroceryInlineKey(key = '') {
    return String(key).replaceAll('\\', '\\\\').replaceAll("'", "\\'");
  }

  function localGroceryNeedsReview(item = {}) {
    return Boolean(item.needsReview || item.missingQty);
  }

  function normalizeLocalGroceryItem(item = {}, fallbackSource = 'recipe') {
    const key = localGroceryKey(item);
    if (!key) return null;
    const { retailer: _retailer, sku: _sku, ...safeItem } = item;
    const numericQuantity = Number(safeItem.q);
    const missingQty = Boolean(safeItem.missingQty) || !Number.isFinite(numericQuantity);
    const needsReview = localGroceryNeedsReview({ ...safeItem, missingQty });
    return {
      ...safeItem,
      key,
      id: safeItem.id || key,
      aisle: String(safeItem.aisle || 'À classer').trim() || 'À classer',
      name: String(safeItem.name || 'Produit à vérifier').trim() || 'Produit à vérifier',
      q: Number.isFinite(numericQuantity) && numericQuantity >= 0 ? numericQuantity : 0,
      unit: String(safeItem.unit || 'piece').trim() || 'piece',
      missingQty,
      needsReview,
      reviewReason: safeItem.reviewReason || (missingQty ? 'quantity_missing' : needsReview ? 'verify_at_home' : ''),
      origins: Array.isArray(safeItem.origins) ? [...new Set(safeItem.origins.filter(Boolean))] : [],
      localProduct: true,
      productType: 'local_generic',
      source: safeItem.source || fallbackSource,
    };
  }

  function migrateLocalGroceryState() {
    const existing = new Set();
    const next = [];
    const add = (item, source) => {
      const normalized = normalizeLocalGroceryItem(item, source);
      if (!normalized || existing.has(normalized.key)) return;
      existing.add(normalized.key);
      next.push(normalized);
    };

    const previousSignature = JSON.stringify([state.groceries || [], state.manualGroceries || [], state.pantryReminders || []]);
    const pantryState = GROCERY_CORE.separatePantryStaples(state.groceries || [], state.pantryReminders || []);
    const mergedPantry = GROCERY_CORE.mergeLocalGroceryItems(pantryState.items);
    mergedPantry.items.forEach(item => add(item, item?.source || 'recipe'));
    (state.manualGroceries || []).forEach(item => add(
      GROCERY_CORE.createManualLocalGroceryItem({
        key: item.id || `manual-${Date.now()}`,
        name: item.name,
        aisle: item.category || 'Ajoutés manuellement',
      }),
      'manual',
    ));

    const validKeys = new Set(next.map(localGroceryKey));
    const remappedChecked = [...state.checked].map(key => mergedPantry.keyAliases.get(String(key)) || String(key));
    state.groceries = next;
    state.manualGroceries = [];
    state.pantryReminders = pantryState.pantryReminders;
    state.checked = new Set(remappedChecked.filter(key => validKeys.has(key)));
    return previousSignature !== JSON.stringify([state.groceries, state.manualGroceries, state.pantryReminders]);
  }

  function findLocalGroceryItem(key) {
    return state.groceries.find(item => localGroceryKey(item) === String(key));
  }

  function localGroceryQuantity(item) {
    const quantity = GROCERY_CORE.formatLocalQuantity(item);
    return quantity === 'À vérifier' ? '' : quantity;
  }

  function localGroceryOriginHtml(item) {
    if (item.source === 'manual') return '<span class="origin">Ajout manuel</span>';
    const count = (item.origins || []).filter(id => recipe(id)).length;
    if (!count) return '<span class="origin">Produit ajouté</span>';
    const label = `Dans ${count} recette${count > 1 ? 's' : ''}`;
    return `<button class="grocery-origin-summary" type="button" onclick="openGroceryOrigins('${localGroceryInlineKey(item.key)}')">${label}</button>`;
  }

  function localGroceryRowHtml(item) {
    const key = localGroceryKey(item);
    const safeKey = localGroceryInlineKey(key);
    const done = state.checked.has(key);
    const manual = item.source === 'manual';
    const review = !manual && localGroceryNeedsReview(item);
    const reviewBadge = review ? '<span class="grocery-review-badge">À vérifier</span>' : '';
    const trailing = manual
      ? `<button type="button" class="meal-list-manual-remove" aria-label="Supprimer ${escapeHtml(item.name)}" onclick="removeGroceryItem('${safeKey}')">×</button>`
      : `<span class="grocery-qty">${escapeHtml(localGroceryQuantity(item))}</span>${reviewBadge}`;
    return `<article class="grocery-item grocery-simple-item ${done ? 'checked' : ''} ${review ? 'has-review' : ''}" data-grocery-key="${escapeHtml(key)}"><button class="check" aria-label="${done ? 'Décocher' : 'Cocher'} ${escapeHtml(item.name)}" onclick="toggleCheck('${safeKey}')">${icon('check')}</button>${mediaImageForGroceryItem(item, 'list', item.name, 'grocery-media')}<div class="grocery-copy"><p class="grocery-name">${escapeHtml(item.name)}</p><div class="origins">${localGroceryOriginHtml(item)}</div></div>${trailing}</article>`;
  }


  renderGroceries = function localGroceryCartRender() {
    if (state.groceryView !== 'detail') return renderGroceryHub();
    const groups = {};
    state.groceries.forEach(item => (groups[item.aisle] ??= []).push(item));
    const total = state.groceries.length;
    const remaining = Math.max(0, total - state.checked.size);
    const complete = total > 0 && remaining === 0;
    const generated = Object.entries(groups).sort(([left], [right]) => left.localeCompare(right, 'fr')).map(([aisle, items]) => `<section class="group"><h2 class="group-title">${escapeHtml(aisle)}</h2><div class="grocery-groups">${items.sort((left, right) => left.name.localeCompare(right.name, 'fr')).map(localGroceryRowHtml).join('')}</div></section>`).join('');
    return `<section data-screen="groceries">${groceryListDetailHeaderHtml()}${grocerySourceRecipesHtml()}<div class="screen-intro"><p class="eyebrow">Liste prête à cocher</p><h2>${remaining} produit${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}</h2><p>Les quantités viennent de vos recettes.</p></div>${renderManualAdd()}${complete ? `<div class="done-banner">${icon('check')}<div><strong>Courses terminées</strong><span>Tous les produits sont cochés.</span></div></div>` : ''}${total ? generated : `<div class="empty" style="padding-top:18px"><h2>Votre liste est vide</h2><p>Ajoutez librement un produit ou préparez les Courses depuis Mon Panier.</p></div>`}</section>`;
  };

  let activeGroceryEditor = null;

  function ensureLocalGroceryPanels() {
    if (!document.getElementById('groceryEditorPanel')) {
      document.body.insertAdjacentHTML('beforeend', `<aside class="overlay grocery-local-overlay" id="groceryEditorPanel" role="dialog" aria-modal="true" aria-labelledby="groceryEditorTitle"><div class="sheet"><div class="sheet-head"><button class="icon-btn" type="button" onclick="closeGroceryEditor()" aria-label="Fermer">×</button><div><p class="eyebrow">Modifier</p><h2 id="groceryEditorTitle">Modifier un produit</h2></div></div><div class="full-panel-body" id="groceryEditorBody"></div></div></aside>`);
    }
    if (!document.getElementById('groceryExportPanel')) {
      document.body.insertAdjacentHTML('beforeend', `<aside class="overlay grocery-local-overlay" id="groceryExportPanel" role="dialog" aria-modal="true" aria-labelledby="groceryExportTitle"><div class="sheet"><div class="sheet-head"><button class="icon-btn" type="button" onclick="closeGroceryExport()" aria-label="Fermer">×</button><div><p class="eyebrow">Courses</p><h2 id="groceryExportTitle">Exporter les Courses</h2></div></div><div class="full-panel-body" id="groceryExportBody"></div></div></aside>`);
    }
    if (!document.getElementById('groceryOriginsPanel')) {
      document.body.insertAdjacentHTML('beforeend', `<aside class="overlay grocery-local-overlay" id="groceryOriginsPanel" role="dialog" aria-modal="true" aria-labelledby="groceryOriginsTitle"><div class="sheet grocery-origins-sheet"><div class="sheet-head"><button class="icon-btn" type="button" onclick="closeGroceryOrigins()" aria-label="Fermer">×</button><div><p class="eyebrow">Provenance</p><h2 id="groceryOriginsTitle">Dans les recettes</h2></div></div><div class="full-panel-body" id="groceryOriginsBody"></div></div></aside>`);
    }
    if (!document.getElementById('groceryListCreatorPanel')) {
      document.body.insertAdjacentHTML('beforeend', `<aside class="overlay grocery-local-overlay" id="groceryListCreatorPanel" role="dialog" aria-modal="true" aria-labelledby="groceryListCreatorTitle"><div class="sheet grocery-origins-sheet"><div class="sheet-head"><button class="icon-btn" type="button" onclick="closeGroceryListCreator()" aria-label="Fermer">×</button><div><p class="eyebrow">Courses indépendantes</p><h2 id="groceryListCreatorTitle">Nouvelle liste</h2></div></div><div class="full-panel-body"><label class="grocery-editor-field"><span>Nom de la liste</span><input id="groceryListName" maxlength="60" autocomplete="off" placeholder="Maison, Anniversaire…" onkeydown="if(event.key==='Enter'){event.preventDefault();saveGroceryListCreator()}"></label><p class="grocery-editor-error" id="groceryListCreatorError" role="alert"></p><div class="panel-sticky"><button class="primary" type="button" onclick="saveGroceryListCreator()">Créer la liste</button></div></div></div></aside>`);
    }
  }

  window.openGroceryOrigins = function(key) {
    const item = findLocalGroceryItem(key);
    if (!item) return false;
    ensureLocalGroceryPanels();
    const origins = (item.origins || []).map(id => recipe(id)).filter(Boolean);
    document.getElementById('groceryOriginsTitle').textContent = item.name;
    document.getElementById('groceryOriginsBody').innerHTML = origins.length
      ? `<p class="grocery-origin-intro">Ce produit est utilisé dans ${origins.length} recette${origins.length > 1 ? 's' : ''} :</p><ul class="grocery-origin-list">${origins.map(origin => `<li>${escapeHtml(origin.title)}</li>`).join('')}</ul>`
      : '<p class="grocery-origin-intro">Aucune recette source enregistrée.</p>';
    document.getElementById('groceryOriginsPanel').classList.add('open');
    return true;
  };

  window.closeGroceryOrigins = function() {
    document.getElementById('groceryOriginsPanel')?.classList.remove('open');
  };

  function renderGroceryEditor() {
    const item = activeGroceryEditor && findLocalGroceryItem(activeGroceryEditor.key);
    const panel = document.getElementById('groceryEditorPanel');
    const body = document.getElementById('groceryEditorBody');
    if (!item || !panel || !body) return window.closeGroceryEditor();
    const replace = activeGroceryEditor.mode === 'replace';
    document.getElementById('groceryEditorTitle').textContent = replace ? 'Remplacer un produit' : 'Modifier un produit';
    body.innerHTML = `<div class="grocery-editor-intro"><strong>${replace ? 'Choisissez votre alternative locale.' : 'Ajustez cette ligne de Courses.'}</strong><p>Sans marque, prix, stock ni donnée d’enseigne. Une quantité vide reste « À vérifier ».</p></div><label class="grocery-editor-field"><span>${replace ? 'Remplacer par' : 'Produit'}</span><input id="groceryEditName" value="${escapeHtml(item.name)}" maxlength="100" autocomplete="off"></label><div class="grocery-editor-grid"><label class="grocery-editor-field"><span>Quantité</span><input id="groceryEditQty" inputmode="decimal" value="${item.missingQty ? '' : escapeHtml(item.q)}" placeholder="À vérifier"></label><label class="grocery-editor-field"><span>Unité</span><select id="groceryEditUnit">${unitChoices(item.unit)}</select></label></div><p class="grocery-editor-error" id="groceryEditorError" role="alert"></p><div class="grocery-editor-actions"><button class="secondary" type="button" onclick="markGroceryForReview('${localGroceryInlineKey(item.key)}')">Marquer à vérifier</button><button class="grocery-editor-delete" type="button" onclick="removeGroceryItem('${localGroceryInlineKey(item.key)}')">Supprimer</button></div><div class="panel-sticky"><button class="primary" type="button" onclick="saveGroceryEditor()">${replace ? 'Enregistrer le remplacement' : 'Enregistrer'}</button></div>`;
    panel.classList.add('open');
  }

  window.openGroceryEditor = function(key, mode = 'edit') {
    if (!findLocalGroceryItem(key)) return;
    ensureLocalGroceryPanels();
    activeGroceryEditor = { key: String(key), mode: mode === 'replace' ? 'replace' : 'edit' };
    renderGroceryEditor();
  };

  window.closeGroceryEditor = function() {
    activeGroceryEditor = null;
    document.getElementById('groceryEditorPanel')?.classList.remove('open');
  };

  window.saveGroceryEditor = function() {
    const item = activeGroceryEditor && findLocalGroceryItem(activeGroceryEditor.key);
    if (!item) return window.closeGroceryEditor();
    const mode = activeGroceryEditor.mode;
    const name = document.getElementById('groceryEditName')?.value.trim() || '';
    const qty = document.getElementById('groceryEditQty')?.value.trim() || '';
    const unit = document.getElementById('groceryEditUnit')?.value || item.unit;
    const error = document.getElementById('groceryEditorError');
    if (!name) {
      error.textContent = 'Indiquez un nom de produit.';
      return;
    }
    if (qty && !Number.isFinite(Number(qty.replace(',', '.')))) {
      error.textContent = 'La quantité doit être un nombre ou rester vide.';
      return;
    }
    const next = GROCERY_CORE.replaceLocalGroceryItem(item, { name, qty, unit });
    state.groceries = state.groceries.map(current => localGroceryKey(current) === item.key ? next : current);
    persistAppState();
    window.closeGroceryEditor();
    render();
    toast(mode === 'replace' ? 'Produit local remplacé' : 'Produit local mis à jour');
  };

  window.markGroceryForReview = function(key) {
    const item = findLocalGroceryItem(key);
    if (!item) return;
    state.groceries = state.groceries.map(current => localGroceryKey(current) === item.key ? GROCERY_CORE.markLocalGroceryItemForReview(current) : current);
    persistAppState();
    window.closeGroceryEditor();
    render();
    toast('Produit conservé à vérifier');
  };

  window.removeGroceryItem = function(key) {
    const result = GROCERY_CORE.removeLocalGroceryItem(state.groceries, state.checked, key);
    state.groceries = result.items;
    state.checked = result.checked;
    persistAppState();
    window.closeGroceryEditor();
    render();
    toast('Produit retiré des Courses');
  };

  window.addManualProduct = function(productId = null) {
    const suggestion = productId ? PRODUCT_SUGGESTIONS.find(item => item.id === productId) : null;
    const name = String(suggestion?.name || state.manualQuery || '').trim();
    if (!name) return false;
    const normalizedName = normalizeSearch(name);
    const existing = state.groceries.find(item => normalizeSearch(item.name) === normalizedName);
    state.manualQuery = '';
    if (existing) {
      render();
      toast('Produit déjà présent dans les Courses');
      return false;
    }
    state.groceries.push(GROCERY_CORE.createManualLocalGroceryItem({
      key: `manual-${Date.now()}`,
      name,
      aisle: suggestion?.category || 'Ajoutés manuellement',
    }));
    persistAppState();
    render();
    toast('Produit local ajouté à vérifier');
    return true;
  };

  window.removeManualProduct = function(key) { window.removeGroceryItem(key); };

  window.openGroceryExport = function() {
    if (!state.groceries.length && !state.pantryReminders.length) return toast('Ajoutez au moins un produit avant l’export.');
    ensureLocalGroceryPanels();
    const text = GROCERY_CORE.exportLocalGroceryList(state.groceries, state.pantryReminders);
    document.getElementById('groceryExportBody').innerHTML = `<p class="grocery-export-note">Liste locale prête à copier. Les lignes « À vérifier » demandent votre confirmation avant achat.</p><textarea id="groceryExportText" class="grocery-export-text" readonly aria-label="Liste de Courses exportée">${escapeHtml(text)}</textarea><div class="panel-sticky"><button class="primary" type="button" onclick="copyGroceryExport()">Copier la liste</button></div>`;
    document.getElementById('groceryExportPanel').classList.add('open');
  };

  window.closeGroceryExport = function() {
    document.getElementById('groceryExportPanel')?.classList.remove('open');
  };

  window.copyGroceryExport = function() {
    const text = GROCERY_CORE.exportLocalGroceryList(state.groceries, state.pantryReminders);
    const field = document.getElementById('groceryExportText');
    const fallback = () => {
      field?.focus();
      field?.select();
      let copied = false;
      try { copied = Boolean(document.execCommand?.('copy')); } catch (_) {}
      toast(copied ? 'Liste copiée' : 'Liste prête à sélectionner et copier');
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast('Liste copiée')).catch(fallback);
    else fallback();
  };

  function createGeneratedGroceryList(localGroceryPlan, selections) {
    const saved = GROCERY_CORE.ensurePermanentBasketList(syncActiveGroceryListFromState());
    const name = 'Courses du Panier';
    const updated = GROCERY_CORE.updateGroceryListById(saved, 'list-default', {
      id: 'list-default',
      name,
      kind: 'basket',
      basketId: 'list-default',
      items: localGroceryPlan.items,
      pantryReminders: localGroceryPlan.pantryReminders,
      checked: [],
      sourceRecipeIds: selections.map(selection => selection.recipeId),
      recipeSelections: selections,
      sourceRecipeSelections: selections,
      history: [...(saved.lists.find(list => list.id === 'list-default')?.history || []), {
        type: 'generated',
        recipeIds: selections.map(selection => selection.recipeId),
      }],
    });
    loadActiveGroceryList({ ...updated, activeListId: 'list-default' });
    saveRecentCart();
    state.cart.clear();
    state.cartVersions.clear();
    state.tab = 'groceries';
    state.detail = null;
    state.groceryView = 'detail';
    persistAppState();
    render();
    screen.scrollTop = 0;
    toast('Liste du Panier mise à jour');
    return true;
  }

  window.generateGroceries = function() {
    const selections = [...state.cart].map(([id, servings]) => {
      const currentRecipe = recipe(id);
      const version = state.cartVersions.get(id);
      return currentRecipe ? {
        recipeId: id,
        servings,
        baseServings: currentRecipe.servings,
        ingredients: version?.ingredients || currentRecipe.ingredients,
      } : null;
    }).filter(Boolean);
    const localGroceryPlan = GROCERY_CORE.buildLocalGroceryPlan(selections);
    createGeneratedGroceryList(localGroceryPlan, selections);
  };

  const nativeAddCartForLocalGroceries = window.addCart;
  const nativeCartQtyForLocalGroceries = window.cartQty;
  const nativeRemoveCartForLocalGroceries = window.removeCart;
  function captureHorizontalScrollState() {
    return [...document.querySelectorAll('.h-scroll')].map((element, index) => ({
      key: element.closest('[data-shelf]')?.dataset.shelf || element.getAttribute('aria-label') || `h-scroll-${index}`,
      left: element.scrollLeft,
    }));
  }

  function restoreHorizontalScrollState(snapshot) {
    snapshot = Array.isArray(snapshot) ? snapshot : [];
    const restore = () => {
      const scrolls = [...document.querySelectorAll('.h-scroll')];
      snapshot.forEach(({ key, left }) => {
        const target = scrolls.find((element, index) => {
          const currentKey = element.closest('[data-shelf]')?.dataset.shelf || element.getAttribute('aria-label') || `h-scroll-${index}`;
          return currentKey === key;
        });
        if (target) target.scrollLeft = left;
      });
    };
    restore();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore);
  }

  function preserveActiveGroceryList(callback) {
    const savedCollection = syncActiveGroceryListFromState();
    const scrollSnapshot = captureHorizontalScrollState();
    const activeRender = render;
    render = () => {};
    try { callback?.(); } finally { render = activeRender; }
    loadActiveGroceryList(savedCollection);
    persistAppState();
    render();
    restoreHorizontalScrollState(scrollSnapshot);
  }
  window.addCart = function(...args) { preserveActiveGroceryList(() => nativeAddCartForLocalGroceries?.(...args)); };
  window.cartQty = function(...args) { preserveActiveGroceryList(() => nativeCartQtyForLocalGroceries?.(...args)); };
  window.removeCart = function(...args) { preserveActiveGroceryList(() => nativeRemoveCartForLocalGroceries?.(...args)); };

  /* meal-lists-v1:start */
  state.mealListTargetId = state.mealListTargetId || 'list-default';
  state.mealListOrigin = state.mealListOrigin || 'cart';
  state.mealRecipePickerQuery = state.mealRecipePickerQuery || '';
  state.mealListRecipesExpanded = Boolean(state.mealListRecipesExpanded);

  function mealListCollectionFromState() {
    const savedLists = Array.isArray(state.groceryLists) ? state.groceryLists : [];
    let collection = GROCERY_CORE.createGroceryListCollection({
      lists: savedLists,
      activeListId: state.activeGroceryListId,
      legacyItems: savedLists.length ? [] : state.groceries,
      legacyChecked: savedLists.length ? [] : [...state.checked],
      legacyPantryReminders: savedLists.length ? [] : state.pantryReminders,
    });
    const active = collection.lists.find(list => list.id === collection.activeListId);
    if (savedLists.length && active && !active.items.length && state.groceries.length) {
      collection = GROCERY_CORE.updateGroceryListById(collection, active.id, {
        items: state.groceries,
        checked: [...state.checked],
        pantryReminders: state.pantryReminders,
      });
    }
    return collection;
  }

  function applyMealListCollection(collection) {
    state.groceryLists = collection.lists;
    state.activeGroceryListId = collection.activeListId;
    if (!collection.lists.some(list => list.id === state.mealListTargetId)) {
      state.mealListTargetId = collection.activeListId || 'list-default';
    }
  }

  currentGroceryListCollection = mealListCollectionFromState;
  applyGroceryListCollection = applyMealListCollection;

  function activeMealList(collection = mealListCollectionFromState()) {
    return collection.lists.find(list => list.id === collection.activeListId)
      || collection.lists.find(list => list.id === 'list-default')
      || collection.lists[0]
      || null;
  }

  function mealListById(listId = '', collection = mealListCollectionFromState()) {
    const targetId = String(listId || '').trim();
    return collection.lists.find(list => list.id === targetId)
      || collection.lists.find(list => list.id === 'list-default')
      || collection.lists[0]
      || null;
  }

  function mealListTargetId() {
    return mealListById(state.mealListTargetId)?.id || 'list-default';
  }

  function mealListTargetName() {
    return mealListById(mealListTargetId())?.name || 'Mon Panier';
  }

  function mealListRecipeSelections(list = activeMealList()) {
    const explicit = Array.isArray(list?.recipeSelections) && list.recipeSelections.length
      ? list.recipeSelections
      : Array.isArray(list?.sourceRecipeSelections) && list.sourceRecipeSelections.length
        ? list.sourceRecipeSelections
        : [];
    const knownSelectionIds = new Set();
    const selections = [];
    const add = (raw, index) => {
      const recipeId = String(raw?.recipeId || '').trim();
      const source = recipe(recipeId);
      if (!recipeId || !source) return;
      const selectionId = String(raw?.selectionId || '').trim() || `${recipeId}--selection-${index + 1}`;
      if (knownSelectionIds.has(selectionId)) return;
      knownSelectionIds.add(selectionId);
      const ingredients = Array.isArray(raw?.ingredients) && raw.ingredients.length
        ? raw.ingredients
        : activeIngredientsForRecipe(source);
      selections.push({
        selectionId,
        recipeId,
        servings: Math.max(1, Number(raw?.servings) || source.servings || 1),
        baseServings: Math.max(1, Number(raw?.baseServings) || source.servings || 1),
        ingredients: (ingredients || []).map(ingredient => ({ ...ingredient })),
      });
    };
    explicit.forEach(add);
    if (!explicit.length) (list?.sourceRecipeIds || []).forEach((recipeId, index) => add({ recipeId }, index));
    return selections;
  }

  function mealListPreparedRecipeSelections(list = {}) {
    const stored = Array.isArray(list?.preparedRecipeSelections) ? list.preparedRecipeSelections : [];
    const legacyArchive = !stored.length
      && list?.id === 'list-default'
      && Number(list?.preparedRecipeCount) > 0
      && Array.isArray(state.archived?.[0]?.items)
      ? state.archived[0].items.map(([recipeId, servings], index) => ({
        recipeId,
        servings,
        selectionId: `${recipeId}--prepared-${index + 1}`,
      }))
      : [];
    const rawSelections = stored.length ? stored : legacyArchive;
    const knownSelectionIds = new Set();
    const selections = [];
    rawSelections.forEach((raw, index) => {
      const recipeId = String(raw?.recipeId || '').trim();
      const source = recipe(recipeId);
      if (!recipeId || !source) return;
      const selectionId = String(raw?.selectionId || '').trim() || `${recipeId}--prepared-${index + 1}`;
      if (knownSelectionIds.has(selectionId)) return;
      knownSelectionIds.add(selectionId);
      const ingredients = Array.isArray(raw?.ingredients) && raw.ingredients.length
        ? raw.ingredients
        : activeIngredientsForRecipe(source);
      selections.push({
        selectionId,
        recipeId,
        servings: Math.max(1, Number(raw?.servings) || source.servings || 1),
        baseServings: Math.max(1, Number(raw?.baseServings) || source.servings || 1),
        ingredients: (ingredients || []).map(ingredient => ({ ...ingredient })),
      });
    });
    return selections;
  }

  function mealListRecipeCount(list = {}) {
    const activeCount = mealListRecipeSelections(list).length;
    if (activeCount) return activeCount;
    const preparedCount = Number(list?.preparedRecipeCount);
    if (Number.isFinite(preparedCount) && preparedCount > 0) return Math.floor(preparedCount);
    // Migration read path for lists prepared by the previous bundle.
    if (list?.id === 'list-default' && list?.preparedRecipeCount == null && Array.isArray(state.archived?.[0]?.items)) {
      return state.archived[0].items.length;
    }
    return 0;
  }

  function mealListSelectionFor(list, identity) {
    const value = String(identity || '').trim();
    if (!value) return null;
    const selections = mealListRecipeSelections(list);
    const bySelectionId = selections.find(selection => selection.selectionId === value);
    if (bySelectionId) return bySelectionId;
    const byRecipeId = selections.filter(selection => selection.recipeId === value);
    return byRecipeId.length === 1 ? byRecipeId[0] : null;
  }

  function mealListSelectionForDirectMutation(list, identity) {
    const active = mealListSelectionFor(list, identity);
    if (active) return active;
    const value = String(identity || '').trim();
    if (!value) return null;
    const prepared = mealListPreparedRecipeSelections(list);
    const bySelectionId = prepared.find(selection => selection.selectionId === value);
    if (bySelectionId) return bySelectionId;
    const byRecipeId = prepared.filter(selection => selection.recipeId === value);
    return byRecipeId.length === 1 ? byRecipeId[0] : null;
  }

  function mealListDirectMutationCollection(collection, list) {
    if (!list || mealListRecipeSelections(list).length) return collection;
    const prepared = mealListPreparedRecipeSelections(list);
    if (!prepared.length) return collection;
    return {
      ...collection,
      lists: collection.lists.map(entry => entry.id === list.id
        ? { ...entry, preparedRecipeSelections: prepared, preparedRecipeCount: prepared.length }
        : entry),
    };
  }

  function mealListContainsRecipe(list, recipeId) {
    return mealListRecipeSelections(list).some(selection => selection.recipeId === String(recipeId));
  }

  function legacyCartSelectionsFromState() {
    return [...state.cart.entries()].map(([recipeId, servings]) => {
      const source = recipe(recipeId);
      if (!source) return null;
      const version = state.cartVersions.get(recipeId);
      return {
        recipeId,
        servings: Math.max(1, Number(servings) || source.servings || 1),
        baseServings: Math.max(1, Number(source.servings) || 1),
        // Migration des variantes globales historiques : une copie ne rejoint
        // que la sélection déjà présente dans le Panier, jamais le catalogue.
        ingredients: (version?.ingredients || state.variants.get(recipeId)?.ingredients || source.ingredients || []).map(ingredient => ({ ...ingredient })),
      };
    }).filter(Boolean);
  }

  syncActiveGroceryListFromState = function syncActiveMealListFromState(historyEntry = null) {
    const collection = mealListCollectionFromState();
    const active = activeMealList(collection);
    if (!active) return collection;
    const history = historyEntry ? [...(active.history || []), { ...historyEntry }] : active.history;
    const updated = GROCERY_CORE.updateGroceryListById(collection, active.id, {
      ...active,
      items: state.groceries.map(item => ({ ...item })),
      checked: [...state.checked],
      pantryReminders: [...state.pantryReminders],
      history,
    });
    applyMealListCollection(updated);
    return updated;
  };

  loadActiveGroceryList = function loadActiveMealList(collection = mealListCollectionFromState()) {
    applyMealListCollection(collection);
    const active = activeMealList(collection);
    state.groceries = active ? (active.items || []).map(item => ({ ...item })) : [];
    state.checked = new Set(active?.checked || []);
    state.manualGroceries = [];
    state.pantryReminders = active ? [...(active.pantryReminders || [])] : [];
    return active;
  };

  function initializeMealLists() {
    const legacySelections = legacyCartSelectionsFromState();
    const legacyVariantCount = state.variants instanceof Map ? state.variants.size : 0;
    const before = JSON.stringify({
      lists: state.groceryLists,
      activeListId: state.activeGroceryListId,
      cart: [...state.cart],
      groceries: state.groceries,
      checked: [...state.checked],
    });
    let collection = GROCERY_CORE.migrateLegacyMealListCollection(mealListCollectionFromState(), {
      legacyCartSelections: legacySelections,
    });
    const itemMigration = migrateGroceryListCollection(collection);
    collection = itemMigration.collection;
    for (const list of collection.lists) {
      if (mealListRecipeSelections(list).length && !(list.items || []).length) {
        collection = GROCERY_CORE.rebuildMealListCourses(collection, list.id);
      }
    }
    if (!collection.lists.some(list => list.id === collection.activeListId)) {
      collection = { ...collection, activeListId: 'list-default' };
    }
    if (state.tab === 'cart') collection = { ...collection, activeListId: 'list-default' };
    loadActiveGroceryList(collection);
    state.mealListTargetId = collection.lists.some(list => list.id === state.mealListTargetId)
      ? state.mealListTargetId
      : collection.activeListId;
    state.cart.clear();
    state.cartVersions.clear();
    // Toute variante sans sélection est temporaire et doit disparaître. Cette
    // purge garantit que Découvrir et la recherche repartent du catalogue original.
    state.variants.clear();
    const after = JSON.stringify({
      lists: state.groceryLists,
      activeListId: state.activeGroceryListId,
      cart: [...state.cart],
      groceries: state.groceries,
      checked: [...state.checked],
    });
    return before !== after || Boolean(collection.changed || itemMigration.changed || legacySelections.length || legacyVariantCount);
  }

  function groceryListSummary(list = {}) {
    const items = Array.isArray(list.items) ? list.items : [];
    const checked = new Set(Array.isArray(list.checked) ? list.checked.map(String) : []);
    const remaining = items.filter(item => !checked.has(localGroceryKey(item))).length;
    const recipes = mealListRecipeCount(list);
    return { total: items.length, remaining, recipes, complete: items.length > 0 && remaining === 0 };
  }

  function groceryListKindLabel(list = {}) {
    if (list.id === 'list-default') return 'Votre liste par défaut';
    return 'Liste manuelle';
  }

  renderGroceryHub = function renderMealListHub() {
    const collection = mealListCollectionFromState();
    applyMealListCollection(collection);
    const cardMarkup = collection.lists.map(list => {
      const summary = groceryListSummary(list);
      const recipeSummary = `${summary.recipes} recette${summary.recipes > 1 ? 's' : ''}`;
      const courseSummary = summary.total
        ? `${summary.remaining} produit${summary.remaining > 1 ? 's' : ''} restant${summary.remaining > 1 ? 's' : ''}`
        : 'Courses à préparer';
      const safeId = localGroceryInlineKey(list.id);
      const remove = list.id === 'list-default'
        ? ''
        : `<button class="meal-list-card-delete" type="button" aria-label="Supprimer la liste ${escapeHtml(list.name)}" onclick="event.stopPropagation();askDeleteMealList('${safeId}')">Supprimer</button>`;
      const status = summary.complete ? '<span class="grocery-list-card-status complete">Terminée</span>' : '';
      const cardClass = list.id === 'list-default' ? 'grocery-list-card-default' : 'grocery-list-card-manual';
      return `<article class="grocery-list-card ${cardClass}" data-grocery-list-id="${escapeHtml(list.id)}"><button class="grocery-list-card-open" type="button" onclick="openGroceryList('${safeId}')" aria-label="Afficher la liste ${escapeHtml(list.name)}"><span class="grocery-list-card-kicker">${escapeHtml(groceryListKindLabel(list))}</span><h2>${escapeHtml(list.name)}</h2><p>${escapeHtml(recipeSummary)} · ${escapeHtml(courseSummary)}</p>${status}<span class="grocery-list-card-arrow" aria-hidden="true">→</span></button>${remove}</article>`;
    });
    const cards = cardMarkup.join('');
    return `<section class="grocery-hub" data-screen="grocery-hub"><div class="grocery-list-card-grid">${cards}</div></section>`;
  };

  function mealListRecipeThumb(source) {
    const src = source.image || source.detailImage || '';
    return src
      ? `<img class="meal-list-recipe-thumb" src="${escapeHtml(src)}" alt="" decoding="async">`
      : `<span class="meal-list-recipe-thumb cover-fallback theme-${source.coverTheme || 'sage'}" aria-hidden="true"><span class="plate-mark" style="width:26px;height:26px"></span></span>`;
  }

  function renderMealListRecipes(list) {
    const selections = mealListRecipeSelections(list);
    const preparedSelections = selections.length ? [] : mealListPreparedRecipeSelections(list);
    const displaySelections = selections.length ? selections : preparedSelections;
    const preparedOnly = selections.length === 0 && preparedSelections.length > 0;
    const recipeCount = mealListRecipeCount(list);
    if (recipeCount === 0) return '';
    const navigation = displaySelections.map(selection => `'${localGroceryInlineKey(selection.recipeId)}'`).join(',');
    const rows = displaySelections.map(selection => {
      const source = recipe(selection.recipeId);
      if (!source) return '';
      const safeId = localGroceryInlineKey(source.id);
      const safeSelectionId = localGroceryInlineKey(selection.selectionId);
      const version = selectionVersionInfo(selection, source);
      const actions = `<div class="meal-list-servings"><button type="button" aria-label="Retirer une portion de ${escapeHtml(source.title)}" onclick="updateActiveMealListRecipeServings('${safeSelectionId}',-1)">−</button><strong>${selection.servings}</strong><button type="button" aria-label="Ajouter une portion à ${escapeHtml(source.title)}" onclick="updateActiveMealListRecipeServings('${safeSelectionId}',1)">+</button></div><button type="button" class="meal-list-recipe-remove" aria-label="Supprimer ${escapeHtml(source.title)} de la liste" onclick="removeRecipeFromActiveMealList('${safeSelectionId}')">×</button>`;
      return `<article class="meal-list-recipe${preparedOnly ? ' is-prepared' : ''}" data-meal-list-recipe-id="${escapeHtml(source.id)}" data-meal-list-selection-id="${escapeHtml(selection.selectionId)}"><button type="button" class="meal-list-recipe-open" onclick="openDetail('${safeId}','${state.tab === 'cart' ? 'cart' : 'groceries'}',[${navigation}],'${safeSelectionId}')"><span class="meal-list-recipe-main">${mealListRecipeThumb(source)}<span><strong>${escapeHtml(source.title)}</strong><small>${escapeHtml(version.label)} · ${selection.servings} portion${selection.servings > 1 ? 's' : ''}</small></span></span>${icon('chevron')}</button><div class="meal-list-recipe-actions">${actions}</div></article>`;
    }).join('');
    const empty = displaySelections.length ? '' : recipeCount
      ? '<p class="meal-list-recipes-empty">Recettes préparées conservées dans l’historique.</p>'
      : '<p class="meal-list-recipes-empty">Aucune recette dans cette liste.</p>';
    const expanded = displaySelections.length === 0 || state.mealListRecipesExpanded === true;
    const label = list?.id === 'list-default' ? 'Recettes du Panier' : 'Recettes de la liste';
    return `<section class="meal-list-recipes" data-expanded="${expanded}"><button type="button" class="meal-list-recipes-toggle" onclick="toggleMealListRecipes()" aria-expanded="${expanded}"><span><strong>${label}</strong><small>${recipeCount} recette${recipeCount > 1 ? 's' : ''}</small></span>${icon('chevron')}</button><div class="meal-list-recipe-list"><div class="meal-list-recipes-head"><h2>Recettes de la liste</h2></div>${rows || empty}</div></section>`;
  }

  window.toggleMealListRecipes = function() {
    const panel = document.querySelector('.meal-list-recipes');
    if (!panel) return false;
    const expanded = panel.dataset.expanded === 'true';
    state.mealListRecipesExpanded = !expanded;
    panel.dataset.expanded = String(state.mealListRecipesExpanded);
    panel.querySelector('.meal-list-recipes-toggle')?.setAttribute('aria-expanded', String(state.mealListRecipesExpanded));
    return true;
  };

  function mealListGroceryRowHtml(item) {
    return localGroceryRowHtml(item);
  }

  function renderMealListScreen(origin = 'groceries') {
    const collection = mealListCollectionFromState();
    const active = activeMealList(collection);
    if (!active) return '<section class="meal-list-screen"><div class="empty"><h2>Liste introuvable</h2></div></section>';
    const summary = groceryListSummary(active);
    const groups = {};
    state.groceries.forEach(item => (groups[item.aisle] ??= []).push(item));
    function sortMealListGroceries(left, right) {
      const leftChecked = state.checked.has(localGroceryKey(left));
      const rightChecked = state.checked.has(localGroceryKey(right));
      if (leftChecked !== rightChecked) return Number(leftChecked) - Number(rightChecked);
      return left.name.localeCompare(right.name, 'fr');
    }
    const generated = Object.entries(groups).sort(([left], [right]) => left.localeCompare(right, 'fr')).map(([aisle, items]) => `<section class="group"><h2 class="group-title">${escapeHtml(aisle)}</h2><div class="grocery-groups">${items.sort(sortMealListGroceries).map(mealListGroceryRowHtml).join('')}</div></section>`).join('');
    const pantryReminder = `<aside class="pantry-reminder" aria-label="Rappel de placard"><strong>À vérifier chez vous</strong><p>huile de cuisson, sel et poivre classiques.</p><small>Ces indispensables ne sont pas ajoutés automatiquement.</small></aside>`;
    return `<section class="meal-list-screen" data-screen="groceries" data-meal-list-id="${escapeHtml(active.id)}"><div class="meal-list-title"><h2>${escapeHtml(active.name)}</h2></div><div class="meal-list-remaining"><strong>${summary.remaining}</strong> produit${summary.remaining > 1 ? 's' : ''} restant${summary.remaining > 1 ? 's' : ''}</div>${renderMealListRecipes(active)}<section class="meal-list-courses">${pantryReminder}${renderManualAdd()}${summary.complete ? `<div class="done-banner">${icon('check')}<div><strong>Courses terminées</strong><span>Tous les produits sont cochés.</span></div></div>` : ''}${summary.total ? generated : '<div class="empty meal-list-courses-empty"><h2>Vos Courses sont vides</h2><p>Aucun produit à cocher.</p></div>'}</section></section>`;
  }

  renderGroceries = function renderMealLists() {
    return state.groceryView === 'detail' ? renderMealListScreen('groceries') : renderGroceryHub();
  };

  renderCart = function renderDefaultMealList() {
    return renderMealListScreen('cart');
  };

  window.openGroceryHub = function openMealListHub() {
    syncActiveGroceryListFromState();
    state.groceryView = 'hub';
    state.tab = 'groceries';
    state.detail = null;
    persistAppState();
    render();
    screen.scrollTop = 0;
    return true;
  };

  function openMealList(listId = 'list-default', origin = 'groceries') {
    const saved = syncActiveGroceryListFromState();
    const switched = GROCERY_CORE.switchGroceryList(saved, listId);
    const active = activeMealList(switched);
    if (!active) return false;
    loadActiveGroceryList(switched);
    state.mealListTargetId = active.id;
    state.mealListOrigin = origin;
    state.mealListRecipesExpanded = false;
    state.groceryView = 'detail';
    state.tab = origin === 'cart' ? 'cart' : 'groceries';
    state.detail = null;
    persistAppState();
    render();
    screen.scrollTop = 0;
    return true;
  }

  window.openGroceryList = function(listId) { return openMealList(listId, 'groceries'); };
  window.switchGroceryList = function(listId) { return openMealList(listId, 'groceries'); };

  const baseMealListSetTab = setTab;
  setTab = function mealListSetTab(tab) {
    if (tab === 'cart') return openMealList('list-default', 'cart');
    if (tab === 'groceries') return window.openGroceryHub();
    return baseMealListSetTab(tab);
  };
  window.setTab = setTab;

  function ensureMealListPanels() {
    if (document.getElementById('mealRecipePickerPanel')) return;
    document.body.insertAdjacentHTML('beforeend', `<aside class="overlay grocery-local-overlay" id="mealRecipePickerPanel" role="dialog" aria-modal="true" aria-labelledby="mealRecipePickerTitle"><div class="sheet"><div class="sheet-head"><button class="icon-btn" type="button" onclick="closeMealRecipePicker()" aria-label="Fermer">×</button><div><p class="eyebrow">${escapeHtml(mealListTargetName())}</p><h2 id="mealRecipePickerTitle">Ajouter une recette</h2></div></div><div class="full-panel-body" id="mealRecipePickerBody"></div></div></aside>`);
  }

  function renderMealRecipePicker() {
    const body = document.getElementById('mealRecipePickerBody');
    if (!body) return;
    const query = normalizeSearch(state.mealRecipePickerQuery || '');
    const candidates = EDITORIAL_RECIPES.filter(profileCompatible).filter(item => !query || normalizeSearch(`${item.title} ${item.description}`).includes(query)).slice(0, 24);
    body.innerHTML = `<div class="meal-recipe-picker-intro"><strong>Ajouter à ${escapeHtml(mealListTargetName())}</strong><p>Choisissez une recette. Ses portions resteront modifiables dans la liste.</p></div><label class="meal-recipe-picker-search"><span class="sr-only">Rechercher une recette</span><input type="search" value="${escapeHtml(state.mealRecipePickerQuery)}" placeholder="Rechercher une recette" oninput="filterMealRecipePicker(this.value)"></label><div class="meal-recipe-picker-results">${candidates.map(item => `<article class="meal-recipe-picker-row"><button type="button" onclick="addRecipeToMealList('${localGroceryInlineKey(item.id)}')">${mealListRecipeThumb(item)}<span><strong>${escapeHtml(item.title)}</strong><small>${item.total} min · pour ${item.servings}</small></span><b>Ajouter</b></button></article>`).join('') || '<p class="meal-list-recipes-empty">Aucune recette ne correspond.</p>'}</div>`;
  }

  window.openMealRecipePicker = function() {
    ensureMealListPanels();
    state.mealListTargetId = mealListTargetId();
    state.mealRecipePickerQuery = '';
    renderMealRecipePicker();
    document.getElementById('mealRecipePickerPanel')?.classList.add('open');
    return true;
  };

  window.closeMealRecipePicker = function() {
    document.getElementById('mealRecipePickerPanel')?.classList.remove('open');
  };

  window.filterMealRecipePicker = function(value) {
    state.mealRecipePickerQuery = String(value || '');
    renderMealRecipePicker();
  };

  window.addRecipeToMealList = function(recipeId, servings = null, ingredientsOverride = null, selectionId = '', targetOverride = '') {
    const source = recipe(recipeId);
    if (!source) return false;
    const saved = syncActiveGroceryListFromState();
    const targetId = String(targetOverride || mealListTargetId()).trim() || 'list-default';
    const target = mealListById(targetId, saved);
    if (!target) return false;
    const selectedServings = Math.max(1, Number(servings) || (state.detail?.id === source.id ? state.detail.servings : PROFILE.householdSize) || source.servings || 1);
    const ingredients = Array.isArray(ingredientsOverride) && ingredientsOverride.length
      ? ingredientsOverride
      : activeIngredientsForRecipe(source);
    if (!hasUsableIngredients(ingredients)) {
      toast('Ajoutez au moins un ingrédient avant de l’ajouter au Panier');
      return false;
    }
    const updated = GROCERY_CORE.addMealListRecipe(saved, target.id, {
      selectionId: String(selectionId || '').trim() || undefined,
      recipeId: source.id,
      servings: selectedServings,
      baseServings: source.servings,
      ingredients: (ingredients || source.ingredients || []).map(item => ({ ...item })),
    });
    loadActiveGroceryList({ ...updated, activeListId: target.id });
    state.mealListTargetId = target.id;
    state.groceryView = 'detail';
    state.detail = null;
    window.closeMealRecipePicker();
    persistAppState();
    render();
    toast(`Recette ajoutée à ${target.name}`);
    return true;
  };

  window.updateActiveMealListRecipeServings = function(identity, delta) {
    const recipesMenuWasExpanded = state.mealListRecipesExpanded === true;
    const saved = syncActiveGroceryListFromState();
    const active = activeMealList(saved);
    const selection = mealListSelectionForDirectMutation(active, identity);
    if (!active || !selection) return false;
    const servings = Math.max(1, Math.min(24, selection.servings + Number(delta || 0)));
    if (servings === selection.servings) return false;
    const mutationCollection = mealListDirectMutationCollection(saved, active);
    const updated = GROCERY_CORE.updateMealListRecipeServings(mutationCollection, active.id, selection.selectionId, servings);
    loadActiveGroceryList(updated);
    state.mealListTargetId = active.id;
    state.mealListRecipesExpanded = recipesMenuWasExpanded;
    if (state.detail?.selectionId === selection.selectionId) state.detail.servings = servings;
    persistAppState();
    render();
    toast('Portions et Courses mises à jour');
    return true;
  };

  window.removeRecipeFromActiveMealList = function(identity) {
    const saved = syncActiveGroceryListFromState();
    const active = activeMealList(saved);
    const selection = mealListSelectionForDirectMutation(active, identity);
    if (!active || !selection) return false;
    const mutationCollection = mealListDirectMutationCollection(saved, active);
    const updated = GROCERY_CORE.removeMealListRecipe(mutationCollection, active.id, selection.selectionId);
    loadActiveGroceryList(updated);
    state.mealListTargetId = active.id;
    state.detail = null;
    persistAppState();
    render();
    toast('Recette supprimée de la liste');
    return true;
  };

  window.askDeleteMealList = function(listId) {
    const list = mealListById(listId);
    if (!list || list.id === 'list-default') return false;
    openDialog('deleteMealList', 'Supprimer cette liste ?', `« ${list.name} », ses recettes, ses produits et ses coches seront supprimés de cet appareil.`, 'Supprimer', list.id, 'Garder');
    return true;
  };

  window.deleteMealList = function(listId) {
    const saved = syncActiveGroceryListFromState();
    const targetId = String(listId || '');
    if (targetId === 'list-default' || !saved.lists.some(list => list.id === targetId)) return false;
    const lists = saved.lists.filter(list => list.id !== targetId);
    const updated = { activeListId: 'list-default', lists };
    loadActiveGroceryList(updated);
    state.mealListTargetId = 'list-default';
    state.groceryView = 'hub';
    state.tab = 'groceries';
    persistAppState();
    render();
    toast('Liste supprimée');
    return true;
  };

  const baseMealListConfirmDialog = window.confirmDialog;
  window.confirmDialog = function mealListConfirmDialog() {
    const pending = state.pending;
    if (pending?.type === 'deleteMealList') {
      window.deleteMealList(pending.id);
      closeDialog();
      return;
    }
    return baseMealListConfirmDialog?.();
  };
  confirmDialog = window.confirmDialog;
  document.getElementById('dialogConfirm').onclick = window.confirmDialog;

  window.saveGroceryListCreator = function saveMealListCreator() {
    const name = String(document.getElementById('groceryListName')?.value || '').trim();
    const error = document.getElementById('groceryListCreatorError');
    if (!name) {
      if (error) error.textContent = 'Indiquez un nom de liste.';
      return false;
    }
    const saved = syncActiveGroceryListFromState();
    const id = `manual-list-${Date.now()}`;
    const created = GROCERY_CORE.createGroceryList(saved, { id, name, kind: 'manual', items: [], checked: [], history: [] });
    loadActiveGroceryList(created);
    state.mealListTargetId = id;
    state.groceryView = 'hub';
    state.tab = 'groceries';
    state.detail = null;
    window.closeGroceryListCreator();
    persistAppState();
    render();
    screen.scrollTop = 0;
    toast(`Liste « ${name} » créée`);
    return true;
  };

  const baseMealListOpenDetail = openDetail;
  openDetail = function mealListOpenDetail(id, origin = state.tab, navigationIds = null, selectionId = '') {
    const source = recipe(id);
    if (!source) return false;
    const target = mealListById(mealListTargetId());
    const selection = selectionId ? mealListSelectionFor(target, selectionId) : null;
    const ids = normalizeRecipeNavigationIds(navigationIds, source.id);
    const returnScrollTop = Number.isFinite(state.detail?.returnScrollTop)
      ? state.detail.returnScrollTop
      : Math.max(0, screen?.scrollTop || 0);
    state.detail = {
      id: source.id,
      selectionId: selection?.selectionId || String(selectionId || ''),
      origin: origin || state.tab,
      returnScrollTop,
      servings: selection?.servings || state.detail?.servings || PROFILE.householdSize || source.servings,
      navigation: { ids, index: Math.max(0, ids.indexOf(source.id)) },
    };
    render();
    screen.scrollTop = 0;
    return true;
  };
  window.openDetail = openDetail;

  const baseMealListDetailRenderer = renderDetail;
  renderDetail = function mealListDetailRenderer() {
    const source = state.detail ? recipe(state.detail.id) : null;
    const html = baseMealListDetailRenderer();
    if (!source) return html;
    const target = mealListById('list-default');
    const selected = mealListSelectionFor(target, state.detail.selectionId);
    const added = Boolean(selected) || mealListRecipeSelections(target).some(selection => selection.recipeId === source.id);
    const actionLabel = added ? 'Ajouter une autre version au Panier' : 'Ajouter au Panier';
    const action = `<button class="primary ${added ? 'success' : ''}" data-detail-add onclick="addCart('${localGroceryInlineKey(source.id)}',${state.detail.servings},true)">${actionLabel}</button>`;
    return html.replace(/<button class="primary[^"]*" data-detail-add onclick="addCart\('[^']+',[-\d.]+,true\)">[^<]*<\/button>/, action);
  };

  function recipeActionIcon() {
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"></circle><circle cx="12" cy="12" r="1.7"></circle><circle cx="19" cy="12" r="1.7"></circle></svg>';
  }

  function recipeActionEditIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 20 4.2-1 10-10a2.2 2.2 0 0 0-3.1-3.1l-10 10L4 20Z"></path><path d="m13.7 7.3 3 3"></path></svg>';
  }

  card = function mealListCard(source, navigationIds = []) {
    const favorite = state.favorites.has(source.id);
    const manual = isManualPersonalRecipe(source);
    const difficulty = difficultyLabels[source.difficultyKey] || source.difficulty || 'Facile';
    const benefit = cardBenefit(source);
    const safeId = localGroceryInlineKey(source.id);
    return `<article class="recipe-card" data-recipe-id="${source.id}" tabindex="0" role="button" aria-label="Voir ${escapeHtml(source.title)}" onclick="openDetail('${safeId}',state.tab,${recipeNavigationLiteral(navigationIds)})" onkeydown="if(event.key==='Enter')openDetail('${safeId}',state.tab,${recipeNavigationLiteral(navigationIds)})"><div class="cover">${coverHtml(source, false, false)}<button type="button" class="round-btn recipe-action-btn" data-favorite="${favorite}" aria-label="Actions de la recette ${escapeHtml(source.title)}" title="Actions de la recette" onclick="event.stopPropagation();openRecipeActionMenu('${safeId}',this)">${recipeActionIcon()}</button></div><div class="card-body"><h3>${escapeHtml(source.title)}</h3><div class="card-meta">${manual ? (personalRecipeMetadataForCard(source).length ? `<span class="personal-card-meta" data-personal-metadata="true">${escapeHtml(personalRecipeMetadataForCard(source).join(' · '))}</span>` : '') : `<span class="time">${source.total} min · ${escapeHtml(difficulty)}</span>`}</div><div class="card-bottom">${cardQualityHtml(source, benefit)}</div></div></article>`;
  };

  function ensureRecipeActionPanel() {
    if (!document.getElementById('recipeActionPanel')) {
      document.body.insertAdjacentHTML('beforeend', `<aside class="overlay recipe-action-overlay" id="recipeActionPanel" role="dialog" aria-modal="true" aria-label="Menu d’actions" onclick="if(event.target===this)closeRecipeActionPanel()"><div class="sheet recipe-action-sheet"><div class="recipe-action-body" id="recipeActionPanelBody"></div></div></aside>`);
    }
    return document.getElementById('recipeActionPanel');
  }

  function renderRecipeActionPanel(recipeId) {
    const source = recipe(recipeId);
    if (!source) return false;
    const safeId = localGroceryInlineKey(source.id);
    const panel = ensureRecipeActionPanel();
    const body = document.getElementById('recipeActionPanelBody');
    if (source.personal) {
      const added = personalRecipeActionInCart(source.id);
      body.innerHTML = `<button type="button" class="recipe-action-choice recipe-action-cart-choice" onclick="toggleRecipeActionCart('${safeId}')"><span class="recipe-action-choice-icon recipe-action-cart-icon">${icon(added ? 'check' : 'cart')}</span><span><strong>${added ? 'Retirer du Panier' : 'Ajouter au Panier'}</strong></span><span class="recipe-action-arrow" aria-hidden="true">›</span></button><button type="button" class="recipe-action-choice recipe-action-lists-choice" onclick="openRecipeActionLists('${safeId}')"><span class="recipe-action-choice-icon recipe-action-list-icon">${icon('list')}</span><span><strong>Ajouter à une liste</strong></span><span class="recipe-action-arrow" aria-hidden="true">›</span></button><button type="button" class="recipe-action-choice recipe-action-edit-choice" onclick="openRecipeActionEditor('${safeId}')"><span class="recipe-action-choice-icon recipe-action-edit-icon">${recipeActionEditIcon()}</span><span><strong>Éditer la recette</strong></span><span class="recipe-action-arrow" aria-hidden="true">›</span></button><button type="button" class="recipe-action-choice recipe-action-delete-choice" onclick="askDeletePersonalRecipeFromAction('${safeId}')"><span class="recipe-action-choice-icon recipe-action-delete-icon">${icon('trash')}</span><span><strong>Supprimer</strong></span><span class="recipe-action-arrow" aria-hidden="true">›</span></button>`;
      return panel;
    }
    const added = discoverCartContains(source.id);
    body.innerHTML = `<button type="button" class="recipe-action-choice recipe-action-cart-choice" onclick="toggleRecipeActionCart('${safeId}')"><span class="recipe-action-choice-icon recipe-action-cart-icon">${icon(added ? 'check' : 'cart')}</span><span><strong>${added ? 'Retirer du Panier' : 'Ajouter au Panier'}</strong></span><span class="recipe-action-arrow" aria-hidden="true">›</span></button><button type="button" class="recipe-action-choice recipe-action-favorite-choice" data-favorite="${state.favorites.has(source.id)}" onclick="toggleRecipeActionFavorite('${safeId}')"><span class="recipe-action-choice-icon">${icon('heart')}</span><span><strong>${state.favorites.has(source.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}</strong></span><span class="recipe-action-arrow" aria-hidden="true">›</span></button><button type="button" class="recipe-action-choice recipe-action-lists-choice" onclick="openRecipeActionLists('${safeId}')"><span class="recipe-action-choice-icon recipe-action-list-icon">${icon('list')}</span><span><strong>Ajouter à une liste</strong></span><span class="recipe-action-arrow" aria-hidden="true">›</span></button>`;
    return panel;
  }

  function renderRecipeActionListPanel(recipeId) {
    const source = recipe(recipeId);
    if (!source) return false;
    const safeId = localGroceryInlineKey(source.id);
    const collection = currentGroceryListCollection();
    const manualLists = collection.lists.filter(list => list.id !== 'list-default' && ['manual', 'meal'].includes(list.kind));
    const listOptions = manualLists.map(list => {
      const safeListId = localGroceryInlineKey(list.id);
      return `<button type="button" class="recipe-action-choice recipe-action-list-choice" onclick="addRecipeToManualList('${safeId}','${safeListId}')"><span class="recipe-action-choice-icon recipe-action-list-icon">${icon('list')}</span><span><strong>${escapeHtml(list.name)}</strong></span><span class="recipe-action-arrow" aria-hidden="true">›</span></button>`;
    }).join('');
    const panel = ensureRecipeActionPanel();
    const body = document.getElementById('recipeActionPanelBody');
    body.innerHTML = manualLists.length
      ? `<div class="recipe-action-list" aria-label="Listes manuelles">${listOptions}</div>`
      : `<p class="recipe-action-empty">Aucune liste manuelle. Crée-la dans Courses.</p>`;
    return panel;
  }

  window.closeRecipeActionPanel = function closeRecipeActionPanel() {
    document.getElementById('recipeActionPanel')?.classList.remove('open');
    return true;
  };

  function positionRecipeActionPanel(panel, anchor) {
    const sheet = panel.querySelector('.recipe-action-sheet');
    if (!sheet) return false;
    const surface = panel.getBoundingClientRect();
    const trigger = anchor?.getBoundingClientRect?.();
    const gap = 8;
    const width = sheet.offsetWidth;
    const height = sheet.offsetHeight;
    const maxLeft = Math.max(gap, surface.width - width - gap);
    const maxTop = Math.max(gap, surface.height - height - gap);
    let left = trigger
      ? trigger.right - surface.left - width
      : (surface.width - width) / 2;
    let top = trigger
      ? trigger.bottom - surface.top + gap
      : (surface.height - height) / 2;
    if (trigger && top + height > surface.height - gap) {
      top = trigger.top - surface.top - height - gap;
      sheet.dataset.placement = 'above';
    } else {
      sheet.dataset.placement = 'below';
    }
    sheet.style.left = `${Math.round(Math.max(gap, Math.min(left, maxLeft)))}px`;
    sheet.style.top = `${Math.round(Math.max(gap, Math.min(top, maxTop)))}px`;
    return true;
  }

  window.openRecipeActionMenu = function openRecipeActionMenu(recipeId, anchor) {
    const panel = renderRecipeActionPanel(recipeId);
    if (!panel) return false;
    panel.__recipeActionAnchor = anchor || null;
    panel.classList.add('open');
    positionRecipeActionPanel(panel, panel.__recipeActionAnchor);
    scheduleQa();
    return true;
  };

  window.openRecipeActionLists = function openRecipeActionLists(recipeId) {
    const panel = renderRecipeActionListPanel(recipeId);
    if (!panel) return false;
    panel.classList.add('open');
    positionRecipeActionPanel(panel, panel.__recipeActionAnchor);
    scheduleQa();
    return true;
  };

  window.toggleRecipeActionFavorite = function toggleRecipeActionFavorite(recipeId) {
    const result = window.toggleFavorite?.(recipeId);
    if (result) window.closeRecipeActionPanel();
    return Boolean(result);
  };

  function personalRecipeActionInCart(recipeId, collection = null) {
    const target = mealListById('list-default', collection || undefined);
    if (!target) return false;
    const active = mealListRecipeSelections(target);
    const prepared = mealListPreparedRecipeSelections(target);
    return active.some(selection => selection.recipeId === recipeId)
      || prepared.some(selection => selection.recipeId === recipeId);
  }

  function syncPersonalRecipeActionCartControls(recipeId, collection = null) {
    const added = personalRecipeActionInCart(recipeId, collection);
    renderNav();
    return added;
  }

  window.toggleRecipeActionCart = function toggleRecipeActionCart(recipeId) {
    const source = recipe(recipeId);
    if (!source) return false;
    if (!source.personal) {
      const result = window.toggleDiscoverCart?.(source.id, PROFILE.householdSize);
      if (result) window.closeRecipeActionPanel();
      return Boolean(result);
    }
    const saved = syncActiveGroceryListFromState();
    const target = mealListById('list-default', saved);
    if (!target) return false;
    const existing = mealListSelectionForDirectMutation(target, source.id);
    const mutationCollection = mealListDirectMutationCollection(saved, target);
    let updated;
    if (existing) {
      updated = GROCERY_CORE.removeMealListRecipe(mutationCollection, target.id, existing.selectionId);
    } else {
      const ingredients = activeIngredientsForRecipe(source);
      if (!hasUsableIngredients(ingredients)) {
        toast('Ajoutez au moins un ingrédient avant de l’ajouter au Panier');
        return false;
      }
      updated = GROCERY_CORE.addMealListRecipe(mutationCollection, target.id, {
        recipeId: source.id,
        servings: Math.max(1, Number(PROFILE.householdSize) || source.servings || 1),
        baseServings: Math.max(1, Number(source.servings) || 1),
        ingredients: ingredients.map(item => ({ ...item })),
      });
    }
    applyMealListCollection(updated);
    persistAppState();
    syncPersonalRecipeActionCartControls(source.id, updated);
    toast(existing ? 'Recette retirée du panier' : 'Recette ajoutée au panier');
    window.closeRecipeActionPanel();
    return true;
  };

  window.openRecipeActionEditor = function openRecipeActionEditor(recipeId) {
    const source = recipe(recipeId);
    if (!source?.personal) return false;
    window.closeRecipeActionPanel();
    openPersonalRecipeEditor(recipeId);
    return true;
  };

  window.askDeletePersonalRecipeFromAction = function askDeletePersonalRecipeFromAction(recipeId) {
    const source = recipe(recipeId);
    if (!source?.personal) return false;
    window.closeRecipeActionPanel();
    askDeletePersonalRecipe(recipeId);
    return true;
  };

  window.addRecipeToManualList = function addRecipeToManualList(recipeId, listId) {
    const source = recipe(recipeId);
    if (!source) return false;
    const saved = syncActiveGroceryListFromState();
    const targetId = String(listId || '').trim();
    const target = saved.lists.find(list => list.id === targetId && list.id !== 'list-default' && ['manual', 'meal'].includes(list.kind));
    if (!target) return false;
    if (mealListRecipeSelections(target).some(selection => selection.recipeId === source.id)) {
      window.closeRecipeActionPanel();
      toast(`Cette recette est déjà dans « ${target.name} »`);
      return true;
    }
    const ingredients = activeIngredientsForRecipe(source);
    if (!hasUsableIngredients(ingredients)) {
      toast('Ajoutez au moins un ingrédient avant de l’ajouter à une liste');
      return false;
    }
    const updated = GROCERY_CORE.addMealListRecipe(saved, target.id, {
      recipeId: source.id,
      servings: Math.max(1, Number(PROFILE.householdSize) || source.servings || 1),
      baseServings: Math.max(1, Number(source.servings) || 1),
      ingredients: ingredients.map(item => ({ ...item })),
    });
    loadActiveGroceryList({ ...updated, activeListId: saved.activeListId });
    persistAppState();
    window.closeRecipeActionPanel();
    toast(`Recette ajoutée à « ${target.name} »`);
    if (state.tab === 'groceries') render();
    return true;
  };

  function syncFavoriteControls(id) {
    const favorite = state.favorites.has(id);
    const escapedId = String(id).replace(/(["\\])/g, '\\$1');
    const cards = [...document.querySelectorAll(`.recipe-card[data-recipe-id="${escapedId}"]`)];
    document.querySelectorAll(`.recipe-card[data-recipe-id="${escapedId}"] .favorite-btn`).forEach(button => {
      button.classList.toggle('on', favorite);
      button.setAttribute('aria-label', favorite ? 'Retirer des favoris' : 'Ajouter aux favoris');
    });
    document.querySelectorAll(`.recipe-card[data-recipe-id="${escapedId}"] .recipe-action-btn`).forEach(button => {
      button.dataset.favorite = String(favorite);
      button.setAttribute('aria-pressed', String(favorite));
    });
    document.querySelectorAll('.detail-favorite').forEach(button => {
      button.classList.toggle('on', favorite);
      button.setAttribute('aria-label', favorite ? 'Retirer des favoris' : 'Ajouter aux favoris');
    });
    if (!favorite && state.tab === 'favorites' && state.libraryView !== 'personal') {
      cards.forEach(cardElement => cardElement.remove());
      const grid = document.querySelector('[data-screen="favorites"] .recipe-grid');
      if (grid && !grid.children.length) screen.innerHTML = renderFavorites();
    }
  }
  window.toggleFavorite = function fastFavoriteToggle(id) {
    if (typeof localAuthLoad === 'function' && !localAuthLoad()?.verified) {
      return window.requestAccountForFavorite ? window.requestAccountForFavorite(id) : window.requestAccountForShare?.();
    }
    const source = recipe(id);
    if (!source) return false;
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    if (source.personal) savePersonalLibrary();
    persistAppState();
    syncFavoriteControls(id);
    toast(state.favorites.has(id) ? 'Ajouté aux favoris' : 'Retiré des favoris');
    return true;
  };
  toggleFavorite = window.toggleFavorite;

  const nativeDiscoverCartToggle = addCart;
  function discoverCartContains(id) {
    const list = mealListById('list-default');
    const source = recipe(id);
    if (!source) return false;
    const selections = mealListRecipeSelections(list).length
      ? mealListRecipeSelections(list)
      : mealListPreparedRecipeSelections(list);
    return selections.some(selection => selection.recipeId === source.id && !selectionVersionInfo(selection, source).modified);
  }
  function syncDiscoverCartControls(id) {
    renderNav();
  }
  window.toggleDiscoverCart = function toggleDiscoverCart(id, servings = PROFILE.householdSize) {
    const source = recipe(id);
    if (!source) return false;
    const saved = syncActiveGroceryListFromState();
    const target = mealListById('list-default', saved);
    if (!target) return false;
    const activeSelections = mealListRecipeSelections(target);
    const preparedSelections = activeSelections.length ? [] : mealListPreparedRecipeSelections(target);
    const sourceSelections = activeSelections.length ? activeSelections : preparedSelections;
    const matching = sourceSelections.filter(selection => selection.recipeId === source.id);
    const originalSelection = matching.find(selection => !selectionVersionInfo(selection, source).modified);
    if (!originalSelection && !hasUsableIngredients(source.ingredients)) {
      toast('Ajoutez au moins un ingrédient avant de l’ajouter au Panier');
      return false;
    }
    const mutationCollection = mealListDirectMutationCollection(saved, target);
    const updated = originalSelection
      ? GROCERY_CORE.removeMealListRecipe(mutationCollection, target.id, originalSelection.selectionId)
      : GROCERY_CORE.addMealListRecipe(mutationCollection, target.id, {
          recipeId: source.id,
          servings: Math.max(1, Number(servings) || PROFILE.householdSize || source.servings || 1),
          baseServings: Math.max(1, Number(source.servings) || 1),
          // Découvrir et la recherche ajoutent toujours le catalogue original.
          ingredients: source.ingredients.map(item => ({ ...item })),
        });
    applyMealListCollection(updated);
    persistAppState();
    syncDiscoverCartControls(id);
    toast(originalSelection ? 'Recette originale retirée du panier' : 'Recette originale ajoutée au panier');
    return true;
  };
  window.addCart = function mealListAddRecipe(id, servings) {
    return window.addRecipeToMealList(id, servings, null, '', 'list-default');
  };
  addCart = window.addCart;

  function syncAndRenderActiveMealList(result) {
    const recipesMenuWasExpanded = state.mealListRecipesExpanded;
    syncActiveGroceryListFromState();
    state.mealListRecipesExpanded = recipesMenuWasExpanded;
    render();
    return result;
  }

  const nativeMealListAddManualProduct = window.addManualProduct;
  window.addManualProduct = function mealListAddManualProduct(...args) {
    const result = nativeMealListAddManualProduct?.(...args);
    return syncAndRenderActiveMealList(result);
  };
  addManualProduct = window.addManualProduct;

  const nativeMealListRemoveGroceryItem = window.removeGroceryItem;
  window.removeGroceryItem = function mealListRemoveGroceryItem(...args) {
    const result = nativeMealListRemoveGroceryItem?.(...args);
    return syncAndRenderActiveMealList(result);
  };
  removeGroceryItem = window.removeGroceryItem;
  window.removeManualProduct = function mealListRemoveManualProduct(key) { return window.removeGroceryItem(key); };
  removeManualProduct = window.removeManualProduct;

  const nativeMealListToggleCheck = window.toggleCheck;
  if (typeof nativeMealListToggleCheck === 'function') {
    window.toggleCheck = function mealListToggleCheck(...args) {
      const result = nativeMealListToggleCheck?.(...args);
      return syncAndRenderActiveMealList(result);
    };
    toggleCheck = window.toggleCheck;
  }

  const nativeMealListSaveGroceryEditor = window.saveGroceryEditor;
  if (typeof nativeMealListSaveGroceryEditor === 'function') {
    window.saveGroceryEditor = function mealListSaveGroceryEditor(...args) {
      const result = nativeMealListSaveGroceryEditor?.(...args);
      return syncAndRenderActiveMealList(result);
    };
  }

  const nativeMealListMarkGroceryForReview = window.markGroceryForReview;
  if (typeof nativeMealListMarkGroceryForReview === 'function') {
    window.markGroceryForReview = function mealListMarkGroceryForReview(...args) {
      const result = nativeMealListMarkGroceryForReview?.(...args);
      return syncAndRenderActiveMealList(result);
    };
  }

  window.detailQty = function mealListDetailQty(delta) {
    const source = state.detail ? recipe(state.detail.id) : null;
    const active = mealListById(mealListTargetId());
    const selection = source && mealListSelectionFor(active, state.detail?.selectionId);
    if (selection) return window.updateActiveMealListRecipeServings(selection.selectionId, delta);
    if (!state.detail) return false;
    state.detail.servings = Math.max(1, Math.min(24, state.detail.servings + Number(delta || 0)));
    render();
    return true;
  };
  detailQty = window.detailQty;

  function updateCartRecipeSelection(collection, selectionId, updater) {
    const target = mealListById('list-default', collection);
    if (!target) return collection;
    const selectedId = String(selectionId || '');
    const current = mealListRecipeSelections(target);
    const next = updater(current.map(selection => ({
      ...selection,
      ingredients: selection.ingredients.map(ingredient => ({ ...ingredient })),
    })), selectedId);
    return GROCERY_CORE.rebuildMealListCourses(
      GROCERY_CORE.updateGroceryListById(collection, target.id, {
        ...target,
        kind: 'meal',
        basketId: '',
        recipeSelections: next,
        sourceRecipeSelections: next,
        sourceRecipeIds: next.map(selection => selection.recipeId),
      }),
      target.id,
    );
  }

  function selectionVersionInfo(selection, source) {
    const normalize = ingredients => (ingredients || []).map(item => ({
      id: item.id || '', name: item.name || '', qty: item.qty ?? null,
      unit: item.unit || '', coursesStatus: item.coursesStatus || '',
    }));
    const modified = JSON.stringify(normalize(selection?.ingredients)) !== JSON.stringify(normalize(source?.ingredients));
    return {
      modified: modified || Boolean(source?.personal),
      label: source?.personal ? 'Personnelle' : modified ? 'Modifiée' : 'Originale',
    };
  }

  window.updateCartRecipeServings = function updateCartRecipeServings(identity, delta) {
    const saved = syncActiveGroceryListFromState();
    const target = mealListById('list-default', saved);
    const selection = mealListSelectionFor(target, identity);
    if (!selection) return false;
    const servings = Math.max(1, Math.min(24, selection.servings + Number(delta || 0)));
    if (servings === selection.servings) return false;
    const updated = updateCartRecipeSelection(saved, selection.selectionId, selections => selections.map(item => item.selectionId === selection.selectionId ? { ...item, servings } : item));
    loadActiveGroceryList({ ...updated, activeListId: 'list-default' });
    state.mealListTargetId = 'list-default';
    persistAppState();
    render();
    return true;
  };

  window.removeRecipeFromCart = function removeRecipeFromCart(identity) {
    const saved = syncActiveGroceryListFromState();
    const target = mealListById('list-default', saved);
    const selection = mealListSelectionFor(target, identity);
    if (!selection) return false;
    const updated = updateCartRecipeSelection(saved, selection.selectionId, selections => selections.filter(item => item.selectionId !== selection.selectionId));
    loadActiveGroceryList({ ...updated, activeListId: 'list-default' });
    state.mealListTargetId = 'list-default';
    persistAppState();
    render();
    toast('Version retirée du panier');
    return true;
  };

  window.openCartRecipeEditor = function openCartRecipeEditor(recipeId) {
    const identity = recipeId;
    const target = mealListById('list-default');
    const selection = mealListSelectionFor(target, identity);
    const source = selection ? recipe(selection.recipeId) : null;
    if (!source || !selection) return false;
    state.mealListTargetId = 'list-default';
    state.detail = { id: source.id, selectionId: selection.selectionId, origin: 'cart', servings: selection.servings, navigation: { ids: mealListRecipeSelections(target).map(item => item.recipeId), index: 0 } };
    render();
    openVersionEditor(source.id, selection.selectionId);
    const draft = state.versionDraft;
    if (draft) {
      draft.returnToCart = true;
      draft.openingFingerprint = CART_VERSION_EDITOR_CLOSE_CORE.fingerprint(draft);
    }
    return true;
  };

  function discardCartVersionDraftAndReturn() {
    state.versionDraft = null;
    versionPanel.classList.remove('open');
    state.detail = null;
    return returnToCurrentCart();
  }

  window.closeCartVersionEditor = function closeCartVersionEditor() {
    const draft = state.versionDraft;
    if (!draft?.returnToCart) {
      versionPanel.classList.remove('open');
      return true;
    }
    if (!CART_VERSION_EDITOR_CLOSE_CORE.isDirty(draft)) {
      return discardCartVersionDraftAndReturn();
    }
    openDialog('discardCartVersionEdit', 'Abandonner vos modifications ?', 'Vos changements non enregistrés seront perdus. Voulez-vous revenir au panier ?', 'Abandonner', null, 'Continuer à modifier');
    return false;
  };

  const baseCartVersionConfirmDialog = window.confirmDialog;
  window.confirmDialog = function cartVersionConfirmDialog() {
    const pending = state.pending;
    if (pending?.type === 'unchangedPersonalVersionAlreadyFavorite') {
      closeDialog();
      versionPanel.classList.add('open');
      return true;
    }
    if (pending?.type === 'unchangedPersonalVersion') {
      state.favorites.add(pending.id);
      persistAppState();
      closeDialog();
      versionPanel.classList.add('open');
      toast('Recette ajoutée aux favoris');
      return true;
    }
    if (pending?.type === 'discardCartVersionEdit') {
      closeDialog();
      return discardCartVersionDraftAndReturn();
    }
    return baseCartVersionConfirmDialog?.();
  };
  confirmDialog = window.confirmDialog;
  document.getElementById('dialogConfirm').onclick = window.confirmDialog;

  const baseCartVersionCloseDialog = window.closeDialog || closeDialog;
  window.closeDialog = function cartVersionCloseDialog() {
    const pending = state.pending;
    const result = baseCartVersionCloseDialog?.();
    if (pending?.type === 'discardCartVersionEdit') versionPanel.classList.add('open');
    return result;
  };
  closeDialog = window.closeDialog;
  document.getElementById('dialogCancel').onclick = window.closeDialog;

  function renderRecipeCartScreen() {
    const list = mealListById('list-default');
    const selections = mealListRecipeSelections(list);
    if (!selections.length) return `<section class="recipe-cart-screen" data-screen="cart-empty"><div class="empty"><div class="empty-mark">${icon('cart')}</div><h2>Votre panier est vide</h2><p>Ajoutez une recette depuis Découvrir ou Favoris.</p><button class="primary" onclick="setTab('discover')">Découvrir les recettes</button></div></section>`;
    const navigation = selections.map(selection => `'${localGroceryInlineKey(selection.recipeId)}'`).join(',');
    const rows = selections.map(selection => {
      const source = recipe(selection.recipeId);
      if (!source) return '';
      const safeId = localGroceryInlineKey(source.id);
      const safeSelectionId = localGroceryInlineKey(selection.selectionId);
      const version = selectionVersionInfo(selection, source);
      return `<article class="recipe-cart-card" data-cart-recipe-id="${escapeHtml(source.id)}" data-cart-selection-id="${escapeHtml(selection.selectionId)}"><button type="button" class="recipe-cart-open" onclick="openDetail('${safeId}','cart',[${navigation}],'${safeSelectionId}')"><span class="recipe-cart-thumb">${mealListRecipeThumb(source)}</span><span class="recipe-cart-copy"><strong class="recipe-cart-title">${escapeHtml(source.title)}</strong><small class="recipe-cart-version ${version.modified ? 'modified' : 'original'}">${escapeHtml(version.label)}</small></span>${icon('chevron')}</button><div class="recipe-cart-card-actions"><div class="recipe-cart-stepper" aria-label="Portions de ${escapeHtml(source.title)}"><button type="button" aria-label="Retirer une portion de ${escapeHtml(source.title)}" onclick="updateCartRecipeServings('${safeSelectionId}',-1)">−</button><span><strong>${selection.servings}</strong><small>portion${selection.servings > 1 ? 's' : ''}</small></span><button type="button" aria-label="Ajouter une portion à ${escapeHtml(source.title)}" onclick="updateCartRecipeServings('${safeSelectionId}',1)">+</button></div><div class="recipe-cart-secondary-actions"><button type="button" class="recipe-cart-edit" onclick="openCartRecipeEditor('${safeSelectionId}')">Modifier</button><button type="button" class="recipe-cart-remove" onclick="removeRecipeFromCart('${safeSelectionId}')">Retirer</button></div></div></article>`;
    }).join('');
    const portions = selections.reduce((total, selection) => total + selection.servings, 0);
    return `<section class="recipe-cart-screen" data-screen="cart"><div class="recipe-cart-actions"><button class="primary cart-content-prepare" type="button" onclick="prepareCartGroceries()">Préparer les courses</button></div><div class="recipe-cart-summary"><strong>${selections.length} recette${selections.length > 1 ? 's' : ''}</strong><span>${portions} portion${portions > 1 ? 's' : ''}</span></div><div class="recipe-cart-list">${rows}</div></section>`;
  }

  renderCart = function renderRecipeOnlyCart() {
    return renderRecipeCartScreen();
  };

  const nativeApplyVersionForMealLists = window.applyVersion || applyVersion;
  window.applyVersion = function mealListApplyVersion() {
    const sourceId = state.detail?.id;
    const source = sourceId ? recipe(sourceId) : null;
    const selectionId = state.versionDraft?.selectionId || state.detail?.selectionId || '';
    const servings = state.detail?.servings;
    const draftIngredients = state.versionDraft?.ingredients?.map(item => ({ ...item }));
    if (!source || !Array.isArray(draftIngredients)) return false;
    if (!requireVersionIngredient(draftIngredients)) return false;
    const saved = syncActiveGroceryListFromState();
    const target = mealListById('list-default', saved);
    if (!target) return false;
    const selection = selectionId ? mealListSelectionFor(target, selectionId) : null;
    const ingredients = draftIngredients.map(item => ({ ...item }));
    const updated = selection
      ? updateCartRecipeSelection(saved, selection.selectionId, selections => selections.map(item => item.selectionId === selection.selectionId
        ? { ...item, servings, ingredients }
        : item))
      : GROCERY_CORE.addMealListRecipe(saved, target.id, {
        recipeId: source.id,
        servings: Math.max(1, Number(servings) || source.servings || 1),
        baseServings: Math.max(1, Number(source.servings) || 1),
        ingredients,
      });
    loadActiveGroceryList({ ...updated, activeListId: 'list-default' });
    state.mealListTargetId = 'list-default';
    state.cart.clear();
    state.cartVersions.clear();
    state.detail = null;
    state.versionDraft = null;
    versionPanel.classList.remove('open');
    persistAppState();
    toast(selection
      ? 'Recette modifiée ajoutée au panier'
      : 'Recette ajoutée au panier');
    return returnToCurrentCart();
  };
  applyVersion = window.applyVersion;

  const baseMealListHeader = renderHeader;
  renderHeader = function recipeCartHeader() {
    if (state.detail) return baseMealListHeader();
    if (state.tab !== 'cart' && state.tab !== 'groceries') return baseMealListHeader();
    if (state.tab === 'cart') {
      header.className = 'app-header recipe-cart-header';
      header.innerHTML = `<h1 class="page-title">Mon panier</h1><div class="header-actions"><button class="icon-btn cart-header-history" type="button" aria-label="Historique des paniers" onclick="setTab('archives')">${icon('history')}</button></div>`;
      return;
    }
    const isDetail = state.groceryView === 'detail';
    if (isDetail) {
      header.className = 'app-header grocery-detail-header';
      header.innerHTML = `<button type="button" class="grocery-header-back" onclick="openGroceryHub()" aria-label="Retour à Mes listes">${icon('back')}<span>Mes listes</span></button><div class="header-actions">${feedbackButton()}</div>`;
      return;
    }
    header.className = 'app-header';
    header.innerHTML = `<h1 class="page-title">Mes listes</h1><div class="header-actions"><button class="icon-btn" aria-label="Créer une nouvelle liste" onclick="openGroceryListCreator()">${icon('plus')}</button>${feedbackButton()}</div>`;
  };

  renderNav = function mealListNav() {
    const defaultList = mealListById('list-default');
    const activeSelections = mealListRecipeSelections(defaultList);
    const count = activeSelections.length;
    const items = [['discover', 'Découvrir', 'discover'], ['favorites', 'Favoris', 'heart'], ['cart', 'Mon panier', 'cart'], ['groceries', 'Listes', 'list'], ['profile', 'Profil', 'user']];
    const active = state.tab === 'archives' ? 'cart' : state.tab;
    nav.innerHTML = items.map(([id, label, glyph]) => `<button class="nav-item ${active === id ? 'active' : ''}" data-tab="${id}" onclick="setTab('${id}')">${icon(glyph)}<span>${label}</span>${id === 'cart' && count ? `<b class="badge-count">${count}</b>` : ''}</button>`).join('');
  };

  window.prepareCartGroceries = function prepareCartGroceries() {
    const saved = syncActiveGroceryListFromState();
    const target = mealListById('list-default', saved);
    const selections = mealListRecipeSelections(target);
    if (!target || !selections.length) return false;
    archiveRecipeSelections(selections);
    const prepared = GROCERY_CORE.finalizeMealListPreparation(saved, target.id);
    loadActiveGroceryList({ ...prepared, activeListId: target.id });
    state.mealListTargetId = target.id;
    state.tab = 'groceries';
    state.groceryView = 'detail';
    state.detail = null;
    persistAppState();
    render();
    screen.scrollTop = 0;
    toast('Courses préparées à partir du panier');
    return true;
  };

  function archiveRecipeSelections(selections) {
    const items = selections.map(selection => [selection.recipeId, selection.servings, selection.selectionId]);
    const signature = items.slice().sort(([leftId, leftServings, leftSelectionId], [rightId, rightServings, rightSelectionId]) => `${leftId}:${leftServings}:${leftSelectionId}`.localeCompare(`${rightId}:${rightServings}:${rightSelectionId}`)).map(([id, servings, selectionId]) => `${id}:${servings}:${selectionId}`).join('|');
    if (state.archived[0]?.signature === signature) return false;
    state.archived.unshift({
      id: Date.now(),
      date: 'Aujourd’hui',
      items,
      signature,
      versions: selections.map(selection => ({
        selectionId: selection.selectionId,
        recipeId: selection.recipeId,
        servings: selection.servings,
        ingredients: selection.ingredients.map(item => ({ ...item })),
      })),
    });
    state.archived = state.archived.slice(0, 12);
    return true;
  }

  window.generateGroceries = function mealListOpenCourses() {
    return window.prepareCartGroceries();
  };

  /* meal-lists-v1:end */

  /* pilot-guest-v1:start */
  const GUEST_PILOT_MODE = true;
  localAuthLoad = () => ({ verified: true, profile: null, guest: true, localOnly: true });
  localAuthSave = () => {};
  authProfileHtml = () => '';
  openShareScreen = function guestPilotShare() {
    return false;
  };
  /* pilot-guest-v1:end */

  restoreAppState();
  const groceryStateMigrated = migrateLocalGroceryState();
  const mealListsMigrated = initializeMealLists();
  if (groceryStateMigrated || mealListsMigrated) persistAppState();
  ensureFullPanels();
  ensureLocalGroceryPanels();
  document.title = 'Mon Panier — Full App Functional V1';
  window.__MON_PANIER_FULL_APP_V1__ = { manifest: APP_MANIFEST, media: MEDIA, state, openDemoRoute, seedDemoCart, persistAppState, restoreAppState };

  const params = new URLSearchParams(location.search);
  if (params.get('demo') === '1') {
    localStorage.removeItem(APP_STATE_KEY);
    ensureDemoAuth();
  }
  render();
  const route = params.get('screen');
  if (route) setTimeout(() => openDemoRoute(route), 0);
  window.addEventListener('beforeunload', persistAppState);
})();

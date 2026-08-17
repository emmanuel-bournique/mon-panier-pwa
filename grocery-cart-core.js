/* Mon Panier — local grocery cart core.
   Browser + Node-compatible. No network, retailer catalog, SKU, or payment data. */
(function attachLocalGroceryCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MonPanierGroceryCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createLocalGroceryCore() {
  'use strict';

  const TABLESPOON_ML = 15;
  const TEASPOON_ML = 5;
  const MAX_MANUAL_GROCERY_LISTS = 10;

  function finiteNumber(value) {
    if (value == null || String(value).trim() === '') return null;
    const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function normalizedUnit(ingredient = {}) {
    const quantity = finiteNumber(ingredient.qty);
    const rawUnit = String(ingredient.unit || 'piece').trim().toLocaleLowerCase('fr');
    const unitAliases = {
      gramme: 'g',
      grammes: 'g',
      kilogramme: 'kg',
      kilogrammes: 'kg',
      millilitre: 'ml',
      millilitres: 'ml',
      centilitre: 'cl',
      centilitres: 'cl',
      litre: 'l',
      litres: 'l',
    };
    const unit = unitAliases[rawUnit] || rawUnit;
    if (unit === 'c_a_s') return { unit: 'ml', quantity: quantity == null ? null : quantity * TABLESPOON_ML };
    if (unit === 'c_a_c') return { unit: 'ml', quantity: quantity == null ? null : quantity * TEASPOON_ML };
    if (unit === 'kg') return { unit: 'g', quantity: quantity == null ? null : quantity * 1000 };
    if (unit === 'cl') return { unit: 'ml', quantity: quantity == null ? null : quantity * 10 };
    if (unit === 'dl') return { unit: 'ml', quantity: quantity == null ? null : quantity * 100 };
    if (unit === 'l') return { unit: 'ml', quantity: quantity == null ? null : quantity * 1000 };
    return { unit, quantity };
  }

  function normalizedPreparedRecipeCount(value) {
    const number = finiteNumber(value);
    return number == null ? null : Math.floor(number);
  }

  function normalizedName(value = '') {
    return String(value || '')
      .toLocaleLowerCase('fr')
      .replaceAll('œ', 'oe')
      .replaceAll('æ', 'ae')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function canonicalPurchaseIdentity(value = '') {
    const normalized = normalizedName(value)
      .replace(/[’']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (/^sucre semoule(?:\b| pour )/.test(normalized)) return { key: 'sucre-en-poudre', name: 'sucre en poudre' };
    if (/^beurre doux(?:\b| )/.test(normalized) || /^beurre pour\b/.test(normalized)) return { key: 'beurre-doux', name: 'beurre doux' };
    if (!/^(?:blanc|jaune)s? d oeuf/.test(normalized) && /^(?:gros )?oeufs?(?: entiers?)?(?: battus?)?(?: extra frais)?(?: pour .*)?$/.test(normalized)) return { key: 'oeuf', name: 'œuf' };
    const aliases = new Map([
      ['carottes', 'carotte'],
      ['oignons', 'oignon'],
      ['echalotes', 'échalote'],
      ['citrons', 'citron'],
      ['citrons jaunes', 'citron jaune'],
      ['tomates', 'tomate'],
    ]);
    const display = aliases.get(normalized) || String(value || '').trim().toLocaleLowerCase('fr');
    return { key: normalizedName(display).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'produit-a-verifier', name: display || 'Produit à vérifier' };
  }

  function purchaseProfile(unit, factors) {
    return Object.freeze({ unit, factors: Object.freeze(factors) });
  }

  function massProfile(gramsPerMl = 1, extraFactors = {}) {
    return purchaseProfile('g', { g: 1, ml: gramsPerMl, ...extraFactors });
  }

  function volumeProfile(gramsPerMl = 1) {
    return purchaseProfile('ml', { ml: 1, g: 1 / gramsPerMl });
  }

  function pieceProfile(gramsPerPiece) {
    return purchaseProfile('piece', { piece: 1, g: 1 / gramsPerPiece });
  }

  function countProfile(unit, gramsPerCount, extraFactors = {}) {
    return purchaseProfile(unit, { [unit]: 1, g: 1 / gramsPerCount, ...extraFactors });
  }

  function bunchProfile(gramsPerBunch = 20, branchesPerBunch = 8, leavesPerBunch = 20) {
    return purchaseProfile('botte', {
      botte: 1,
      g: 1 / gramsPerBunch,
      ml: 1 / (gramsPerBunch * 2),
      branche: 1 / branchesPerBunch,
      feuille: 1 / leavesPerBunch,
    });
  }

  const PRODUCT_PURCHASE_PROFILES = Object.freeze({
    oeuf: pieceProfile(55),
    ail: countProfile('gousse', 5),
    'farine-de-ble': massProfile(0.55),
    'oignon-jaune': pieceProfile(150),
    'sucre-en-poudre': massProfile(0.85, { pincee: 0.5 }),
    carotte: pieceProfile(100),
    'persil-plat': bunchProfile(20),
    tomate: pieceProfile(125),
    citron: pieceProfile(100),
    oignon: pieceProfile(100),
    courgette: pieceProfile(250),
    'creme-fraiche': massProfile(1),
    echalote: pieceProfile(25),
    'jaunes-d-oeufs': pieceProfile(20),
    'basilic-frais': bunchProfile(20),
    'sucre-glace': massProfile(0.55),
    'creme-liquide-entiere': volumeProfile(1),
    concombre: pieceProfile(300),
    'coriandre-fraiche': bunchProfile(20),
    'poivron-rouge': pieceProfile(160),
    poireau: pieceProfile(200),
    'gros-sel': massProfile(1.2),
    'jambon-blanc': countProfile('tranche', 40),
    'menthe-fraiche': bunchProfile(20),
    'extrait-de-vanille': volumeProfile(1),
    'gousse-de-vanille': purchaseProfile('gousse', { gousse: 1, piece: 1 }),
    'aneth-frais': bunchProfile(20),
    'levure-chimique': massProfile(0.8),
    miel: massProfile(1.4),
    cheddar: countProfile('tranche', 25),
    aubergine: pieceProfile(300),
    'jaune-d-oeuf': pieceProfile(20),
    'pain-de-mie': countProfile('tranche', 25),
    'pate-brisee': pieceProfile(250),
    sucre: massProfile(0.85, { pincee: 0.5 }),
    cerfeuil: bunchProfile(16),
    'chou-fleur': pieceProfile(800),
    mayonnaise: massProfile(1),
    'poivre-noir-en-grains': massProfile(0.55),
    'blancs-d-oeufs': pieceProfile(30),
    brocoli: pieceProfile(500),
    'cacao-en-poudre-non-sucre': massProfile(0.45),
    'cerfeuil-frais': bunchProfile(40),
    'ciboulette-fraiche': bunchProfile(20),
    cresson: bunchProfile(40),
    'pain-de-campagne': countProfile('tranche', 50),
    'pate-feuilletee': pieceProfile(250),
    tahini: massProfile(1.1),
    capre: massProfile(0.65),
    cornichon: purchaseProfile('g', { g: 1, piece: 12 }),
    'creme-entiere-epaisse': massProfile(1),
    estragon: bunchProfile(8),
    'fecule-de-mais': massProfile(0.55),
    fenouil: pieceProfile(250),
    fraises: purchaseProfile('g', { g: 1, piece: 12 }),
    'oignon-nouveau': purchaseProfile('botte', { botte: 1, g: 1 / 100, piece: 1 / 6 }),
    'anchois-a-l-huile': purchaseProfile('piece', { piece: 1, ml: 1 / 4 }),
    bacon: countProfile('tranche', 15),
    'banane-mure': pieceProfile(160),
    'blanc-d-oeuf': pieceProfile(30),
    'celeri-branche': countProfile('branche', 20),
    ciboulette: bunchProfile(8),
    endive: pieceProfile(125),
    'feuille-de-lasagne-de-ble': countProfile('feuille', 20),
    'filets-d-anchois-a-l-huile': pieceProfile(5),
    'graines-de-sesame-noir': massProfile(0.65),
    moutarde: massProfile(1.05),
    oranges: pieceProfile(200),
    'oranges-non-traitees': pieceProfile(200),
    'origan-frais': bunchProfile(20),
  });

  function fallbackPurchaseProfile(rawParts = []) {
    const units = [...new Set(rawParts.map((rawPart) => normalizedUnit({
      qty: rawPart.q ?? rawPart.quantity,
      unit: rawPart.unit,
    }).unit))];
    if (units.length <= 1) return null;

    if (units.includes('g')) {
      const factors = {
        g: 1,
        ml: 1,
        piece: 100,
        botte: 20,
        branche: 2.5,
        tranche: 30,
        gousse: 5,
        boite: 400,
        feuille: 1,
        pincee: 0.5,
      };
      units.forEach(unit => { if (!Number.isFinite(factors[unit])) factors[unit] = 1; });
      return purchaseProfile('g', factors);
    }

    if (units.includes('ml')) {
      const factors = {
        ml: 1,
        piece: 100,
        botte: 40,
        branche: 5,
        tranche: 30,
        gousse: 5,
        boite: 400,
        feuille: 2,
        pincee: 1,
      };
      units.forEach(unit => { if (!Number.isFinite(factors[unit])) factors[unit] = 1; });
      return purchaseProfile('ml', factors);
    }

    const preferred = ['piece', 'botte', 'tranche', 'gousse', 'boite', 'branche', 'feuille', 'pincee'];
    const unit = preferred.find(candidate => units.includes(candidate)) || units[0];
    return purchaseProfile(unit, Object.fromEntries(units.map(current => [current, 1])));
  }

  function canonicalizeGroceryQuantity(item = {}) {
    const key = String(item.key || '').replace(/^product\|/, '') || canonicalPurchaseIdentity(item.name).key;
    const rawParts = Array.isArray(item.quantityParts) && item.quantityParts.length
      ? item.quantityParts
      : [{ unit: item.unit, q: item.q, missingQty: item.missingQty }];
    const profile = PRODUCT_PURCHASE_PROFILES[key] || fallbackPurchaseProfile(rawParts);
    if (!profile) return item;

    let quantity = 0;
    let missingQty = Boolean(item.missingQty);
    for (const rawPart of rawParts) {
      const part = normalizedUnit({ qty: rawPart.q ?? rawPart.quantity, unit: rawPart.unit });
      const factor = profile.factors[part.unit];
      if (part.quantity == null || rawPart.missingQty || !Number.isFinite(factor)) {
        missingQty = true;
        continue;
      }
      quantity += part.quantity * factor;
    }
    quantity = Math.round(quantity * 1000) / 1000;
    return {
      ...item,
      q: quantity,
      unit: profile.unit,
      quantityParts: [{ unit: profile.unit, q: quantity, missingQty }],
      missingQty,
      needsReview: Boolean(item.needsReview || missingQty),
      reviewReason: item.reviewReason || (missingQty ? 'quantity_missing' : ''),
    };
  }

  function pantryStapleLabel(name = '') {
    const normalized = normalizedName(name)
      .replace(/[’']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (/^sel(?: fin| de table)?$/.test(normalized)) return 'sel';
    if (/^poivre(?: noir| blanc)?(?: moulu)?$/.test(normalized)) return 'poivre';
    if (/^huile de cuisson$/.test(normalized)) return 'huile de cuisson';
    if (/^huile d olive(?: pour (?:la )?cuisson)?$/.test(normalized)) return 'huile de cuisson';
    if (/^huile (?:de |d )?friture$|^huile pour (?:la )?friture$/.test(normalized)) return 'huile de friture';
    if (/^huile(?: de | d )?(?:tournesol|colza|arachide|pepins de raisin|vegetale|neutre)?$/.test(normalized)) return 'huile de cuisson';
    return '';
  }

  function legacyPantryReminderIdentity(name = '') {
    return pantryStapleLabel(name) || canonicalPurchaseIdentity(name).key;
  }

  function separatePantryStaples(items = [], pantryReminders = []) {
    const migrated = [...(items || [])];
    const occupiedKeys = new Set(migrated.map(item => String(item?.key || item?.id || '').trim()).filter(Boolean));
    const knownIdentities = new Set(migrated.map(item => legacyPantryReminderIdentity(item?.name)).filter(Boolean));

    (pantryReminders || []).forEach((rawReminder, index) => {
      const name = String(rawReminder || '').trim();
      const identity = legacyPantryReminderIdentity(name);
      if (!name || !identity || knownIdentities.has(identity)) return;
      const baseKey = `legacy-pantry|${identity.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `item-${index + 1}`}`;
      let key = baseKey;
      let suffix = 2;
      while (occupiedKeys.has(key)) {
        key = `${baseKey}-${suffix}`;
        suffix += 1;
      }
      migrated.push({
        key,
        id: key,
        aisle: 'À classer',
        name,
        q: 0,
        unit: 'piece',
        missingQty: true,
        needsReview: true,
        reviewReason: 'quantity_missing',
        origins: [],
        localProduct: true,
        productType: 'local_generic',
        source: 'legacy_pantry',
      });
      occupiedKeys.add(key);
      knownIdentities.add(identity);
    });

    return { items: migrated, pantryReminders: [] };
  }

  function reviewReason(name, quantity) {
    if (quantity == null) return 'quantity_missing';
    return '';
  }

  function ingredientKey(ingredient = {}) {
    const explicit = String(ingredient.id || '').trim();
    if (explicit && !explicit.startsWith('version-ing-') && !explicit.startsWith('personal-ing-')) return explicit;
    return String(ingredient.name || '')
      .toLocaleLowerCase('fr')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'ingredient-a-verifier';
  }

  function mergeLocalGroceryItems(items = []) {
    const grouped = new Map();
    const keyAliases = new Map();

    const addQuantityPart = (target, rawPart = {}) => {
      const normalized = normalizedUnit({
        qty: rawPart.q ?? rawPart.quantity,
        unit: rawPart.unit,
      });
      let part = target.quantityParts.find(entry => entry.unit === normalized.unit);
      if (!part) {
        part = { unit: normalized.unit, q: 0, missingQty: false };
        target.quantityParts.push(part);
      }
      if (normalized.quantity == null || rawPart.missingQty) {
        part.missingQty = true;
        target.missingQty = true;
      } else {
        part.q += normalized.quantity;
      }
    };

    for (const raw of items || []) {
      if (!raw) continue;
      const oldKey = String(raw.key || raw.id || '').trim();
      const source = String(raw.source || 'recipe').trim() || 'recipe';
      const shouldCanonicalize = source !== 'manual' && source !== 'user_replaced' && source !== 'legacy_pantry';
      const identity = shouldCanonicalize ? canonicalPurchaseIdentity(raw.name) : null;
      const key = identity ? `product|${identity.key}` : oldKey;
      if (!key) continue;
      if (oldKey) keyAliases.set(oldKey, key);

      let target = grouped.get(key);
      if (!target) {
        const { retailer: _retailer, sku: _sku, ...safeItem } = raw;
        target = {
          ...safeItem,
          key,
          id: identity ? key : safeItem.id || key,
          name: identity?.name || String(safeItem.name || 'Produit à vérifier').trim() || 'Produit à vérifier',
          q: 0,
          unit: 'piece',
          quantityParts: [],
          missingQty: false,
          needsReview: false,
          reviewReason: '',
          origins: [],
          localProduct: true,
          productType: 'local_generic',
          source,
        };
        grouped.set(key, target);
      }

      const rawParts = Array.isArray(raw.quantityParts) && raw.quantityParts.length
        ? raw.quantityParts
        : [{ q: raw.q, unit: raw.unit, missingQty: raw.missingQty }];
      rawParts.forEach(part => addQuantityPart(target, part));
      target.missingQty ||= Boolean(raw.missingQty);
      target.needsReview ||= Boolean(raw.needsReview || raw.missingQty);
      if (!target.reviewReason && raw.reviewReason) target.reviewReason = raw.reviewReason;
      for (const origin of Array.isArray(raw.origins) ? raw.origins : []) {
        if (origin && !target.origins.includes(origin)) target.origins.push(origin);
      }
    }

    const merged = [...grouped.values()].map(item => {
      if (item.quantityParts.length === 1) {
        item.unit = item.quantityParts[0].unit;
        item.q = item.quantityParts[0].q;
      } else {
        item.unit = 'mixed';
        item.q = 0;
      }
      if (item.missingQty) {
        item.needsReview = true;
        item.reviewReason ||= 'quantity_missing';
      }
      return canonicalizeGroceryQuantity(item);
    });

    return { items: merged, keyAliases };
  }

  function buildLocalGroceryPlan(selections = []) {
    const grouped = new Map();

    for (const selection of selections) {
      const recipeId = String(selection?.recipeId || '').trim();
      const baseServings = finiteNumber(selection?.baseServings) || 1;
      const servings = finiteNumber(selection?.servings) || baseServings;
      const scale = servings / baseServings;

      for (const ingredient of selection?.ingredients || []) {
        // Courses reflects every named recipe ingredient. Pantry status is not an exclusion rule.
        if (!String(ingredient?.name || '').trim()) continue;

        const normalized = normalizedUnit(ingredient);
        const identity = canonicalPurchaseIdentity(ingredient.name);
        const key = `product|${identity.key}`;
        const reason = reviewReason(ingredient.name, normalized.quantity);
        let item = grouped.get(key);

        if (!item) {
          item = {
            key,
            aisle: ingredient.aisle || 'À classer',
            name: identity.name,
            q: 0,
            unit: normalized.unit,
            quantityParts: [],
            missingQty: normalized.quantity == null,
            needsReview: Boolean(reason),
            reviewReason: reason || '',
            origins: [],
            localProduct: true,
            productType: 'local_generic',
            source: 'recipe',
          };
          grouped.set(key, item);
        }

        let part = item.quantityParts.find(entry => entry.unit === normalized.unit);
        if (!part) {
          part = { unit: normalized.unit, q: 0, missingQty: false };
          item.quantityParts.push(part);
        }
        if (normalized.quantity != null) part.q += normalized.quantity * scale;
        else part.missingQty = true;
        if (normalized.quantity == null) item.missingQty = true;
        if (reason && !item.reviewReason) item.reviewReason = reason;
        item.needsReview ||= Boolean(reason);
        if (recipeId && !item.origins.includes(recipeId)) item.origins.push(recipeId);
        if (item.quantityParts.length === 1) {
          item.unit = part.unit;
          item.q = part.q;
        } else {
          item.unit = 'mixed';
          item.q = 0;
        }
      }
    }

    return {
      items: [...grouped.values()].map(canonicalizeGroceryQuantity).sort((left, right) =>
        left.aisle.localeCompare(right.aisle, 'fr') || left.name.localeCompare(right.name, 'fr'),
      ),
      pantryReminders: [],
    };
  }

  function buildLocalGroceryItems(selections = []) {
    return buildLocalGroceryPlan(selections).items;
  }

  function removeRecipeFromLocalGroceryList({ items = [], checkedKeys = new Set(), recipeId = '', remainingSelections = [] } = {}) {
    const selectedRecipeId = String(recipeId || '').trim();
    const selections = (remainingSelections || []).filter(selection => String(selection?.recipeId || '').trim() !== selectedRecipeId);
    const preservedItems = (items || []).filter(item => ['manual', 'legacy_pantry'].includes(String(item?.source || '').trim()));
    const regenerated = buildLocalGroceryPlan(selections).items;
    const merged = mergeLocalGroceryItems([...regenerated, ...preservedItems]).items;
    const validKeys = new Set(merged.map(item => String(item?.key || item?.id || '')).filter(Boolean));
    const checked = new Set([...(checkedKeys || [])].map(String).filter(key => validKeys.has(key)));
    return {
      items: merged,
      checked,
      sourceRecipeIds: selections.map(selection => String(selection.recipeId || '').trim()).filter(Boolean),
      sourceRecipeSelections: selections.map(selection => ({
        recipeId: String(selection.recipeId || '').trim(),
        servings: selection.servings,
        baseServings: selection.baseServings,
        ingredients: Array.isArray(selection.ingredients) ? selection.ingredients.map(ingredient => ({ ...ingredient })) : [],
      })),
    };
  }

  function excludeAlreadyAvailableProducts(items = [], alreadyKeys = new Set()) {
    const selected = new Set([...(alreadyKeys || [])].map(String));
    const available = [];
    const remaining = [];
    for (const item of items || []) {
      const target = selected.has(String(item?.key || item?.id || '')) ? available : remaining;
      target.push({ ...item });
    }
    return { items: remaining, alreadyAvailable: available };
  }

  function replaceLocalGroceryItem(item = {}, changes = {}) {
    const { retailer: _retailer, sku: _sku, ...safeItem } = item;
    const nextName = String(changes.name ?? safeItem.name ?? '').trim() || safeItem.name || 'Produit à vérifier';
    const nextUnit = String(changes.unit ?? safeItem.unit ?? 'piece').trim() || 'piece';
    const nextQuantity = finiteNumber(changes.qty);
    const reason = reviewReason(nextName, nextQuantity);

    return {
      ...safeItem,
      name: nextName,
      q: nextQuantity ?? 0,
      unit: nextUnit,
      missingQty: nextQuantity == null,
      needsReview: Boolean(reason),
      reviewReason: reason,
      localProduct: true,
      productType: 'local_generic',
      source: 'user_replaced',
      replacedFrom: safeItem.replacedFrom || safeItem.name || '',
    };
  }

  function markLocalGroceryItemForReview(item = {}) {
    return {
      ...item,
      needsReview: true,
      reviewReason: 'user_marked',
      localProduct: true,
      productType: 'local_generic',
    };
  }

  function removeLocalGroceryItem(items = [], checkedKeys = new Set(), key = '') {
    const selectedKey = String(key);
    const checked = new Set(checkedKeys || []);
    checked.delete(selectedKey);
    return {
      items: (items || []).filter((item) => String(item?.key || item?.id || '') !== selectedKey),
      checked,
    };
  }

  function createManualLocalGroceryItem({ key = '', name = '', aisle = 'Ajoutés manuellement' } = {}) {
    const stableKey = String(key).trim() || `manual-${Date.now()}`;
    const localName = String(name).trim() || 'Produit à vérifier';
    return {
      key: stableKey,
      id: stableKey,
      aisle: String(aisle).trim() || 'Ajoutés manuellement',
      name: localName,
      q: 0,
      unit: 'piece',
      missingQty: true,
      needsReview: true,
      reviewReason: 'quantity_missing',
      origins: [],
      localProduct: true,
      productType: 'local_generic',
      source: 'manual',
    };
  }

  function formatLocalQuantity(item = {}) {
    if (item.needsReview || item.missingQty) return 'À vérifier';
    if (Array.isArray(item.quantityParts) && item.quantityParts.length > 1) {
      return item.quantityParts.map(part => formatLocalQuantity({ ...part, needsReview: false })).join(' + ');
    }
    const normalized = normalizedUnit({ qty: item.q, unit: item.unit });
    const quantity = normalized.quantity;
    if (quantity == null) return 'À vérifier';
    const unit = normalized.unit;
    const discreteLabels = {
      piece: ['pièce', 'pièces'],
      botte: ['botte', 'bottes'],
      branche: ['branche', 'branches'],
      tranche: ['tranche', 'tranches'],
      gousse: ['gousse', 'gousses'],
      boite: ['boîte', 'boîtes'],
      feuille: ['feuille', 'feuilles'],
      pincee: ['pincée', 'pincées'],
    };
    if (discreteLabels[unit]) {
      const count = Math.ceil(quantity);
      return `${count} ${discreteLabels[unit][count > 1 ? 1 : 0]}`;
    }
    if (unit === 'g' || unit === 'ml') {
      const rounded = Math.max(5, Math.ceil(quantity / 5) * 5);
      if (rounded >= 1000) {
        const largeUnit = unit === 'g' ? 'kg' : 'l';
        const largeQuantity = rounded / 1000;
        const displayedLarge = Number.isInteger(largeQuantity)
          ? String(largeQuantity)
          : String(Math.round(largeQuantity * 100) / 100).replace('.', ',');
        return `${displayedLarge} ${largeUnit}`;
      }
      return `${rounded} ${unit}`;
    }
    const displayed = Number.isInteger(quantity) ? String(quantity) : String(Math.round(quantity * 10) / 10).replace('.', ',');
    const labels = { c_a_s: 'c. à s.', c_a_c: 'c. à c.', pincee: 'pincée', branche: 'branche', botte: 'botte', tranche: 'tranche', gousse: 'gousse', boite: 'boîte', feuille: 'feuille' };
    return `${displayed} ${labels[unit] || unit}`;
  }

  function exportLocalGroceryList(items = [], pantryReminders = []) {
    const groups = new Map();
    for (const item of items || []) {
      if (!item || item.deleted) continue;
      const aisle = String(item.aisle || 'À classer').trim() || 'À classer';
      if (!groups.has(aisle)) groups.set(aisle, []);
      groups.get(aisle).push(item);
    }
    const reminderSection = [];
    if (!groups.size) return ['Courses Mon Panier', ...reminderSection, 'Aucun produit.'].join('\n\n');

    const sections = [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'fr'))
      .map(([aisle, group]) => {
        const rows = group
          .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'fr'))
          .map((item) => `- ${String(item.name || 'Produit à vérifier').trim() || 'Produit à vérifier'} — ${formatLocalQuantity(item)}`);
        return [aisle, ...rows].join('\n');
      });

    return ['Courses Mon Panier', ...reminderSection, ...sections].join('\n\n');
  }

  function selectionIdentity(selection = {}, fallbackIndex = 0) {
    const explicit = String(selection?.selectionId || '').trim();
    if (explicit) return explicit;
    const recipeId = String(selection?.recipeId || '').trim();
    return recipeId ? `${recipeId}--selection-${fallbackIndex + 1}` : '';
  }

  function normalizedRecipeSelection(selection = {}, fallbackIndex = 0) {
    const recipeId = String(selection?.recipeId || '').trim();
    if (!recipeId) return null;
    const baseServings = Math.max(1, finiteNumber(selection?.baseServings) || 1);
    const servings = Math.max(1, finiteNumber(selection?.servings) || baseServings);
    return {
      selectionId: selectionIdentity(selection, fallbackIndex),
      recipeId,
      servings,
      baseServings,
      ingredients: Array.isArray(selection?.ingredients)
        ? selection.ingredients.map(ingredient => ({ ...ingredient }))
        : [],
    };
  }

  function normalizedRecipeSelections(selections = []) {
    const bySelectionId = new Map();
    (selections || []).forEach((rawSelection, index) => {
      const selection = normalizedRecipeSelection(rawSelection, index);
      if (selection) bySelectionId.set(selection.selectionId, selection);
    });
    return [...bySelectionId.values()];
  }

  function recipeSelectionsForList(list = {}) {
    const explicit = Array.isArray(list.recipeSelections) && list.recipeSelections.length
      ? list.recipeSelections
      : list.sourceRecipeSelections;
    const selections = normalizedRecipeSelections(explicit || []);
    const knownRecipeIds = new Set(selections.map(selection => selection.recipeId));
    for (const rawId of Array.isArray(list.sourceRecipeIds) ? list.sourceRecipeIds : []) {
      const recipeId = String(rawId || '').trim();
      if (recipeId && !knownRecipeIds.has(recipeId)) {
        knownRecipeIds.add(recipeId);
        selections.push({ selectionId: `${recipeId}--selection-${selections.length + 1}`, recipeId, servings: 1, baseServings: 1, ingredients: [] });
      }
    }
    return selections;
  }

  function recipeIdsForSelections(selections = []) {
    return [...new Set((selections || []).map(selection => String(selection?.recipeId || '').trim()).filter(Boolean))];
  }

  function cloneGroceryItems(items = []) {
    return (items || []).map(item => ({
      ...item,
      quantityParts: Array.isArray(item?.quantityParts) ? item.quantityParts.map(part => ({ ...part })) : item?.quantityParts,
      origins: Array.isArray(item?.origins) ? [...item.origins] : item?.origins,
    }));
  }

  function normalizedGroceryList(list = {}, fallbackId = 'list-default') {
    const id = String(list.id || fallbackId).trim() || fallbackId;
    const recipeSelections = recipeSelectionsForList(list);
    const preparedRecipeSelections = normalizedRecipeSelections(list.preparedRecipeSelections);
    const rawPantryReminders = Array.isArray(list.pantryReminders) ? list.pantryReminders : [];
    const legacySelections = recipeSelections.length ? recipeSelections : preparedRecipeSelections;
    const canRestoreLegacyPantryItems = rawPantryReminders.length > 0
      && legacySelections.some(selection => Array.isArray(selection.ingredients) && selection.ingredients.length > 0);
    let items = cloneGroceryItems(list.items);
    let checked = [...new Set(Array.isArray(list.checked) ? list.checked.map(String).filter(Boolean) : [])];
    if (canRestoreLegacyPantryItems) {
      const generated = buildLocalGroceryPlan(legacySelections).items;
      const manualItems = items.filter(item => ['manual', 'user_replaced'].includes(String(item?.source || '')));
      const merged = mergeLocalGroceryItems([...generated, ...manualItems]);
      const validKeys = new Set(merged.items.map(item => item.key));
      checked = checked
        .map(key => merged.keyAliases.get(key) || key)
        .filter(key => validKeys.has(key));
      items = merged.items;
    }
    const rawKind = String(list.kind || 'manual').trim();
    const kind = rawKind === 'meal' ? 'meal' : rawKind === 'basket' ? 'basket' : 'manual';
    const migratedPantry = separatePantryStaples(items, rawPantryReminders);
    items = migratedPantry.items;
    return {
      id,
      name: String(list.name || 'Ma liste').trim() || 'Ma liste',
      kind,
      basketId: String(list.basketId || ''),
      sourceRecipeIds: recipeIdsForSelections(recipeSelections),
      // Count snapshot kept after preparation; it does not rebuild active recipes.
      preparedRecipeCount: normalizedPreparedRecipeCount(list.preparedRecipeCount),
      // Read-only snapshot used to render the recipes that generated a prepared list.
      // It is deliberately separate from active recipe selections.
      preparedRecipeSelections,
      // sourceRecipeSelections is retained only as a backward-compatible read path.
      sourceRecipeSelections: recipeSelections.map(selection => ({ ...selection, ingredients: selection.ingredients.map(ingredient => ({ ...ingredient })) })),
      recipeSelections: recipeSelections.map(selection => ({ ...selection, ingredients: selection.ingredients.map(ingredient => ({ ...ingredient })) })),
      items,
      pantryReminders: migratedPantry.pantryReminders,
      checked,
      history: Array.isArray(list.history) ? list.history.map(entry => ({ ...entry })) : [],
    };
  }

  function createGroceryListCollection({ lists = [], activeListId = '', legacyItems = [], legacyChecked = [], legacyPantryReminders = [] } = {}) {
    const normalizedLists = (lists || []).map((list, index) => normalizedGroceryList(list, `list-${index + 1}`));
    if (!normalizedLists.length) normalizedLists.push(normalizedGroceryList({
      id: 'list-default', name: 'Maison', kind: 'manual', items: legacyItems, checked: legacyChecked, pantryReminders: legacyPantryReminders,
    }));
    const active = normalizedLists.some(list => list.id === activeListId) ? activeListId : normalizedLists[0].id;
    return { activeListId: active, lists: normalizedLists };
  }

  function uniqueGroceryListId(lists = [], requestedId = 'list') {
    const used = new Set((lists || []).map(list => String(list?.id || '').trim()).filter(Boolean));
    const base = String(requestedId || 'list').trim() || 'list';
    if (!used.has(base)) return base;
    let suffix = 2;
    let candidate = `${base}-${suffix}`;
    while (used.has(candidate)) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }

  function createGroceryList(collection = {}, list = {}) {
    const current = createGroceryListCollection(collection);
    const requestedKind = String(list.kind || 'manual').trim();
    const manualCount = current.lists.filter(entry => entry.id !== 'list-default' && ['manual', 'meal'].includes(entry.kind)).length;
    if (requestedKind !== 'basket' && manualCount >= MAX_MANUAL_GROCERY_LISTS) return current;
    const requestedId = String(list.id || `list-${current.lists.length + 1}`).trim();
    const nextId = uniqueGroceryListId(current.lists, requestedId);
    const next = normalizedGroceryList({ ...list, id: nextId }, nextId);
    const permanentIndex = current.lists.findIndex(entry => entry.id === 'list-default' || entry.kind === 'basket' || entry.basketId);
    const permanent = permanentIndex >= 0 ? current.lists[permanentIndex] : null;
    const existingManualLists = permanentIndex >= 0
      ? current.lists.filter((_, index) => index !== permanentIndex)
      : current.lists;
    const lists = permanent
      ? [permanent, next, ...existingManualLists]
      : [next, ...existingManualLists];
    return { activeListId: next.id, lists };
  }

  function updateActiveGroceryList(collection = {}, changes = {}) {
    const current = createGroceryListCollection(collection);
    const active = current.lists.find(list => list.id === current.activeListId);
    const history = changes.historyEntry ? [...(active?.history || []), { ...changes.historyEntry }] : changes.history;
    return updateGroceryListById(current, current.activeListId, { ...changes, ...(history ? { history } : {}) });
  }

  function updateGroceryListById(collection = {}, listId = 'list-default', changes = {}) {
    const current = createGroceryListCollection(collection);
    const targetId = String(listId || 'list-default');
    const lists = current.lists.map(list => list.id === targetId
      ? normalizedGroceryList({ ...list, ...changes }, list.id)
      : list);
    return { activeListId: current.activeListId, lists };
  }

  function mealPersistentItems(items = []) {
    return cloneGroceryItems(items).filter(item => ['manual', 'legacy_pantry'].includes(String(item?.source || '').trim()));
  }

  function buildMealListCourses(list = {}) {
    const meal = normalizedGroceryList({ ...list, kind: 'meal' }, list.id || 'list-default');
    const recipeSelections = normalizedRecipeSelections(meal.recipeSelections);
    const groceryPlan = buildLocalGroceryPlan(recipeSelections);
    const merged = mergeLocalGroceryItems([...groceryPlan.items, ...mealPersistentItems(meal.items)]);
    const validKeys = new Set(merged.items.map(item => String(item?.key || item?.id || '')).filter(Boolean));
    const checked = [...new Set((meal.checked || []).map(String))].filter(key => validKeys.has(key));
    return normalizedGroceryList({
      ...meal,
      kind: 'meal',
      basketId: '',
      recipeSelections,
      sourceRecipeSelections: recipeSelections,
      sourceRecipeIds: recipeIdsForSelections(recipeSelections),
      // A new active selection supersedes the previous prepared snapshot.
      preparedRecipeSelections: recipeSelections.length ? [] : meal.preparedRecipeSelections,
      preparedRecipeCount: recipeSelections.length ? 0 : meal.preparedRecipeCount,
      items: merged.items,
      pantryReminders: groceryPlan.pantryReminders,
      checked,
    }, meal.id);
  }

  function rebuildMealListCourses(collection = {}, listId = '') {
    const current = createGroceryListCollection(collection);
    const targetId = String(listId || current.activeListId || '').trim();
    const currentList = current.lists.find(list => list.id === targetId);
    if (!currentList) return current;
    const rebuilt = buildMealListCourses(currentList);
    return updateGroceryListById(current, targetId, rebuilt);
  }

  function finalizeMealListPreparation(collection = {}, listId = '') {
    const current = createGroceryListCollection(collection);
    const targetId = String(listId || current.activeListId || '').trim();
    const currentList = current.lists.find(list => list.id === targetId);
    if (!currentList) return current;
    const rebuilt = buildMealListCourses(currentList);
    const preparedSelections = recipeSelectionsForList(rebuilt);
    const preparedRecipeCount = preparedSelections.length;
    return updateGroceryListById(current, targetId, {
      ...rebuilt,
      preparedRecipeCount,
      preparedRecipeSelections: preparedSelections,
      recipeSelections: [],
      sourceRecipeSelections: [],
      sourceRecipeIds: [],
    });
  }

  function nextSelectionId(existingSelections = [], selection = {}) {
    const recipeId = String(selection?.recipeId || '').trim();
    const used = new Set(existingSelections.map(item => String(item?.selectionId || '').trim()).filter(Boolean));
    let index = 1;
    let candidate = `${recipeId}--selection-${index}`;
    while (used.has(candidate)) {
      index += 1;
      candidate = `${recipeId}--selection-${index}`;
    }
    return candidate;
  }

  function addMealListRecipe(collection = {}, listId = '', selection = {}, options = {}) {
    const current = createGroceryListCollection(collection);
    const targetId = String(listId || current.activeListId || '').trim();
    const list = current.lists.find(entry => entry.id === targetId);
    const activeSelections = list ? recipeSelectionsForList(list) : [];
    const resumePrepared = options?.resumePrepared === true;
    const preparedSelections = resumePrepared && activeSelections.length === 0
      ? normalizedRecipeSelections(list?.preparedRecipeSelections)
      : [];
    const usePreparedSnapshot = resumePrepared && activeSelections.length === 0 && preparedSelections.length > 0;
    const existingSelections = usePreparedSnapshot ? preparedSelections : activeSelections;
    // A closed cycle still owns its prepared identities. A new active occurrence
    // must never reuse one of them, even when its caller carried the old ID.
    const knownSelections = normalizedRecipeSelections([
      ...activeSelections,
      ...normalizedRecipeSelections(list?.preparedRecipeSelections),
    ]);
    const requestedSelectionId = String(selection?.selectionId || '').trim();
    const canReusePreparedSelectionId = usePreparedSnapshot
      && existingSelections.some(item => item.selectionId === requestedSelectionId);
    const requestedSelectionIdIsTaken = requestedSelectionId
      && knownSelections.some(item => item.selectionId === requestedSelectionId);
    const selectionWithId = requestedSelectionId && (!requestedSelectionIdIsTaken || canReusePreparedSelectionId)
      ? selection
      : { ...selection, selectionId: nextSelectionId(knownSelections, selection) };
    const nextSelection = normalizedRecipeSelection(selectionWithId, existingSelections.length);
    if (!list || !nextSelection) return current;
    // A prepared list is a closed shopping cycle. The first new recipe opens a
    // fresh cycle, so no old checked product may make it appear already complete.
    const startsFreshCycle = !resumePrepared
      && activeSelections.length === 0
      && (
        normalizedRecipeSelections(list.preparedRecipeSelections).length > 0
        || Number(list.preparedRecipeCount) > 0
        || (list.items || []).some(item => item?.source === 'recipe')
      );
    const selections = normalizedRecipeSelections([...existingSelections, nextSelection]);
    if (usePreparedSnapshot) return rebuildPreparedMealListCourses(current, targetId, selections);
    const updated = updateGroceryListById(current, targetId, {
      ...list,
      checked: startsFreshCycle ? [] : list.checked,
      kind: 'meal',
      basketId: '',
      recipeSelections: selections,
      sourceRecipeSelections: selections,
      sourceRecipeIds: recipeIdsForSelections(selections),
    });
    return rebuildMealListCourses(updated, targetId);
  }

  function resolveSelectionId(selections = [], requested = '') {
    const value = String(requested || '').trim();
    if (!value) return '';
    if (selections.some(selection => selection.selectionId === value)) return value;
    const byRecipe = selections.filter(selection => selection.recipeId === value);
    return byRecipe.length === 1 ? byRecipe[0].selectionId : '';
  }

  function resumePreparedMealListRecipe(collection = {}, listId = '', identity = '') {
    const current = createGroceryListCollection(collection);
    const targetId = String(listId || current.activeListId || '').trim();
    const list = current.lists.find(entry => entry.id === targetId);
    if (!list) return current;
    const preparedSelections = normalizedRecipeSelections(list.preparedRecipeSelections);
    const value = String(identity || '').trim();
    const bySelectionId = preparedSelections.find(selection => selection.selectionId === value);
    const byRecipeId = preparedSelections.filter(selection => selection.recipeId === value);
    const selected = bySelectionId || (byRecipeId.length === 1 ? byRecipeId[0] : null);
    if (!selected) return current;
    return addMealListRecipe(current, targetId, selected, { resumePrepared: true });
  }

  function rebuildPreparedMealListCourses(collection = {}, listId = '', preparedSelections = []) {
    const current = createGroceryListCollection(collection);
    const targetId = String(listId || current.activeListId || '').trim();
    const list = current.lists.find(entry => entry.id === targetId);
    if (!list) return current;
    const selections = normalizedRecipeSelections(preparedSelections);
    // Rebuild once from the prepared snapshot, then keep the active source empty:
    // the snapshot remains the editable source for the prepared recipe rows.
    const activeCollection = updateGroceryListById(current, targetId, {
      ...list,
      kind: 'meal',
      basketId: '',
      recipeSelections: selections,
      sourceRecipeSelections: selections,
      sourceRecipeIds: recipeIdsForSelections(selections),
    });
    const rebuilt = rebuildMealListCourses(activeCollection, targetId);
    const rebuiltList = rebuilt.lists.find(entry => entry.id === targetId);
    if (!rebuiltList) return rebuilt;
    return updateGroceryListById(rebuilt, targetId, {
      ...rebuiltList,
      recipeSelections: [],
      sourceRecipeSelections: [],
      sourceRecipeIds: [],
      preparedRecipeSelections: selections,
      preparedRecipeCount: selections.length,
    });
  }

  function updateMealListRecipeServings(collection = {}, listId = '', selectionId = '', servings = 1) {
    const current = createGroceryListCollection(collection);
    const targetId = String(listId || current.activeListId || '').trim();
    const list = current.lists.find(entry => entry.id === targetId);
    if (!list) return current;
    const activeSelections = recipeSelectionsForList(list);
    const preparedSelections = activeSelections.length ? [] : normalizedRecipeSelections(list.preparedRecipeSelections);
    const usePreparedSnapshot = activeSelections.length === 0 && preparedSelections.length > 0;
    const selectionsBeforeUpdate = usePreparedSnapshot ? preparedSelections : activeSelections;
    const selectedSelectionId = resolveSelectionId(selectionsBeforeUpdate, selectionId);
    if (!selectedSelectionId) return current;
    let changed = false;
    const selections = selectionsBeforeUpdate.map(selection => {
      if (selection.selectionId !== selectedSelectionId) return selection;
      changed = true;
      return { ...selection, servings: Math.max(1, finiteNumber(servings) || selection.baseServings || 1) };
    });
    if (!changed) return current;
    if (usePreparedSnapshot) return rebuildPreparedMealListCourses(current, targetId, selections);
    const updated = updateGroceryListById(current, targetId, {
      ...list,
      kind: 'meal',
      basketId: '',
      recipeSelections: selections,
      sourceRecipeSelections: selections,
      sourceRecipeIds: recipeIdsForSelections(selections),
    });
    return rebuildMealListCourses(updated, targetId);
  }

  function removeMealListRecipe(collection = {}, listId = '', selectionId = '') {
    const current = createGroceryListCollection(collection);
    const targetId = String(listId || current.activeListId || '').trim();
    const list = current.lists.find(entry => entry.id === targetId);
    if (!list) return current;
    const activeSelections = recipeSelectionsForList(list);
    const preparedSelections = activeSelections.length ? [] : normalizedRecipeSelections(list.preparedRecipeSelections);
    const usePreparedSnapshot = activeSelections.length === 0 && preparedSelections.length > 0;
    const original = usePreparedSnapshot ? preparedSelections : activeSelections;
    const selectedSelectionId = resolveSelectionId(original, selectionId);
    if (!selectedSelectionId) return current;
    const selections = original.filter(selection => selection.selectionId !== selectedSelectionId);
    if (selections.length === original.length) return current;
    if (usePreparedSnapshot) return rebuildPreparedMealListCourses(current, targetId, selections);
    const updated = updateGroceryListById(current, targetId, {
      ...list,
      kind: 'meal',
      basketId: '',
      recipeSelections: selections,
      sourceRecipeSelections: selections,
      sourceRecipeIds: recipeIdsForSelections(selections),
    });
    return rebuildMealListCourses(updated, targetId);
  }

  function restoreMealListRecipeSelections(collection = {}, listId = '', selections = []) {
    const current = createGroceryListCollection(collection);
    const targetId = String(listId || current.activeListId || '').trim();
    const list = current.lists.find(entry => entry.id === targetId);
    const restoredSelections = normalizedRecipeSelections(selections);
    if (!list || !restoredSelections.length) return current;
    const updated = updateGroceryListById(current, targetId, {
      ...list,
      kind: 'meal',
      basketId: '',
      recipeSelections: restoredSelections,
      sourceRecipeSelections: restoredSelections,
      sourceRecipeIds: recipeIdsForSelections(restoredSelections),
      preparedRecipeSelections: [],
      preparedRecipeCount: 0,
      checked: [],
      pantryReminders: [],
    });
    return rebuildMealListCourses(updated, targetId);
  }

  function migrateLegacyMealListCollection(collection = {}, { legacyCartSelections = [] } = {}) {
    const current = createGroceryListCollection(collection);
    const legacySelections = normalizedRecipeSelections(legacyCartSelections);
    const oldDefault = current.lists.find(list => list.id === 'list-default')
      || current.lists.find(list => list.kind === 'basket' || list.basketId)
      || current.lists[0];
    const defaultId = String(oldDefault?.id || 'list-default');
    const convert = (list, isDefault) => {
      const selections = normalizedRecipeSelections([
        ...recipeSelectionsForList(list),
        ...(isDefault ? legacySelections : []),
      ]);
      return normalizedGroceryList({
        ...list,
        id: isDefault ? 'list-default' : list.id,
        name: isDefault ? 'Mon Panier' : list.name,
        kind: 'meal',
        basketId: '',
        recipeSelections: selections,
        sourceRecipeSelections: selections,
        sourceRecipeIds: recipeIdsForSelections(selections),
      }, isDefault ? 'list-default' : list.id);
    };
    const defaultList = convert(oldDefault || {}, true);
    const lists = [
      defaultList,
      ...current.lists
        .filter(list => list.id !== defaultId)
        .map(list => convert(list, false)),
    ];
    const activeListId = current.activeListId === defaultId ? 'list-default' : current.activeListId;
    const safeActiveListId = lists.some(list => list.id === activeListId) ? activeListId : 'list-default';
    const changed = JSON.stringify(current) !== JSON.stringify({ activeListId: safeActiveListId, lists });
    return { activeListId: safeActiveListId, lists, changed };
  }


  function ensurePermanentBasketList(collection = {}) {
    const current = createGroceryListCollection(collection);
    const automatic = current.lists.filter(list => list.kind === 'basket' || list.basketId);
    const permanent = current.lists.find(list => list.id === 'list-default') || automatic[0];
    const sourceRecipeIds = permanent?.sourceRecipeIds?.length ? permanent.sourceRecipeIds : [];
    const manual = current.lists.filter(list => list.id !== permanent?.id && list.kind !== 'basket' && !list.basketId);
    const defaultList = normalizedGroceryList({
      ...(permanent || {}),
      id: 'list-default',
      name: 'Courses du Panier',
      kind: 'basket',
      basketId: 'list-default',
      sourceRecipeIds,
    }, 'list-default');
    const lists = [defaultList, ...manual];
    const activeListId = lists.some(list => list.id === current.activeListId) ? current.activeListId : 'list-default';
    const changed = JSON.stringify(current) !== JSON.stringify({ activeListId, lists });
    return { activeListId, lists, changed };
  }

  function updatePermanentBasketList(collection = {}, changes = {}) {
    const normalized = ensurePermanentBasketList(collection);
    const updated = updateGroceryListById(normalized, 'list-default', {
      ...changes,
      id: 'list-default',
      name: 'Courses du Panier',
      kind: 'basket',
      basketId: 'list-default',
    });
    return { ...updated, changed: normalized.changed || JSON.stringify(normalized.lists) !== JSON.stringify(updated.lists) };
  }


  function switchGroceryList(collection = {}, listId = '') {
    const current = createGroceryListCollection(collection);
    return current.lists.some(list => list.id === String(listId)) ? { ...current, activeListId: String(listId) } : current;
  }

  return Object.freeze({
    canonicalPurchaseIdentity,
    MAX_MANUAL_GROCERY_LISTS,
    pantryStapleLabel,
    separatePantryStaples,
    mergeLocalGroceryItems,
    buildLocalGroceryPlan,
    buildLocalGroceryItems,
    removeRecipeFromLocalGroceryList,
    excludeAlreadyAvailableProducts,
    replaceLocalGroceryItem,
    markLocalGroceryItemForReview,
    removeLocalGroceryItem,
    createManualLocalGroceryItem,
    formatLocalQuantity,
    exportLocalGroceryList,
    createGroceryListCollection,
    createGroceryList,
    updateActiveGroceryList,
    updateGroceryListById,
    buildMealListCourses,
    rebuildMealListCourses,
    finalizeMealListPreparation,
    addMealListRecipe,
    resumePreparedMealListRecipe,
    updateMealListRecipeServings,
    removeMealListRecipe,
    restoreMealListRecipeSelections,
    migrateLegacyMealListCollection,
    ensurePermanentBasketList,
    updatePermanentBasketList,
    switchGroceryList,
  });
});

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app-v1.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'app-v1.css'), 'utf8');
const mediaSource = fs.readFileSync(path.join(root, 'media-v1.js'), 'utf8');
const media = JSON.parse(mediaSource.match(/window\.__MON_PANIER_MEDIA_V1__=(.*);\s*$/s)[1]);

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

function directMediaRecord(type, value) {
  const normalized = normalizeSearch(value);
  const assetId = media.alias[`${type}:${value}`]
    || media.alias[`${type}:${normalized}`]
    || media.names[`${type}:${normalized}`];
  return assetId ? media.assets[assetId] : null;
}

function evaluateFunction(name, context = {}) {
  const functionSource = extractFunction(appSource, name);
  return vm.runInNewContext(`(${functionSource})`, {
    MEDIA: media,
    normalizeSearch,
    mediaRecord: context.mediaRecord || directMediaRecord,
    equipmentMediaRecord: context.equipmentMediaRecord,
    escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character])),
  });
}

test('les libellés de matériel connus utilisent un média générique sûr', () => {
  const equipmentMediaRecord = evaluateFunction('equipmentMediaRecord');
  const cases = [
    ['moule rond de 20 cm', 'moule à gâteau'],
    ['2 saladiers', 'saladier'],
    ['batteur électrique', 'fouet électrique'],
  ];

  for (const [input, expectedName] of cases) {
    const record = equipmentMediaRecord(input);
    assert.ok(record, `le matériel « ${input} » doit avoir un repli média`);
    assert.equal(record.name, expectedName);
    const mediaPath = record.variants?.list?.path || record.variants?.detail?.path || '';
    assert.ok(mediaPath, `le repli de « ${input} » doit avoir un chemin média`);
    assert.ok(fs.existsSync(path.join(root, mediaPath)), `le média de « ${input} » doit exister`);
  }
});

test('un matériel sans correspondance ne rend pas une tuile image vide', () => {
  const equipmentMediaRecord = evaluateFunction('equipmentMediaRecord');
  const equipmentMediaTile = evaluateFunction('equipmentMediaTile', { equipmentMediaRecord });
  const tile = equipmentMediaTile('matériel sans correspondance sûre');

  assert.match(tile, /class="media-tile no-media"/);
  assert.match(tile, /matériel sans correspondance sûre/);
  assert.doesNotMatch(tile, /media-placeholder|<img\b/);
});

test('les tuiles sans média ont un repli texte compact explicite', () => {
  assert.match(cssSource, /\.media-tile\.no-media\{[^}]*min-height:72px/);
  assert.match(cssSource, /\.media-tile\.no-media\{[^}]*align-items:center/);
  assert.match(cssSource, /\.media-tile\.no-media \.media-tile-text\{[^}]*text-align:center/);
});

test('les actions de fiche ne restent pas fixes au-dessus des ingrédients pendant le défilement', () => {
  const startMarker = '/* recipe-detail-action-ribbon-v1:start */';
  const endMarker = '/* recipe-detail-action-ribbon-v1:end */';
  const start = cssSource.indexOf(startMarker);
  const end = cssSource.indexOf(endMarker, start);
  assert.notEqual(start, -1, 'le contrat des actions de fiche doit être présent');
  assert.notEqual(end, -1, 'le contrat des actions de fiche doit être borné');
  const rules = cssSource.slice(start, end + endMarker.length);

  assert.match(rules, /\.detail-hero-actions\{position:absolute;/);
  assert.doesNotMatch(rules, /\.detail-hero-actions\{position:fixed;/);
});

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const candidateRoot = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(candidateRoot, 'app-v1.js'), 'utf8');
const css = fs.readFileSync(path.join(candidateRoot, 'app-v1.css'), 'utf8');
const tarteImage = fs.readFileSync(
  path.join(candidateRoot, 'assets', 'media', 'recipe', 'detail-v3', 'recipe__r-v3-149-tarte-aux-pommes.png'),
);

function readPngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', 'la photo de référence doit être un PNG');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function defaultDetailScale() {
  const match = source.match(
    /const DEFAULT_DETAIL_FRAMING\s*=\s*Object\.freeze\(\{[^}]*scale:\s*([0-9.]+)[^}]*fit:\s*'cover'[^}]*\}\);/s,
  );
  assert.ok(match, 'le cadrage par défaut de la photo de détail doit rester déclaré');
  return Number(match[1]);
}

function verticalCoverCrop({ viewportWidth, viewportHeight, imageWidth, imageHeight, scale }) {
  const coverScale = Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight);
  return Math.max(0, (imageHeight * coverScale * scale) - viewportHeight);
}

test('la couverture de recette conserve la hauteur complète sur les formats iPhone portrait', () => {
  const { width: imageWidth, height: imageHeight } = readPngDimensions(tarteImage);
  const scale = defaultDetailScale();

  assert.equal(
    scale,
    1,
    'la couverture ne doit pas ajouter de zoom : il couperait inutilement le haut et le bas de la photo',
  );
  assert.match(css, /--detail-scale:\s*1\s*;/, 'la valeur CSS de secours doit aussi supprimer le zoom');
  assert.match(css, /object-fit:\s*var\(--detail-fit\)/, 'le rendu doit rester une couverture plein écran');

  for (const phone of [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone standard', width: 390, height: 844 },
    { name: 'iPhone grand format', width: 430, height: 932 },
  ]) {
    const crop = verticalCoverCrop({
      viewportWidth: phone.width,
      viewportHeight: phone.height,
      imageWidth,
      imageHeight,
      scale,
    });
    assert.ok(
      crop <= 0.01,
      `${phone.name} ne doit pas rogner verticalement la photo (${crop.toFixed(2)} px mesurés)`,
    );
  }
});

test('le correctif de cadrage photo reste dans une révision PWA active', () => {
  const index = fs.readFileSync(path.join(candidateRoot, 'index.html'), 'utf8');
  const serviceWorker = fs.readFileSync(path.join(candidateRoot, 'sw.js'), 'utf8');
  const photoRuntimeUrl = 'app-v1.js?v=20260822-discover-favorite-heart-v41';
  const photoStylesUrl = 'app-v1.css?v=20260822-discover-favorite-heart-v41';

  assert.match(index, new RegExp(photoRuntimeUrl.replace(/[.?]/g, '\\$&')), 'le navigateur doit demander le JavaScript corrigé');
  assert.match(index, new RegExp(photoStylesUrl.replace(/[.?]/g, '\\$&')), 'le navigateur doit demander la feuille de style corrigée');
  assert.doesNotMatch(serviceWorker, /mon-panier-runtime-v19-discover-favorite-heart-upper-left/, 'le worker doit abandonner le cache antérieur');
  assert.match(serviceWorker, /mon-panier-runtime-v41-discover-favorite-heart/, 'le worker doit déclarer le cache courant');
  assert.match(serviceWorker, new RegExp(`\\./${photoRuntimeUrl.replace(/[.?]/g, '\\$&')}`), 'le worker doit précacher le JavaScript corrigé');
  assert.match(serviceWorker, new RegExp(`\\./${photoStylesUrl.replace(/[.?]/g, '\\$&')}`), 'le worker doit précacher la feuille de style corrigée');
});

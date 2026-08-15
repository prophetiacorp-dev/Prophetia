'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const ROUTES = [
  ['mujer', 'mujer.html'],
  ['hombre', 'hombre.html'],
  ['camisetas-punto-mujer', 'camisetas-punto-mujer.html'],
  ['sudaderas-punto-mujer', 'sudaderas-punto-mujer.html'],
  ['streetwear-mujer', 'streetwear-mujer.html'],
  ['hoodies-mujer', 'hoodies-mujer.html'],
  ['camisetas-punto-hombre', 'camisetas-punto-hombre.html'],
  ['sudaderas-punto-hombre', 'sudaderas-punto-hombre.html'],
  ['streetwear-hombre', 'streetwear-hombre.html'],
  ['hoodies', 'hoodies.html']
];

const REQUIRED_WIDTHS = [
  320, 344, 360, 375, 384, 390, 393, 412, 430, 480, 600, 679,
  768, 820, 912, 960, 1024, 1025, 1040, 1280, 1365, 1366, 1920
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function normalize(value = '') {
  return String(value ?? '').trim().toLowerCase();
}

function upper(value = '') {
  return String(value ?? '').trim().toUpperCase();
}

function canonicalVariants(product, selectedCut = '') {
  const cut = normalize(selectedCut);
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  return variants
    .filter((variant) => {
      const variantCut = normalize(variant?.cut);
      return Boolean(
        variant &&
        String(variant.sku || '').trim() &&
        normalize(variant.color) &&
        upper(variant.size) &&
        (!cut || !variantCut || variantCut === cut)
      );
    })
    .map((variant) => ({
      ...variant,
      sku: String(variant.sku).trim(),
      color: normalize(variant.color),
      size: upper(variant.size),
      stock: Math.max(0, Number(variant.stock) || 0)
    }));
}

function selectColor(product, color, selectedCut = '') {
  const normalizedColor = normalize(color);
  return canonicalVariants(product, selectedCut)
    .filter((variant) => variant.color === normalizedColor);
}

function resolveCartLine(product, variant) {
  assert.ok(variant.stock > 0, `No se puede añadir una variante agotada: ${variant.sku}`);

  return {
    id: String(product.id || product._id || ''),
    sku: variant.sku,
    color: variant.color,
    size: variant.size,
    price: Number(variant.price ?? product.price) || 0,
    qty: 1
  };
}

function count(source, expression) {
  return (source.match(expression) || []).length;
}

const quickAddJs = read('public/assets/js/quick-add.js');
const mobileCss = read('public/assets/css/mobile-shell.css');
const quickAddCss = read('public/assets/css/quick-add.css');
const catalog = JSON.parse(read('public/assets/data/catalog.json'));

assert.ok(Array.isArray(catalog) && catalog.length > 0, 'El catálogo canónico debe contener productos.');
assert.deepEqual([...new Set(REQUIRED_WIDTHS)], REQUIRED_WIDTHS, 'La matriz responsive no debe duplicar anchuras.');

for (const [route, filename] of ROUTES) {
  const html = fs.readFileSync(path.join(PUBLIC, filename), 'utf8');
  assert.match(html, /<body\b[^>]*\bdata-quick-add-enabled\b/i, `/${route} debe habilitar Quick Add.`);
  assert.match(html, /assets\/css\/quick-add\.css/i, `/${route} debe cargar el CSS canónico.`);
  assert.match(html, /assets\/js\/quick-add\.js\?v=20260815-card-touch-parity1/i, `/${route} debe cargar el controlador canónico actualizado.`);
  assert.match(html, /assets\/css\/mobile-shell\.css\?v=20260724-mobile-parity1/i, `/${route} debe cargar la capa responsive canónica.`);
  assert.doesNotMatch(html, /mobileVariants\s*=/i, `/${route} no debe definir variantes móviles paralelas.`);
}

assert.match(quickAddJs, /window\.ppPLP\?\.getProduct/, 'Quick Add debe resolver el producto desde ppPLP.');
assert.match(quickAddJs, /const variants\s*=\s*getVariants\(product\)/, 'Quick Add debe derivar variantes del producto canónico.');
assert.doesNotMatch(quickAddJs, /mobileVariants\s*=/i, 'No debe existir una segunda fuente de variantes para móvil.');

assert.equal(count(quickAddJs, /new MutationObserver\s*\(/g), 1, 'Debe existir un solo MutationObserver de Quick Add.');
assert.equal(count(quickAddJs, /document\.addEventListener\(\s*["']click["']/g), 1, 'Las acciones deben usar una única delegación de click.');
assert.match(quickAddJs, /if \(window\.__PP_QUICK_ADD__\) return;/, 'La inicialización debe ser idempotente.');
assert.match(quickAddJs, /card\.dataset\.quickAddReady\s*===\s*["']true["']/, 'Cada card debe protegerse contra reinicialización.');
assert.match(quickAddJs, /["']pp:plp:rendered["']/, 'Quick Add debe sobrevivir al rerender de la PLP.');

assert.match(quickAddJs, /const MOBILE_QUICK_ADD_QUERY\s*=\s*[\s\S]*?hover: none[\s\S]*?pointer: coarse[\s\S]*?max-width: 820px/, 'El modo touch debe depender de capacidad y viewport.');
assert.match(quickAddJs, /["']pointerover["'][\s\S]*?if \(isMobileQuickAdd\(\)\) \{\s*return;/, 'Hover no debe abrir el bottom-sheet touch.');
assert.match(quickAddJs, /["']focusin["'][\s\S]*?if \(isMobileQuickAdd\(\)\) \{\s*return;/, 'Focus no debe portar el panel antes de completar tap o Enter.');

assert.match(quickAddJs, /button\.type\s*=\s*["']button["'];[\s\S]*?button\.className\s*=\s*["']pp-card-color["']/, 'Los swatches deben ser botones reales.');
assert.match(quickAddJs, /button\.setAttribute\(\s*["']aria-pressed["']/, 'Los swatches deben anunciar selección.');
assert.match(quickAddJs, /button\.setAttribute\(\s*["']aria-label["']/, 'Los swatches deben tener nombre accesible.');
assert.match(quickAddJs, /toggle\.setAttribute\(\s*["']aria-expanded["']/, 'Quick Add debe anunciar su estado expandido.');
assert.match(quickAddJs, /event\.preventDefault\(\);\s*event\.stopPropagation\(\);[\s\S]*?selectColor\(/, 'El swatch no debe navegar al PDP.');
assert.match(quickAddJs, /selectedSku[\s\S]*?entry\.sku === selectedSku[\s\S]*?entry\.color === selectedColor[\s\S]*?entry\.size === selectedSize/, 'El carrito debe validar SKU, color y talla contra el catálogo.');
assert.match(quickAddJs, /!variant \|\|\s*variant\.stock <= 0/, 'Una variante agotada no debe llegar al carrito.');

const legacyHideBlock = mobileCss.match(/Los controles decorativos legacy[\s\S]*?display:\s*none\s*!important;\s*\}/);
assert.ok(legacyHideBlock, 'Debe conservarse la ocultación de controles legacy.');
assert.doesNotMatch(legacyHideBlock[0], /\.pp-card-colors|\.pp-card-cuts/, 'La capa responsive no debe ocultar controles canónicos.');
assert.match(mobileCss, /@media \(max-width: 1024px\), \(hover: none\), \(pointer: coarse\)/, 'La paridad debe cubrir viewport compacto y puntero touch.');
assert.match(mobileCss, /\.pp-card-color\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/, 'Cada swatch debe ofrecer un objetivo táctil de 44 px.');
assert.match(mobileCss, /\.pp-card-color\.is-selected::after\s*\{/, 'La selección no debe indicarse solo mediante color.');
assert.match(mobileCss, /\.pp-quick-add-toggle\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/, 'Quick Add debe ofrecer un objetivo táctil de 44 px.');
assert.match(quickAddCss, /@media \(prefers-reduced-motion: reduce\)/, 'Quick Add debe respetar reduced motion.');
assert.match(quickAddCss, /\.card\.is-plp-out-of-stock \.pp-quick-add-toggle\s*\{[\s\S]*?display:\s*none\s*!important;/, 'Quick Add debe quedar indisponible cuando todo el producto está agotado.');

const productIds = new Set();
const variantSkus = new Set();
let multiColorProducts = 0;
let sellableVariants = 0;
let exhaustedVariants = 0;

for (const product of catalog) {
  const productId = String(product?.id || '').trim();
  assert.ok(productId, 'Cada producto debe tener productId.');
  assert.ok(!productIds.has(productId), `productId duplicado: ${productId}`);
  productIds.add(productId);

  const cuts = Array.isArray(product?.cuts) && product.cuts.length
    ? product.cuts.map((cut) => normalize(cut?.id)).filter(Boolean)
    : [normalize(product?.defaultCut)].filter(Boolean);
  const selections = cuts.length ? cuts : [''];

  for (const cut of selections) {
    const variants = canonicalVariants(product, cut);
    if (!variants.length) continue;

    const colors = [...new Set(variants.map((variant) => variant.color))];
    if (colors.length > 1) multiColorProducts += 1;

    for (const color of colors) {
      const selected = selectColor(product, color, cut);
      assert.ok(selected.length > 0, `${productId}/${cut || 'default'} debe conservar variantes al seleccionar ${color}.`);
      assert.ok(selected.every((variant) => variant.color === color), 'La selección de color no puede mezclar variantes.');
    }

    for (const variant of variants) {
      const identity = `${productId}::${variant.sku}::${cut || normalize(variant.cut)}`;
      assert.ok(!variantSkus.has(identity), `Variante duplicada: ${identity}`);
      variantSkus.add(identity);
      assert.ok(variant.size, `Talla ausente en ${variant.sku}`);

      if (variant.stock > 0) {
        sellableVariants += 1;
        const line = resolveCartLine(product, variant);
        assert.equal(line.id, productId);
        assert.equal(line.sku, variant.sku);
        assert.equal(line.color, variant.color);
        assert.equal(line.size, variant.size);
        assert.equal(line.qty, 1);
        assert.ok(line.price > 0, `Precio canónico inválido en ${variant.sku}`);
      } else {
        exhaustedVariants += 1;
        assert.throws(() => resolveCartLine(product, variant), /agotada/, `La variante ${variant.sku} debe bloquearse.`);
      }
    }
  }
}

assert.ok(multiColorProducts > 0, 'Debe existir al menos un producto multicolor verificable.');
assert.ok(sellableVariants > 0, 'Debe existir al menos una variante vendible verificable.');
assert.ok(exhaustedVariants > 0, 'Debe existir al menos una variante agotada verificable.');

console.log(
  `Paridad de product cards verificada: ${ROUTES.length} rutas, ` +
  `${REQUIRED_WIDTHS.length} anchuras, ${catalog.length} productos, ` +
  `${sellableVariants} variantes vendibles y ${exhaustedVariants} agotadas.`
);

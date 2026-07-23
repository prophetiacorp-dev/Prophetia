const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'public', 'assets', 'data', 'catalog.json');
const STOCK_PATH = path.join(ROOT, 'data', 'stock.json');
const CONFIG_PATH = path.join(ROOT, 'data', 'launch-stock.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toPublicAssetPath(value) {
  if (typeof value !== 'string' || !/^assets\//i.test(value)) return value;
  return `/${value}`;
}

function normalizePublicPaths(value) {
  if (Array.isArray(value)) return value.map(normalizePublicPaths);

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizePublicPaths(nested)])
    );
  }

  return toPublicAssetPath(value);
}

function main() {
  const config = readJson(CONFIG_PATH);
  const configuredStock = config?.variants || {};
  const catalogInput = readJson(CATALOG_PATH);

  if (!Array.isArray(catalogInput)) {
    throw new Error('catalog.json debe contener un array de productos.');
  }

  const knownSkus = new Set();
  const catalog = normalizePublicPaths(catalogInput).map((product) => {
    const variants = Array.isArray(product.variants)
      ? product.variants.map((variant) => {
          const sku = String(variant.sku || '').trim();
          if (!sku) throw new Error(`Variante sin SKU en ${product.id || 'producto desconocido'}.`);
          if (knownSkus.has(sku)) throw new Error(`SKU duplicado: ${sku}`);

          knownSkus.add(sku);
          const configured = configuredStock[sku];
          const stock = configured === undefined ? 0 : Number(configured);

          if (!Number.isInteger(stock) || stock < 0) {
            throw new Error(`Stock inválido para ${sku}: ${configured}`);
          }

          return { ...variant, stock };
        })
      : [];

    return {
      ...product,
      inStock: variants.some((variant) => variant.stock > 0),
      variants
    };
  });

  const unknownConfiguredSkus = Object.keys(configuredStock).filter(
    (sku) => !knownSkus.has(sku)
  );

  if (unknownConfiguredSkus.length) {
    throw new Error(`SKUs configurados que no existen: ${unknownConfiguredSkus.join(', ')}`);
  }

  const updatedAt = String(config.updatedAt || new Date().toISOString());
  const stockFile = {};

  for (const product of catalog) {
    for (const variant of product.variants || []) {
      stockFile[variant.sku] = {
        sku: variant.sku,
        productId: product.id || '',
        title: product.title || '',
        cut: variant.cut || '',
        color: variant.color || '',
        size: variant.size || '',
        stock: variant.stock,
        updatedAt
      };
    }
  }

  fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  fs.writeFileSync(STOCK_PATH, `${JSON.stringify(stockFile, null, 2)}\n`, 'utf8');

  const active = Object.values(stockFile).filter((variant) => variant.stock > 0);
  const total = active.reduce((sum, variant) => sum + variant.stock, 0);

  console.log(
    `[stock] ${config.dropId || 'drop'}: ${active.length} variantes activas, ${total} unidades.`
  );
}

main();

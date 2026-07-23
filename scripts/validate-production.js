const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const errors = [];
const allowLegalPlaceholder = process.argv.includes('--allow-legal-placeholder');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function publicReferenceExists(fromFile, reference) {
  const raw = String(reference || '').trim();
  if (!raw || /^(?:#|https?:|mailto:|tel:|javascript:|data:|blob:)/i.test(raw)) return true;

  const clean = decodeURIComponent(raw.split('#')[0].split('?')[0]);
  if (!clean) return true;

  const target = clean.startsWith('/')
    ? path.join(PUBLIC_DIR, clean.replace(/^\/+/, ''))
    : path.resolve(path.dirname(fromFile), clean);

  return (
    fs.existsSync(target) ||
    (!path.extname(target) && fs.existsSync(`${target}.html`)) ||
    (clean === '/' && fs.existsSync(path.join(PUBLIC_DIR, 'home.html')))
  );
}

const files = walk(PUBLIC_DIR);

for (const filePath of files) {
  const contents = fs.readFileSync(filePath, 'utf8');

  if (filePath.endsWith('.json')) {
    try {
      JSON.parse(contents);
    } catch (error) {
      errors.push(`${relative(filePath)}: JSON inválido (${error.message})`);
    }
  }

  if (filePath.endsWith('.js')) {
    try {
      new vm.SourceTextModule(contents, { identifier: filePath });
    } catch (error) {
      errors.push(`${relative(filePath)}: JavaScript inválido (${error.message})`);
    }
  }

  if (filePath.endsWith('.html')) {
    const hasGenericMarker = /NOMBRE-RUTA|example\.com|href=["']#["']/i.test(contents);
    const hasLegalMarker = /antes de la publicación definitiva|deberán incorporarse los datos identificativos/i.test(contents);

    if (hasGenericMarker || (hasLegalMarker && !allowLegalPlaceholder)) {
      errors.push(`${relative(filePath)}: contiene un marcador de producción pendiente.`);
    }

    const references = [
      ...contents.matchAll(/\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi)
    ].map((match) => match[1]);

    for (const reference of references) {
      if (!publicReferenceExists(filePath, reference)) {
        errors.push(`${relative(filePath)}: referencia inexistente ${reference}`);
      }
    }
  }
}

const catalogPath = path.join(PUBLIC_DIR, 'assets', 'data', 'catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const launchConfig = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'launch-stock.json'), 'utf8')
);
JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config', 'shipping-rates.json'), 'utf8')
);
const skus = new Set();
const activeStock = {};

for (const product of catalog) {
  for (const variant of product.variants || []) {
    if (!variant.sku) errors.push(`Producto ${product.id}: variante sin SKU.`);
    if (skus.has(variant.sku)) errors.push(`SKU duplicado: ${variant.sku}`);
    skus.add(variant.sku);

    if (!Number.isInteger(variant.stock) || variant.stock < 0) {
      errors.push(`Stock inválido: ${variant.sku}`);
    }

    if (variant.stock > 0) activeStock[variant.sku] = variant.stock;
  }
}

if (JSON.stringify(activeStock) !== JSON.stringify(launchConfig.variants || {})) {
  errors.push('El stock del catálogo no coincide con data/launch-stock.json.');
}

if (errors.length) {
  console.error(`Validación fallida (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    `Validación correcta: ${files.length} archivos públicos y ${skus.size} SKUs revisados.`
  );
}

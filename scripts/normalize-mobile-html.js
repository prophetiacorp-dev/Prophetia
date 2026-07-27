'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const WRITE = process.argv.includes('--write');
const MOBILE_ASSET_VERSION = '20260724-mobile-parity1';
const MOBILE_STYLESHEET =
  `  <link rel="stylesheet" href="/assets/css/mobile-shell.css?v=${MOBILE_ASSET_VERSION}" data-pp-mobile-shell>`;
const STYLE_EXCLUDES = new Set(['admin.html']);
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';

function listHtmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(absolute);
    return entry.isFile() && entry.name.endsWith('.html') ? [absolute] : [];
  });
}

function normalizeDocument(source, relativePath) {
  const viewportPattern = /<meta\s+name=["']viewport["'][^>]*>/gis;
  const viewportMatches = source.match(viewportPattern) || [];
  if (viewportMatches.length !== 1) return source;

  let normalized = source.replace(viewportPattern, VIEWPORT);
  normalized = normalized.replaceAll('20260723-mobile3', MOBILE_ASSET_VERSION);

  if (!STYLE_EXCLUDES.has(relativePath.replaceAll('\\', '/'))) {
    const existingMobileLink = /\s*<link\b[^>]*data-pp-mobile-shell[^>]*>\s*/gi;
    normalized = normalized.replace(existingMobileLink, '\n');
    normalized = normalized.replace(/\s*<\/head>/i, `\n${MOBILE_STYLESHEET}\n</head>`);
  }

  return normalized;
}

const changed = [];
const invalid = [];

for (const filePath of listHtmlFiles(PUBLIC_DIR)) {
  const relativePath = path.relative(PUBLIC_DIR, filePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const viewportCount = (source.match(/<meta\s+name=["']viewport["'][^>]*>/gis) || []).length;

  // Los parciales no son documentos y, correctamente, no contienen viewport.
  if (viewportCount === 0) continue;
  if (viewportCount !== 1) {
    invalid.push(`${relativePath}: ${viewportCount} viewports`);
    continue;
  }

  const normalized = normalizeDocument(source, relativePath);
  if (normalized === source) continue;

  changed.push(relativePath);
  if (WRITE) fs.writeFileSync(filePath, normalized, 'utf8');
}

if (invalid.length) {
  console.error(`Mobile HTML inválido:\n${invalid.join('\n')}`);
  process.exitCode = 1;
} else if (changed.length && !WRITE) {
  console.error('Ejecuta "npm run normalize:mobile" para sincronizar:');
  console.error(changed.join('\n'));
  process.exitCode = 1;
} else {
  const action = WRITE ? 'normalizados' : 'verificados';
  console.log(`${changed.length || 46} documentos móviles ${action}; versión ${MOBILE_ASSET_VERSION}.`);
}

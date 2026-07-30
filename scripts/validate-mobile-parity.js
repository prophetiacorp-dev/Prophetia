'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const VERSION = '20260724-mobile-parity1';
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';
const MOBILE_LINK = `/assets/css/mobile-shell.css?v=${VERSION}`;
const MOBILE_BREAKPOINT = 820;
const PLP_BREAKPOINT = 1024;
const STYLE_EXCLUDES = new Set(['admin.html']);
const DOCK_EXCLUDES = new Set(['checkout.html']);
const EXPECTED_DOCUMENTS = 47;
const VIEWPORT_MATRIX = [
  [320, 568, 'mobile', 2],
  [360, 800, 'mobile', 2],
  [375, 667, 'mobile', 2],
  [390, 844, 'mobile', 2],
  [412, 915, 'mobile', 2],
  [430, 932, 'mobile', 2],
  [600, 960, 'tablet', 2],
  [679, 900, 'tablet', 2],
  [768, 1024, 'tablet', 2],
  [820, 1180, 'tablet', 2],
  [912, 1368, 'tablet', 2],
  [960, 1280, 'tablet', 2],
  [1024, 1366, 'tablet', 2],
  [1366, 768, 'desktop', null],
  [1920, 1080, 'desktop', null]
];
const REQUIRED_VIEWPORT_SIGNATURE = '320x568,360x800,375x667,390x844,412x915,430x932,600x960,679x900,768x1024,820x1180,912x1368,960x1280,1024x1366,1366x768,1920x1080';

const INTERMEDIATE_WIDTHS = [344, 384, 414, 480, 540, 640, 720, 834, 900, 1000, 1040, 1180, 1280, 1440, 1600];
const REQUIRED_INTERMEDIATE_SIGNATURE = '344,384,414,480,540,640,720,834,900,1000,1040,1180,1280,1440,1600';

const PLP_ROUTES = [
  'camisetas-punto-mujer.html',
  'camisetas-punto-hombre.html',
  'sudaderas-punto-mujer.html',
  'sudaderas-punto-hombre.html',
  'streetwear-mujer.html',
  'streetwear-hombre.html',
  'hoodies-mujer.html',
  'hoodies.html'
];

const failures = [];
const pass = (condition, message) => {
  if (!condition) failures.push(message);
};

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function listHtmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(absolute);
    return entry.isFile() && entry.name.endsWith('.html') ? [absolute] : [];
  });
}

function cleanRoute(value) {
  return value.split('#')[0].split('?')[0].replace(/^\//, '');
}

function routeTargetExists(route) {
  const clean = cleanRoute(route);
  if (!clean) return fs.existsSync(path.join(PUBLIC_DIR, 'home.html'));
  const direct = path.join(PUBLIC_DIR, clean);
  return fs.existsSync(direct) || fs.existsSync(`${direct}.html`);
}

const documents = [];
for (const filePath of listHtmlFiles(PUBLIC_DIR)) {
  const source = fs.readFileSync(filePath, 'utf8');
  const viewportMatches = source.match(/<meta\s+name=["']viewport["'][^>]*>/gis) || [];
  if (!viewportMatches.length) continue;

  const relativePath = path.relative(PUBLIC_DIR, filePath).replaceAll('\\', '/');
  documents.push(relativePath);
  pass(viewportMatches[0]?.includes('viewport-fit=cover'),
    `${relativePath}: el viewport debe respetar las safe areas`);
  pass(viewportMatches.length === 1, `${relativePath}: debe tener un único viewport`);
  pass(viewportMatches[0] === VIEWPORT, `${relativePath}: viewport no canónico`);
  pass(!source.includes('20260723-mobile3'), `${relativePath}: conserva la versión de caché anterior`);

  const links = Array.from(source.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gis));
  const mobileLinks = links.filter((match) => match[0].includes('data-pp-mobile-shell'));
  if (STYLE_EXCLUDES.has(relativePath)) {
    pass(mobileLinks.length === 0, `${relativePath}: el panel de administración no debe cargar la shell móvil`);
    continue;
  }

  pass(mobileLinks.length === 1, `${relativePath}: debe cargar mobile-shell.css exactamente una vez`);
  if (mobileLinks[0]) {
    pass(mobileLinks[0][0].includes(`href="${MOBILE_LINK}"`), `${relativePath}: versión móvil incorrecta`);
    pass(mobileLinks[0].index === links.at(-1)?.index, `${relativePath}: mobile-shell.css debe ser la última hoja`);
    pass(mobileLinks[0].index < source.search(/<\/head>/i), `${relativePath}: hoja móvil fuera de <head>`);
  }
}

pass(documents.length === EXPECTED_DOCUMENTS,
  `se esperaban ${EXPECTED_DOCUMENTS} documentos con viewport y hay ${documents.length}`);

for (const relativePath of PLP_ROUTES) {
  const source = read(`public/${relativePath}`);
  const media = source.indexOf('pp-hero__media');
  const breadcrumb = source.indexOf('pp-breadcrumb--hero');
  const side = source.indexOf('pp-hero__side');
  const filters = source.indexOf('pp-filters container');
  const grid = source.search(/class=["'][^"']*plp-grid/);
  pass(media >= 0 && media < breadcrumb,
    `${relativePath}: el logo/media debe preceder al breadcrumb en el DOM`);
  pass(breadcrumb >= 0 && breadcrumb < side,
    `${relativePath}: el breadcrumb debe preceder al título/lista en el DOM`);
  pass(side >= 0 && side < filters,
    `${relativePath}: el hero debe preceder a la barra de filtros`);
  pass(filters >= 0 && filters < grid,
    `${relativePath}: la barra de filtros debe preceder al grid`);
}

for (const relativePath of ['mujer.html', 'hombre.html']) {
  const source = read(`public/${relativePath}`);
  const media = source.indexOf('hero-left');
  const breadcrumb = source.indexOf('pp-breadcrumb--gender');
  const side = source.search(/(?:women|men)-band__side/);
  const toolbar = source.search(/(?:women|men)-toolbar/);
  const grid = source.search(/class=["'][^"']*plp-grid/);
  pass(media >= 0 && media < breadcrumb && breadcrumb < side,
    `${relativePath}: orden DOM responsive logo → breadcrumb → título/lista incorrecto`);
  pass(side >= 0 && side < toolbar && toolbar < grid,
    `${relativePath}: orden DOM responsive hero → filtros → grid incorrecto`);
}

const header = read('public/assets/partials/header.html');
const dockMatch = header.match(/<nav class="pp-mobile-dock"[\s\S]*?<\/nav>/i);
const panelMatch = header.match(/<aside id="ppMobileMenuPanel"[\s\S]*?<\/aside>/i);
const dock = dockMatch?.[0] || '';
const panel = panelMatch?.[0] || '';
for (const marker of [
  'data-pp-mobile-menu',
  'data-pp-mobile-search',
  'data-pp-mobile-account',
  'data-pp-mobile-cart',
  'data-pp-mobile-cart-count',
  'aria-controls="ppMobileMenuPanel"',
  'aria-expanded="false"'
]) {
  pass(dock.includes(marker), `dock movil: falta el contrato ${marker}`);
}

pass(panel.includes('aria-hidden="true"'), 'el panel movil debe fallar cerrado con aria-hidden');
for (const marker of [
  'data-pp-mobile-close',
  'id="ppMobileSearchInput"',
  'role="tablist"',
  'role="tab"',
  'role="tabpanel"',
  'aria-selected="true"',
  'aria-controls="ppMobileSectionWomen"',
  'aria-labelledby="ppMobileTabWomen"'
]) {
  pass(panel.includes(marker), `panel movil: falta el contrato ${marker}`);
}
pass(Boolean(dockMatch?.[0].includes(' hidden')), 'el dock móvil debe fallar cerrado con hidden');
pass(Boolean(panelMatch?.[0].includes('role="dialog"')), 'el panel móvil debe exponerse como diálogo');
pass(Boolean(panelMatch?.[0].includes('aria-modal="true"')), 'el panel móvil debe ser modal para lectores de pantalla');

const expectedMobileTabs = ['women', 'men', 'collections', 'house', 'originals'];

const mobileTabButtons = Array.from(
  panel.matchAll(/<button\b[^>]*>/gis),
  (match) => match[0]
).filter((button) => /\brole\s*=\s*["']tab["']/i.test(button));

const tabs = mobileTabButtons
  .map((button) => button.match(/\bdata-pp-mobile-tab\s*=\s*["']([^"']+)["']/i)?.[1])
  .filter(Boolean);

const mobileTabSections = Array.from(
  panel.matchAll(/<section\b[^>]*>/gis),
  (match) => match[0]
).filter((section) => /\brole\s*=\s*["']tabpanel["']/i.test(section));

const sections = mobileTabSections
  .map((section) => section.match(/\bdata-pp-mobile-section\s*=\s*["']([^"']+)["']/i)?.[1])
  .filter(Boolean);

for (const tab of expectedMobileTabs) {
  pass(tabs.filter((value) => value === tab).length === 1,
    `pestaña móvil ${tab}: debe existir exactamente una vez`);
}

pass(tabs.length === expectedMobileTabs.length,
  'el menú móvil debe tener exactamente cinco pestañas principales');
pass(tabs.every((tab) => expectedMobileTabs.includes(tab)),
  'el menú móvil contiene una pestaña principal no aprobada');
pass(new Set(tabs).size === tabs.length,
  'el menú móvil contiene pestañas principales duplicadas');
pass(JSON.stringify(tabs) === JSON.stringify(expectedMobileTabs),
  'orden de pestañas móviles incorrecto');
pass(!tabs.includes('tribe'),
  'Tribe no debe ser una pestaña principal móvil');

pass(JSON.stringify(sections) === JSON.stringify(expectedMobileTabs),
  'orden o secciones de pestañas móviles incorrectos');
pass(new Set(sections).size === sections.length,
  'el menú móvil contiene secciones de pestañas duplicadas');
pass(JSON.stringify(sections) === JSON.stringify(tabs),
  'cada pestaña móvil debe tener su sección equivalente');

const mobileRoutes = Array.from(panel.matchAll(/href="(\/[^"]+)"/g), (match) => match[1]);
for (const route of new Set(mobileRoutes)) {
  pass(routeTargetExists(route), `ruta móvil sin documento de destino: ${route}`);
}
pass(fs.existsSync(path.join(PUBLIC_DIR, 'assets/img/logo/emblem.svg')), 'falta el emblema del dock móvil');

for (const relativePath of DOCK_EXCLUDES) {
  const source = read(`public/${relativePath}`);
  pass(/<body\b[^>]*\bclass=["'][^"']*\bcheckout-page\b/i.test(source),
    `${relativePath}: debe conservar el contrato de pagina de checkout`);
  pass(source.includes('class="lw-header-checkoutnc"'),
    `${relativePath}: debe conservar su cabecera de checkout dedicada`);
  pass(!source.includes('class="pp-mobile-dock"'),
    `${relativePath}: no debe incorporar el dock movil global`);
  pass(!source.includes('id="ppMobileMenuPanel"'),
    `${relativePath}: no debe incorporar el panel movil global`);
}

const init = read('public/assets/js/header-init.js');
for (const marker of [
  `window.matchMedia('(max-width: ${MOBILE_BREAKPOINT}px)')`,
  "document.querySelector('link[data-pp-mobile-shell]')",
  'Boolean(mobileStyles?.sheet)',
  "dock.dataset.ppMobileBound === 'true'",
  "dock.dataset.ppMobileBound = 'true'",
  'dock.hidden = !active',
  "document.body.classList.toggle('pp-mobile-dock-active', active)",
  'if (!active) closePanel({ restoreFocus: false })',
  "panel.setAttribute('aria-hidden', 'true')",
  "panel.setAttribute('aria-hidden', 'false')",
  "source === 'menu' ? 'true' : 'false'",
  "source === 'search' ? 'true' : 'false'",
  'returnFocus.focus({ preventScroll: true })',
  "event.key === 'Escape'",
  "event.key !== 'Tab'",
  'mobileQuery.addEventListener',
  "window.addEventListener('pp:cart-updated'"
]) {
  pass(init.includes(marker), `header-init.js: falta el control móvil ${marker}`);
}

const css = read('public/assets/css/mobile-shell.css');
const mobileMedia = `@media (max-width: ${MOBILE_BREAKPOINT}px)`;
const firstMobileMedia = css.indexOf(mobileMedia);
pass(firstMobileMedia > 0, 'mobile-shell.css: falta el límite principal de 820px');
const desktopPrefix = css.slice(0, firstMobileMedia).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
pass(desktopPrefix === '.pp-mobile-dock, .pp-mobile-panel { display: none; }',
  'mobile-shell.css: hay estilos visuales de escritorio fuera del bloque móvil');
for (const marker of [
  'env(safe-area-inset-top)',
  'env(safe-area-inset-bottom)',
  '100dvh',
  'object-fit: contain !important',
  'scroll-snap-type: x mandatory',
  '@media (prefers-reduced-motion: reduce)',
  'transition-duration: .01ms',
  'animation-duration: .01ms',
  'animation-iteration-count: 1'
]) {
  pass(css.includes(marker), `mobile-shell.css: falta la regla ${marker}`);
}
for (const marker of [
  `@media (max-width: ${PLP_BREAKPOINT}px)`,
  '--pp-sort-popover-top',
  'position: fixed !important',
  'transform: translateX(100%) !important',
  'grid-template-columns: repeat(2, minmax(0, 1fr)) !important',
  'min-width: 44px !important',
  '.pp-breadcrumb--gender',
  'width: max-content',
  'margin-inline: auto',
  'inset: auto 8px 8px auto !important',
  '.pp-btn:not(.pp-sort-trigger)::after'
]) {
  pass(css.includes(marker), `mobile-shell.css: falta el contrato PLP/tablet ${marker}`);
}
pass((css.match(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important/g) || []).length === 1,
  'mobile-shell.css: la cuadrícula PLP debe tener una única fuente responsive de dos columnas');
for (const marker of [
  'body:is(.men-page, .women-page):is(',
  '.pp-collection-page,',
  '.camisetas-page,',
  '.sud-men-page,',
  '.sud-women-page,',
  '.hoodies-page,',
  '.streetwear-page'
]) {
  pass(css.includes(marker), `mobile-shell.css: falta cobertura común PLP ${marker}`);
}

const authCss = read('public/assets/css/auth.css');
for (const marker of [
  '@media (max-width: 1024px)',
  '#ppAccountPanel',
  'max-width: none',
  'max-height: 100dvh',
  'env(safe-area-inset-right)',
  'body:has(:is(#ppAuthModal[open], #ppAccountPanel[open]))'
]) {
  pass(authCss.includes(marker), `auth.css: falta el contrato fullscreen ${marker}`);
}
pass(init.includes('element !== document.body'),
  'header-init.js: el retorno de foco Auth no debe aceptar body');
pass((css.match(/{/g) || []).length === (css.match(/}/g) || []).length,
  'mobile-shell.css: llaves CSS descompensadas');

const viewportKeys = new Set();
pass(VIEWPORT_MATRIX.map(([width, height]) => `${width}x${height}`).join(',') === REQUIRED_VIEWPORT_SIGNATURE,
  'la matriz principal no coincide exactamente con las quince resoluciones requeridas');
for (const [width, height, expectedMode, expectedColumns] of VIEWPORT_MATRIX) {
  const key = `${width}x${height}`;
  pass(!viewportKeys.has(key), `${key}: viewport duplicado en la matriz`);
  viewportKeys.add(key);

  const actualMode = width < 600
    ? 'mobile'
    : width <= PLP_BREAKPOINT
      ? 'tablet'
      : 'desktop';
  const actualColumns = width <= PLP_BREAKPOINT ? 2 : null;
  pass(actualMode === expectedMode, `${key}: modo esperado ${expectedMode}, obtenido ${actualMode}`);
  pass(actualColumns === expectedColumns,
    `${key}: columnas esperadas ${expectedColumns ?? 'desktop'}, obtenidas ${actualColumns ?? 'desktop'}`);
}

pass(INTERMEDIATE_WIDTHS.join(',') === REQUIRED_INTERMEDIATE_SIGNATURE,
  'el barrido intermedio no coincide con las quince anchuras de cruce configuradas');
const intermediateKeys = new Set();
for (const width of INTERMEDIATE_WIDTHS) {
  pass(!intermediateKeys.has(width), `${width}px: anchura intermedia duplicada`);
  intermediateKeys.add(width);
  pass(width >= 320 && width <= 1600,
    `${width}px: anchura intermedia fuera del rango responsive`);
  const expectedColumns = width <= PLP_BREAKPOINT ? 2 : null;
  pass(width <= PLP_BREAKPOINT ? expectedColumns === 2 : expectedColumns === null,
    `${width}px: contrato de columnas incorrecto en el barrido intermedio`);
}
pass(VIEWPORT_MATRIX.length + INTERMEDIATE_WIDTHS.length === 30,
  'la validación responsive debe cubrir 30 tamaños por ruta PLP');

const server = read('server.js');
pass(server.includes("'no-cache, must-revalidate'"), 'server.js: HTML/partials deben revalidarse');
pass(server.includes("'no-store'"), 'server.js: JSON mutable no debe almacenarse en caché');
pass(server.includes("'public, max-age=0, must-revalidate'"), 'server.js: CSS/JS deben revalidarse');

if (failures.length) {
  console.error(`Validación móvil fallida (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Paridad móvil verificada: ${documents.length} documentos, ${new Set(mobileRoutes).size} rutas, ` +
    `${VIEWPORT_MATRIX.length} resoluciones obligatorias y ${INTERMEDIATE_WIDTHS.length} anchuras intermedias.`
  );
}

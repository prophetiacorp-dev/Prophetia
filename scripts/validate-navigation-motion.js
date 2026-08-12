'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PUBLIC_HTML_ROUTES } = require('../config/public-routes');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const HEADER_PATH = path.join(PUBLIC_DIR, 'assets', 'partials', 'header.html');
const INIT_PATH = path.join(PUBLIC_DIR, 'assets', 'js', 'header-init.js');
const CSS_PATH = path.join(PUBLIC_DIR, 'assets', 'css', 'mobile-shell.css');
const SERVER_PATH = path.join(ROOT, 'server.js');

const HOUSE_LINKS = [
  ['/about', 'Prophetia House Essence'],
  ['/studio', 'Studio'],
  ['/musica', 'Música'],
  ['/events', 'Eventos']
];

const HOUSE_ACCOUNT_ROUTES = [
  '/my-services',
  '/account',
  '/pedidos',
  '/wishlist',
  '/addresses'
];

const ACCOUNT_SECTION_ROUTES = [
  ...HOUSE_ACCOUNT_ROUTES,
  '/my-content',
  '/reservas',
  '/drop-calendar',
  '/vault',
  '/prophet-private'
];

const MOBILE_TABS = [
  ['women', 'ppMobileTabWomen', 'ppMobileSectionWomen'],
  ['men', 'ppMobileTabMen', 'ppMobileSectionMen'],
  ['collections', 'ppMobileTabCollections', 'ppMobileSectionCollections'],
  ['house', 'ppMobileTabHouse', 'ppMobileSectionHouse'],
  ['originals', 'ppMobileTabOriginals', 'ppMobileSectionOriginals']
];

const MOBILE_LEVELS = [
  ['women-ready', 'ppMobileLevelWomenReady'],
  ['men-ready', 'ppMobileLevelMenReady']
];

const MOTION_TOKENS = new Map([
  ['--pp-motion-instant', '120ms'],
  ['--pp-motion-fast', '180ms'],
  ['--pp-motion-base', '260ms'],
  ['--pp-motion-slow', '340ms'],
  ['--pp-ease-standard', 'cubic-bezier(.22,.61,.36,1)'],
  ['--pp-ease-enter', 'cubic-bezier(.16,1,.3,1)'],
  ['--pp-ease-exit', 'cubic-bezier(.4,0,1,1)'],
  ['--pp-mobile-level-duration', '280ms']
]);

const MOTION_STATE_CLASSES = [
  'is-opening',
  'is-open',
  'is-closing',
  'is-tab-entering',
  'is-tab-leaving',
  'is-level-transitioning'
];

const failures = [];
let checks = 0;

function pass(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAttribute(openingTag, name) {
  const expression = new RegExp(
    `\\b${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i'
  );
  const match = openingTag.match(expression);
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

function hasAttribute(openingTag, name) {
  return new RegExp(`\\b${escapeRegExp(name)}(?:\\s*=|(?=\\s|/?>))`, 'i').test(openingTag);
}

function extractBalancedElement(source, start, tagName) {
  const tokenPattern = new RegExp(`<\\/?${escapeRegExp(tagName)}\\b[^>]*>`, 'gi');
  tokenPattern.lastIndex = start;
  let depth = 0;
  let openingEnd = -1;
  let match;

  while ((match = tokenPattern.exec(source))) {
    const closing = /^<\//.test(match[0]);
    const selfClosing = /\/>$/.test(match[0]);

    if (!closing) {
      depth += 1;
      if (openingEnd < 0) openingEnd = tokenPattern.lastIndex;
      if (selfClosing) depth -= 1;
    } else {
      depth -= 1;
    }

    if (depth === 0 && openingEnd >= 0) {
      return {
        openingTag: source.slice(start, openingEnd),
        inner: source.slice(openingEnd, match.index),
        source: source.slice(start, tokenPattern.lastIndex),
        start,
        end: tokenPattern.lastIndex,
        tagName
      };
    }
  }

  return null;
}

function findElement(source, predicate, expectedTag = null) {
  const openingPattern = /<([a-z][\w:-]*)\b[^>]*>/gi;
  let match;

  while ((match = openingPattern.exec(source))) {
    const tagName = match[1].toLowerCase();
    if (expectedTag && tagName !== expectedTag.toLowerCase()) continue;
    if (!predicate(match[0], tagName)) continue;
    return extractBalancedElement(source, match.index, tagName);
  }

  return null;
}

function findElementById(source, id) {
  return findElement(source, (openingTag) => getAttribute(openingTag, 'id') === id);
}

function findMarkedElement(source, tagName, attribute) {
  return findElement(
    source,
    (openingTag) => hasAttribute(openingTag, attribute),
    tagName
  );
}

function decodeHtml(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"'
  };

  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity);
}

function normalizeLabel(value) {
  return decodeHtml(String(value).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeRoute(value) {
  try {
    const pathname = new URL(String(value), 'http://127.0.0.1').pathname;
    return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  } catch {
    return '';
  }
}

function extractLinks(source) {
  return Array.from(source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi), (match) => ({
    route: normalizeRoute(getAttribute(match[1], 'href') || ''),
    label: normalizeLabel(match[2])
  })).filter((link) => link.route.startsWith('/'));
}

function sameLinks(actual, expected) {
  return JSON.stringify(actual.map(({ route, label }) => [route, label])) === JSON.stringify(expected);
}

function stripHtmlComments(value) {
  return String(value).replace(/<!--[\s\S]*?-->/g, '').trim();
}

function findMatchingBrace(source, openingIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function extractNamedFunction(source, name) {
  const signature = new RegExp(`\\bfunction\\s+${escapeRegExp(name)}\\s*\\(`).exec(source);
  if (!signature) return '';
  const openingBrace = source.indexOf('{', signature.index);
  if (openingBrace < 0) return '';
  const closingBrace = findMatchingBrace(source, openingBrace);
  return closingBrace < 0 ? '' : source.slice(signature.index, closingBrace + 1);
}

function compilePureFunction(functionSource, name) {
  if (!functionSource) return null;
  try {
    return new vm.Script(`(${functionSource})`, { filename: `${name}.validator.js` })
      .runInNewContext(Object.create(null), { timeout: 100 });
  } catch (error) {
    failures.push(`${name}: no se pudo evaluar de forma aislada (${error.message})`);
    return null;
  }
}

function normalizeCssValue(value) {
  return String(value).toLowerCase().replace(/\s+/g, '');
}

function collectCustomProperties(source) {
  return new Map(Array.from(
    source.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g),
    (match) => [match[1], normalizeCssValue(match[2])]
  ));
}

function routeTargetExists(route) {
  const normalized = normalizeRoute(route);
  if (normalized === '/') return fs.existsSync(path.join(PUBLIC_DIR, 'home.html'));

  const routedFile = PUBLIC_HTML_ROUTES[normalized];
  if (routedFile) return fs.existsSync(path.join(PUBLIC_DIR, routedFile));

  const clean = normalized.replace(/^\/+/, '');
  if (!clean || clean.includes('..')) return false;

  const direct = path.resolve(PUBLIC_DIR, ...clean.split('/'));
  const publicPrefix = `${path.resolve(PUBLIC_DIR)}${path.sep}`;
  if (direct !== path.resolve(PUBLIC_DIR) && !direct.startsWith(publicPrefix)) return false;

  return [direct, `${direct}.html`, path.join(direct, 'index.html')]
    .some((candidate) => fs.existsSync(candidate));
}

function cssStateIsMenuScoped(source, className) {
  const selectorPattern = new RegExp(`([^{}]*\\.${escapeRegExp(className)}\\b[^{}]*)\\{`, 'g');
  return Array.from(source.matchAll(selectorPattern), (match) => match[1]).some((selector) =>
    /\.pp-mobile-(?:panel|menu)/.test(selector)
  );
}

const header = read(HEADER_PATH);
const init = read(INIT_PATH);
const css = read(CSS_PATH);
const server = read(SERVER_PATH);

// IDs y estructura base del partial.
const ids = Array.from(header.matchAll(/\bid\s*=\s*(?:"([^"]+)"|'([^']+)')/gi), (match) => match[1] ?? match[2]);
const duplicateIds = Array.from(new Set(ids.filter((id, index) => ids.indexOf(id) !== index)));
pass(duplicateIds.length === 0,
  `header.html: IDs duplicados (${duplicateIds.join(', ') || 'desconocidos'})`);

const mobilePanel = findElementById(header, 'ppMobileMenuPanel');
pass(Boolean(mobilePanel), 'header.html: falta #ppMobileMenuPanel');

// House mantiene una sola fuente editorial y un target móvil vacío.
const desktopHouse = findElementById(header, 'panel-house');
const mobileHouse = findElementById(header, 'ppMobileSectionHouse');
pass(Boolean(desktopHouse), 'header.html: falta #panel-house');
pass(Boolean(mobileHouse), 'header.html: falta #ppMobileSectionHouse');

const houseSource = desktopHouse
  ? findMarkedElement(desktopHouse.source, 'ul', 'data-pp-house-source')
  : null;
const houseTarget = mobileHouse
  ? findMarkedElement(mobileHouse.source, 'ul', 'data-pp-house-target')
  : null;

pass(Boolean(houseSource),
  'House: #panel-house debe contener <ul class="mega-col" data-pp-house-source>');
pass(getAttribute(houseSource?.openingTag || '', 'class')?.split(/\s+/).includes('mega-col') === true,
  'House: data-pp-house-source debe conservar la clase mega-col');
pass(Boolean(houseTarget),
  'House: #ppMobileSectionHouse debe contener <ul class="pp-mobile-menu__links" data-pp-house-target>');
pass(getAttribute(houseTarget?.openingTag || '', 'class')?.split(/\s+/).includes('pp-mobile-menu__links') === true,
  'House: data-pp-house-target debe conservar la clase pp-mobile-menu__links');

const sourceLinks = extractLinks(houseSource?.inner || '');
pass(sameLinks(sourceLinks, HOUSE_LINKS),
  `House fuente: rutas/labels deben ser exactamente ${JSON.stringify(HOUSE_LINKS)}`);
pass(stripHtmlComments(houseTarget?.inner || '') === '',
  'House móvil: data-pp-house-target debe quedar vacío; JS lo sincroniza desde la fuente');

const mobileHouseLinks = extractLinks(mobileHouse?.source || '');
for (const route of HOUSE_ACCOUNT_ROUTES) {
  pass(!mobileHouseLinks.some((link) => link.route === route),
    `House móvil: no debe contener la ruta de cuenta ${route}`);
}
pass(!/\bEsence\b/i.test(header),
  'House: "Esence" debe corregirse a "Essence"');
pass(sourceLinks.some(({ route, label }) => route === '/about' && label === 'Prophetia House Essence'),
  'House: /about debe usar el label exacto "Prophetia House Essence"');

// La sincronización debe ser explícita, clonada y anterior al marcado current.
const houseSyncSource = extractNamedFunction(init, 'syncMobileHouseNavigation');
pass(Boolean(houseSyncSource), 'header-init.js: falta syncMobileHouseNavigation');
for (const marker of [
  '#panel-house',
  '[data-pp-house-source]',
  '#ppMobileSectionHouse',
  '[data-pp-house-target]',
  'cloneNode(true)',
  'replaceChildren'
]) {
  pass(houseSyncSource.includes(marker),
    `syncMobileHouseNavigation: falta el marker ${marker}`);
}

const dockSource = extractNamedFunction(init, 'initMobileDock');
pass(Boolean(dockSource), 'header-init.js: falta initMobileDock');
const syncCallIndex = dockSource.indexOf('syncMobileHouseNavigation(');
const currentLoopIndex = dockSource.indexOf("panel.querySelectorAll('a[href]')");
pass(syncCallIndex >= 0,
  'initMobileDock: debe invocar syncMobileHouseNavigation');
pass(syncCallIndex >= 0 && currentLoopIndex >= 0 && syncCallIndex < currentLoopIndex,
  'initMobileDock: House debe sincronizarse antes de calcular aria-current');

// Enrutado exacto y separación semántica entre House y cuenta.
const sectionForPathSource = extractNamedFunction(init, 'sectionForPath');
const sectionForPath = compilePureFunction(sectionForPathSource, 'sectionForPath');
pass(Boolean(sectionForPath), 'header-init.js: falta una sectionForPath evaluable');
if (sectionForPath) {
  for (const [route] of HOUSE_LINKS) {
    pass(sectionForPath(route) === 'house',
      `sectionForPath: ${route} debe mapear exactamente a house`);
  }
  for (const route of ACCOUNT_SECTION_ROUTES) {
    pass(sectionForPath(route) !== 'house',
      `sectionForPath: la ruta de cuenta ${route} no puede mapear a house`);
  }
}

const ariaCurrentIndex = dockSource.indexOf("setAttribute('aria-current', 'page')");
const currentContext = ariaCurrentIndex >= 0
  ? dockSource.slice(Math.max(0, ariaCurrentIndex - 320), ariaCurrentIndex + 120)
  : '';
pass(/href\s*===\s*currentPath/.test(currentContext),
  'aria-current: el enlace activo debe compararse mediante href === currentPath');
pass(!/startsWith\s*\(\s*(?:href|currentPath)/.test(currentContext) &&
    !/includes\s*\(\s*(?:href|currentPath)/.test(currentContext),
  'aria-current: no se permiten coincidencias parciales por startsWith/includes');

// Tabs, paneles y niveles: contratos ARIA uno-a-uno.
const panelSource = mobilePanel?.source || '';
const tabTags = Array.from(panelSource.matchAll(/<button\b[^>]*\brole\s*=\s*["']tab["'][^>]*>/gi),
  (match) => match[0]);
const sectionTags = Array.from(panelSource.matchAll(/<section\b[^>]*\brole\s*=\s*["']tabpanel["'][^>]*>/gi),
  (match) => match[0]);
const actualTabs = tabTags.map((tag) => getAttribute(tag, 'data-pp-mobile-tab'));
const actualSections = sectionTags.map((tag) => getAttribute(tag, 'data-pp-mobile-section'));

pass(JSON.stringify(actualTabs) === JSON.stringify(MOBILE_TABS.map(([name]) => name)),
  'menú móvil: orden/identidad de las cinco tabs incorrecto');
pass(JSON.stringify(actualSections) === JSON.stringify(MOBILE_TABS.map(([name]) => name)),
  'menú móvil: orden/identidad de los cinco tabpanels incorrecto');

for (const [name, tabId, sectionId] of MOBILE_TABS) {
  const tabTag = tabTags.find((tag) => getAttribute(tag, 'data-pp-mobile-tab') === name) || '';
  const sectionTag = sectionTags.find((tag) => getAttribute(tag, 'data-pp-mobile-section') === name) || '';
  pass(getAttribute(tabTag, 'id') === tabId && getAttribute(tabTag, 'aria-controls') === sectionId,
    `tab ${name}: id/aria-controls incorrectos`);
  pass(getAttribute(sectionTag, 'id') === sectionId && getAttribute(sectionTag, 'aria-labelledby') === tabId,
    `tabpanel ${name}: id/aria-labelledby incorrectos`);
}

pass(hasAttribute(panelSource, 'data-pp-mobile-back'),
  'menú móvil: falta el control data-pp-mobile-back');
pass((panelSource.match(/class=["'][^"']*\bpp-mobile-menu__views-track\b[^"']*["']/gi) || []).length === 2,
  'menú móvil: Mujer y Hombre deben tener exactamente dos tracks de nivel');
pass((panelSource.match(/data-pp-mobile-level=["']root["']/gi) || []).length === 2,
  'menú móvil: Mujer y Hombre deben tener exactamente dos niveles root');

for (const [levelName, levelId] of MOBILE_LEVELS) {
  const triggerTag = Array.from(panelSource.matchAll(/<button\b[^>]*>/gi), (match) => match[0])
    .find((tag) => getAttribute(tag, 'data-pp-mobile-level-trigger') === levelName) || '';
  const level = findElementById(panelSource, levelId);
  pass(Boolean(triggerTag), `nivel ${levelName}: falta trigger`);
  pass(getAttribute(triggerTag, 'aria-controls') === levelId &&
      getAttribute(triggerTag, 'aria-expanded') === 'false',
  `nivel ${levelName}: aria-controls/aria-expanded inicial incorrectos`);
  pass(Boolean(level) && getAttribute(level.openingTag, 'data-pp-mobile-level') === levelName,
    `nivel ${levelName}: falta target ${levelId}`);
  pass(Boolean(level) && getAttribute(level.openingTag, 'aria-hidden') === 'true' &&
      hasAttribute(level.openingTag, 'inert') && hasAttribute(level.openingTag, 'hidden'),
  `nivel ${levelName}: estado cerrado inicial debe ser aria-hidden + inert + hidden`);
}

// Tokens globales y uso efectivo de la capa de movimiento.
const firstMediaIndex = css.indexOf('@media');
const globalCss = firstMediaIndex >= 0 ? css.slice(0, firstMediaIndex) : css;
const globalRootRule = globalCss.match(/:root\s*\{([^}]*)\}/i)?.[1] || '';
const globalTokens = collectCustomProperties(globalRootRule);
pass(Boolean(globalRootRule),
  'mobile-shell.css: los tokens de movimiento deben declararse en un :root global');
for (const [token, expectedValue] of MOTION_TOKENS) {
  pass(globalTokens.get(token) === normalizeCssValue(expectedValue),
    `mobile-shell.css: ${token} debe ser global y valer exactamente ${expectedValue}`);
}

for (const token of ['--pp-motion-base', '--pp-ease-standard', '--pp-ease-enter', '--pp-ease-exit']) {
  pass(css.includes(`var(${token})`),
    `mobile-shell.css: el menú debe consumir ${token}`);
}

const trackRules = Array.from(
  css.matchAll(/\.pp-mobile-menu__views-track\s*\{([^}]*)\}/gi),
  (match) => match[1]
);
pass(trackRules.some((rule) => rule.includes('var(--pp-mobile-level-duration)')),
  'mobile-shell.css: el track de niveles debe consumir --pp-mobile-level-duration');

for (const className of MOTION_STATE_CLASSES) {
  pass(new RegExp(`['"]${escapeRegExp(className)}['"]`).test(dockSource),
    `header-init.js: falta el estado de movimiento ${className}`);
  pass(cssStateIsMenuScoped(css, className),
    `mobile-shell.css: falta selector móvil/menu para el estado ${className}`);
}

pass(dockSource.includes("window.matchMedia('(prefers-reduced-motion: reduce)')") ||
    dockSource.includes('window.matchMedia("(prefers-reduced-motion: reduce)")'),
  'initMobileDock: debe consultar prefers-reduced-motion en JavaScript');
pass(/prefers-reduced-motion\s*:\s*reduce/i.test(css),
  'mobile-shell.css: falta fallback CSS de prefers-reduced-motion');

// El enlace current conserva peso neutro y expresa el estado con subrayado pseudo.
const activeLinkRule = css.match(
  /\.pp-mobile-menu__links\s+a\[aria-current\s*=\s*["']page["']\]\s*\{([^}]*)\}/i
)?.[1] || '';
pass(/font-weight\s*:\s*400\s*;?/i.test(activeLinkRule),
  'mobile-shell.css: el enlace móvil activo debe mantener font-weight: 400');

const currentPseudoMatch = css.match(
  /\.pp-mobile-menu__links\s+a\[aria-current\s*=\s*["']page["']\]::(?:before|after)\s*\{([^}]*)\}/i
);
const currentPseudoRule = currentPseudoMatch?.[1] || '';
pass(Boolean(currentPseudoMatch),
  'mobile-shell.css: el enlace activo debe usar un pseudo-elemento de subrayado');
pass(/content\s*:\s*["']["']\s*;?/i.test(currentPseudoRule) &&
    /position\s*:\s*absolute\s*;?/i.test(currentPseudoRule) &&
    /(?:height\s*:\s*1px|border-(?:top|bottom)\s*:)/i.test(currentPseudoRule),
  'mobile-shell.css: el pseudo activo debe ser un subrayado absoluto de 1px');

// Todas las rutas declaradas por el header deben resolver a HTML real y el
// servidor debe conservar clean URLs top-level y anidadas.
const headerRoutes = Array.from(new Set(
  extractLinks(header).map(({ route }) => route).filter((route) => route.startsWith('/'))
));
for (const route of headerRoutes) {
  pass(routeTargetExists(route), `ruta del header sin destino HTML compatible: ${route}`);
}

pass(server.includes("app.get('/:page'") && server.includes('`${page}.html`'),
  'server.js: falta el contrato de clean URLs top-level hacia public/<page>.html');
pass(server.includes("app.get('/',") && server.includes("res.redirect(301, '/home')"),
  'server.js: la ruta / debe conservar su redirección compatible a /home');
if (headerRoutes.some((route) => route.slice(1).includes('/'))) {
  pass(server.includes('CLEAN URLS ANIDADAS LOCAL') && server.includes('`${cleanPath}.html`'),
    'server.js: falta el contrato de clean URLs anidadas hacia public/<path>.html');
}

if (failures.length) {
  console.error(`Validación de navegación/motion fallida (${failures.length} fallos; ${checks} comprobaciones):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Navegación y motion verificados: ${checks} comprobaciones, ${headerRoutes.length} rutas y ` +
    `${MOTION_STATE_CLASSES.length} estados de transición.`
  );
}

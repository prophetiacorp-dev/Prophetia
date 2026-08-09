'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE_PATH = path.join(ROOT, 'reports', 'toolbar-responsive-validation.json');
const ROUTES = [
  '/mujer',
  '/hombre',
  '/camisetas-punto-mujer',
  '/sudaderas-punto-mujer',
  '/streetwear-mujer',
  '/hoodies-mujer',
  '/camisetas-punto-hombre',
  '/sudaderas-punto-hombre',
  '/streetwear-hombre',
  '/hoodies'
];
const VIEWPORTS = [
  [320, 568], [344, 700], [360, 800], [375, 667], [384, 854],
  [390, 844], [393, 873], [412, 915], [430, 932], [480, 900],
  [600, 960], [679, 900], [768, 1024], [820, 1180], [912, 1368],
  [960, 1280], [1024, 1366], [1025, 1366], [1040, 1200],
  [1280, 800], [1365, 768], [1366, 768], [1920, 1080]
];
const SORT_ROUTES = ROUTES.filter((route) => route !== '/mujer' && route !== '/hombre');
const INTERACTION_WIDTHS = new Set([320, 1024, 1365, 1366]);
const CONTROL_WIDTHS = new Set([320, 1366]);
const SWEEP_ROUTES = ['/camisetas-punto-mujer', '/sudaderas-punto-mujer'];
const SWEEP_WIDTHS = [
  336, 352, 368, 376, 388, 400, 421, 456, 512, 560, 640, 720, 834, 900,
  1000, 1016, 1023, 1026, 1060, 1120, 1180, 1240, 1320, 1360, 1364, 1367,
  1440, 1600
];

const failures = [];
const pass = (condition, message) => {
  if (!condition) failures.push(message);
};

pass(fs.existsSync(EVIDENCE_PATH), 'falta reports/toolbar-responsive-validation.json');

let evidence = null;
if (fs.existsSync(EVIDENCE_PATH)) {
  try {
    evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
  } catch {
    failures.push('la evidencia geométrica no es JSON válido');
  }
}

if (evidence) {
  const records = Array.isArray(evidence.records) ? evidence.records : [];
  const interactions = Array.isArray(evidence.interactions) ? evidence.interactions : [];
  const controls = Array.isArray(evidence.controls) ? evidence.controls : [];
  const sweep = Array.isArray(evidence.sweep) ? evidence.sweep : [];
  const key = (route, width, height) => `${route}|${width}x${height}`;
  const recordMap = new Map(records.map((record) => [
    key(record.route, record.viewport?.width, record.viewport?.height),
    record
  ]));
  const interactionMap = new Map(interactions.map((record) => [
    key(record.route, record.viewport?.width, record.viewport?.height),
    record
  ]));

  pass(records.length === ROUTES.length * VIEWPORTS.length,
    `se esperaban ${ROUTES.length * VIEWPORTS.length} mediciones y hay ${records.length}`);
  pass(new Set(records.map((record) => key(
    record.route,
    record.viewport?.width,
    record.viewport?.height
  ))).size === records.length, 'hay mediciones geométricas duplicadas');

  for (const route of ROUTES) {
    for (const [width, height] of VIEWPORTS) {
      const label = key(route, width, height);
      const record = recordMap.get(label);
      pass(Boolean(record), `${label}: falta medición`);
      if (!record) continue;

      const toolbar = record.toolbar;
      const left = record.left;
      const right = record.right;
      pass(Boolean(toolbar && left && right), `${label}: faltan rectángulos de toolbar`);
      if (!toolbar || !left || !right) continue;

      pass(record.display === 'flex', `${label}: display calculado debe ser flex`);
      pass(record.flexDirection === 'row', `${label}: flex-direction debe ser row`);
      if (width <= 1365) {
        pass(record.flexWrap === 'nowrap', `${label}: flex-wrap debe ser nowrap hasta 1365`);
      }
      pass(Math.abs(left.top - right.top) <= 2, `${label}: grupos desalineados verticalmente`);
      pass(left.left >= toolbar.left - 1 && right.right <= toolbar.right + 1,
        `${label}: un grupo queda fuera de la toolbar`);
      pass(record.scrollWidth <= record.clientWidth + 1,
        `${label}: overflow horizontal en la toolbar`);
      pass(left.right < right.left, `${label}: los grupos se solapan`);
      const maxToolbarHeight = route === '/mujer' || route === '/hombre' ? 66 : 60;
      pass(toolbar.height <= maxToolbarHeight,
        `${label}: altura injustificada de toolbar (${toolbar.height}px)`);
      pass(record.visible?.filters === true, `${label}: Filtros no visible`);
      pass(record.visible?.sort === true, `${label}: Ordenar por no visible`);
      pass(record.visible?.stock === true, `${label}: En stock no visible`);
      if (route !== '/mujer' && route !== '/hombre') {
        pass(record.visible?.view === true, `${label}: Vista no visible`);
      }
      pass(Array.isArray(record.cutTexts) && record.cutTexts.length === 0,
        `${label}: hay textos cortados`);
      pass(Array.isArray(record.consoleErrors) && record.consoleErrors.length === 0,
        `${label}: errores de consola`);
      pass(record.documentScrollWidth <= record.documentClientWidth + 1,
        `${label}: overflow horizontal del documento`);
    }
  }

  for (const route of SORT_ROUTES) {
    for (const [width, height] of VIEWPORTS.filter(([candidate]) => INTERACTION_WIDTHS.has(candidate))) {
      const label = key(route, width, height);
      const interaction = interactionMap.get(label);
      pass(Boolean(interaction), `${label}: falta prueba interactiva de Ordenar por`);
      if (!interaction) continue;
      pass(Math.abs(interaction.gridTopOpen - interaction.gridTopClosed) <= 1,
        `${label}: abrir Ordenar por desplaza el grid`);
      pass(Math.abs(interaction.gridTopAfterEscape - interaction.gridTopClosed) <= 1,
        `${label}: cerrar Ordenar por desplaza el grid`);
      pass(interaction.focusRestored === true, `${label}: Escape no restaura el foco`);
      pass(interaction.closedAfterEscape === true, `${label}: Escape no cierra el popover`);
      pass(interaction.closedAfterOutside === true, `${label}: click exterior no cierra el popover`);
      pass(interaction.closedAfterSelection === true, `${label}: seleccionar no cierra el popover`);
      pass(interaction.focusAfterSelection === true,
        `${label}: seleccionar no devuelve el foco al disparador`);
      pass(Array.isArray(interaction.consoleErrors) && interaction.consoleErrors.length === 0,
        `${label}: errores de consola durante Ordenar por`);
    }
  }

  const controlMap = new Map(controls.map((record) => [
    key(record.route, record.viewport?.width, record.viewport?.height),
    record
  ]));
  pass(controls.length === ROUTES.length * CONTROL_WIDTHS.size,
    `se esperaban ${ROUTES.length * CONTROL_WIDTHS.size} pruebas de controles y hay ${controls.length}`);
  for (const route of ROUTES) {
    for (const [width, height] of VIEWPORTS.filter(([candidate]) => CONTROL_WIDTHS.has(candidate))) {
      const label = key(route, width, height);
      const control = controlMap.get(label);
      pass(Boolean(control), `${label}: falta prueba de filtros/stock/vista`);
      if (!control) continue;
      pass(control.drawerOpened === true, `${label}: el drawer no abre`);
      pass(control.drawerClosedByEscape === true, `${label}: Escape no cierra el drawer`);
      pass(control.drawerFocusRestored === true, `${label}: el drawer no restaura foco`);
      pass(control.stockToggled === true, `${label}: En stock no cambia de estado`);
      if (route === '/mujer' || route === '/hombre') {
        pass(control.nativeSortChanged === true, `${label}: el select de orden no cambia`);
        pass(control.vistaAbsent === true,
          `${label}: el contrato histórico no debe inventar un control Vista`);
      } else {
        pass(control.vistaToggled === true, `${label}: Vista no cambia de estado`);
      }
      pass(Array.isArray(control.consoleErrors) && control.consoleErrors.length === 0,
        `${label}: errores de consola durante controles`);
    }
  }

  const sweepKey = (record) => `${record.route}|${record.viewport?.width}`;
  const sweepMap = new Map(sweep.map((record) => [sweepKey(record), record]));
  pass(sweep.length === SWEEP_ROUTES.length * SWEEP_WIDTHS.length,
    `se esperaban ${SWEEP_ROUTES.length * SWEEP_WIDTHS.length} mediciones de barrido y hay ${sweep.length}`);
  for (const route of SWEEP_ROUTES) {
    for (const width of SWEEP_WIDTHS) {
      const label = `${route}|${width}`;
      const record = sweepMap.get(label);
      pass(Boolean(record), `${label}: falta barrido intermedio`);
      if (!record?.toolbar || !record.left || !record.right) continue;
      pass(record.display === 'flex' && record.flexDirection === 'row',
        `${label}: el barrido pierde la fila Flex`);
      if (width <= 1365) pass(record.flexWrap === 'nowrap', `${label}: el barrido activa wrap`);
      pass(Math.abs(record.left.top - record.right.top) <= 2,
        `${label}: el barrido desalinea grupos`);
      pass(record.left.right < record.right.left, `${label}: el barrido solapa grupos`);
      pass(record.scrollWidth <= record.clientWidth + 1,
        `${label}: el barrido desborda la toolbar`);
      pass(record.documentScrollWidth <= record.documentClientWidth + 1,
        `${label}: el barrido desborda el documento`);
      pass(Array.isArray(record.cutTexts) && record.cutTexts.length === 0,
        `${label}: el barrido corta textos`);
      pass(Array.isArray(record.consoleErrors) && record.consoleErrors.length === 0,
        `${label}: errores de consola en el barrido`);
    }
  }

  for (const size of ['1366x768', '1920x1080']) {
    const comparison = evidence.desktopComparison?.[size];
    pass(comparison?.identical === true, `${size}: la franja de escritorio no es binariamente idéntica`);
    pass(comparison?.beforeHash === comparison?.afterHash,
      `${size}: los hashes de escritorio no coinciden`);
  }
}

if (failures.length) {
  console.error(`Validación geométrica de toolbar fallida (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Toolbar responsive verificada: ${ROUTES.length} rutas, ${VIEWPORTS.length} resoluciones y ` +
    `${SORT_ROUTES.length * INTERACTION_WIDTHS.size} pruebas de Ordenar por.`
  );
}

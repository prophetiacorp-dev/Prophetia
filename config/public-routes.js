'use strict';

const PUBLIC_HTML_ROUTES = Object.freeze({
  '/colecciones/myth-series': 'assets/collects/ms.html',
  '/colecciones/letters-from-the-soul': 'assets/collects/lfts.html',
  '/colecciones/afterhour-prophetia': 'assets/collects/ahp.html'
});

const PUBLIC_LEGACY_REDIRECTS = Object.freeze({
  '/assets/collects/ms': '/colecciones/myth-series',
  '/assets/collects/ms.html': '/colecciones/myth-series',
  '/assets/collects/lfts': '/colecciones/letters-from-the-soul',
  '/assets/collects/lfts.html': '/colecciones/letters-from-the-soul',
  '/assets/collects/ahp': '/colecciones/afterhour-prophetia',
  '/assets/collects/ahp.html': '/colecciones/afterhour-prophetia'
});

module.exports = {
  PUBLIC_HTML_ROUTES,
  PUBLIC_LEGACY_REDIRECTS
};

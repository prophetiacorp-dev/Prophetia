/* =========================================================
   PROPHETIA · breadcrumbs-auto.js
   - Lee data-atributos del <body>
   - Recuerda root/categoría
   - Renderiza breadcrumbs (Prophetia-like)
   ========================================================= */

(() => {
  'use strict';

  function norm(s) {
    return String(s || '').trim();
  }

  function readBodyConfig() {
    const b = document.body;
    if (!b) return null;

    // Root (Hombre/Mujer)
    const rootLabel = norm(b.getAttribute('data-bc-root-label'));
    const rootHref  = norm(b.getAttribute('data-bc-root-href'));

    // Categoría (hoodies, streetwear, etc.)
    const catLabel  = norm(b.getAttribute('data-bc-cat-label'));
    const catHref   = norm(b.getAttribute('data-bc-cat-href'));

    // Página actual (texto final)
    const currentLabel = norm(b.getAttribute('data-bc-current'));

    return { rootLabel, rootHref, catLabel, catHref, currentLabel };
  }

  document.addEventListener('DOMContentLoaded', () => {
    const api = window.ppBreadcrumbs;
    if (!api) return;

    // Si no hay data, intenta inferir root por referrer (por si navegas directo)
    api.inferRootFromReferrer?.();

    const cfg = readBodyConfig();
    if (!cfg) return;

    // Root explícito (si lo defines, manda sobre lo inferido)
    if (cfg.rootLabel && cfg.rootHref) {
      api.rememberRoot?.({ label: cfg.rootLabel, href: cfg.rootHref });
    }

    // Categoría (si existe, se guarda para PDP)
  // Categoría (si existe, se guarda para PDP)
// Si falta href, usamos la página actual como fallback.
if (cfg.catLabel) {
  const href = cfg.catHref || (location.pathname.split('/').pop() || location.href);
  api.rememberCategory?.({ label: cfg.catLabel, href });
}


    // Render final
    api.build?.({
      navSelector: '.pdp-breadcrumb, .pp-breadcrumb',
      currentLabel: cfg.currentLabel || cfg.catLabel || 'Página'
    });
  });
})();

/* =========================================================
   PROPHETIA · breadcrumbs.js
   - Recuerda Hombre/Mujer + categoría con sessionStorage
   - Renderiza breadcrumbs consistentes (Prophetia-like)
   ========================================================= */

(() => {
  'use strict';

  const KEY_ROOT = 'pp_bc_root'; // { label, href }
  const KEY_CAT  = 'pp_bc_cat';  // { label, href }

  const sameOrigin = (url) => {
    try { return new URL(url, location.href).origin === location.origin; }
    catch { return false; }
  };

  const set = (k, v) => sessionStorage.setItem(k, JSON.stringify(v));
  const get = (k) => {
    try { return JSON.parse(sessionStorage.getItem(k) || 'null'); }
    catch { return null; }
  };

  // Llama a esto en páginas "root" (hombre.html / mujer.html)
  function rememberRoot({ label, href }) {
    set(KEY_ROOT, { label, href });
    // cuando cambias de root, normalmente quieres resetear categoría
    sessionStorage.removeItem(KEY_CAT);
  }

  // Llama a esto en páginas "categoría" (/camisetas-punto-hombre, hoodies-mujer.html, etc.)
 function rememberCategory({ label, href }) {
  // Si no viene href, NO guardes basura.
  // Mejor: no tocar el estado anterior.
  if (!label) return;

  const safeHref = (typeof href === 'string' && href.trim()) ? href.trim() : null;
  if (!safeHref) return;

  set(KEY_CAT, { label, href: safeHref });
}


  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
function renderBreadcrumb(navEl, items) {
  if (!navEl) return;

  const clean = items
    .filter(Boolean)
    .map(it => ({
      label: String(it.label ?? '').trim(),
      href: (typeof it.href === 'string' ? it.href.trim() : '')
    }))
    .filter(it => it.label.length > 0);

  navEl.innerHTML = clean
    .map((it, idx) => {
      const isLast = idx === clean.length - 1;

   if (isLast) {
  // si hay href, lo hacemos link; si no, span
  if (it.href) {
    return `<a class="pp-bc__link pp-bc__current-link" aria-current="page" href="${it.href}">${escapeHtml(it.label)}</a>`;
  }
  return `<span class="pp-bc__current" aria-current="page">${escapeHtml(it.label)}</span>`;
}


      return `<a class="pp-bc__link" href="${it.href}">${escapeHtml(it.label)}</a>`;
    })
    .join(`<span class="pp-bc__sep" aria-hidden="true">·</span>`);
}

  // Auto: construye breadcrumb “Prophetia-like” con memoria de navegación
  // current = { label, href? } -> href se ignora (último siempre span)
  function build({ navSelector = '.pdp-breadcrumb, .pp-breadcrumb', currentLabel }) {
    const navEl = document.querySelector(navSelector);
    if (!navEl) return;

    const root = get(KEY_ROOT);
    const cat  = get(KEY_CAT);

    const cur = String(currentLabel || 'Página').trim().toLowerCase();
    const catLabel = String(cat?.label || '').trim().toLowerCase();

    // Si la categoría guardada coincide con la página actual,
    // evitamos repetir: "Hoodies · Hoodies" en PLP.
    // OJO: la categoría sigue guardada (para PDP).
    const catForRender = (catLabel && catLabel !== cur) ? cat : null;

    const items = [
      { label: 'Home', href: 'home.html' },
      root?.label ? { label: root.label, href: root.href } : null,
      catForRender?.label ? { label: catForRender.label, href: catForRender.href } : null,
     { label: currentLabel || 'Página', href: location.pathname.split('/').pop() || '' }

    ];

    renderBreadcrumb(navEl, items);
  }


  // Soporte opcional: set root desde referrer si no existe (misma origin)
  function inferRootFromReferrer() {
    const existing = get(KEY_ROOT);
    if (existing?.label) return;

    if (!document.referrer || !sameOrigin(document.referrer)) return;

    const ref = new URL(document.referrer);
    const file = (ref.pathname.split('/').pop() || '').toLowerCase();

    // Ajusta aquí si tus nombres cambian
    if (file === 'hombre.html') rememberRoot({ label: 'Hombre', href: 'hombre.html' });
    if (file === 'mujer.html')  rememberRoot({ label: 'Mujer',  href: 'mujer.html' });
  }

  // Exponer API
  window.ppBreadcrumbs = {
    rememberRoot,
    rememberCategory,
    build,
    inferRootFromReferrer
  };
})();

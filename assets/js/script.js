/* -----------------------------------------------
   PROPHETIA Front — Grid + Filters + Mega + Popup
   ----------------------------------------------- */
(function () {
  "use strict";

  // ---------- Helpers ----------
  const byId = (id) => document.getElementById(id);
  const $grid = byId('productsGrid');

  // Query params
  const params = new URLSearchParams(location.search);
  const q = (k, d = '') => (params.get(k) || d).toLowerCase();

  // Page type from <body data-page="">
  const pageType = document.body?.dataset?.page || '';

  // Estado de filtros
  const state = {
    type: pageType === 'hoodies' ? 'hoodie'
        : pageType === 'tshirts' ? 'tshirt'
        : pageType === 'collections' ? 'tshirt' // (si en el futuro quieres mezclar, lo ampliamos)
        : (pageType || 'tshirt'),
    fit:        q('fit', 'all'),
    gender:     q('gender', 'all'),
    collection: q('collection', 'all'),
    stock:      q('stock', '') === '1',
    order:      q('order', 'relevance')
  };

  // ---------- Filtros UI ----------
  function initChipsFromState() {
    document.querySelectorAll('.chip[data-k]').forEach(btn => {
      const k = btn.dataset.k;
      const v = (btn.dataset.v || '').toLowerCase();
      const active =
        (state[k] || 'all') === v ||
        (v === 'all' && (state[k] === 'all' || !state[k]));
      btn.classList.toggle('chip-active', active);
    });
    const onlyStock = byId('onlyStock');
    if (onlyStock) onlyStock.checked = !!state.stock;
    const orderSel = byId('orderSelect');
    if (orderSel) orderSel.value = state.order;
  }

  function bindFilters() {
    document.querySelectorAll('.chip[data-k]').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.k;
        const v = btn.dataset.v.toLowerCase();
        state[k] = v;
        document.querySelectorAll(`.chip[data-k="${k}"]`)
          .forEach(b => b.classList.remove('chip-active'));
        btn.classList.add('chip-active');
        render();
        syncUrl();
      });
    });

    const onlyStock = byId('onlyStock');
    if (onlyStock) {
      onlyStock.addEventListener('change', () => {
        state.stock = onlyStock.checked;
        render();
        syncUrl();
      });
    }

    const orderSel = byId('orderSelect');
    if (orderSel) {
      orderSel.addEventListener('change', () => {
        state.order = orderSel.value;
        render();
        syncUrl();
      });
    }
  }

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.gender !== 'all') p.set('gender', state.gender);
    if (state.fit !== 'all') p.set('fit', state.fit);
    if (state.collection !== 'all') p.set('collection', state.collection);
    if (state.stock) p.set('stock', '1');
    if (state.order && state.order !== 'relevance') p.set('order', state.order);
    const newUrl = location.pathname + (p.toString() ? '?' + p.toString() : '') + (location.hash || '');
    history.replaceState(null, '', newUrl);
  }

  // ---------- Catalogo ----------
  async function loadCatalog() {
    if (window.PROPHETIA_CATALOG) return window.PROPHETIA_CATALOG;
    try {
      const res = await fetch('assets/data/catalog.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('no catalog');
      return await res.json();
    } catch (e) {
      console.warn('Catalog not found, using fallback.', e);
      return [
        {
          id: "atlas-seal",
          type: "tshirt",
          title: "Atlas by Prophetia",
          collection: "myth-series",
          gender: "unisex",
          fit: "regular",
          price: 59.00,
          inStock: true,
          images: ["assets/img/atlas/atlas-front.png", "assets/img/atlas/atlas-back.png"],
          short: "Perfil escultórico y sello griego. DTG-ready."
        },
        {
          id: "calyra-ego",
          type: "tshirt",
          title: "Calyra’s Ego by Prophetia",
          collection: "letters-from-the-soul",
          gender: "unisex",
          fit: "oversized",
          price: 64.00,
          inStock: true,
          images: ["assets/img/atlas/atlas-back.png", "assets/img/atlas/atlas-front.png"],
          short: "Diosa egipcia contemporánea. Gesto geométrico y aura editorial."
        }
      ];
    }
  }

  // ---------- Predicados de filtro ----------
  const passTypeFilter = (p) => !state.type ? true : p.type === state.type;
  const passFitFilter = (p) => state.fit === 'all' ? true : (p.fit || 'regular').toLowerCase() === state.fit;
  const passGenderFilter = (p) => state.gender === 'all' ? true : (p.gender || 'unisex').toLowerCase() === state.gender;
  const passCollectionFilter = (p) => state.collection === 'all' ? true : (p.collection || '').toLowerCase() === state.collection;
  const passStockFilter = (p) => !state.stock ? true : !!p.inStock;

  function sortProducts(list) {
    const s = state.order;
    if (s === 'price-asc') return list.slice().sort((a,b)=>a.price-b.price);
    if (s === 'price-desc') return list.slice().sort((a,b)=>b.price-a.price);
    return list;
  }

  function prettyCollection(c) {
    if (!c) return '';
    if (c === 'myth-series') return 'Myth Series';
    if (c === 'letters-from-the-soul') return 'Letters from the Soul';
    return c.replace(/-/g,' ');
  }

  function cardHTML(p) {
  const base = (p.images && p.images[0]) || 'assets/img/placeholder.png';
  // Si tienes versión 2x con el mismo nombre + @2x (p.ej., atlas-front@2x.png)
  const hi = base.replace(/(\.\w+)$/, '@2x$1'); // atlas-front.png -> atlas-front@2x.png
  const price = (p.price ?? 0).toFixed(2).replace('.', ',');
  const title = p.title || 'Producto';

  return `
    <article class="card">
      <div class="img-wrap">
        <img 
          src="${base}" 
          srcset="${base} 1x, ${hi} 2x"
          alt="${title}" loading="lazy" decoding="async">
      </div>
      <h4>${title}</h4>
      <p class="collection">${prettyCollection(p.collection)}</p>
      <span class="price">€${price}</span>
      <a class="btn-primary" href="producto.html?id=${encodeURIComponent(p.id)}">Ver</a>
    </article>
  `;
}


  let CATALOG = [];

  async function render() {
    if (!$grid) return; // páginas sin grid
    let items = CATALOG
      .filter(passTypeFilter)
      .filter(passFitFilter)
      .filter(passGenderFilter)
      .filter(passCollectionFilter)
      .filter(passStockFilter);

    items = sortProducts(items);

    if (!items.length) {
      $grid.innerHTML = `<div class="muted" style="padding:24px;">No hay productos para este filtro.</div>`;
      return;
    }
    $grid.innerHTML = items.map(cardHTML).join('');
  }

  // ---------- Mega menú (hover + click sin parpadeo) ----------
  function bindMegaMenu() {
    document.querySelectorAll('.mega').forEach(m => {
      const btn = m.querySelector('.mega-toggle');
      const panel = m.querySelector('.mega-panel');
      if (!btn || !panel) return;
      let over = false;
      m.addEventListener('mouseenter', () => { m.classList.add('open'); over = true; });
      m.addEventListener('mouseleave', () => { over = false; setTimeout(()=>!over && m.classList.remove('open'), 120); });
      btn.addEventListener('click', (e)=> {
        e.preventDefault();
        m.classList.toggle('open');
      });
    });
  }

  // ---------- Soporte de anchors en Colecciones ----------
  function applyHashToFiltersIfNeeded() {
    const h = (location.hash || '').replace('#','').toLowerCase();
    if (!h) return;
    if (h === 'myth-series' || h === 'letters-from-the-soul') {
      state.collection = h;
      // Marcar visual
      document.querySelectorAll('.chip[data-k="collection"]').forEach(b => b.classList.remove('chip-active'));
      const target = document.querySelector(`.chip[data-k="collection"][data-v="${h}"]`);
      if (target) target.classList.add('chip-active');
    }
  }

  // ---------- Init catálogo (solo en páginas con grid) ----------
  (async function initCatalog() {
    bindMegaMenu();
    if (!$grid) return; // nada que hacer si no hay grid

    // Si estamos en colecciones y viene un hash, aplicarlo como filtro
    applyHashToFiltersIfNeeded();

    initChipsFromState();
    bindFilters();
    CATALOG = await loadCatalog();
    render();
  })();

  // ---------- POP-UP Prophetia Tribe (global) ----------
  (function initTribePopup(){
    const MODAL = document.getElementById('tribeModal');
    if (!MODAL) return; // página sin popup

    const OPEN_DELAY_MS = 6500;
    const LS_KEY = 'pp_tribe_closed_until';
    const back = MODAL.querySelector('.tribe-backdrop');
    const closes = MODAL.querySelectorAll('[data-close], .tribe-close');
    const form = MODAL.querySelector('#tribeForm');

    function open() {
      MODAL.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      MODAL.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    function snooze(days = 7) {
      const ms = days * 24 * 60 * 60 * 1000;
      localStorage.setItem(LS_KEY, String(Date.now() + ms));
    }

    // Cierre por botón/fondo
    closes.forEach(btn => btn.addEventListener('click', () => { close(); snooze(7); }));
    if (back) back.addEventListener('click', () => { close(); snooze(7); });

    // Esc para cerrar
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape' && MODAL.getAttribute('aria-hidden') === 'false') {
        close(); snooze(7);
      }
    });

    // Mostrar si no está en "descanso"
    const now = Date.now();
    const until = +localStorage.getItem(LS_KEY) || 0;
    if (now > until) setTimeout(open, OPEN_DELAY_MS);

    // Envío del formulario (demo)
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        snooze(7);
        close();
        alert('¡Gracias por unirte a Prophetia Tribe!');
      });
    }

    // Disparador manual opcional: cualquier elemento con [data-open-tribe]
    document.querySelectorAll('[data-open-tribe]').forEach(el=>{
      el.addEventListener('click', (e)=>{ e.preventDefault(); open(); });
    });
  })();

})();
/* ---------- Page Transitions (no-lib) ---------- */
(function pageTransitions(){
  const body = document.body;

  // Anima entrada en cada carga
  function enter(){
    body.classList.remove('pp-leave');
    body.classList.add('pp-enter');
    // quita la clase tras la animación
    setTimeout(()=> body.classList.remove('pp-enter'), 400);
  }

  // Decide si gestionamos un <a> con transición
  function shouldHandle(a){
    if (!a || !a.href) return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download')) return false;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return false;
    // misma origen
    let url;
    try { url = new URL(href, location.href); } catch { return false; }
    if (url.origin !== location.origin) return false;
    // misma página (no navegar)
    if (url.pathname === location.pathname && url.search === location.search && url.hash === '') return false;
    return true;
  }

  // Maneja clic en enlaces navegables
  function onLinkClick(e){
    const a = e.currentTarget;
    if (!shouldHandle(a)) return;
    e.preventDefault();
    body.classList.add('pp-leave');

    const go = () => { window.location.href = a.href; };
    // Fallback por si la animación no dispara evento
    const t = setTimeout(go, 260);

    // Si quieres ser más estricto, puedes escuchar animationend:
    body.addEventListener('animationend', function handler(){
      body.removeEventListener('animationend', handler);
      clearTimeout(t);
      go();
    });
  }

  // Vincula todos los <a> de la página
  function bindAll(){
    document.querySelectorAll('a').forEach(a=>{
      a.removeEventListener('click', onLinkClick);
      a.addEventListener('click', onLinkClick);
    });
  }

  // Entrada en carga inicial
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enter, { once:true });
  } else {
    enter();
  }

  // Vuelve a animar al volver con Back/Forward cache
  window.addEventListener('pageshow', (ev) => {
    if (ev.persisted) enter();
  });

  // Enlaza manejadores
  bindAll();

  // Si tu app inyecta <a> dinámicamente, vuelve a llamar a bindAll()
  // después de ese render. Ej: bindAll() tras cambiar el grid.
})();
/* ---------- Cursor con logo + Loader centrado ---------- */
(function cursorAndLoader(){
  const LOGO = 'assets/img/logo/prophetia-emblem.png'; // ← tu ruta

  // Loader overlay (si no existe, lo creamos)
  let loader = document.querySelector('.pp-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.className = 'pp-loader';
    loader.innerHTML = `<img src="${LOGO}" alt="PROPHETIA">`;
    document.body.appendChild(loader);
  }
  function showLoader(){ loader.classList.add('show'); }
  function hideLoader(){ loader.classList.remove('show'); }

  // Exponer para que lo use la transición de páginas
  window.__ppShowLoader = showLoader;
  window.__ppHideLoader = hideLoader;

  // Cursor seguidor solo en dispositivos con puntero fino
  const fine = matchMedia('(pointer: fine)').matches;
  if (!fine) return;

  let cursor = document.querySelector('.pp-cursor');
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.className = 'pp-cursor';
    cursor.innerHTML = `<img src="${LOGO}" alt="">`;
    document.body.appendChild(cursor);
  }

  let x = 0, y = 0, tx = 0, ty = 0, raf;
  const speed = 0.18;

  function loop(){
    tx += (x - tx) * speed;
    ty += (y - ty) * speed;
    cursor.style.left = tx + 'px';
    cursor.style.top  = ty + 'px';
    raf = requestAnimationFrame(loop);
  }
  loop();

  window.addEventListener('mousemove', e => {
    x = e.clientX; y = e.clientY;
    cursor.classList.add('show');
    clearTimeout(cursor._t);
    cursor._t = setTimeout(()=> cursor.classList.remove('show'), 1000);
  }, { passive: true });

  // Destacar sobre enlaces y botones
  document.addEventListener('mouseover', e => {
    const target = e.target.closest('a,button,[role="button"]');
    cursor.classList.toggle('link', !!target);
  });

  document.addEventListener('mousedown', () => cursor.style.opacity = '.6');
  document.addEventListener('mouseup',   () => cursor.style.opacity = '');
})();

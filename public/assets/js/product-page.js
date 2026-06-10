document.addEventListener('DOMContentLoaded', () => {
    (async function initPDP() {
      const $ = (s, r = document) => r.querySelector(s);
      const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const sizeBtn = document.getElementById('pdpSizeBtn');
const colorBtn = document.getElementById('pdpColorBtn');
const versionBtn = document.getElementById('pdpVersionBtn');

const fitGuideAttrBtn = document.getElementById('pdpFitGuideBtn');
const fitGuideVal = document.getElementById('pdpFitGuideVal');

const shippingBtn = document.querySelector('[data-tab="shipping"]');
const detailsBtn = document.querySelector('[data-tab="details"]');
const fitGuideLinkBtn = document.querySelector('[data-tab="fit-guide"]');
      

      // 1) slug/id
      const params = new URLSearchParams(location.search);
const slug = params.get('slug') || params.get('id');
const urlVersion = (params.get('version') || '').trim().toLowerCase();

     // 2) Cargar catálogo (con try/catch)
     const money = (n = 0) => {
  try { return new Intl.NumberFormat('es-ES', { style:'currency', currency:'EUR' }).format(n); }
  catch { return `${(+n).toFixed(2)} €`; }
};
function addProductToCart(product) {
  const safeProduct = {
    qty: 1,
    ...product
  };

  if (typeof window.ppAddToCart === 'function') {
    window.ppAddToCart(safeProduct);
    return;
  }

  const CART_KEY = 'pp_cart_v2';

  let cart = [];

  try {
    cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(cart)) cart = [];
  } catch {
    cart = [];
  }

  const productSku = String(safeProduct.sku || '').trim();

  const existing = cart.find((item) => {
    const itemSku = String(item.sku || '').trim();

    if (productSku && itemSku) {
      return itemSku === productSku;
    }

    return (
      String(item.id || '') === String(safeProduct.id || '') &&
      String(item.size || '') === String(safeProduct.size || '') &&
      String(item.color || '') === String(safeProduct.color || '') &&
      String(item.version || '') === String(safeProduct.version || '')
    );
  });

  if (existing) {
    existing.qty = (+existing.qty || 1) + (+safeProduct.qty || 1);
  } else {
    cart.push(safeProduct);
  }

  localStorage.setItem(CART_KEY, JSON.stringify(cart));

  window.ppCart?.updateBadges?.();

  if (typeof window.ppOpenCart === 'function') {
    window.ppOpenCart();
  } else {
    window.dispatchEvent(new CustomEvent('pp:cart-updated'));
  }
}
let items = [];
let prod = null;
let tribeProfile = null;

const TRIBE_RANK_ORDER = {
  'tribe-member': 0,
  'initiate': 1,
  'adeptus': 2,
  'oracle': 3,
  'seer': 4,
  'prophet': 5
};

function normalizeRankId(rankId = '') {
  return String(rankId || '').trim().toLowerCase();
}

function hasRequiredTribeRank(userRankId = '', requiredRankId = '') {
  const userLevel = TRIBE_RANK_ORDER[normalizeRankId(userRankId)] ?? 0;
  const requiredLevel = TRIBE_RANK_ORDER[normalizeRankId(requiredRankId)] ?? 999;

  return userLevel >= requiredLevel;
}

function isEarlyAccessStillLocked(product = {}) {
  const early = product.earlyAccess;

  if (!early || early.enabled !== true) return false;

  const publicReleaseAt = early.publicReleaseAt
    ? new Date(early.publicReleaseAt)
    : null;

  if (!publicReleaseAt || Number.isNaN(publicReleaseAt.getTime())) {
    return true;
  }

  return Date.now() < publicReleaseAt.getTime();
}

function userCanAccessEarlyProduct(product = {}) {
  const early = product.earlyAccess;

  if (!early || early.enabled !== true) return true;
  if (!isEarlyAccessStillLocked(product)) return true;

  return hasRequiredTribeRank(
    tribeProfile?.rankId || 'tribe-member',
    early.requiredRankId || 'adeptus'
  );
}

async function loadTribeProfileForPDP() {
  try {
    const authReady = window.__ppFirebaseAuthReady;
    const auth = window.__ppFirebaseAuth;

    if (authReady) {
      await authReady;
    }

    const user = auth?.currentUser || null;
    if (!user) return null;

    const token = await user.getIdToken();

   const res = await fetch('/api/tribe/me', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

    if (!res.ok) return null;

    return await res.json();
  } catch (err) {
    console.warn('[PDP Early Access] No se pudo cargar Tribe:', err);
    return null;
  }
}

async function loadLocalCatalog() {
  const res = await fetch('assets/data/catalog.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} cargando catalog.json`);

  const data = await res.json();
  return Array.isArray(data) ? data : (data.items || []);
}

try {
  items = await loadLocalCatalog();

  const localProd =
    items.find(p => String(p.slug || '') === String(slug)) ||
    items.find(p => String(p.id || '') === String(slug)) ||
    items[0];

  try {
    const { ppGetProductById, ppGetProductBySlug } = await import('/assets/js/firebase-products.js');

    const remoteProd =
      await ppGetProductById(slug) ||
      await ppGetProductBySlug(slug);

    prod = remoteProd || localProd;
  } catch (firebaseErr) {
    console.warn('[PDP] Firestore no disponible. Usando catalog.json:', firebaseErr);
    prod = localProd;
  }

  if (!prod) throw new Error('Producto no encontrado');
  tribeProfile = await loadTribeProfileForPDP();
} catch (err) {
  console.error('[PDP] Fallo cargando producto:', err);
  return;
}

      // 3) Establecer datos del producto
      $('#pTitle').textContent = prod.title || 'Producto';
      // Breadcrumb Prophetia-like (con memoria Hombre/Mujer + categoría)
window.ppBreadcrumbs?.inferRootFromReferrer();
window.ppBreadcrumbs?.build({ currentLabel: (prod.title || 'Producto') });

      $('#pShort').textContent = prod.short || 'Descripción corta';
     

   

      const dedupe = (arr) => [...new Set((arr || []).filter(Boolean))];
      const slugify = (s) => String(s || '')
        .toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

   const rawG = (params.get('g') || params.get('gender') || localStorage.getItem('pp_gender') || 'hombre').toLowerCase();

const GMAP = {
  hombre: 'hombre', men: 'hombre', man: 'hombre', male: 'hombre',
  mujer: 'mujer',  women: 'mujer',  woman: 'mujer', female: 'mujer',
  unisex: 'unisex'
};

const prefGender = GMAP[rawG] || 'hombre';

// Guarda preferencia útil
try { localStorage.setItem('pp_gender', prefGender); } catch {}

const media = (prod.media && (prod.media[prefGender] || prod.media.hombre || prod.media.mujer)) || null;

const FALLBACK_IMG = 'assets/img/logo/prophetia-emblem.png';

const productVersions = Array.isArray(prod.versions) ? prod.versions : [];

const availableVersions = productVersions.map(v => ({
  id: String(v.id || '').trim(),
  label: String(v.label || v.id || '').trim(),
  price: typeof v.price === 'number' ? v.price : prod.price,
  cover: v.cover || FALLBACK_IMG,
  images: Array.isArray(v.images) ? v.images.filter(Boolean) : []
})).filter(v => v.id);




const thumbsEl = document.getElementById('pThumbs');
const heroEl = document.getElementById('pdpStack');

function setGallery(images) {
  const safeImages = Array.isArray(images) && images.length ? images : [FALLBACK_IMG];

  heroEl.innerHTML = safeImages.map((src, i) => `
    <button type="button" class="pdp-shot" data-i="${i}" aria-label="click to zoom">
      <picture class="pdp-picture">
        <img src="${src}" alt="${prod.title} — imagen ${i + 1}" loading="lazy" decoding="async" draggable="false">
      </picture>
    </button>
  `).join('');

  thumbsEl.innerHTML = safeImages.map((src, i) => `
  <button type="button" class="pdp-rail__btn ${i === 0 ? 'is-active' : ''}" data-i="${i}" aria-label="Ir a imagen ${i + 1}">
    <img src="${src}" alt="${prod.title || 'Producto'} — miniatura ${i + 1}">
  </button>
`).join('');
}
   // ---------- ATTR DRAWER (Prophetia-like) ----------
   const adTabs  = document.getElementById('adTabs');
const drawer = document.getElementById('attrDrawer');
const adBody  = document.getElementById('adBody');
const adTitle = document.getElementById('adTitle');

const state = {
  color: null,
  size: null,
  version: null
};
const PDP_SEL_KEY = 'pp_pdp_sel_v1';

const prev = loadSel();

const selectedVersionFromUrl =
  availableVersions.find(v => v.id.toLowerCase() === urlVersion) || null;

if (selectedVersionFromUrl) {
  state.version = selectedVersionFromUrl.id;
} else if (prev?.version && availableVersions.some(v => v.id === prev.version)) {
  state.version = prev.version;
} else if (availableVersions.length === 1) {
  state.version = availableVersions[0].id;
}

const initialVersion = availableVersions.find(v => v.id === state.version) || null;

let baseImages = dedupe(
  initialVersion
    ? (
        Array.isArray(initialVersion.images) && initialVersion.images.length
          ? initialVersion.images
          : [initialVersion.cover]
      )
    : (
        Array.isArray(media?.images) && media.images.length
          ? media.images
          : (typeof media?.cover === 'string' && media.cover)
            ? [media.cover]
            : []
      )
);

if (!baseImages.length) baseImages.push(FALLBACK_IMG);

setGallery(baseImages);

const Z = {
  el: document.getElementById('pdpZoom'),
  img: document.getElementById('pdpZoomImg'),
  thumbs: document.getElementById('pdpZoomThumbs'),
  i: 0,
  images: baseImages
};

function zoomPaint(idx) {
  Z.i = idx;
  Z.img.src = Z.images[idx] || Z.images[0] || FALLBACK_IMG;
 Z.thumbs.innerHTML = Z.images.map((src, i) =>
  `<li class="${i === idx ? 'is-active' : ''}" data-i="${i}"><img src="${src}" alt="${prod.title || 'Producto'} — zoom ${i + 1}"></li>`
).join('');
}

zoomPaint(0);

function zoomOpen(idx) {
  zoomPaint(idx);
  Z.el.classList.remove('hidden');
  Z.el.setAttribute('aria-hidden', 'false');
  Z.el.classList.add('zoom-in');
  resetZoom();
}

function zoomClose() {
  Z.el.classList.add('hidden');
  Z.el.setAttribute('aria-hidden', 'true');
  Z.el.classList.remove('zoom-in');
  Z.el.classList.remove('zoomed');
  resetZoom();
}

let zScale = 1;
let zTx = 0;
let zTy = 0;
let dragging = false;
let startX = 0;
let startY = 0;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function applyZoom() {
  Z.img.style.transform = `translate(${zTx}px, ${zTy}px) scale(${zScale})`;
  Z.el.classList.toggle('zoomed', zScale > 1);
}

function resetZoom() {
  zScale = 1;
  zTx = 0;
  zTy = 0;
  applyZoom();
  Z.img.style.cursor = 'zoom-out';
}

function zoomTo(nextScale, clientX, clientY) {
  const rect = Z.img.getBoundingClientRect();
  const prevScale = zScale;

  nextScale = clamp(nextScale, 1, 3);
  if (nextScale === prevScale) return;

  const px = (clientX - rect.left) / rect.width;
  const py = (clientY - rect.top) / rect.height;

  const ds = nextScale / prevScale;
  zTx = (zTx - (px - 0.5) * rect.width * (ds - 1));
  zTy = (zTy - (py - 0.5) * rect.height * (ds - 1));

  zScale = nextScale;
  applyZoom();
  Z.img.style.cursor = zScale > 1 ? 'grab' : 'zoom-out';
}

heroEl.addEventListener('click', (e) => {
  const shot = e.target.closest('.pdp-shot[data-i]');
  if (!shot) return;
  zoomOpen(+shot.dataset.i);
});

thumbsEl.addEventListener('click', (e) => {
  const b = e.target.closest('.pdp-rail__btn[data-i]');
  if (!b) return;
  const i = +b.dataset.i;
  const target = heroEl.querySelector(`.pdp-shot[data-i="${i}"]`);
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setActiveThumb(i);
});

Z.el.addEventListener('wheel', (e) => {
  if (Z.el.classList.contains('hidden')) return;
  e.preventDefault();
  const delta = Math.sign(e.deltaY);
  const step = 0.18;
  zoomTo(zScale + (delta > 0 ? -step : step), e.clientX, e.clientY);
}, { passive: false });

Z.img.addEventListener('mousedown', (e) => {
  if (zScale <= 1) return;
  e.preventDefault();
  dragging = true;
  startX = e.clientX - zTx;
  startY = e.clientY - zTy;
  Z.img.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  zTx = e.clientX - startX;
  zTy = e.clientY - startY;
  applyZoom();
});

window.addEventListener('mouseup', () => {
  dragging = false;
  Z.img.style.cursor = zScale > 1 ? 'grab' : 'zoom-out';
});

Z.img.addEventListener('dblclick', (e) => {
  e.preventDefault();
  if (zScale === 1) zoomTo(2, e.clientX, e.clientY);
  else resetZoom();
});

document.getElementById('pdpZoomClose')?.addEventListener('click', (e) => {
  e.preventDefault();
  zoomClose();
});

document.getElementById('pdpZoomPrev')?.addEventListener('click', (e) => {
  e.preventDefault();
  zoomPaint((Z.i - 1 + Z.images.length) % Z.images.length);
});

document.getElementById('pdpZoomNext')?.addEventListener('click', (e) => {
  e.preventDefault();
  zoomPaint((Z.i + 1) % Z.images.length);
});

Z.thumbs?.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-i]');
  if (!li) return;
  zoomPaint(+li.dataset.i);
});

const zoomFigure = Z.el.querySelector('.lb-figure');

Z.el.addEventListener('pointerdown', (e) => {
  if (Z.el.classList.contains('hidden')) return;
  const clickedInside = e.target.closest('.lb-figure');
  if (!clickedInside) zoomClose();
}, true);

zoomFigure?.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
}, true);

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!Z.el.classList.contains('hidden')) {
    e.preventDefault();
    zoomClose();
  }
}, true);

Z.img.addEventListener('dragstart', (e) => e.preventDefault());



function loadSel(){
  try {
    const all = JSON.parse(localStorage.getItem(PDP_SEL_KEY) || '{}');
    return all && prod?.id ? (all[prod.id] || null) : null;
  } catch { return null; }
}

function saveSel(){
  try {
    if (!prod?.id) return;
    const all = JSON.parse(localStorage.getItem(PDP_SEL_KEY) || '{}');
    all[prod.id] = {
      color: state.color,
      size: state.size,
      version: state.version,
      ts: Date.now()
    };
    localStorage.setItem(PDP_SEL_KEY, JSON.stringify(all));
  } catch {}
}

function openDrawer(title, html){
  drawer.classList.remove('ad--details');
if (adTabs){
  adTabs.hidden = true;
  adTabs.innerHTML = '';
}

  adTitle.textContent = title;
  adBody.innerHTML = html;

  // 🔒 Compatible con CSS que use .open o .is-open
  drawer.classList.add('open', 'is-open');

  drawer.setAttribute('aria-hidden','false');
  document.body.classList.add('drawer-open');
}

function closeDrawer(){
  drawer.classList.remove('open', 'is-open', 'ad--details');
  drawer.setAttribute('aria-hidden','true');
  document.body.classList.remove('drawer-open');

  // Limpieza tabs
  if (adTabs){
    adTabs.hidden = true;
    adTabs.innerHTML = '';
  }
}



drawer.querySelectorAll('[data-ad-close]').forEach(el=>{
  el.addEventListener('click', (e)=>{ e.preventDefault(); closeDrawer(); });
});

// Cerrar: ESC
document.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
});

// Helpers variants (soporta productos con y sin prod.variants)
const uniq = (arr) => [...new Set((arr || []).filter(Boolean))];

// 1) Si existen variants reales, usamos esas.
// 2) Si no existen, generamos "variants virtuales" con sizes + color/colors.
const realVariants = Array.isArray(prod.variants) ? prod.variants : [];

const fallbackColors =
  Array.isArray(prod.colors) && prod.colors.length ? prod.colors :
  (typeof prod.color === 'string' && prod.color.trim()) ? [prod.color.trim()] :
  ['Único'];

const fallbackSizes =
  Array.isArray(prod.sizes) && prod.sizes.length ? prod.sizes :
  ['Única'];

// stock fallback: si inStock===false -> 0, si true -> 99 (suficiente para UI)
const fallbackStock = (prod.inStock === false) ? 0 : 99;

const variants = realVariants.length ? realVariants : (fallbackColors.flatMap(c =>
  fallbackSizes.map(s => ({
    sku: `${prod.id}_${String(c)}_${String(s)}`.replace(/\s+/g,'-'),
    color: c,
    size: s,
    stock: fallbackStock,
    img: (prod.media?.hombre?.cover || prod.media?.mujer?.cover || baseImages[0])
  }))
));
// =====================
// HELPERS que faltaban (si no existen, el script revienta y no abre drawers)
// =====================

// Devuelve una imagen representativa para un color
function getActiveVersion(){
  return availableVersions.find(v => v.id === state.version) || null;
}

function imgOfColor(color){
  const currentVersion = getActiveVersion();
  if (currentVersion) {
    return currentVersion.cover || currentVersion.images?.[0] || FALLBACK_IMG;
  }

  const v = variants.find(x => String(x.color) === String(color));
  if (v?.img) return v.img;

  const pref = (params.get('g') || params.get('gender') || localStorage.getItem('pp_gender') || 'hombre').toLowerCase();
  const m = (prod.media && (prod.media[pref] || prod.media.hombre || prod.media.mujer)) || null;

  return (m && (m.cover || (Array.isArray(m.images) && m.images[0]))) || baseImages[0] || FALLBACK_IMG;
}

// Devuelve tallas disponibles para un color
function sizesForColor(color){
  return uniq(
    variants
      .filter(v => String(v.color) === String(color))
      .map(v => v.size)
  );
}

// Devuelve stock para combinación color+talla
function stockOf(color, size){
  const v = variants.find(x => String(x.color) === String(color) && String(x.size) === String(size));
  const st = (v && typeof v.stock === 'number') ? v.stock : fallbackStock;
  return +st || 0;
}

// Marca miniatura activa (si no existe, falla al clickar thumbs)
function setActiveThumb(i){
  thumbsEl?.querySelectorAll('.pdp-rail__btn')?.forEach((b, idx) => {
    b.classList.toggle('is-active', idx === i);
  });
}

// =====================
// COLORES: mismo producto + “siblings” (mismo family)
// =====================
const familyKey = String(prod.family || prod.group || prod.model || prod.base || prod.id || '').trim();

// siblings = productos del catálogo con la misma family
const siblings = items
  .filter(p => String(p.family || p.group || p.model || p.base || p.id || '').trim() === familyKey)
  .filter(p => p && p.id && p.id !== prod.id);

// Construye opciones de color:
// - Variants del mismo producto -> targetId = prod.id
// - Siblings -> targetId = sibling.id
const colorOptions = (() => {
  const map = new Map();

  // 1) Variants (mismo producto)
  uniq(variants.map(v => v.color)).forEach(c => {
    if (!c) return;
    map.set(String(c), { color: String(c), targetId: prod.id, img: imgOfColor(String(c)) });
  });

  // 2) Siblings (otros ids)
  siblings.forEach(p => {
    const c = (Array.isArray(p.colors) && p.colors[0]) || p.color || null;
    if (!c) return;
    // imagen “representativa” del sibling
    const pref = (params.get('g') || params.get('gender') || localStorage.getItem('pp_gender') || 'hombre').toLowerCase();
    const m = (p.media && (p.media[pref] || p.media.hombre || p.media.mujer)) || null;
    const img = (m && (m.cover || (Array.isArray(m.images) && m.images[0]))) || FALLBACK_IMG;

    // Si ya existía por variants, NO lo pisa (variants tienen prioridad para mismo id)
    if (!map.has(String(c))) map.set(String(c), { color: String(c), targetId: p.id, img });
  });

  return [...map.values()];
})();

// ahora “colors” sale de las opciones
const colors = colorOptions.map(o => o.color);

// ===== Restore selección (si existía) =====
// Si viene color por URL (por redirección), tiene prioridad
const urlColor = params.get('color');
if (urlColor && colors.includes(urlColor)) {
  state.color = urlColor;
  state.size = null; // al cambiar color, fuerza re-selección de talla
  saveSel();
}

if (prev?.color && colors.includes(prev.color)) {
  state.color = prev.color;
}
if (prev?.size && state.color && sizesForColor(state.color).includes(prev.size)) {
  state.size = prev.size;
}

// Refresca UI + CTA
syncAttrUI();

// Ajusta imagen según color restaurado (opcional)
if (state.color) {
  const first = imgOfColor(state.color);
  const img = heroEl.querySelector('img');
  if (img && first) img.src = first;
}


// Render COLOR (con “imagen del producto” tipo Prophetia)
function renderColorPanel(){
  if (!colorOptions.length) return `<p class="muted">Este producto no tiene colores configurados.</p>`;

  return `
    <div class="ad-panel-content">
      <div class="opts" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">
        ${colorOptions.map(opt=>{
          const c = opt.color;
          const active = (state.color===c) ? 'is-active' : '';
          const src = opt.img || imgOfColor(c) || baseImages[0];

          return `
            <button
              type="button"
              class="opt ${active}"
              data-pick-color="${c}"
              data-target-id="${opt.targetId}"
              style="display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:12px;"
            >
              <div style="width:100%;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:#f6f6f6;border:1px solid #eee;">
                <img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover">
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="swatch" style="background:${c};"></span>
                <span style="text-transform:capitalize">${c}</span>
              </div>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}


// Render SIZE (grid)
function renderSizePanel(){
  const c = state.color || colors[0] || null;
  const sizes = c ? sizesForColor(c) : [];
  if (!sizes.length) return `<p class="muted">Selecciona un color para ver tallas.</p>`;

  return `
    <div class="ad-panel-content">
      <div class="opts" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;">
        ${sizes.map(s=>{
          const st = stockOf(c,s);
          const disabled = st<=0 ? 'disabled aria-disabled="true"' : '';
          const active = state.size===s ? 'is-active' : '';
          return `
            <button type="button" class="opt ${active}" data-pick-size="${s}" ${disabled} style="opacity:${st<=0?0.35:1}">
              <span>${s}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderVersionPanel(){
  if (!availableVersions.length) {
    return `<p class="muted">Este producto no tiene versiones configuradas.</p>`;
  }

  return `
    <div class="ad-panel-content">
      <div class="opts" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">
        ${availableVersions.map(version => {
          const active = state.version === version.id ? 'is-active' : '';
          const img = version.cover || version.images?.[0] || FALLBACK_IMG;

          return `
            <button
              type="button"
              class="opt ${active}"
              data-pick-version="${version.id}"
              style="display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:12px;"
            >
              <div style="width:100%;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:#f6f6f6;border:1px solid #eee;">
                <img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover">
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start;">
                <span style="font-weight:600;">${version.label}</span>
                <span style="font-size:13px;opacity:.72;">${money(version.price)}</span>
              </div>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* =========================================================
   PROPHETIA · Intelligent Fit Guide
   Recomendador de talla por altura, peso y fit deseado
   ========================================================= */

const FIT_GUIDE_KEY = 'pp_fit_guide_v1';

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

function sizeIndex(size) {
  const clean = String(size || '').trim().toUpperCase();
  const index = SIZE_ORDER.indexOf(clean);
  return index === -1 ? 0 : index;
}

function clampSizeIndex(index, availableSizes = []) {
  const safeAvailable = availableSizes
    .map(String)
    .filter(Boolean)
    .sort((a, b) => sizeIndex(a) - sizeIndex(b));

  if (!safeAvailable.length) return null;

  const min = sizeIndex(safeAvailable[0]);
  const max = sizeIndex(safeAvailable[safeAvailable.length - 1]);
  const safeIndex = Math.max(min, Math.min(max, index));

  let closest = safeAvailable[0];
  let bestDistance = Infinity;

  safeAvailable.forEach((size) => {
    const distance = Math.abs(sizeIndex(size) - safeIndex);

    if (distance < bestDistance) {
      closest = size;
      bestDistance = distance;
    }
  });

  return closest;
}

function getAvailableFitGuideSizes() {
  const color = state.color || colors[0] || null;

  const fromVariants = uniq(
    variants
      .filter((variant) => {
        const sameColor = !color || String(variant.color) === String(color);
        const inStock = Number(variant.stock ?? fallbackStock) > 0;
        return sameColor && inStock;
      })
      .map((variant) => variant.size)
  );

  const source = fromVariants.length ? fromVariants : fallbackSizes;

  return source
    .map(String)
    .filter(Boolean)
    .sort((a, b) => sizeIndex(a) - sizeIndex(b));
}

function readFitGuideProfile() {
  try {
    const data = JSON.parse(localStorage.getItem(FIT_GUIDE_KEY) || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function saveFitGuideProfile(profile = {}) {
  try {
    localStorage.setItem(FIT_GUIDE_KEY, JSON.stringify(profile));
  } catch {}
}

function estimateBaseSizeIndex(height, weight) {
  const h = Number(height || 0);
  const w = Number(weight || 0);

  if (!h || !w) return sizeIndex('M');

  if (h <= 168 && w <= 65) return sizeIndex('S');
  if (h <= 176 && w <= 78) return sizeIndex('M');
  if (h <= 186 && w <= 92) return sizeIndex('L');
  if (h <= 196 && w <= 108) return sizeIndex('XL');

  return sizeIndex('XXL');
}

function computeFitRecommendation({ height, weight, desiredFit }) {
  const availableSizes = getAvailableFitGuideSizes();

  if (!availableSizes.length) {
    return {
      size: null,
      confidence: 'baja',
      message: 'No hay tallas disponibles para esta pieza ahora mismo.'
    };
  }

  let index = estimateBaseSizeIndex(height, weight);

  const productFit = String(prod.fit || '').toLowerCase();
  const productType = String(prod.type || prod.section || '').toLowerCase();
  const desired = String(desiredFit || 'relaxed').toLowerCase();

  /*
    Ajuste por intención:
    - fitted: más cerca del cuerpo
    - relaxed: recomendación natural
    - oversized: más volumen
  */
  if (desired === 'fitted') index -= 1;
  if (desired === 'oversized') index += 1;

  /*
    Si la prenda ya es oversized, no sobredimensionamos tanto.
    El cerebro compra comodidad, pero el espejo decide si se queda.
  */
  if (productFit === 'oversized' && desired === 'oversized') {
    index -= 1;
  }

  /*
    Hoodies/sudaderas suelen pedir más margen por capa interior.
  */
  if (
    ['hoodie', 'sweatshirt'].includes(productType) ||
    ['hoodies', 'sudaderas-punto'].includes(String(prod.section || '').toLowerCase())
  ) {
    if (desired !== 'fitted') index += 1;
  }

  const size = clampSizeIndex(index, availableSizes);

  const confidence =
    availableSizes.length >= 4 ? 'alta' :
    availableSizes.length >= 2 ? 'media' :
    'baja';

  const fitCopy = {
    fitted: 'más ajustado al cuerpo',
    relaxed: 'equilibrado y cómodo',
    oversized: 'con más volumen visual'
  };

  return {
    size,
    confidence,
    message: `Recomendamos talla ${size} para un fit ${fitCopy[desired] || 'equilibrado y cómodo'}.`
  };
}

function renderFitGuidePanel() {
  const saved = readFitGuideProfile();

  const height = saved.height || '';
  const weight = saved.weight || '';
  const desiredFit = saved.desiredFit || 'relaxed';

  return `
    <div class="ad-panel-content fit-guide">
      <p class="fit-guide__intro">
        Introduce tus datos y Prophetia estimará la talla más adecuada para esta pieza.
        La recomendación se adapta al tipo de prenda, fit y tallas disponibles.
      </p>

      <form class="fit-guide__form" data-fit-guide-form>
        <div class="fit-guide__grid">
          <label>
            <span>Altura</span>
            <input
              type="number"
              name="height"
              min="130"
              max="230"
              step="1"
              inputmode="numeric"
              placeholder="Ej. 180"
              value="${escapeHtml(height)}"
              required
            >
            <small>cm</small>
          </label>

          <label>
            <span>Peso</span>
            <input
              type="number"
              name="weight"
              min="35"
              max="180"
              step="1"
              inputmode="numeric"
              placeholder="Ej. 78"
              value="${escapeHtml(weight)}"
              required
            >
            <small>kg</small>
          </label>
        </div>

        <label>
          <span>Cómo quieres que quede</span>
          <select name="desiredFit">
            <option value="fitted" ${desiredFit === 'fitted' ? 'selected' : ''}>Más ajustada</option>
            <option value="relaxed" ${desiredFit === 'relaxed' ? 'selected' : ''}>Cómoda / equilibrada</option>
            <option value="oversized" ${desiredFit === 'oversized' ? 'selected' : ''}>Oversized</option>
          </select>
        </label>

        <button type="submit" class="fit-guide__submit">
          Calcular talla
        </button>
      </form>

      <div class="fit-guide__result" data-fit-guide-result hidden></div>

      <p class="fit-guide__note">
        Recomendación orientativa. Si dudas entre dos tallas, elige la superior para más caída
        y la inferior para un ajuste más limpio.
      </p>
    </div>
  `;
}

function renderFitGuideResult(result) {
  const box = document.querySelector('[data-fit-guide-result]');
  if (!box) return;

  if (!result?.size) {
    box.hidden = false;
    box.innerHTML = `
      <p class="fit-guide__resultKicker">FIT GUIDE</p>
      <h4>Sin talla disponible</h4>
      <p>${escapeHtml(result?.message || 'No se ha podido calcular una talla disponible.')}</p>
    `;
    return;
  }

  box.hidden = false;
  box.innerHTML = `
    <p class="fit-guide__resultKicker">RECOMENDACIÓN</p>

    <h4>Talla ${escapeHtml(result.size)}</h4>

    <p>${escapeHtml(result.message)}</p>

    <div class="fit-guide__resultMeta">
      <span>Confianza: ${escapeHtml(result.confidence)}</span>
      <span>Fit de la pieza: ${escapeHtml(prod.fit || 'regular')}</span>
    </div>

    <button type="button" class="fit-guide__select" data-fit-select-size="${escapeHtml(result.size)}">
      Usar talla ${escapeHtml(result.size)}
    </button>
  `;
}
function syncAttrUI(){
  const activeVersion = getActiveVersion();

  document.getElementById('pdpColorVal').textContent = state.color ? state.color : 'Seleccionar';
  document.getElementById('pdpSizeVal').textContent  = state.size  ? state.size  : 'Seleccionar';
  document.getElementById('pdpVersionVal').textContent = activeVersion ? activeVersion.label : 'Seleccionar';
}


// Delegación clicks dentro del drawer (color/size)
drawer.addEventListener('click', (e)=>{
  const cbtn = e.target.closest('[data-pick-color]');
  const sbtn = e.target.closest('[data-pick-size]');
  const vbtn = e.target.closest('[data-pick-version]');
  const fitSizeBtn = e.target.closest('[data-fit-select-size]');
  if (fitSizeBtn) {
  e.preventDefault();

  const recommendedSize = String(fitSizeBtn.dataset.fitSelectSize || '').trim();

  if (!recommendedSize) return;

  if (!state.color && colors[0]) {
    state.color = colors[0];
  }

  state.size = recommendedSize;

  syncAttrUI();
  saveSel();
  syncCTA();
  closeDrawer();

  return;
}
if (cbtn){
  const pickedColor = String(cbtn.dataset.pickColor || '').trim();
  const targetId    = String(cbtn.dataset.targetId || prod.id).trim();

  // 1) Siempre cerramos el drawer al elegir color
  closeDrawer();

  // 2) Si el color pertenece a OTRO producto -> redirigir a ese producto
  if (targetId && targetId !== prod.id) {
    const g = (params.get('g') || params.get('gender') || localStorage.getItem('pp_gender') || 'hombre');
    // Pasamos el color por query para que la PDP nueva lo “restaure”
    window.location.assign(`producto?id=${encodeURIComponent(targetId)}&g=${encodeURIComponent(g)}&color=${encodeURIComponent(pickedColor)}`);
    return;
  }

  // 3) Si es el mismo producto: seleccionar color y reset talla
  state.color = pickedColor;
  state.size = null;
  syncAttrUI();
  saveSel();
  syncCTA();

  // (opcional) cambia primera imagen según color (variants)
  const first = imgOfColor(state.color);
  if (first){
    const img = heroEl.querySelector('img');
    if (img) img.src = first;
  }

  return;
}
if (vbtn){
  const pickedVersion = String(vbtn.dataset.pickVersion || '').trim();
  const versionData = availableVersions.find(v => v.id === pickedVersion);
  if (!versionData) return;

  state.version = versionData.id;
  syncAttrUI();
  saveSel();
  closeDrawer();

  const versionImages = dedupe(
    (versionData.images && versionData.images.length)
      ? versionData.images
      : [versionData.cover || FALLBACK_IMG]
  );

  setGallery(versionImages.length ? versionImages : [FALLBACK_IMG]);
  Z.images = versionImages.length ? versionImages : [FALLBACK_IMG];

  syncCTA();
  return;
}

if (sbtn){
  if (sbtn.disabled) return;

  state.size = sbtn.dataset.pickSize;
  syncAttrUI();
  saveSel();
  closeDrawer();

  // Si el CTA fue el que inició la selección, entonces sí añadimos
  if (state._intentAddToCart) {
    state._intentAddToCart = false; // consumimos la intención

    // aseguramos color por defecto si no hay
    if (!state.color && colors[0]) state.color = colors[0];

    const v = variants.find(x => x.color === state.color && x.size === state.size);
    const sku = v?.sku || `${prod.id}_${state.color}_${state.size}`.replace(/\s+/g,'-');

 const activeVersion = getActiveVersion();

const product = {
  id: prod.id,
  sku,
  title: prod.title,
  version: activeVersion?.id || null,
  versionLabel: activeVersion?.label || null,
  price: activeVersion?.price ?? prod.price,
  color: state.color,
  size: state.size,
  qty: 1,
  img: imgOfColor(state.color)
};

addProductToCart(product);
  }

  return;
}

});

drawer.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-fit-guide-form]');
  if (!form) return;

  e.preventDefault();

  const data = new FormData(form);

  const profile = {
    height: Number(data.get('height') || 0),
    weight: Number(data.get('weight') || 0),
    desiredFit: String(data.get('desiredFit') || 'relaxed')
  };

  saveFitGuideProfile(profile);

  const result = computeFitRecommendation(profile);
  renderFitGuideResult(result);
});

const DETAILS_TABS = [
  { id: 'details',   label: 'Todos los detalles' },
  { id: 'pack',      label: 'Empaquetado' },
  { id: 'materials', label: 'Materiales y cuidado' },
  { id: 'shipping',  label: 'Envíos y devoluciones' }
];

function getProdDetailsData(){
  // Soporta catálogo “rico” si existe, y fallback si no.
  const bullets =
    Array.isArray(prod.details) ? prod.details :
    Array.isArray(prod.bullets) ? prod.bullets :
    [];

const materialsMain = prod.materialsMain || '';
const materialsSections = Array.isArray(prod.materialsSections) ? prod.materialsSections : [];

const materials =
  prod.materialsText || prod.materials || ''; // fallback si no hay secciones


  const pack =
    prod.packagingText || prod.packaging || 'Empaquetado editorial Prophetia.';

  const shipping =
    prod.shippingText || prod.returns || 'Envíos y devoluciones según condiciones de la tienda.';

  const specsObj = prod.specs && typeof prod.specs === 'object' ? prod.specs : {
    Color: prod.color || (Array.isArray(prod.colors) ? prod.colors[0] : '') || '—',
    'Material principal': prod.material || prod.mainMaterial || '—',
    Peso: prod.weight || '—',
    'Fabricado en': prod.madeIn || prod.origin || '—'
  };

  const desc =
    prod.long || prod.description || prod.short || '';

return { desc, bullets, materials, materialsMain, materialsSections, pack, shipping, specsObj };
}

function renderSpecs(specsObj){
  const rows = Object.entries(specsObj || {}).filter(([k,v]) => String(v || '').trim());
  if (!rows.length) return '';
  return `
    <div class="ad-specs">
      ${rows.map(([k,v]) => `
        <div class="k">${k}</div>
        <div class="v">${v}</div>
      `).join('')}
    </div>
  `;
}

function renderDetailsPanel(tabId){
  const d = getProdDetailsData();

  if (tabId === 'materials'){
  const hasSections = Array.isArray(d.materialsSections) && d.materialsSections.length;

  return `
    <div class="ad-panel-content">
      ${d.materialsMain ? `
        <div class="ad-kv">
          <div class="k">Material principal</div>
          <div class="v">${d.materialsMain}</div>
        </div>
      ` : ''}

      ${hasSections ? `
        <div class="ad-sections">
          ${d.materialsSections.map(s => `
            <section class="ad-section">
              <h4 class="ad-h4">${s.title || ''}</h4>
              <p>${s.text || ''}</p>
            </section>
          `).join('')}
        </div>
      ` : (d.materials ? `<p>${d.materials}</p>` : '')}
    </div>
  `;
}

  if (tabId === 'pack'){
    return `
      <div class="ad-panel-content">
        <p>${d.pack}</p>
      </div>
    `;
  }

  if (tabId === 'shipping'){
    return `
      <div class="ad-panel-content">
        <p>${d.shipping}</p>
      </div>
    `;
  }

  // default: details
  return `
    <div class="ad-panel-content">
      ${d.desc ? `<p>${d.desc}</p>` : ''}
      ${d.bullets?.length ? `
        <ul style="margin:14px 0 0; padding-left: 18px;">
          ${d.bullets.map(x => `<li>${x}</li>`).join('')}
        </ul>
      ` : ''}
      ${renderSpecs(d.specsObj)}
    </div>
  `;
}

function renderDetailsTabs(activeId){
  return `
    <ol class="ad-tabs__list" role="tablist">
      ${DETAILS_TABS.map(t => `
        <li role="presentation">
          <button
            type="button"
            class="ad-tab"
            role="tab"
            data-details-tab="${t.id}"
            aria-selected="${t.id === activeId ? 'true' : 'false'}"
          >${t.label}</button>
        </li>
      `).join('')}
    </ol>
  `;
}
// Tabs detalles: bind UNA sola vez
adTabs?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-details-tab]');
  if (!b) return;

  const tabId = b.getAttribute('data-details-tab');

  adTabs.querySelectorAll('.ad-tab').forEach(x => {
    x.setAttribute('aria-selected', x === b ? 'true' : 'false');
  });

  // Mantener la cabecera + refrescar panel
  const head = adBody.querySelector('.ad-producthead');
  const panel = renderDetailsPanel(tabId);

  adBody.innerHTML = (head ? head.outerHTML : '') + panel;
});

function openDetailsDrawer(initialTab = 'details'){
  drawer.classList.add('ad--details');

  const colorTxt = state.color || prod.color || (Array.isArray(prod.colors) ? prod.colors[0] : '') || '';
  const activeVersion = getActiveVersion();
  const imgSrc = imgOfColor(colorTxt) || baseImages[0];
  const shownPrice = (typeof activeVersion?.price === 'number') ? activeVersion.price : prod.price;

  adTitle.textContent = prod.title || 'Producto';

  adTabs.hidden = false;
  adTabs.innerHTML = renderDetailsTabs(initialTab);

  adBody.innerHTML = `
    <div class="ad-producthead">
      <div class="ad-producthead__img">
        <img src="${imgSrc}" alt="" loading="lazy" decoding="async">
      </div>
      <div class="ad-producthead__meta">
        <div class="ad-producthead__name">${prod.title || ''}</div>
        ${activeVersion ? `<div class="ad-producthead__sub">Versión: ${activeVersion.label}</div>` : ''}
        ${colorTxt ? `<div class="ad-producthead__sub">Color: ${colorTxt}</div>` : ''}
        <div class="ad-producthead__price">${(typeof shownPrice === 'number') ? money(shownPrice) : '—'}</div>
      </div>
    </div>
    ${renderDetailsPanel(initialTab)}
  `;

  drawer.classList.add('open', 'is-open');
  drawer.setAttribute('aria-hidden','false');
  document.body.classList.add('drawer-open');
}



// Botones de la ficha
sizeBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  e.stopPropagation();
  if (!state.color && colors[0]) state.color = colors[0];
  openDrawer('Talla', renderSizePanel());
});

colorBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  e.stopPropagation();
  openDrawer('Color', renderColorPanel());
});

versionBtn?.addEventListener('click', (e)=>{
  e.preventDefault();
  e.stopPropagation();
  openDrawer('Versión', renderVersionPanel());
});

// Details/Shipping siguen abriendo el drawer (con close funcionando)
detailsBtn.addEventListener('click', ()=> openDetailsDrawer('details'));
shippingBtn?.addEventListener('click', ()=> openDetailsDrawer('shipping'));

function openFitGuideDrawer(e) {
  e?.preventDefault();
  e?.stopPropagation();

  openDrawer('Guía inteligente de talla', renderFitGuidePanel());
}

fitGuideAttrBtn?.addEventListener('click', openFitGuideDrawer);
fitGuideLinkBtn?.addEventListener('click', openFitGuideDrawer);

const buyForm = document.getElementById('buyForm');
const ctaBtn  = document.getElementById('pdpCta') || document.getElementById('pdpcta');
// 🔒 Blindaje: nunca refrescar por submit accidental
buyForm?.addEventListener('submit', (e) => e.preventDefault(), true);

// 🔒 Blindaje: el CTA se maneja por click (no por submit)
ctaBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (!state.color && colors[0]) state.color = colors[0];

  if (availableVersions.length && !state.version) {
    state._intentAddToCart = true;
    openDrawer('Versión', renderVersionPanel());
    syncCTA();
    return;
  }

  if (!state.size) {
    state._intentAddToCart = true;
    openDrawer('Talla', renderSizePanel());
    syncCTA();
    return;
  }

  if (!state.color) {
    state._intentAddToCart = true;
    openDrawer('Color', renderColorPanel());
    syncCTA();
    return;
  }

  const v = variants.find(x => x.color === state.color && x.size === state.size);
  const activeVersion = getActiveVersion();

  const sku =
    activeVersion
      ? `${prod.id}_${activeVersion.id}_${state.color}_${state.size}`.replace(/\s+/g,'-')
      : (v?.sku || `${prod.id}_${state.color}_${state.size}`.replace(/\s+/g,'-'));

addProductToCart({
  id: prod.id,
  sku,
  title: prod.title,
  version: activeVersion?.id || null,
  versionLabel: activeVersion?.label || null,
  price: activeVersion?.price ?? prod.price,
  color: state.color,
  size: state.size,
  qty: 1,
  img: imgOfColor(state.color)
});
});


// (si quieres) deja el primer syncAttrUI aquí o más abajo, pero ya con ctaBtn definido
syncAttrUI();

// Ajusta imagen según color restaurado (opcional)
if (state.color) {
  const first = imgOfColor(state.color);
  const img = heroEl.querySelector('img');
  if (img && first) img.src = first;
}


const ctaLabelEl = ctaBtn?.querySelector('.pdp-cta__label');
const ctaPriceEl = document.getElementById('pdpCtaPrice');



function setCTA({ enabled, label, hint }){
  if (!ctaBtn) return;

  if (ctaLabelEl) ctaLabelEl.textContent = label;
  else ctaBtn.textContent = label; // fallback

const activeVersion = getActiveVersion();
if (ctaPriceEl) ctaPriceEl.textContent = money(activeVersion?.price ?? prod.price);
  // siempre clicable, pero estilo/semántica “bloqueado”
  ctaBtn.disabled = false;
  ctaBtn.setAttribute('aria-disabled', String(!enabled));
  ctaBtn.classList.toggle('is-disabled', !enabled);

  if (hint) ctaBtn.setAttribute('data-hint', hint);
  else ctaBtn.removeAttribute('data-hint');
}
function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function computeCTALabel(){
  if (availableVersions.length && !state.version) {
    return { enabled:false, label:'Seleccionar versión', hint:'Selecciona una versión para continuar' };
  }
  if (!state.size)  return { enabled:false, label:'Seleccionar talla', hint:'Selecciona una talla para continuar' };
  if (!state.color) return { enabled:false, label:'Seleccionar color', hint:'Selecciona un color para continuar' };
  return { enabled:true,  label:'Añadir a la cesta', hint:'' };
}



function syncCTA(){
  setCTA(computeCTALabel());
}

// Submit = si está bloqueado, abrir selector; si está listo, añadir a carrito
buyForm?.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!state.color && colors[0]) state.color = colors[0];

  if (availableVersions.length && !state.version){
    openDrawer('Versión', renderVersionPanel());
    syncCTA();
    return;
  }

  if (!state.size){
    openDrawer('Talla', renderSizePanel());
    syncCTA();
    return;
  }

  const v = variants.find(x => x.color === state.color && x.size === state.size);
  const activeVersion = getActiveVersion();

  const sku =
    activeVersion
      ? `${prod.id}_${activeVersion.id}_${state.color}_${state.size}`.replace(/\s+/g,'-')
      : (v?.sku || `${prod.id}_${state.color}_${state.size}`.replace(/\s+/g,'-'));

  const product = {
    id: prod.id,
    sku,
    title: prod.title,
    version: activeVersion?.id || null,
    versionLabel: activeVersion?.label || null,
    price: activeVersion?.price ?? prod.price,
    color: state.color,
    size: state.size,
    qty: 1,
    img: imgOfColor(state.color)
  };

  window.ppAddToCart?.(product);
});

// Inicial
syncCTA();


    })();
  });

document.addEventListener('DOMContentLoaded', () => {
    (async function initPDP() {
      await window.ppStorefront?.ready;
      const $ = (s, r = document) => r.querySelector(s);
      const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const pdpMobileQuery = window.matchMedia('(max-width: 820px)');
const pdpReducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const PDP_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

function getPdpFocusable(container) {
  if (!(container instanceof HTMLElement)) return [];

  return $$(PDP_FOCUSABLE_SELECTOR, container).filter((element) => {
    return (
      element instanceof HTMLElement &&
      !element.hidden &&
      !element.closest('[hidden]') &&
      !element.closest('[inert]') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.getClientRects().length > 0
    );
  });
}

function focusPdpMobileLayer(container, preferredSelector = '') {
  if (!(container instanceof HTMLElement)) return;

  window.requestAnimationFrame(() => {
    if (
      !container.isConnected ||
      container.hidden ||
      container.classList.contains('hidden') ||
      container.inert ||
      container.getAttribute('aria-hidden') === 'true'
    ) return;

    const preferred = preferredSelector
      ? container.querySelector(preferredSelector)
      : null;
    const target = preferred instanceof HTMLElement
      ? preferred
      : getPdpFocusable(container)[0];

    target?.focus({ preventScroll: true });
  });
}

function trapPdpMobileFocus(event, container) {
  if (event.key !== 'Tab') return false;

  const focusable = getPdpFocusable(container);
  if (!focusable.length) return false;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (!container.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus({ preventScroll: true });
    return true;
  }

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus({ preventScroll: true });
    return true;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return true;
  }

  return false;
}

function restorePdpMobileFocus(target, { defer = true } = {}) {
  if (!(target instanceof HTMLElement)) return;

  const restore = () => {
    if (
      target.isConnected &&
      !target.hidden &&
      !target.closest('[hidden]') &&
      target.getClientRects().length > 0
    ) {
      target.focus({ preventScroll: true });
    }
  };

  if (defer) window.requestAnimationFrame(restore);
  else restore();
}

function setPdpDialogTriggerState(trigger, dialogId, expanded) {
  if (!(trigger instanceof HTMLElement)) return;

  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', dialogId);
  trigger.setAttribute('aria-expanded', String(Boolean(expanded)));
}

function syncPdpLayerMotion(container) {
  if (!(container instanceof HTMLElement)) return;

  container.querySelectorAll(
    '.ad-backdrop, .ad-panel, .lb-backdrop, .lb-figure, .lb-img'
  ).forEach((element) => {
    if (!(element instanceof HTMLElement)) return;

    if (pdpReducedMotionQuery.matches) {
      element.dataset.ppPdpReducedMotion = 'true';
      element.style.animationDuration = '.01ms';
      element.style.transitionDuration = '.01ms';
    } else if (element.dataset.ppPdpReducedMotion === 'true') {
      delete element.dataset.ppPdpReducedMotion;
      element.style.removeProperty('animation-duration');
      element.style.removeProperty('transition-duration');
    }
  });
}

function showPdpActionError(message, { fatal = false } = {}) {
  const purchase = document.querySelector('.pdp-purchase') || document.getElementById('pInfo');
  let status = document.getElementById('pdpActionStatus');

  if (!status && purchase) {
    status = document.createElement('p');
    status.id = 'pdpActionStatus';
    status.className = 'pdp-short';
    status.setAttribute('role', 'alert');
    status.setAttribute('aria-live', 'assertive');
    status.style.color = '#7a1f1f';
    status.style.margin = '12px 0';
    const buyForm = document.getElementById('buyForm');
    if (buyForm?.parentElement === purchase) purchase.insertBefore(status, buyForm);
    else purchase.appendChild(status);
  }

  if (status) {
    status.hidden = false;
    status.textContent = message;
  }

  const cta = document.getElementById('pdpCta') || document.getElementById('pdpcta');
  const label = cta?.querySelector('.pdp-cta__label');
  if (label) label.textContent = fatal ? 'Producto no disponible' : 'Cesta no disponible';
  if (cta) {
    cta.disabled = fatal;
    cta.setAttribute('aria-disabled', String(fatal));
    cta.classList.toggle('is-disabled', fatal);
    if (!fatal) cta.setAttribute('data-hint', 'La cesta no respondió. Vuelve a intentarlo.');
    if (status) cta.setAttribute('aria-describedby', status.id);
  }

  if (typeof window.ppToast === 'function' && document.getElementById('ppToast')) {
    window.ppToast(message, window.location.href);
  }
}

function clearPdpActionError() {
  const status = document.getElementById('pdpActionStatus');
  if (status) {
    status.hidden = true;
    status.textContent = '';
  }

  const cta = document.getElementById('pdpCta') || document.getElementById('pdpcta');
  cta?.removeAttribute('aria-describedby');
  syncCTA();
}
const sizeBtn = document.getElementById('pdpSizeBtn');
const colorBtn = document.getElementById('pdpColorBtn');
const versionBtn = document.getElementById('pdpVersionBtn');
const cutBtn = document.getElementById('pdpCutBtn');

const fitGuideAttrBtn = document.getElementById('pdpFitGuideBtn');
const fitGuideVal = document.getElementById('pdpFitGuideVal');

const shippingBtn = document.querySelector('[data-tab="shipping"]');
const detailsBtn = document.querySelector('[data-tab="details"]');
const fitGuideLinkBtn = document.querySelector('[data-tab="fit-guide"]');
      

      // 1) slug/id
      const params = new URLSearchParams(location.search);
const PRODUCT_REFERENCE_ALIASES = Object.freeze({
  'atlas-prophetia': 'atlas-seal',
  forgave: 'letter-for-self'
});
const requestedProductReference = String(params.get('slug') || params.get('id') || '').trim();
const slug = PRODUCT_REFERENCE_ALIASES[requestedProductReference.toLowerCase()] || requestedProductReference;
const urlVersion = (params.get('version') || '').trim().toLowerCase();
const urlCut = (params.get('cut') || '').trim().toLowerCase();

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

  try {
    if (typeof window.ppCart?.add === 'function') {
      const added = window.ppCart.add(safeProduct);
      if (added === null) {
        if (window.ppStorefront?.salesEnabled !== false) {
          showPdpActionError('No hemos podido añadir la pieza. Inténtalo de nuevo.');
        }
        return false;
      }
      clearPdpActionError();
      return true;
    }

    if (typeof window.ppAddToCart === 'function') {
      const added = window.ppAddToCart(safeProduct);
      if (added === null) {
        if (window.ppStorefront?.salesEnabled !== false) {
          showPdpActionError('No hemos podido añadir la pieza. Inténtalo de nuevo.');
        }
        return false;
      }
      clearPdpActionError();
      return true;
    }
  } catch (error) {
    console.error('[PDP Cart] La API oficial no pudo añadir el producto:', error);
    showPdpActionError('La cesta no está disponible ahora mismo. Inténtalo de nuevo en unos segundos.');
    return false;
  }

  console.error('[PDP Cart] La API oficial de cesta todavía no está disponible.');
  showPdpActionError('La cesta todavía se está preparando. Inténtalo de nuevo en unos segundos.');
  return false;
}
let items = [];
let prod = null;
let tribeProfile = null;

const TRIBE_RANK_ORDER = {
  'tribe-member': 0,
  'member': 0,
  'initiate': 1,
  'adeptus': 2,
  'oracle': 3,
  'archivist': 4,
  'seer': 4,
  'prophet': 5
};

function normalizeRankId(rankId = '') {
  const clean = String(rankId || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  return clean === 'seer' ? 'archivist' : clean;
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

  const localProd = slug
    ? (
        items.find(p => String(p.slug || '') === String(slug)) ||
        items.find(p => String(p.id || '') === String(slug)) ||
        null
      )
    : null;

  try {
    const { ppGetProductById, ppGetProductBySlug } = await import('/assets/js/firebase-products.js');

    const remoteProd = slug
      ? (
          await ppGetProductById(slug) ||
          await ppGetProductBySlug(slug)
        )
      : null;

    prod = remoteProd && localProd
      ? { ...remoteProd, ...localProd }
      : (remoteProd || localProd);
  } catch (firebaseErr) {
    console.warn('[PDP] Firestore no disponible. Usando catalog.json:', firebaseErr);
    prod = localProd;
  }

  if (!prod) {
    throw new Error(
      requestedProductReference
        ? `Producto no encontrado: ${requestedProductReference}`
        : 'Falta el identificador del producto'
    );
  }
  tribeProfile = await loadTribeProfileForPDP();
} catch (err) {
  console.error('[PDP] Fallo cargando producto:', err);
  showPdpActionError(
    'No hemos podido encontrar esta pieza. Vuelve al catálogo para elegir otro producto.',
    { fatal: true }
  );
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

const COLOR_META = {
  beige: { label: 'Beige', value: '#c9bba4' },
  latte: { label: 'Latte', value: '#d1a06f' },
  rosa: { label: 'Rosa', value: '#d979a7' },
  'blue-ice': { label: 'Blue Ice', value: '#dceef3' },
  'off-white': { label: 'Blanco roto', value: '#f4f1e9' },
  white: { label: 'Blanco', value: '#f7f6f2' },
  black: { label: 'Negro', value: '#151515' },
  navy: { label: 'Azul marino', value: '#1d2940' },
  grey: { label: 'Gris', value: '#8a8a86' },
  gray: { label: 'Gris', value: '#8a8a86' },
  orange: { label: 'Naranja', value: '#c96f35' },
  yellow: { label: 'Amarillo', value: '#d5b73f' },
  brown: { label: 'Marrón', value: '#665143' },
  green: { label: 'Verde', value: '#536853' }
};

function colorKey(value = '') {
  return String(value ?? '').trim().toLowerCase();
}

function colorMetaOf(color = '') {
  const key = colorKey(color);
  if (COLOR_META[key]) return COLOR_META[key];

  const label = key
    ? key.split(/[-_\s]+/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
    : 'Color';

  return {
    label,
    value: key || '#77746f'
  };
}

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

const configuredVersions = Array.isArray(prod.versions)
  ? prod.versions
  : [];

function getSingleCutFromFit(fit = '') {
  const normalizedFit = String(fit || '')
    .trim()
    .toLowerCase();

  if (normalizedFit === 'oversized' || normalizedFit === 'oversize') {
    return { id: 'oversize', label: 'Oversize', fit: 'oversized' };
  }

  if (normalizedFit === 'relaxed') {
    return { id: 'relaxed', label: 'Relajado', fit: 'relaxed' };
  }

  if (normalizedFit === 'boxy') {
    return { id: 'boxy', label: 'Boxy', fit: 'boxy' };
  }

  return { id: 'classic', label: 'Clásico', fit: normalizedFit || 'regular' };
}

const productCuts = Array.isArray(prod.cuts) && prod.cuts.length
  ? prod.cuts
  : [{
      ...getSingleCutFromFit(prod.fit),
      colors: Array.isArray(prod.colors) ? prod.colors : [],
      versions: configuredVersions.map(version => String(version?.id || '')).filter(Boolean),
      defaultVersion: configuredVersions.length === 1
        ? String(configuredVersions[0]?.id || '')
        : '',
      virtual: true
    }];

const availableCuts = productCuts.map(cut => ({
  id: String(cut.id || '').trim(),
  label: String(cut.label || cut.id || '').trim(),
  description: String(cut.description || '').trim(),
  fit: String(cut.fit || '').trim(),
  colors: Array.isArray(cut.colors) ? cut.colors.map(colorKey).filter(Boolean) : [],
  versions: Array.isArray(cut.versions) ? cut.versions.map(String) : [],
  defaultVersion: String(cut.defaultVersion || '').trim(),
  virtual: cut.virtual === true
})).filter(cut => cut.id);

const productVersions = configuredVersions.length
  ? configuredVersions
  : [{
      id: 'single',
      label: 'Única',
      price: prod.price,
      virtual: true
    }];

const availableVersions = productVersions.map(v => ({
  id: String(v.id || '').trim(),
  label: String(v.label || v.id || '').trim(),
  cut: String(v.cut || '').trim(),
  price: typeof v.price === 'number' ? v.price : prod.price,
  cover: v.cover || '',
  images: Array.isArray(v.images) ? v.images.filter(Boolean) : [],
  mediaByColor: v.mediaByColor && typeof v.mediaByColor === 'object'
    ? v.mediaByColor
    : null,
  available: v.available !== false,
  comingSoon: v.comingSoon === true,
  virtual: v.virtual === true
})).filter(v => v.id);




const thumbsEl = document.getElementById('pThumbs');
const heroEl = document.getElementById('pdpStack');

function setGallery(images) {
  const safeImages = Array.isArray(images) && images.length ? images : [FALLBACK_IMG];

  heroEl.innerHTML = safeImages.map((src, i) => `
    <button type="button" class="pdp-shot" data-i="${i}" aria-label="Ampliar imagen ${i + 1}" aria-haspopup="dialog" aria-controls="pdpZoom" aria-expanded="false">
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
let drawerReturnFocus = null;
let drawerTrigger = null;
let drawerCloseTimer = 0;
let drawerTransitionRevision = 0;

const PDP_DRAWER_TRIGGERS = [
  cutBtn,
  versionBtn,
  colorBtn,
  sizeBtn,
  detailsBtn,
  shippingBtn,
  fitGuideAttrBtn,
  fitGuideLinkBtn
].filter((trigger) => trigger instanceof HTMLElement);

PDP_DRAWER_TRIGGERS.forEach((trigger) => {
  setPdpDialogTriggerState(trigger, 'attrDrawer', false);
});

const state = {
  cut: null,
  color: null,
  size: null,
  version: null
};
const PDP_SEL_KEY = 'pp_pdp_sel_v1';

const prev = loadSel();

const selectedCutFromUrl = availableCuts.find(cut => cut.id.toLowerCase() === urlCut) || null;
const selectedCutFromHistory = availableCuts.find(cut => cut.id === prev?.cut) || null;
const defaultCut = availableCuts.find(cut => cut.id === String(prod.defaultCut || '').trim()) || null;

state.cut = selectedCutFromUrl?.id || selectedCutFromHistory?.id || defaultCut?.id || availableCuts[0]?.id || null;

const initialSelectableVersions = getSelectableVersions();
const selectedVersionFromUrl =
  initialSelectableVersions.find(v => v.id.toLowerCase() === urlVersion) || null;

const activeCutAtStart = getActiveCut();
const defaultVersionAtStart = initialSelectableVersions.find(v => v.id === activeCutAtStart?.defaultVersion) || null;

if (selectedVersionFromUrl) {
  state.version = selectedVersionFromUrl.id;
} else if (prev?.version && initialSelectableVersions.some(v => v.id === prev.version)) {
  state.version = prev.version;
} else if (defaultVersionAtStart) {
  state.version = defaultVersionAtStart.id;
} else if (initialSelectableVersions.length === 1) {
  state.version = initialSelectableVersions[0].id;
}

const initialVersion = availableVersions.find(v => v.id === state.version) || null;
const initialVersionColor = colorKey(prod.color || prod.colors?.[0] || '');
const initialVersionGenderImages = imagesFromMediaBucket(
  mediaBucketOfColor(initialVersion?.mediaByColor, initialVersionColor)
);
const initialVersionImages = initialVersionGenderImages.length
  ? initialVersionGenderImages
  : initialVersion
    ? dedupe([
        ...(Array.isArray(initialVersion.images) ? initialVersion.images : []),
        initialVersion.cover
      ])
    : [];

let baseImages = initialVersionImages.length
  ? initialVersionImages
  : dedupe(
      Array.isArray(media?.images) && media.images.length
        ? media.images
        : (typeof media?.cover === 'string' && media.cover)
          ? [media.cover]
          : []
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
let zoomReturnFocus = null;
let zoomTrigger = null;
let zoomBodyHadModalOpen = false;
Z.el.setAttribute('aria-label', `Vista ampliada de ${prod.title || 'producto'}`);
Z.el.inert = true;

function zoomPaint(idx) {
  Z.i = idx;
  Z.img.src = Z.images[idx] || Z.images[0] || FALLBACK_IMG;
 Z.thumbs.innerHTML = Z.images.map((src, i) =>
  `<li class="${i === idx ? 'is-active' : ''}" data-i="${i}"><img src="${src}" alt="${prod.title || 'Producto'} — zoom ${i + 1}"></li>`
).join('');
}

zoomPaint(0);

function zoomOpen(idx, trigger = null) {
  zoomTrigger = trigger instanceof HTMLElement ? trigger : null;
  setPdpDialogTriggerState(zoomTrigger, 'pdpZoom', true);

  if (Z.el.classList.contains('hidden')) {
    zoomReturnFocus = zoomTrigger
      ? zoomTrigger
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    zoomBodyHadModalOpen = document.body.classList.contains('modal-open');
  }
  Z.el.setAttribute('aria-modal', 'true');

  zoomPaint(idx);
  syncPdpLayerMotion(Z.el);
  Z.el.classList.remove('hidden');
  Z.el.inert = false;
  Z.el.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  Z.el.classList.toggle('zoom-in', !pdpReducedMotionQuery.matches);
  resetZoom();
  focusPdpMobileLayer(Z.el, '#pdpZoomClose');
}

function zoomClose() {
  const returnFocus = zoomReturnFocus;
  setPdpDialogTriggerState(zoomTrigger, 'pdpZoom', false);
  Z.el.classList.add('hidden');
  Z.el.inert = true;
  Z.el.setAttribute('aria-hidden', 'true');
  Z.el.removeAttribute('aria-modal');
  Z.el.classList.remove('zoom-in');
  Z.el.classList.remove('zoomed');
  resetZoom();
  zoomReturnFocus = null;
  zoomTrigger = null;
  if (
    !zoomBodyHadModalOpen &&
    (!pdpStockModal || pdpStockModal.hidden) &&
    !document.querySelector('#ppAuthModal[open], #ppAccountPanel[open], .archive-version-modal.is-open')
  ) {
    document.body.classList.remove('modal-open');
  }
  zoomBodyHadModalOpen = false;
  restorePdpMobileFocus(returnFocus);
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
  zoomOpen(+shot.dataset.i, shot);
});

thumbsEl.addEventListener('click', (e) => {
  const b = e.target.closest('.pdp-rail__btn[data-i]');
  if (!b) return;
  const i = +b.dataset.i;
  const target = heroEl.querySelector(`.pdp-shot[data-i="${i}"]`);
  target?.scrollIntoView({
    behavior: pdpReducedMotionQuery.matches ? 'auto' : 'smooth',
    block: 'start'
  });
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
  if (Z.el.classList.contains('hidden')) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    zoomClose();
    return;
  }

  if (e.key === 'Tab') {
    trapPdpMobileFocus(e, Z.el);
    e.stopPropagation();
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
      cut: state.cut,
      color: state.color,
      size: state.size,
      version: state.version,
      ts: Date.now()
    };
    localStorage.setItem(PDP_SEL_KEY, JSON.stringify(all));
  } catch {}
}

function activateDrawer(trigger = null) {
  const wasClosing = drawer.classList.contains('closing');
  const wasOpen = drawer.classList.contains('open') && !wasClosing;
  drawerTransitionRevision += 1;
  window.clearTimeout(drawerCloseTimer);
  drawerCloseTimer = 0;
  if (!wasOpen && !wasClosing) {
    const active = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    drawerTrigger = trigger instanceof HTMLElement
      ? trigger
      : active && active !== document.body && active !== document.documentElement
        ? active
        : null;
    drawerReturnFocus = drawerTrigger || active;
  } else if (wasClosing && trigger instanceof HTMLElement) {
    drawerTrigger = trigger;
    drawerReturnFocus = trigger;
  }
  setPdpDialogTriggerState(drawerTrigger, 'attrDrawer', true);

  syncPdpLayerMotion(drawer);
  drawer.classList.remove('closing');
  drawer.inert = false;
  drawer.classList.add('open', 'is-open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
  focusPdpMobileLayer(drawer, '.ad-close');
}

function openDrawer(title, html, trigger = null){
  drawer.classList.remove('ad--details', 'ad--fit-guide');
if (adTabs){
  adTabs.hidden = true;
  adTabs.innerHTML = '';
}

  adTitle.textContent = title;
  adBody.innerHTML = html;
  drawer.classList.toggle('ad--fit-guide', String(html || '').includes('fit-guide--flow') || String(html || '').includes('fit-guide--v2'));

  // Compatible con CSS que use .open o .is-open.
  activateDrawer(trigger);
}

function closeDrawer({ restoreFocus = true, deferFocus = true } = {}){
  const returnFocus = drawerReturnFocus;
  const closingTrigger = drawerTrigger;
  const wasOpen = drawer.classList.contains('open') || drawer.classList.contains('is-open');
  if (drawer.classList.contains('closing')) return returnFocus;

  const revision = ++drawerTransitionRevision;
  window.clearTimeout(drawerCloseTimer);
  drawerCloseTimer = 0;
  if (wasOpen && drawer.contains(document.activeElement)) {
    document.activeElement?.blur?.();
  }
  drawer.classList.remove('is-open');
  drawer.classList.add('closing');
  drawer.setAttribute('aria-hidden','true');
  drawer.inert = true;

  setPdpDialogTriggerState(closingTrigger, 'attrDrawer', false);
  if (closingTrigger && !PDP_DRAWER_TRIGGERS.includes(closingTrigger)) {
    closingTrigger.removeAttribute('aria-haspopup');
    closingTrigger.removeAttribute('aria-controls');
    closingTrigger.removeAttribute('aria-expanded');
  }
  const finalize = () => {
    if (revision !== drawerTransitionRevision) return;
    drawerCloseTimer = 0;
    if (!drawer.classList.contains('closing')) return;
    drawer.classList.remove('open', 'closing', 'ad--details', 'ad--fit-guide');
    if (adTabs){
      adTabs.hidden = true;
      adTabs.innerHTML = '';
    }
    document.body.classList.remove('drawer-open');
    if (restoreFocus) restorePdpMobileFocus(returnFocus, { defer: deferFocus });
    drawerTrigger = null;
    drawerReturnFocus = null;
  };
  if (wasOpen && !pdpReducedMotionQuery.matches) {
    drawerCloseTimer = window.setTimeout(finalize, 200);
  } else {
    finalize();
  }
  return returnFocus;
}

function closeDrawerBeforeNextLayer() {
  const returnFocus = closeDrawer({ restoreFocus: false });
  restorePdpMobileFocus(returnFocus, { defer: false });
  return returnFocus;
}

function syncPdpOpenLayersForViewport(event) {
  const drawerOpen = drawer.classList.contains('open');
  const zoomOpenNow = !Z.el.classList.contains('hidden');

  if (!event.matches) return;

  const active = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  if (drawerOpen) {
    drawerReturnFocus = drawerReturnFocus || drawerTrigger || (
      active && !drawer.contains(active) ? active : null
    );
    focusPdpMobileLayer(drawer, '.ad-close');
  }

  if (zoomOpenNow) {
    zoomReturnFocus = zoomReturnFocus || zoomTrigger || (
      active && !Z.el.contains(active) ? active : null
    );
    Z.el.setAttribute('aria-modal', 'true');
    focusPdpMobileLayer(Z.el, '#pdpZoomClose');
  }
}

if (typeof pdpMobileQuery.addEventListener === 'function') {
  pdpMobileQuery.addEventListener('change', syncPdpOpenLayersForViewport);
} else {
  pdpMobileQuery.addListener(syncPdpOpenLayersForViewport);
}



drawer.querySelectorAll('[data-ad-close]').forEach(el=>{
  el.addEventListener('click', (e)=>{ e.preventDefault(); closeDrawer(); });
});

// Cerrar: ESC
document.addEventListener('keydown', (e)=>{
  if (!drawer.classList.contains('open') || drawer.classList.contains('closing')) return;
  if (
    !Z.el.classList.contains('hidden') ||
    document.body.classList.contains('pp-cart-open') ||
    document.querySelector('.pdp-stock-modal:not([hidden])')
  ) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    closeDrawer();
    return;
  }

  if (trapPdpMobileFocus(e, drawer)) e.stopPropagation();
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

const PDP_STOCK_NOTIFY_ENDPOINT = '/api/reservations/notify';
// =====================
// HELPERS que faltaban (si no existen, el script revienta y no abre drawers)
// =====================

// Devuelve una imagen representativa para un color
function getActiveCut(){
  return availableCuts.find(cut => cut.id === state.cut) || null;
}

function getVersionOptionsForActiveCut(){
  const activeCut = getActiveCut();

  if (!activeCut) return availableVersions;

  const scoped = availableVersions.filter(version =>
    !version.cut || version.cut === activeCut.id || activeCut.versions.includes(version.id)
  );

  return scoped.length ? scoped : availableVersions;
}

function getSelectableVersions(){
  return getVersionOptionsForActiveCut().filter(version => version.available !== false);
}

function getActiveVersion(){
  return availableVersions.find(v => v.id === state.version) || null;
}

function getSelectionSku(color = state.color, size = state.size){
  const selectedColor = String(color || '').trim();
  const selectedSize = String(size || '').trim();
  const activeCut = getActiveCut();
  const activeVersion = getActiveVersion();
  const variant = getActiveVariants().find((item) => {
    return item.color === selectedColor && item.size === selectedSize;
  });

  // El SKU del catálogo es la referencia autoritativa de stock. Las versiones
  // editoriales se validan por separado y no forman parte del SKU de variante.
  if (variant?.sku) {
    return variant.sku;
  }

  if (activeVersion && activeVersion.virtual !== true) {
    return `${prod.id}_${activeCut?.id || 'default'}_${activeVersion.id}_${selectedColor}_${selectedSize}`
      .replace(/\s+/g, '-');
  }

  return `${prod.id}_${selectedColor}_${selectedSize}`.replace(/\s+/g, '-');
}

function getActiveVariants(){
  if (!state.cut) return variants;

  return variants.filter(variant => {
    const variantCut = String(variant?.cut || '').trim();
    return !variantCut || variantCut === state.cut;
  });
}

function imagesFromMediaBucket(bucket) {
  if (!bucket || typeof bucket !== 'object') return [];

  return dedupe([
    bucket.cover,
    ...(Array.isArray(bucket.images) ? bucket.images : [])
  ]);
}

function mediaBucketOfColor(mediaByColor, key) {
  if (!mediaByColor || typeof mediaByColor !== 'object' || !key) return null;

  const genderMap = mediaByColor[prefGender] || mediaByColor.hombre || mediaByColor.mujer || null;
  return (genderMap && genderMap[key]) || mediaByColor[key] || null;
}

function imagesOfColor(color) {
  const key = colorKey(color);
  if (!key) return [];

  const currentVersion = getActiveVersion();
  const versionImages = imagesFromMediaBucket(
    mediaBucketOfColor(currentVersion?.mediaByColor, key)
  );

  if (versionImages.length) return versionImages;

  const productImages = imagesFromMediaBucket(
    mediaBucketOfColor(prod.mediaByColor, key)
  );

  return productImages;
}

function applyColorGallery(color) {
  const colorImages = imagesOfColor(color);

  if (colorImages.length) {
    setGallery(colorImages);
    Z.images = colorImages;
    zoomPaint(0);
    return;
  }

  const first = imgOfColor(color);
  const img = heroEl.querySelector('img');
  if (img && first) img.src = first;
}

function imgOfColor(color){
  const colorImages = imagesOfColor(color);
  if (colorImages.length) return colorImages[0];

  const currentVersion = getActiveVersion();
  if (currentVersion) {
    return currentVersion.cover || currentVersion.images?.[0] || FALLBACK_IMG;
  }

  const v = getActiveVariants().find(x => String(x.color) === String(color));
  if (v?.img) return v.img;

  const pref = (params.get('g') || params.get('gender') || localStorage.getItem('pp_gender') || 'hombre').toLowerCase();
  const m = (prod.media && (prod.media[pref] || prod.media.hombre || prod.media.mujer)) || null;

  return (m && (m.cover || (Array.isArray(m.images) && m.images[0]))) || baseImages[0] || FALLBACK_IMG;
}

// Devuelve tallas disponibles para un color
function sizesForColor(color){
  return uniq(
    getActiveVariants()
      .filter(v => String(v.color) === String(color))
      .map(v => v.size)
  );
}

// Devuelve stock para combinación color+talla
function stockOf(color, size){
  const v = getActiveVariants().find(x => String(x.color) === String(color) && String(x.size) === String(size));
  const st = (v && typeof v.stock === 'number') ? v.stock : fallbackStock;
  return +st || 0;
}

let pdpStockModal = null;
let pdpStockOptions = [];
let pdpPreferredStockSku = '';
let pdpStockReturnFocus = null;
let pdpStockBodyHadModalOpen = false;

function normalizeText(value = '') {
  return String(value ?? '').trim();
}

function normalizeEmail(value = '') {
  return normalizeText(value).toLowerCase();
}

function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeText(value));
}

function docSegment(value = '') {
  return normalizeText(value)
    .replace(/[\/\\#?\[\]]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 150) || 'unknown';
}

function totalProductStock() {
  if (realVariants.length) {
    return getActiveVariants().reduce((total, variant) => {
      return total + Math.max(0, Number(variant?.stock) || 0);
    }, 0);
  }

  return prod.inStock === false ? 0 : fallbackStock;
}

function isProductOutOfStock() {
  return totalProductStock() <= 0;
}

function getPdpUser() {
  return (
    window.__ppFirebaseAuth?.currentUser ||
    window.__ppAuthCurrentUser ||
    window.__ppLastUser ||
    null
  );
}

async function getPdpAuthHeaders() {
  const user = getPdpUser();

  if (!user || typeof user.getIdToken !== 'function') {
    return {};
  }

  try {
    const token = await user.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function getPdpProductUrl() {
  return `${location.pathname}${location.search}${location.hash}`;
}

function getPdpStockOptions() {
  const activeVariants = getActiveVariants();
  const source = window.ppStorefront?.salesEnabled === false
    ? activeVariants
    : activeVariants.filter((variant) => {
        return Math.max(0, Number(variant?.stock) || 0) <= 0;
      });
  const productId = normalizeText(prod.id || prod.slug || 'producto');

  if (!activeVariants.length) {
    return [{
      sku: productId,
      label: 'Producto Prophetia',
      image: imgOfColor(state.color || prod.color || colors[0]) || baseImages[0] || FALLBACK_IMG
    }];
  }

  return source.map((variant, index) => {
    const label = [
      normalizeText(getActiveCut()?.label || variant?.cut),
      normalizeText(colorMetaOf(variant?.color).label),
      normalizeText(variant?.size)
    ].filter(Boolean).join(' · ');

    return {
      sku: normalizeText(variant?.sku || `${productId}_${index + 1}`),
      label: label || normalizeText(variant?.sku) || `Variante ${index + 1}`,
      image: variant?.img || variant?.image || imgOfColor(variant?.color || state.color || colors[0]) || baseImages[0] || FALLBACK_IMG,
      color: normalizeText(variant?.color),
      size: normalizeText(variant?.size)
    };
  });
}

function getPreferredStockOptionIndex(options = [], preferred = {}) {
  const preferredSku = normalizeText(preferred.sku || pdpPreferredStockSku);
  const color = normalizeText(preferred.color || state.color);
  const size = normalizeText(preferred.size || state.size);

  if (preferredSku) {
    const skuIndex = options.findIndex((option) => option.sku === preferredSku);
    if (skuIndex >= 0) return skuIndex;
  }

  if (!color && !size) return 0;

  const index = options.findIndex((option) => {
    return (
      (!color || normalizeText(option.color).toLowerCase() === color.toLowerCase()) &&
      (!size || normalizeText(option.size).toLowerCase() === size.toLowerCase())
    );
  });

  return index >= 0 ? index : 0;
}

function ensurePdpStockModal() {
  if (pdpStockModal) return pdpStockModal;

  pdpStockModal = document.createElement('div');
  pdpStockModal.className = 'pdp-stock-modal';
  pdpStockModal.hidden = true;
  pdpStockModal.inert = true;
  pdpStockModal.setAttribute('aria-hidden', 'true');
  pdpStockModal.innerHTML = `
    <div class="pdp-stock-modal__card" role="dialog" aria-modal="true" aria-labelledby="pdpStockModalTitle">
      <button class="pdp-stock-modal__close" type="button" data-pdp-stock-close aria-label="Cerrar">×</button>
      <p class="pdp-stock-modal__kicker">Producto agotado</p>
      <h2 id="pdpStockModalTitle" class="pdp-stock-modal__title">Informarme cuando esté disponible</h2>
      <p class="pdp-stock-modal__copy" data-pdp-stock-copy></p>
      <form class="pdp-stock-modal__form" data-pdp-stock-form>
        <label class="pdp-stock-modal__field" data-pdp-stock-sku-field>
          <span>Variante</span>
          <select data-pdp-stock-sku></select>
        </label>
          <label class="pdp-stock-modal__field">
            <span>Correo electrónico</span>
            <input type="email" autocomplete="email" inputmode="email" data-pdp-stock-email required>
          </label>
          <small class="pdp-stock-modal__privacy">
            Usaremos tu correo únicamente para este aviso. Consulta nuestra
            <a href="/privacy">política de privacidad</a>.
          </small>
          <p class="pdp-stock-modal__status" data-pdp-stock-status aria-live="polite"></p>
        <button class="pdp-stock-modal__submit" type="submit">Recibir aviso</button>
      </form>
    </div>
  `;

  document.body.appendChild(pdpStockModal);

  pdpStockModal.addEventListener('click', (event) => {
    if (
      event.target === pdpStockModal ||
      event.target.closest('[data-pdp-stock-close]')
    ) {
      closePdpStockModal();
    }
  });

  pdpStockModal
    .querySelector('[data-pdp-stock-form]')
    ?.addEventListener('submit', (event) => {
      event.preventDefault();
      void submitPdpStockNotice();
    });

  document.addEventListener('keydown', (event) => {
    if (pdpStockModal.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closePdpStockModal();
      return;
    }

    const dialog = pdpStockModal.querySelector('.pdp-stock-modal__card');
    if (trapPdpMobileFocus(event, dialog)) event.stopPropagation();
  });

  return pdpStockModal;
}

function setPdpStockStatus(message = '', isError = false) {
  const status = pdpStockModal?.querySelector('[data-pdp-stock-status]');
  if (!status) return;

  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function openPdpStockModal(preferred = {}) {
  const modal = ensurePdpStockModal();
  const copy = modal.querySelector('[data-pdp-stock-copy]');
  const skuField = modal.querySelector('[data-pdp-stock-sku-field]');
  const skuSelect = modal.querySelector('[data-pdp-stock-sku]');
  const emailInput = modal.querySelector('[data-pdp-stock-email]');
  const user = getPdpUser();
  const prelaunch = window.ppStorefront?.salesEnabled === false;

  if (modal.hidden) {
    pdpStockReturnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    pdpStockBodyHadModalOpen = document.body.classList.contains('modal-open');
  }

  pdpPreferredStockSku = normalizeText(preferred.sku);
  pdpStockOptions = getPdpStockOptions();

  if (!pdpStockOptions.length) return;

  if (copy) {
    copy.textContent = prelaunch
      ? `Déjanos tu correo y te avisaremos cuando abramos el primer drop de ${prod.title || 'esta pieza'}.`
      : `Déjanos tu correo y te avisaremos por email cuando ${prod.title || 'esta pieza'} vuelva a estar disponible.`;
  }

  const kicker = modal.querySelector('.pdp-stock-modal__kicker');
  const title = modal.querySelector('.pdp-stock-modal__title');
  if (kicker) kicker.textContent = prelaunch ? 'Primer drop' : 'Producto agotado';
  if (title) title.textContent = prelaunch
    ? 'Avísame del lanzamiento'
    : 'Informarme cuando esté disponible';

  if (skuSelect) {
    skuSelect.innerHTML = pdpStockOptions.map((option, index) => {
      return `<option value="${index}">${escapeHtml(option.label)}</option>`;
    }).join('');
    skuSelect.value = String(getPreferredStockOptionIndex(pdpStockOptions, preferred));
  }

  if (skuField) {
    skuField.hidden = pdpStockOptions.length <= 1;
  }

  if (emailInput) {
    emailInput.value = normalizeText(user?.email || '');
  }

  setPdpStockStatus('');
  modal.hidden = false;
  modal.inert = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  window.requestAnimationFrame(() => {
    if (modal.hidden) return;
    emailInput?.focus({ preventScroll: true });
  });
}

function closePdpStockModal() {
  if (!pdpStockModal) return;

  const returnFocus = pdpStockReturnFocus;

  pdpStockModal.hidden = true;
  pdpStockModal.inert = true;
  pdpStockModal.setAttribute('aria-hidden', 'true');
  pdpStockOptions = [];
  pdpPreferredStockSku = '';
  pdpStockReturnFocus = null;
  setPdpStockStatus('');
  if (
    !pdpStockBodyHadModalOpen &&
    Z.el.classList.contains('hidden') &&
    !document.querySelector('#ppAuthModal[open], #ppAccountPanel[open], .archive-version-modal.is-open')
  ) {
    document.body.classList.remove('modal-open');
  }
  pdpStockBodyHadModalOpen = false;
  restorePdpMobileFocus(returnFocus);
}

function getSelectedPdpStockOption() {
  const select = pdpStockModal?.querySelector('[data-pdp-stock-sku]');
  const index = Number(select?.value || 0);
  return pdpStockOptions[index] || pdpStockOptions[0] || null;
}

async function notifyPdpStockInterest(payload) {
  const authHeaders = await getPdpAuthHeaders();
  const response = await fetch(PDP_STOCK_NOTIFY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders
    },
    body: JSON.stringify({
      ...payload,
      type: 'stock-waitlist',
      source: 'pdp',
      page: window.location.href
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo guardar el aviso.');
  }

  return data;
}

async function submitPdpStockNotice() {
  const emailInput = pdpStockModal?.querySelector('[data-pdp-stock-email]');
  const submit = pdpStockModal?.querySelector('.pdp-stock-modal__submit');
  const email = normalizeEmail(emailInput?.value || '');
  const option = getSelectedPdpStockOption();
  const user = getPdpUser();
  const activeVersion = getActiveVersion();

  if (!isValidEmail(email)) {
    setPdpStockStatus('Introduce un correo válido.', true);
    emailInput?.focus();
    return;
  }

  if (!option) {
    setPdpStockStatus('No se ha podido identificar la talla.', true);
    return;
  }

  if (submit) {
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
  }

  setPdpStockStatus('Guardando aviso...');

  try {
    const serverResult = await notifyPdpStockInterest({
      productId: normalizeText(prod.id || prod.slug),
      title: prod.title || 'Pieza Prophetia',
      sku: option.sku || normalizeText(prod.id || prod.slug),
      variantLabel: option.label || '',
      image: option.image || imgOfColor(state.color || colors[0]) || baseImages[0] || FALLBACK_IMG,
      url: getPdpProductUrl(),
      price: activeVersion?.price ?? prod.price ?? '',
      email,
      userId: user?.uid || '',
      userEmail: user?.email || ''
    });

    closePdpStockModal();

    if (typeof window.ppToast === 'function') {
      window.ppToast(
        serverResult?.alreadyRegistered
          ? 'Ya tienes un aviso activo para esta talla'
          : 'Aviso guardado. Te escribiremos cuando vuelva el stock',
        getPdpProductUrl()
      );
    }
  } catch (error) {
    console.error('[PDP Stock] No se pudo guardar aviso:', error);
    setPdpStockStatus('No se pudo guardar el aviso. Inténtalo de nuevo.', true);
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
    }
  }
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
function getSelectableColorOptions(){
  const activeCut = getActiveCut();

  if (activeCut?.colors?.length) {
    return colorOptions.filter(option => activeCut.colors.includes(colorKey(option.color)));
  }

  const activeVariantColors = new Set(getActiveVariants().map(variant => colorKey(variant.color)).filter(Boolean));
  return activeVariantColors.size
    ? colorOptions.filter(option => activeVariantColors.has(colorKey(option.color)))
    : colorOptions;
}

let colors = [];

function syncColorsForCut(){
  colors = getSelectableColorOptions().map(option => option.color);
}

syncColorsForCut();

// ===== Restore selección (si existía) =====
// Si viene color por URL (por redirección), tiene prioridad
const urlColor = params.get('color');
if (urlColor && colors.includes(urlColor)) {
  state.color = urlColor;
  state.size = null; // al cambiar color, fuerza re-selección de talla
  saveSel();
} else if (prev?.color && colors.includes(prev.color)) {
  state.color = prev.color;
}
if (prev?.size && state.color && sizesForColor(state.color).includes(prev.size)) {
  state.size = prev.size;
}

// Refresca UI + CTA
syncAttrUI();

// Ajusta imagen según color restaurado (opcional)
if (state.color) {
  applyColorGallery(state.color);
}


// Render COLOR (con “imagen del producto” tipo Prophetia)
function renderColorPanel(){
  const selectableColorOptions = getSelectableColorOptions();
  if (!selectableColorOptions.length) return `<p class="muted">Este producto no tiene colores configurados.</p>`;

  return `
    <div class="ad-panel-content">
      <div class="opts" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">
        ${selectableColorOptions.map(opt=>{
          const c = opt.color;
          const active = (state.color===c) ? 'is-active' : '';
          const src = imgOfColor(c) || opt.img || baseImages[0];
          const meta = colorMetaOf(c);

          return `
            <button
              type="button"
              class="opt ${active}"
              data-pick-color="${escapeHtml(c)}"
              data-target-id="${opt.targetId}"
              style="display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:12px;"
            >
              <div style="width:100%;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:#f6f6f6;border:1px solid #eee;">
                <img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover">
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="swatch" style="background:${meta.value};"></span>
                <span>${escapeHtml(meta.label)}</span>
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
          const active = state.size===s ? 'is-active' : '';
          if (st <= 0) {
            const variant = getActiveVariants().find((entry) => {
              return String(entry.color) === String(c) && String(entry.size) === String(s);
            });
            return `
              <button
                type="button"
                class="opt is-out-of-stock"
                data-notify-stock-size="${escapeHtml(String(s))}"
                data-notify-stock-sku="${escapeHtml(String(variant?.sku || ''))}"
                aria-label="Avisarme cuando la talla ${escapeHtml(String(s))} esté disponible"
              >
                <span>${escapeHtml(String(s))}</span>
                <small>Avisarme</small>
              </button>
            `;
          }
          return `
            <button type="button" class="opt ${active}" data-pick-size="${escapeHtml(String(s))}">
              <span>${escapeHtml(String(s))}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderCutPanel(){
  if (!availableCuts.length) {
    return `<p class="muted">Este producto no tiene cortes configurados.</p>`;
  }

  return `
    <div class="ad-panel-content">
      <div class="opts" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">
        ${availableCuts.map(cut => {
          const active = state.cut === cut.id ? 'is-active' : '';
          const cutVersions = availableVersions.filter(version =>
            !version.cut || version.cut === cut.id || cut.versions.includes(version.id)
          );
          const previewVersion = cutVersions.find(version => version.id === cut.defaultVersion) || cutVersions[0];
          const img = previewVersion?.cover || previewVersion?.images?.[0] || baseImages[0] || FALLBACK_IMG;

          return `
            <button
              type="button"
              class="opt ${active}"
              data-pick-cut="${escapeHtml(cut.id)}"
              style="display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:12px;"
            >
              <div style="width:100%;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:#f6f6f6;border:1px solid #eee;">
                <img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover">
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start;">
                <span style="font-weight:600;">${escapeHtml(cut.label)}</span>
                ${cut.description ? `<span style="font-size:13px;opacity:.72;">${escapeHtml(cut.description)}</span>` : ''}
              </div>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderVersionPanel(){
  const versionOptions = getVersionOptionsForActiveCut();
  if (!versionOptions.length) {
    return `<p class="muted">Este producto no tiene versiones configuradas.</p>`;
  }

  return `
    <div class="ad-panel-content">
      <div class="opts" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">
        ${versionOptions.map(version => {
          const active = state.version === version.id ? 'is-active' : '';
          const unavailable = version.available === false;
          const previewColor = colorKey(state.color || prod.color || colors[0] || '');
          const genderImages = imagesFromMediaBucket(
            mediaBucketOfColor(version.mediaByColor, previewColor)
          );
          const img = genderImages[0] || version.cover || version.images?.[0] || '';
          const preview = img
            ? `<img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover">`
            : `<div style="width:100%;height:100%;display:grid;place-content:center;gap:7px;text-align:center;padding:18px;background:linear-gradient(145deg,#f4f1eb,#e9e3d8);color:#161616;">
                <span style="font-family:var(--font-display,serif);font-size:22px;line-height:1;">${escapeHtml(version.label)}</span>
                <span style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.62;">Próximamente</span>
              </div>`;

          return `
            <button
              type="button"
              class="opt ${active} ${unavailable ? 'is-unavailable' : ''}"
              ${unavailable ? 'disabled aria-disabled="true"' : `data-pick-version="${escapeHtml(version.id)}"`}
              style="display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:12px;"
            >
              <div style="width:100%;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:#f6f6f6;border:1px solid #eee;">
                ${preview}
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start;">
                <span style="font-weight:600;">${escapeHtml(version.label)}</span>
                <span style="font-size:13px;opacity:.72;">${unavailable ? 'Próximamente' : money(version.price)}</span>
              </div>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* =========================================================
   PROPHETIA - Fit Guide Flow
   Recorrido por pasos para recomendar talla.
   ========================================================= */

const FIT_GUIDE_KEY = 'pp_fit_guide_v2';
const FIT_GUIDE_SHOP_PREF_KEY = 'pp_shop_preference';

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const FIT_SECTION_OPTIONS = [
  { id: 'hombre', label: 'Hombre' },
  { id: 'mujer', label: 'Mujer' },
  { id: 'all', label: 'Todo Prophetia' }
];
const FIT_YEAR_OPTIONS = Array.from(
  { length: 72 },
  (_, index) => String(new Date().getFullYear() - 14 - index)
);
const FIT_GUIDE_ASSET_BASE = '/assets/img/guide/';
const FIT_GUIDE_SILHOUETTES = Object.freeze({
  abdomen: Object.freeze({
    recto: Object.freeze({ src: 'recto.png', alt: 'Abdomen recto' }),
    suave: Object.freeze({ src: 'suave.png', alt: 'Abdomen suave' }),
    redondeado: Object.freeze({ src: 'redondeado.png', alt: 'Abdomen redondeado' })
  }),
  chest: Object.freeze({
    narrow: Object.freeze({ src: 'estrecho.png', alt: 'Pecho estrecho' }),
    medium: Object.freeze({ src: 'medio.png', alt: 'Pecho medio' }),
    wide: Object.freeze({ src: 'ancho.png', alt: 'Pecho ancho' })
  })
});

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

function isFitGuideLoggedIn() {
  return !!(
    window.__ppAuthCurrentUser ||
    window.__ppLastUser ||
    window.__ppFirebaseAuth?.currentUser ||
    document.body.classList.contains('pp-auth-logged')
  );
}

function normalizeFitSection(value = '') {
  const clean = String(value || '').trim().toLowerCase();

  if (['men', 'man', 'hombre', 'male'].includes(clean)) return 'hombre';
  if (['women', 'woman', 'mujer', 'female'].includes(clean)) return 'mujer';
  if (clean === 'all') return 'all';

  return '';
}

function normalizeFitAbdomen(value = '') {
  const clean = String(value || '').trim().toLowerCase();

  if (['recto', 'flat', 'plano'].includes(clean)) return 'recto';
  if (['suave', 'medium', 'medio'].includes(clean)) return 'suave';
  if (['redondeado', 'rounded', 'abultado'].includes(clean)) return 'redondeado';

  return 'suave';
}

function getFitDefaultSection() {
  const savedPref = normalizeFitSection(localStorage.getItem(FIT_GUIDE_SHOP_PREF_KEY));
  if (savedPref) return savedPref;

  const fromUrl = normalizeFitSection(params.get('g') || params.get('gender'));
  if (fromUrl) return fromUrl;

  const fromProduct = normalizeFitSection(prod.gender || prod.audience || prod.categoryGender);
  if (fromProduct) return fromProduct;

  return 'all';
}

function getFitSectionLabel(value = '') {
  const clean = normalizeFitSection(value) || 'all';
  return FIT_SECTION_OPTIONS.find((option) => option.id === clean)?.label || 'Todo Prophetia';
}

function getAvailableFitGuideSizes() {
  const color = state.color || colors[0] || null;

  const fromVariants = uniq(
    getActiveVariants()
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

function clearFitGuideProfile() {
  try {
    localStorage.removeItem(FIT_GUIDE_KEY);
  } catch {}
}

function getFitGuideProfile(overrides = {}) {
  const saved = readFitGuideProfile();
  const section = normalizeFitSection(saved.section) || getFitDefaultSection();

  return {
    section,
    birthYear: saved.birthYear || '',
    height: saved.height || '',
    weight: saved.weight || '',
    desiredFit: saved.desiredFit || 'relaxed',
    abdomen: normalizeFitAbdomen(saved.abdomen),
    chest: saved.chest || 'medium',
    recommendedSize: saved.recommendedSize || '',
    ...overrides
  };
}

function updateFitGuideProfile(updates = {}) {
  const next = {
    ...getFitGuideProfile(),
    ...updates
  };

  saveFitGuideProfile(next);
  return next;
}

function getInitialFitGuideStep() {
  const saved = readFitGuideProfile();

  if (saved.recommendedSize) return 'result';
  if (isFitGuideLoggedIn()) return 'measure';

  return 'profile';
}

function getFitGuideSteps() {
  return isFitGuideLoggedIn()
    ? ['measure', 'preference', 'silhouette', 'result']
    : ['profile', 'measure', 'preference', 'silhouette', 'result'];
}

function getFitGuideStepIndex(step) {
  const steps = getFitGuideSteps();
  const index = steps.indexOf(step);
  return index === -1 ? 0 : index;
}

function renderFitGuideProgress(step) {
  const steps = getFitGuideSteps();
  const activeIndex = getFitGuideStepIndex(step);

  return `
    <div class="fit-guide__progress" aria-label="Progreso del recomendador">
      ${steps.map((_, index) => `
        <span class="${index <= activeIndex ? 'is-active' : ''}"></span>
      `).join('')}
    </div>
  `;
}

function getFitIntentLabel(intent) {
  const map = {
    fitted: 'Ajustada',
    relaxed: 'Normal',
    oversized: 'Holgada'
  };
  return map[String(intent || '').toLowerCase()] || map.relaxed;
}

function getFitBodySignal(height, weight) {
  const h = Number(height || 0);
  const w = Number(weight || 0);
  if (!h || !w) return 'Lectura neutra';

  const bmi = w / Math.pow(h / 100, 2);
  if (h >= 188 && bmi < 25) return 'Linea alta';
  if (h <= 168 && bmi <= 23) return 'Perfil compacto';
  if (bmi >= 28) return 'Mayor estructura';
  if (bmi <= 20) return 'Perfil ligero';
  return 'Proporcion equilibrada';
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

function computeFitRecommendation(profile = {}) {
  const availableSizes = getAvailableFitGuideSizes();

  if (!availableSizes.length) {
    return {
      size: null,
      confidence: 'baja',
      availableSizes: [],
      message: 'No hay tallas disponibles para esta pieza ahora mismo.'
    };
  }

  let index = estimateBaseSizeIndex(profile.height, profile.weight);
  const desired = String(profile.desiredFit || 'relaxed').toLowerCase();
  const productFit = String(getActiveCut()?.fit || prod.fit || '').toLowerCase();
  const productType = String(prod.type || prod.section || '').toLowerCase();

  if (desired === 'fitted') index -= 1;
  if (desired === 'oversized') index += 1;
  if (normalizeFitAbdomen(profile.abdomen) === 'redondeado') index += 1;
  if (normalizeFitAbdomen(profile.abdomen) === 'recto') index -= 1;
  if (profile.chest === 'wide') index += 1;
  if (profile.chest === 'narrow') index -= 1;

  if (productFit === 'oversized' && desired === 'oversized') {
    index -= 1;
  }

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
    fitted: 'más cerca del cuerpo',
    relaxed: 'con lectura natural',
    oversized: 'con más caída visual'
  };

  return {
    size,
    confidence,
    availableSizes,
    desiredFit: desired,
    productFit: getActiveCut()?.fit || prod.fit || 'regular',
    section: profile.section || getFitDefaultSection(),
    bodySignal: getFitBodySignal(profile.height, profile.weight),
    message: `Recomendamos talla ${size} para una silueta ${fitCopy[desired] || 'natural'}.`
  };
}

function getFitGuideProductImage() {
  const selectedColor = state.color || colors[0] || null;
  return imgOfColor(selectedColor) || baseImages[0] || prod.img || prod.image || FALLBACK_IMG;
}

function getFitGuideCartProduct(size) {
  if (!state.color && colors[0]) state.color = colors[0];

  const activeCut = getActiveCut();
  const activeVersion = getActiveVersion();
  const selectedColor = state.color || colors[0] || '';
  const sku = getSelectionSku(selectedColor, size);

  return {
    id: prod.id,
    sku,
    title: prod.title,
    cut: activeCut?.id || null,
    cutLabel: activeCut?.label || null,
    version: activeVersion?.id || null,
    versionLabel: activeVersion?.label || null,
    price: activeVersion?.price ?? prod.price,
    color: selectedColor,
    size,
    qty: 1,
    img: getFitGuideProductImage()
  };
}

function applyFitGuideSize(size, options = {}) {
  if (!size) return;

  if (!state.color && colors[0]) state.color = colors[0];
  state.size = size;

  const fitGuideVal = document.getElementById('pdpFitGuideVal');
  if (fitGuideVal) fitGuideVal.textContent = 'Aplicada ' + size;

  syncAttrUI();
  saveSel();
  syncCTA();

  if (options.close !== false) {
    closeDrawer();
  }
}

function addFitGuideSizeToCart(size) {
  if (!size) return;

  applyFitGuideSize(size, { close: false });
  const product = getFitGuideCartProduct(size);

  if (window.ppStorefront?.salesEnabled === false) {
    if (!pdpMobileQuery.matches) {
      addProductToCart(product);
      closeDrawer();
      return;
    }

    closeDrawerBeforeNextLayer();
    openPdpStockModal({
      sku: product.sku,
      color: product.color,
      size: product.size
    });
    return;
  }

  if (isProductOutOfStock()) {
    if (pdpMobileQuery.matches) closeDrawerBeforeNextLayer();
    openPdpStockModal({
      sku: product.sku,
      color: product.color,
      size: product.size
    });
    return;
  }

  if (pdpMobileQuery.matches) {
    closeDrawerBeforeNextLayer();
    addProductToCart(product);
  } else {
    addProductToCart(product);
    closeDrawer();
  }
}

function renderFitGuideChoiceButton(name, value, label, active, extra = '') {
  return `
    <button
      type="button"
      class="fit-guide__choice ${active ? 'is-active' : ''}"
      data-fit-choice="${escapeHtml(name)}"
      data-fit-value="${escapeHtml(value)}"
      aria-pressed="${active ? 'true' : 'false'}"
    >
      <span>${escapeHtml(label)}</span>
      ${extra ? `<small>${escapeHtml(extra)}</small>` : ''}
    </button>
  `;
}

function getFitGuideSilhouetteAsset(group, value) {
  const collection = FIT_GUIDE_SILHOUETTES[group];
  if (!collection) return null;

  return collection[value] || collection.suave || collection.medium || collection.recto || collection.narrow || null;
}

function renderFitGuideSilhouetteImage(group, value) {
  const asset = getFitGuideSilhouetteAsset(group, value);
  if (!asset) return '';

  return `
        <figure class="fit-guide__silhouetteFigure fit-guide__silhouetteFigure--${escapeHtml(group)}" data-fit-silhouette-figure="${escapeHtml(group)}">
          <img src="${FIT_GUIDE_ASSET_BASE}${escapeHtml(asset.src)}" alt="${escapeHtml(asset.alt)}" loading="lazy">
        </figure>`;
}

function updateFitGuideSilhouetteImage(root, group, value) {
  const asset = getFitGuideSilhouetteAsset(group, value);
  const figure = root?.querySelector(`[data-fit-silhouette-figure="${group}"]`);
  const image = figure?.querySelector('img');

  if (!asset || !image) return;

  image.src = FIT_GUIDE_ASSET_BASE + asset.src;
  image.alt = asset.alt;
}

function renderFitGuideShell(step, content, actionLabel, options = {}) {
  const activeIndex = getFitGuideStepIndex(step);
  const total = getFitGuideSteps().length;
  const logged = isFitGuideLoggedIn();

  return `
    <div class="ad-panel-content fit-guide fit-guide--flow" data-fit-guide-root data-fit-step="${escapeHtml(step)}">
      ${renderFitGuideProgress(step)}
      <div class="fit-guide__context">
        <span>Prophetia Fit System</span>
        <span>${activeIndex + 1}/${total}</span>
      </div>
      <div class="fit-guide__screen">
        ${content}
      </div>
      ${options.note ? `<p class="fit-guide__legal">${escapeHtml(options.note)}</p>` : ''}
      ${actionLabel ? `
        <div class="fit-guide__actions">
          ${options.back ? '<button type="button" class="fit-guide__ghost" data-fit-back>Volver</button>' : ''}
          <button type="submit" class="fit-guide__continue" form="${escapeHtml(options.formId || 'fitGuideForm')}">
            ${escapeHtml(actionLabel)}
          </button>
        </div>
      ` : ''}
      ${logged && step === 'measure' ? '<p class="fit-guide__profile-note">Usamos tu perfil Prophetia para omitir datos ya conocidos.</p>' : ''}
    </div>
  `;
}

function renderFitGuideProfileStep(profile) {
  const content = `
    <form id="fitGuideForm" class="fit-guide__step" data-fit-step-form data-fit-step-form-name="profile">
      <h4>Datos de referencia</h4>
      <p>Para invitados, necesitamos una lectura mínima antes de calcular la talla.</p>

      <section class="fit-guide__zaraBlock" aria-label="Sección favorita">
        <span class="fit-guide__question">Sección favorita</span>
        <div class="fit-guide__selectRow">
          ${FIT_SECTION_OPTIONS.map((option) => renderFitGuideChoiceButton(
            'section',
            option.id,
            option.label,
            profile.section === option.id
          )).join('')}
        </div>
        <input type="hidden" name="section" value="${escapeHtml(profile.section)}">
      </section>

      <label class="fit-guide__selectLike">
        <span>Año de nacimiento <em>(opcional)</em></span>
        <select name="birthYear">
          <option value="">Seleccionar</option>
          ${FIT_YEAR_OPTIONS.map((year) => `
            <option value="${year}" ${String(profile.birthYear) === year ? 'selected' : ''}>${year}</option>
          `).join('')}
        </select>
      </label>
    </form>
  `;

  return renderFitGuideShell('profile', content, 'Continuar', {
    note: 'Utilizamos estos datos solo para estimar la talla de esta pieza.'
  });
}

function renderFitGuideMeasureStep(profile) {
  const content = `
    <form id="fitGuideForm" class="fit-guide__step" data-fit-step-form data-fit-step-form-name="measure">
      <h4>Medidas principales</h4>
      <p>Introduce altura y peso para situar la prenda sobre tu proporción real.</p>

      <div class="fit-guide__metricStack">
        <label class="fit-guide__measureField">
          <span>Cuál es tu altura?</span>
          <input type="number" name="height" min="130" max="230" step="1" inputmode="numeric" placeholder="180" value="${escapeHtml(profile.height)}" required>
          <em>CM</em>
        </label>

        <label class="fit-guide__measureField">
          <span>Cuál es tu peso?</span>
          <input type="number" name="weight" min="35" max="180" step="1" inputmode="numeric" placeholder="78" value="${escapeHtml(profile.weight)}" required>
          <em>KG</em>
        </label>
      </div>
    </form>
  `;

  return renderFitGuideShell('measure', content, 'Continuar', {
    back: !isFitGuideLoggedIn()
  });
}

function renderFitGuidePreferenceStep(profile) {
  const values = ['fitted', 'relaxed', 'oversized'];
  const selectedIndex = Math.max(0, values.indexOf(profile.desiredFit));
  const content = `
    <form id="fitGuideForm" class="fit-guide__step" data-fit-step-form data-fit-step-form-name="preference">
      <h4>Cómo te gusta llevar la ropa?</h4>
      <p>Ajusta la intención de fit para que la recomendación no sea solo numerica.</p>

      <div class="fit-guide__rangeWrap">
        <input type="range" min="0" max="2" step="1" value="${selectedIndex}" name="desiredFitRange" data-fit-range>
        <input type="hidden" name="desiredFit" value="${escapeHtml(profile.desiredFit)}">
        <div class="fit-guide__rangeLabels" aria-hidden="true">
          <span>Ajustada</span>
          <span>Normal</span>
          <span>Holgada</span>
        </div>
      </div>
    </form>
  `;

  return renderFitGuideShell('preference', content, 'Continuar', { back: true });
}

function renderFitGuideSilhouetteStep(profile) {
  const content = `
    <form id="fitGuideForm" class="fit-guide__step fit-guide__step--silhouette" data-fit-step-form data-fit-step-form-name="silhouette">
      <h4>Lectura de silueta</h4>
      <p>Opcional. Afina la caída si quieres una recomendación más precisa.</p>

      <section class="fit-guide__silhouetteBlock">
        <span class="fit-guide__question">Abdomen <em>(opcional)</em></span>
        ${renderFitGuideSilhouetteImage('abdomen', profile.abdomen)}
        <div class="fit-guide__selectRow fit-guide__selectRow--wide">
          ${renderFitGuideChoiceButton('abdomen', 'recto', 'Recto', normalizeFitAbdomen(profile.abdomen) === 'recto')}
          ${renderFitGuideChoiceButton('abdomen', 'suave', 'Suave', normalizeFitAbdomen(profile.abdomen) === 'suave')}
          ${renderFitGuideChoiceButton('abdomen', 'redondeado', 'Redondeado', normalizeFitAbdomen(profile.abdomen) === 'redondeado')}
        </div>
        <input type="hidden" name="abdomen" value="${escapeHtml(normalizeFitAbdomen(profile.abdomen))}">
      </section>

      <section class="fit-guide__silhouetteBlock">
        <span class="fit-guide__question">Pecho <em>(opcional)</em></span>
        ${renderFitGuideSilhouetteImage('chest', profile.chest)}
        <div class="fit-guide__selectRow fit-guide__selectRow--wide">
          ${renderFitGuideChoiceButton('chest', 'narrow', 'Estrecho', profile.chest === 'narrow')}
          ${renderFitGuideChoiceButton('chest', 'medium', 'Medio', profile.chest === 'medium')}
          ${renderFitGuideChoiceButton('chest', 'wide', 'Ancho', profile.chest === 'wide')}
        </div>
        <input type="hidden" name="chest" value="${escapeHtml(profile.chest)}">
      </section>
    </form>
  `;

  return renderFitGuideShell('silhouette', content, 'Ver recomendación', { back: true });
}

function renderFitGuideResultStep(profile) {
  const result = computeFitRecommendation(profile);
  const size = profile.recommendedSize || result.size;
  const image = getFitGuideProductImage();

  if (!size) {
    const content = `
      <section class="fit-guide__resultView fit-guide__resultView--empty">
        <h4>Sin talla disponible</h4>
        <p>${escapeHtml(result.message || 'No se ha podido calcular una talla disponible.')}</p>
        <button type="button" class="fit-guide__ghost" data-fit-reset>Borrar datos</button>
      </section>
    `;

    return renderFitGuideShell('result', content, '', { back: true });
  }

  const nextProfile = {
    ...profile,
    recommendedSize: size
  };
  saveFitGuideProfile(nextProfile);

  const fitGuideVal = document.getElementById('pdpFitGuideVal');
  if (fitGuideVal) fitGuideVal.textContent = `Sugerida ${size}`;

  const content = `
    <section class="fit-guide__resultView" aria-live="polite">
      <figure class="fit-guide__productFigure">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(prod.title || 'Producto Prophetia')}">
      </figure>

      <div class="fit-guide__resultCopy">
        <span>Talla</span>
        <strong>${escapeHtml(size)}</strong>
        <p>${escapeHtml(result.message)}</p>
      </div>

      <button type="button" class="fit-guide__addCart" data-fit-add-cart="${escapeHtml(size)}">
        Añadir talla ${escapeHtml(size)}
      </button>

      <button type="button" class="fit-guide__textBtn" data-fit-edit>Editar</button>
      <button type="button" class="fit-guide__textBtn fit-guide__textBtn--muted" data-fit-reset>Borrar datos</button>
    </section>
  `;

  return renderFitGuideShell('result', content, '');
}

function renderFitGuidePanel(options = {}) {
  const step = options.step || getInitialFitGuideStep();
  const profile = getFitGuideProfile(options.profile || {});

  if (step === 'profile') return renderFitGuideProfileStep(profile);
  if (step === 'measure') return renderFitGuideMeasureStep(profile);
  if (step === 'preference') return renderFitGuidePreferenceStep(profile);
  if (step === 'silhouette') return renderFitGuideSilhouetteStep(profile);

  return renderFitGuideResultStep(profile);
}

function renderFitGuideStep(step, profile = {}) {
  adBody.innerHTML = renderFitGuidePanel({ step, profile });
  focusPdpMobileLayer(
    adBody,
    'input:not([type="hidden"]):not([disabled]), select:not([disabled]), button:not([disabled])'
  );
}

function getFitPreviousStep(step) {
  const steps = getFitGuideSteps();
  const index = getFitGuideStepIndex(step);
  return steps[Math.max(0, index - 1)] || steps[0];
}

function collectFitGuideFormData(form) {
  const data = new FormData(form);
  const step = String(form.dataset.fitStepFormName || 'measure');
  const updates = {};

  if (step === 'profile') {
    updates.section = normalizeFitSection(data.get('section')) || getFitDefaultSection();
    updates.birthYear = String(data.get('birthYear') || '').trim();
  }

  if (step === 'measure') {
    updates.height = Number(data.get('height') || 0);
    updates.weight = Number(data.get('weight') || 0);
  }

  if (step === 'preference') {
    updates.desiredFit = String(data.get('desiredFit') || 'relaxed');
  }

  if (step === 'silhouette') {
    updates.abdomen = normalizeFitAbdomen(data.get('abdomen') || 'suave');
    updates.chest = String(data.get('chest') || 'medium');
  }

  updates.recommendedSize = '';
  return updates;
}

function getNextFitGuideStep(step) {
  if (step === 'profile') return 'measure';
  if (step === 'measure') return 'preference';
  if (step === 'preference') return 'silhouette';
  return 'result';
}
function syncAttrUI(){
  const activeCut = getActiveCut();
  const activeVersion = getActiveVersion();

  const cutAttr = document.getElementById('pdpCutAttr');
  if (cutAttr) cutAttr.hidden = !availableCuts.length;
  const versionAttr = document.getElementById('pdpVersionAttr');
  if (versionAttr) versionAttr.hidden = !availableVersions.length;
  const cutValue = document.getElementById('pdpCutVal');
  if (cutValue) cutValue.textContent = activeCut ? activeCut.label : 'Seleccionar';
  document.getElementById('pdpColorVal').textContent = state.color
    ? colorMetaOf(state.color).label
    : 'Seleccionar';
  document.getElementById('pdpSizeVal').textContent  = state.size  ? state.size  : 'Seleccionar';
  document.getElementById('pdpVersionVal').textContent = activeVersion ? activeVersion.label : 'Seleccionar';
}


// Delegación clicks dentro del drawer (color/size)
drawer.addEventListener('click', (e)=>{
  const cbtn = e.target.closest('[data-pick-color]');
  const sbtn = e.target.closest('[data-pick-size]');
  const stockSizeBtn = e.target.closest('[data-notify-stock-size]');
  const vbtn = e.target.closest('[data-pick-version]');
  const cutOptionBtn = e.target.closest('[data-pick-cut]');
  const fitSizeBtn = e.target.closest('[data-fit-select-size]');
  const fitAddCartBtn = e.target.closest('[data-fit-add-cart]');
  const fitResetBtn = e.target.closest('[data-fit-reset]');
  const fitEditBtn = e.target.closest('[data-fit-edit]');
  const fitBackBtn = e.target.closest('[data-fit-back]');
  const fitChoiceBtn = e.target.closest('[data-fit-choice]');

  if (fitChoiceBtn) {
    e.preventDefault();

    const name = String(fitChoiceBtn.dataset.fitChoice || '').trim();
    const value = String(fitChoiceBtn.dataset.fitValue || '').trim();
    const root = fitChoiceBtn.closest('[data-fit-guide-root]');
    const form = fitChoiceBtn.closest('form') || root?.querySelector('form');
    const input = form?.querySelector(`input[name="${name}"]`);

    if (input) {
      input.value = value;
    }

    root?.querySelectorAll(`[data-fit-choice="${name}"]`).forEach((btn) => {
      const active = btn === fitChoiceBtn;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    if (name === 'abdomen' || name === 'chest') {
      updateFitGuideSilhouetteImage(root, name, value);
    }

    return;
  }

  if (stockSizeBtn) {
    e.preventDefault();
    state._intentAddToCart = false;
    const preferred = {
      sku: stockSizeBtn.dataset.notifyStockSku || '',
      color: state.color || colors[0] || '',
      size: stockSizeBtn.dataset.notifyStockSize || ''
    };
    if (pdpMobileQuery.matches) closeDrawerBeforeNextLayer();
    else closeDrawer();
    openPdpStockModal(preferred);
    return;
  }

  if (fitBackBtn) {
    e.preventDefault();
    const step = fitBackBtn.closest('[data-fit-guide-root]')?.dataset.fitStep || getInitialFitGuideStep();
    renderFitGuideStep(getFitPreviousStep(step));
    return;
  }

  if (fitEditBtn) {
    e.preventDefault();
    const profile = updateFitGuideProfile({ recommendedSize: '' });
    renderFitGuideStep(isFitGuideLoggedIn() ? 'measure' : 'profile', profile);
    return;
  }

  if (fitResetBtn) {
    e.preventDefault();
    clearFitGuideProfile();
    const fitGuideVal = document.getElementById('pdpFitGuideVal');
    if (fitGuideVal) fitGuideVal.textContent = 'Recomendar talla';
    renderFitGuideStep(isFitGuideLoggedIn() ? 'measure' : 'profile');
    return;
  }

  if (fitAddCartBtn) {
    e.preventDefault();
    addFitGuideSizeToCart(String(fitAddCartBtn.dataset.fitAddCart || '').trim());
    return;
  }

  if (fitSizeBtn) {
    e.preventDefault();
    applyFitGuideSize(String(fitSizeBtn.dataset.fitSelectSize || '').trim());
    return;
  }
if (cutOptionBtn){
  const pickedCut = String(cutOptionBtn.dataset.pickCut || '').trim();
  const cutData = availableCuts.find(cut => cut.id === pickedCut);
  if (!cutData) return;

  state.cut = cutData.id;

  const selectableVersions = getSelectableVersions();
  if (!selectableVersions.some(version => version.id === state.version)) {
    const defaultVersion = selectableVersions.find(version => version.id === cutData.defaultVersion) || selectableVersions[0] || null;
    state.version = defaultVersion?.id || null;
  }

  syncColorsForCut();
  if (!state.color || !colors.includes(state.color)) {
    state.color = colors[0] || null;
  }
  state.size = null;

  syncAttrUI();
  saveSel();
  closeDrawer();

  if (state.color) {
    applyColorGallery(state.color);
  }

  syncCTA();
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

  applyColorGallery(state.color);

  return;
}
if (vbtn){
  const pickedVersion = String(vbtn.dataset.pickVersion || '').trim();
  const versionData = getSelectableVersions().find(v => v.id === pickedVersion);
  if (!versionData) return;

  state.version = versionData.id;
  syncAttrUI();
  saveSel();
  closeDrawer();

  const galleryColor = state.color || prod.color || colors[0] || '';
  const colorVersionImages = galleryColor ? imagesOfColor(galleryColor) : [];
  const versionImages = dedupe(
    colorVersionImages.length
      ? colorVersionImages
      : (versionData.images && versionData.images.length)
        ? versionData.images
        : [versionData.cover || baseImages[0] || FALLBACK_IMG]
  );

  setGallery(versionImages.length ? versionImages : [FALLBACK_IMG]);
  Z.images = versionImages.length ? versionImages : [FALLBACK_IMG];

  syncCTA();
  return;
}

if (sbtn){
  if (sbtn.disabled) return;

  const shouldAddToCart = Boolean(state._intentAddToCart);
  state.size = sbtn.dataset.pickSize;
  syncAttrUI();
  saveSel();
  if (shouldAddToCart && pdpMobileQuery.matches) closeDrawerBeforeNextLayer();
  else closeDrawer();
  syncCTA();

  // Si el CTA fue el que inició la selección, entonces sí añadimos
  if (shouldAddToCart) {
    state._intentAddToCart = false; // consumimos la intención

    // aseguramos color por defecto si no hay
    if (!state.color && colors[0]) state.color = colors[0];

 const activeCut = getActiveCut();
 const activeVersion = getActiveVersion();
    const sku = getSelectionSku();

const product = {
  id: prod.id,
  sku,
  title: prod.title,
  cut: activeCut?.id || null,
  cutLabel: activeCut?.label || null,
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

drawer.addEventListener('input', (e) => {
  const range = e.target.closest('[data-fit-range]');
  if (!range) return;

  const values = ['fitted', 'relaxed', 'oversized'];
  const next = values[Math.max(0, Math.min(2, Number(range.value || 1)))] || 'relaxed';
  const form = range.closest('form');
  const hidden = form?.querySelector('input[name="desiredFit"]');

  if (hidden) {
    hidden.value = next;
  }
});

drawer.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-fit-step-form]');
  if (!form) return;

  e.preventDefault();

  const step = String(form.dataset.fitStepFormName || 'measure');
  const profile = updateFitGuideProfile(collectFitGuideFormData(form));
  const nextStep = getNextFitGuideStep(step);

  if (nextStep === 'result') {
    const result = computeFitRecommendation(profile);
    const finalProfile = updateFitGuideProfile({
      recommendedSize: result.size || ''
    });
    renderFitGuideStep('result', finalProfile);
    return;
  }

  renderFitGuideStep(nextStep, profile);
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
const sizeGuide = prod.sizeGuide && typeof prod.sizeGuide === 'object' ? prod.sizeGuide : null;

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

return { desc, bullets, materials, materialsMain, materialsSections, pack, shipping, specsObj, sizeGuide };
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

function renderSizeGuide(sizeGuide){
  const columns = Array.isArray(sizeGuide?.columns) ? sizeGuide.columns : [];
  const rows = Array.isArray(sizeGuide?.rows) ? sizeGuide.rows : [];

  if (!columns.length || !rows.length) return '';

  const unit = String(sizeGuide?.unit || 'cm').trim();

  return `
    <section class="ad-size-guide" aria-label="Guía de tallas">
      <div class="ad-size-guide__head">
        <h4>Guía de tallas</h4>
        <span>Medidas en ${escapeHtml(unit)}</span>
      </div>
      <div class="ad-size-guide__scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Medida</th>
              ${columns.map(size => `<th scope="col">${escapeHtml(size)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <th scope="row">${escapeHtml(row?.label || '')}</th>
                ${columns.map((_, index) => `<td>${escapeHtml(row?.values?.[index] ?? '—')}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderPackagingPanel() {
  return `
    <section class="pp-product-packaging" aria-labelledby="ppProductPackagingTitle">
      <div class="pp-product-packaging-copy">
        <h4 id="ppProductPackagingTitle" class="pp-product-packaging-title">Packaging PROPHETIA</h4>
        <p>Cada pedido PROPHETIA se prepara cuidadosamente en el packaging oficial de la marca.</p>
        <p>La prenda se presenta con papel de seda y elementos editoriales de PROPHETIA para protegerla durante el envío y completar la experiencia de apertura.</p>
        <p class="pp-product-packaging-note">La presentación puede adaptarse al tamaño y al formato de cada pedido.</p>
      </div>
      <figure class="pp-product-packaging-media">
        <img
          class="pp-product-packaging-image"
          data-pp-packaging-image
          src="/assets/img/pack/packaging.png"
          alt="Packaging oficial de PROPHETIA"
          loading="lazy"
          decoding="async"
        >
      </figure>
    </section>
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
    return renderPackagingPanel();
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
      ${renderSizeGuide(d.sizeGuide)}
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
adBody.addEventListener('error', (e) => {
  const image = e.target?.closest?.('[data-pp-packaging-image]');
  if (image) image.hidden = true;
}, true);

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

function openDetailsDrawer(initialTab = 'details', trigger = null){
  drawer.classList.add('ad--details');

  const colorTxt = state.color || prod.color || (Array.isArray(prod.colors) ? prod.colors[0] : '') || '';
  const activeCut = getActiveCut();
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
        ${activeCut ? `<div class="ad-producthead__sub">Corte: ${activeCut.label}</div>` : ''}
        ${activeVersion ? `<div class="ad-producthead__sub">Versión: ${activeVersion.label}</div>` : ''}
        ${colorTxt ? `<div class="ad-producthead__sub">Color: ${colorTxt}</div>` : ''}
        <div class="ad-producthead__price">${(typeof shownPrice === 'number') ? money(shownPrice) : '—'}</div>
      </div>
    </div>
    ${renderDetailsPanel(initialTab)}
  `;

  activateDrawer(trigger);
}



// Botones de la ficha
cutBtn?.addEventListener('click', (e)=>{
  e.preventDefault();
  e.stopPropagation();
  openDrawer('Corte', renderCutPanel(), e.currentTarget);
});

sizeBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  e.stopPropagation();

  if (!state.color) {
    openDrawer('Color', renderColorPanel(), e.currentTarget);
    return;
  }

  openDrawer('Talla', renderSizePanel(), e.currentTarget);
});

colorBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  e.stopPropagation();
  openDrawer('Color', renderColorPanel(), e.currentTarget);
});

versionBtn?.addEventListener('click', (e)=>{
  e.preventDefault();
  e.stopPropagation();
  openDrawer('Versión', renderVersionPanel(), e.currentTarget);
});

// Details/Shipping siguen abriendo el drawer (con close funcionando)
detailsBtn.addEventListener('click', (e)=> openDetailsDrawer('details', e.currentTarget));
shippingBtn?.addEventListener('click', (e)=> openDetailsDrawer('shipping', e.currentTarget));

function openFitGuideDrawer(e) {
  e?.preventDefault();
  e?.stopPropagation();

  openDrawer('Guía Inteligente de Talla', renderFitGuidePanel(), e?.currentTarget || null);
}

fitGuideAttrBtn?.addEventListener('click', openFitGuideDrawer);
fitGuideLinkBtn?.addEventListener('click', openFitGuideDrawer);

const buyForm = document.getElementById('buyForm');
const ctaBtn  = document.getElementById('pdpCta') || document.getElementById('pdpcta');
// 🔒 Blindaje: nunca refrescar por submit accidental
buyForm?.addEventListener('submit', (e) => e.preventDefault(), true);

// En pre-lanzamiento el aviso de la pieza tiene prioridad sobre cualquier
// manejador global (Tribe, carrito, etc.). La captura también cubre CTAs que
// puedan ser reemplazados al renderizar la ficha.
document.addEventListener('click', (e) => {
  const target = e.target?.closest?.('#pdpCta, #pdpcta');
  if (!target || window.ppStorefront?.salesEnabled !== false) return;

  e.preventDefault();
  e.stopImmediatePropagation();
  openPdpStockModal({
    sku: getSelectionSku(),
    color: state.color,
    size: state.size
  });
  syncCTA();
}, true);

// 🔒 Blindaje: el CTA se maneja por click (no por submit)
ctaBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (window.ppStorefront?.salesEnabled === false || isProductOutOfStock()) {
    openPdpStockModal({
      sku: getSelectionSku(),
      color: state.color,
      size: state.size
    });
    syncCTA();
    return;
  }

  if (availableCuts.length && !state.cut) {
    state._intentAddToCart = true;
    openDrawer('Corte', renderCutPanel(), ctaBtn);
    syncCTA();
    return;
  }

  if (getSelectableVersions().length && !state.version) {
    state._intentAddToCart = true;
    openDrawer('Versión', renderVersionPanel(), ctaBtn);
    syncCTA();
    return;
  }

  if (!state.color) {
    state._intentAddToCart = true;
    openDrawer('Color', renderColorPanel(), ctaBtn);
    syncCTA();
    return;
  }

  if (!state.size) {
    state._intentAddToCart = true;
    openDrawer('Talla', renderSizePanel(), ctaBtn);
    syncCTA();
    return;
  }

  const activeCut = getActiveCut();
  const activeVersion = getActiveVersion();
  const sku = getSelectionSku();

addProductToCart({
  id: prod.id,
  sku,
  title: prod.title,
  cut: activeCut?.id || null,
  cutLabel: activeCut?.label || null,
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
  applyColorGallery(state.color);
}


const ctaLabelEl = ctaBtn?.querySelector('.pdp-cta__label');
const ctaPriceEl = document.getElementById('pdpCtaPrice');



function setCTA({ enabled, label, hint, stockOut = false }){
  if (!ctaBtn) return;

  if (ctaLabelEl) ctaLabelEl.textContent = label;
  else ctaBtn.textContent = label; // fallback

const activeVersion = getActiveVersion();
if (ctaPriceEl) ctaPriceEl.textContent = money(activeVersion?.price ?? prod.price);
  // siempre clicable, pero estilo/semántica “bloqueado”
  ctaBtn.disabled = false;
  ctaBtn.setAttribute('aria-disabled', String(!enabled));
  ctaBtn.classList.toggle('is-disabled', !enabled);
  ctaBtn.classList.toggle('is-out-of-stock', !!stockOut);

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
  if (window.ppStorefront?.salesEnabled === false) {
    return {
      enabled: true,
      label: 'Avísame del lanzamiento',
      hint: 'Elige la talla que quieres recibir como aviso',
      stockOut: true
    };
  }

  if (isProductOutOfStock()) {
    return {
      enabled: true,
      label: 'Avisarme cuando haya stock',
      hint: 'Elige la talla que quieres recibir como aviso',
      stockOut: true
    };
  }

  if (availableCuts.length && !state.cut) {
    return { enabled:false, label:'Seleccionar corte', hint:'Selecciona un corte para continuar' };
  }
  if (getSelectableVersions().length && !state.version) {
    return { enabled:false, label:'Seleccionar versión', hint:'Selecciona una versión para continuar' };
  }
  if (!state.color) return { enabled:false, label:'Seleccionar color', hint:'Selecciona un color para continuar' };
  if (!state.size)  return { enabled:false, label:'Seleccionar talla', hint:'Selecciona una talla para continuar' };
  return { enabled:true,  label:'Añadir a la cesta', hint:'' };
}



function syncCTA(){
  setCTA(computeCTALabel());
}

// Submit = si está bloqueado, abrir selector; si está listo, añadir a carrito
buyForm?.addEventListener('submit', (e) => {
  e.preventDefault();

  if (window.ppStorefront?.salesEnabled === false || isProductOutOfStock()) {
    openPdpStockModal({
      sku: getSelectionSku(),
      color: state.color,
      size: state.size
    });
    syncCTA();
    return;
  }

  if (availableCuts.length && !state.cut){
    openDrawer('Corte', renderCutPanel(), ctaBtn);
    syncCTA();
    return;
  }

  if (getSelectableVersions().length && !state.version){
    openDrawer('Versión', renderVersionPanel(), ctaBtn);
    syncCTA();
    return;
  }

  if (!state.color){
    openDrawer('Color', renderColorPanel(), ctaBtn);
    syncCTA();
    return;
  }

  if (!state.size){
    openDrawer('Talla', renderSizePanel(), ctaBtn);
    syncCTA();
    return;
  }

  const activeCut = getActiveCut();
  const activeVersion = getActiveVersion();
  const sku = getSelectionSku();

  const product = {
    id: prod.id,
    sku,
    title: prod.title,
    cut: activeCut?.id || null,
    cutLabel: activeCut?.label || null,
    version: activeVersion?.id || null,
    versionLabel: activeVersion?.label || null,
    price: activeVersion?.price ?? prod.price,
    color: state.color,
    size: state.size,
    qty: 1,
    img: imgOfColor(state.color)
  };

  addProductToCart(product);
});

// Inicial
syncCTA();


    })();
  });

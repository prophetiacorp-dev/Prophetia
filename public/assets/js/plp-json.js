/* ===================================================================
   PROPHETIA · plp-json.js
   Render PLP desde catalog.json usando data-* del #plp-grid
   - Filtra por section + gender (con fallback unisex)
   - Soporta filtros del drawer via window.ppPLP.apply/count
   - Enlace a producto pasando gender para PDP
   =================================================================== */

(() => {
  const grid = document.getElementById('plp-grid');
  if (!grid) return;
    window.__PP_PLP_RENDERER__ = 'plp-json';

  console.info('[PLP JSON] init', {
    SECTION: grid.dataset.section,
    GENDER: grid.dataset.gender,
    CATALOG_URL: grid.dataset.catalog
  });

  const debugFail = (msg, extra) => {
    console.error('[PLP JSON]', msg, extra || '');
    grid.innerHTML = `<p style="padding:16px;font-family:Inter,system-ui;color:#111">
      <strong>PLP:</strong> ${msg}
    </p>`;
  };

  const SECTION = (grid.dataset.section || '').trim();
  const PAGE_GENDER = (grid.dataset.gender || '').trim(); // "mujer" | "hombre"
  const CATALOG_URL = grid.dataset.catalog || 'assets/data/catalog.json';

  // Si tu PDP espera otro parámetro, cambia aquí:
  const PRODUCT_URL = (id, gender) => `producto?id=${encodeURIComponent(id)}&gender=${encodeURIComponent(gender)}`;

  const WISHLIST_KEY = 'pp_wishlist_v1';

function hasAccountSession() {
  const user =
    window.ppHasAccountSession?.() ||
    window.__ppAuthCurrentUser ||
    window.__ppLastUser ||
    window.__ppFirebaseAuth?.currentUser ||
    null;

  if (user === true) return true;
  return Boolean(user?.uid && user.emailVerified !== false);
}

function getWishlistStorageKey() {
  const user =
    window.__ppAuthCurrentUser ||
    window.__ppLastUser ||
    window.__ppFirebaseAuth?.currentUser ||
    null;

  return window.ppGetAccountStorageKey?.(WISHLIST_KEY, user) ||
    (user?.uid && user.emailVerified !== false
      ? `${WISHLIST_KEY}:user:${user.uid}`
      : '');
}

function readWishlist() {
  if (!hasAccountSession()) return [];

  const key = getWishlistStorageKey();
  if (!key) return [];

  try {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(data) ? data.filter(item => item && item.id) : [];
  } catch {
    return [];
  }
}

function isWishlisted(id) {
  return readWishlist().some(item => String(item.id) === String(id));
}

  const norm = (v = '') => String(v ?? '').trim().toLowerCase();

  // Decide qué "bucket" de media usar según página
  const pickMedia = (item) => {
    const m = item?.media || {};
    // preferimos el género de la página si existe
    if (PAGE_GENDER && m[PAGE_GENDER]) return m[PAGE_GENDER];
    // fallback típico: hombre
    if (m.hombre) return m.hombre;
    // fallback genérico si algún día lo metes
    if (m.cover || m.images) return m;
    return null;
  };

  const pickCover = (item) => {
    const media = pickMedia(item);
    if (!media) return null;
    return media.cover || (Array.isArray(media.images) ? media.images[0] : null);
  };

  const pickImages = (item) => {
    const media = pickMedia(item);
    if (!media) return [];
    return Array.isArray(media.images) ? media.images : (media.cover ? [media.cover] : []);
  };

  // Mapea color: algunos items tienen color en item.color, otros en variants[]
  const getColors = (item) => {
    const out = new Set();
    if (item.color) out.add(norm(item.color));
    if (Array.isArray(item.variants)) {
      item.variants.forEach(v => v?.color && out.add(norm(v.color)));
    }
    return [...out];
  };

  const getSizes = (item) => {
    const out = new Set();
    if (Array.isArray(item.sizes)) item.sizes.forEach(s => out.add(String(s)));
    if (Array.isArray(item.variants)) item.variants.forEach(v => v?.size && out.add(String(v.size)));
    return [...out];
  };

  const matchesGender = (item) => {
    const g = norm(item.gender);
    const page = norm(PAGE_GENDER);

    // Si la página no define género, no filtramos por género
    if (!page) return true;

    // Si el item es unisex → vale en hombre y mujer
    if (g === 'unisex') return true;

    // Si el item declara explícitamente mujer/hombre
    return g === page;
  };

  const matchesSection = (item) => norm(item.section) === norm(SECTION);

  const hasSellableVariant = (item) =>
    Array.isArray(item?.variants) &&
    item.variants.some((variant) => Number(variant?.stock) > 0);

  // Aplica filtros del drawer usando disponibilidad real de variantes.
  const matchesFilters = (item, filters) => {
    if (!filters) return true;

    if (filters.inStock && !hasSellableVariant(item)) return false;

    if (filters.categories?.length &&
        !filters.categories.includes(norm(item.section))) {
      return false;
    }

    if (filters.colors?.length) {
      const itemColors = getColors(item);
      const ok = filters.colors.some(c => itemColors.includes(norm(c)));
      if (!ok) return false;
    }

    if (filters.sizes?.length) {
      const itemSizes = getSizes(item);
      const ok = filters.sizes.some(s => itemSizes.includes(String(s)));
      if (!ok) return false;
    }

    return true;
  };

  const renderCard = (item) => {
    const cover = pickCover(item);
    const images = pickImages(item);

    // Si no hay ninguna imagen, no pintamos card (evita rotos)
    if (!cover) return null;

    const article = document.createElement('article');
    article.className = images.length > 1 ? 'card has-carousel' : 'card';
    article.dataset.id = item.id;
    article.dataset.imgIndex = '0';
    article.dataset.images = JSON.stringify(images);

    article.innerHTML = `
      <div class="plp-media card-media">
        <a class="card-link" href="${PRODUCT_URL(item.id, PAGE_GENDER)}" aria-label="${escapeHtml(item.title)}">
          <img loading="lazy" src="${cover}" alt="${escapeHtml(item.title)}">
        </a>

        <button
          class="icon-btn save ${isWishlisted(item.id) ? 'is-saved' : ''}"
          type="button"
          data-save
          data-id="${escapeHtml(item.id)}"
          data-title="${escapeHtml(item.title || 'Producto Prophetia')}"
          data-price="${escapeHtml(item.price || '')}"
          data-image="${escapeHtml(cover)}"
          data-url="${PRODUCT_URL(item.id, PAGE_GENDER)}"
          aria-label="${isWishlisted(item.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'}"
          aria-pressed="${isWishlisted(item.id) ? 'true' : 'false'}"
          title="${isWishlisted(item.id) ? 'En Mi selección' : 'Guardar en Mi selección'}"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 10.5c0-2.6 2-4.5 4.5-4.5 1.6 0 3 .9 4 2 1-1.1 2.4-2 4-2 2.5 0 4.5 1.9 4.5 4.5 0 4.4-8.5 9.5-8.5 9.5S3 14.9 3 10.5Z"></path>
          </svg>
        </button>

        ${images.length > 1 ? `
          <button class="nav prev" type="button" aria-label="Imagen anterior"></button>
          <button class="nav next" type="button" aria-label="Imagen siguiente"></button>
        ` : ''}
      </div>

      <div class="card-body">
        <div class="card-title">${escapeHtml(item.title)}</div>
        ${item.short ? `<p class="card-sub">${escapeHtml(item.short)}</p>` : ''}
        <div class="card-meta">
          <span class="card-price">${formatPrice(item.price)}</span>
        </div>
      </div>
    `;

    // Carousel (si hay varias)
    if (images.length > 1) {
      const img = article.querySelector('img');
      const prev = article.querySelector('.nav.prev');
      const next = article.querySelector('.nav.next');

      const setIndex = (idx) => {
        const n = images.length;
        const safe = ((idx % n) + n) % n;
        article.dataset.imgIndex = String(safe);
        img.src = images[safe];
      };

      prev.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setIndex(Number(article.dataset.imgIndex) - 1); });
      next.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setIndex(Number(article.dataset.imgIndex) + 1); });
    }
    return article;
  };

  const formatPrice = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '';
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);
  };

  const escapeHtml = (s) =>
    String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  // Estado
  let CATALOG = [];
  let ACTIVE_FILTERS = {
    colors: [],
    sizes: [],
    categories: [],
    inStock: false,
    scope: 'women'
  };
  let ACTIVE_SORT = 'relevance';

  const normalizeSort = (mode = 'relevance') => {
    const value = String(mode || 'relevance').trim();
    if (value === 'featured') return 'relevance';
    if (value === 'price_asc') return 'price-asc';
    if (value === 'price_desc') return 'price-desc';
    return value || 'relevance';
  };

  const itemDate = (item) => {
    const raw = item.createdAt?.seconds ? item.createdAt.seconds * 1000 : (item.createdAt || item.date || item.publishedAt || 0);
    const value = typeof raw === 'number' ? raw : Date.parse(raw);
    return Number.isFinite(value) ? value : 0;
  };

  const itemSales = (item) => Number(item.sales ?? item.sold ?? item.orderCount ?? item.sortSales ?? 0) || 0;

  const sortItems = (items) => {
    const sorted = items.slice();
    const mode = normalizeSort(ACTIVE_SORT);

    sorted.forEach((item, index) => {
      if (item.__ppOriginalIndex == null) item.__ppOriginalIndex = index;
    });

    sorted.sort((a, b) => {
      if (mode === 'price-asc') return (Number(a.price) || 0) - (Number(b.price) || 0);
      if (mode === 'price-desc') return (Number(b.price) || 0) - (Number(a.price) || 0);
      if (mode === 'name-asc') return String(a.title || '').localeCompare(String(b.title || ''), 'es', { sensitivity: 'base' });
      if (mode === 'name-desc') return String(b.title || '').localeCompare(String(a.title || ''), 'es', { sensitivity: 'base' });
      if (mode === 'best-selling') return itemSales(b) - itemSales(a);
      if (mode === 'newest') return itemDate(b) - itemDate(a);
      if (mode === 'oldest') return itemDate(a) - itemDate(b);
      return Number(a.__ppOriginalIndex || 0) - Number(b.__ppOriginalIndex || 0);
    });

    return sorted;
  };

  const applyAndRender = () => {
    grid.innerHTML = '';

    const items = CATALOG
      .filter(matchesSection)
      .filter(matchesGender)
      .filter(item => matchesFilters(item, ACTIVE_FILTERS));

    const sortedItems = sortItems(items);

    // Render
    const frag = document.createDocumentFragment();
    sortedItems.forEach(item => {
      const card = renderCard(item);
      if (card) frag.appendChild(card);
    });
    grid.appendChild(frag);

    // Notifica recuento para UI (si algún día lo usas)
    window.dispatchEvent(new CustomEvent('pp:plp:count', { detail: { count: sortedItems.length } }));
    document.dispatchEvent(new CustomEvent('pp:plp:rendered', {
      detail: {
        source: 'json',
        count: sortedItems.length,
        section: SECTION,
        gender: PAGE_GENDER
      }
    }));
  };

  // API para filters-drawer.js
  window.ppPLP = window.ppPLP || {};
  window.ppPLP.apply = (filters) => {
    ACTIVE_FILTERS = filters || ACTIVE_FILTERS;
    applyAndRender();
  };
  window.ppPLP.count = (filters) => {
    const f = filters || ACTIVE_FILTERS;
    return CATALOG
      .filter(matchesSection)
      .filter(matchesGender)
      .filter(item => matchesFilters(item, f))
      .length;
  };
  window.ppPLP.sort = (mode = 'relevance') => {
    ACTIVE_SORT = normalizeSort(mode);
    applyAndRender();
  };

  window.ppPLP.getProduct = (productId) => {
    const id = String(productId || '').trim();
    if (!id) return null;

    return CATALOG.find((item) => {
      return String(item?.id || '') === id || String(item?._id || '') === id;
    }) || null;
  };

  // Escucha eventos del drawer (por si decides usar eventos en vez de llamar apply)
  window.addEventListener('pp:filters:apply', (e) => window.ppPLP.apply(e.detail));
  window.addEventListener('pp:filters:change', (e) => {
    // solo actualiza contador (drawer ya llama count si existe)
    // aquí no hacemos render para no repintar mientras el usuario marca
  });

  // Load catalog + primer render
  (async () => {
    try {
      const res = await fetch(CATALOG_URL, { cache: 'no-store' });
      const ct = res.headers.get('content-type') || '';
      console.info('[PLP JSON] fetch', { ok: res.ok, status: res.status, ct });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!ct.includes('json')) {
        const txt = await res.text();
        throw new Error(`No es JSON (content-type: ${ct}). Primeros 120 chars: ${txt.slice(0,120)}`);
      }

      CATALOG = await res.json();
      console.info('[PLP JSON] catalog loaded', { items: CATALOG.length });

      applyAndRender();

      // si tras render hay 0, lo mostramos explícito
      if (!grid.children.length) {
        debugFail(`0 resultados para section="${SECTION}" gender="${PAGE_GENDER}". Revisa section en JSON o data-section.`);
      }

    } catch (err) {
      debugFail('No se pudo cargar el catalog.json. Mira consola.', err?.message || err);
    }
  })();

})();

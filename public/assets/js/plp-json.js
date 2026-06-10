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

function readWishlist() {
  try {
    const data = JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]');
    return Array.isArray(data) ? data.filter(item => item && item.id) : [];
  } catch {
    return [];
  }
}

function writeWishlist(items) {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(Array.isArray(items) ? items : []));

  window.dispatchEvent(new CustomEvent('pp:wishlist-updated', {
    detail: {
      count: readWishlist().length
    }
  }));
}

function isWishlisted(id) {
  return readWishlist().some(item => String(item.id) === String(id));
}

function toggleWishlist(item) {
  if (!item || !item.id) return;

  const list = readWishlist();
  const exists = list.some(entry => String(entry.id) === String(item.id));

  if (exists) {
    writeWishlist(list.filter(entry => String(entry.id) !== String(item.id)));
    return false;
  }

  const cover = pickCover(item);

  list.push({
    id: item.id,
    title: item.title || 'Producto Prophetia',
    price: item.price || '',
    image: cover || '',
    url: PRODUCT_URL(item.id, PAGE_GENDER)
  });

  writeWishlist(list);
  return true;
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

  // Aplica filtros del drawer (colors, sizes, inStock)
  const matchesFilters = (item, filters) => {
    if (!filters) return true;

    if (filters.inStock && !item.inStock) return false;

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
    article.className = 'card has-carousel';
    article.dataset.id = item.id;
    article.dataset.index = '0';
    article.dataset.images = JSON.stringify(images);

    article.innerHTML = `
      <div class="plp-media card-media">
        <a class="card-link" href="${PRODUCT_URL(item.id, PAGE_GENDER)}" aria-label="${escapeHtml(item.title)}">
          <img loading="lazy" src="${cover}" alt="${escapeHtml(item.title)}">
        </a>
        <div class="plp-media card-media">
  <a class="card-link" href="${PRODUCT_URL(item.id, PAGE_GENDER)}" aria-label="${escapeHtml(item.title)}">
    <img loading="lazy" src="${cover}" alt="${escapeHtml(item.title)}">
  </a>

  <button
    class="save-btn ${isWishlisted(item.id) ? 'is-saved' : ''}"
    type="button"
    data-plp-wishlist
    aria-label="${isWishlisted(item.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'}"
  >
    <svg class="icon-heart" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12.1 20.1C11.8 20.1 4 14.7 3.2 9.6C2.8 6.8 4.9 4.5 7.5 4.5c1.7 0 3.2.9 4.1 2.3A5 5 0 0 1 19 4.5c2.6 0 4.7 2.3 4.3 5.1c-.8 5.1-8.6 10.5-9.1 10.5z"
        stroke="currentColor" stroke-width="1.5"/>
    </svg>
  </button>

        ${images.length > 1 ? `
          <button class="nav prev" type="button" aria-label="Imagen anterior"></button>
          <button class="nav next" type="button" aria-label="Imagen siguiente"></button>
        ` : ''}
      </div>

      <div class="card-body">
        <div class="card-title">${escapeHtml(item.title)}</div>
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
        article.dataset.index = String(safe);
        img.src = images[safe];
      };

      prev.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setIndex(Number(article.dataset.index) - 1); });
      next.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setIndex(Number(article.dataset.index) + 1); });
    }
const wishlistBtn = article.querySelector('[data-plp-wishlist]');

wishlistBtn?.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();

  const saved = toggleWishlist(item);

  wishlistBtn.classList.toggle('is-saved', saved);
  wishlistBtn.setAttribute(
    'aria-label',
    saved ? 'Quitar de favoritos' : 'Guardar en favoritos'
  );
});
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
  let ACTIVE_FILTERS = { colors: [], sizes: [], inStock: false, scope: 'women' };

  const applyAndRender = () => {
    grid.innerHTML = '';

    const items = CATALOG
      .filter(matchesSection)
      .filter(matchesGender)
      .filter(item => matchesFilters(item, ACTIVE_FILTERS));

    // Render
    const frag = document.createDocumentFragment();
    items.forEach(item => {
      const card = renderCard(item);
      if (card) frag.appendChild(card);
    });
    grid.appendChild(frag);

    // Notifica recuento para UI (si algún día lo usas)
    window.dispatchEvent(new CustomEvent('pp:plp:count', { detail: { count: items.length } }));
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

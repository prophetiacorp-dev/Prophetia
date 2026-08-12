
/* =========================================================
   PROPHETIA · STOREFRONT MODE
   Fail-closed: mientras no llegue la configuración, no se vende.
   ========================================================= */
(function initStorefrontMode() {
  if (window.ppStorefront?.ready) return;

  let resolveReady;
  const state = {
    salesEnabled: false,
    checkoutEnabled: false,
    loaded: false,
    mode: 'prelaunch',
    label: 'Próximamente',
    message: 'Estamos preparando el primer drop Atlas. Explora la colección y activa el aviso para tu talla.',
    checkoutMessage: 'Estamos configurando los métodos y tarifas de envío. La compra se habilitará próximamente.',
    ready: new Promise((resolve) => {
      resolveReady = resolve;
    })
  };

  window.ppStorefront = state;

  function ensurePrelaunchBanner() {
    if (state.salesEnabled || document.body.classList.contains('checkout-page')) {
      document.getElementById('ppPrelaunchBanner')?.remove();
      return null;
    }

    let banner = document.getElementById('ppPrelaunchBanner');
    if (!banner) {
      banner = document.createElement('section');
      banner.id = 'ppPrelaunchBanner';
      banner.className = 'pp-prelaunch-banner';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-label', 'Estado del lanzamiento');
      banner.innerHTML = `
        <strong>PRÓXIMAMENTE</strong>
        <span data-prelaunch-message></span>
      `;

      const headerHost = document.getElementById('header');
      if (headerHost) headerHost.insertAdjacentElement('beforebegin', banner);
      else document.body.prepend(banner);
    }

    const message = banner.querySelector('[data-prelaunch-message]');
    if (message) message.textContent = state.message;
    banner.setAttribute('aria-label', `${state.label}. ${state.message}`);
    return banner;
  }

  function renderCheckoutGate() {
    if (!document.body.classList.contains('checkout-page')) return;

    const shell = document.querySelector('.ck-shell');
    const existing = document.getElementById('ppPrelaunchGate');

    if (state.salesEnabled && state.checkoutEnabled) {
      if (shell) shell.hidden = false;
      existing?.remove();
      return;
    }

    if (shell) shell.hidden = true;
    if (existing) return;

    const gate = document.createElement('section');
    gate.id = 'ppPrelaunchGate';
    gate.className = 'pp-prelaunch-gate';
    gate.setAttribute('aria-labelledby', 'ppPrelaunchGateTitle');
    gate.innerHTML = `
      <p class="pp-prelaunch-gate__kicker">PRIMER DROP · ATLAS</p>
      <h1 id="ppPrelaunchGateTitle">Próximamente</h1>
      <p>${state.checkoutMessage}</p>
      <a href="/hombre">Explorar la colección</a>
    `;

    document.querySelector('main.ck')?.appendChild(gate);
  }

  function syncPrelaunchCart() {
    const button = document.querySelector('.cart-checkout, [data-cart-checkout]');
    if (!button) return;

    const checkoutNote = document.querySelector('[data-cart-checkout-note]');
    const hasItems = button.dataset.cartHasItems === 'true';
    const canCheckout = state.salesEnabled && state.checkoutEnabled && hasItems;
    button.disabled = !canCheckout;
    button.setAttribute('aria-disabled', String(!canCheckout));

    if (checkoutNote) {
      checkoutNote.hidden = canCheckout;
      checkoutNote.textContent = state.checkoutMessage;
    }

    if (canCheckout) {
      if (button.dataset.prelaunchLabel === 'true') {
        button.textContent = 'Finalizar compra';
        delete button.dataset.prelaunchLabel;
      }
      return;
    }

    if (!state.salesEnabled) {
      button.textContent = 'Ventas próximamente';
      button.dataset.prelaunchLabel = 'true';
    } else {
      button.textContent = 'Finalizar compra';
      delete button.dataset.prelaunchLabel;
    }
  }

  function applyStorefrontMode() {
    document.documentElement.dataset.storefrontMode = state.mode;
    document.documentElement.dataset.checkoutEnabled = String(state.checkoutEnabled);
    document.body.classList.toggle('pp-prelaunch-mode', !state.salesEnabled);
    ensurePrelaunchBanner();
    renderCheckoutGate();
    syncPrelaunchCart();
  }

  window.ppShowPrelaunchNotice = () => {
    const banner = ensurePrelaunchBanner();
    if (banner) {
      banner.classList.remove('is-emphasized');
      void banner.offsetWidth;
      banner.classList.add('is-emphasized');
      banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    renderCheckoutGate();
  };

  window.ppShowCheckoutDisabledNotice = () => {
    const note = document.querySelector('[data-cart-checkout-note]');
    if (!note) return;
    note.hidden = false;
    note.setAttribute('tabindex', '-1');
    note.focus({ preventScroll: true });
  };

  window.addEventListener('partials:ready', syncPrelaunchCart);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyStorefrontMode, { once: true });
  } else {
    applyStorefrontMode();
  }

  fetch('/api/storefront-config', {
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((config) => {
      state.salesEnabled = config?.salesEnabled === true;
      state.checkoutEnabled = config?.checkoutEnabled === true;
      state.mode = state.salesEnabled ? 'sales' : 'prelaunch';
      state.label = String(config?.label || state.label);
      state.message = String(config?.message || state.message);
      state.checkoutMessage = String(
        config?.checkoutMessage ||
        'Estamos configurando los métodos y tarifas de envío. La compra se habilitará próximamente.'
      );
    })
    .catch((error) => {
      console.warn('[storefront] configuración no disponible; ventas bloqueadas:', error.message);
      state.salesEnabled = false;
      state.checkoutEnabled = false;
      state.mode = 'prelaunch';
    })
    .finally(() => {
      state.loaded = true;
      applyStorefrontMode();
      resolveReady(state);
      window.dispatchEvent(new CustomEvent('pp:storefront-config', {
        detail: {
          salesEnabled: state.salesEnabled,
          checkoutEnabled: state.checkoutEnabled,
          mode: state.mode
        }
      }));
    });
})();

  /* =============== Utils =============== */
  const $  = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  /* =============== Búsqueda compartida de catálogo =============== */
  const ppCatalogSearch = (() => {
    let catalogPromise = null;

    const sectionAliases = {
      'camisetas-punto': 'camiseta camisetas camiseta de punto camisetas de punto',
      'sudaderas-punto': 'sudadera sudaderas sudadera de punto sudaderas de punto',
      hoodies: 'hoodie hoodies sudadera sudaderas capucha',
      streetwear: 'streetwear ropa urbana'
    };

    const typeAliases = {
      tshirt: 'camiseta camisetas tee',
      hoodie: 'hoodie sudadera capucha',
      sweatshirt: 'sudadera sudaderas'
    };

    const colorAliases = {
      white: 'blanco blanca',
      black: 'negro negra',
      blue: 'azul',
      green: 'verde',
      red: 'rojo roja',
      grey: 'gris',
      gray: 'gris',
      beige: 'beige',
      brown: 'marrón marron'
    };

    function normalize(value) {
      return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es')
        .replace(/[-_/]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function labelsOf(item) {
      return Array.isArray(item?.labels)
        ? item.labels.map((label) => typeof label === 'string' ? label : label?.label)
        : [];
    }

    function searchText(item) {
      const colors = [item?.color, ...(Array.isArray(item?.colors) ? item.colors : [])]
        .filter(Boolean);
      const aliases = [
        sectionAliases[item?.section],
        typeAliases[item?.type],
        ...colors.map((color) => colorAliases[normalize(color)])
      ];

      return normalize([
        item?.id,
        item?.slug,
        item?.title,
        item?.short,
        item?.long,
        item?.section,
        item?.collection,
        item?.collectionLabel,
        item?.gender,
        item?.type,
        ...colors,
        ...labelsOf(item),
        ...aliases
      ].filter(Boolean).join(' '));
    }

    function load() {
      if (!catalogPromise) {
        catalogPromise = fetch('/assets/data/catalog.json', {
          cache: 'no-store',
          headers: { Accept: 'application/json' }
        })
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
          })
          .then((payload) => {
            if (Array.isArray(payload)) return payload;
            if (Array.isArray(payload?.products)) return payload.products;
            throw new Error('Formato de catálogo no reconocido');
          })
          .catch((error) => {
            catalogPromise = null;
            throw error;
          });
      }

      return catalogPromise;
    }

    async function search(rawQuery, { limit = 8 } = {}) {
      const query = normalize(rawQuery);
      if (!query) return [];

      const tokens = query.split(' ').filter(Boolean);
      const catalog = await load();

      return catalog
        .filter((item) => item?.active !== false && (String(item?.slug || '').trim() || String(item?.id || '').trim()))
        .map((item, index) => {
          const title = normalize(item?.title);
          const id = normalize(item?.id);
          const section = normalize(`${item?.section || ''} ${sectionAliases[item?.section] || ''}`);
          const haystack = searchText(item);
          const matches = tokens.every((token) => haystack.includes(token));
          let score = 5;
          if (title.startsWith(query)) score = 0;
          else if (title.includes(query)) score = 1;
          else if (section.includes(query)) score = 2;
          else if (id.includes(query)) score = 3;
          else if (haystack.includes(query)) score = 4;
          return { item, index, score, matches };
        })
        .filter((entry) => entry.matches)
        .sort((a, b) => a.score - b.score || a.index - b.index)
        .slice(0, limit)
        .map((entry) => entry.item);
    }

    function productUrl(item) {
      const reference = String(item?.slug || item?.id || '').trim();
      return reference ? `/producto?id=${encodeURIComponent(reference)}` : '';
    }

    function productMeta(item) {
      return [item?.collectionLabel || item?.collection, item?.section, item?.type]
        .map((value) => String(value || '').replace(/-/g, ' ').trim())
        .filter(Boolean)
        .join(' · ');
    }

    function productImage(item) {
      return String(
        item?.media?.mujer?.cover ||
        item?.media?.hombre?.cover ||
        item?.variants?.find?.((variant) => variant?.img)?.img ||
        ''
      ).trim();
    }

    function formatPrice(value) {
      const amount = Number(value);
      if (!Number.isFinite(amount)) return '';
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
      }).format(amount);
    }

    return { formatPrice, normalize, productImage, productMeta, productUrl, search };
  })();

  function appendHighlightedText(target, text, rawQuery) {
    const source = String(text || '');
    const query = String(rawQuery || '').trim();
    const start = source.toLocaleLowerCase('es').indexOf(query.toLocaleLowerCase('es'));
    if (!query || start < 0) {
      target.textContent = source;
      return;
    }

    target.append(document.createTextNode(source.slice(0, start)));
    const mark = document.createElement('mark');
    mark.textContent = source.slice(start, start + query.length);
    target.append(mark, document.createTextNode(source.slice(start + query.length)));
  }

  function initHeaderSearch() {
    const form = document.querySelector('#header .search-inline');
    const input = form?.querySelector('.search-input');
    const listbox = form?.querySelector('#ppDesktopSearchMenu');
    if (!form || !input || !listbox) return;

    const previousController = window.__ppHeaderSearchController;
    if (form.dataset.ppSearchBound === 'true') return;
    if (previousController?.isCurrent?.(form)) return;
    previousController?.destroy?.();

    const lifecycle = new AbortController();
    const { signal } = lifecycle;
    let results = [];
    let activeIndex = -1;
    let searchTimer = 0;
    let searchRevision = 0;

    form.dataset.ppSearchBound = 'true';

    const queryFromUrl = new URLSearchParams(window.location.search).get('q');
    if (window.location.pathname === '/colecciones' && queryFromUrl && !input.value) {
      input.value = queryFromUrl.slice(0, 128);
    }

    function setExpanded(expanded) {
      input.setAttribute('aria-expanded', String(expanded));
      listbox.hidden = !expanded;
    }

    function clearSuggestions() {
      window.clearTimeout(searchTimer);
      searchRevision += 1;
      results = [];
      activeIndex = -1;
      listbox.replaceChildren();
      input.removeAttribute('aria-activedescendant');
      setExpanded(false);
    }

    function setActive(index) {
      const options = Array.from(listbox.querySelectorAll('[role="option"]'));
      if (!options.length) return;

      activeIndex = Math.max(-1, Math.min(index, options.length - 1));
      options.forEach((option, optionIndex) => {
        option.setAttribute('aria-selected', String(optionIndex === activeIndex));
      });

      const activeOption = options[activeIndex];
      if (activeOption) {
        input.setAttribute('aria-activedescendant', activeOption.id);
        activeOption.scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }

    function createOption({ title, meta = '', href, query, modifier = '' }, index) {
      const option = document.createElement('li');
      option.id = `ppDesktopSearchOption${index}`;
      option.className = `pp-search-suggestion${modifier ? ` ${modifier}` : ''}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.dataset.href = href;
      option.dataset.optionIndex = String(index);

      const titleElement = document.createElement('span');
      titleElement.className = 'pp-search-suggestion__title';
      appendHighlightedText(titleElement, title, query);
      option.appendChild(titleElement);

      if (meta) {
        const metaElement = document.createElement('span');
        metaElement.className = 'pp-search-suggestion__meta';
        metaElement.textContent = meta;
        option.appendChild(metaElement);
      }

      return option;
    }

    function renderStatus(message) {
      const status = document.createElement('li');
      status.className = 'pp-search-suggestion pp-search-suggestion--status';
      status.textContent = message;
      listbox.replaceChildren(status);
      listbox.removeAttribute('aria-busy');
      results = [];
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
      setExpanded(true);
    }

    function renderSuggestions(items, query) {
      const options = items.map((item) => ({
        title: String(item?.title || item?.id || 'Producto'),
        meta: ppCatalogSearch.productMeta(item),
        href: ppCatalogSearch.productUrl(item),
        query
      }));
      options.push({
        title: `Ver todos los resultados para “${query}”`,
        href: `/colecciones?q=${encodeURIComponent(query)}`,
        modifier: 'pp-search-suggestion--all'
      });

      results = options;
      listbox.replaceChildren(...options.map(createOption));
      listbox.removeAttribute('aria-busy');
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
      setExpanded(true);
    }

    async function runSearch(rawQuery) {
      const query = String(rawQuery || '').trim();
      const revision = ++searchRevision;
      if (query.length < 2) {
        clearSuggestions();
        return;
      }

      listbox.setAttribute('aria-busy', 'true');
      try {
        const items = await ppCatalogSearch.search(query, { limit: 5 });
        if (revision !== searchRevision) return;
        if (!items.length) {
          renderStatus('No hay resultados para esta búsqueda.');
          return;
        }
        renderSuggestions(items, query);
      } catch (error) {
        if (revision !== searchRevision) return;
        console.error('[search] catálogo no disponible:', error);
        renderStatus('No se ha podido cargar la búsqueda. Inténtalo de nuevo.');
      }
    }

    input.addEventListener('input', () => {
      window.clearTimeout(searchTimer);
      searchRevision += 1;
      const query = input.value.trim();
      if (query.length < 2) {
        clearSuggestions();
        return;
      }
      searchTimer = window.setTimeout(() => runSearch(query), 140);
    }, { signal });

    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 2) runSearch(input.value);
    }, { signal });

    input.addEventListener('keydown', (event) => {
      const options = Array.from(listbox.querySelectorAll('[role="option"]'));

      if (event.key === 'Escape' && !listbox.hidden) {
        event.preventDefault();
        clearSuggestions();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!options.length) return;
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const next = activeIndex < 0
          ? (direction > 0 ? 0 : options.length - 1)
          : (activeIndex + direction + options.length) % options.length;
        setActive(next);
        return;
      }

      if (event.key === 'Enter') {
        const query = input.value.trim();
        const target = activeIndex >= 0
          ? results[activeIndex]?.href
          : query ? `/colecciones?q=${encodeURIComponent(query)}` : '';
        if (!target) return;
        event.preventDefault();
        window.location.assign(target);
      }
    }, { signal });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const query = input.value.trim();
      if (!query) {
        clearSuggestions();
        return;
      }
      input.value = query;
      window.location.assign(`/colecciones?q=${encodeURIComponent(query)}`);
    }, { signal });

    listbox.addEventListener('pointerdown', (event) => {
      if (event.target.closest('[data-href]')) event.preventDefault();
    }, { signal });

    listbox.addEventListener('pointerover', (event) => {
      const option = event.target.closest('[data-option-index]');
      if (option) setActive(Number(option.dataset.optionIndex));
    }, { signal });

    listbox.addEventListener('click', (event) => {
      const option = event.target.closest('[data-href]');
      if (!option) return;
      window.location.assign(option.dataset.href);
    }, { signal });

    document.addEventListener('pointerdown', (event) => {
      if (!form.contains(event.target)) clearSuggestions();
    }, { signal, capture: true });

    const controller = {
      destroy() {
        lifecycle.abort();
        clearSuggestions();
        delete form.dataset.ppSearchBound;
      },
      isCurrent(candidate) {
        return candidate === form && form.isConnected;
      }
    };
    window.__ppHeaderSearchController = controller;
  }

  function initCollectionSearchPage() {
    const page = document.querySelector('.colecciones-index-page');
    const searchSection = document.getElementById('ppCollectionSearch');
    if (!page || !searchSection || searchSection.dataset.ppSearchBound === 'true') return;

    const query = String(new URLSearchParams(window.location.search).get('q') || '')
      .trim()
      .slice(0, 128);
    if (!query) return;

    const queryLabel = searchSection.querySelector('[data-pp-search-query]');
    const status = searchSection.querySelector('[data-pp-search-status]');
    const grid = searchSection.querySelector('[data-pp-search-grid]');
    if (!queryLabel || !status || !grid) return;

    searchSection.dataset.ppSearchBound = 'true';
    page.classList.add('is-searching');
    searchSection.hidden = false;
    queryLabel.textContent = query;
    status.textContent = 'Buscando productos…';
    grid.setAttribute('aria-busy', 'true');
    document.title = `Buscar “${query}” | PROPHETIA`;

    ppCatalogSearch.search(query, { limit: 100 })
      .then((items) => {
        const fragment = document.createDocumentFragment();

        items.forEach((item) => {
          const href = ppCatalogSearch.productUrl(item);
          if (!href) return;

          const card = document.createElement('a');
          card.className = 'pp-collection-search-card';
          card.href = href;

          const media = document.createElement('span');
          media.className = 'pp-collection-search-card__media';
          const imageUrl = ppCatalogSearch.productImage(item);
          if (imageUrl) {
            const image = document.createElement('img');
            image.src = imageUrl;
            image.alt = String(item?.title || 'Producto Prophetia');
            image.loading = 'lazy';
            image.decoding = 'async';
            media.appendChild(image);
          } else {
            const placeholder = document.createElement('span');
            placeholder.className = 'pp-collection-search-card__placeholder';
            placeholder.textContent = 'PROPHETIA';
            media.appendChild(placeholder);
          }

          const body = document.createElement('span');
          body.className = 'pp-collection-search-card__body';

          const meta = document.createElement('span');
          meta.className = 'pp-collection-search-card__meta';
          meta.textContent = ppCatalogSearch.productMeta(item) || 'Prophetia';

          const title = document.createElement('strong');
          title.className = 'pp-collection-search-card__title';
          title.textContent = String(item?.title || item?.id || 'Producto');

          const description = document.createElement('span');
          description.className = 'pp-collection-search-card__description';
          description.textContent = String(item?.short || '');

          const footer = document.createElement('span');
          footer.className = 'pp-collection-search-card__footer';
          const price = document.createElement('span');
          price.textContent = ppCatalogSearch.formatPrice(item?.price);
          const cta = document.createElement('span');
          cta.textContent = 'Ver pieza →';
          footer.append(price, cta);

          body.append(meta, title);
          if (description.textContent) body.appendChild(description);
          body.appendChild(footer);
          card.append(media, body);
          fragment.appendChild(card);
        });

        grid.replaceChildren(fragment);
        grid.removeAttribute('aria-busy');
        grid.classList.toggle('is-empty', items.length === 0);
        status.textContent = items.length === 1
          ? '1 resultado encontrado.'
          : `${items.length} resultados encontrados.`;

        if (!items.length) {
          const empty = document.createElement('p');
          empty.className = 'pp-collection-search__empty';
          empty.textContent = 'Prueba con otro nombre, colección, tipo de prenda o color.';
          grid.appendChild(empty);
        }
      })
      .catch((error) => {
        console.error('[search-page] catálogo no disponible:', error);
        grid.removeAttribute('aria-busy');
        grid.classList.add('is-empty');
        status.textContent = 'No se ha podido cargar la búsqueda.';
        const retry = document.createElement('a');
        retry.className = 'pp-collection-search__empty';
        retry.href = window.location.href;
        retry.textContent = 'Volver a intentarlo';
        grid.replaceChildren(retry);
      });
  }

  /* =============== Parciales (header/footer) =============== */
  let partialsInjected = false;
  let partialsInjectionPromise = null;

  async function injectPartial(hostId, url) {
    const host = document.getElementById(hostId);
    if (!host) return false;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
    host.innerHTML = await res.text();
    return true;
  }

function getAuthModal() {
  return document.getElementById('ppAuthModal');
}

function portalNodeToBody(node) {
  if (!(node instanceof HTMLElement) || !document.body) return false;

  let origin = node.__ppPortalOrigin;
  if (!origin?.anchor?.isConnected) {
    // Un nodo ya huérfano en body nunca debe tomar body como nuevo origen.
    if (!node.parentNode || node.parentElement === document.body) return false;

    const anchor = document.createComment(`pp-portal-origin:${node.id || node.className || node.tagName}`);
    const parent = node.parentNode;
    parent.insertBefore(anchor, node);
    origin = { anchor, parent };
    node.__ppPortalOrigin = origin;
  }

  if (node.parentElement !== document.body) document.body.appendChild(node);
  return node.parentElement === document.body;
}

function restorePortaledNode(node, { removeIfOrphaned = false } = {}) {
  const origin = node?.__ppPortalOrigin;
  if (!origin) return false;

  const canRestore = origin.anchor?.parentNode && origin.parent?.isConnected;
  if (canRestore) {
    origin.anchor.parentNode.insertBefore(node, origin.anchor.nextSibling);
  } else if (removeIfOrphaned) {
    node.remove();
  }

  origin.anchor?.remove();
  delete node.__ppPortalOrigin;
  return Boolean(canRestore);
}

function waitForGlobalFn(fnName, timeoutMs = 1800) {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const fn = window[fnName];
      if (typeof fn === "function") return resolve(fn);
      if (Date.now() - start > timeoutMs) return resolve(null);
      setTimeout(tick, 50);
    };
    tick();
  });
}
/* =========================================================
   PROPHETIA · Header auth icon normalizer
   Evita doble icono login/perfil en header
   ========================================================= */
function normalizeHeaderAuthIcons() {
  const header = document.getElementById("header");
  if (!header) return;

  const account = header.querySelector(".pp-account");
  if (!account) return;

  const guestBtns = Array.from(account.querySelectorAll("#ppAuthLogoBtn"));
  const profileBtns = Array.from(account.querySelectorAll("#ppProfileChip, [data-pp-profile]"));

  // Si por error hay duplicados con el mismo ID, dejamos solo el primero.
  guestBtns.slice(1).forEach((btn) => btn.remove());
  profileBtns.slice(1).forEach((btn) => btn.remove());

  const guestBtn = account.querySelector("#ppAuthLogoBtn");
  const profileBtn = account.querySelector("#ppProfileChip, [data-pp-profile]");

  const isLogged = document.body.classList.contains("pp-auth-logged");

  if (guestBtn) {
    guestBtn.hidden = isLogged;
    guestBtn.style.display = isLogged ? "none" : "inline-flex";
    guestBtn.setAttribute("aria-hidden", isLogged ? "true" : "false");
  }

  if (profileBtn) {
    profileBtn.hidden = !isLogged;
    profileBtn.style.display = isLogged ? "inline-flex" : "none";
    profileBtn.setAttribute("aria-hidden", isLogged ? "false" : "true");
  }
}

/* =========================================================
   PROPHETIA · Navegación inferior móvil
   La hoja mobile-shell.css decide el modo hasta 820px. El dock
   queda fail-closed si esa hoja no está disponible.
   ========================================================= */
function initMobileDock() {
  const headerHost = document.getElementById('header');
  const previousController = window.__ppMobileDockController;
  if (previousController?.isCurrentHeader?.(headerHost)) {
    previousController.sync?.();
    return;
  }
  previousController?.destroy?.({ removeNodes: true });

  const dock = headerHost?.querySelector('.pp-mobile-dock');
  const panel = headerHost?.querySelector('#ppMobileMenuPanel');
  if (!headerHost || !dock || !panel) return;
  if (dock.dataset.ppMobileBound === 'true') delete dock.dataset.ppMobileBound;

  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  let destroyed = false;
  let cartCountObserver = null;
  let headerObserver = null;
  let legacyMediaListener = false;
  let controllerApi = null;
  const listenerCleanups = [];

  function listen(target, type, listener, options = {}) {
    if (!target?.addEventListener) return false;
    try {
      target.addEventListener(type, listener, { ...options, signal });
    } catch {
      target.addEventListener(type, listener, options);
    }
    listenerCleanups.push(() => {
      target.removeEventListener?.(type, listener, Boolean(options.capture));
    });
    return true;
  }

  dock.dataset.ppMobileBound = 'true';

  const mobileQuery = window.matchMedia('(max-width: 820px)');
  const mobileStyles = document.querySelector('link[data-pp-mobile-shell]');
  const menuButton = dock.querySelector('[data-pp-mobile-menu]');
  const searchButton = dock.querySelector('[data-pp-mobile-search]');
  const accountButton = dock.querySelector('[data-pp-mobile-account]');
  const cartButton = dock.querySelector('[data-pp-mobile-cart]');
  const closeButton = panel.querySelector('[data-pp-mobile-close]');
  const backButton = panel.querySelector('[data-pp-mobile-back]');
  const searchInput = panel.querySelector('#ppMobileSearchInput');
  const searchForm = searchInput?.closest('form');
  const searchClearButton = panel.querySelector('[data-pp-mobile-search-clear]');
  const mobileCount = dock.querySelector('[data-pp-mobile-cart-count]');
  const tabs = Array.from(panel.querySelectorAll('[data-pp-mobile-tab]'));
  const sections = Array.from(panel.querySelectorAll('[data-pp-mobile-section]'));
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let returnFocus = null;
  let searchTimer = 0;
  let searchRevision = 0;
  let searchResults = null;
  let activeSublevel = null;
  let panelTransitionRevision = 0;
  let sectionTransitionRevision = 0;
  let levelTransitionRevision = 0;
  let suspendedPanelFocus = [];

  function setExpanded(source = null) {
    menuButton?.setAttribute('aria-expanded', source === 'menu' ? 'true' : 'false');
    searchButton?.setAttribute('aria-expanded', source === 'search' ? 'true' : 'false');
  }

  function motionDuration(duration) {
    return reducedMotionQuery.matches ? 0 : duration;
  }

  function afterNextPaint(callback) {
    window.requestAnimationFrame(() => window.requestAnimationFrame(callback));
  }

  function restorePanelFocusability() {
    suspendedPanelFocus.forEach(({ element, tabIndex }) => {
      if (!element.isConnected) return;
      if (tabIndex === null) element.removeAttribute('tabindex');
      else element.setAttribute('tabindex', tabIndex);
    });
    suspendedPanelFocus = [];
  }

  function suspendPanelFocusability() {
    restorePanelFocusability();
    suspendedPanelFocus = Array.from(panel.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]'
    )).map((element) => ({
      element,
      tabIndex: element.getAttribute('tabindex')
    }));
    suspendedPanelFocus.forEach(({ element }) => element.setAttribute('tabindex', '-1'));
  }

  function waitForMotion(element, duration, propertyNames = []) {
    const wait = motionDuration(duration);
    if (!(element instanceof Element) || wait === 0 || destroyed) return Promise.resolve();

    return new Promise((resolve) => {
      let timer = 0;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        element.removeEventListener('transitionend', onTransitionEnd);
        signal.removeEventListener('abort', finish);
        resolve();
      };
      const onTransitionEnd = (event) => {
        if (event.target !== element) return;
        if (propertyNames.length && !propertyNames.includes(event.propertyName)) return;
        finish();
      };

      element.addEventListener('transitionend', onTransitionEnd);
      signal.addEventListener('abort', finish, { once: true });
      timer = window.setTimeout(finish, wait + 80);
    });
  }

  function syncMobileHouseNavigation() {
    const source = headerHost.querySelector('#panel-house [data-pp-house-source]');
    const target = panel.querySelector('#ppMobileSectionHouse [data-pp-house-target]');
    if (!source || !target) return false;

    const links = Array.from(source.querySelectorAll(':scope > li > a[href]'));
    const fragment = document.createDocumentFragment();
    links.forEach((sourceLink) => {
      const item = sourceLink.closest('li')?.cloneNode(true);
      if (item) fragment.appendChild(item);
    });
    target.replaceChildren(fragment);
    target.dataset.ppHouseSynced = String(links.length);
    return links.length > 0;
  }

  function sectionForPath(pathname) {
    if (pathname === '/hombre' || pathname === '/hoodies' || pathname.endsWith('-hombre')) {
      return 'men';
    }

    if (pathname === '/mujer' || pathname === '/hoodies-mujer' || pathname.endsWith('-mujer')) {
      return 'women';
    }

    if (
      pathname === '/colecciones' ||
      pathname.startsWith('/colecciones/') ||
      pathname.startsWith('/assets/collects/')
    ) {
      return 'collections';
    }

    if (['/about', '/studio', '/musica', '/events'].includes(pathname)) return 'house';
    if (pathname === '/prophetia-originals') return 'originals';

    return 'women';
  }

  function activateSection(name, { focus = false } = {}) {
    const selectedTab = tabs.find((tab) => tab.dataset.ppMobileTab === name) || tabs[0];
    if (!selectedTab) return;

    const selectedName = selectedTab.dataset.ppMobileTab;
    const currentTab = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    const outgoing = sections.find(
      (section) => section.dataset.ppMobileSection === currentTab?.dataset.ppMobileTab
    ) || sections.find((section) => !section.hidden);
    const incoming = sections.find((section) => section.dataset.ppMobileSection === selectedName);
    if (!incoming) return;

    const shouldMeasureTab = !panel.hidden && panel.classList.contains('is-open');
    const tabList = selectedTab.parentElement;
    const selectedTabRect = shouldMeasureTab ? selectedTab.getBoundingClientRect() : null;
    const tabListRect = shouldMeasureTab ? tabList?.getBoundingClientRect() : null;

    const revision = ++sectionTransitionRevision;
    levelTransitionRevision += 1;
    sections.forEach((section) => {
      const wasCurrent = section === outgoing;
      section.hidden = !wasCurrent;
      section.classList.remove('is-tab-entering', 'is-tab-leaving', 'is-submenu-open');
      section.classList.toggle('is-active', wasCurrent);
      section.querySelectorAll('.pp-mobile-menu__views-track').forEach((track) => {
        track.classList.remove('is-level-transitioning');
      });
      section.querySelectorAll('[data-pp-mobile-level]').forEach((level) => {
        level.hidden = false;
      });
    });

    tabs.forEach((tab) => {
      const active = tab === selectedTab;
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
    });

    activeSublevel = null;
    const shouldAnimate = !panel.hidden &&
      panel.classList.contains('is-open') &&
      outgoing &&
      outgoing !== incoming &&
      !reducedMotionQuery.matches;

    sections.forEach((section) => {
      const isSelected = section === incoming;
      section.setAttribute('aria-hidden', isSelected ? 'false' : 'true');
      section.toggleAttribute('inert', !isSelected);
    });

    if (!shouldAnimate) {
      sections.forEach((section) => {
        const isSelected = section === incoming;
        section.hidden = !isSelected;
        section.classList.toggle('is-active', isSelected);
      });
      syncSublevelState();
    } else {
      outgoing.hidden = false;
      incoming.hidden = false;
      outgoing.classList.add('is-active');
      incoming.classList.add('is-tab-entering');
      syncSublevelState();

      afterNextPaint(async () => {
        if (revision !== sectionTransitionRevision || destroyed) return;
        outgoing.classList.remove('is-active');
        outgoing.classList.add('is-tab-leaving');
        incoming.classList.remove('is-tab-entering');
        incoming.classList.add('is-active');
        await waitForMotion(incoming, 180, ['opacity', 'transform']);
        if (revision !== sectionTransitionRevision || destroyed) return;
        outgoing.hidden = true;
        outgoing.classList.remove('is-tab-leaving');
      });
    }

    if (selectedTabRect && tabListRect && tabList) {
      if (
        selectedTabRect.left < tabListRect.left ||
        selectedTabRect.right > tabListRect.right
      ) {
        const delta = selectedTabRect.left < tabListRect.left
          ? selectedTabRect.left - tabListRect.left - 1
          : selectedTabRect.right - tabListRect.right + 1;
        tabList.scrollBy({
          behavior: reducedMotionQuery.matches ? 'auto' : 'smooth',
          left: delta
        });
      }
    }
    if (focus) selectedTab.focus({ preventScroll: true });
  }

  function syncSublevelState() {
    const activeTab = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    const activeSection = sections.find(
      (section) => section.dataset.ppMobileSection === activeTab?.dataset.ppMobileTab
    );
    const level = activeSection?.querySelector(
      `[data-pp-mobile-level="${activeSublevel || 'root'}"]`
    );

    sections.forEach((section) => {
      const isActiveSection = section === activeSection;
      section.classList.toggle('is-submenu-open', isActiveSection && Boolean(activeSublevel));

      section.querySelectorAll('[data-pp-mobile-level]').forEach((item) => {
        const isCurrentLevel = isActiveSection && item === level;

        item.hidden = false;
        item.classList.toggle('is-active', isCurrentLevel);
        item.setAttribute('aria-hidden', isCurrentLevel ? 'false' : 'true');
        item.toggleAttribute('inert', !isCurrentLevel);
      });

      section.querySelectorAll('[data-pp-mobile-level-trigger]').forEach((trigger) => {
        const isActive = isActiveSection &&
          trigger.dataset.ppMobileLevelTrigger === activeSublevel;
        trigger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
      });
    });

    backButton.hidden = !activeSublevel;
    backButton.setAttribute('aria-hidden', activeSublevel ? 'false' : 'true');
  }

  function openSublevel(name, { focus = true } = {}) {
    const activeTab = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    const activeSection = sections.find(
      (section) => section.dataset.ppMobileSection === activeTab?.dataset.ppMobileTab
    );
    const target = activeSection?.querySelector(`[data-pp-mobile-level="${name}"]`);
    if (!target) return;

    const revision = ++levelTransitionRevision;
    const track = activeSection.querySelector('.pp-mobile-menu__views-track');
    track?.classList.add('is-level-transitioning');
    activeSublevel = name;
    syncSublevelState();
    if (focus) target.querySelector('a, button')?.focus({ preventScroll: true });

    void (async () => {
      await waitForMotion(track, 280, ['transform']);
      if (revision !== levelTransitionRevision || destroyed) return;
      track?.classList.remove('is-level-transitioning');
    })();
  }

  function closeSublevel({ focus = true } = {}) {
    if (!activeSublevel) return false;

    const closingSublevel = activeSublevel;
    const activeTab = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    const activeSection = sections.find(
      (section) => section.dataset.ppMobileSection === activeTab?.dataset.ppMobileTab
    );
    const track = activeSection?.querySelector('.pp-mobile-menu__views-track');
    const revision = ++levelTransitionRevision;
    track?.classList.add('is-level-transitioning');
    activeSublevel = null;
    syncSublevelState();
    if (focus) {
      activeSection
        ?.querySelector(`[data-pp-mobile-level-trigger="${closingSublevel}"]`)
        ?.focus({ preventScroll: true });
    }

    void (async () => {
      await waitForMotion(track, 280, ['transform']);
      if (revision !== levelTransitionRevision || destroyed) return;
      track?.classList.remove('is-level-transitioning');
    })();

    return true;
  }

  async function closePanel({ restoreFocus = true, immediate = false } = {}) {
    const wasOpen = !panel.hidden;
    const revision = ++panelTransitionRevision;
    levelTransitionRevision += 1;
    activeSublevel = null;
    sections.forEach((section) => {
      section.querySelectorAll('.pp-mobile-menu__views-track').forEach((track) => {
        track.classList.remove('is-level-transitioning');
      });
    });
    syncSublevelState();
    setExpanded();

    if (!wasOpen) {
      restorePanelFocusability();
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
      panel.setAttribute('inert', '');
      panel.classList.remove('is-opening', 'is-open', 'is-closing');
      document.body.classList.remove('pp-mobile-panel-open');
      returnFocus = null;
      return;
    }

    const focusTarget = returnFocus;
    if (panel.contains(document.activeElement)) {
      document.activeElement?.blur?.();
    }
    suspendPanelFocusability();
    panel.classList.remove('is-opening', 'is-open');
    panel.classList.add('is-closing');
    panel.setAttribute('aria-hidden', 'true');

    if (!immediate) {
      await waitForMotion(panel.querySelector('.pp-mobile-panel__content'), 260, ['opacity', 'transform']);
    }
    if (revision !== panelTransitionRevision && !immediate) return;

    panel.hidden = true;
    panel.setAttribute('inert', '');
    restorePanelFocusability();
    panel.classList.remove('is-closing');
    document.body.classList.remove('pp-mobile-panel-open');
    if (restoreFocus && focusTarget instanceof HTMLElement && focusTarget.isConnected) {
      focusTarget.focus({ preventScroll: true });
    }
    returnFocus = null;
  }

  function mobileStylesAreReady() {
    return Boolean(mobileStyles?.sheet);
  }

  function nodeBelongsToCurrentHeader(node) {
    if (!node?.isConnected) return false;
    if (headerHost.contains(node)) return true;

    const anchor = node.__ppPortalOrigin?.anchor;
    return Boolean(anchor?.isConnected && headerHost.contains(anchor));
  }

  function portaledAuthModals() {
    return Array.from(document.querySelectorAll('#ppAuthModal')).filter((modal) => {
      const origin = modal.__ppPortalOrigin;
      return origin?.parent === headerHost || Boolean(origin?.anchor && headerHost.contains(origin.anchor));
    });
  }

  function closePortaledAuth(modal) {
    if (!modal?.open) return;
    const isPrimaryModal = getAuthModal() === modal;
    if (isPrimaryModal && typeof window.ppCloseAuth === 'function') {
      window.ppCloseAuth({ restoreFocus: false });
      return;
    }

    try { modal.close(); } catch {}
    if (isPrimaryModal) document.body.classList.remove('no-scroll');
  }

  function restoreMobilePortals({ removeNodes = false } = {}) {
    portaledAuthModals().forEach((modal) => {
      closePortaledAuth(modal);
      restorePortaledNode(modal, { removeIfOrphaned: true });
      if (removeNodes) modal.remove();
    });

    restorePortaledNode(dock, { removeIfOrphaned: true });
    restorePortaledNode(panel, { removeIfOrphaned: true });

    if (removeNodes) {
      dock.remove();
      panel.remove();
    }
  }

  function isCurrentHeader(candidate) {
    return !destroyed &&
      candidate === headerHost &&
      nodeBelongsToCurrentHeader(dock) &&
      nodeBelongsToCurrentHeader(panel);
  }

  function destroy({ removeNodes = false } = {}) {
    if (destroyed) return;
    destroyed = true;

    window.clearTimeout(searchTimer);
    searchRevision += 1;
    void closePanel({ restoreFocus: false, immediate: true });
    lifecycle.abort();
    listenerCleanups.splice(0).forEach((cleanup) => cleanup());
    cartCountObserver?.disconnect();
    headerObserver?.disconnect();
    if (legacyMediaListener) mobileQuery.removeListener?.(syncDockVisibility);

    restoreMobilePortals({ removeNodes });
    document.body.classList.remove('pp-mobile-dock-active', 'pp-mobile-panel-open');
    delete dock.dataset.ppMobileBound;

    if (window.__ppMobileDockController === controllerApi) {
      delete window.__ppMobileDockController;
    }
  }

  function ensureSearchResults() {
    if (searchResults?.isConnected) return searchResults;
    if (!searchForm) return null;

    searchResults = document.createElement('div');
    searchResults.id = 'ppMobileSearchResults';
    searchResults.className = 'pp-mobile-search-results';
    searchResults.setAttribute('aria-live', 'polite');
    searchResults.setAttribute('aria-label', 'Resultados de búsqueda');
    searchResults.hidden = true;
    searchForm.insertAdjacentElement('afterend', searchResults);

    searchInput?.setAttribute('aria-controls', searchResults.id);
    searchInput?.setAttribute('aria-expanded', 'false');
    return searchResults;
  }

  function setSearchExpanded(value) {
    searchInput?.setAttribute('aria-expanded', value ? 'true' : 'false');
  }

  function syncSearchClearButton() {
    if (!searchClearButton) return;
    const hasText = Boolean(searchInput?.value);
    searchClearButton.hidden = !hasText;
    searchClearButton.disabled = !hasText;
  }

  function clearSearchResults() {
    const container = ensureSearchResults();
    if (!container) return;
    container.replaceChildren();
    container.hidden = true;
    container.removeAttribute('aria-busy');
    delete container.dataset.state;
    setSearchExpanded(false);
    syncSearchClearButton();
  }

  function renderSearchStatus(message, state) {
    const container = ensureSearchResults();
    if (!container) return;

    const status = document.createElement('p');
    status.textContent = message;
    container.replaceChildren(status);
    container.dataset.state = state;
    container.hidden = false;
    container.removeAttribute('aria-busy');
    setSearchExpanded(true);
  }

  function renderCatalogResults(items) {
    const container = ensureSearchResults();
    if (!container) return;

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const id = String(item?.id || '').trim();
      const slug = String(item?.slug || '').trim();
      const productId = slug || id;
      if (!productId) return;

      const link = document.createElement('a');
      link.className = 'pp-mobile-search-result';
      link.href = ppCatalogSearch.productUrl(item);

      const title = document.createElement('strong');
      title.textContent = String(item?.title || id);
      link.appendChild(title);

      const metaText = ppCatalogSearch.productMeta(item);
      if (metaText) {
        const meta = document.createElement('span');
        meta.textContent = metaText;
        link.appendChild(meta);
      }

      fragment.appendChild(link);
    });

    if (!fragment.childNodes.length) {
      renderSearchStatus('No hay resultados para esta búsqueda.', 'empty');
      return;
    }

    container.replaceChildren(fragment);
    container.dataset.state = 'results';
    container.hidden = false;
    container.removeAttribute('aria-busy');
    setSearchExpanded(true);
  }

  async function runMobileSearch(rawQuery) {
    const query = String(rawQuery || '').trim();
    const revision = ++searchRevision;
    syncSearchClearButton();

    if (!query) {
      clearSearchResults();
      return;
    }

    if (query.length < 2) {
      renderSearchStatus('Escribe al menos 2 caracteres.', 'minimum');
      return;
    }

    renderSearchStatus('Buscando…', 'loading');
    ensureSearchResults()?.setAttribute('aria-busy', 'true');

    try {
      const matches = await ppCatalogSearch.search(query, { limit: 8 });
      if (revision !== searchRevision) return;

      if (!matches.length) {
        renderSearchStatus('No hay resultados para esta búsqueda.', 'empty');
        return;
      }

      renderCatalogResults(matches);
    } catch (error) {
      if (revision !== searchRevision) return;
      console.error('[mobile-search] catálogo no disponible:', error);
      renderSearchStatus('No se ha podido cargar la búsqueda. Inténtalo de nuevo.', 'error');
    }
  }

  function syncDockVisibility() {
    if (destroyed) return;
    if (!isCurrentHeader(document.getElementById('header'))) {
      destroy({ removeNodes: true });
      Promise.resolve().then(initMobileDock);
      return;
    }

    const active = mobileQuery.matches && mobileStylesAreReady();
    if (!active) void closePanel({ restoreFocus: false, immediate: true });

    if (active) {
      const dockReady = portalNodeToBody(dock);
      const panelReady = portalNodeToBody(panel);
      if (!dockReady || !panelReady) {
        destroy({ removeNodes: true });
        return;
      }
    } else {
      restoreMobilePortals();
    }

    dock.hidden = !active;
    document.body.classList.toggle('pp-mobile-dock-active', active);
  }

  function openPanel({ focusSearch = false } = {}) {
    if (!mobileQuery.matches || !mobileStylesAreReady()) return;

    const revision = ++panelTransitionRevision;

    const currentFocus = document.activeElement;
    if (currentFocus instanceof HTMLElement && !panel.contains(currentFocus)) {
      returnFocus = currentFocus;
    } else if (!(returnFocus instanceof HTMLElement)) {
      returnFocus = menuButton;
    }
    restorePanelFocusability();
    panel.classList.remove('is-open', 'is-closing');
    panel.classList.add('is-opening');
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'true');
    panel.removeAttribute('inert');
    suspendPanelFocusability();
    document.body.classList.add('pp-mobile-panel-open');
    setExpanded(focusSearch ? 'search' : 'menu');
    syncSearchClearButton();

    afterNextPaint(() => {
      if (
        revision !== panelTransitionRevision ||
        panel.hidden ||
        !panel.classList.contains('is-opening')
      ) return;
      restorePanelFocusability();
      panel.classList.remove('is-opening');
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
      panel.removeAttribute('inert');
      if (focusSearch) searchInput?.focus({ preventScroll: true });
      else closeButton?.focus({ preventScroll: true });
    });
  }

  function clickHeaderControl(selector) {
    const control = document.querySelector(selector);
    if (control instanceof HTMLElement) control.click();
  }

  async function hasResolvedAccountSession() {
    const readSession = () => Boolean(
      window.__ppAuthCurrentUser ||
      window.__ppLastUser ||
      document.body.classList.contains('pp-auth-logged')
    );
    if (readSession() || window.__ppAuthStateResolved === true) return readSession();

    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener('pp:auth-changed', finish);
        resolve();
      };
      const timer = window.setTimeout(finish, 1800);
      window.addEventListener('pp:auth-changed', finish, { once: true });
      if (window.__ppAuthInitialState?.then) {
        Promise.resolve(window.__ppAuthInitialState).then(finish, finish);
      }
    });

    return readSession();
  }

  function syncMobileCartCount() {
    const source = document.querySelector('#ppCartCount [data-cart-count-value]');
    const value = Math.max(0, Number.parseInt(source?.textContent || '0', 10) || 0);
    if (!mobileCount) return;

    mobileCount.textContent = String(value);
    mobileCount.hidden = value <= 0;
    cartButton?.setAttribute(
      'aria-label',
      value > 0 ? `Abrir cesta, ${value} artículo${value === 1 ? '' : 's'}` : 'Abrir cesta, vacía'
    );
  }

  tabs.forEach((tab, index) => {
    listen(tab, 'click', () => {
      activateSection(tab.dataset.ppMobileTab, { focus: true });
    });

    listen(tab, 'keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();

      let nextIndex = index;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      activateSection(tabs[nextIndex]?.dataset.ppMobileTab, { focus: true });
    });
  });

  listen(menuButton, 'click', () => openPanel());
  listen(searchButton, 'click', () => openPanel({ focusSearch: true }));
  listen(closeButton, 'click', () => { void closePanel(); });

  listen(backButton, 'click', () => {
    closeSublevel();
  });

  listen(panel, 'click', (event) => {
    const trigger = event.target.closest('[data-pp-mobile-level-trigger]');
    if (!trigger || !panel.contains(trigger)) return;

    event.preventDefault();
    openSublevel(trigger.dataset.ppMobileLevelTrigger);
  });

  listen(accountButton, 'click', async () => {
    accountButton.setAttribute('aria-busy', 'true');
    try {
      const hasSession = await hasResolvedAccountSession();
      await closePanel({ restoreFocus: false });
      if (hasSession) {
        window.location.assign('/my-content');
        return;
      }

      const modal = getAuthModal();
      if (modal) portalNodeToBody(modal);

      if (typeof window.ppOpenAuth === 'function') window.ppOpenAuth();
      else clickHeaderControl('#ppAuthLogoBtn');
    } finally {
      accountButton.removeAttribute('aria-busy');
    }
  });

  listen(cartButton, 'click', async () => {
    await closePanel({ restoreFocus: false });
    if (typeof window.ppOpenCart === 'function') {
      window.ppOpenCart(cartButton);
      return;
    }
    clickHeaderControl('#ppCartBtn');
  });

  listen(panel, 'click', (event) => {
    if (event.target.closest('a')) void closePanel({ restoreFocus: false });
  });

  listen(searchInput, 'input', () => {
    window.clearTimeout(searchTimer);
    searchRevision += 1;
    const value = searchInput.value;
    syncSearchClearButton();

    if (!value.trim()) {
      clearSearchResults();
      return;
    }

    searchTimer = window.setTimeout(() => runMobileSearch(value), 160);
  });

  listen(searchClearButton, 'click', () => {
    window.clearTimeout(searchTimer);
    searchRevision += 1;
    if (searchInput) searchInput.value = '';
    clearSearchResults();
    searchInput?.focus({ preventScroll: true });
  });

  listen(searchInput, 'keydown', (event) => {
    if (event.key !== 'ArrowDown') return;
    const firstResult = ensureSearchResults()?.querySelector('.pp-mobile-search-result');
    if (!firstResult) return;
    event.preventDefault();
    firstResult.focus({ preventScroll: true });
  });

  listen(searchForm, 'submit', (event) => {
    event.preventDefault();
    window.clearTimeout(searchTimer);
    runMobileSearch(searchInput?.value || '');
  });

  listen(ensureSearchResults(), 'keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const links = Array.from(searchResults.querySelectorAll('.pp-mobile-search-result'));
    const index = links.indexOf(document.activeElement);
    if (index < 0) return;

    event.preventDefault();
    const nextIndex = event.key === 'ArrowDown'
      ? Math.min(index + 1, links.length - 1)
      : index === 0 ? -1 : index - 1;

    if (nextIndex < 0) searchInput?.focus({ preventScroll: true });
    else links[nextIndex]?.focus({ preventScroll: true });
  });

  listen(document, 'keydown', (event) => {
    if (panel.hidden || panel.classList.contains('is-closing')) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      if (!closeSublevel()) void closePanel();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = Array.from(panel.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => !element.closest('[hidden], [inert]'));
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const sourceCount = document.getElementById('ppCartCount');
  if (sourceCount) {
    cartCountObserver = new MutationObserver(syncMobileCartCount);
    cartCountObserver.observe(sourceCount, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });
  }

  try {
    window.addEventListener('pp:cart-updated', syncMobileCartCount, { signal });
  } catch {
    window.addEventListener('pp:cart-updated', syncMobileCartCount);
  }
  listenerCleanups.push(() => {
    window.removeEventListener('pp:cart-updated', syncMobileCartCount);
  });
  if (mobileQuery.addEventListener) {
    listen(mobileQuery, 'change', syncDockVisibility);
  } else if (mobileQuery.addListener) {
    mobileQuery.addListener(syncDockVisibility);
    legacyMediaListener = true;
  }
  listen(mobileStyles, 'load', syncDockVisibility, { once: true });

  controllerApi = {
    destroy,
    isCurrentHeader,
    sync: syncDockVisibility
  };
  window.__ppMobileDockController = controllerApi;
  headerObserver = new MutationObserver(() => {
    if (destroyed) return;
    if (isCurrentHeader(document.getElementById('header'))) return;
    destroy({ removeNodes: true });
    Promise.resolve().then(initMobileDock);
  });
  headerObserver.observe(headerHost, { childList: true });
  if (headerHost.parentNode) {
    headerObserver.observe(headerHost.parentNode, { childList: true });
  }

  const currentPath = window.location.pathname.replace(/\/$/, '') || '/home';
  syncMobileHouseNavigation();
  activateSection(sectionForPath(currentPath));
  panel.querySelectorAll('a[href]').forEach((link) => {
    link.removeAttribute('aria-current');
    const href = new URL(link.href, window.location.origin).pathname.replace(/\/$/, '') || '/home';
    if (href === currentPath) link.setAttribute('aria-current', 'page');
  });

  panel.toggleAttribute('inert', panel.hidden);

  syncMobileCartCount();
  syncDockVisibility();
}

function initMobileHeroVideoFallbacks() {
  const responsiveQuery = window.matchMedia('(max-width: 1024px)');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const videos = document.querySelectorAll(
    'body:is(.men-page, .women-page) .hero-frame .hero-video__media, ' +
    'body.home-page #home_hero .hero-frame .hero-video__media'
  );

  videos.forEach((video) => {
    const frame = video.closest('.hero-frame');
    if (!frame || video.dataset.ppMobileFallbackBound === 'true') return;

    video.dataset.ppMobileFallbackBound = 'true';
    const lifecycle = new AbortController();
    const { signal } = lifecycle;
    const originalPoster = video.getAttribute('poster') || '';
    const originalAutoplay = video.hasAttribute('autoplay');
    let fallbackTimer = 0;

    const revealFallback = () => {
      if (!responsiveQuery.matches) return;
      window.clearTimeout(fallbackTimer);
      frame.classList.remove('pp-mobile-video-pending', 'pp-mobile-video-ready');
      frame.classList.add('pp-mobile-video-fallback');
    };

    const revealVideo = () => {
      if (!responsiveQuery.matches || reducedMotionQuery.matches) {
        revealFallback();
        return;
      }
      window.clearTimeout(fallbackTimer);
      frame.classList.remove('pp-mobile-video-pending', 'pp-mobile-video-fallback');
      frame.classList.add('pp-mobile-video-ready');
    };

    const requestPlayback = () => {
      if (!responsiveQuery.matches || reducedMotionQuery.matches) return;
      const playback = video.play?.();
      playback?.catch?.(() => {
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) revealFallback();
      });
    };

    const syncMotionPreference = () => {
      window.clearTimeout(fallbackTimer);

      if (!responsiveQuery.matches) {
        frame.classList.remove('pp-mobile-video-pending', 'pp-mobile-video-ready', 'pp-mobile-video-fallback');
        if (originalPoster) video.setAttribute('poster', originalPoster);
        if (originalAutoplay) video.setAttribute('autoplay', '');
        return;
      }

      if (reducedMotionQuery.matches) {
        if (originalPoster) video.setAttribute('poster', originalPoster);
        video.removeAttribute('autoplay');
        video.autoplay = false;
        video.pause?.();
        revealFallback();
        return;
      }

      video.removeAttribute('poster');
      if (originalAutoplay) {
        video.setAttribute('autoplay', '');
        video.autoplay = true;
      }
      frame.classList.remove('pp-mobile-video-ready', 'pp-mobile-video-fallback');
      frame.classList.add('pp-mobile-video-pending');

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        revealVideo();
        requestPlayback();
      } else {
        fallbackTimer = window.setTimeout(revealFallback, 5000);
      }
    };

    video.addEventListener('loadeddata', () => {
      revealVideo();
      requestPlayback();
    }, { signal });
    video.addEventListener('canplay', revealVideo, { signal });
    video.addEventListener('error', revealFallback, { signal });
    video.addEventListener('abort', revealFallback, { signal });
    video.querySelectorAll('source').forEach((source) => {
      source.addEventListener('error', revealFallback, { signal });
    });
    responsiveQuery.addEventListener?.('change', syncMotionPreference, { signal });
    reducedMotionQuery.addEventListener?.('change', syncMotionPreference, { signal });
    window.addEventListener('pagehide', () => {
      window.clearTimeout(fallbackTimer);
      lifecycle.abort();
    }, { once: true, signal });

    syncMotionPreference();
  });
}

function initFooterTribeForm() {
  const form = document.querySelector('[data-footer-tribe-form]');
  if (!form || form.dataset.footerTribeBound === 'true') return;

  form.dataset.footerTribeBound = 'true';
  const emailInput = form.querySelector('input[type="email"]');
  const submit = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[data-footer-tribe-status]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!emailInput?.checkValidity()) {
      emailInput?.reportValidity();
      return;
    }

    const email = String(emailInput.value || '').trim().toLowerCase();
    const modalEmail = document.getElementById('tribeEmail');
    if (modalEmail) modalEmail.value = email;

    if (submit) submit.disabled = true;
    if (status) status.textContent = 'Abriendo la inscripción segura…';

    try {
      const openTribe = await waitForGlobalFn('ppTribeOpen', 1800);
      if (!openTribe) throw new Error('El formulario de inscripción no está disponible.');

      await Promise.resolve(openTribe({ source: 'footer' }));
      const liveModalEmail = document.getElementById('tribeEmail');
      if (liveModalEmail) liveModalEmail.value = email;
      if (status) status.textContent = 'Completa tus datos para terminar la inscripción.';
    } catch (error) {
      if (status) {
        status.textContent = error?.message || 'No se ha podido abrir la inscripción.';
      }
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}
function finalizeHeaderPartial() {
  normalizeHeaderAuthIcons();

  // Dedupe defensivo para navegaciones parciales o inyecciones repetidas.
  const allAuth = Array.from(document.querySelectorAll('#ppAuthModal'));
  if (allAuth.length > 1) {
    const preferred =
      allAuth.find((item) => item.closest('#header') && item.querySelector('.auth-bottom')) ||
      allAuth.find((item) => item.querySelector('.auth-bottom')) ||
      allAuth.find((item) => item.closest('#header')) ||
      allAuth[allAuth.length - 1];

    allAuth.filter((item) => item !== preferred).forEach((item) => item.remove());
    console.log('[partials] ppAuthModal dedupe -> kept hasBottom:', !!preferred?.querySelector?.('.auth-bottom'));
  }

  const modal = getAuthModal();
  if (modal && !modal.querySelector('.auth-bottom')) {
    const body = modal.querySelector('.modal-body');
    if (body) {
      body.insertAdjacentHTML('beforeend', `
        <div class="auth-bottom">
          <div class="auth-benefits" data-auth-benefits>
            <a href="/wishlist" class="sp-benefit-link">Lista de deseos</a>
            <a href="/my-services" class="sp-benefit-link">Beneficios y servicios</a>
            <a href="/pedidos" class="sp-benefit-link">Seguimiento de pedido</a>
          </div>
          <div class="auth-social" data-auth-social aria-label="Acceso con proveedores">
            <p class="auth-social__title">O continúa con</p>
            <div class="auth-social__row" role="group" aria-label="Proveedores">
              <button type="button" class="auth-social__iconbtn auth-social__iconbtn--google" data-pp-google aria-label="Continuar con Google">
                <img class="auth-social__icon" src="/assets/img/logo/google.png" alt="" width="18" height="18" loading="lazy" decoding="async">
              </button>
              <button type="button" class="auth-social__iconbtn auth-social__iconbtn--apple" data-pp-apple disabled aria-disabled="true"
                aria-label="Continuar con Apple" title="Apple requiere Apple Developer Program (de pago)">
                <img class="auth-social__icon" src="/assets/img/logo/apple-provider.svg" alt="" width="18" height="18" loading="lazy" decoding="async">
              </button>
            </div>
            <p class="auth-social__note">Apple estará disponible próximamente.</p>
          </div>
        </div>
      `);
      console.warn('[AUTH] injected missing .auth-bottom fallback (header partial outdated)');
    }
  }

  if (!modal?.querySelector('.auth-bottom')) {
    console.error('[partials] header inyectado NO contiene .auth-bottom. Revisa /assets/partials/header.html servido.');
  }

  partialsInjected = true;
  initHeaderSearch();
  initMobileDock();
  setHeaderHeightVar();
}

async function loadPartialSafely(name, hostId, url, onReady) {
  let status = 'loaded';

  try {
    const injected = await injectPartial(hostId, url);
    if (!injected) {
      console.info(`[partials] ${name} omitido: no existe #${hostId}`);
      return { name, status: 'skipped' };
    }
  } catch (error) {
    console.error(`[partials] ${name} no disponible:`, error);
    const existingHost = document.getElementById(hostId);
    if (!existingHost?.firstElementChild) return { name, status: 'failed' };
    status = 'existing';
    console.warn(`[partials] ${name}: se conserva el contenido existente de #${hostId}`);
  }

  try {
    onReady?.();
    console.log(`[partials] ${name} ${status === 'loaded' ? 'OK' : 'inicializado'}:`, url);
    return { name, status };
  } catch (error) {
    console.error(`[partials] ${name} no pudo inicializarse:`, error);
    return { name, status: 'failed' };
  }
}

async function injectHeaderFooter() {
  if (partialsInjectionPromise) return partialsInjectionPromise;

  const paths = {
    header: '/assets/partials/header.html',
    footer: '/assets/partials/footer.html',
    popup: '/assets/partials/popup.html'
  };

  partialsInjectionPromise = (async () => {
    const headerResult = await loadPartialSafely(
      'header',
      'header',
      paths.header,
      finalizeHeaderPartial
    );
    const footerResult = await loadPartialSafely(
      'footer',
      'footer',
      paths.footer,
      initFooterTribeForm
    );
    const popupResult = await loadPartialSafely('popup', 'popup-area', paths.popup);
    const results = [headerResult, footerResult, popupResult];
    const detail = Object.fromEntries(results.map(({ name, status }) => [name, status]));
    window.dispatchEvent(new CustomEvent('partials:ready', { detail }));
    return detail;
  })();

  return partialsInjectionPromise;
}







 


  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHeaderFooter, { once: true });
  } else {
    injectHeaderFooter();
  }

/* =============== Auth Modal (Prophetia flow estable) =============== */
(function defineAuthBinder(){
  const state = { step: 'email', email: '', loginMode: 'password' }; // password | google
  const q = (sel, root=document) => root.querySelector(sel);
  let authReturnFocus = null;
  let accountReturnFocus = null;
  let authPresentationRevision = 0;
  let accountPresentationRevision = 0;
  let authCloseTimer = 0;
  let accountCloseTimer = 0;
  const authReducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* =========================================================
     PROPHETIA · FECHA HÍBRIDA
     Visible: DD/MM/AAAA
     Firestore: AAAA-MM-DD
     ========================================================= */

  const padDatePart = (value) => String(value).padStart(2, '0');



  function parseBirthDisplay(rawValue) {
    const original = String(rawValue || '').trim();

    if (!original) {
      return {
        valid: true,
        empty: true,
        display: '',
        iso: ''
      };
    }

    let day;
    let month;
    let year;

    const separated = original.match(
      /^(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{4})$/
    );

    if (separated) {
      day = Number(separated[1]);
      month = Number(separated[2]);
      year = Number(separated[3]);
    } else {
      const digits = original.replace(/\D/g, '');

      if (!/^\d{8}$/.test(digits)) {
        return {
          valid: false,
          message: 'Utiliza el formato DD/MM/AAAA.'
        };
      }

      day = Number(digits.slice(0, 2));
      month = Number(digits.slice(2, 4));
      year = Number(digits.slice(4, 8));
    }

    if (year < 1900) {
      return {
        valid: false,
        message: 'Introduce un año igual o posterior a 1900.'
      };
    }

    const date = new Date(year, month - 1, day);

    const isRealDate =
      !Number.isNaN(date.getTime()) &&
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;

    if (!isRealDate) {
      return {
        valid: false,
        message: 'Introduce una fecha de nacimiento válida.'
      };
    }

    const today = new Date();

    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    if (date > today) {
      return {
        valid: false,
        message: 'La fecha de nacimiento no puede ser futura.'
      };
    }

    return {
      valid: true,
      empty: false,
      display:
        `${padDatePart(day)}/${padDatePart(month)}/${year}`,
      iso:
        `${year}-${padDatePart(month)}-${padDatePart(day)}`
    };
  }

  function setBirthFieldError(root, message = '') {
    const field = q('.pp-register-field--date', root);
    const input = q('#ppRegBirth', root);
    const error = q('#ppRegBirthError', root);

    const hasError = Boolean(message);

    field?.classList.toggle('is-invalid', hasError);

    if (input) {
      if (hasError) {
        input.setAttribute('aria-invalid', 'true');
      } else {
        input.removeAttribute('aria-invalid');
      }
    }

    if (error) {
      error.textContent = message;
      error.hidden = !hasError;
    }
  }

function normalizeBirthControl( root, { focusOnError = false } = {} ) { const displayInput = q('#ppRegBirth', root); const result = parseBirthDisplay( displayInput?.value || '' ); if (!result.valid) { setBirthFieldError(root, result.message); if (focusOnError) { displayInput?.focus({ preventScroll: true }); } return result; } setBirthFieldError(root); if (result.empty) { if (displayInput) { displayInput.value = ''; } return result; } if (displayInput) { displayInput.value = result.display; } return result; } function bindBirthDateControl(modal) { const registerForm = q('#ppRegisterForm', modal); if (!registerForm) return; const field = q( '.pp-register-field--date', registerForm ); const displayInput = q( '#ppRegBirth', registerForm ); const openButton = q( '#ppRegBirthOpen', registerForm ); const picker = q( '#ppRegBirthPicker', registerForm ); const daySelect = q( '#ppRegBirthDay', registerForm ); const monthSelect = q( '#ppRegBirthMonth', registerForm ); const yearSelect = q( '#ppRegBirthYear', registerForm ); const pickerError = q( '[data-birth-picker-error]', registerForm ); const confirmButton = q( '[data-birth-picker-confirm]', registerForm ); const cancelButton = q( '[data-birth-picker-cancel]', registerForm ); const closeButton = q( '[data-birth-picker-close]', registerForm ); if ( !field || !displayInput || !openButton || !picker || !daySelect || !monthSelect || !yearSelect || displayInput.__ppBirthBound ) { return; } displayInput.__ppBirthBound = true; const currentYear = new Date().getFullYear(); /* Generar años una sola vez */ if (yearSelect.options.length === 1) { for ( let year = currentYear; year >= 1900; year -= 1 ) { yearSelect.add( new Option(String(year), String(year)) ); } } function setPickerError(message = '') { if (!pickerError) return; pickerError.textContent = message; pickerError.hidden = !message; } function renderDays() { const month = Number(monthSelect.value); const year = Number(yearSelect.value); const previousDay = daySelect.value; const totalDays = month && year ? new Date(year, month, 0).getDate() : 31; daySelect.innerHTML = '<option value="">DD</option>'; for ( let day = 1; day <= totalDays; day += 1 ) { daySelect.add( new Option( padDatePart(day), String(day) ) ); } if ( previousDay && Number(previousDay) <= totalDays ) { daySelect.value = previousDay; } } function syncPickerFromInput() { const current = parseBirthDisplay( displayInput.value ); if ( current.valid && !current.empty ) { const [ day, month, year ] = current.display.split('/'); monthSelect.value = String( Number(month) ); yearSelect.value = year; renderDays(); daySelect.value = String( Number(day) ); return; } daySelect.value = ''; monthSelect.value = ''; yearSelect.value = ''; renderDays(); } function closePicker({ restoreFocus = false } = {}) { picker.classList.remove('is-open'); picker.hidden = true; field.classList.remove('is-picker-open'); openButton.setAttribute( 'aria-expanded', 'false' ); setPickerError(); if (restoreFocus) { openButton.focus({ preventScroll: true }); } } function openPicker() { syncPickerFromInput(); const rect = openButton.getBoundingClientRect(); const shouldOpenAbove = window.innerHeight - rect.bottom < 310 && rect.top > 310; picker.classList.toggle( 'is-above', shouldOpenAbove ); picker.hidden = false; field.classList.add('is-picker-open'); openButton.setAttribute( 'aria-expanded', 'true' ); requestAnimationFrame(() => { picker.classList.add('is-open'); daySelect.focus({ preventScroll: true }); }); } openButton.addEventListener( 'click', (event) => { event.preventDefault(); event.stopPropagation(); if (!picker.hidden) { closePicker({ restoreFocus: true }); return; } openPicker(); } ); monthSelect.addEventListener( 'change', () => { renderDays(); setPickerError(); } ); yearSelect.addEventListener( 'change', () => { renderDays(); setPickerError(); } ); daySelect.addEventListener( 'change', () => { setPickerError(); } ); confirmButton?.addEventListener( 'click', () => { const day = Number(daySelect.value); const month = Number(monthSelect.value); const year = Number(yearSelect.value); if (!day || !month || !year) { setPickerError( 'Selecciona el día, el mes y el año.' ); return; } displayInput.value = `${padDatePart(day)}/` + `${padDatePart(month)}/` + `${year}`; const result = normalizeBirthControl( registerForm, { focusOnError: true } ); if (!result.valid) { setPickerError(result.message); return; } displayInput.dispatchEvent( new Event( 'change', { bubbles: true } ) ); closePicker({ restoreFocus: true }); } ); cancelButton?.addEventListener( 'click', () => { closePicker({ restoreFocus: true }); } ); closeButton?.addEventListener( 'click', () => { closePicker({ restoreFocus: true }); } ); displayInput.addEventListener( 'input', () => { const sanitized = displayInput.value .replace(/[^\d/.-]/g, '') .slice(0, 10); if ( displayInput.value !== sanitized ) { displayInput.value = sanitized; } setBirthFieldError(registerForm); } ); displayInput.addEventListener( 'blur', () => { if (picker.hidden) { normalizeBirthControl( registerForm ); } } ); document.addEventListener( 'pointerdown', (event) => { if (picker.hidden) return; if ( picker.contains(event.target) || openButton.contains(event.target) ) { return; } closePicker(); } ); document.addEventListener( 'keydown', (event) => { if ( event.key === 'Escape' && !picker.hidden ) { event.preventDefault(); closePicker({ restoreFocus: true }); } } ); modal.addEventListener( 'close', () => { closePicker(); } ); renderDays(); }




  function showAuthError(modal, step, code){
    const box = modal.querySelector(`[data-step="${step}"] [data-auth-error]`);
    if (!box) return;

    const map = {
      'auth/wrong-password': 'Correo o contraseña incorrectos.',
      'auth/invalid-credential': 'No se pudo iniciar sesión. Revisa el correo o el método de acceso.',
      'auth/too-many-requests': 'Demasiados intentos. Inténtalo más tarde.',
      'pp/email-not-verified': 'Tu cuenta aún no está verificada. Te hemos enviado un correo de verificación. Revisa Bandeja y Spam.',
      'auth/weak-password': 'La contraseña es demasiado débil.',
      'auth/invalid-email': 'El correo no es válido.',
      'auth/email-already-in-use': 'Ese correo ya existe. Inicia sesión.',
      'auth/user-not-found': 'No existe cuenta en PROPHETIA. Crea una nueva.'
    };

    box.textContent = map[code] || 'No se pudo completar la operación.';
    box.hidden = false;
  }

  function showStep(modal, step){
    state.step = step;

    // Solo un step visible
    modal.querySelectorAll('[data-step]').forEach(s => s.classList.add('hidden'));
    const active = modal.querySelector(`[data-step="${step}"]`);
    if (active) active.classList.remove('hidden');

    // aria-hidden coherente
    modal.querySelectorAll('[data-step]').forEach(s => {
      if (s.classList.contains('hidden')) s.setAttribute('aria-hidden', 'true');
      else s.removeAttribute('aria-hidden');
    });

    // Pintar email en chips
    modal.querySelectorAll('[data-email-value]').forEach(el => {
      el.textContent = state.email || '';
    });
    // Registro: si ya había email escrito, lo pasamos al campo real
    if (step === 'register') {
      const sourceEmail = (
        state.email ||
        q('#ppAuthEmail', modal)?.value ||
        q('#ppRegEmailHidden', modal)?.value ||
        ''
      ).trim();

      const regEmailInput = q('#ppRegEmail', modal);
      const regEmailHidden = q('#ppRegEmailHidden', modal);

      if (regEmailInput && sourceEmail && !regEmailInput.value) {
        regEmailInput.value = sourceEmail;
      }

      if (regEmailHidden && sourceEmail) {
        regEmailHidden.value = sourceEmail;
      }
    }
// Copy (estable B1)
const titleEl = modal.querySelector('[data-auth-title]');
const subEl   = modal.querySelector('[data-auth-subtitle]');

if (titleEl && subEl) {
  if (step === 'login') {
    titleEl.textContent = 'Bienvenido de nuevo';
    subEl.textContent   = 'Introduce tu contraseña para acceder.';
  } else if (step === 'register') {
    titleEl.textContent = 'Es un placer conocerte.';
    subEl.textContent   = 'Cuéntanos un poco más sobre ti.';
  } else {
    titleEl.textContent = 'Te damos la bienvenida';
    subEl.textContent   = 'Únete para desbloquear accesos exclusivos, beneficios y servicios.';
  }
}


    // Back visible solo fuera de email
    const backBtn = modal.querySelector('[data-back-auth]');
    if (backBtn) backBtn.classList.toggle('hidden', step === 'email');

    // Bottom: existe en HTML -> nunca lo mates
    const bottom = modal.querySelector('.auth-bottom');
    if (bottom) bottom.classList.remove('hidden');

    const benefits = modal.querySelector('[data-auth-benefits]');
    if (benefits) benefits.classList.toggle('hidden', !(step === 'email' || step === 'register'));

    // Modo login: password vs google
    if (step === 'login') {
      const switchEl = modal.querySelector('.pp-auth-switch');
      if (switchEl) switchEl.classList.toggle('hidden', state.loginMode === 'google');

  const passWrap    = modal.querySelector('[data-login-passwrap]');
const submitBtn   = modal.querySelector('[data-login-submit]');
const forgot      = modal.querySelector('[data-login-forgot]');
const providerBox = modal.querySelector('[data-login-provider]');
const goRegister  = modal.querySelector('[data-step="login"] [data-go="register"]');

// B1: siempre visible
if (goRegister) goRegister.classList.remove('hidden');

// B1: ocultar cualquier caja “provider-only”
if (providerBox) providerBox.classList.add('hidden');

// B1: siempre mostramos password UI
if (passWrap)  passWrap.classList.remove('hidden');
if (submitBtn) submitBtn.classList.remove('hidden');
if (forgot)    forgot.classList.remove('hidden');

    }

    // Limpia errores
    modal.querySelectorAll('[data-auth-error]').forEach(b => {
      b.hidden = true;
      b.textContent = '';
    });

    // Focus
    const focusEl = modal.querySelector(`[data-step="${step}"] input, [data-step="${step}"] button`);
    if (focusEl) focusEl.focus({ preventScroll: true });
  }

async function decideFlowByEmail(email){
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!ok) return { nextStep: 'email' };
  return { nextStep: 'login' };
}





  function isVisibleFocusTarget(element) {
    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[contenteditable="true"]',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    return element instanceof HTMLElement &&
      element !== document.body &&
      element !== document.documentElement &&
      element.isConnected &&
      !element.hidden &&
      !element.closest('[inert]') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.matches(focusableSelector) &&
      element.getClientRects().length > 0;
  }

  function restorePresentationFocusAfterClose({
    container,
    focusTarget,
    fallbackSelectors,
    revision,
    currentRevision
  }) {
    let remainingFocusFrames = 6;
    const restore = () => {
      if (revision !== currentRevision() || container.open) return;

      const current = document.activeElement;
      if (
        current instanceof HTMLElement &&
        current !== document.body &&
        current !== document.documentElement &&
        current !== focusTarget &&
        !container.contains(current)
      ) return;

      let remainsInTopLayer = false;
      try {
        remainsInTopLayer = container.matches(':modal');
      } catch {}

      if (remainsInTopLayer) {
        if (remainingFocusFrames > 0) {
          remainingFocusFrames -= 1;
          window.requestAnimationFrame(restore);
        }
        return;
      }

      const fallback = fallbackSelectors
        .map((selector) => document.querySelector(selector))
        .find(isVisibleFocusTarget);
      const target = isVisibleFocusTarget(focusTarget) ? focusTarget : fallback;
      target?.focus({ preventScroll: true });

      if (target && document.activeElement !== target && remainingFocusFrames > 0) {
        remainingFocusFrames -= 1;
        window.requestAnimationFrame(restore);
      }
    };

    restore();
  }

  function closeAuth({ restoreFocus = true } = {}){
    const modal = getAuthModal();
    if (!modal?.open) return;
    const revision = ++authPresentationRevision;
    window.clearTimeout(authCloseTimer);
    const focusTarget = authReturnFocus;
    authReturnFocus = null;
    const finalize = () => {
      if (revision !== authPresentationRevision || modal.open) return;
      if (!document.querySelector('#ppAuthModal[open], #ppAccountPanel[open]')) {
        document.body.classList.remove('no-scroll');
      }
      if (restoreFocus) {
        const fallbackSelectors = window.matchMedia('(max-width: 820px)').matches
          ? ['[data-pp-mobile-account]', '#ppProfileChip', '#ppAuthLogoBtn']
          : ['#ppProfileChip', '#ppAuthLogoBtn', '[data-pp-mobile-account]'];
        restorePresentationFocusAfterClose({
          container: modal,
          focusTarget,
          fallbackSelectors,
          revision,
          currentRevision: () => authPresentationRevision
        });
      }
    };
    const scheduleFinalize = () => {
      if (revision !== authPresentationRevision || modal.open) return;
      authCloseTimer = window.setTimeout(
        finalize,
        authReducedMotionQuery.matches ? 0 : 260
      );
    };

    modal.addEventListener('close', scheduleFinalize, { once: true });
    try {
      modal.close();
    } catch {
      modal.removeEventListener('close', scheduleFinalize);
      scheduleFinalize();
    }
  }

  function bindAuthDialogCancel(modal) {
    if (!modal || modal.dataset.ppCancelBound === 'true') return;
    modal.dataset.ppCancelBound = 'true';
    modal.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeAuth();
    });
  }

  function bindAccountPanelPresentation(panel) {
    if (!panel || panel.dataset.ppPresentationBound === 'true') return;
    panel.dataset.ppPresentationBound = 'true';

    const observer = new MutationObserver(() => {
      if (!panel.open) return;
      accountPresentationRevision += 1;
      window.clearTimeout(accountCloseTimer);
      document.body.classList.add('no-scroll');
    });
    observer.observe(panel, { attributes: true, attributeFilter: ['open'] });

    panel.addEventListener('close', () => {
      const revision = ++accountPresentationRevision;
      window.clearTimeout(accountCloseTimer);
      const focusTarget = accountReturnFocus;
      accountReturnFocus = null;
      const finalize = () => {
        if (revision !== accountPresentationRevision || panel.open) return;
        if (!document.querySelector('#ppAuthModal[open], #ppAccountPanel[open]')) {
          document.body.classList.remove('no-scroll');
        }
        restorePresentationFocusAfterClose({
          container: panel,
          focusTarget,
          fallbackSelectors: ['#ppProfileChip', '#ppAuthLogoBtn', '[data-pp-mobile-account]'],
          revision,
          currentRevision: () => accountPresentationRevision
        });
      };
      accountCloseTimer = window.setTimeout(
        finalize,
        authReducedMotionQuery.matches ? 0 : 260
      );
    });
  }

  function closeAuthWhenLoggedIn() {
    if (document.body.classList.contains('pp-auth-logged')) {
      closeAuth();
      return;
    }

    const obs = new MutationObserver(() => {
      if (document.body.classList.contains('pp-auth-logged')) {
        obs.disconnect();
        closeAuth();
      }
    });

    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    setTimeout(() => obs.disconnect(), 5000);
  }
function bindAuthSteps(modal) {
  if (modal.__ppStepsBound) return;
  modal.__ppStepsBound = true;

const emailForm = q('#ppAuthEmailForm', modal); const emailInp = q('#ppAuthEmail', modal); const loginForm = q('#ppLoginForm', modal); const regForm = q('#ppRegisterForm', modal); bindBirthDateControl(modal);

  // Click router dentro del modal
  modal.addEventListener('click', (ev) => {
    const gcta = ev.target.closest('[data-login-google-cta]');
    if (gcta) {
      ev.preventDefault();
      const gb = modal.querySelector('[data-pp-google]');
      if (gb) gb.click();
      return;
    }

    const back = ev.target.closest('[data-back-auth]');
    if (back) {
      ev.preventDefault();
      showStep(modal, 'email');
      if (emailInp) emailInp.value = state.email || '';
      return;
    }

    const edit = ev.target.closest('[data-edit-email]');
    if (edit) {
      ev.preventDefault();
      showStep(modal, 'email');
      if (emailInp) emailInp.value = state.email || '';
      return;
    }

    const go = ev.target.closest('[data-go]');
    if (go) {
      ev.preventDefault();
      const step = go.getAttribute('data-go');
      if (step === 'login' || step === 'register') showStep(modal, step);
      return;
    }
  });

  // Submit email (STEP 1 -> STEP 2/3)
  emailForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    const email = (emailInp?.value || '').trim();
    if (!email) { emailInp?.focus(); return; }

    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) {
      showStep(modal, 'email');
      showAuthError(modal, 'email', 'auth/invalid-email');
      emailInp?.focus();
      return;
    }

    const submitBtn = emailForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
    }

    try {
      state.email = email;

      const loginHidden = q('#ppLoginEmailHidden', modal);
      const regHidden   = q('#ppRegEmailHidden', modal);
      if (loginHidden) loginHidden.value = email;
      if (regHidden)   regHidden.value   = email;

      // ✅ Económico: no intentamos “adivinar” si existe. Mostramos login.
      // En STEP 1 ya tienes botón “Crear cuenta” si no es miembro.
      const flow = await decideFlowByEmail(email);

      if (flow.nextStep === 'register') {
        showStep(modal, 'register');
        return;
      }

      showStep(modal, 'login');
      q('#ppLoginPass', modal)?.focus?.({ preventScroll: true });

    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
      }
    }
  });

  // Submit login (STEP 2)
  loginForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    const passInp = q('#ppLoginPass', loginForm);
    const pass = (passInp?.value ?? '');
    if (!pass) { passInp?.focus(); return; }

    const email = (q('#ppLoginEmailHidden', modal)?.value || state.email || '').trim();
    if (!email) { showStep(modal, 'email'); return; }

    try {
      const fn = window.ppSignInWithEmailPass;
      if (typeof fn !== 'function') throw new Error('Missing ppSignInWithEmailPass');


const cred = await fn(email, pass);
const user = cred?.user;

if (user && user.emailVerified === false) {
  // 1) Reenvío opcional (RECOMENDADO): refresca UX
  try { await user.reload?.(); } catch {}

  // 2) Reenvía verificación (si quieres automático)
  try {
    const resend = window.ppResendVerificationForCurrentUser;
    if (typeof resend === "function") await resend();
  } catch {}

  // 3) Fuera de sesión hasta verificar
  try { await window.ppSignOut?.(); } catch {}

  // 4) Mensaje elegante (en el propio modal)
  showStep(modal, "login");
  showAuthError(modal, "login", "pp/email-not-verified");

  // 5) Toast opcional
  window.dispatchEvent(new CustomEvent("pp:toast", {
    detail: { msg: "Te hemos enviado (o reenviado) el email de verificación. Revisa Bandeja y Spam." }
  }));
  return;
}

// ✅ Verificado => entra
closeAuthWhenLoggedIn();

     
    } catch (err) {
      const code = err?.code || 'auth/unknown';
      showStep(modal, 'login');
      showAuthError(modal, 'login', code === 'auth/wrong-password' ? 'auth/invalid-credential' : code);
    }
  });

  // Submit register (STEP 3)
  regForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    const gender = (q('#ppRegGender', regForm)?.value || '').trim();
    if (!gender) { q('#ppRegGender', regForm)?.focus(); return; }

    const first = (q('#ppRegFirstName', regForm)?.value || '').trim();
    if (!first) { q('#ppRegFirstName', regForm)?.focus(); return; }

const last = (q('#ppRegLastName', regForm)?.value || '').trim(); if (!last) { q('#ppRegLastName', regForm)?.focus(); return; } const birthState = normalizeBirthControl( regForm, { focusOnError: true } ); if (!birthState.valid) { return; } const country = (q('#ppRegCountry', regForm)?.value || '').trim();
    if (!country) { q('#ppRegCountry', regForm)?.focus(); return; }

    const phone = (q('#ppRegPhone', regForm)?.value || '').trim();
    if (!phone) { q('#ppRegPhone', regForm)?.focus(); return; }

    const passInp = q('#ppRegPass', regForm);
    const pass = (passInp?.value ?? '');
    if (!pass) { passInp?.focus(); return; }
    if (String(pass).length < 8) { showAuthError(modal, 'register', 'auth/weak-password'); return; }

    const termsOk = q('#ppRegTerms', regForm)?.checked;
    if (!termsOk) { q('#ppRegTerms', regForm)?.focus(); return; }

    const regEmailInput = q('#ppRegEmail', regForm);
    const regEmailHidden = q('#ppRegEmailHidden', modal);

    const email = (
      regEmailInput?.value ||
      regEmailHidden?.value ||
      state.email ||
      ''
    ).trim();

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!emailOk) {
      regEmailInput?.focus();
      showAuthError(modal, 'register', 'auth/invalid-email');
      return;
    }

    state.email = email;

    if (regEmailHidden) {
      regEmailHidden.value = email;
    }

const displayName = `${first} ${last}`.trim();

const profileData = { gender, firstName: first, lastName: last, /* Compatibilidad visual + formato normalizado */ birth: birthState.display, birthISO: birthState.iso, country,
  phoneCode: (q('#ppRegPhoneCode', regForm)?.value || '').trim(),
  phone,
  newsletter: !!q('#ppRegNewsletter', regForm)?.checked,
  termsAccepted: !!termsOk
};

try {
  const fn = window.ppCreateUserWithEmailPass;
  if (typeof fn !== 'function') throw new Error('Missing ppCreateUserWithEmailPass');

  await fn(email, pass, displayName, profileData);

      const titleEl = modal.querySelector('[data-auth-title]');
      const subEl   = modal.querySelector('[data-auth-subtitle]');
if (titleEl) titleEl.textContent = 'Revisa tu correo';
if (subEl) {
  subEl.textContent =
    'Te hemos enviado un enlace de verificación. Confirma tu cuenta antes de iniciar sesión en Prophetia.';
}
    // Mantiene visible el mensaje de verificación antes de volver al login
setTimeout(() => {
  state.email = email;

  const loginHidden = q('#ppLoginEmailHidden', modal);
  if (loginHidden) loginHidden.value = email;

  showStep(modal, 'login');
}, 5000);

    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') {
        showStep(modal, 'login');
        return;
      }
      showAuthError(modal, 'register', code);
    }
  });
}


  function openAuth(step = 'email'){
    const modal = getAuthModal();
    if (!modal) return;

    authPresentationRevision += 1;
    window.clearTimeout(authCloseTimer);

    bindAuthDialogCancel(modal);
    if (window.matchMedia('(max-width: 820px)').matches) portalNodeToBody(modal);
    if (!modal.open) {
      const focusCandidate = document.activeElement instanceof HTMLElement &&
        document.activeElement.closest('#ppMobileMenuPanel')
        ? document.querySelector('[data-pp-mobile-account]')
        : document.activeElement;
      authReturnFocus = isVisibleFocusTarget(focusCandidate) ? focusCandidate : null;
    }

    const targetStep = step === 'login' || step === 'register' ? step : 'email';
    showStep(modal, targetStep);

    try { if (!modal.open) modal.showModal(); } catch (e) {
      console.error('[AUTH] showModal failed', e);
      return;
    }

    document.body.classList.add('no-scroll');
    bindAuthSteps(modal);
    const revision = authPresentationRevision;
    window.requestAnimationFrame(() => {
      if (revision !== authPresentationRevision || !modal.open) return;
      const activeStep = modal.querySelector(`[data-step="${targetStep}"]:not(.hidden)`);
      activeStep?.querySelector('input:not([disabled]), button:not([disabled])')
        ?.focus({ preventScroll: true });
    });
  }
// ✅ Toggle password · login + registro
document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('#ppAuthModal .toggle-pass');
  if (!btn) return;

  ev.preventDefault();
  ev.stopPropagation();

  const wrap = btn.closest('.sp-password');
  if (!wrap) return;

  const input = wrap.querySelector('input[type="password"], input[type="text"]');
  if (!input) return;

  const isHidden = input.type === 'password';

  input.type = isHidden ? 'text' : 'password';

  btn.setAttribute('aria-pressed', String(isHidden));
  btn.setAttribute(
    'aria-label',
    isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña'
  );

  btn.textContent = isHidden ? '🙈' : '👁';

  input.focus({ preventScroll: true });
}, true);

  // ===== Global open/close handlers (limpios) =====
document.addEventListener('click', (e) => {
  const explicitAuth = e.target.closest('[data-pp-open-login], [data-pp-open-register]');
  const guestBtn   = e.target.closest('#ppAuthLogoBtn');
  const profileBtn = e.target.closest('#ppProfileChip');
  const closeBtn   = e.target.closest('[data-close="auth"]');

  if (explicitAuth) {
    e.preventDefault();
    if (!partialsInjected || !getAuthModal()) return;
    openAuth(explicitAuth.matches('[data-pp-open-register]') ? 'register' : 'login');
    return;
  }

  if (guestBtn) {
    e.preventDefault();
    if (!partialsInjected || !getAuthModal()) return;
    openAuth();
    return;
  }

  if (profileBtn) {
    e.preventDefault();

    // ✅ si está logado -> abrir panel cuenta
    if (document.body.classList.contains('pp-auth-logged')) {
      const accountPanel = q('#ppAccountPanel');
      bindAccountPanelPresentation(accountPanel);
      accountPresentationRevision += 1;
      window.clearTimeout(accountCloseTimer);
      accountReturnFocus = isVisibleFocusTarget(profileBtn) ? profileBtn : null;
      window.ppOpenAccount?.();
      if (accountPanel?.open) document.body.classList.add('no-scroll');
      return;
    }

    // fallback: si por lo que sea no está logado, abre auth
    openAuth();
    return;
  }

  if (closeBtn) {
    e.preventDefault();
    closeAuth();
  }
});


  // Backdrop click
  document.addEventListener('click', (e) => {
    const modal = getAuthModal();
    if (!modal || !modal.open) return;
    if (e.target !== modal) return;
    closeAuth();
  });

  // ESC
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal = getAuthModal();
    if (modal?.open) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeAuth();
    }
  });

  // Expose globals
  window.ppOpenAuth  = openAuth;
  window.ppCloseAuth = closeAuth;
  window.ppCloseAuthWhenLoggedIn = closeAuthWhenLoggedIn;

})();


  
 /* =============== Mega menú global accesible =============== */
(function () {
  const HOVER_OPEN_DELAY = 70;
  const supportsHover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  const cssEscape = window.CSS?.escape || ((value) => String(value).replace(/[^a-zA-Z0-9_-]/g, '\\\\$&'));

  let openTimer = 0;
  let activeKey = '';

  const getRoot = () => document.querySelector('.mega[data-prop-mega]');

  function getParts(root = getRoot()) {
    return {
      root,
      wrap: root?.querySelector('.mega-panel[data-mega]') || null,
      toggles: Array.from(root?.querySelectorAll('.mega-toggle') || []),
      panels: Array.from(root?.querySelectorAll('.panel[role="tabpanel"]') || [])
    };
  }

  function clearMegaTimers() {
    window.clearTimeout(openTimer);
  }

  function getPanelForButton(root, button) {
    const key = String(button?.dataset?.panel || '').trim();
    const controls = String(button?.getAttribute('aria-controls') || '').trim();
    const panel = controls
      ? root?.querySelector(`#${cssEscape(controls)}`)
      : key
        ? root?.querySelector(`#panel-${cssEscape(key)}`)
        : null;

    return { key, panel };
  }
  function setToggleState(toggles, activeButton = null) {
    toggles.forEach((button) => {
      const active = button === activeButton;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-expanded', active ? 'true' : 'false');
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.type = 'button';
    });
  }

  function closeMega({ restoreFocus = false } = {}) {
    document.body.classList.remove('pp-mega-open');

    const { root, wrap, toggles, panels } = getParts();
    if (!root) return;

    const previousButton = activeKey
      ? root.querySelector(`.mega-toggle[data-panel="${cssEscape(activeKey)}"]`)
      : null;

    clearMegaTimers();
    activeKey = '';
    root.classList.remove('is-open');
    root.removeAttribute('data-active-panel');
    setToggleState(toggles, null);

    panels.forEach((panel) => {
      panel.hidden = true;
    });

    if (wrap) {
      wrap.setAttribute('aria-hidden', 'true');
      wrap.hidden = true;
    }

    if (restoreFocus) {
      previousButton?.focus({ preventScroll: true });
    }
  }

  function openMega(button, { focusFirst = false } = {}) {
    const root = button?.closest('.mega[data-prop-mega]');
    if (!root) return;

    const { wrap, toggles, panels } = getParts(root);
    const { key, panel } = getPanelForButton(root, button);

    if (!wrap || !panel || !key) return;

    clearMegaTimers();
    activeKey = key;

    panels.forEach((item) => {
      item.hidden = item !== panel;
    });

    wrap.hidden = false;
    wrap.setAttribute('aria-hidden', 'false');
    wrap.setAttribute('aria-labelledby', button.id || '');

    root.dataset.activePanel = key;
    root.classList.add('is-open');
    document.body.classList.add('pp-mega-open');
    setToggleState(toggles, button);

    if (focusFirst) {
      window.requestAnimationFrame(() => {
        panel.querySelector('a, button')?.focus({ preventScroll: true });
      });
    }
  }

  function scheduleOpen(button) {
    window.clearTimeout(openTimer);
    openTimer = window.setTimeout(() => openMega(button), HOVER_OPEN_DELAY);
  }


  function focusAdjacentToggle(current, direction) {
    const { toggles } = getParts();
    const index = toggles.indexOf(current);
    if (index < 0 || !toggles.length) return;

    const next = toggles[(index + direction + toggles.length) % toggles.length];
    next.focus({ preventScroll: true });
    openMega(next);
  }

  function bindMega() {
    const { root, wrap, toggles, panels } = getParts();
    if (!root || !wrap || root.dataset.ppMegaBound === 'true') return;

    root.dataset.ppMegaBound = 'true';
    wrap.hidden = true;
    wrap.setAttribute('aria-hidden', 'true');

    toggles.forEach((button) => {
      button.type = 'button';
      button.setAttribute('aria-haspopup', 'true');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-selected', 'false');

      if (supportsHover) {
        button.addEventListener('pointerenter', () => {
          if (root.classList.contains('is-open')) scheduleOpen(button);
        });
      }

      button.addEventListener('focus', () => openMega(button));

      button.addEventListener('click', (event) => {
        event.preventDefault();
        openMega(button);
      });

      button.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          focusAdjacentToggle(button, 1);
        }

        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          focusAdjacentToggle(button, -1);
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          openMega(button, { focusFirst: true });
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          closeMega({ restoreFocus: true });
        }
      });
    });

    panels.forEach((panel) => {
      panel.hidden = true;
    });

    if (supportsHover) {
      root.addEventListener('pointerenter', () => {
        window.clearTimeout(openTimer);
      });
    }


    document.addEventListener('pointerdown', (event) => {
      const latestRoot = getRoot();
      if (!latestRoot?.classList.contains('is-open')) return;
      if (latestRoot.contains(event.target)) return;
      closeMega();
    });


    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMega({ restoreFocus: true });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindMega, { once: true });
  } else {
    bindMega();
  }

  window.addEventListener('partials:ready', bindMega);
})();
    /* =============== Ajuste de --pp-header-h =============== */
function setHeaderHeightVar() {
  const hd = document.getElementById('header');
  const el = hd ? hd.firstElementChild : null;
  const h  = (el?.getBoundingClientRect?.().height) || 64;
  document.documentElement.style.setProperty('--pp-header-h', `${Math.round(h)}px`);
}

window.addEventListener('resize', () => setHeaderHeightVar());



window.addEventListener('partials:ready', () => {
  setHeaderHeightVar();
});


window.addEventListener("partials:ready", normalizeHeaderAuthIcons);
window.addEventListener("partials:ready", initHeaderSearch);
window.addEventListener("partials:ready", initMobileDock);
window.addEventListener("partials:ready", initMobileHeroVideoFallbacks);
window.addEventListener("pp:auth-changed", normalizeHeaderAuthIcons);

document.addEventListener("DOMContentLoaded", () => {
  normalizeHeaderAuthIcons();
  initHeaderSearch();
  initCollectionSearchPage();
  initMobileDock();
  initMobileHeroVideoFallbacks();
});

const ppAuthClassObserver = new MutationObserver(() => {
  normalizeHeaderAuthIcons();
});

ppAuthClassObserver.observe(document.body, {
  attributes: true,
  attributeFilter: ["class"]
});

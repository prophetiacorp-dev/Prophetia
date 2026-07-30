
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
  let returnFocus = null;
  let catalogPromise = null;
  let searchTimer = 0;
  let searchRevision = 0;
  let searchResults = null;
  let activeSublevel = null;

  function setExpanded(source = null) {
    menuButton?.setAttribute('aria-expanded', source === 'menu' ? 'true' : 'false');
    searchButton?.setAttribute('aria-expanded', source === 'search' ? 'true' : 'false');
  }

  function sectionForPath(pathname) {
    if (pathname === '/hombre' || pathname === '/hoodies' || pathname.endsWith('-hombre')) {
      return 'men';
    }

    if (pathname === '/mujer' || pathname === '/hoodies-mujer' || pathname.endsWith('-mujer')) {
      return 'women';
    }

    if (pathname === '/colecciones' || pathname.startsWith('/assets/collects/')) {
      return 'collections';
    }

    if (['/about', '/studio', '/musica', '/events'].includes(pathname)) return 'house';
    if (pathname === '/prophetia-originals') return 'originals';
    if ([
      '/account',
      '/my-services',
      '/my-content',
      '/pedidos',
      '/addresses',
      '/reservas',
      '/drop-calendar',
      '/vault',
      '/prophet-private',
      '/wishlist'
    ].includes(pathname)) {
      return 'house';
    }

    return 'women';
  }

  function activateSection(name, { focus = false } = {}) {
    const selectedTab = tabs.find((tab) => tab.dataset.ppMobileTab === name) || tabs[0];
    if (!selectedTab) return;

    const selectedName = selectedTab.dataset.ppMobileTab;
    tabs.forEach((tab) => {
      const active = tab === selectedTab;
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
    });

    sections.forEach((section) => {
      const isSelected = section.dataset.ppMobileSection === selectedName;
      section.hidden = !isSelected;
      section.classList.remove('is-submenu-open');
      section.querySelectorAll('[data-pp-mobile-level]').forEach((level) => {
        level.hidden = false;
        level.classList.remove('is-active');
      });
    });

    activeSublevel = null;
    syncSublevelState();

    if (!panel.hidden) {
      selectedTab.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    if (focus) selectedTab.focus({ preventScroll: true });
  }

  function syncSublevelState({ keepSublevelInteractive = false } = {}) {
    const activeSection = sections.find((section) => !section.hidden);
    const level = activeSection?.querySelector(
      `[data-pp-mobile-level="${activeSublevel || 'root'}"]`
    );
    const triggers = activeSection
      ? Array.from(activeSection.querySelectorAll('[data-pp-mobile-level-trigger]'))
      : [];

    sections.forEach((section) => {
      const isActiveSection = section === activeSection;
      section.classList.toggle('is-submenu-open', isActiveSection && Boolean(activeSublevel));

      section.querySelectorAll('[data-pp-mobile-level]').forEach((item) => {
        const isCurrentLevel = item === level;
        const keepInteractive = keepSublevelInteractive &&
          item !== level &&
          item.dataset.ppMobileLevel !== 'root';
        const isExposed = isCurrentLevel || keepInteractive;

        item.hidden = false;
        item.classList.toggle('is-active', isCurrentLevel);
        item.setAttribute('aria-hidden', isExposed ? 'false' : 'true');
        item.toggleAttribute('inert', !isExposed);
      });
    });

    triggers.forEach((trigger) => {
      const isActive = trigger.dataset.ppMobileLevelTrigger === activeSublevel;
      trigger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    });

    backButton.hidden = !activeSublevel;
    backButton.setAttribute('aria-hidden', activeSublevel ? 'false' : 'true');
  }

  function openSublevel(name, { focus = true } = {}) {
    const activeSection = sections.find((section) => !section.hidden);
    const target = activeSection?.querySelector(`[data-pp-mobile-level="${name}"]`);
    if (!target) return;

    activeSublevel = name;
    syncSublevelState();

    if (focus) {
      window.requestAnimationFrame(() => {
        target.querySelector('a, button')?.focus({ preventScroll: true });
      });
    }
  }

  function closeSublevel({ focus = true } = {}) {
    if (!activeSublevel) return false;

    const closingSublevel = activeSublevel;
    const activeSection = sections.find((section) => !section.hidden);
    const track = activeSection?.querySelector('.pp-mobile-menu__views-track');
    activeSublevel = null;
    syncSublevelState({ keepSublevelInteractive: true });

    let finalized = false;
    const finalize = () => {
      if (finalized) return;
      finalized = true;
      syncSublevelState();

      if (focus) {
        window.requestAnimationFrame(() => {
          sections.find((section) => !section.hidden)
            ?.querySelector(`[data-pp-mobile-level-trigger="${closingSublevel}"]`)
            ?.focus({ preventScroll: true });
        });
      }
    };

    if (track) {
      track.addEventListener('transitionend', (event) => {
        if (event.propertyName === 'transform') finalize();
      }, { once: true });
      window.setTimeout(finalize, 320);
    } else {
      finalize();
    }

    return true;
  }

  function closePanel({ restoreFocus = true } = {}) {
    const wasOpen = !panel.hidden;
    activeSublevel = null;
    syncSublevelState();
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('pp-mobile-panel-open');
    setExpanded();

    if (wasOpen && restoreFocus && returnFocus instanceof HTMLElement) {
      returnFocus.focus({ preventScroll: true });
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
    closePanel({ restoreFocus: false });
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

  function normalizeSearchText(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es')
      .trim();
  }

  function catalogSearchText(item) {
    const labels = Array.isArray(item?.labels)
      ? item.labels.map((label) => typeof label === 'string' ? label : label?.label)
      : [];

    return normalizeSearchText([
      item?.id,
      item?.slug,
      item?.title,
      item?.short,
      item?.section,
      item?.collection,
      item?.gender,
      item?.type,
      ...labels
    ].filter(Boolean).join(' '));
  }

  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = fetch('/assets/data/catalog.json', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal
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
      link.href = `/producto?id=${encodeURIComponent(productId)}`;

      const title = document.createElement('strong');
      title.textContent = String(item?.title || id);
      link.appendChild(title);

      const metaParts = [item?.collection, item?.section, item?.type]
        .map((value) => String(value || '').replace(/-/g, ' ').trim())
        .filter(Boolean);
      if (metaParts.length) {
        const meta = document.createElement('span');
        meta.textContent = metaParts.join(' · ');
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
      const catalog = await loadCatalog();
      if (revision !== searchRevision) return;

      const normalizedQuery = normalizeSearchText(query);
      const matches = catalog
        .filter((item) => item?.active !== false && (String(item?.slug || '').trim() || String(item?.id || '').trim()))
        .map((item, index) => {
          const title = normalizeSearchText(item?.title);
          const id = normalizeSearchText(item?.id);
          const haystack = catalogSearchText(item);
          let score = 3;
          if (title.startsWith(normalizedQuery)) score = 0;
          else if (title.includes(normalizedQuery)) score = 1;
          else if (id.includes(normalizedQuery)) score = 2;
          return { item, index, score, matches: haystack.includes(normalizedQuery) };
        })
        .filter((entry) => entry.matches)
        .sort((a, b) => a.score - b.score || a.index - b.index)
        .slice(0, 8)
        .map((entry) => entry.item);

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
    if (!active) closePanel({ restoreFocus: false });

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

    returnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : menuButton;
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('pp-mobile-panel-open');
    setExpanded(focusSearch ? 'search' : 'menu');
    syncSearchClearButton();

    window.requestAnimationFrame(() => {
      if (focusSearch) searchInput?.focus({ preventScroll: true });
      else closeButton?.focus({ preventScroll: true });
    });
  }

  function clickHeaderControl(selector) {
    const control = document.querySelector(selector);
    if (control instanceof HTMLElement) control.click();
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
  listen(closeButton, 'click', () => closePanel());

  listen(backButton, 'click', () => {
    closeSublevel();
  });

  listen(panel, 'click', (event) => {
    const trigger = event.target.closest('[data-pp-mobile-level-trigger]');
    if (!trigger || !panel.contains(trigger)) return;

    event.preventDefault();
    openSublevel(trigger.dataset.ppMobileLevelTrigger);
  });

  listen(accountButton, 'click', () => {
    closePanel({ restoreFocus: false });
    if (document.body.classList.contains('pp-auth-logged')) {
      window.location.assign('/my-content');
      return;
    }

    const modal = getAuthModal();
    if (modal) portalNodeToBody(modal);

    if (typeof window.ppOpenAuth === 'function') window.ppOpenAuth();
    else clickHeaderControl('#ppAuthLogoBtn');
  });

  listen(cartButton, 'click', () => {
    closePanel({ restoreFocus: false });
    if (typeof window.ppOpenCart === 'function') {
      window.ppOpenCart(cartButton);
      return;
    }
    clickHeaderControl('#ppCartBtn');
  });

  listen(panel, 'click', (event) => {
    if (event.target.closest('a')) closePanel({ restoreFocus: false });
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
    if (panel.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      if (!closeSublevel()) closePanel();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = Array.from(panel.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => !element.closest('[hidden]'));
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
  activateSection(sectionForPath(currentPath));
  panel.querySelectorAll('a[href]').forEach((link) => {
    const href = new URL(link.href, window.location.origin).pathname.replace(/\/$/, '') || '/home';
    if (href === currentPath) link.setAttribute('aria-current', 'page');
  });

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

  function closeAuth({ restoreFocus = true } = {}){
    const modal = getAuthModal();
    if (!modal?.open) return;
    try { if (modal.open) modal.close(); } catch {}
    document.body.classList.remove('no-scroll');

    const focusTarget = authReturnFocus;
    authReturnFocus = null;
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const fallbackSelectors = window.matchMedia('(max-width: 820px)').matches
            ? ['[data-pp-mobile-account]', '#ppProfileChip', '#ppAuthLogoBtn']
            : ['#ppProfileChip', '#ppAuthLogoBtn', '[data-pp-mobile-account]'];
          const fallback = fallbackSelectors
            .map((selector) => document.querySelector(selector))
            .find(isVisibleFocusTarget);
          const target = isVisibleFocusTarget(focusTarget) ? focusTarget : fallback;
          target?.focus({ preventScroll: true });
        });
      });
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

    panel.addEventListener('close', () => {
      if (!document.querySelector('#ppAuthModal[open], #ppAccountPanel[open]')) {
        document.body.classList.remove('no-scroll');
      }

      const focusTarget = accountReturnFocus;
      accountReturnFocus = null;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const fallback = ['#ppProfileChip', '#ppAuthLogoBtn', '[data-pp-mobile-account]']
            .map((selector) => document.querySelector(selector))
            .find(isVisibleFocusTarget);
          const target = isVisibleFocusTarget(focusTarget) ? focusTarget : fallback;
          target?.focus({ preventScroll: true });
        });
      });
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
    if (modal?.open) closeAuth();
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
window.addEventListener("partials:ready", initMobileDock);
window.addEventListener("partials:ready", initMobileHeroVideoFallbacks);
window.addEventListener("pp:auth-changed", normalizeHeaderAuthIcons);

document.addEventListener("DOMContentLoaded", () => {
  normalizeHeaderAuthIcons();
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

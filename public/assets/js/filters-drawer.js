/* ===================================================================
   PROPHETIA · filters-drawer.js (DUAL)
   - Soporta men-* y women-* según el drawer presente
   - Tabs, contadores, clear/apply
   =================================================================== */

(function () {
  const firstById = (...ids) => {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    return null;
  };

  // Detecta prefijo por elementos reales en el DOM (más robusto)
  const hasMen = !!document.querySelector('.men-filters-drawer, #menFiltersDrawer');
  const hasWomen = !!document.querySelector('.women-filters-drawer, #womenFiltersDrawer');

  const prefix =
    hasWomen ? 'women' :
    (hasMen ? 'men' : null);

  if (!prefix) return;

  // Si existe el drawer por clase pero no por id, lo resolvemos por id esperado
  // (Mantiene tu arquitectura de IDs prefix+Name)

const COLOR_MAP = {
  negro:'black', blanco:'white', azul:'blue', marino:'navy', marron:'brown', beige:'beige',
  rojo:'red', naranja:'orange', amarillo:'yellow', verde:'green', morado:'purple',
  gris:'gray', plata:'silver', dorado:'gold', rosa:'pink',
  multicolor:'multicolor'
};

const norm = (v='') => String(v ?? '').trim().toLowerCase();

  const $id = (name) => document.getElementById(`${prefix}${name}`);

  // Raíces
  const overlay  = $id('FiltersOverlay');
  const drawer   = $id('FiltersDrawer');
  const openBtn  = $id('OpenFilters');
  const closeBtn = $id('CloseFilters');

  if (!overlay || !drawer || !openBtn) return;

  // Selectores por prefijo
  const tabs   = Array.from(drawer.querySelectorAll(`.${prefix}-filters-tab`));
  const panels = Array.from(drawer.querySelectorAll(`.${prefix}-filters-panel`));

  const colorInputs = Array.from(drawer.querySelectorAll(`[data-panel="color"] .${prefix}-swatch-input`));
  const sizeInputs  = Array.from(drawer.querySelectorAll(`[data-panel="talla"] input[name="size"]`));
  const categoryInputs = Array.from(drawer.querySelectorAll(
    `[data-panel="categoria"] input[name="cat"], [data-panel="category"] input[name="category"]`
  ));

  // IDs contadores/botones
  const tabColorCount   = $id('TabColorCount');
  const tabSizeCount    = $id('TabSizeCount');
  const activeCountSpan = $id('ActiveCount');
  const resultsSpan     = $id('ResultsCount');
  const clearBtn        = $id('ClearFilters');
  const applyBtn        = $id('ApplyFilters');

  // Todos los controles En stock existentes en toolbar y drawer.
  // Se deduplican para evitar listeners y aplicaciones duplicadas.
  const inStockToggles = Array.from(new Set([
    document.getElementById(`${prefix}FilterStock`),
    document.getElementById(`${prefix}InStockToggle`),
    document.getElementById('ppInStockToggle'),
    ...drawer.querySelectorAll('input[name="inStock"], input[data-filter="in-stock"]'),
    ...document.querySelectorAll('.pp-filters input[type="checkbox"][data-filter="in-stock"]')
  ].filter(Boolean)));

  const syncInStockControls = (checked) => {
    inStockToggles.forEach((input) => {
      input.checked = checked;
    });
  };

  let returnFocus = null;
  const mobileFiltersQuery = window.matchMedia('(max-width: 820px)');

  const isDrawerOpen = () => drawer.classList.contains('is-open');

  openBtn.setAttribute('aria-expanded', isDrawerOpen() ? 'true' : 'false');
  if (drawer.id) openBtn.setAttribute('aria-controls', drawer.id);

  function getFocusable() {
    return Array.from(drawer.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((node) => !node.closest('[hidden]') && node.getAttribute('aria-hidden') !== 'true');
  }

  function syncTabAccessibility() {
    if (!mobileFiltersQuery.matches) {
      tabs.forEach((tab) => tab.removeAttribute('tabindex'));
      panels.forEach((panel) => {
        panel.removeAttribute('hidden');
        panel.removeAttribute('aria-hidden');
      });
      return;
    }

    const activeTab = tabs.find((tab) => tab.classList.contains('is-active')) || tabs[0];
    const activeTarget = activeTab?.dataset.tab;
    tabs.forEach((tab) => {
      const active = tab === activeTab;
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      const active = panel.dataset.panel === activeTarget;
      panel.hidden = !active;
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
  }

  function openDrawer() {
    if (mobileFiltersQuery.matches) {
      returnFocus = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : openBtn;
    }
    overlay.classList.add('is-open');
    drawer.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    if (!drawer.hasAttribute('aria-label') && !drawer.hasAttribute('aria-labelledby')) {
      drawer.setAttribute('aria-label', 'Filtros de productos');
    }
    openBtn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('no-scroll', 'pp-filters-open');

    if (mobileFiltersQuery.matches) {
      window.requestAnimationFrame(() => {
        (closeBtn || getFocusable()[0])?.focus?.({ preventScroll: true });
      });
    }
  }

  function closeDrawer({ restoreFocus = true } = {}) {
    const wasOpen = isDrawerOpen();
    overlay.classList.remove('is-open');
    drawer.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('aria-hidden', 'true');
    openBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('pp-filters-open');
    if (!document.body.classList.contains('pp-cart-open') &&
        !document.body.classList.contains('pp-mobile-panel-open')) {
      document.body.classList.remove('no-scroll');
    }

    if (wasOpen && restoreFocus && returnFocus?.isConnected) {
      returnFocus.focus?.({ preventScroll: true });
    }
    returnFocus = null;
  }

function getState() {
  const rawColors = colorInputs.filter(i => i.checked).map(i => norm(i.value));
  const colors = [];

  rawColors.forEach(c => {
    if (!c) return;
    colors.push(c);
    const mapped = norm(COLOR_MAP[c] || '');
    if (mapped && mapped !== c) colors.push(mapped);
  });

  const sizes = sizeInputs.filter(i => i.checked).map(i => i.value);
  const categories = categoryInputs
    .filter(i => i.checked)
    .map(i => norm(i.value))
    .filter(Boolean);
  const inStock = inStockToggles.some((input) => input.checked);

  return {
    colors: [...new Set(colors)],
    sizes,
    categories: [...new Set(categories)],
    inStock,
    scope: prefix
  };
}


  function emit(type) {
    const detail = getState();
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function updateCounts() {
    const cColors = colorInputs.filter(i => i.checked).length;
    const cSizes = sizeInputs.filter(i => i.checked).length;
    const cCategories = categoryInputs.filter(i => i.checked).length;
    const cStock = inStockToggles.some((input) => input.checked) ? 1 : 0;
    const total = cColors + cSizes + cCategories + cStock;

    if (tabColorCount) tabColorCount.textContent = cColors ? `(${cColors})` : '';
    if (tabSizeCount) tabSizeCount.textContent = cSizes ? `(${cSizes})` : '';

    const categoryCount = $id('TabCatCount') || $id('TabCategoryCount');
    if (categoryCount) {
      categoryCount.textContent = cCategories ? `(${cCategories})` : '';
    }
    if (activeCountSpan) activeCountSpan.textContent = total ? `(${total})` : '';

    // Esto lo sobreescribirá plp-firestore con el número real si escuchas pp:plp:count
    if (resultsSpan) {
  const draft = getState();
  if (window.ppPLP && typeof window.ppPLP.count === 'function') {
    resultsSpan.textContent = String(window.ppPLP.count(draft));
  } else {
    resultsSpan.textContent = '0';
  }
}


    emit('pp:filters:change');
  }

  // Open / Close
  openBtn.addEventListener('click', (e) => { e.preventDefault(); openDrawer(); });
  if (closeBtn) closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeDrawer(); });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDrawer(); });
  document.addEventListener('keydown', (e) => {
    if (!isDrawerOpen()) return;

    if (e.key === 'Escape') {
      if (mobileFiltersQuery.matches) e.preventDefault();
      closeDrawer();
      return;
    }

    if (e.key !== 'Tab' || !mobileFiltersQuery.matches) return;
    const focusable = getFocusable();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, true);

  // Tabs
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => {
        const active = (t === tab);
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panels.forEach(p => {
        const active = p.dataset.panel === target;
        p.classList.toggle('is-active', active);
      });
      syncTabAccessibility();
    });

    tab.addEventListener('keydown', (event) => {
      if (!mobileFiltersQuery.matches ||
          !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();

      let nextIndex = index;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;

      const nextTab = tabs[nextIndex];
      nextTab?.click();
      nextTab?.focus({ preventScroll: true });
    });
  });

  syncTabAccessibility();
  mobileFiltersQuery.addEventListener?.('change', (event) => {
    syncTabAccessibility();
    if (!event.matches && isDrawerOpen()) closeDrawer({ restoreFocus: false });
  });

  // Inputs
  [...colorInputs, ...sizeInputs, ...categoryInputs].forEach((input) => {
    input.addEventListener('change', updateCounts);
  });

  inStockToggles.forEach((input) => {
    input.addEventListener('change', () => {
      syncInStockControls(input.checked);
      updateCounts();

      const draft = getState();
      if (window.ppPLP && typeof window.ppPLP.apply === 'function') {
        window.ppPLP.apply(draft);
      } else {
        document.dispatchEvent(new CustomEvent('pp:plp:filter', { detail: draft }));
      }
    });
  });

  document.addEventListener('pp:plp:rendered', updateCounts);

  // Clear
  if (clearBtn) clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    [...colorInputs, ...sizeInputs, ...categoryInputs].forEach((input) => {
      input.checked = false;
    });
    syncInStockControls(false);
    updateCounts();
    const draft = getState();
    if (window.ppPLP && typeof window.ppPLP.apply === 'function') {
      window.ppPLP.apply(draft);
    } else {
      document.dispatchEvent(new CustomEvent('pp:plp:filter', { detail: draft }));
    }
    emit('pp:filters:apply');
  });

  // Apply
  if (applyBtn) applyBtn.addEventListener('click', (e) => {
    e.preventDefault();
    emit('pp:filters:apply');
    const draft = getState();
if (window.ppPLP && typeof window.ppPLP.apply === 'function') {
  window.ppPLP.apply(draft);
} else {
  // fallback por evento (si algún día cambias arquitectura)
  document.dispatchEvent(new CustomEvent('pp:plp:filter', { detail: draft }));
}

    closeDrawer();
  });

  updateCounts();
})();

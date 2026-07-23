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

  // IDs contadores/botones
  const tabColorCount   = $id('TabColorCount');
  const tabSizeCount    = $id('TabSizeCount');
  const activeCountSpan = $id('ActiveCount');
  const resultsSpan     = $id('ResultsCount');
  const clearBtn        = $id('ClearFilters');
  const applyBtn        = $id('ApplyFilters');

  // Toggle stock (si existe)
  const inStockToggle   = document.getElementById('ppInStockToggle') || document.querySelector('.pp-filters .pp-check input[type="checkbox"]');

  function openDrawer() {
    overlay.classList.add('is-open');
    drawer.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
  }

  function closeDrawer() {
    overlay.classList.remove('is-open');
    drawer.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
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

  const sizes  = sizeInputs.filter(i => i.checked).map(i => i.value);
  const inStock = !!(inStockToggle && inStockToggle.checked);
  return { colors: [...new Set(colors)], sizes, inStock, scope: prefix };
}


  function emit(type) {
    const detail = getState();
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function updateCounts() {
    const cColors = colorInputs.filter(i => i.checked).length;
    const cSizes  = sizeInputs.filter(i => i.checked).length;
    const total   = cColors + cSizes;

    if (tabColorCount) tabColorCount.textContent = cColors ? `(${cColors})` : '';
    if (tabSizeCount)  tabSizeCount.textContent  = cSizes  ? `(${cSizes})`  : '';
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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); }, true);

  // Tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => {
        const active = (t === tab);
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panels.forEach(p => p.classList.toggle('is-active', p.dataset.panel === target));
    });
  });

  // Inputs
  [...colorInputs, ...sizeInputs].forEach(input => input.addEventListener('change', updateCounts));
  if (inStockToggle) {
    inStockToggle.addEventListener('change', () => {
      updateCounts();
      const draft = getState();
      if (window.ppPLP && typeof window.ppPLP.apply === 'function') {
        window.ppPLP.apply(draft);
      } else {
        document.dispatchEvent(new CustomEvent('pp:plp:filter', { detail: draft }));
      }
    });
  }

  document.addEventListener('pp:plp:rendered', updateCounts);

  // Clear
  if (clearBtn) clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    [...colorInputs, ...sizeInputs].forEach(i => (i.checked = false));
    if (inStockToggle) inStockToggle.checked = false;
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

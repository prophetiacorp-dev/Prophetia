/* =========================================================
   PROPHETIA - Camisetas hombre PLP controls
   Sort dropdown + dense view toggle.
   ========================================================= */
(function () {
  const body = document.body;
  if (!body?.classList.contains('men-page') || !body.classList.contains('camisetas-page')) return;

  const sortRoot = document.getElementById('menSortControl');
  const sortButton = document.getElementById('menSortButton');
  const sortMenu = document.getElementById('menSortMenu');
  const viewButton = document.getElementById('menViewToggle');

  function closeSort() {
    if (!sortRoot || !sortButton || !sortMenu) return;
    sortRoot.classList.remove('is-open');
    sortButton.setAttribute('aria-expanded', 'false');
    sortMenu.hidden = true;
  }

  function openSort() {
    if (!sortRoot || !sortButton || !sortMenu) return;
    sortRoot.classList.add('is-open');
    sortButton.setAttribute('aria-expanded', 'true');
    sortMenu.hidden = false;
  }

  sortButton?.addEventListener('click', (event) => {
    event.preventDefault();
    if (sortRoot.classList.contains('is-open')) closeSort();
    else openSort();
  });

  sortMenu?.addEventListener('click', (event) => {
    const option = event.target.closest('.pp-sort-option');
    if (!option) return;

    event.preventDefault();
    const mode = option.dataset.sort || 'relevance';

    sortMenu.querySelectorAll('.pp-sort-option').forEach((item) => {
      const active = item === option;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    if (sortButton) sortButton.textContent = option.textContent.trim();

    if (window.ppPLP && typeof window.ppPLP.sort === 'function') {
      window.ppPLP.sort(mode);
    }

    closeSort();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!sortRoot?.classList.contains('is-open')) return;
    if (sortRoot.contains(event.target)) return;
    closeSort();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSort();
  });

  viewButton?.addEventListener('click', () => {
    const dense = !body.classList.contains('is-plp-dense-view');
    body.classList.toggle('is-plp-dense-view', dense);
    viewButton.setAttribute('aria-pressed', dense ? 'true' : 'false');
    viewButton.textContent = dense ? 'Vista normal' : 'Vista';
  });
})();
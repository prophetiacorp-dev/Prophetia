/* =========================================================
   PROPHETIA · Wishlist
   Selección local + recomendaciones editoriales
   ========================================================= */

(function(){
  const KEY = 'pp_wishlist_v1';
const SHOP_PREF_KEY = 'pp_shop_preference';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function getWishlistUser() {
    return (
      window.__ppAuthCurrentUser ||
      window.__ppLastUser ||
      window.__ppFirebaseAuth?.currentUser ||
      null
    );
  }

  function isWishlistUnlocked() {
    const user = getWishlistUser();
    return Boolean(user?.uid && user.emailVerified !== false);
  }

  const getStorageKey = () => {
    const user = getWishlistUser();
    return window.ppGetAccountStorageKey?.(KEY, user) ||
      (user?.uid && user.emailVerified !== false ? `${KEY}:user:${user.uid}` : '');
  };

  const load = () => {
    if (!isWishlistUnlocked()) return [];
    const key = getStorageKey();
    if (!key) return [];

    try {
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(data) ? data.filter(p => p && p.id) : [];
    } catch {
      return [];
    }
  };

  const save = (list) => {
    if (!isWishlistUnlocked()) return;
    const key = getStorageKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(Array.isArray(list) ? list : []));
  };

  const del = (id) => {
    save(load().filter(p => String(p.id) !== String(id)));
  };

  const grid = $('#gridWishlist');
  const empty = $('#wlEmpty');
  const count = $('#wlCount');
  const emptyTitle = empty?.querySelector('.wl-empty-title');
  const emptySub = empty?.querySelector('.wl-empty-sub');
  const emptyActions = empty?.querySelector('.wl-empty-actions');
  const emptyActionsDefault = emptyActions?.innerHTML || '';

  const selectionPanel = $('[data-wishlist-selection]');
  const recommendedPanel = $('[data-wishlist-recommended]');
  const recommendedText = $('[data-wishlist-recommended-text]');
  const recommendedLinks = $('[data-wishlist-recommended-links]');

  function escapeHtml(value = '') {
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
  }

  function getShopPreference() {
    const pref = localStorage.getItem(SHOP_PREF_KEY);
    return ['women', 'men', 'all'].includes(pref) ? pref : 'all';
  }

  function getRecommendedData() {
    const pref = getShopPreference();

   const data = {
  women: {
    text: 'Selección editorial orientada a piezas de mujer dentro del universo Prophetia.',
    links: [
      {
        label: 'Camisetas mujer',
        href: '/camisetas-punto-mujer',
        eyebrow: 'Essential pieces'
      },
      {
        label: 'Hoodies mujer',
        href: '/hoodies-mujer',
        eyebrow: 'Soft structure'
      },
      {
        label: 'Streetwear mujer',
        href: '/streetwear-mujer',
        eyebrow: 'Editorial movement'
      }
    ]
  },

  men: {
    text: 'Selección editorial orientada a piezas de hombre dentro del universo Prophetia.',
    links: [
      {
        label: 'Camisetas hombre',
        href: '/camisetas-punto-hombre',
        eyebrow: 'Core silhouettes'
      },
      {
        label: 'Hoodies hombre',
        href: '/hoodies',
        eyebrow: 'Volume & comfort'
      },
      {
        label: 'Streetwear hombre',
        href: '/streetwear-hombre',
        eyebrow: 'Urban archive'
      }
    ]
  },

  all: {
    text: 'Una selección abierta para descubrir Prophetia sin limitar tu exploración.',
    links: [
      {
        label: 'Mujer',
        href: '/camisetas-punto-mujer',
        eyebrow: 'Women selection'
      },
      {
        label: 'Hombre',
        href: '/camisetas-punto-hombre',
        eyebrow: 'Men selection'
      },
      {
        label: 'Colecciones',
        href: '/colecciones',
        eyebrow: 'Curated archive'
      }
    ]
  }
};

    return data[pref] || data.all;
  }

  function renderRecommended() {
    if (!recommendedLinks) return;

    const data = getRecommendedData();

    if (recommendedText) {
      recommendedText.textContent = data.text;
    }

    recommendedLinks.innerHTML = data.links.map((item) => `
      <a class="wl-reco-card" href="${escapeHtml(item.href)}">
        <span class="wl-reco-card__eyebrow">${escapeHtml(item.eyebrow)}</span>
        <strong>${escapeHtml(item.label)}</strong>
        <span class="wl-reco-card__arrow" aria-hidden="true">→</span>
      </a>
    `).join('');
  }

  function card(p) {
    const img = p.image || p.img || 'assets/img/placeholder.png';
    const title = p.title || 'Producto Prophetia';
    const price = (p.price !== undefined && p.price !== null && p.price !== '') ? p.price : '';
    const url = p.url || `/product.html?id=${encodeURIComponent(p.id)}`;

    return `
      <article class="product-card" data-id="${escapeHtml(p.id)}">
        <div class="img-wrap">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(title)}" loading="lazy">

          <button
            class="save-btn is-saved"
            type="button"
            aria-label="Quitar de guardados"
            data-remove
            data-id="${escapeHtml(p.id)}"
          >
            <svg class="icon-heart icon-heart--minimal" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 20.25s-7.35-4.72-8.2-9.82C3.32 7.55 5.22 5.35 7.86 5.35c1.72 0 3.12.9 4.14 2.28 1.02-1.38 2.42-2.28 4.14-2.28 2.64 0 4.54 2.2 4.06 5.08C19.35 15.53 12 20.25 12 20.25Z" />
            </svg>
          </button>
        </div>

        <div class="body">
          <h4>${escapeHtml(title)}</h4>

          ${price !== '' ? `<div class="price">${escapeHtml(price)} €</div>` : `<div class="price"></div>`}

          <div class="wishlist-card-actions">
            <a class="btn btn--sm" href="${escapeHtml(url)}">Ver producto</a>

            <button
              type="button"
              class="btn btn--sm btn--ghost"
              data-remove="true"
              data-id="${escapeHtml(p.id)}"
            >
              Quitar
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function updateHeaderBadge() {
    const savedBtn = document.getElementById('ppSavedBtn');
    if (!savedBtn) return;

    const total = load().length;
    savedBtn.dataset.count = String(total);
  }
  function notifyWishlistUpdated() {
  window.dispatchEvent(new CustomEvent('pp:wishlist-updated', {
    detail: {
      count: load().length
    }
  }));
}

  function renderEmptyState(isAuthenticated) {
    if (!empty) return;

    if (!isAuthenticated) {
      if (emptyTitle) emptyTitle.textContent = 'Inicia sesión para ver tu selección';
      if (emptySub) {
        emptySub.textContent = 'Tu wishlist solo se muestra cuando accedes con tu cuenta Prophetia.';
      }
      if (emptyActions) {
        emptyActions.innerHTML = `
          <button class="btn btn--ghost" type="button" data-wishlist-login>
            Iniciar sesión
          </button>
        `;
      }
      return;
    }

    if (emptyTitle) emptyTitle.textContent = 'Tu selección está vacía';
    if (emptySub) emptySub.textContent = 'Explora nuestras categorías y añade tus favoritos.';
    if (emptyActions) emptyActions.innerHTML = emptyActionsDefault;
  }

  function render() {
    const isAuthenticated = isWishlistUnlocked();
    const items = load();

    if (grid) {
      grid.innerHTML = isAuthenticated ? items.map(card).join('') : '';
    }

    renderEmptyState(isAuthenticated);

    if (empty) {
      empty.hidden = isAuthenticated && items.length > 0;
    }

    if (count) {
      count.textContent = String(items.length);
    }

    updateHeaderBadge();
    renderRecommended();
  }

  function setWishlistTab(target, { updateUrl = true } = {}) {
    const safeTarget = target === 'recommended' ? 'recommended' : 'selection';
    const tabs = $$('[data-wl-tab]');

    tabs.forEach((tab) => {
      const isActive = tab.dataset.wlTab === safeTarget;

      tab.classList.toggle('active', isActive);

      if (isActive) {
        tab.setAttribute('aria-current', 'page');
      } else {
        tab.removeAttribute('aria-current');
      }
    });

    if (selectionPanel) {
      selectionPanel.hidden = safeTarget !== 'selection';
    }

    if (recommendedPanel) {
      recommendedPanel.hidden = safeTarget !== 'recommended';
    }

    if (updateUrl) {
      try {
        history.replaceState(null, '', `#${safeTarget}`);
      } catch {}
    }
  }

  function bindWishlistTabs() {
    $$('[data-wl-tab]').forEach((tab) => {
      if (tab.__ppWishlistBound) return;
      tab.__ppWishlistBound = true;

      tab.addEventListener('click', (event) => {
        event.preventDefault();
        setWishlistTab(tab.dataset.wlTab);
      });
    });
  }

  function bindRemoveEvents() {
    if (!grid || grid.__ppWishlistRemoveBound) return;
    grid.__ppWishlistRemoveBound = true;

    grid.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-remove]');
      if (!btn) return;

      event.preventDefault();
      event.stopPropagation();

del(String(btn.dataset.id));
render();
notifyWishlistUpdated();
    });
  }

  function bindWishlistLoginAction() {
    if (!empty || empty.__ppWishlistLoginBound) return;
    empty.__ppWishlistLoginBound = true;

    empty.addEventListener('click', (event) => {
      const button = event.target.closest('[data-wishlist-login]');
      if (!button) return;

      event.preventDefault();
      document.getElementById('ppAuthLogoBtn')?.click();
    });
  }

  function initWishlist() {
    bindWishlistTabs();
    bindRemoveEvents();
    bindWishlistLoginAction();
    render();

    const initialHash = (window.location.hash || '').replace('#', '');
    setWishlistTab(initialHash === 'recommended' ? 'recommended' : 'selection', {
      updateUrl: initialHash === 'recommended'
    });
  }

  if (document.readyState !== 'loading') {
    initWishlist();
  } else {
    document.addEventListener('DOMContentLoaded', initWishlist);
  }

  window.addEventListener('partials:ready', () => {
    updateHeaderBadge();
    render();
  });

  window.addEventListener('pp:auth-ready', render);
  window.addEventListener('pp:auth-changed', render);
})();

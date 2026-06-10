/* =========================================================
   PROPHETIA · Wishlist
   Selección local + recomendaciones editoriales
   ========================================================= */

(function(){
  const KEY = 'pp_wishlist_v1';
const SHOP_PREF_KEY = 'pp_shop_preference';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const load = () => {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(data) ? data.filter(p => p && p.id) : [];
    } catch {
      return [];
    }
  };

  const save = (list) => {
    localStorage.setItem(KEY, JSON.stringify(Array.isArray(list) ? list : []));
  };

  const del = (id) => {
    save(load().filter(p => String(p.id) !== String(id)));
  };

  const grid = $('#gridWishlist');
  const empty = $('#wlEmpty');
  const count = $('#wlCount');

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
            <svg class="icon-heart" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12.1 20.1C11.8 20.1 4 14.7 3.2 9.6C2.8 6.8 4.9 4.5 7.5 4.5c1.7 0 3.2.9 4.1 2.3A5 5 0 0 1 19 4.5c2.6 0 4.7 2.3 4.3 5.1c-.8 5.1-8.6 10.5-9.1 10.5z"
                stroke="currentColor" stroke-width="1.5"/>
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

  function render() {
    const items = load();

    if (grid) {
      grid.innerHTML = items.map(card).join('');
    }

    if (empty) {
      empty.hidden = items.length > 0;
    }

    if (count) {
      count.textContent = String(items.length);
    }

    updateHeaderBadge();
    renderRecommended();
  }

  function setWishlistTab(target) {
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

    try {
      history.replaceState(null, '', `#${safeTarget}`);
    } catch {}
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

  function initWishlist() {
    bindWishlistTabs();
    bindRemoveEvents();
    render();

    const initialHash = (window.location.hash || '').replace('#', '');
    setWishlistTab(initialHash === 'recommended' ? 'recommended' : 'selection');
  }

  if (document.readyState !== 'loading') {
    initWishlist();
  } else {
    document.addEventListener('DOMContentLoaded', initWishlist);
  }

  window.addEventListener('partials:ready', updateHeaderBadge);
})();
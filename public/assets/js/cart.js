// assets/js/cart.js
(() => {
  const CART_KEY = 'pp_cart_v2';
  const body = document.body;
  if (!body) return;

 let listenersBound = false;

function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
  const money = (value = 0) => {
    try {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
      }).format(Number(value) || 0);
    } catch {
      return `${(Number(value) || 0).toFixed(2)} €`;
    }
  };

  function readCart() {
    try {
      const data = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(data) ? data.filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function writeCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(Array.isArray(items) ? items : []));
    window.dispatchEvent(new CustomEvent('pp:cart-updated'));
  }

function getCartNodes() {
  const drawer = document.getElementById('ppCartDrawer') || document.getElementById('cartDrawer');
  const overlay = document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay');
  const list = document.getElementById('ppCartList');
  const total = document.getElementById('ppCartTotal');

  return { drawer, overlay, list, total };
}

function moveCartNodesToBody() {
  const { drawer, overlay } = getCartNodes();

  if (overlay && overlay.parentElement !== document.body) {
    document.body.appendChild(overlay);
  }

  if (drawer && drawer.parentElement !== document.body) {
    document.body.appendChild(drawer);
  }
}

  function itemKey(item) {
    return [
      item.sku || item.id || '',
      item.version || '',
      item.color || '',
      item.size || ''
    ].map(String).join('__');
  }

  function getItemImage(item) {
    return item.img || item.image || item.cover || 'assets/img/placeholder.png';
  }

function renderCart() {
  const { drawer, list, total } = getCartNodes();
  if (!list || !total) return;

  const items = readCart();
  const emptyState = drawer?.querySelector('.pp-cart-empty');

  if (!items.length) {
    list.innerHTML = '';
    list.hidden = true;

    if (emptyState) {
      emptyState.hidden = false;
    } else {
      list.innerHTML = `
        <div class="cart-empty">
          <p class="cart-empty__text">Tu cesta está vacía</p>
        </div>
      `;
      list.hidden = false;
    }

    total.textContent = money(0);
    updateBadges();
    return;
  }

  if (emptyState) {
    emptyState.hidden = true;
  }

  list.hidden = false;

list.innerHTML = items.map((item) => {
  const qty = Math.max(1, Number(item.qty) || 1);
  const price = Number(item.price) || 0;
  const key = itemKey(item);
  const safeKey = escapeHtml(key);

  const title = escapeHtml(item.title || 'Producto Prophetia');
  const image = escapeHtml(getItemImage(item));
  const versionLabel = escapeHtml(item.versionLabel || '');
  const color = escapeHtml(item.color || '');
  const size = escapeHtml(item.size || '');

  return `
      <article class="cart-item" data-cart-key="${safeKey}">
        <div class="cart-item__media">
          <img src="${image}" alt="${title}" loading="lazy">
        </div>

        <div class="cart-item__body">
          <div class="cart-item__top">
            <h4 class="cart-item__title">${title}</h4>
            <button class="cart-item__remove" type="button" data-cart-remove="${safeKey}" aria-label="Quitar producto">×</button>
          </div>

          <p class="cart-item__meta">
          ${versionLabel ? `Versión: ${versionLabel}<br>` : ''}
${color ? `Color: ${color}<br>` : ''}
${size ? `Talla: ${size}` : ''}
          </p>

          <div class="cart-item__bottom">
            <div class="cart-qty" aria-label="Cantidad">
              <button type="button" data-cart-qty="${safeKey}" data-delta="-1">−</button>
              <span>${qty}</span>
              <button type="button" data-cart-qty="${safeKey}" data-delta="1">+</button>
            </div>

            <strong class="cart-item__price">${money(price * qty)}</strong>
          </div>
        </div>
      </article>
    `;
  }).join('');

 const sum = items.reduce((acc, item) => {
  const qty = Math.max(1, Number(item.qty) || 1);
  const price = Number(item.price) || 0;
  return acc + (price * qty);
}, 0);

  total.textContent = money(sum);
  updateBadges();
}

  function updateBadges() {
    const items = readCart();
    const totalQty = items.reduce((acc, item) => acc + (Number(item.qty) || 1), 0);

    document.querySelectorAll('[data-cart-count], #ppCartCount').forEach((el) => {
      el.textContent = String(totalQty);
      el.hidden = totalQty <= 0;
    });
  }

  function addToCart(product) {
    if (!product || !product.id) return;

    const items = readCart();

    const safeProduct = {
      qty: 1,
      ...product
    };

    const key = itemKey(safeProduct);
    const existing = items.find((item) => itemKey(item) === key);

    if (existing) {
      existing.qty = (Number(existing.qty) || 1) + (Number(safeProduct.qty) || 1);
    } else {
      items.push(safeProduct);
    }

    writeCart(items);
    renderCart();
    openCart();
  }

  function removeFromCart(key) {
    const next = readCart().filter((item) => itemKey(item) !== key);
    writeCart(next);
    renderCart();
  }

  function changeQty(key, delta) {
    const items = readCart();

    const item = items.find((entry) => itemKey(entry) === key);
    if (!item) return;

    item.qty = (Number(item.qty) || 1) + Number(delta || 0);

    const next = items.filter((entry) => (Number(entry.qty) || 1) > 0);

    writeCart(next);
    renderCart();
  }

function openCart() {
  const { drawer, overlay } = getCartNodes();
  if (!drawer || !overlay) {
    console.warn('[cart] Drawer u overlay no encontrados');
    return;
  }

  renderCart();

  drawer.classList.add('open', 'is-open');
  drawer.setAttribute('aria-hidden', 'false');

  overlay.classList.add('active', 'open', 'is-open');
  overlay.setAttribute('aria-hidden', 'false');

  const trigger = document.getElementById('ppCartBtn');
  if (trigger) trigger.setAttribute('aria-expanded', 'true');

  body.classList.add('no-scroll', 'pp-cart-open');
}

function closeCart() {
  const { drawer, overlay } = getCartNodes();
  if (!drawer || !overlay) return;

  drawer.classList.remove('open', 'is-open');
  drawer.setAttribute('aria-hidden', 'true');

  overlay.classList.remove('active', 'open', 'is-open');
  overlay.setAttribute('aria-hidden', 'true');

  const trigger = document.getElementById('ppCartBtn');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');

  body.classList.remove('no-scroll', 'pp-cart-open');
}

  function bindCart() {
    if (listenersBound) {
      renderCart();
      return;
    }

    listenersBound = true;

   moveCartNodesToBody();
closeCart();
renderCart();

    body.addEventListener('click', (e) => {
      const openTrigger = e.target.closest('#cartOpen, #cartopen, #ppCartBtn, .js-open-cart, [data-cart-open]');
      if (openTrigger) {
        e.preventDefault();
        e.stopPropagation();
        openCart();
        return;
      }

      const closeTrigger = e.target.closest('[data-close="cart"], .cart-close, .pp-cart-close');
      if (closeTrigger) {
        e.preventDefault();
        e.stopPropagation();
        closeCart();
        return;
      }

      const removeBtn = e.target.closest('[data-cart-remove]');
      if (removeBtn) {
        e.preventDefault();
        removeFromCart(removeBtn.dataset.cartRemove);
        return;
      }

      const qtyBtn = e.target.closest('[data-cart-qty]');
      if (qtyBtn) {
        e.preventDefault();
        changeQty(qtyBtn.dataset.cartQty, qtyBtn.dataset.delta);
        return;
      }

      const checkoutBtn = e.target.closest('.cart-checkout, [data-cart-checkout]');
      if (checkoutBtn) {
        e.preventDefault();
        window.location.assign('/checkout#nav-js-basket-checkoutnc');
        return;
      }

      const { overlay } = getCartNodes();
      if (overlay && e.target === overlay) {
        e.preventDefault();
        closeCart();
      }
    }, true);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        closeCart();
      }
    }, true);
  }

  document.addEventListener('DOMContentLoaded', bindCart);
  window.addEventListener('partials:ready', bindCart);
  window.addEventListener('pp:cart-updated', renderCart);

  window.ppAddToCart = addToCart;
  window.ppOpenCart = openCart;
  window.ppCloseCart = closeCart;
  window.ppCart = {
    read: readCart,
    write: writeCart,
    render: renderCart,
    updateBadges,
    add: addToCart,
    remove: removeFromCart,
    open: openCart,
    close: closeCart
  };
})();
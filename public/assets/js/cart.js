// assets/js/cart.js
(() => {
  const CART_KEY_PREFIX = "pp_cart_v3";
  const LEGACY_CART_KEY = "pp_cart_v2";

  const body = document.body;
  if (!body) return;

  let listenersBound = false;
  let cartAuthBound = false;

  let activeCartOwner = "guest";
  let cartScopeResolved = false;

  let previousCartQty = null;
  let badgeAnimationTimer = null;
  let cartReturnFocus = null;
  const mobileCartQuery = window.matchMedia('(max-width: 820px)');

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

function getCartOwner(user) {
  const uid = String(
    user?.uid || ""
  ).trim();

  /*
   * Un registro por email crea temporalmente una sesión
   * no verificada antes de enviar el correo y cerrarla.
   *
   * Esa sesión temporal no debe apropiarse todavía
   * de la cesta del invitado.
   */
  const canOwnPrivateCart =
    Boolean(uid) &&
    user?.emailVerified !== false;

  return canOwnPrivateCart
    ? `user:${uid}`
    : "guest";
}

function getCartStorageKey(
  owner = activeCartOwner
) {
  return `${CART_KEY_PREFIX}:${owner}`;
}

function getKnownAuthUser() {
  return (
    window.__ppAuthCurrentUser ||
    window.__ppLastUser ||
    null
  );
}

function parseStoredCart(rawValue) {
  try {
    const parsed = JSON.parse(
      rawValue || "[]"
    );

    return Array.isArray(parsed)
      ? parsed.filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function mergeCartItems(
  currentItems = [],
  incomingItems = []
) {
  const merged = currentItems.map(
    (item) => ({ ...item })
  );

  incomingItems.forEach((incoming) => {
    const incomingKey =
      itemKey(incoming);

    const existing = merged.find(
      (item) => {
        return itemKey(item) === incomingKey;
      }
    );

    if (existing) {
      existing.qty =
        Math.max(
          1,
          Number(existing.qty) || 1
        ) +
        Math.max(
          1,
          Number(incoming.qty) || 1
        );

      return;
    }

    merged.push({
      ...incoming,
      qty: Math.max(
        1,
        Number(incoming.qty) || 1
      )
    });
  });

  return merged;
}
function mergeGuestCartIntoUser(
  userOwner
) {
  const isUserOwner =
    String(userOwner || "")
      .startsWith("user:");

  if (!isUserOwner) {
    return false;
  }

  const guestStorageKey =
    getCartStorageKey("guest");

  const userStorageKey =
    getCartStorageKey(userOwner);

  const guestItems =
    parseStoredCart(
      localStorage.getItem(
        guestStorageKey
      )
    );

  /*
   * No escribimos ni eliminamos nada cuando
   * el visitante no tiene productos.
   */
  if (!guestItems.length) {
    return false;
  }

  const userItems =
    parseStoredCart(
      localStorage.getItem(
        userStorageKey
      )
    );

  const mergedItems =
    mergeCartItems(
      userItems,
      guestItems
    );

  localStorage.setItem(
    userStorageKey,
    JSON.stringify(mergedItems)
  );

  /*
   * Solo eliminamos la cesta invitada después
   * de haber guardado correctamente la fusionada.
   */
  localStorage.removeItem(
    guestStorageKey
  );

  return true;
}
/*
 * Migra una sola vez la antigua cesta global.
 * Se asigna al propietario real detectado:
 * invitado o usuario Firebase.
 */
function migrateLegacyCartToOwner(
  owner
) {
  const legacyRaw =
    localStorage.getItem(
      LEGACY_CART_KEY
    );

  if (!legacyRaw) {
    return;
  }

  const legacyItems =
    parseStoredCart(legacyRaw);

  const targetKey =
    getCartStorageKey(owner);

  const currentItems =
    parseStoredCart(
      localStorage.getItem(
        targetKey
      )
    );

  const mergedItems =
    mergeCartItems(
      currentItems,
      legacyItems
    );

  localStorage.setItem(
    targetKey,
    JSON.stringify(mergedItems)
  );

  localStorage.removeItem(
    LEGACY_CART_KEY
  );
}

function setCartOwner(user) {
  const previousOwner =
    activeCartOwner;

  const nextOwner =
    getCartOwner(user);

  const firstResolution =
    !cartScopeResolved;

  const ownerChanged =
    firstResolution ||
    nextOwner !== previousOwner;

  const isLogin =
    previousOwner === "guest" &&
    String(nextOwner)
      .startsWith("user:");

  const isLogout =
    cartScopeResolved &&
    String(previousOwner || "")
      .startsWith("user:") &&
    nextOwner === "guest";

  /*
   * Antes de activar el carrito privado copiamos
   * y fusionamos la cesta del visitante.
   *
   * Solo ocurre en la transición:
   * guest → user:UID verificado.
   */
  const guestCartMerged =
    isLogin
      ? mergeGuestCartIntoUser(
          nextOwner
        )
      : false;

  activeCartOwner =
    nextOwner;

  cartScopeResolved =
    true;

  /*
   * La antigua pp_cart_v2 era global y no puede
   * atribuirse con seguridad a una identidad.
   */
  if (firstResolution) {
    localStorage.removeItem(
      LEGACY_CART_KEY
    );
  }

  /*
   * Al cerrar sesión mostramos una cesta invitada
   * nueva. El carrito privado permanece guardado
   * bajo el UID del usuario.
   */
  if (isLogout) {
    localStorage.removeItem(
      getCartStorageKey("guest")
    );
  }

  if (ownerChanged) {
    previousCartQty = null;
    closeCart();
  }

  renderCart();

  window.dispatchEvent(
    new CustomEvent(
      "pp:cart-scope-changed",
      {
        detail: {
          previousOwner,
          owner: activeCartOwner,
          authenticated:
            activeCartOwner !== "guest",
          login: isLogin,
          logout: isLogout,
          guestCartMerged
        }
      }
    )
  );
}
function syncCartOwnerFromGlobals() {
  if (
    window.__ppAuthStateResolved !== true
  ) {
    return false;
  }

  setCartOwner(
    getKnownAuthUser()
  );

  return true;
}

async function bindCartAuthScope() {
  if (cartAuthBound) {
    return;
  }

  cartAuthBound = true;

  /*
   * Reacción inmediata a los eventos emitidos
   * por firebase-auth.js.
   */
  window.addEventListener(
    "pp:auth-changed",
    (event) => {
      setCartOwner(
        event.detail?.user || null
      );
    }
  );

  window.addEventListener(
    "pp:auth-ready",
    () => {
      syncCartOwnerFromGlobals();
    }
  );

  /*
   * Fuente de verdad adicional:
   * observa directamente Firebase Auth.
   */
  try {
    const [
      firebaseInit,
      firebaseAuth
    ] = await Promise.all([
      import(
        "/assets/js/firebase-init.js"
      ),
      import(
        "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"
      )
    ]);

    firebaseAuth.onAuthStateChanged(
      firebaseInit.auth,
      (user) => {
        setCartOwner(
          user || null
        );
      }
    );
  } catch (error) {
    console.warn(
      "[cart] No se pudo observar Firebase Auth directamente.",
      error
    );

    if (!syncCartOwnerFromGlobals()) {
      setCartOwner(null);
    }
  }
}

function readCart() {
  try {
    /*
     * Mientras Firebase todavía no ha resuelto la sesión,
     * evitamos mostrar por error la cesta del invitado.
     */
    if (
      !cartScopeResolved &&
      !syncCartOwnerFromGlobals()
    ) {
      return [];
    }

    const storageKey =
      getCartStorageKey();

    return parseStoredCart(
      localStorage.getItem(
        storageKey
      )
    );
  } catch {
    return [];
  }
}

function writeCart(items) {
  /*
   * Si alguien añade muy rápido antes de que Firebase
   * responda, se considera cesta invitada.
   */
  if (
    !cartScopeResolved &&
    !syncCartOwnerFromGlobals()
  ) {
    setCartOwner(null);
  }

  const storageKey =
    getCartStorageKey();

  const safeItems =
    Array.isArray(items)
      ? items
      : [];

  localStorage.setItem(
    storageKey,
    JSON.stringify(safeItems)
  );

  window.dispatchEvent(
    new CustomEvent(
      "pp:cart-updated",
      {
        detail: {
          owner: activeCartOwner
        }
      }
    )
  );
}
function getCartNodes() {
  const drawer = document.getElementById('ppCartDrawer') || document.getElementById('cartDrawer');
  const overlay = document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay');
  const list = document.getElementById('ppCartList');
  const total = document.getElementById('ppCartTotal');

  return { drawer, overlay, list, total };
}

function insertAfter(referenceNode, node) {
  const parent = referenceNode?.parentElement;

  if (!parent || !node) {
    return;
  }

  parent.insertBefore(node, referenceNode.nextSibling);
}

function ensureCartPackagingHook(drawer) {
  const body = drawer?.querySelector('.pp-cart-body');
  const list = drawer?.querySelector('#ppCartList');

  if (!body || !list) {
    return null;
  }

  const hooks = Array.from(
    drawer.querySelectorAll('[data-pp-cart-packaging]')
  );

  const hook = hooks.shift() || document.createElement('section');

  hooks.forEach((duplicate) => {
    duplicate.remove();
  });

  hook.className = 'pp-cart-packaging';
  hook.setAttribute('data-pp-cart-packaging', '');
  hook.setAttribute('aria-labelledby', 'ppCartPackagingTitle');
  hook.hidden = true;

  if (!hook.querySelector('img')) {
    hook.innerHTML = `
      <div class="pp-cart-packaging__copy">
        <h5 id="ppCartPackagingTitle">Packaging PROPHETIA</h5>
        <p>Tu pedido se prepara en el packaging oficial de PROPHETIA.</p>
      </div>
      <img
        class="pp-cart-packaging__image"
        src="/assets/img/pack/packaging.png"
        alt="Packaging oficial de PROPHETIA"
        loading="lazy"
        decoding="async"
      >
    `;

    const image = hook.querySelector('.pp-cart-packaging__image');

    image?.addEventListener('error', () => {
      image.hidden = true;
    }, { once: true });
  }

  if (hook.parentElement !== body || hook.previousElementSibling !== list) {
    insertAfter(list, hook);
  }

  return hook;
}

function ensureCartServiceLinks(drawer) {
  const body = drawer?.querySelector('.pp-cart-body');
  const list = drawer?.querySelector('#ppCartList');
  const packaging = drawer?.querySelector('[data-pp-cart-packaging]');

  if (!body || !list || !packaging) {
    return null;
  }

  const links = Array.from(
    drawer.querySelectorAll('[data-pp-cart-service-links]')
  );

  const services = links.shift() || document.createElement('nav');

  links.forEach((duplicate) => {
    duplicate.remove();
  });

  services.className = 'pp-cart-service-links';
  services.setAttribute('data-pp-cart-service-links', '');
  services.setAttribute('aria-label', 'Información de la cesta');

  if (!services.children.length) {
    services.innerHTML = `
      <a href="/shipping">
        <span>Plazo de entrega estimado</span>
        <span aria-hidden="true">›</span>
      </a>
      <a href="/devoluciones">
        <span>Envío y devoluciones</span>
        <span aria-hidden="true">›</span>
      </a>
      <a href="/contact">
        <span>Contacto</span>
        <span aria-hidden="true">›</span>
      </a>
    `;
  }

  services.hidden = true;

  if (services.parentElement !== body || services.previousElementSibling !== packaging) {
    insertAfter(packaging, services);
  }

  return services;
}

function normalizeCartStructure(drawer) {
  const body = drawer?.querySelector('.pp-cart-body');
  const footer = drawer?.querySelector('.cart-foot');

  if (!body) {
    return;
  }

  if (footer && footer.parentElement !== drawer) {
    drawer.appendChild(footer);
  }
}

function updateMobileCartUi(totalQty) {
  const visibleQuantity = totalQty > 99 ? '99+' : String(totalQty);
  const mobileTriggers = document.querySelectorAll(
    '[data-pp-mobile-cart], #ppCartBtn, [data-cart-open]'
  );

  mobileTriggers.forEach((trigger) => {
    trigger.setAttribute(
      'aria-label',
      totalQty === 0
        ? 'Abrir cesta, vacía'
        : totalQty === 1
          ? 'Abrir cesta, 1 artículo'
          : `Abrir cesta, ${totalQty} artículos`
    );

    if (trigger.matches('[data-pp-mobile-cart]')) {
      const count = trigger.querySelector('[data-pp-mobile-cart-count]');
      if (count) {
        count.textContent = visibleQuantity;
        count.hidden = totalQty <= 0;
      }
    }
  });

  const heading = document.querySelector(
    '#ppCartDrawer .pp-cart-header h4, #cartDrawer .pp-cart-header h4'
  );

  if (heading) {
    heading.textContent = `Cesta · ${visibleQuantity}`;
  }
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
      item.cut || '',
      item.version || '',
      item.color || '',
      item.size || ''
    ].map(String).join('__');
  }

  function getItemImage(item) {
    let image = String(item.img || item.image || item.cover || '').trim();

    if (/^assets\//i.test(image)) image = `/${image}`;

    // Compatibilidad con cestas guardadas antes de renovar las imágenes Atlas.
    if (/^\/assets\/img\/streetwear\/(?:Hombre|Mujer)\/atlas\/atlas[1-4](?:-mujer)?\.png$/i.test(image)) {
      image = '/assets/img/streetwear/Hombre/atlas/atlasfrontoversizebeige.png';
    }

    return image || '/assets/img/logo/emblem.svg';
  }

  function getItemProductUrl(item) {
    const rawUrl = String(
      item?.url ||
      item?.productUrl ||
      item?.href ||
      ''
    ).trim();

    const normalizedRawUrl = rawUrl.replace(/\/+$/, '').toLowerCase();

    if (
      rawUrl &&
      rawUrl !== '#' &&
      normalizedRawUrl !== 'producto' &&
      normalizedRawUrl !== '/producto' &&
      !normalizedRawUrl.startsWith('javascript:')
    ) {
      return rawUrl;
    }

    const id = String(
      item?.id ||
      item?.productId ||
      ''
    ).trim();

    if (!id) {
      return '';
    }

    const params = new URLSearchParams();
    params.set('id', id);

    const gender = String(
      item?.g ||
      item?.gender ||
      item?.genero ||
      ''
    ).trim();

    if (gender) {
      params.set('g', gender);
    }

    const cut = String(item?.cut || '').trim();
    const version = String(item?.version || '').trim();
    const color = String(item?.color || '').trim();

    if (cut) params.set('cut', cut);
    if (version) params.set('version', version);
    if (color) params.set('color', color);

    return `/producto?${params.toString()}`;
  }

function renderCart() {
  /*
   * El contador del header debe actualizarse siempre,
   * aunque popup.html todavía no haya inyectado el drawer.
   */
  updateBadges();

  const {
    drawer,
    list,
    total
  } = getCartNodes();

  const packaging = ensureCartPackagingHook(drawer);
  const services = ensureCartServiceLinks(drawer);

  normalizeCartStructure(drawer);

  if (!list || !total) {
    return;
  }

  const items = readCart();

  if (!items.length) {
    drawer?.querySelectorAll('.pp-cart-empty').forEach((node) => {
      if (!list.contains(node)) {
        node.remove();
      }
    });

    list.hidden = false;
    list.innerHTML = `
      <div class="cart-empty pp-cart-empty">
        <p class="cart-empty__text">Tu cesta está vacía</p>
        <p class="cart-empty__copy">Descubre las piezas disponibles de PROPHETIA.</p>
        <a class="cart-empty__link" href="/colecciones">Seguir explorando</a>
      </div>
    `;

    if (packaging) {
      packaging.hidden = true;
    }

    if (services) {
      services.hidden = true;
    }

    total.textContent = money(0);

    return;
  }

  if (packaging) {
    packaging.hidden = false;
  }

  if (services) {
    services.hidden = false;
  }

  list.hidden = false;

list.innerHTML = items.map((item) => {
  const qty = Math.max(1, Number(item.qty) || 1);
  const price = Number(item.price) || 0;
  const key = itemKey(item);
  const safeKey = escapeHtml(key);

  const title = escapeHtml(item.title || 'Producto Prophetia');
  const image = escapeHtml(getItemImage(item));
  const productUrl = getItemProductUrl(item);
  const safeProductUrl = escapeHtml(productUrl);
  const cutLabel = escapeHtml(item.cutLabel || item.cut || '');
  const versionLabel = escapeHtml(item.versionLabel || '');
  const color = escapeHtml(item.color || '');
  const size = escapeHtml(item.size || '');
  const productImage = productUrl
    ? `<a class="cart-item__media-link" href="${safeProductUrl}" aria-label="Ver ${title}"><img src="${image}" alt="${title}" loading="lazy" data-cart-image></a>`
    : `<img src="${image}" alt="${title}" loading="lazy" data-cart-image>`;

  return `
      <article class="cart-item" data-cart-key="${safeKey}">
        <div class="cart-item__media">
          ${productImage}
        </div>

        <div class="cart-item__body">
          <div class="cart-item__top">
            <h4 class="cart-item__title">${title}</h4>
            <button class="cart-item__remove" type="button" data-cart-remove="${safeKey}" aria-label="Quitar producto">×</button>
          </div>

          <p class="cart-item__meta">
          ${cutLabel ? `Corte: ${cutLabel}<br>` : ''}
          ${versionLabel ? `Versión: ${versionLabel}<br>` : ''}
${color ? `Color: ${color}<br>` : ''}
${size ? `Talla: ${size}` : ''}
          </p>

          <div class="cart-item__bottom">
            <div class="cart-qty" aria-label="Cantidad">
              <button type="button" data-cart-qty="${safeKey}" data-delta="-1" aria-label="Reducir cantidad de ${title}">−</button>
              <span aria-live="polite">${qty}</span>
              <button type="button" data-cart-qty="${safeKey}" data-delta="1" aria-label="Aumentar cantidad de ${title}">+</button>
            </div>

            <strong class="cart-item__price">${money(price * qty)}</strong>
          </div>
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-cart-image]').forEach((imageNode) => {
    imageNode.addEventListener('error', () => {
      imageNode.src = '/assets/img/logo/emblem.svg';
      imageNode.classList.add('is-fallback');
    }, { once: true });
  });

 const sum = items.reduce((acc, item) => {
  const qty = Math.max(1, Number(item.qty) || 1);
  const price = Number(item.price) || 0;
  return acc + (price * qty);
}, 0);

  total.textContent = money(sum);

}

function updateBadges() {
  const items = readCart();

  const totalQty = items.reduce((acc, item) => {
    return acc + Math.max(1, Number(item.qty) || 1);
  }, 0);

  const quantityIncreased =
    previousCartQty !== null &&
    totalQty > previousCartQty;

  const visibleQuantity =
    totalQty > 99
      ? '99+'
      : String(totalQty);

  document
    .querySelectorAll(
      '[data-cart-count], #ppCartCount'
    )
    .forEach((el) => {
      const valueNode = el.querySelector(
        '[data-cart-count-value]'
      );

      if (valueNode) {
        valueNode.textContent = visibleQuantity;
      } else {
        el.textContent = visibleQuantity;
      }

      el.hidden = totalQty <= 0;
      el.classList.toggle(
        'is-long',
        visibleQuantity.length > 2
      );
      el.setAttribute(
        'data-cart-quantity',
        String(totalQty)
      );
      el.setAttribute(
        'aria-label',
        totalQty === 1
          ? '1 artículo en la cesta'
          : `${totalQty} artículos en la cesta`
      );

      if (!quantityIncreased) {
        return;
      }

      el.classList.remove(
        'is-counting'
      );

      /*
       * Fuerza el reinicio de la animación
       * aunque se añadan artículos rápidamente.
       */
      void el.offsetWidth;

      el.classList.add(
        'is-counting'
      );
    });

  if (quantityIncreased) {
    window.clearTimeout(
      badgeAnimationTimer
    );

    badgeAnimationTimer =
      window.setTimeout(() => {
        document
          .querySelectorAll(
            '[data-cart-count], #ppCartCount'
          )
          .forEach((el) => {
            el.classList.remove(
              'is-counting'
            );
          });
      }, 420);
  }

const cartButton =
  document.getElementById(
    'ppCartBtn'
  );

if (cartButton) {
  cartButton.classList.toggle(
    'has-items',
    totalQty > 0
  );
  cartButton.setAttribute(
    'data-cart-total',
    String(totalQty)
  );

  cartButton.setAttribute(
    'aria-label',
    totalQty === 0
      ? 'Abrir cesta, vacía'
      : totalQty === 1
        ? 'Abrir cesta, 1 artículo'
        : `Abrir cesta, ${totalQty} artículos`
  );
}

  updateMobileCartUi(totalQty);
  previousCartQty = totalQty;
}

function addToCart(product, options = {}) {
  if (window.ppStorefront?.salesEnabled !== true) {
    window.ppShowPrelaunchNotice?.();
    return null;
  }

  if (!product || !product.id) {
    return null;
  }

  const items = readCart();

  const safeProduct = {
    qty: 1,
    ...product
  };

  const key = itemKey(safeProduct);

  const existing = items.find((item) => {
    return itemKey(item) === key;
  });

  if (existing) {
    existing.qty =
      (Number(existing.qty) || 1) +
      (Number(safeProduct.qty) || 1);
  } else {
    items.push(safeProduct);
  }

  writeCart(items);
  renderCart();

  /*
   * El comportamiento normal sigue abriendo la cesta.
   * Quick Add puede retrasarla hasta terminar la animación.
   */
  if (options.open !== false) {
    openCart();
  }

  return items.find((item) => {
    return itemKey(item) === key;
  }) || null;
}
  function clearCart(options = {}) {
    writeCart([]);
    renderCart();

    if (options.close === true) {
      closeCart();
    }
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

  function getCartItemByKey(key) {
    return readCart().find((item) => itemKey(item) === key) || null;
  }

  function showCartConfirm({
    title = 'Cesta',
    message = '¿Estás seguro de que deseas vaciar la cesta?',
    acceptText = 'Aceptar',
    cancelText = 'Cancelar',
    onAccept,
    onCancel
  } = {}) {
    const existing = document.getElementById('ppCartConfirm');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.id = 'ppCartConfirm';
    wrap.className = 'pp-cart-confirm';
    wrap.setAttribute('role', 'presentation');

    wrap.innerHTML = `
      <div class="pp-cart-confirm__backdrop" data-cart-confirm-cancel></div>
      <section class="pp-cart-confirm__dialog" role="dialog" aria-modal="true" aria-labelledby="ppCartConfirmTitle" aria-describedby="ppCartConfirmText" tabindex="-1">
        <button class="pp-cart-confirm__close" type="button" aria-label="Cerrar" data-cart-confirm-cancel>×</button>
        <p class="pp-cart-confirm__eyebrow">Prophetia</p>
        <h2 id="ppCartConfirmTitle">${escapeHtml(title)}</h2>
        <p id="ppCartConfirmText">${escapeHtml(message)}</p>
        <div class="pp-cart-confirm__actions">
          <button class="pp-cart-confirm__accept" type="button">${escapeHtml(acceptText)}</button>
          <button class="pp-cart-confirm__cancel" type="button" data-cart-confirm-cancel>${escapeHtml(cancelText)}</button>
        </div>
      </section>
    `;

    document.body.appendChild(wrap);

    const dialog = wrap.querySelector('.pp-cart-confirm__dialog');
    const acceptBtn = wrap.querySelector('.pp-cart-confirm__accept');
    const cancelNodes = wrap.querySelectorAll('[data-cart-confirm-cancel]');
    const previousActive = document.activeElement;

    const cleanup = () => {
      document.removeEventListener('keydown', onKey, true);
      wrap.classList.remove('is-visible');

      window.setTimeout(() => {
        wrap.remove();
        previousActive?.focus?.({ preventScroll: true });
      }, 180);
    };

    const cancel = () => {
      try { onCancel?.(); }
      finally { cleanup(); }
    };

    const accept = () => {
      try { onAccept?.(); }
      finally { cleanup(); }
    };

    const onKey = (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        cancel();
        return;
      }

      if (event.key !== 'Tab' || !mobileCartQuery.matches) return;
      const focusable = Array.from(dialog?.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || []).filter((node) => !node.closest('[hidden]'));
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    acceptBtn?.addEventListener('click', accept);
    cancelNodes.forEach((node) => node.addEventListener('click', cancel));
    document.addEventListener('keydown', onKey, true);

    requestAnimationFrame(() => {
      wrap.classList.add('is-visible');
      dialog?.focus?.({ preventScroll: true });
      acceptBtn?.focus?.({ preventScroll: true });
    });
  }

  function confirmCartItemRemoval(key, action = 'remove') {
    const items = readCart();
    const item = items.find((entry) => itemKey(entry) === key);
    if (!item) return;

    const willEmptyCart = items.length <= 1;

    showCartConfirm({
      title: 'Cesta',
      message: willEmptyCart
        ? '¿Estás seguro de que deseas vaciar la cesta?'
        : '¿Estás seguro de que deseas quitar este producto de tu cesta?',
      acceptText: willEmptyCart ? 'Vaciar cesta' : 'Quitar producto',
      cancelText: 'Cancelar',
      onAccept: () => {
        if (willEmptyCart) {
          clearCart();
          return;
        }

        if (action === 'decrement') {
          changeQty(key, -1);
          return;
        }

        removeFromCart(key);
      }
    });
  }

  function handleCartQtyClick(key, delta) {
    const item = getCartItemByKey(key);
    const qty = Math.max(1, Number(item?.qty) || 1);
    const numericDelta = Number(delta || 0);

    if (numericDelta < 0 && qty <= 1) {
      confirmCartItemRemoval(key, 'decrement');
      return;
    }

    changeQty(key, numericDelta);
  }

function openCart(returnFocusTarget = null) {
  const { drawer, overlay } = getCartNodes();
  if (!drawer || !overlay) {
    console.warn('[cart] Drawer u overlay no encontrados');
    return;
  }

  renderCart();

  if (mobileCartQuery.matches &&
      !drawer.classList.contains('open') && !drawer.classList.contains('is-open')) {
    cartReturnFocus = returnFocusTarget instanceof HTMLElement
      ? returnFocusTarget
      : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  }

  drawer.classList.add('open', 'is-open');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  if (!drawer.hasAttribute('aria-label') && !drawer.hasAttribute('aria-labelledby')) {
    drawer.setAttribute('aria-label', 'Cesta de compra');
  }
  drawer.setAttribute('aria-hidden', 'false');

  overlay.classList.add('active', 'open', 'is-open');
  overlay.setAttribute('aria-hidden', 'false');

  document
    .querySelectorAll('#ppCartBtn, [data-pp-mobile-cart], [data-cart-open]')
    .forEach((trigger) => {
      trigger.setAttribute('aria-expanded', 'true');
    });

  body.classList.add('no-scroll', 'pp-cart-open');

  if (mobileCartQuery.matches) {
    const focusDrawer = () => {
      if (!drawer.classList.contains('open') && !drawer.classList.contains('is-open')) return;
      const focusTarget = drawer.querySelector(
        '[data-close="cart"], .cart-close, .pp-cart-close, button, a[href]'
      );
      focusTarget?.focus?.({ preventScroll: true });
    };
    focusDrawer();
    window.requestAnimationFrame(() => {
      if (!drawer.contains(document.activeElement)) focusDrawer();
    });
    window.setTimeout(() => {
      if (!drawer.contains(document.activeElement)) focusDrawer();
    }, 80);
  }
}

function closeCart() {
  const { drawer, overlay } = getCartNodes();
  if (!drawer || !overlay) return;

  const wasOpen = drawer.classList.contains('open') || drawer.classList.contains('is-open');

  drawer.classList.remove('open', 'is-open');
  drawer.setAttribute('aria-hidden', 'true');

  overlay.classList.remove('active', 'open', 'is-open');
  overlay.setAttribute('aria-hidden', 'true');

  document
    .querySelectorAll('#ppCartBtn, [data-pp-mobile-cart], [data-cart-open]')
    .forEach((trigger) => {
      trigger.setAttribute('aria-expanded', 'false');
    });

  body.classList.remove('no-scroll', 'pp-cart-open');

  if (wasOpen && cartReturnFocus?.isConnected) {
    cartReturnFocus.focus?.({ preventScroll: true });
  }
  cartReturnFocus = null;
}

  function bindCart() {
    if (listenersBound) {
      renderCart();
      return;
    }

    listenersBound = true;

   moveCartNodesToBody();
   normalizeCartStructure(getCartNodes().drawer);
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
        confirmCartItemRemoval(removeBtn.dataset.cartRemove);
        return;
      }

      const qtyBtn = e.target.closest('[data-cart-qty]');
      if (qtyBtn) {
        e.preventDefault();
        handleCartQtyClick(qtyBtn.dataset.cartQty, qtyBtn.dataset.delta);
        return;
      }

      const checkoutBtn = e.target.closest('.cart-checkout, [data-cart-checkout]');
      if (checkoutBtn) {
        e.preventDefault();
        if (window.ppStorefront?.salesEnabled !== true) {
          window.ppShowPrelaunchNotice?.();
          return;
        }
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
      const { drawer } = getCartNodes();
      const isOpen = Boolean(
        drawer?.classList.contains('open') || drawer?.classList.contains('is-open')
      );
      if (!isOpen) return;

      if (e.key === 'Escape' || e.key === 'Esc') {
        if (mobileCartQuery.matches) e.preventDefault();
        closeCart();
        return;
      }

      if (e.key !== 'Tab' || !mobileCartQuery.matches) return;
      const focusable = Array.from(drawer.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((node) => !node.closest('[hidden]') && node.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!drawer.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }, true);
  }

function initCart() {
  bindCart();
  bindCartAuthScope();
}

if (
  document.readyState === "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initCart,
    {
      once: true
    }
  );
} else {
  initCart();
}

window.addEventListener(
  "partials:ready",
  bindCart
);

window.addEventListener(
  "pp:cart-updated",
  renderCart
);

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
  clear: clearCart,
  open: openCart,
  close: closeCart,

  getOwner: () => {
    return activeCartOwner;
  },

  getStorageKey: () => {
    return getCartStorageKey();
  },

  isScopeResolved: () => {
    return cartScopeResolved;
  }
};
})();

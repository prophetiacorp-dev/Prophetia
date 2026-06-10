(() => {
  'use strict';

  const CART_KEY = 'pp_cart_v2';
  const LS_EMAIL = 'pp_checkout_email';
  const LS_SHIP_MODE = 'pp_checkout_shipping'; // 'home' | 'store'
  const LS_SHIP_DETAILS = 'pp_checkout_shipping_details';
    const LS_GIFT_ON = 'pp_checkout_isGift';
  const LS_INVOICE_ON = 'pp_checkout_invoiceWanted';
  const LS_STEP = 'pp_checkout_step'; // 'nav-js-...'

const PP_CHECKOUT_SESSION_ENDPOINT = '/api/create-checkout-session';
const PP_CART_SUMMARY_ENDPOINT = '/api/cart-summary';
const PP_DISCOUNT_VALIDATE_ENDPOINT = '/api/discount/validate';

const LS_ORDER_DRAFT_ID = 'pp_checkout_order_draft_id';

const LS_TRIBE_CODE = 'pp_checkout_tribe_code';

let ppSecureCartSummary = null;
  // Función para formatear el dinero
  const money = (n = 0) => {
    try { 
      return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n); 
    }
    catch { 
      return `${(+n).toFixed(2)} €`; 
    }
  };

  // Cargar y guardar carrito en localStorage
  const loadCart = () => {
    try { 
      return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); 
    }
    catch { 
      return []; 
    }
  };

const saveCart = (cart) => {
  ppSecureCartSummary = null;
  localStorage.setItem(CART_KEY, JSON.stringify(cart || []));
};
const sum = () => {
  if (ppSecureCartSummary && Number.isFinite(Number(ppSecureCartSummary.subtotal))) {
    return Number(ppSecureCartSummary.subtotal);
  }

  return 0;
};

  // Selección de elementos del DOM
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---- RIGHT RAIL visibility (Prophetia behavior) ----
  // En Prophetia NO desaparece toda la columna derecha: solo el "mini-cart" superior.
  const rightMiniCart = document.querySelector('.checkoutnc-minibasket-top-content');

  function getActiveTabId() {
    const active = document.querySelector('#nav-tab .nav-link.active');
    return active ? active.id : '';
  }

  function isBasketStep(tabId) {
    return tabId === 'nav-js-basket-checkoutnc-tab';
  }

 function syncRightRailVisibility() {
  if (!rightMiniCart) return;

  const tabId = getActiveTabId();
  const hideMiniCart = isBasketStep(tabId);

  // 1) Oculta/enseña el mini-cart superior
  rightMiniCart.classList.toggle('d-none', hideMiniCart);
  rightMiniCart.setAttribute('aria-hidden', hideMiniCart ? 'true' : 'false');

  // 2) Quita el hueco del rail cuando el minicart está oculto (padding-top inline)
  const bottom = document.querySelector('.checkoutnc-minibasket-bottom-content');
  if (bottom) {
    // guarda el padding original 1 vez
    if (!bottom.dataset.ppPadTopSaved) {
      bottom.dataset.ppPadTopSaved = '1';
      bottom.dataset.ppPadTop = bottom.style.paddingTop || '';
    }
    bottom.style.paddingTop = hideMiniCart ? '0px' : (bottom.dataset.ppPadTop || '');
  }
}





  // Obtener elementos
  const els = () => ({
    // Cart
    list: $('#ckCartList'),
    subtotal: $('#ckSubtotal'),
    total: $('#ckTotal'),
    sideSubtotal: $('#ckSidebarSubtotal'),
    sideTotal: $('#ckSidebarTotal'),
sideList: $('#ckSidebarCartList'),
sideShipping: $('#ckSidebarShipping'),

    // Call to actions
    basketCTA: $('#ckContinueFromBasket'),
    sideCTA: $('#ckSidebarFinalize'),
    back: $('#goBack'),
    logoutBtn: $('#ckLogout'),

    // Forms
    detailsForm: $('#ckDetailsForm'),
    shippingForm: $('#ckShippingForm'),
    emailInput: $('#ckEmail'),

    // UI Auth
detailsSummary: $('#ckDetailsSummary'),
shippingLoginSummary: $('#ckShippingLoginSummary'),
    // Paso 3 (intro que NO debe verse cuando hay resumen)
    shipPane: $('#nav-js-shipping-checkoutnc'),
    shipIntroTitle: document.querySelector('#nav-js-shipping-checkoutnc .ck-box > h3.ck-h'),


    // Shipping mode + panels
    shippingRadios: $$('input[name="shipping"]'),
    shipToMe: $('#js-shipToMe-checkoutnc'),
    shipToStore: $('#js-shipToStore-checkoutnc'),
    shipSummaryContainer: $('#js-shipping-summary-container'),
    // Gift + Invoice (Prophetia-like)
    giftToggle: $('#ppIsGift'),
    giftPanel: $('#ppGiftMessage'),
    invoiceToggle: $('#ppInvoiceWanted'),
    invoicePanel: $('#ppInvoicePanel'),
    // Billing different
    billingToggle: $('#ppBillingDifferent'),
    billingPanel: $('#ppBillingPanel'),

     // Tabs
    tabs: $$('#nav-tab .nav-link'),
    panes: $$('#nav-tabContent .tab-pane'),
    tabBasket: $('#nav-js-basket-checkoutnc-tab'),
    tabDetails: $('#nav-js-details-checkoutnc-tab'),
    tabShipping: $('#nav-js-shipping-checkoutnc-tab'),
    tabPayment: $('#nav-js-payment-checkoutnc-tab'),
  });

  // Función para escapar caracteres HTML
  function escapeHtml(s = '') {
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  // ========= Validación UI (sin alerts) =========
  function clearFieldError(el) {
    if (!el) return;
    el.classList.remove('pp-invalid');
    el.setAttribute('aria-invalid', 'false');
    const msg = el._ppErrEl;
    if (msg && msg.parentNode) msg.parentNode.removeChild(msg);
    el._ppErrEl = null;
  }

  function setFieldError(el, message = 'Campo obligatorio') {
    if (!el) return;
    el.classList.add('pp-invalid');
    el.setAttribute('aria-invalid', 'true');

    // evita duplicar
    if (el._ppErrEl && el._ppErrEl.parentNode) return;

    const m = document.createElement('div');
    m.className = 'pp-fieldError';
    m.textContent = message;

    // Inserta justo después del input/select/textarea
    el.insertAdjacentElement('afterend', m);
    el._ppErrEl = m;

    // Limpia al escribir/cambiar
    const onFix = () => {
      const v = (el.value ?? '').toString().trim();
      if (v) clearFieldError(el);
    };
    el.addEventListener('input', onFix, { once: true });
    el.addEventListener('change', onFix, { once: true });
  }

  // valida required visibles y habilitados dentro de un contenedor
  function validateRequired(container) {
    if (!container) return { ok: true, first: null };

    const isHidden = (node) =>
      !node ||
      !!node.closest('.d-none') ||
      node.closest('[aria-hidden="true"]') ||
      node.offsetParent === null;

    const required = Array.from(container.querySelectorAll('[required]'))
      .filter(el => !el.disabled && !isHidden(el));

    let firstBad = null;

    required.forEach(el => {
      const v = (el.value ?? '').toString().trim();
      if (!v) {
        setFieldError(el, 'Completa este campo');
        if (!firstBad) firstBad = el;
      } else {
        clearFieldError(el);
      }
    });

    if (firstBad) {
      firstBad.focus?.();
      return { ok: false, first: firstBad };
    }
    return { ok: true, first: null };
  }

function ppConfirmEmptyBasket({
  title = 'Cesta',
  message = '¿Estás seguro de que deseas continuar?',
  acceptText = 'ACEPTAR',
  cancelText = 'Cancelar',
  onAccept,
  onCancel
} = {}) {
  // Evita duplicados
  const existing = document.getElementById('ppCartConfirmModal');
  if (existing) existing.remove();

  const wrap = document.createElement('div');
  wrap.id = 'ppCartConfirmModal';

  wrap.innerHTML = `
    <div class="capds-dim-layer js-dim-layer" style="position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:9998;"></div>
    <div id="capds-js-modal" style="position:fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index:9999;">
      <div class="capds-modal__container" style="background:#fff; width:min(804px, calc(100% - 48px)); border-radius:0; overflow:hidden;">
        <div class="capds-modal__header" style="padding:18px 18px 10px;">
          <h2 style="margin:0; font-size:20px; font-weight:600;">
            ${escapeHtml(title)}
            <a href="#" class="capds-icon--xxs float-right capds-close__button" aria-label="Cerrar" style="float:right; text-decoration:none; font-size:20px; line-height:1;">×</a>
          </h2>
        </div>
        <div class="capds-modal__body" style="padding:0 18px 14px;">
          <p style="margin:0;">${escapeHtml(message)}</p>
        </div>
        <div class="capds-modal__footer" style="padding:14px 18px 18px;">
          <div class="row" style="display:grid; gap:10px;">
            <button class="capds-btn capds-modal-submit__button" type="button"
              style="padding:12px 14px; border:0; background:#111; color:#fff; cursor:pointer;">
              ${escapeHtml(acceptText)}
            </button>
            <button class="capds-btn--secondary" type="button"
              style="padding:12px 14px; border:1px solid #111; background:#fff; color:#111; cursor:pointer;">
              ${escapeHtml(cancelText)}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  const close = () => wrap.remove();

  const dim = wrap.querySelector('.js-dim-layer');
  const closeBtn = wrap.querySelector('.capds-close__button');
  const acceptBtn = wrap.querySelector('.capds-modal-submit__button');
  const cancelBtn = wrap.querySelector('.capds-btn--secondary');

const cleanup = () => {
  document.removeEventListener('keydown', onKey);
  close();
};

const doCancel = () => {
  try { onCancel?.(); }
  finally { cleanup(); }
};

const doAccept = () => {
  try { onAccept?.(); }
  finally { cleanup(); }
};


  dim?.addEventListener('click', doCancel);
  closeBtn?.addEventListener('click', (e) => { e.preventDefault(); doCancel(); });
  cancelBtn?.addEventListener('click', doCancel);
  acceptBtn?.addEventListener('click', doAccept);

  const onKey = (e) => {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', onKey);
      doCancel();
    }
  };
  document.addEventListener('keydown', onKey);
}



  // Habilitar/Deshabilitar tabs
  function enableTab(tabEl, enabled) {
    if (!tabEl) return;
    tabEl.classList.toggle('disabled', !enabled);  // Agrega o quita la clase 'disabled'
    tabEl.setAttribute('aria-disabled', enabled ? 'false' : 'true');  // Actualiza la accesibilidad
    if (!enabled) tabEl.setAttribute('tabindex', '-1');  // Desactiva el tabIndex
    else tabEl.removeAttribute('tabindex');  // Habilita el tabIndex
  }

  function enableTabs() {
    console.log('Habilitando pestañas...');

    const E = els();
    const hasEmail = !!localStorage.getItem(LS_EMAIL);
    const hasShip  = !!localStorage.getItem(LS_SHIP_DETAILS);

    // Details: siempre accesible (si hay checkout abierto)
    enableTab(E.tabDetails, loadCart().length > 0);


    // Shipping: solo si hay login/email
    enableTab(E.tabShipping, hasEmail);

    // Payment: solo si ya hay shipping guardado
    enableTab(E.tabPayment, hasShip);
  }


  // Mostrar u ocultar elementos
  function setDisplay(el, show) {
    if (!el) return;
    el.classList.toggle('d-none', !show);
    el.classList.toggle('d-block', show);
    el.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  // Deshabilitar los inputs dentro de un elemento
  function setDisabledInside(el, disabled) {
    if (!el) return;
    el.querySelectorAll('input, select, textarea, button').forEach(x => { x.disabled = !!disabled; });
  }
function hideShippingSummaryAndShowForm() {
  const E = els();

  if (E.shipSummaryContainer) {
    E.shipSummaryContainer.classList.add('d-none');
    E.shipSummaryContainer.classList.remove('d-block');
    E.shipSummaryContainer.setAttribute('aria-hidden', 'true');
    E.shipSummaryContainer.innerHTML = '';
  }

  if (E.shippingForm) {
    E.shippingForm.classList.remove('d-none');
    E.shippingForm.setAttribute('aria-hidden', 'false');
  }
    // Restaura “intro” del paso 3 (título + login summary)
  if (E.shipIntroTitle) E.shipIntroTitle.classList.remove('d-none');
  if (E.shippingLoginSummary) E.shippingLoginSummary.classList.remove('d-none');

}
  function applyGiftToggleUI(checked) {
    const E = els();
    const on = !!checked;

    if (E.giftToggle) E.giftToggle.checked = on;

    setDisplay(E.giftPanel, on);
    setDisabledInside(E.giftPanel, !on);

    localStorage.setItem(LS_GIFT_ON, on ? '1' : '0');
  }

  function applyInvoiceToggleUI(checked) {
    const E = els();
    const on = !!checked;

    if (E.invoiceToggle) E.invoiceToggle.checked = on;

    setDisplay(E.invoicePanel, on);
    setDisabledInside(E.invoicePanel, !on);

    localStorage.setItem(LS_INVOICE_ON, on ? '1' : '0');
  }

function setHomeOnlyExtrasVisible(show) {
  const E = els();
  const on = !!show;

  // 👇 pillamos los contenedores “visuales” (no solo el input)
  const billingRow =
    E.billingToggle?.closest('.pp-checkRow') ||
    E.billingToggle?.closest('.capds-span2') ||
    E.billingToggle?.closest('div');

  const giftRow =
    E.giftToggle?.closest('.capds-span2') ||
    E.giftToggle?.closest('.pp-checkRow') ||
    E.giftToggle?.closest('div');

  const invoiceRow =
    E.invoiceToggle?.closest('.capds-span2') ||
    E.invoiceToggle?.closest('.pp-checkRow') ||
    E.invoiceToggle?.closest('div');

  [billingRow, giftRow, invoiceRow].filter(Boolean).forEach((row) => {
    row.classList.toggle('d-none', !on);
    row.setAttribute('aria-hidden', on ? 'false' : 'true');
    setDisabledInside(row, !on);
  });
}

  // Aplicar modo de envío
function applyShippingMode(mode) {
  const E = els();
  const m = (mode === 'home' || mode === 'store') ? mode : '';

  if (!m) {
    setDisplay(E.shipToMe, false);
    setDisplay(E.shipToStore, false);
    setDisabledInside(E.shipToMe, true);
    setDisabledInside(E.shipToStore, true);

    // ✅ extras OFF hasta elegir "home"
    setHomeOnlyExtrasVisible(false);

    localStorage.removeItem(LS_SHIP_MODE);
    return;
  }

  const showHome = m === 'home';

  setDisplay(E.shipToMe, showHome);
  setDisplay(E.shipToStore, !showHome);

  setDisabledInside(E.shipToMe, !showHome);
  setDisabledInside(E.shipToStore, showHome);

  // ✅ SOLO visibles en entrega a domicilio
  setHomeOnlyExtrasVisible(showHome);
if (showHome) {
  ppInitAddressAutocomplete().catch(err => console.warn('[places] init failed', err));
}

  if (!showHome) {
    applyGiftToggleUI(false);
    applyInvoiceToggleUI(false);

    if (E.billingToggle) E.billingToggle.checked = false;
    setDisplay(E.billingPanel, false);
    setDisabledInside(E.billingPanel, true);

    try {
      localStorage.removeItem(LS_GIFT_ON);
      localStorage.removeItem(LS_INVOICE_ON);
    } catch {}
  }

  localStorage.setItem(LS_SHIP_MODE, m);
}

  // Cambiar de tab + persistencia (hash + localStorage)
  function setTab(idToShow, { persist = true, scroll = true } = {}) {
    const E = els();
    const targetPane = document.getElementById(idToShow);
    const safeId = (window.CSS && CSS.escape) ? CSS.escape(idToShow) : idToShow;
    const targetTab = document.querySelector(`#nav-tab a[href="#${safeId}"]`);
    if (!targetPane || !targetTab) return;

    // Bloquea si el tab está disabled (extra seguridad)
    if (targetTab.classList.contains('disabled') || targetTab.getAttribute('aria-disabled') === 'true') {
      return;
    }

    E.tabs.forEach(a => {
      const active = a === targetTab;
      a.classList.toggle('active', active);
      a.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    E.panes.forEach(p => {
      const active = p === targetPane;
      p.classList.toggle('show', active);
      p.classList.toggle('active', active);
    });
// Si entro a Envío y NO hay ship_details, aseguro que el form esté visible
if (idToShow === 'nav-js-shipping-checkoutnc') {
  const hasShip = !!localStorage.getItem(LS_SHIP_DETAILS);

  if (!hasShip) {
    // ✅ al entrar al paso 3 “en limpio”: nada preseleccionado
    try { localStorage.removeItem(LS_SHIP_MODE); } catch {}

    const E2 = els();
    E2.shippingRadios?.forEach(r => (r.checked = false));

      applyShippingMode(''); // oculta panels + extras
    hideShippingSummaryAndShowForm();
  }
}


    // Persistir step
    if (persist) {
      try { localStorage.setItem(LS_STEP, idToShow); } catch {}
      // hash “silencioso” (sin salto brusco)
      try { history.replaceState(null, '', `#${idToShow}`); } catch { window.location.hash = idToShow; }
    }

    syncRightRailVisibility();
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Resuelve el tab inicial: hash > LS_STEP > último válido por estado
  function resolveInitialTabId() {
    const hash = (window.location.hash || '').slice(1);
    const saved = (() => { try { return localStorage.getItem(LS_STEP) || ''; } catch { return ''; } })();

    const hasEmail = !!localStorage.getItem(LS_EMAIL);
    const hasShip  = !!localStorage.getItem(LS_SHIP_DETAILS);

    // último válido
    const lastValid =
  hasShip  ? 'nav-js-payment-checkoutnc' :
  hasEmail ? 'nav-js-shipping-checkoutnc' :
             'nav-js-basket-checkoutnc';


    // Si aún no hay progreso (sin email y sin ship), NO respetamos saved step.
// Así siempre se ve la cesta primero.
const candidate = hash || ((hasEmail || hasShip) ? saved : '') || lastValid;


    // Si el candidato NO es alcanzable, cae al último válido
    const E = els();
    const safeId = (window.CSS && CSS.escape) ? CSS.escape(candidate) : candidate;
    const tab = document.querySelector(`#nav-tab a[href="#${safeId}"]`);

    if (!tab) return lastValid;
    if (tab.classList.contains('disabled') || tab.getAttribute('aria-disabled') === 'true') return lastValid;

    return candidate;
  }


  // Renderizar el carrito
 async function renderCart() {
  const E = els();
  if (!E.list) return;

  let summary;

  try {
    summary = await fetchSecureCartSummary();
  } catch (error) {
    console.error('[checkout] resumen seguro falló:', error);

    E.list.innerHTML = `
      <p class="ck-muted">
        No se ha podido validar tu cesta. Recarga la página o vuelve a añadir el producto.
      </p>
    `;

    if (E.sideList) {
      E.sideList.innerHTML = `
        <p class="ck-muted">
          Cesta no validada.
        </p>
      `;
    }

    const t0 = money(0);
    if (E.subtotal) E.subtotal.textContent = t0;
    if (E.total) E.total.textContent = t0;
    if (E.sideSubtotal) E.sideSubtotal.textContent = t0;
    if (E.sideTotal) E.sideTotal.textContent = t0;

    enablePayment(false);
    return;
  }

  const items = Array.isArray(summary.items) ? summary.items : [];

  if (!items.length) {
    E.list.innerHTML = `<p class="ck-muted">Tu cesta está vacía.</p>`;

    if (E.sideList) {
      E.sideList.innerHTML = `<p class="ck-muted">Tu cesta está vacía.</p>`;
    }

    const t0 = money(0);
    if (E.subtotal) E.subtotal.textContent = t0;
    if (E.total) E.total.textContent = t0;
    if (E.sideSubtotal) E.sideSubtotal.textContent = t0;
    if (E.sideTotal) E.sideTotal.textContent = t0;

    enablePayment(false);
    return;
  }

  const itemTemplate = (it, i) => {
    const qty = +it.qty || 1;
    const price = +it.unitPrice || 0;
    const img = it.img || 'assets/img/placeholder.png';
    const title = it.title || 'Producto Prophetia';

    const color = it.color ? `Color: ${it.color}` : '';
    const size = it.size ? `Talla: ${it.size}` : '';

    return `
      <div class="capds-minicartnc__item__container" data-i="${i}">
        <div class="capds-minicartnc__item">
          <div class="capds-minicartnc__image">
            <a href="${it.url || '#'}" aria-label="${escapeHtml(title)}">
              <img src="${img}" alt="" class="capds-picture">
            </a>
          </div>

          <div class="capds-minicartnc__info">
            <div class="capds-minicartnc__top">
              <div class="capds-minicartnc__details">
                <div>
                  <a href="${it.url || '#'}">
                    <p class="capds-body-medium caps-minicartnc__item--name">${escapeHtml(title)}</p>
                  </a>
                  ${color ? `<p class="capds-sm-label caps-minicartnc__item--attr">${escapeHtml(color)}</p>` : ''}
                  ${size ? `<p class="capds-sm-label caps-minicartnc__item--attr">${escapeHtml(size)}</p>` : ''}
                </div>
              </div>

              <div class="capds-minicartnc__price">
                <p class="capds-minicartnc__price--active">${money(price * qty)}</p>
              </div>
            </div>

            <div class="capds-minicartnc__bottom d-flex justify-content-between align-items-center">
              <div class="custom-input-number cartnc-qty">
                <button class="cin-decrement" type="button" aria-label="Decrease quantity" data-op="-">-</button>
                <input type="number" value="${qty}" readonly>
                <button class="cin-increment" type="button" aria-label="Increase quantity" data-op="+">+</button>
              </div>

              <button class="capds-link-label--small" data-rm="${i}">Eliminar</button>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  E.list.innerHTML = items.map(itemTemplate).join('');

  if (E.sideList) {
    E.sideList.innerHTML = `
      <div class="minibasket-mobile-checkoutnc-title">Tu pedido (${items.length})</div>
      ${items.map(itemTemplate).join('')}
    `;
  }

const subtotal = Number(summary.subtotal || 0);
const shipping = Number(summary.shipping || 0);
const total = Number(summary.total ?? subtotal + shipping);

renderDiscountLine(summary);

if (summary.discount?.code) {
  syncTribeInputFromStorage();

  const rewardLabel = summary.discount?.rank
    ? `${summary.discount.rank} Reward`
    : 'Código Prophetia Tribe';

  setTribeMessage(
    `${rewardLabel} aplicado: -${money(summary.discount.amount || 0)}`,
    'is-ok'
  );
} else if (summary.discountError) {
  setTribeMessage(summary.discountError, 'is-error');
}

  if (E.subtotal) E.subtotal.textContent = money(subtotal);
  if (E.total) E.total.textContent = money(total);
  if (E.sideSubtotal) E.sideSubtotal.textContent = money(subtotal);
  if (E.sideTotal) E.sideTotal.textContent = money(total);

if (E.sideShipping) {
  E.sideShipping.textContent = shipping > 0 ? money(shipping) : 'Gratis';
}

const shippingCost = document.getElementById('ckShippingCost');
if (shippingCost) {
  shippingCost.textContent = shipping > 0 ? money(shipping) : 'Gratis';
}

renderShippingPrivilegeLine(summary);
}
  function renderDetailsSummary(email) {
  const E = els();
  if (!E.detailsSummary) return;

  if (!email) {
    E.detailsSummary.classList.add('d-none');
    E.detailsSummary.setAttribute('aria-hidden', 'true');
    E.detailsSummary.innerHTML = '';
    return;
  }

  E.detailsSummary.innerHTML = `
    <div class="ck-summaryCard" style="border:1px solid rgba(0,0,0,.18); padding:18px; margin:12px 0 0;">
      <div style="display:flex; justify-content:space-between; gap:12px;">
        <strong>Sesión iniciada</strong>
        <button type="button" class="ck-link ck-link--muted" id="ckDetailsEditLogin">Cambiar</button>
      </div>
      <div style="margin-top:8px; opacity:.8;">${escapeHtml(email)}</div>
    </div>

    <div style="margin-top:14px;">
      <button type="button" class="ck-primary" id="ckDetailsContinue">CONTINUAR</button>
    </div>
  `;

  E.detailsSummary.classList.remove('d-none');
  E.detailsSummary.setAttribute('aria-hidden', 'false');

  // “Cambiar” → vuelve a mostrar el form (por si quiere iniciar con otro email)
  document.getElementById('ckDetailsEditLogin')?.addEventListener('click', () => {
    if (E.detailsForm) E.detailsForm.classList.remove('d-none');
    E.detailsSummary.classList.add('d-none');
    E.detailsSummary.setAttribute('aria-hidden', 'true');

    if (E.emailInput) {
      E.emailInput.disabled = false;
      E.emailInput.focus();
    }
    const pass = document.getElementById('ckPass');
    if (pass) pass.value = '';
  });

  // Continuar → Envío
  document.getElementById('ckDetailsContinue')?.addEventListener('click', () => {
    enableShipping(true);
    enableTabs();
    setTab('nav-js-shipping-checkoutnc');
  });
}

function renderShippingLoginSummary(email) {
  const E = els();
  if (!E.shippingLoginSummary) return;

  if (!email) {
    E.shippingLoginSummary.innerHTML = '';
    return;
  }

  E.shippingLoginSummary.innerHTML = `
    <div class="ck-summaryCard" style="border:1px solid rgba(0,0,0,.18); padding:18px; margin:0 0 18px;">
      <div style="display:flex; justify-content:space-between; gap:12px;">
        <strong>Detalles de inicio de sesión</strong>
        <button type="button" class="ck-link ck-link--muted" id="ckShipLogoutTop">Cerrar sesión</button>
      </div>
      <div style="margin-top:8px; opacity:.8;">${escapeHtml(email)}</div>
    </div>
  `;

  document.getElementById('ckShipLogoutTop')?.addEventListener('click', () => {
    document.getElementById('ckLogout')?.click();
  });
}

  function syncUIFromStorage() {
    const E = els();

let savedEmail = localStorage.getItem(LS_EMAIL) || '';
const savedMode = localStorage.getItem(LS_SHIP_MODE) || '';
const savedShipDetails = localStorage.getItem(LS_SHIP_DETAILS) || '';
    const firebaseEmail = String(
  window.__ppAuthCurrentUser?.email ||
  window.__ppLastUser?.email ||
  window.__ppFirebaseAuth?.currentUser?.email ||
  ''
).trim().toLowerCase();

if (firebaseEmail && isEmailValid(firebaseEmail) && firebaseEmail !== savedEmail) {
  localStorage.setItem(LS_EMAIL, firebaseEmail);
}
savedEmail = localStorage.getItem(LS_EMAIL) || savedEmail;

    if (E.emailInput && savedEmail) {
      E.emailInput.value = savedEmail;
      E.emailInput.disabled = true;
    }

        // UI: Detalles (si ya hay sesión, NO mostrar password)
    if (savedEmail) {
      if (E.detailsForm) E.detailsForm.classList.add('d-none');
      renderDetailsSummary(savedEmail);
    } else {
      if (E.detailsForm) E.detailsForm.classList.remove('d-none');
      renderDetailsSummary('');
    }

    // UI: Envío (bloque de sesión arriba del paso 3)
    renderShippingLoginSummary(savedEmail);

    if (E.logoutBtn) E.logoutBtn.style.display = savedEmail ? 'block' : 'none';

    enableShipping(!!savedEmail);
    enablePayment(!!savedShipDetails);
    enableTabs();

    // Shipping restore (modo + resumen)
    if (savedEmail && savedShipDetails) {
      let details = null;
      try { details = JSON.parse(savedShipDetails); } catch { details = null; }

      const mode = details?.shippingMethod || savedMode || '';
      if (mode) {
        const r = document.querySelector(`input[name="shipping"][value="${mode}"]`);
        if (r) r.checked = true;
        applyShippingMode(mode);
      }
if (details) {
  renderShippingSummary(savedEmail, details);
}

    } else if (savedEmail && savedMode) {
      // Si solo hay modo pero NO hay detalles, mostramos el form para completar
      hideShippingSummaryAndShowForm();
      const r = document.querySelector(`input[name="shipping"][value="${savedMode}"]`);
      if (r) r.checked = true;
      applyShippingMode(savedMode);
    } else {
      if (E.shippingRadios.length) E.shippingRadios.forEach(r => (r.checked = false));
      applyShippingMode('');
    }


    // Restore Gift/Invoice states
    applyGiftToggleUI(localStorage.getItem(LS_GIFT_ON) === '1');
    applyInvoiceToggleUI(localStorage.getItem(LS_INVOICE_ON) === '1');
    // ✅ Home-only extras visibles solo si el modo actual es 'home'
const currentMode = localStorage.getItem(LS_SHIP_MODE) || '';
setHomeOnlyExtrasVisible(currentMode === 'home');

  }

  
// ========= Firebase login helper (usa firebase-auth.js ya cargado) =========
async function ppLoginWithEmailPass(email, pass) {
  const fn = window.ppSignInWithEmailPass;
  if (typeof fn !== 'function') {
    throw new Error('ppSignInWithEmailPass no disponible. Revisa que firebase-auth.js cargue sin CORS.');
  }
  return fn(email, pass);
}

  // Logout en checkout: limpia UI + storage + (si existe) Firebase
  const logoutEl = document.getElementById('ckLogout');
  logoutEl?.addEventListener('click', async (e) => {
    e.preventDefault();
    const E = els();


    // 1) Firebase logout si está disponible
    try {
      const fbAuth = window.__ppFirebaseAuth;
      if (fbAuth?.currentUser) {
        // Firebase modular expone signOut dentro del módulo, aquí no importamos.
        // Si tienes window.ppSignOut (lo añadimos en firebase-auth.js abajo), lo usamos.
        await window.ppSignOut?.();


      }
    } catch (err) {
      console.warn('[checkout] signOut firebase falló (no bloquea):', err);
    }

    // 2) Limpia estado checkout
   localStorage.removeItem(LS_EMAIL);
localStorage.removeItem(LS_SHIP_MODE);
localStorage.removeItem(LS_SHIP_DETAILS);
localStorage.removeItem(LS_TRIBE_CODE);
ppSecureCartSummary = null;

    // 3) UI
    if (E.emailInput) {
      E.emailInput.disabled = false;
      E.emailInput.value = '';
      E.emailInput.classList.remove('is-invalid');
    }
    if (E.logoutBtn) E.logoutBtn.style.display = 'none';

    applyShippingMode('');
    enableShipping(false);
    enablePayment(false);

    setTab('nav-js-details-checkoutnc');
    syncUIFromStorage();

  });
function safeJsonParse(raw, fallback = null) {
  try {
    return JSON.parse(raw || '');
  } catch {
    return fallback;
  }
}
function getAppliedTribeCode() {
  return String(localStorage.getItem(LS_TRIBE_CODE) || '').trim().toUpperCase();
}

function setAppliedTribeCode(code = '') {
  const clean = String(code || '').trim().toUpperCase();

  if (clean) {
    localStorage.setItem(LS_TRIBE_CODE, clean);
  } else {
    localStorage.removeItem(LS_TRIBE_CODE);
  }

  ppSecureCartSummary = null;
}

function getCheckoutEmail() {
  return String(localStorage.getItem(LS_EMAIL) || '').trim().toLowerCase();
}
async function waitForCheckoutFirebaseUser(timeoutMs = 2200) {
  const directUser =
    window.__ppAuthCurrentUser ||
    window.__ppLastUser ||
    window.__ppFirebaseAuth?.currentUser ||
    null;

  if (directUser?.getIdToken) {
    return directUser;
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (user = null) => {
      if (settled) return;
      settled = true;

      window.removeEventListener('pp:auth-changed', onAuthChanged);
      resolve(user?.getIdToken ? user : null);
    };

    const onAuthChanged = (event) => {
      finish(event.detail?.user || null);
    };

    window.addEventListener('pp:auth-changed', onAuthChanged, { once: true });

    window.setTimeout(() => {
      finish(
        window.__ppAuthCurrentUser ||
        window.__ppLastUser ||
        window.__ppFirebaseAuth?.currentUser ||
        null
      );
    }, timeoutMs);
  });
}
/* =========================================================
   CHECKOUT · Auth auto-sync
   Si el usuario ya está logado en Prophetia, el paso 2 no pide credenciales
   ========================================================= */

async function syncCheckoutAuthFromFirebase({ moveToShipping = false } = {}) {
  const E = els();

  const user = await waitForCheckoutFirebaseUser(2600);
  const email = String(user?.email || '').trim().toLowerCase();

  if (!email || !isEmailValid(email)) {
    return false;
  }

  /*
    El servidor exige que el email del checkout coincida con el usuario Firebase.
    Por eso usamos siempre el email real de auth.currentUser.
  */
  localStorage.setItem(LS_EMAIL, email);
  ppSecureCartSummary = null;

  if (E.emailInput) {
    E.emailInput.value = email;
    E.emailInput.disabled = true;
    E.emailInput.classList.remove('is-invalid');
  }

  const passEl = document.getElementById('ckPass');
  if (passEl) {
    passEl.value = '';
    clearFieldError(passEl);
  }

  if (E.detailsForm) {
    E.detailsForm.classList.add('d-none');
    E.detailsForm.setAttribute('aria-hidden', 'true');
  }

  renderDetailsSummary(email);
  renderShippingLoginSummary(email);

  if (E.logoutBtn) {
    E.logoutBtn.style.display = 'block';
  }

  enableShipping(true);
  enableTabs();

  if (moveToShipping) {
    setTab('nav-js-shipping-checkoutnc');
    setTimeout(() => {
      ppMaybeApplyDefaultAddress();
    }, 250);
  }

  return true;
}
async function getCheckoutAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };

  const user = await waitForCheckoutFirebaseUser();

  if (!user?.getIdToken) {
    return headers;
  }

  try {
    const token = await user.getIdToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn('[checkout] No se pudo obtener token Firebase:', error);
  }

  return headers;
}

function setTribeMessage(message = '', type = '') {
  const msg = document.getElementById('ckTribeDiscountMsg');
  if (!msg) return;

  msg.textContent = message;
  msg.classList.remove('is-ok', 'is-error');

  if (type) {
    msg.classList.add(type);
  }
}

function syncTribeInputFromStorage() {
  const input = document.getElementById('ckTribeCode');
  if (!input) return;

  const code = getAppliedTribeCode();

  if (code && !input.value) {
    input.value = code;
  }
}
function getShippingPrivilegeLabel(summary = {}) {
  const rate = summary?.shippingRate || {};

  if (!rate.isFree) return '';

  return (
    rate.tribeFreeShippingReason ||
    rate.freeShippingReason ||
    ''
  );
}

function renderShippingPrivilegeLine(summary = {}) {
  const reason = getShippingPrivilegeLabel(summary);

  document
    .querySelectorAll('[data-ck-shipping-privilege]')
    .forEach((node) => node.remove());

  if (!reason) return;

  const html = `
    <div class="ck-shippingPrivilege" data-ck-shipping-privilege>
      ${escapeHtml(reason)}
    </div>
  `;

  const targets = [
    document.getElementById('ckSidebarShipping'),
    document.getElementById('ckShippingCost')
  ].filter(Boolean);

  targets.forEach((target) => {
    target.insertAdjacentHTML('afterend', html);
  });
}
function renderDiscountLine(summary) {
  const discount = summary?.discount;
  const amount = Number(discount?.amount || 0);

  document.querySelectorAll('[data-ck-discount-line]').forEach((node) => node.remove());

  if (!discount || amount <= 0) return;

  const leftTotal = document.getElementById('ckTotal')?.closest('.capds-minicartnc__totalprice');
  const rightTotal = document.getElementById('ckSidebarTotal')?.closest('.capds-minicartnc__totalprice');

const discountLabel = discount.rank
  ? `${discount.rank} Reward · ${discount.code}`
  : `Prophetia Tribe · ${discount.code || 'TRIBE10'}`;

const html = `
  <div class="ck-discountLine" data-ck-discount-line>
    <span>${escapeHtml(discountLabel)}</span>
    <span class="float-right">-${money(amount)}</span>
  </div>
`;

  if (leftTotal) {
    leftTotal.insertAdjacentHTML('beforebegin', html);
  }

  if (rightTotal) {
    rightTotal.insertAdjacentHTML('beforebegin', html);
  }
}

async function validateAndApplyTribeCode() {
  const input = document.getElementById('ckTribeCode');
  const button = document.getElementById('ckApplyTribeCode');

  const code = String(input?.value || '').trim().toUpperCase();
  const email = getCheckoutEmail();

  if (!code) {
    setAppliedTribeCode('');
    setTribeMessage('Introduce tu código Prophetia Tribe.', 'is-error');
    await renderCart();
    return;
  }

  if (!email || !isEmailValid(email)) {
    setTribeMessage('Inicia sesión antes de aplicar el código Tribe.', 'is-error');
    return;
  }

  const payload = {
    ...buildCartSummaryPayload(),
    email,
    discountCode: code
  };

  try {
    if (button) {
      button.disabled = true;
      button.classList.add('is-loading');
    }

   const response = await fetch(PP_DISCOUNT_VALIDATE_ENDPOINT, {
  method: 'POST',
  headers: await getCheckoutAuthHeaders(),
  credentials: 'include',
  body: JSON.stringify(payload)
});

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'No se ha podido aplicar el descuento.');
    }

    setAppliedTribeCode(code);
    ppSecureCartSummary = data;

    const rewardLabel = data.discount?.rank
  ? `${data.discount.rank} Reward`
  : 'Código Prophetia Tribe';

setTribeMessage(`${rewardLabel} aplicado: -${money(data.discount?.amount || 0)}`, 'is-ok');

    await renderCart();
  } catch (err) {
    setAppliedTribeCode('');
    setTribeMessage(err.message || 'Código no válido.', 'is-error');
    await renderCart();
  } finally {
    if (button) {
      button.disabled = false;
      button.classList.remove('is-loading');
    }
  }
}

function initTribeDiscountBox() {
  const input = document.getElementById('ckTribeCode');
  const button = document.getElementById('ckApplyTribeCode');

  if (!input || !button || button.__ppTribeBound) return;

  button.__ppTribeBound = true;

  syncTribeInputFromStorage();

  button.addEventListener('click', () => {
    validateAndApplyTribeCode().catch((error) => {
      console.error('[checkout] Tribe discount error:', error);
      setTribeMessage(error.message || 'No se ha podido aplicar el código.', 'is-error');
    });
  });

  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase();

    if (!input.value.trim()) {
      setAppliedTribeCode('');
      setTribeMessage('');
      renderCart().catch((error) => {
        console.error('[checkout] renderCart tras limpiar Tribe falló:', error);
      });
    }
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      button.click();
    }
  });
}

function getGiftData() {
  const isGift = localStorage.getItem(LS_GIFT_ON) === '1';
  const giftMessageEl = document.querySelector('[name="giftMessage"]');

  return {
    isGift,
    message: isGift ? String(giftMessageEl?.value || '').trim().slice(0, 250) : ''
  };
}

function getInvoiceData() {
  const invoiceWanted = localStorage.getItem(LS_INVOICE_ON) === '1';
  const vatNumberEl = document.querySelector('[name="vatNumber"]');
  const companyNameEl = document.querySelector('[name="companyName"]');

  return {
    invoiceWanted,
    vatNumber: invoiceWanted ? String(vatNumberEl?.value || '').trim().slice(0, 32) : '',
    companyName: invoiceWanted ? String(companyNameEl?.value || '').trim().slice(0, 64) : ''
  };
}
function buildCartSummaryPayload() {
  const cart = loadCart();
  const shippingDetails = safeJsonParse(localStorage.getItem(LS_SHIP_DETAILS), null);
  const discountCode = getAppliedTribeCode();
  const email = getCheckoutEmail();

  return {
    cart: cart.map((item) => ({
      id: String(item.id || '').trim(),
      slug: item.slug ? String(item.slug).trim() : '',
      sku: String(item.sku || '').trim(),
      version: item.version ? String(item.version).trim() : null,
      color: item.color ? String(item.color).trim() : '',
      size: item.size ? String(item.size).trim() : '',
      qty: Math.max(1, Math.min(10, Number(item.qty || 1)))
    })),
    shippingDetails,
    email,
    discountCode
  };
}

async function fetchSecureCartSummary() {
  const payload = buildCartSummaryPayload();

  if (!payload.cart.length) {
    ppSecureCartSummary = {
      currency: 'EUR',
      items: [],
      subtotal: 0,
      shipping: 0,
      total: 0
    };

    return ppSecureCartSummary;
  }

 const response = await fetch(PP_CART_SUMMARY_ENDPOINT, {
  method: 'POST',
  headers: await getCheckoutAuthHeaders(),
  credentials: 'include',
  body: JSON.stringify(payload)
});

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Error HTTP ${response.status}`);
  }

  ppSecureCartSummary = data;
  return data;
}
function buildCheckoutPayload() {
  const cart = loadCart();
  const email = localStorage.getItem(LS_EMAIL) || '';
  const shippingDetails = safeJsonParse(localStorage.getItem(LS_SHIP_DETAILS), null);

return {
  cart: cart.map((item) => ({
    id: String(item.id || '').trim(),
    sku: String(item.sku || '').trim(),
    version: item.version ? String(item.version).trim() : null,
    color: item.color ? String(item.color).trim() : '',
    size: item.size ? String(item.size).trim() : '',
    qty: Math.max(1, Math.min(10, Number(item.qty || 1)))
  })),
  email,
  shippingDetails,
  discountCode: getAppliedTribeCode(),
  gift: getGiftData(),
  invoice: getInvoiceData()
};
}

function validateCheckoutPayload(payload) {
  if (!payload.cart.length) {
    return 'Tu cesta está vacía.';
  }

  if (!isEmailValid(payload.email)) {
    return 'El email del checkout no es válido.';
  }

  if (!payload.shippingDetails) {
    return 'Faltan los datos de envío.';
  }

  if (!['home', 'store'].includes(payload.shippingDetails.shippingMethod)) {
    return 'Selecciona un método de envío válido.';
  }

  const acceptTerms = document.getElementById('ckAcceptTerms');

  if (acceptTerms && !acceptTerms.checked) {
    acceptTerms.focus();
    return 'Debes aceptar las condiciones de venta, devoluciones, envíos y privacidad antes de continuar.';
  }

  return '';
}

function setPaymentLoading(isLoading) {
  const btn = document.getElementById('ckConfirmPay');
  if (!btn) return;

  btn.disabled = !!isLoading;
  btn.classList.toggle('is-loading', !!isLoading);
  btn.textContent = isLoading ? 'CONECTANDO CON PAGO SEGURO…' : 'CONTINUAR AL PAGO SEGURO';
}

function showPaymentError(message) {
  let box = document.getElementById('ckPaymentError');

  if (!box) {
    box = document.createElement('div');
    box.id = 'ckPaymentError';
    box.className = 'pp-fieldError';
    box.setAttribute('role', 'alert');

    const form = document.getElementById('ckPaymentForm');
    form?.insertAdjacentElement('afterbegin', box);
  }

  box.textContent = message || 'No se ha podido iniciar el pago. Inténtalo de nuevo.';
}
function clearCheckoutSensitiveStorage({ keepCart = false } = {}) {
  localStorage.removeItem(LS_EMAIL);
  localStorage.removeItem(LS_SHIP_MODE);
  localStorage.removeItem(LS_SHIP_DETAILS);
  localStorage.removeItem(LS_GIFT_ON);
  localStorage.removeItem(LS_INVOICE_ON);
  localStorage.removeItem(LS_STEP);
  localStorage.removeItem(LS_ORDER_DRAFT_ID);
localStorage.removeItem(LS_TRIBE_CODE);

  if (!keepCart) {
    localStorage.removeItem(CART_KEY);
  }
}

window.ppClearCheckoutSensitiveStorage = clearCheckoutSensitiveStorage;

// ========= Firestore: dirección predeterminada del usuario =========
let __ppDefaultAddressApplied = false;
let __ppShippingFormTouched = false;

function markShippingFormTouched() {
  const form = document.getElementById('ckShippingForm');
  if (!form || form.__ppTouchedBound) return;

  form.__ppTouchedBound = true;

  form.addEventListener('input', (event) => {
    if (event.target?.matches?.('input, select, textarea')) {
      __ppShippingFormTouched = true;
    }
  });

  form.addEventListener('change', (event) => {
    if (event.target?.matches?.('input, select, textarea')) {
      __ppShippingFormTouched = true;
    }
  });
}

async function ppGetFirebaseClient() {
  try {
    const mod = await import('/assets/js/firebase-init.js');
    return {
      auth: mod.auth,
      db: mod.db
    };
  } catch (error) {
    console.warn('[checkout] Firebase init no disponible:', error);
    return {
      auth: null,
      db: null
    };
  }
}

async function ppLoadDefaultFirestoreAddress() {
  const { auth, db } = await ppGetFirebaseClient();

  if (!auth || !db || !auth.currentUser) {
    return null;
  }

  const {
    collection,
    getDocs,
    query,
    where,
    limit
  } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');

  const ref = collection(db, 'users', auth.currentUser.uid, 'addresses');

  const defaultQuery = query(
    ref,
    where('isDefault', '==', true),
    limit(1)
  );

  const snap = await getDocs(defaultQuery);

  if (snap.empty) {
    return null;
  }

  const docSnap = snap.docs[0];

  return {
    id: docSnap.id,
    ...docSnap.data()
  };
}

function ppSplitFullName(fullName = '') {
  const clean = String(fullName || '').trim();
  if (!clean) {
    return {
      firstName: '',
      lastName: ''
    };
  }

  const parts = clean.split(/\s+/);
  const firstName = parts.shift() || '';
  const lastName = parts.join(' ');

  return {
    firstName,
    lastName
  };
}

function ppMapFirestoreAddressToCheckout(address) {
  if (!address) return null;

  const name = ppSplitFullName(address.name || '');

  return {
    firstName: name.firstName,
    lastName: name.lastName,
    address1: address.line1 || '',
    address2: address.line2 || '',
    postalCode: address.postcode || '',
    city: address.city || '',
    state: address.province || '',
    country: address.country || 'España',
    phone: address.phone || '',
    shippingMethod: 'home',
    source: 'firestore-default-address',
    firestoreAddressId: address.id || ''
  };
}

function ppSetFieldValue(form, name, value) {
  const el = form?.querySelector(`[name="${name}"]`);
  if (!el) return;

  el.value = value || '';

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function ppFillShippingFormFromAddress(details) {
  const form = document.getElementById('ckShippingForm');
  if (!form || !details) return;

  ppSetFieldValue(form, 'ship_firstName', details.firstName);
  ppSetFieldValue(form, 'ship_lastName', details.lastName);
  ppSetFieldValue(form, 'ship_address1', details.address1);
  ppSetFieldValue(form, 'ship_address2', details.address2);
  ppSetFieldValue(form, 'ship_postal', details.postalCode);
  ppSetFieldValue(form, 'ship_city', details.city);
  ppSetFieldValue(form, 'ship_state', ppNormalizeLegacyProvinceValue(details.state));
  ppSetFieldValue(form, 'ship_country', details.country);
  ppSetFieldValue(form, 'ship_phone', details.phone);
}

function ppShowDefaultAddressNotice() {
  const panel = document.getElementById('js-shipToMe-checkoutnc');
  if (!panel) return;

  let notice = document.getElementById('ppDefaultAddressNotice');

  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'ppDefaultAddressNotice';
    notice.className = 'pp-default-address-notice';

    panel.insertAdjacentElement('afterbegin', notice);
  }

  notice.innerHTML = `
    <p class="pp-default-address-notice__kicker">Dirección predeterminada</p>
    <p class="pp-default-address-notice__text">
      Hemos aplicado tu dirección guardada para agilizar el envío.
    </p>
  `;
}

async function ppMaybeApplyDefaultAddress() {
  const hasSavedShipping = !!localStorage.getItem(LS_SHIP_DETAILS);

  if (__ppDefaultAddressApplied || __ppShippingFormTouched || hasSavedShipping) {
    return;
  }

  let savedEmail = localStorage.getItem(LS_EMAIL) || '';
  if (!savedEmail) return;

  try {
    const address = await ppLoadDefaultFirestoreAddress();
    const details = ppMapFirestoreAddressToCheckout(address);

    if (!details) return;

    const homeRadio = document.querySelector('input[name="shipping"][value="home"]');

    if (homeRadio) {
      homeRadio.checked = true;
    }

    applyShippingMode('home');
    ppFillShippingFormFromAddress(details);
    ppShowDefaultAddressNotice();

    __ppDefaultAddressApplied = true;

    console.info('[checkout] Dirección predeterminada aplicada desde Firestore:', address.id);
  } catch (error) {
    console.warn('[checkout] No se pudo aplicar dirección predeterminada:', error);
  }
}
  // Inicializar los pasos
  function initSteps() {
    const E = els();
        // Gift toggle (Prophetia-like)
    if (E.giftToggle && !E.giftToggle.__ppBound) {
      E.giftToggle.__ppBound = true;
      E.giftToggle.addEventListener('change', () => {
        applyGiftToggleUI(E.giftToggle.checked);
      });
    }
// ===== Back button (header "<") =====
if (E.back && !E.back.__ppBound) {
  E.back.__ppBound = true;

  const ORDER = [
    'nav-js-basket-checkoutnc',
    'nav-js-details-checkoutnc',
    'nav-js-shipping-checkoutnc',
    'nav-js-payment-checkoutnc'
  ];

  E.back.addEventListener('click', (ev) => {
    ev.preventDefault();

    const activeTabId = getActiveTabId();
    const activePaneId = activeTabId ? activeTabId.replace(/-tab$/, '') : '';

    const cur = activePaneId || 'nav-js-basket-checkoutnc';
    const idx = ORDER.indexOf(cur);

    if (idx <= 0) {
      window.location.assign('/home');
      return;
    }

    const prev = ORDER[idx - 1];
    setTab(prev, { persist: true, scroll: false });
  });
}
// ===== Payment submit -> Stripe Checkout =====
const paymentForm = document.getElementById('ckPaymentForm');

if (paymentForm && !paymentForm.__ppPaymentBound) {
  paymentForm.__ppPaymentBound = true;

paymentForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = buildCheckoutPayload();
  const error = validateCheckoutPayload(payload);

  if (error) {
    showPaymentError(error);
    return;
  }

  setPaymentLoading(true);

  try {
  const response = await fetch(PP_CHECKOUT_SESSION_ENDPOINT, {
  method: 'POST',
  headers: await getCheckoutAuthHeaders(),
  credentials: 'include',
  body: JSON.stringify(payload)
});

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Error HTTP ${response.status}`);
    }

    if (!data.url) {
      throw new Error('El servidor no ha devuelto la URL de pago.');
    }

    if (data.orderDraftId) {
      localStorage.setItem(LS_ORDER_DRAFT_ID, data.orderDraftId);
    }

    window.location.assign(data.url);
  } catch (err) {
    console.error('[checkout] pago seguro falló:', err);
    showPaymentError(err.message || 'No se ha podido conectar con la pasarela de pago.');
    setPaymentLoading(false);
  }
});
}

    // Invoice toggle (Prophetia-like)
    if (E.invoiceToggle && !E.invoiceToggle.__ppBound) {
      E.invoiceToggle.__ppBound = true;
      E.invoiceToggle.addEventListener('change', () => {
        applyInvoiceToggleUI(E.invoiceToggle.checked);
      });
    }
    // Billing toggle (si no está marcado, el panel NO debe validar)
    if (E.billingToggle && E.billingPanel && !E.billingToggle.__ppBound) {
      E.billingToggle.__ppBound = true;

      const applyBillingUI = (on) => {
        setDisplay(E.billingPanel, !!on);
        setDisabledInside(E.billingPanel, !on);
      };

      // init
      applyBillingUI(E.billingToggle.checked);

      E.billingToggle.addEventListener('change', () => {
        applyBillingUI(E.billingToggle.checked);
      });
    }

    // Mostrar paneles según radio (home/store)
    E.shippingRadios?.forEach((r) => {
      if (r.__ppBound) return;
      r.__ppBound = true;
    r.addEventListener('change', () => {
  hideShippingSummaryAndShowForm(); // ← clave
  applyShippingMode(r.value);
});

    });

// Basket CTA -> Details
const goDetails = async () => {
  const cart = loadCart();
  if (!cart.length) return;

  /*
    Primero sincronizamos Firebase.
    Si ya está logado, el paso 2 mostrará resumen de sesión.
    Si no está logado, mostrará el formulario normal.
  */
  await syncCheckoutAuthFromFirebase();

  enableTabs();
  setTab('nav-js-details-checkoutnc');
};

E.basketCTA?.addEventListener('click', goDetails);
E.sideCTA?.addEventListener('click', goDetails);

    // Details submit -> Shipping
    E.detailsForm?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = E.emailInput?.value?.trim() || '';
      const pass  = document.querySelector('#ckPass')?.value?.trim() || '';

      if (!isEmailValid(email)) {
        console.warn('[checkout] email inválido:', email);
        E.emailInput?.classList.add('is-invalid');
        return;
      }
       if (!pass) {
        const passEl = document.querySelector('#ckPass');
        setFieldError(passEl, 'Introduce tu contraseña');
        passEl?.focus();
        return;
      }


      try {
        await ppLoginWithEmailPass(email, pass);

        // Guardamos email para el flujo checkout
        localStorage.setItem(LS_EMAIL, email);
if (E.detailsForm) E.detailsForm.classList.add('d-none');
renderDetailsSummary(email);
renderShippingLoginSummary(email);

        enableShipping(true);
setTab('nav-js-shipping-checkoutnc');
syncUIFromStorage();

// Firestore puede tardar una fracción más que el cambio de tab.
// Este segundo intento evita que el usuario tenga que refrescar.
setTimeout(() => {
  ppMaybeApplyDefaultAddress();
}, 250);
          } catch (err) {
        console.error('[checkout] login falló:', err);
        const passEl = document.querySelector('#ckPass');
        setFieldError(passEl, 'Credenciales incorrectas o error de login');
        passEl?.focus();
      }


    });


    // Shipping submit -> Payment
 E.shippingForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const E2 = els();
  const checked = document.querySelector('input[name="shipping"]:checked');
  const shippingMethod = checked?.value || '';

  if (!shippingMethod) {
    // Marca visualmente las dos opciones
    document.querySelectorAll('.ck-radio').forEach(r => r.classList.add('pp-radioError'));
    // y quítalo al seleccionar
    document.querySelectorAll('input[name="shipping"]').forEach(r => {
      r.addEventListener('change', () => {
        document.querySelectorAll('.ck-radio').forEach(x => x.classList.remove('pp-radioError'));
      }, { once: true });
    });
    return;
  }


  if (shippingMethod === 'home') {
   const panel = document.getElementById('js-shipToMe-checkoutnc');
const test = validateRequired(panel);
if (!test.ok) return;


    const details = {
      firstName: val(E2.shippingForm, 'ship_firstName'),
      lastName:  val(E2.shippingForm, 'ship_lastName'),
      address1:  val(E2.shippingForm, 'ship_address1'),
      address2:  val(E2.shippingForm, 'ship_address2'),
      postalCode: val(E2.shippingForm, 'ship_postal'),
      city:      val(E2.shippingForm, 'ship_city'),
      state:     val(E2.shippingForm, 'ship_state'),
      country:   val(E2.shippingForm, 'ship_country'),
      phone:     val(E2.shippingForm, 'ship_phone'),
      shippingMethod: 'home'
    };

localStorage.setItem(LS_SHIP_DETAILS, JSON.stringify(details));
try {
  await renderCart();
} catch (error) {
  console.error('[checkout] renderCart tras guardar envío falló:', error);
  showPaymentError(error.message || 'No se ha podido calcular el envío.');
  return;
}

// ✅ (Opcional) si tienes una función legacy, llámala sin romper el flujo
if (typeof window.saveNewAddress === 'function') {
  try { window.saveNewAddress(); } catch (e) { console.warn('[addr] saveNewAddress falló:', e); }
}

// ✅ Guardar solo si el usuario eligió "Crear nueva..."
// Desactivado en producción inicial: evita guardar direcciones en localStorage.
// saveCurrentFormAddressIfNew();



enablePayment(true);
enableTabs();

    // Render resumen estilo “Prophetia-like”
    const email = localStorage.getItem(LS_EMAIL) || '';
    renderShippingSummary(email, details);

    // ✅ Ir a Pago (paso 4)
    renderPaymentShippingDetails();
    setTab('nav-js-payment-checkoutnc');

    return;
  }

  // STORE
  if (shippingMethod === 'store') {
    const store = val(E2.shippingForm, 'store');
    if (!store) {
      const storeEl = E2.shippingForm?.querySelector('[name="store"]');
      setFieldError(storeEl, 'Selecciona una tienda');
      storeEl?.focus();
      return;
    }


    const details = { shippingMethod: 'store', store };
    localStorage.setItem(LS_SHIP_DETAILS, JSON.stringify(details));
    try {
  await renderCart();
} catch (error) {
  console.error('[checkout] renderCart tras guardar recogida falló:', error);
  showPaymentError(error.message || 'No se ha podido calcular el método de entrega.');
  return;
}
    enablePayment(true);
    enableTabs();

    const email = localStorage.getItem(LS_EMAIL) || '';
    renderShippingSummary(email, { ...details, firstName:'', lastName:'', address1:'', postalCode:'', city:'', state:'', country:'', phone:'' });

    // ✅ Ir a Pago (paso 4)
    renderPaymentShippingDetails();
    setTab('nav-js-payment-checkoutnc');
  }
});


  }
  // ========= Validación email (simple y suficiente) =========
  function isEmailValid(email = '') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
  }

  // ========= Gate de pasos =========
  function enableShipping(enabled) {
    const E = els();
    enableTab(E.tabShipping, !!enabled);
    // Si quieres deshabilitar campos de shipping si no hay email:
    setDisabledInside(E.shippingForm, !enabled);
  }

  function enablePayment(enabled) {
    const E = els();
    enableTab(E.tabPayment, !!enabled);
  }

  // ========= Clicks en tabs (bloquea si están disabled) =========
  function initTabClicks() {
    const E = els();
    if (!E.tabs?.length) return;

    E.tabs.forEach((a) => {
      if (a.__ppBound) return;
      a.__ppBound = true;

      a.addEventListener('click', (ev) => {
        if (a.classList.contains('disabled') || a.getAttribute('aria-disabled') === 'true') {
          ev.preventDefault();
          ev.stopPropagation();
          return;
        }
        const href = a.getAttribute('href') || '';
        const id = href.startsWith('#') ? href.slice(1) : '';
        if (id) setTab(id);
      });
    });
  }

  // ========= Eventos de carrito (LEFT + RIGHT) =========
  function initCartEvents() {
    const E = els();

    // Un solo listener para ambos contenedores
    if (document.__ppCartBound) return;
    document.__ppCartBound = true;

    document.addEventListener('click', (e) => {
      const inLeft  = e.target.closest('#ckCartList');
      const inRight = e.target.closest('#ckSidebarCartList');
      if (!inLeft && !inRight) return;

      const row = e.target.closest('[data-i]');
      if (!row) return;

      const i = +row.getAttribute('data-i');
      const cart = loadCart();
      if (!cart[i]) return;

    // ELIMINAR (con confirmación Prophetia-like)
const rmBtn = e.target.closest('[data-rm]');
if (rmBtn) {
  const idx = +rmBtn.getAttribute('data-rm');
  if (!Number.isFinite(idx)) return;

 ppConfirmEmptyBasket({
  title: 'Eliminar artículo',
  message: '¿Quieres eliminar este artículo de tu cesta?',
  acceptText: 'ELIMINAR',
  cancelText: 'Cancelar',
  onAccept: () => {
    cart.splice(idx, 1);
    saveCart(cart);
    renderCart().catch((error) => {
  console.error('[checkout] renderCart tras cambio de cesta falló:', error);
});

    if (!cart.length) {
      localStorage.removeItem(LS_EMAIL);
      localStorage.removeItem(LS_SHIP_MODE);
      localStorage.removeItem(LS_SHIP_DETAILS);
      localStorage.removeItem(LS_GIFT_ON);
      localStorage.removeItem(LS_INVOICE_ON);
      window.location.assign('/home');
    }
  }
});

  return;
}

     // QTY +/-
const btn = e.target.closest('button[data-op]');
if (btn) {
  const op = btn.getAttribute('data-op');
  const cur = (+cart[i].qty || 1);

if (op === '-' && cur <= 1) {
  ppConfirmEmptyBasket({
    title: 'Quitar artículo',
    message: 'Al bajar la cantidad, este artículo se eliminará de tu cesta. ¿Continuar?',
    acceptText: 'CONTINUAR',
    cancelText: 'Cancelar',
    onAccept: () => {
      cart.splice(i, 1);
      saveCart(cart);
      renderCart().catch((error) => {
  console.error('[checkout] renderCart tras cambio de cesta falló:', error);
});

      if (!cart.length) {
        localStorage.removeItem(LS_EMAIL);
        localStorage.removeItem(LS_SHIP_MODE);
        localStorage.removeItem(LS_SHIP_DETAILS);
        localStorage.removeItem(LS_GIFT_ON);
        localStorage.removeItem(LS_INVOICE_ON);
        window.location.assign('/home');
      }
    }
  });

  return;
}

  const next = cur + (op === '+' ? 1 : -1);
  cart[i].qty = Math.max(1, next);

  saveCart(cart);
renderCart().catch((error) => {
  console.error('[checkout] renderCart tras cambio de cantidad falló:', error);
});
return;
}

    });
  }

// ========= Helpers form =========
function val(form, name) {
  const el = form?.querySelector(`[name="${name}"]`);
  if (!el) return '';
  return (el.value ?? '').toString().trim();
}

const LS_SAVED_ADDR = 'pp_saved_addresses_v1';

function getSavedAddresses() {
  try { return JSON.parse(localStorage.getItem(LS_SAVED_ADDR) || '[]'); }
  catch { return []; }
}

function setSavedAddresses(list) {
  localStorage.setItem(LS_SAVED_ADDR, JSON.stringify(Array.isArray(list) ? list : []));
}

function normalizeAddr(a) {
  return {
    address1: (a.address1 || '').trim(),
    address2: (a.address2 || '').trim(),
    postalCode: (a.postalCode || '').trim(),
    city: (a.city || '').trim(),
    state: (a.state || '').trim(),
    country: (a.country || 'es').trim(),
    firstName: (a.firstName || '').trim(),
    lastName: (a.lastName || '').trim(),
    phone: (a.phone || '').trim(),
  };
}

function addrKey(a) {
  return [
    a.address1.toLowerCase(),
    a.postalCode.toLowerCase(),
    a.city.toLowerCase(),
    a.state.toLowerCase(),
    a.country.toLowerCase()
  ].join('|');
}

function loadSavedAddressesIntoSelect() {
  const select = document.querySelector('select[name="ship_addressList"]');
  if (!select) return;

  // limpia todo excepto placeholder y "new"
  const keep = new Set(['', 'new']);
  Array.from(select.options).forEach(opt => {
    if (!keep.has(opt.value)) opt.remove();
  });

  const list = getSavedAddresses();
  list.forEach((raw, index) => {
    const a = normalizeAddr(raw);
    if (!a.address1 || !a.postalCode) return;

    const opt = document.createElement('option');
    opt.value = `address_${index}`;
    opt.textContent = `${a.city || '—'} · ${a.address1} · ${a.postalCode}`;
    select.appendChild(opt);
  });
}

function fillSelectedAddressFromSelect() {
  const form = document.getElementById('ckShippingForm');
  const select = form?.querySelector('select[name="ship_addressList"]');
  if (!form || !select) return;

  const v = select.value;
  if (v === 'new' || !v) return;

  if (v.startsWith('address_')) {
    const idx = parseInt(v.split('_')[1], 10);
    const list = getSavedAddresses();
    const a = normalizeAddr(list[idx] || {});
    if (!a.address1) return;

    form.querySelector('input[name="ship_address1"]').value = a.address1;
    form.querySelector('input[name="ship_address2"]').value = a.address2 || '';
    form.querySelector('input[name="ship_postal"]').value = a.postalCode;
    form.querySelector('input[name="ship_city"]').value = a.city;
    form.querySelector('select[name="ship_state"]').value = ppNormalizeLegacyProvinceValue(a.state);

    form.querySelector('select[name="ship_country"]').value = a.country;

    const fn = form.querySelector('input[name="ship_firstName"]');
    const ln = form.querySelector('input[name="ship_lastName"]');
    const ph = form.querySelector('input[name="ship_phone"]');
    if (fn && a.firstName) fn.value = a.firstName;
    if (ln && a.lastName) ln.value = a.lastName;
    if (ph && a.phone) ph.value = a.phone;
  }
}

function saveCurrentFormAddressIfNew() {
  const form = document.getElementById('ckShippingForm');
  const select = form?.querySelector('select[name="ship_addressList"]');
  if (!form || !select) return;

  // Solo guardamos si está en "new"
  if (select.value !== 'new') return;

  const a = normalizeAddr({
    firstName: form.querySelector('input[name="ship_firstName"]')?.value,
    lastName: form.querySelector('input[name="ship_lastName"]')?.value,
    address1: form.querySelector('input[name="ship_address1"]')?.value,
    address2: form.querySelector('input[name="ship_address2"]')?.value,
    postalCode: form.querySelector('input[name="ship_postal"]')?.value,
    city: form.querySelector('input[name="ship_city"]')?.value,
    state: form.querySelector('select[name="ship_state"]')?.value,
    country: form.querySelector('select[name="ship_country"]')?.value,
    phone: form.querySelector('input[name="ship_phone"]')?.value,
  });

  if (!a.address1 || !a.postalCode) return;

  const list = getSavedAddresses();
  const keys = new Set(list.map(x => addrKey(normalizeAddr(x))));
  const k = addrKey(a);

  let savedIndex = -1;

  if (!keys.has(k)) {
    list.push(a);
    setSavedAddresses(list);
    savedIndex = list.length - 1;
  } else {
    // si ya existía, buscamos el índice para poder seleccionarlo
    savedIndex = list.map(x => addrKey(normalizeAddr(x))).indexOf(k);
  }

  loadSavedAddressesIntoSelect();

  // ✅ Selecciona la dirección guardada en el desplegable
  if (savedIndex >= 0) {
    select.value = `address_${savedIndex}`;
  }
}
// ========= Provincias España (para selects ship_state / bill_state) =========
// Nota: usamos el NOMBRE como value para que Google Places matchee fácil por texto.
const PP_ES_PROVINCES = [
  "Álava", "Albacete", "Alicante", "Almería", "Asturias", "Ávila",
  "Badajoz", "Baleares", "Barcelona", "Burgos",
  "Cáceres", "Cádiz", "Cantabria", "Castellón", "Ciudad Real", "Córdoba", "Cuenca",
  "Girona", "Granada", "Guadalajara", "Gipuzkoa",
  "Huelva", "Huesca",
  "Jaén",
  "A Coruña", "La Rioja", "Las Palmas", "León", "Lleida", "Lugo",
  "Madrid", "Málaga", "Murcia",
  "Navarra",
  "Ourense",
  "Palencia", "Pontevedra",
  "Salamanca", "Santa Cruz de Tenerife", "Segovia", "Sevilla", "Soria",
  "Tarragona", "Teruel", "Toledo",
  "Valencia", "Valladolid", "Bizkaia",
  "Zamora", "Zaragoza",
  "Ceuta", "Melilla"
];

function ppPopulateProvincesSelect(selectEl, { keepPlaceholder = true } = {}) {
  if (!selectEl) return;

  // Evita repoblar 200 veces
  if (selectEl.__ppProvincesLoaded) return;
  selectEl.__ppProvincesLoaded = true;

  // Conserva placeholder (el option vacío)
  const placeholder = keepPlaceholder
    ? Array.from(selectEl.options).find(o => !o.value)
    : null;

  // Limpia todo
  selectEl.innerHTML = '';
  if (placeholder) {
    selectEl.appendChild(placeholder);
  } else {
    const opt = document.createElement('option');
    opt.value = '';
    opt.disabled = true;
    opt.selected = true;
    opt.hidden = true;
    selectEl.appendChild(opt);
  }

  // Inserta provincias
  PP_ES_PROVINCES.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;        // 👈 value = nombre (importante para matching fácil)
    opt.textContent = name;
    selectEl.appendChild(opt);
  });
}

// Compat: si tenías códigos antiguos (SE/M/B/V), los convertimos a nombres
function ppNormalizeLegacyProvinceValue(v) {
  const map = {
    SE: "Sevilla",
    M: "Madrid",
    B: "Barcelona",
    V: "Valencia"
  };
  return map[v] || v;
}

function ppInitProvinceSelects() {
  // Shipping
  const ship = document.querySelector('select[name="ship_state"]');
  if (ship) ppPopulateProvincesSelect(ship);

  // Billing
  const bill = document.querySelector('select[name="bill_state"]');
  if (bill) ppPopulateProvincesSelect(bill);
}



function renderShippingSummary(email, details) {
  const E = els();
  if (!E.shipSummaryContainer) return;

  const isStore = details.shippingMethod === 'store';

  const fullName = `${details.firstName || ''} ${details.lastName || ''}`.trim();
  const addr2 = details.address2 ? `<div>${escapeHtml(details.address2)}</div>` : '';

  const summaryTitle = isStore
    ? 'Este es el resumen de tu pedido para la recogida en tienda'
    : 'Este es el resumen de tu pedido para la entrega a domicilio';

  const address = isStore
    ? `
      <div><strong>Recogida en tienda</strong></div>
      <div>${escapeHtml(details.store || '-')}</div>
    `
    : `
      <div>${escapeHtml(fullName || '-')}</div>
      <div>${escapeHtml(details.address1 || '-')}</div>
      ${addr2}
      <div>${escapeHtml(details.postalCode || '')} ${escapeHtml(details.city || '')}</div>
      <div>${escapeHtml(details.state || '')}, ${escapeHtml(details.country || '')}</div>
      <div>${escapeHtml(details.phone || '')}</div>
    `;

const shippingRate = ppSecureCartSummary?.shippingRate || {};
const shippingPrice = Number(ppSecureCartSummary?.shipping || 0);

const shippingTitle = isStore
  ? 'Recogida en tienda'
  : (shippingRate.carrierLabel || shippingRate.label || 'Envío estándar');

const shippingDelivery = shippingRate.estimatedDelivery || (isStore
  ? 'Te avisaremos cuando esté preparado'
  : '2–7 días laborables');

const shippingPriceLabel = shippingPrice > 0 ? money(shippingPrice) : 'Gratis';
const shippingPrivilegeLabel = getShippingPrivilegeLabel(ppSecureCartSummary);
 E.shipSummaryContainer.innerHTML = `
  <div class="ck-box">
<h3 class="ck-h">${escapeHtml(summaryTitle)}</h3>

    <div class="ck-summaryCard" style="border:1px solid rgba(0,0,0,.18); padding:18px; margin-top:12px;">
      <div style="display:flex; justify-content:space-between; gap:12px;">
        <strong>Detalles de inicio de sesión</strong>
        <button type="button" class="ck-link ck-link--muted" id="ckSummaryLogout">Cerrar sesión</button>
      </div>
      <div style="margin-top:8px; opacity:.8;">${escapeHtml(email || '')}</div>
    </div>

    <div class="ck-summaryCard" style="border:1px solid rgba(0,0,0,.18); padding:18px; margin-top:12px;">
      <div style="display:flex; justify-content:space-between; gap:12px;">
        <strong>${isStore ? 'Recogida en tienda' : 'Dirección de envío'}</strong>

        <button type="button" class="ck-link ck-link--muted" id="ckSummaryEdit">Editar</button>
      </div>
      <div style="margin-top:8px; opacity:.85;">${address}</div>

      <div style="margin-top:14px; padding-top:14px; border-top:1px solid rgba(0,0,0,.10); display:flex; justify-content:space-between;">
        <div>
       <strong>${escapeHtml(shippingTitle)}</strong>
<div style="opacity:.7; font-size:12px; margin-top:4px;">${escapeHtml(shippingDelivery)}</div>
${
  shippingPrivilegeLabel
    ? `<div style="opacity:.72; font-size:12px; margin-top:6px; color:#8a6727;">${escapeHtml(shippingPrivilegeLabel)}</div>`
    : ''
}
</div>
<strong>${escapeHtml(shippingPriceLabel)}</strong>
      </div>
    </div>

    <!-- CTA Prophetia-like: CONTINUAR -->
    <div style="margin-top:18px;">
      <button type="button" class="ck-primary" id="ckShippingContinue">CONTINUAR</button>
    </div>
  </div>
`;

  // Mostrar resumen y ocultar form (modo Prophetia)
  E.shipSummaryContainer.classList.remove('d-none');
  E.shipSummaryContainer.classList.add('d-block');
  E.shipSummaryContainer.setAttribute('aria-hidden', 'false');
  // Oculta “Elige dónde...” y el login summary superior cuando ya hay resumen
  if (E.shipIntroTitle) E.shipIntroTitle.classList.add('d-none');
  if (E.shippingLoginSummary) E.shippingLoginSummary.classList.add('d-none');

  // Opcional: oculta el formulario completo al mostrar resumen
  E.shippingForm?.classList.add('d-none');
  E.shippingForm?.setAttribute('aria-hidden', 'true');

  // Botón “Editar” vuelve al formulario
document.getElementById('ckSummaryEdit')?.addEventListener('click', () => {
  hideShippingSummaryAndShowForm();
  // opcional: scroll arriba para UX Prophetia-like
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

  // Botón “Cerrar sesión” reutiliza tu logout real
  document.getElementById('ckSummaryLogout')?.addEventListener('click', () => {
    document.getElementById('ckLogout')?.click();
    
  });
  // Botón “CONTINUAR” -> ir a Pago
document.getElementById('ckShippingContinue')?.addEventListener('click', () => {
  enablePayment(true);
  enableTabs();
  renderPaymentShippingDetails();
  setTab('nav-js-payment-checkoutnc');
});

}
function renderPaymentShippingDetails() {
  const card = document.getElementById('ckShipDetailsCard');
  if (!card) return;

  let details = null;
  try { details = JSON.parse(localStorage.getItem(LS_SHIP_DETAILS) || 'null'); }
  catch { details = null; }

  const email = localStorage.getItem(LS_EMAIL) || '';

  if (!details) {
    card.innerHTML = `<div style="opacity:.7">No hay datos de envío todavía.</div>`;
    return;
  }

  const fullName = `${details.firstName || ''} ${details.lastName || ''}`.trim();
  const addr2 = details.address2 ? `<div>${escapeHtml(details.address2)}</div>` : '';
  const address = details.shippingMethod === 'store'
    ? `<div><strong>Recogida en tienda</strong></div><div>${escapeHtml(details.store || '')}</div>`
    : `
      <div><strong>Datos de contacto</strong></div>
      <div>${escapeHtml(email)}</div>
      <div style="margin-top:10px"><strong>Dirección de envío</strong></div>
      <div>${escapeHtml(fullName || '-')}</div>
      <div>${escapeHtml(details.address1 || '-')}</div>
      ${addr2}
      <div>${escapeHtml(details.postalCode || '')} ${escapeHtml(details.city || '')}</div>
      <div>${escapeHtml(details.state || '')}, ${escapeHtml(details.country || '')}</div>
      <div>${escapeHtml(details.phone || '')}</div>
    `;

  const shippingRate = ppSecureCartSummary?.shippingRate || {};
const shippingPrice = Number(ppSecureCartSummary?.shipping || 0);
const shippingPriceLabel = shippingPrice > 0 ? money(shippingPrice) : 'Gratis';
const shippingPrivilegeLabel = getShippingPrivilegeLabel(ppSecureCartSummary);

const shippingInfo = `
  <div style="margin-top:10px"><strong>Método de envío</strong></div>
  <div>
    ${escapeHtml(shippingRate.carrierLabel || shippingRate.label || (details.shippingMethod === 'store' ? 'Recogida en tienda' : 'Envío estándar'))}
    · ${escapeHtml(shippingRate.estimatedDelivery || '2–7 días laborables')}
    · ${escapeHtml(shippingPriceLabel)}
  </div>
  ${
    shippingPrivilegeLabel
      ? `<div style="opacity:.72; font-size:12px; margin-top:6px; color:#8a6727;">${escapeHtml(shippingPrivilegeLabel)}</div>`
      : ''
  }
`;

card.innerHTML = address + shippingInfo;
}

  // Inicialización
  document.addEventListener('DOMContentLoaded', () => {
 
markShippingFormTouched();
    renderCart().catch((error) => {
  console.error('[checkout] renderCart inicial falló:', error);
});
window.addEventListener('pp:auth-ready', () => {
  syncCheckoutAuthFromFirebase()
    .finally(() => {
      syncUIFromStorage();
      renderCart().catch((error) => {
        console.error('[checkout] renderCart tras pp:auth-ready falló:', error);
      });
    });
});

window.addEventListener('pp:auth-changed', () => {
  syncCheckoutAuthFromFirebase()
    .finally(() => {
      syncUIFromStorage();
      renderCart().catch((error) => {
        console.error('[checkout] renderCart tras pp:auth-changed falló:', error);
      });
    });
});
initCartEvents();
    
initTabClicks();
initSteps();
initTribeDiscountBox();

ppInitProvinceSelects();

loadSavedAddressesIntoSelect();

const sel = document.querySelector('select[name="ship_addressList"]');
if (sel && !sel.__ppBound) {
  sel.__ppBound = true;
  sel.addEventListener('change', fillSelectedAddressFromSelect);
}

syncCheckoutAuthFromFirebase()
  .finally(() => {
    syncUIFromStorage();
    ppMaybeApplyDefaultAddress();

    // Si el carrito está vacío, no tiene sentido “recordar” pasos
    const cart = loadCart();
    if (!cart.length) {
      setTab('nav-js-basket-checkoutnc', { persist: true, scroll: false });
      syncRightRailVisibility();
      return;
    }

    const initial = resolveInitialTabId();
    setTab(initial, { persist: true, scroll: false });

    syncRightRailVisibility();
  });
  });


window.addEventListener('pageshow', () => {
  syncUIFromStorage();

  renderCart().catch((error) => {
    console.error('[checkout] renderCart pageshow falló:', error);
  });

  renderPaymentShippingDetails();
  syncRightRailVisibility();
});





// ========= Google Places Autocomplete (Dirección 1) =========
async function ppInitAddressAutocomplete() {
  // 1) Encuentra el input
  const form = document.getElementById('ckShippingForm');
  const address1 = form?.querySelector('input[name="ship_address1"]');
  if (!address1) return;

  // Evita doble binding
  if (address1.__ppPlacesBound) return;
  address1.__ppPlacesBound = true;

  // 2) Carga librería "places" (Google recomienda importLibrary) :contentReference[oaicite:3]{index=3}
  await google.maps.importLibrary('places');

  // 3) Crea Autocomplete (clásico, sobre tu <input>)
  const ac = new google.maps.places.Autocomplete(address1, {
    types: ['address'],
    // Si quieres SOLO España:
    componentRestrictions: { country: ['es'] }
    // Si quieres permitir ES/PT/FR:
    // componentRestrictions: { country: ['es','pt','fr'] }
  });

  // 4) Limita datos devueltos (menos coste y más rápido)
  ac.setFields?.(['address_components', 'formatted_address']);

  const pick = (type, comps) => {
    const c = comps?.find(x => x.types?.includes(type));
    return c ? c.long_name : '';
  };

  ac.addListener('place_changed', () => {
    const place = ac.getPlace?.();
    const comps = place?.address_components || [];

    // Dirección bonita (Google)
    const formatted = place?.formatted_address || '';

    // Partes
    const postal = pick('postal_code', comps);
    const city =
      pick('locality', comps) ||
      pick('postal_town', comps) ||
      pick('administrative_area_level_2', comps);

    const province = pick('administrative_area_level_1', comps); // Andalucía, Madrid, etc.

    // Rellena campos
    address1.value = formatted || address1.value;

    const postalEl = form.querySelector('input[name="ship_postal"]');
    const cityEl   = form.querySelector('input[name="ship_city"]');
    const stateEl  = form.querySelector('select[name="ship_state"]');

    if (postalEl && postal) postalEl.value = postal;
    if (cityEl && city) cityEl.value = city;

    // Tu select de provincias ahora tiene pocas opciones.
    // Intentamos matchear por texto; si no existe, lo dejamos.
    if (stateEl && province) {
      const opt = Array.from(stateEl.options).find(o =>
        (o.textContent || '').toLowerCase().includes(province.toLowerCase())
      );
      if (opt) stateEl.value = opt.value;
    }

    // Limpia errores visuales si los tenías
    try {
      clearFieldError(address1);
      if (postalEl) clearFieldError(postalEl);
      if (cityEl) clearFieldError(cityEl);
      if (stateEl) clearFieldError(stateEl);
    } catch {}
  });
}



})();
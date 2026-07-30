(() => {
  'use strict';

  const LS_EMAIL = 'pp_checkout_email';
  const LS_SHIP_MODE = 'pp_checkout_shipping';// 'home' | 'store'
  const LS_SHIP_DETAILS = 'pp_checkout_shipping_details';
    const LS_GIFT_ON = 'pp_checkout_isGift';
  const LS_INVOICE_ON = 'pp_checkout_invoiceWanted';
  const LS_STEP = 'pp_checkout_step'; // 'nav-js-...'

const PP_CHECKOUT_SESSION_ENDPOINT = '/api/create-checkout-session';
const PP_CART_SUMMARY_ENDPOINT = '/api/cart-summary';
const PP_DISCOUNT_VALIDATE_ENDPOINT = '/api/discount/validate';

const LS_ORDER_DRAFT_ID = 'pp_checkout_order_draft_id';

const LS_TRIBE_CODE = 'pp_checkout_tribe_code';
const LS_CHECKOUT_MODE = 'pp_checkout_mode';
const LS_GUEST_ACCOUNT_INTENT = 'pp_checkout_guest_account_intent';

let ppSecureCartSummary = null; let checkoutAuthMode = 'email'; let checkoutAwaitingVerification = false; let pendingVerificationEmail = ''; let pendingVerificationPassword = '';
  // Función para formatear el dinero
  const money = (n = 0) => {
    try {
      return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
    }
    catch {
      return `${(+n).toFixed(2)} €`;
    }
  };

/*
 * El carrito global es la única fuente de verdad.
 * checkout.js no debe conocer ni construir claves
 * pp_cart_v3 directamente.
 */
const loadCart = () => {
  try {
    const cart =
      window.ppCart?.read?.();

    return Array.isArray(cart)
      ? cart
      : [];
  } catch (error) {
    console.error(
      '[checkout] No se pudo leer el carrito global:',
      error
    );

    return [];
  }
};

const saveCart = (cart) => {
  ppSecureCartSummary = null;

  const safeCart =
    Array.isArray(cart)
      ? cart
      : [];

  if (
    !window.ppCart ||
    typeof window.ppCart.write !== 'function'
  ) {
    throw new Error(
      'El carrito global todavía no está disponible.'
    );
  }

  window.ppCart.write(safeCart);
};
const sum = () => {
  if (ppSecureCartSummary && Number.isFinite(Number(ppSecureCartSummary.subtotal))) {
    return Number(ppSecureCartSummary.subtotal);
  }

  return 0;
};
function waitForCheckoutCart(
  timeoutMs = 5000
) {
  const existingCart =
    window.ppCart;

  const alreadyReady =
    existingCart &&
    typeof existingCart.read === 'function' &&
    typeof existingCart.write === 'function' &&
    (
      typeof existingCart.isScopeResolved !==
        'function' ||
      existingCart.isScopeResolved()
    );

  if (alreadyReady) {
    return Promise.resolve(existingCart);
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = () => {
      if (settled) return;

      const cart =
        window.ppCart;

      const ready =
        cart &&
        typeof cart.read === 'function' &&
        typeof cart.write === 'function' &&
        (
          typeof cart.isScopeResolved !==
            'function' ||
          cart.isScopeResolved()
        );

      if (!ready) {
        return;
      }

      settled = true;

      window.removeEventListener(
        'pp:cart-scope-changed',
        onCartScopeChanged
      );

      window.clearTimeout(timeoutId);

      resolve(cart);
    };

    const onCartScopeChanged = () => {
      finish();
    };

    window.addEventListener(
      'pp:cart-scope-changed',
      onCartScopeChanged
    );

    const timeoutId =
      window.setTimeout(() => {
        if (settled) return;

        settled = true;

        window.removeEventListener(
          'pp:cart-scope-changed',
          onCartScopeChanged
        );

        reject(
          new Error(
            'El carrito no terminó de inicializarse.'
          )
        );
      }, timeoutMs);

    finish();
  });
}
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
  back: $('#goBack'),
logoutBtn: $('#ckLogout'),

// Forms
detailsForm: $('#ckDetailsForm'),
passwordForm: $('#ckPasswordForm'),
registerForm: $('#ckRegisterForm'),
shippingForm: $('#ckShippingForm'),
emailInput: $('#ckEmail'),
passwordInput: $('#ckPassword'),
registerEmailInput: $('#ckRegisterEmail'),
guestContinue: $('#ckGuestContinue'),
guestStatus: $('#ckGuestStatus'),
guestAccountOffer: $('#ckGuestAccountOffer'),
guestPasswordInput: $('#ckGuestPassword'),
guestCreateAccountInput: $('#ckGuestCreateAccount'),

// UI Auth
detailsSummary: $('#ckDetailsSummary'),
authGuest: $('#ckAuthGuest'),
authChoice: $('#ckAuthChoice'),
authTitle: $('#ckAuthTitle'),
authIntroText: $('#ckAuthIntroText'),
newUserSummary: $('#ckNewUserSummary'),
newUserEmail: $('#ckNewUserEmail'),
useOtherEmail: $('#ckUseOtherEmail'),
guestCheckout: $('#ckGuestCheckout'),
accessEmail: $('#ckAccessEmail'),
passwordEmail: $('#ckPasswordEmail'),
currentAccountEmail: $('#ckCurrentAccountEmail'),
chooseLogin: $('#ckChooseLogin'),
chooseRegister: $('#ckChooseRegister'),
passwordBack: $('#ckPasswordBack'),
useCurrentAccount: $('#ckUseCurrentAccount'),
conflictSignOut: $('#ckConflictSignOut'),
resetButtons: $$('[data-ck-reset-password]'),

authModeButtons: $$(
  '[data-ck-auth-mode]'
),

authPanels: $$(
  '[data-ck-auth-panel]'
),

verifyPanel: $('#ckVerifyPanel'),
verifyEmail: $('#ckVerifyEmail'),

loginStatus: $('#ckLoginStatus'),
choiceStatus: $('#ckChoiceStatus'),
passwordStatus: $('#ckPasswordStatus'),
registerStatus: $('#ckRegisterStatus'),
verifyStatus: $('#ckVerifyStatus'),

loginSubmit: $('#ckLoginSubmit'),
passwordSubmit: $('#ckPasswordSubmit'),
registerSubmit: $('#ckRegisterSubmit'),

verifyNow: $('#ckVerifyNow'),
verifyResend: $('#ckVerifyResend'),
verifyBack: $('#ckVerifyBack'),

shippingLoginSummary: $(
  '#ckShippingLoginSummary'
),

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

 function getVerifiedCheckoutUser() { const user = window.__ppAuthCurrentUser || window.__ppLastUser || window.__ppFirebaseAuth?.currentUser || null; if ( !user?.uid || !user?.email ) { return null; } /* * Las cuentas email/password deben verificar * el correo antes de acceder a Envío. */ if ( user.emailVerified === false ) { return null; } return user; }
function enableTabs() {
  const E = els();
  const hasCheckoutIdentity = Boolean(getVerifiedCheckoutUser() || isGuestCheckout());
  const hasShip = hasCheckoutIdentity && Boolean(localStorage.getItem(LS_SHIP_DETAILS));
  enableTab(E.tabDetails, loadCart().length > 0);
  enableTab(E.tabShipping, hasCheckoutIdentity);
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

  updateGuestAccountOfferVisibility(on && isGuestCheckout());
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
    try { localStorage.removeItem(LS_SHIP_MODE); } catch {}

    const E2 = els();
    E2.shippingRadios?.forEach(r => (r.checked = false));

    applyShippingMode('');
    hideShippingSummaryAndShowForm();

    if (isGuestCheckout()) {
      prepareGuestShippingForm();
    } else {
      setTimeout(() => { ppMaybeApplyDefaultAddress(); }, 160);
    }
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
  hasShip  ? 'nav-js-shipping-checkoutnc' :
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


function shippingEstimateLabel(rate = {}) {
  const estimate = rate.deliveryEstimate || {};
  if (typeof estimate === 'string' && estimate.trim()) return estimate.trim();
  if (estimate.label) return String(estimate.label).trim();
  const min = Number.isInteger(estimate.minBusinessDays) ? estimate.minBusinessDays : null;
  const max = Number.isInteger(estimate.maxBusinessDays) ? estimate.maxBusinessDays : null;
  if (min !== null && max !== null) return `${min}–${max} días laborables`;
  if (min !== null) return `Desde ${min} días laborables`;
  if (max !== null) return `Hasta ${max} días laborables`;
  return 'Plazo pendiente de confirmación';
}

function shippingAmountLabel(summary = {}) {
  const shipping = summary.shipping;
  if (summary.shippingStatus === 'selected') {
    if (Number(shipping) > 0) return money(shipping);
    if (Number(shipping) === 0 && summary.shippingRate?.freeShippingApplied === true) return 'Gratis';
  }
  if (summary.shippingStatus === 'not_required') return 'No requiere envío';
  if (summary.shippingStatus === 'unavailable') return 'No disponible';
  if (summary.shippingStatus === 'selection_required') return 'Selecciona una opción';
  return 'Calculado en checkout';
}

function isShippingReady(summary = {}) {
  return summary.shippingStatus === 'selected' || summary.shippingStatus === 'not_required';
}

function renderShippingOptions(summary = {}) {
  const wrap = document.getElementById('ckShippingOptions');
  const list = document.getElementById('ckShippingOptionsList');
  const status = document.getElementById('ckShippingOptionsStatus');
  if (!wrap || !list || !status) return;

  const options = Array.isArray(summary.shippingOptions) ? summary.shippingOptions : [];
  const selectedId = String(summary.shippingRate?.shippingRateId || '').trim();
  status.classList.remove('is-error');
  list.innerHTML = '';

  const messages = {
    address_required: 'Introduce tu dirección para ver las opciones de envío.',
    invalid_address: 'Revisa el país y el código postal para calcular el envío.',
    unavailable: 'Actualmente no disponemos de un servicio de envío para esta dirección.',
    selection_required: 'Selecciona el nivel de servicio que prefieras.',
    selected: 'Opción de envío validada por el servidor.',
    not_required: 'Este pedido no requiere transporte.'
  };
  status.textContent = messages[summary.shippingStatus] || messages.address_required;
  status.classList.toggle(
    'is-error',
    summary.shippingStatus === 'invalid_address' || summary.shippingStatus === 'unavailable'
  );

  if (!options.length) return;

  list.innerHTML = `
    <fieldset>
      <legend>Nivel de servicio</legend>
      ${options.map((option) => {
        const id = String(option.id || '');
        const inputId = `ckShippingRate-${id.replace(/[^a-z0-9_-]/gi, '-')}`;
        const checked = id === selectedId ? ' checked' : '';
        const price = Number(option.amountCents) === 0 && option.freeShippingApplied === true
          ? 'Gratis'
          : money(Number(option.amountCents || 0) / 100);
        return `
          <label class="ck-shipping-rate" for="${escapeHtml(inputId)}">
            <input id="${escapeHtml(inputId)}" type="radio" name="shippingRateId" value="${escapeHtml(id)}"${checked}>
            <span class="ck-shipping-rate__copy">
              <span class="ck-shipping-rate__name">${escapeHtml(option.displayName || option.serviceLevel || 'Envío')}</span>
              <span class="ck-shipping-rate__estimate">${escapeHtml(shippingEstimateLabel(option))}</span>
            </span>
            <span class="ck-shipping-rate__price">${escapeHtml(price)}</span>
          </label>
        `;
      }).join('')}
    </fieldset>
  `;

  list.querySelectorAll('input[name="shippingRateId"]').forEach((input) => {
    input.addEventListener('change', async () => {
      const option = options.find((candidate) => candidate.id === input.value);
      const details = safeJsonParse(localStorage.getItem(LS_SHIP_DETAILS), null);
      if (!option || !details) return;

      localStorage.setItem(LS_SHIP_DETAILS, JSON.stringify({
        ...details,
        shippingRateId: option.id,
        serviceLevel: option.serviceLevel
      }));
      ppSecureCartSummary = null;
      wrap.setAttribute('aria-busy', 'true');
      try {
        await renderCart();
      } finally {
        wrap.setAttribute('aria-busy', 'false');
      }
    });
  });
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
    renderShippingOptions({ shippingStatus: 'address_required', shippingOptions: [] });
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
    renderShippingOptions(summary);
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
const totalLabel = summary.total === null ? 'Pendiente' : money(summary.total);

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
  if (E.total) E.total.textContent = totalLabel;
  if (E.sideSubtotal) E.sideSubtotal.textContent = money(subtotal);
  if (E.sideTotal) E.sideTotal.textContent = totalLabel;

if (E.sideShipping) {
  E.sideShipping.textContent = shippingAmountLabel(summary);
}

const shippingCost = document.getElementById('ckShippingCost');
if (shippingCost) {
  shippingCost.textContent = shippingAmountLabel(summary);
}

renderShippingPrivilegeLine(summary);
renderShippingOptions(summary);
if (!isShippingReady(summary)) enablePayment(false);
}
function renderDetailsSummary(email, options = {}) {
  const E = els();
  const isGuest = Boolean(options.guest || isGuestCheckout());
  if (!E.detailsSummary) return;
  if (!email) {
    E.detailsSummary.classList.add('d-none');
    E.detailsSummary.setAttribute('aria-hidden', 'true');
    E.detailsSummary.innerHTML = '';
    return;
  }
  E.detailsSummary.innerHTML = `
    <div class="ck-summaryCard">
      <div class="ck-summaryCard__head">
        <strong>${isGuest ? 'Compra como invitado' : 'Sesión iniciada'}</strong>
        <button type="button" class="ck-link ck-link--muted" id="ckDetailsEditLogin">Cambiar</button>
      </div>
      <div class="ck-summaryCard__email">${escapeHtml(email)}</div>
      ${isGuest ? '<div class="ck-summaryCard__note">Podrás crear cuenta más adelante si quieres conservar tus datos para futuras compras.</div>' : ''}
    </div>
    <div class="ck-summaryCard__action"><button type="button" class="ck-primary" id="ckDetailsContinue">CONTINUAR</button></div>
  `;
  E.detailsSummary.classList.remove('d-none');
  E.detailsSummary.setAttribute('aria-hidden', 'false');
  document.getElementById('ckDetailsEditLogin')?.addEventListener('click', () => {
    if (isGuest) {
      clearGuestCheckoutState({ keepEmail: false });
      renderDetailsSummary('');
      E.authGuest?.classList.remove('d-none');
      E.authGuest?.setAttribute('aria-hidden', 'false');
      setCheckoutAuthMode('email', { focus: false });
      enableShipping(false);
      enablePayment(false);
      enableTabs();
      return;
    }
    E.logoutBtn?.click();
  });
  document.getElementById('ckDetailsContinue')?.addEventListener('click', () => {
    if (isGuest) prepareGuestShippingForm();
    enableShipping(true);
    enableTabs();
    setTab('nav-js-shipping-checkoutnc');
  });
}

function renderShippingLoginSummary(email, options = {}) {
  const E = els();
  const isGuest = Boolean(options.guest || isGuestCheckout());
  if (!E.shippingLoginSummary) return;
  if (!email) { E.shippingLoginSummary.innerHTML = ''; return; }
  E.shippingLoginSummary.innerHTML = `
    <div class="ck-summaryCard" style="border:1px solid rgba(0,0,0,.18); padding:18px; margin:0 0 18px;">
      <div style="display:flex; justify-content:space-between; gap:12px;">
        <strong>${isGuest ? 'Compra como invitado' : 'Detalles de inicio de sesión'}</strong>
        <button type="button" class="ck-link ck-link--muted" id="ckShipLogoutTop">${isGuest ? 'Cambiar email' : 'Cerrar sesión'}</button>
      </div>
      <div style="margin-top:8px; opacity:.8;">${escapeHtml(email)}</div>
    </div>`;
  document.getElementById('ckShipLogoutTop')?.addEventListener('click', () => {
    if (isGuest) {
      clearGuestCheckoutState({ keepEmail: false });
      setTab('nav-js-details-checkoutnc');
      syncUIFromStorage();
      return;
    }
    document.getElementById('ckLogout')?.click();
  });
}

function syncUIFromStorage() {
  const E = els();
  const verifiedUser = getVerifiedCheckoutUser();
  const authResolved = window.__ppAuthStateResolved === true;
  let savedEmail = localStorage.getItem(LS_EMAIL) || '';
  const savedMode = localStorage.getItem(LS_SHIP_MODE) || '';
  let savedShipDetails = localStorage.getItem(LS_SHIP_DETAILS) || '';
  const firebaseEmail = String(verifiedUser?.email || '').trim().toLowerCase();
  if (firebaseEmail && isEmailValid(firebaseEmail)) {
    localStorage.setItem(LS_EMAIL, firebaseEmail);
    localStorage.setItem(LS_CHECKOUT_MODE, 'account');
    localStorage.removeItem(LS_GUEST_ACCOUNT_INTENT);
    savedEmail = firebaseEmail;
  }
  const hasVerifiedSession = Boolean(verifiedUser && savedEmail && firebaseEmail === savedEmail);
  const hasGuestSession = !hasVerifiedSession && isGuestCheckout();
  if (authResolved && !verifiedUser && !hasGuestSession) {
    if (localStorage.getItem(LS_CHECKOUT_MODE) === 'account') {
      localStorage.removeItem(LS_CHECKOUT_MODE);
    }
    localStorage.removeItem(LS_SHIP_MODE);
    localStorage.removeItem(LS_SHIP_DETAILS);
    localStorage.removeItem(LS_GUEST_ACCOUNT_INTENT);
    savedShipDetails = '';
  }
  const hasCheckoutIdentity = Boolean(hasVerifiedSession || hasGuestSession);
  if (E.emailInput) { E.emailInput.disabled = hasVerifiedSession; if (savedEmail) E.emailInput.value = savedEmail; }
  if (E.registerEmailInput && savedEmail && !E.registerEmailInput.value) E.registerEmailInput.value = savedEmail;
  if (hasCheckoutIdentity) {
    checkoutAwaitingVerification = false;
    E.authGuest?.classList.add('d-none');
    E.authGuest?.setAttribute('aria-hidden', 'true');
    renderDetailsSummary(savedEmail, { guest: hasGuestSession });
  } else {
    renderDetailsSummary('');
    E.authGuest?.classList.remove('d-none');
    E.authGuest?.setAttribute('aria-hidden', 'false');
    if (!checkoutAwaitingVerification) setCheckoutAuthMode('email', { focus: false });
  }
  renderShippingLoginSummary(hasCheckoutIdentity ? savedEmail : '', { guest: hasGuestSession });
  if (E.logoutBtn) E.logoutBtn.hidden = !hasVerifiedSession;
  enableShipping(hasCheckoutIdentity);
  enablePayment(hasCheckoutIdentity && Boolean(savedShipDetails));
  enableTabs();
  if (hasGuestSession) prepareGuestShippingForm();
  if (hasCheckoutIdentity && savedShipDetails) {
    let details = null;
    try { details = JSON.parse(savedShipDetails); } catch { details = null; }
    const mode = details?.shippingMethod || savedMode || '';
    if (mode) {
      const radio = document.querySelector(`input[name="shipping"][value="${mode}"]`);
      if (radio) radio.checked = true;
      applyShippingMode(mode);
    }
    if (details) renderShippingSummary(savedEmail, details);
  } else if (hasCheckoutIdentity && savedMode) {
    hideShippingSummaryAndShowForm();
    const radio = document.querySelector(`input[name="shipping"][value="${savedMode}"]`);
    if (radio) radio.checked = true;
    applyShippingMode(savedMode);
  } else {
    E.shippingRadios.forEach((radio) => { radio.checked = false; });
    applyShippingMode('');
  }
  applyGiftToggleUI(localStorage.getItem(LS_GIFT_ON) === '1');
  applyInvoiceToggleUI(localStorage.getItem(LS_INVOICE_ON) === '1');
  const currentMode = localStorage.getItem(LS_SHIP_MODE) || '';
  setHomeOnlyExtrasVisible(hasCheckoutIdentity && currentMode === 'home');
}
// ========================================================= // CHECKOUT · LOGIN, REGISTRO Y VERIFICACIÓN // =========================================================
async function ppLoginWithEmailPass( email, pass ) { const fn = window.ppSignInWithEmailPass; if ( typeof fn !== 'function' ) { throw new Error( 'ppSignInWithEmailPass no disponible.' ); } return fn( email, pass ); }
async function ppRegisterWithEmailPass( email, pass, displayName, profileData ) { const fn = window.ppCreateUserWithEmailPass; if ( typeof fn !== 'function' ) { throw new Error( 'ppCreateUserWithEmailPass no disponible.' ); } return fn( email, pass, displayName, profileData ); }
function setCheckoutAuthStatus( element, message = '', type = '' ) { if (!element) { return; } element.textContent = message; element.classList.remove( 'is-ok', 'is-error', 'is-info' ); if (type) { element.classList.add( type ); } }
function setCheckoutAuthButtonLoading( button, isLoading, loadingText = '' ) { if (!button) { return; } if ( !button.dataset.idleText ) { button.dataset.idleText = button.textContent.trim(); } button.disabled = Boolean(isLoading); button.setAttribute( 'aria-busy', isLoading ? 'true' : 'false' ); button.textContent = isLoading ? loadingText : button.dataset.idleText; }
function setCheckoutAuthMode( mode = 'email', { focus = true } = {} ) {
  const E = els();
  const allowedModes = new Set([ 'email', 'choice', 'login', 'register', 'conflict' ]);
  const safeMode = allowedModes.has(mode) ? mode : 'email';
  checkoutAuthMode = safeMode;
  checkoutAwaitingVerification = false;

  E.authGuest?.classList.remove( 'd-none' );
  E.authGuest?.setAttribute( 'aria-hidden', 'false' );
  E.authChoice?.classList.remove( 'd-none' );
  E.authChoice?.setAttribute( 'aria-hidden', 'false' );
  E.authChoice?.classList.toggle( 'is-email-step', safeMode === 'email' );
  E.authChoice?.classList.toggle( 'is-new-user-step', safeMode === 'register' );
  E.authGuest?.setAttribute( 'aria-labelledby', safeMode === 'register' ? 'ckNewUserTitle' : 'ckAuthTitle' );
  E.verifyPanel?.classList.add( 'd-none' );
  E.verifyPanel?.setAttribute( 'aria-hidden', 'true' );

  E.authModeButtons.forEach( button => {
    const active = button.dataset.ckAuthMode === safeMode;
    button.classList.toggle( 'is-active', active );
    button.setAttribute( 'aria-selected', active ? 'true' : 'false' );
  } );

  E.authPanels.forEach( panel => {
    const active = panel.dataset.ckAuthPanel === safeMode;
    panel.classList.toggle( 'd-none', !active );
    panel.setAttribute( 'aria-hidden', active ? 'false' : 'true' );
  } );

  const headings = {
    email: 'Introduce tu email',
    choice: 'Accede o continúa',
    login: 'Accede a tu cuenta',
    register: 'Nuevo usuario',
    conflict: 'Elige cómo continuar'
  };
  const descriptions = {
    email: 'Usaremos este correo para conservar el progreso del checkout.',
    choice: 'Elige una opción segura para continuar. No confirmamos públicamente si este correo ya está registrado.',
    login: 'Introduce tu contraseña o solicita instrucciones de recuperación.',
    register: 'Crea una cuenta solo si lo deseas, o continúa como invitado sin perder las piezas de tu cesta.',
    conflict: 'La identidad del pedido debe coincidir con la sesión de Firebase.'
  };
  if (E.authTitle) E.authTitle.textContent = headings[safeMode];
  if (E.authIntroText) E.authIntroText.textContent = descriptions[safeMode];

  const email = String( E.registerEmailInput?.value || E.emailInput?.value || '' ).trim().toLowerCase();
  if ( safeMode === 'register' && E.registerEmailInput ) {
    E.registerEmailInput.value = email;
  }
  if ( safeMode === 'email' && E.emailInput && E.registerEmailInput?.value && !E.emailInput.value ) {
    E.emailInput.value = E.registerEmailInput.value.trim().toLowerCase();
  }
  if (E.newUserEmail) {
    E.newUserEmail.textContent = email;
  }
  if (E.accessEmail) E.accessEmail.textContent = email;
  if (E.passwordEmail) E.passwordEmail.textContent = email;
  if (E.newUserSummary) {
    E.newUserSummary.hidden = safeMode !== 'register';
  }
  const showGuest = safeMode === 'choice' || safeMode === 'register';
  E.guestCheckout?.classList.toggle( 'd-none', !showGuest );
  E.guestCheckout?.setAttribute( 'aria-hidden', showGuest ? 'false' : 'true' );

  setCheckoutAuthStatus( E.loginStatus );
  setCheckoutAuthStatus( E.choiceStatus );
  setCheckoutAuthStatus( E.passwordStatus );
  setCheckoutAuthStatus( E.registerStatus );

  if (!focus) { return; }
  requestAnimationFrame(() => {
    const targets = {
      email: E.emailInput,
      choice: E.chooseLogin,
      login: E.passwordInput,
      register: document.getElementById( 'ckRegisterFirstName' ),
      conflict: E.useCurrentAccount
    };
    const target = targets[safeMode];
    target?.focus({ preventScroll: true });
  });
}

function showCheckoutVerification( email ) { const E = els(); const cleanEmail = String(email || '') .trim() .toLowerCase(); checkoutAwaitingVerification = true; E.authGuest?.classList.remove( 'd-none' ); E.authGuest?.setAttribute( 'aria-hidden', 'false' ); E.authChoice?.classList.add( 'd-none' ); E.authChoice?.setAttribute( 'aria-hidden', 'true' ); E.verifyPanel?.classList.remove( 'd-none' ); E.verifyPanel?.setAttribute( 'aria-hidden', 'false' ); if (E.verifyEmail) { E.verifyEmail.textContent = cleanEmail; } setCheckoutAuthStatus( E.verifyStatus, 'Tu cesta sigue guardada mientras verificas la cuenta.', 'is-info' ); requestAnimationFrame(() => { E.verifyNow?.focus({ preventScroll: true }); }); }
function checkoutAuthErrorMessage( error, context = 'login' ) {
  const code = String( error?.code || '' );
  if (code === 'auth/invalid-email') return 'Introduce un correo electrónico válido.';
  if (code === 'auth/weak-password') return 'La contraseña debe tener al menos 8 caracteres.';
  return context === 'register'
    ? 'No se ha podido crear la cuenta. Puedes probar a acceder o continuar como invitado.'
    : 'No hemos podido iniciar sesión con esos datos.';
}
function waitForCheckoutCartOwner( expectedOwner, timeoutMs = 3000 ) { const matches = () => { return ( window.ppCart ?.getOwner?.() === expectedOwner ); }; if (matches()) { return Promise.resolve( true ); } return new Promise(resolve => { let settled = false; const finish = result => { if (settled) { return; } settled = true; window.removeEventListener( 'pp:cart-scope-changed', onScopeChanged ); clearTimeout( timeoutId ); resolve( result ); }; const onScopeChanged = () => { if (matches()) { finish(true); } }; window.addEventListener( 'pp:cart-scope-changed', onScopeChanged ); const timeoutId = setTimeout( () => { finish( matches() ); }, timeoutMs ); }); }
async function finishCheckoutAuthentication( credential, email ) { const uid = String( credential?.user?.uid || '' ).trim(); if (uid) { await waitForCheckoutCartOwner( `user:${uid}` ); } pendingVerificationEmail = ''; pendingVerificationPassword = ''; checkoutAwaitingVerification = false; localStorage.setItem( LS_EMAIL, String(email || '') .trim() .toLowerCase() ); localStorage.setItem( LS_CHECKOUT_MODE, 'account' ); localStorage.removeItem( LS_GUEST_ACCOUNT_INTENT ); ppSecureCartSummary = null; await syncCheckoutAuthFromFirebase({ moveToShipping: true }); syncUIFromStorage(); await renderCart(); }
async function attemptPendingVerification({ resendOnly = false } = {}) { const E = els(); const email = pendingVerificationEmail; const password = pendingVerificationPassword; if ( !email || !password ) { setCheckoutAuthStatus( E.verifyStatus, 'Vuelve al registro e introduce de nuevo tus datos.', 'is-error' ); return; } const activeButton = resendOnly ? E.verifyResend : E.verifyNow; setCheckoutAuthButtonLoading( activeButton, true, resendOnly ? 'REENVIANDO…' : 'COMPROBANDO…' ); try { const credential = await ppLoginWithEmailPass( email, password ); setCheckoutAuthStatus( E.verifyStatus, 'Cuenta verificada. Estamos preparando el envío.', 'is-ok' ); await finishCheckoutAuthentication( credential, email ); } catch (error) { if ( error?.code === 'auth/email-not-verified' ) { setCheckoutAuthStatus( E.verifyStatus, resendOnly ? 'Te hemos enviado un nuevo correo de verificación.' : 'Todavía no aparece como verificado. Revisa el enlace de tu correo.', 'is-info' ); return; } setCheckoutAuthStatus( E.verifyStatus, checkoutAuthErrorMessage( error, 'login' ), 'is-error' ); } finally { setCheckoutAuthButtonLoading( activeButton, false ); } }

async function requestCheckoutPasswordReset(button) {
  const E = els();
  const email = String(E.registerEmailInput?.value || E.emailInput?.value || '').trim().toLowerCase();
  const status = checkoutAuthMode === 'login' ? E.passwordStatus : E.choiceStatus;

  if (!isEmailValid(email)) {
    setCheckoutAuthStatus(status, 'Introduce un correo electrónico válido.', 'is-error');
    setCheckoutAuthMode('email');
    return;
  }

  setCheckoutAuthButtonLoading(button, true, 'ENVIANDO…');
  try {
    const reset = window.ppSendPasswordReset;
    if (typeof reset !== 'function') throw new Error('Recuperación no disponible.');
    await reset(email);
  } catch {
    /* Respuesta deliberadamente neutral para no enumerar cuentas. */
  } finally {
    setCheckoutAuthButtonLoading(button, false);
    setCheckoutAuthStatus(status, 'Si existe una cuenta asociada, recibirás las instrucciones por correo.', 'is-info');
  }
}

function updateCheckoutRegisterButton() {
  const E = els();
  if (!E.registerForm || !E.registerSubmit || E.registerSubmit.getAttribute('aria-busy') === 'true') return;
  const password = String(document.getElementById('ckRegisterPass')?.value || '');
  const confirmation = String(document.getElementById('ckRegisterPassConfirm')?.value || '');
  E.registerSubmit.disabled = !E.registerForm.checkValidity() || password !== confirmation;
}

function initCheckoutAuth() {
  const E = els();
  if ( !E.authGuest || E.authGuest.__ppCheckoutAuthBound ) { return; }
  E.authGuest.__ppCheckoutAuthBound = true;

  E.authModeButtons.forEach( button => {
    button.addEventListener( 'click', () => { setCheckoutAuthMode( button.dataset.ckAuthMode ); } );
  } );

  E.detailsForm?.addEventListener( 'submit', async event => {
    event.preventDefault();
    const email = E.emailInput?.value?.trim().toLowerCase() || '';
    setCheckoutAuthStatus( E.loginStatus );
    if ( !isEmailValid(email) ) {
      setFieldError( E.emailInput, 'Introduce un email válido' );
      E.emailInput?.focus();
      return;
    }
    clearFieldError( E.emailInput );
    const currentUser = await waitForCheckoutFirebaseUser();
    const currentEmail = String(currentUser?.email || '').trim().toLowerCase();
    if (currentUser?.uid && currentUser.emailVerified !== false && currentEmail) {
      if (email !== currentEmail) {
        if (E.currentAccountEmail) E.currentAccountEmail.textContent = currentEmail;
        localStorage.setItem(LS_EMAIL, email);
        setCheckoutAuthMode('conflict');
        return;
      }
      await syncCheckoutAuthFromFirebase({ moveToShipping: true });
      return;
    }
    localStorage.setItem(LS_EMAIL, email);
    if (E.registerEmailInput) { E.registerEmailInput.value = email; }
    if (E.newUserEmail) { E.newUserEmail.textContent = email; }
    setCheckoutAuthMode( 'choice' );
  } );

  E.chooseLogin?.addEventListener('click', () => { setCheckoutAuthMode('login'); });
  E.chooseRegister?.addEventListener('click', () => { setCheckoutAuthMode('register'); });
  E.passwordBack?.addEventListener('click', () => { setCheckoutAuthMode('choice'); });

  E.passwordForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const email = String(E.registerEmailInput?.value || E.emailInput?.value || '').trim().toLowerCase();
    const password = String(E.passwordInput?.value || '');
    setCheckoutAuthStatus(E.passwordStatus);
    if (!isEmailValid(email) || !password) {
      setCheckoutAuthStatus(E.passwordStatus, 'Introduce el correo y la contraseña.', 'is-error');
      E.passwordInput?.focus();
      return;
    }

    setCheckoutAuthButtonLoading(E.passwordSubmit, true, 'ACCEDIENDO…');
    let authenticated = false;
    try {
      const credential = await ppLoginWithEmailPass(email, password);
      await finishCheckoutAuthentication(credential, email);
      authenticated = true;
    } catch (error) {
      setCheckoutAuthStatus(E.passwordStatus, checkoutAuthErrorMessage(error, 'login'), 'is-error');
    } finally {
      setCheckoutAuthButtonLoading(E.passwordSubmit, false);
      if (!authenticated) E.passwordInput?.focus({ preventScroll: true });
    }
  });

  E.resetButtons.forEach(button => {
    button.addEventListener('click', () => { requestCheckoutPasswordReset(button); });
  });

  E.useCurrentAccount?.addEventListener('click', async () => {
    await syncCheckoutAuthFromFirebase({ moveToShipping: true });
  });

  E.conflictSignOut?.addEventListener('click', async () => {
    const cartSnapshot = loadCart().map(item => ({ ...item }));
    const candidateEmail = String(E.emailInput?.value || '').trim().toLowerCase();
    setCheckoutAuthButtonLoading(E.conflictSignOut, true, 'CERRANDO SESIÓN…');
    try {
      if (typeof window.ppSignOut === 'function') await window.ppSignOut();
      await waitForCheckoutCartOwner('guest');
      if (cartSnapshot.length) saveCart(cartSnapshot);
      localStorage.setItem(LS_EMAIL, candidateEmail);
      localStorage.removeItem(LS_CHECKOUT_MODE);
      syncUIFromStorage();
      setCheckoutAuthMode('choice');
    } catch (error) {
      setCheckoutAuthStatus(E.loginStatus, 'No se ha podido cerrar la sesión. Inténtalo de nuevo.', 'is-error');
    } finally {
      setCheckoutAuthButtonLoading(E.conflictSignOut, false);
    }
  });

  E.useOtherEmail?.addEventListener( 'click', () => {
    localStorage.removeItem( LS_EMAIL );
    localStorage.removeItem( LS_CHECKOUT_MODE );
    localStorage.removeItem( LS_GUEST_ACCOUNT_INTENT );
    if (E.registerEmailInput) { E.registerEmailInput.value = ''; }
    if (E.emailInput) {
      E.emailInput.disabled = false;
      E.emailInput.value = '';
      E.emailInput.classList.remove( 'is-invalid' );
      clearFieldError( E.emailInput );
    }
    setCheckoutAuthMode( 'email' );
  } );

  E.registerForm?.addEventListener( 'submit', async event => {
    event.preventDefault();
    const firstName = String( document.getElementById( 'ckRegisterFirstName' )?.value || '' ).trim();
    const lastName = String( document.getElementById( 'ckRegisterLastName' )?.value || '' ).trim();
    const email = String( E.registerEmailInput?.value || E.emailInput?.value || '' ).trim().toLowerCase();
    const passwordInput = document.getElementById( 'ckRegisterPass' );
    const confirmationInput = document.getElementById( 'ckRegisterPassConfirm' );
    const password = String( passwordInput?.value || '' );
    const confirmation = String( confirmationInput?.value || '' );
    const termsInput = document.getElementById( 'ckRegisterTerms' );
    const newsletterInput = document.getElementById( 'ckRegisterNewsletter' );

    setCheckoutAuthStatus( E.registerStatus );
    if ( !firstName ) { setFieldError( document.getElementById( 'ckRegisterFirstName' ), 'Introduce tu nombre' ); return; }
    if ( !lastName ) { setFieldError( document.getElementById( 'ckRegisterLastName' ), 'Introduce tus apellidos' ); return; }
    if ( !isEmailValid(email) ) {
      setCheckoutAuthStatus( E.registerStatus, 'Vuelve al paso anterior e introduce un email válido.', 'is-error' );
      setCheckoutAuthMode( 'email' );
      return;
    }
    if ( password.length < 8 ) { setFieldError( passwordInput, 'Usa al menos 8 caracteres' ); passwordInput?.focus(); return; }
    if ( password !== confirmation ) { setFieldError( confirmationInput, 'Las contraseñas no coinciden' ); confirmationInput?.focus(); return; }
    if ( !termsInput?.checked ) {
      setCheckoutAuthStatus( E.registerStatus, 'Debes aceptar los términos y la política de privacidad.', 'is-error' );
      termsInput?.focus();
      return;
    }

    setCheckoutAuthButtonLoading( E.registerSubmit, true, 'CREANDO CUENTA...' );
    try {
      await ppRegisterWithEmailPass( email, password, `${firstName} ${lastName}`.trim(), {
        firstName,
        lastName,
        newsletter: Boolean( newsletterInput?.checked ),
        termsAccepted: true
      } );
      pendingVerificationEmail = email;
      pendingVerificationPassword = password;
      showCheckoutVerification( email );
      setCheckoutAuthStatus( E.verifyStatus, 'Cuenta creada. Abre el enlace que acabamos de enviarte.', 'is-ok' );
    } catch (error) {
      setCheckoutAuthStatus( E.registerStatus, checkoutAuthErrorMessage( error, 'register' ), 'is-error' );
      if ( error?.code === 'auth/email-already-in-use' ) {
        setCheckoutAuthMode('login');
        setCheckoutAuthStatus(E.passwordStatus, 'No se ha podido crear la cuenta con ese correo. Puedes intentar acceder, recuperar la contraseña o continuar como invitado.', 'is-info');
      }
    } finally {
      setCheckoutAuthButtonLoading( E.registerSubmit, false );
      updateCheckoutRegisterButton();
    }
  } );

  E.registerForm?.addEventListener('input', updateCheckoutRegisterButton);
  E.registerForm?.addEventListener('change', updateCheckoutRegisterButton);

  E.verifyNow?.addEventListener( 'click', () => { attemptPendingVerification(); } );
  E.verifyResend?.addEventListener( 'click', () => { attemptPendingVerification({ resendOnly: true }); } );
  E.verifyBack?.addEventListener( 'click', () => { setCheckoutAuthMode( 'register' ); } );
  E.guestContinue?.addEventListener( 'click', () => { continueCheckoutAsGuest(); } );

  E.emailInput && (E.emailInput.disabled = true);
  E.loginSubmit && (E.loginSubmit.disabled = true);
  E.authGuest.setAttribute('aria-busy', 'true');
  waitForCheckoutFirebaseUser().then(user => {
    if (user?.uid && user.emailVerified !== false) {
      return syncCheckoutAuthFromFirebase();
    }
    E.emailInput && (E.emailInput.disabled = false);
    E.loginSubmit && (E.loginSubmit.disabled = false);
    setCheckoutAuthMode(checkoutAuthMode, { focus: false });
    return false;
  }).finally(() => {
    E.authGuest?.setAttribute('aria-busy', 'false');
  });
  updateCheckoutRegisterButton();
}

// ========================================================= // CHECKOUT · CERRAR SESIÓN // ========================================================= const logoutEl = document.getElementById( 'ckLogout' ); logoutEl?.addEventListener( 'click', async event => { event.preventDefault(); const E = els(); try { if ( typeof window.ppSignOut === 'function' ) { await window.ppSignOut(); } } catch (error) { console.warn( '[checkout] No se pudo cerrar la sesión Firebase:', error ); } localStorage.removeItem( LS_EMAIL ); localStorage.removeItem( LS_SHIP_MODE ); localStorage.removeItem( LS_SHIP_DETAILS ); localStorage.removeItem( LS_TRIBE_CODE ); localStorage.removeItem( LS_CHECKOUT_MODE ); localStorage.removeItem( LS_GUEST_ACCOUNT_INTENT ); ppSecureCartSummary = null; pendingVerificationEmail = ''; pendingVerificationPassword = ''; checkoutAwaitingVerification = false; setCheckoutAuthMode( 'email', { focus: false } ); if (E.emailInput) { E.emailInput.disabled = false; E.emailInput.value = ''; E.emailInput.classList.remove( 'is-invalid' ); } if (E.logoutBtn) { E.logoutBtn.hidden = true; } applyShippingMode(''); enableShipping(false); enablePayment(false); setTab( 'nav-js-details-checkoutnc' ); syncUIFromStorage(); } );
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
  localStorage.removeItem(LS_CHECKOUT_MODE);
  localStorage.removeItem(LS_GUEST_ACCOUNT_INTENT);
  }

  ppSecureCartSummary = null;
}

function getCheckoutEmail() {
  return String(localStorage.getItem(LS_EMAIL) || '').trim().toLowerCase();
}
function isGuestCheckout() {
  const mode = String(localStorage.getItem(LS_CHECKOUT_MODE) || '').trim();
  const email = getCheckoutEmail();
  return mode === 'guest' && isEmailValid(email) && !getVerifiedCheckoutUser();
}

function prepareGuestShippingForm() {
  const select = document.getElementById('ckShipAddressList') || document.querySelector('select[name="ship_addressList"]');
  if (!select || !isGuestCheckout()) return;
  select.innerHTML = '<option value="new" selected>Introducir dirección para este pedido</option>';
  select.value = 'new';
}

function updateGuestAccountOfferVisibility(show = false) {
  const E = els();
  const on = Boolean(show && isGuestCheckout());
  if (!E.guestAccountOffer) return;
  E.guestAccountOffer.classList.toggle('d-none', !on);
  E.guestAccountOffer.setAttribute('aria-hidden', on ? 'false' : 'true');
  setDisabledInside(E.guestAccountOffer, !on);
  if (!on) {
    if (E.guestPasswordInput) E.guestPasswordInput.value = '';
    if (E.guestCreateAccountInput) E.guestCreateAccountInput.checked = false;
  }
}

function getGuestCandidateEmail() {
  const E = els();
  const activePanel = document.querySelector('[data-ck-auth-panel]:not(.d-none)');
  const panelEmail = activePanel?.querySelector('input[type="email"]')?.value || '';
  return String(panelEmail || E.registerEmailInput?.value || E.emailInput?.value || '').trim().toLowerCase();
}

function getGuestAccountIntent() {
  const parsed = safeJsonParse(localStorage.getItem(LS_GUEST_ACCOUNT_INTENT) || '', null);
  if (!parsed || !isGuestCheckout()) return null;
  return { wantsAccount: Boolean(parsed.wantsAccount), passwordProvided: Boolean(parsed.passwordProvided) };
}

function collectGuestAccountIntent() {
  if (!isGuestCheckout()) {
    localStorage.removeItem(LS_GUEST_ACCOUNT_INTENT);
    return { ok: true, intent: null };
  }
  const E = els();
  const password = String(E.guestPasswordInput?.value || '');
  const wantsAccount = Boolean(E.guestCreateAccountInput?.checked || password);
  if (password && password.length < 8) {
    return { ok: false, field: E.guestPasswordInput, message: 'Usa al menos 8 caracteres.' };
  }
  if (!wantsAccount) {
    localStorage.removeItem(LS_GUEST_ACCOUNT_INTENT);
    return { ok: true, intent: null };
  }
  const intent = { wantsAccount: true, passwordProvided: Boolean(password), createdAt: new Date().toISOString() };
  localStorage.setItem(LS_GUEST_ACCOUNT_INTENT, JSON.stringify(intent));
  return { ok: true, intent };
}

function clearGuestCheckoutState({ keepEmail = false } = {}) {
  localStorage.removeItem(LS_CHECKOUT_MODE);
  localStorage.removeItem(LS_GUEST_ACCOUNT_INTENT);
  localStorage.removeItem(LS_TRIBE_CODE);
  if (!keepEmail) {
    localStorage.removeItem(LS_EMAIL);
    localStorage.removeItem(LS_SHIP_MODE);
    localStorage.removeItem(LS_SHIP_DETAILS);
  }
  ppSecureCartSummary = null;
  updateGuestAccountOfferVisibility(false);
}

async function continueCheckoutAsGuest() {
  const E = els();
  const email = getGuestCandidateEmail();
  const targetInput = checkoutAuthMode === 'register' ? E.registerEmailInput : E.emailInput;
  setCheckoutAuthStatus(E.guestStatus);
  if (!isEmailValid(email)) {
    setFieldError(targetInput || E.emailInput || E.registerEmailInput, 'Introduce un email válido');
    setCheckoutAuthStatus(E.guestStatus, 'Introduce un email válido para recibir la confirmación del pedido.', 'is-error');
    targetInput?.focus?.();
    return;
  }
  localStorage.setItem(LS_EMAIL, email);
  localStorage.setItem(LS_CHECKOUT_MODE, 'guest');
  localStorage.removeItem(LS_SHIP_DETAILS);
  localStorage.removeItem(LS_TRIBE_CODE);
  localStorage.removeItem(LS_GUEST_ACCOUNT_INTENT);
  ppSecureCartSummary = null;
  if (E.emailInput) E.emailInput.value = email;
  if (E.registerEmailInput) E.registerEmailInput.value = email;
  E.authGuest?.classList.add('d-none');
  E.authGuest?.setAttribute('aria-hidden', 'true');
  prepareGuestShippingForm();
  renderDetailsSummary(email, { guest: true });
  renderShippingLoginSummary(email, { guest: true });
  enableShipping(true);
  enableTabs();
  setTab('nav-js-shipping-checkoutnc');
  try { await renderCart(); } catch (error) { console.error('[checkout] renderCart invitado falló:', error); }
}
async function waitForCheckoutFirebaseUser(timeoutMs = 4000) {
  try {
    await window.__ppFirebaseAuthReady;
  } catch {}

  const current = () => (
    window.__ppAuthCurrentUser ||
    window.__ppLastUser ||
    window.__ppFirebaseAuth?.currentUser ||
    null
  );

  if (window.__ppAuthStateResolved === true) {
    const user = current();
    return user?.getIdToken ? user : null;
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId;

    const finish = (user = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      window.removeEventListener('pp:auth-changed', onAuthChanged);
      resolve(user?.getIdToken ? user : null);
    };

    const onAuthChanged = (event) => {
      finish(event.detail?.user || null);
    };

    window.addEventListener('pp:auth-changed', onAuthChanged, { once: true });
    window.__ppAuthInitialState?.then?.(finish, () => finish(null));

    timeoutId = window.setTimeout(() => {
      finish(current());
    }, timeoutMs);
  });
}
/* =========================================================
   CHECKOUT · Auth auto-sync
   Si el usuario ya está logado en Prophetia, el paso 2 no pide credenciales
   ========================================================= */

async function syncCheckoutAuthFromFirebase({ moveToShipping = false } = {}) { const E = els(); const user = await waitForCheckoutFirebaseUser( 2600 ); const email = String( user?.email || '' ) .trim() .toLowerCase(); if ( !user?.uid || user.emailVerified === false || !email || !isEmailValid(email) ) { return false; } localStorage.setItem( LS_EMAIL, email ); localStorage.setItem( LS_CHECKOUT_MODE, 'account' ); localStorage.removeItem( LS_GUEST_ACCOUNT_INTENT ); ppSecureCartSummary = null; if (E.emailInput) { E.emailInput.value = email; E.emailInput.disabled = true; E.emailInput.classList.remove( 'is-invalid' ); } const passEl = document.getElementById( 'ckPass' ); if (passEl) { passEl.value = ''; clearFieldError( passEl ); } E.authGuest?.classList.add( 'd-none' ); E.authGuest?.setAttribute( 'aria-hidden', 'true' ); renderDetailsSummary( email ); renderShippingLoginSummary( email ); if (E.logoutBtn) { E.logoutBtn.hidden = false; } enableShipping(true); enableTabs(); if (moveToShipping) { setTab( 'nav-js-shipping-checkoutnc' ); setTimeout( () => { ppMaybeApplyDefaultAddress(); }, 250 ); } return true; }
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

  if (rate.freeShippingApplied !== true) return '';
  return 'Envío gratuito aplicado por una regla validada por el servidor.';
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

  if (isGuestCheckout()) {
    setAppliedTribeCode('');
    setTribeMessage('Los códigos Prophetia Tribe requieren iniciar sesión con tu cuenta.', 'is-error');
    await renderCart();
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
  const giftCheckbox =
    document.getElementById('ppIsGift') ||
    document.querySelector('input[name="isGift"]');

  const giftPanel = document.getElementById('ppGiftMessage');

  const giftMessageEl =
    document.getElementById('ppGiftMessageText') ||
    giftPanel?.querySelector('textarea') ||
    document.querySelector('textarea[name="giftMessage"]') ||
    document.querySelector('[name="giftMessage"]');

  const isGift = !!giftCheckbox?.checked;

  const message = isGift
    ? String(giftMessageEl?.value || '')
        .replace(/<[^>]*>/g, '')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .slice(0, 250)
    : '';

  return {
    isGift,
    message
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
      cut: item.cut ? String(item.cut).trim() : null,
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
    cut: item.cut ? String(item.cut).trim() : null,
    version: item.version ? String(item.version).trim() : null,
    color: item.color ? String(item.color).trim() : '',
    size: item.size ? String(item.size).trim() : '',
    qty: Math.max(1, Math.min(10, Number(item.qty || 1)))
  })),
  email,
  shippingDetails,
  discountCode: getAppliedTribeCode(),
  gift: getGiftData(),
  invoice: getInvoiceData(),
  checkoutMode: isGuestCheckout() ? 'guest' : 'account',
  guestAccountIntent: getGuestAccountIntent()
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

  if (payload.shippingDetails.shippingMethod !== 'home') {
    return 'El método de entrega seleccionado no está disponible.';
  }

  if (!String(payload.shippingDetails.shippingRateId || '').trim()) {
    return 'Selecciona una opción de envío válida antes de continuar.';
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
function clearCheckoutSensitiveStorage({
  keepCart = false
} = {}) {
  localStorage.removeItem(LS_EMAIL);
  localStorage.removeItem(LS_SHIP_MODE);
  localStorage.removeItem(LS_SHIP_DETAILS);
  localStorage.removeItem(LS_GIFT_ON);
  localStorage.removeItem(LS_INVOICE_ON);
  localStorage.removeItem(LS_STEP);
  localStorage.removeItem(LS_ORDER_DRAFT_ID);
  localStorage.removeItem(LS_TRIBE_CODE);
  localStorage.removeItem(LS_CHECKOUT_MODE);
  localStorage.removeItem(LS_GUEST_ACCOUNT_INTENT);

  if (!keepCart) {
    window.ppCart?.write?.([]);
  }
}


window.ppClearCheckoutSensitiveStorage = clearCheckoutSensitiveStorage;

// ========= Firestore: dirección predeterminada del usuario =========
let __ppDefaultAddressApplied = false;
let __ppShippingFormTouched = false;
let __ppFirestoreAddresses = [];
let __ppApplyingStoredAddress = false;
let __ppAddressSelectLoadSeq = 0;

function markShippingFormTouched() {
  const form = document.getElementById('ckShippingForm');
  if (!form || form.__ppTouchedBound) return;

  form.__ppTouchedBound = true;

  const shouldIgnoreTouch = (target) => {
    if (__ppApplyingStoredAddress) return true;
    if (!target?.matches?.('input, select, textarea')) return true;

    /*
      No consideramos “edición manual”:
      - elegir Entrega a domicilio / Recogida
      - abrir o cambiar el select de direcciónes guardadas
    */
    if (target.name === 'shipping') return true;
    if (target.name === 'ship_addressList') return true;

    return false;
  };

  const invalidateSelectedRate = (target) => {
    if (!/^ship_(?:address1|address2|postal|state|city|country)$/.test(String(target?.name || ''))) return;
    const details = safeJsonParse(localStorage.getItem(LS_SHIP_DETAILS), null);
    if (!details?.shippingRateId) return;

    const { shippingRateId, serviceLevel, ...addressOnly } = details;
    localStorage.setItem(LS_SHIP_DETAILS, JSON.stringify(addressOnly));
    ppSecureCartSummary = null;
    enablePayment(false);
    renderShippingOptions({ shippingStatus: 'address_required', shippingOptions: [] });
  };

  form.addEventListener('input', (event) => {
    if (!shouldIgnoreTouch(event.target)) {
      __ppShippingFormTouched = true;
      invalidateSelectedRate(event.target);
    }
  });

  form.addEventListener('change', (event) => {
    if (!shouldIgnoreTouch(event.target)) {
      __ppShippingFormTouched = true;
      invalidateSelectedRate(event.target);
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
  if (isGuestCheckout()) {
    return null;
  }

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
async function ppLoadFirestoreAddresses() {
  if (isGuestCheckout()) {
    return [];
  }

  const { auth, db } = await ppGetFirebaseClient();

  if (!db) {
    return [];
  }

  /*
    Esperamos al usuario real de Firebase.
    En checkout, auth.currentUser puede tardar unos ms en estar disponible.
  */
  const user =
    auth?.currentUser ||
    await waitForCheckoutFirebaseUser(3500);

  if (!user?.uid) {
    console.warn('[checkout] No hay usuario Firebase para cargar direcciónes.');
    return [];
  }

  const {
    collection,
    getDocs,
    query,
    orderBy
  } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');

  const ref = collection(db, 'users', user.uid, 'addresses');

  try {
    const q = query(ref, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (error) {
    /*
      Fallback por si alguna dirección antigua no tiene createdAt
      o el índice/orderBy da guerra.
    */
    console.warn('[checkout] Reintentando direcciónes sin orderBy:', error);

    const snap = await getDocs(ref);

    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  }
}

function ppAddressSelectLabel(address = {}) {
  const alias = address.alias ? `${address.alias} · ` : '';
  const line1 = address.line1 || 'Dirección';
  const city = address.city || '';
  const postcode = address.postcode || '';

  return `${alias}${line1}${city ? ` · ${city}` : ''}${postcode ? ` · ${postcode}` : ''}`;
}

function ppGetAddressFromSelectValue(value = '') {
  const id = String(value || '').replace('firestore:', '');

  if (!id) return null;

  return __ppFirestoreAddresses.find((item) => item.id === id) || null;
}

async function ppLoadFirestoreAddressesIntoSelect({ selectDefault = false } = {}) {
  const select = document.getElementById('ckShipAddressList') ||
    document.querySelector('select[name="ship_addressList"]');

  if (!select) return [];

  /*
    Evita carreras async:
    si una carga antigua termina después de una nueva, no pinta nada.
  */
  const requestId = ++__ppAddressSelectLoadSeq;
  const previousValue = select.value;

  const rawAddresses = await ppLoadFirestoreAddresses();

  if (requestId !== __ppAddressSelectLoadSeq) {
    return __ppFirestoreAddresses;
  }

  /*
    Dedupe defensivo por ID.
    Aunque Firestore venga bien, evitamos duplicar opciones en UI.
  */
  const seen = new Set();
  const addresses = rawAddresses.filter((address) => {
    if (!address?.id || seen.has(address.id)) return false;
    seen.add(address.id);
    return true;
  });

  __ppFirestoreAddresses = addresses;

  select.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.hidden = true;
  placeholder.textContent = 'Seleccionar dirección guardada';
  select.appendChild(placeholder);

  addresses.forEach((address) => {
    const opt = document.createElement('option');
    opt.value = `firestore:${address.id}`;
    opt.textContent = ppAddressSelectLabel(address);

    if (address.isDefault) {
      opt.textContent += ' · Predeterminada';
    }

    select.appendChild(opt);
  });

  const newOpt = document.createElement('option');
  newOpt.value = 'new';
  newOpt.textContent = 'Crear una nueva dirección de envío';
  select.appendChild(newOpt);

  const defaultAddress =
    addresses.find((address) => address.isDefault) ||
    (addresses.length === 1 ? addresses[0] : null);

  const values = new Set(
    Array.from(select.options).map((opt) => opt.value)
  );

  if (selectDefault && defaultAddress) {
    select.value = `firestore:${defaultAddress.id}`;
  } else if (previousValue && values.has(previousValue)) {
    select.value = previousValue;
  } else {
    select.value = addresses.length ? '' : 'new';
  }

  return addresses;
}

function ppCheckoutCountryLabel(value = '') {
  const clean = ppNormalizeCheckoutCountryValue(value);

  if (clean === 'pt') return 'Portugal';
  if (clean === 'fr') return 'Francia';

  return 'Espana';
}

function ppBuildFirestoreAddressPayload(details = {}, { isDefault = false, serverTimestamp } = {}) {
  const firstName = String(details.firstName || '').trim();
  const lastName = String(details.lastName || '').trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const now = typeof serverTimestamp === 'function' ? serverTimestamp() : new Date();

  return {
    alias: 'Envio',
    name: fullName,
    phone: String(details.phone || '').trim(),
    line1: String(details.address1 || '').trim(),
    line2: String(details.address2 || '').trim(),
    city: String(details.city || '').trim(),
    postcode: String(details.postalCode || '').trim(),
    province: String(details.state || '').trim(),
    country: ppCheckoutCountryLabel(details.country),
    isDefault: Boolean(isDefault),
    createdAt: now,
    updatedAt: now,
    source: 'checkout'
  };
}

function ppValidateFirestoreAddressPayload(payload = {}) {
  return Boolean(
    payload.name &&
    payload.phone &&
    payload.line1 &&
    payload.city &&
    payload.postcode
  );
}

async function ppSyncDefaultAddressMirror(addressId, payload = {}, firestore = {}) {
  const { db, auth } = await ppGetFirebaseClient();

  if (!db || !auth?.currentUser?.uid || !addressId) {
    return;
  }

  const { doc, setDoc } = firestore;

  if (typeof doc !== 'function' || typeof setDoc !== 'function') {
    return;
  }

  const defaultRef = doc(
    db,
    'users',
    auth.currentUser.uid,
    'private',
    'defaultAddress'
  );

  await setDoc(defaultRef, {
    addressId,
    ...payload,
    syncedAt: payload.updatedAt || new Date()
  }, { merge: true });
}

async function ppSetOnlyDefaultFirestoreAddress(addressId, payload = {}, firestore = {}) {
  const { db, auth } = await ppGetFirebaseClient();

  if (!db || !auth?.currentUser?.uid || !addressId) {
    return;
  }

  const {
    collection,
    doc,
    getDocs,
    writeBatch,
    serverTimestamp
  } = firestore;

  if (
    typeof collection !== 'function' ||
    typeof doc !== 'function' ||
    typeof getDocs !== 'function' ||
    typeof writeBatch !== 'function'
  ) {
    return;
  }

  const ref = collection(db, 'users', auth.currentUser.uid, 'addresses');
  const snap = await getDocs(ref);
  const batch = writeBatch(db);

  snap.forEach((item) => {
    const itemRef = doc(db, 'users', auth.currentUser.uid, 'addresses', item.id);

    batch.update(itemRef, {
      isDefault: item.id === addressId,
      updatedAt: typeof serverTimestamp === 'function' ? serverTimestamp() : new Date()
    });
  });

  await batch.commit();
  await ppSyncDefaultAddressMirror(addressId, payload, firestore);
}

async function ppCompleteFirstAddressMissionFromCheckout() {
  const user = await waitForCheckoutFirebaseUser();

  if (!user?.getIdToken) {
    return null;
  }

  try {
    const token = await user.getIdToken(true);

    const response = await fetch('/api/tribe/mission/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      credentials: 'include',
      body: JSON.stringify({
        missionId: 'first-address'
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn('[checkout] Mision first-address no completada:', data.error || response.status);
      return null;
    }

    window.dispatchEvent(new CustomEvent('pp:tribe-mission-completed', {
      detail: data
    }));

    return data;
  } catch (error) {
    console.warn('[checkout] No se pudo comprobar first-address:', error);
    return null;
  }
}

function ppShowCheckoutAddressNotice(message = '', type = 'info') {
  const panel = document.getElementById('js-shipToMe-checkoutnc');

  if (!panel) return;

  let notice = document.getElementById('ppCheckoutAddressNotice');

  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'ppCheckoutAddressNotice';
    notice.className = 'pp-checkout-address-notice';

    panel.insertAdjacentElement('afterbegin', notice);
  }

  notice.classList.remove('is-ok', 'is-error', 'is-info');
  notice.classList.add(`is-${type || 'info'}`);

  if (type === 'error') {
    notice.setAttribute('role', 'alert');
    notice.removeAttribute('aria-live');
  } else {
    notice.removeAttribute('role');
    notice.setAttribute('aria-live', 'polite');
  }

  notice.textContent = message;
}

function ppClearCheckoutAddressNotice() {
  const notice = document.getElementById('ppCheckoutAddressNotice');

  if (notice) {
    notice.remove();
  }
}

async function ppSaveNewCheckoutAddressIfNeeded(details = {}) {
  const form = document.getElementById('ckShippingForm');
  const select = form?.querySelector('select[name="ship_addressList"]');

  if (!form || !select || select.value !== 'new') {
    return {
      saved: false,
      details
    };
  }

  if (isGuestCheckout()) {
    return {
      saved: false,
      details: {
        ...details,
        source: 'guest-checkout'
      }
    };
  }

  const { auth, db } = await ppGetFirebaseClient();
  const user = getVerifiedCheckoutUser() || auth?.currentUser || await waitForCheckoutFirebaseUser();

  if (!db || !user?.uid || user.emailVerified === false) {
    throw new Error('Necesitas una sesion verificada para guardar la dirección.');
  }

  const {
    collection,
    addDoc,
    getDocs,
    serverTimestamp,
    writeBatch,
    doc,
    setDoc
  } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');

  const ref = collection(db, 'users', user.uid, 'addresses');
  const existingSnap = await getDocs(ref);
  const isFirstAddress = existingSnap.empty;
  const payload = ppBuildFirestoreAddressPayload(details, {
    isDefault: isFirstAddress,
    serverTimestamp
  });

  if (!ppValidateFirestoreAddressPayload(payload)) {
    throw new Error('Completa los campos principales de la dirección.');
  }

  const created = await addDoc(ref, payload);

  if (payload.isDefault) {
    await ppSetOnlyDefaultFirestoreAddress(created.id, payload, {
      collection,
      doc,
      getDocs,
      writeBatch,
      serverTimestamp,
      setDoc
    });
  }

  const savedDetails = {
    ...details,
    source: 'firestore-address',
    firestoreAddressId: created.id
  };

  __ppFirestoreAddresses = [
    {
      id: created.id,
      ...payload
    },
    ...__ppFirestoreAddresses.filter((address) => address.id !== created.id)
  ];

  await ppLoadFirestoreAddressesIntoSelect();

  const refreshedSelect = document.getElementById('ckShipAddressList') ||
    document.querySelector('select[name="ship_addressList"]');

  if (refreshedSelect) {
    refreshedSelect.value = `firestore:${created.id}`;
  }

  const mission = await ppCompleteFirstAddressMissionFromCheckout();

  ppShowCheckoutAddressNotice(
    mission?.completedNow
      ? 'Dirección guardada. Initiate queda revelado en tu archivo Prophetia Tribe.'
      : 'Dirección guardada para futuros envíos.',
    'ok'
  );

  return {
    saved: true,
    addressId: created.id,
    isFirstAddress,
    mission,
    details: savedDetails
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
function ppNormalizeCheckoutCountryValue(value = '') {
  const clean = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (['es', 'espana', 'spain'].includes(clean)) return 'es';
  if (['pt', 'portugal'].includes(clean)) return 'pt';
  if (['fr', 'francia', 'france'].includes(clean)) return 'fr';

  return 'es';
}
function ppMapFirestoreAddressToCheckout(address) {
  if (!address) return null;

  const name = ppSplitFullName(address.name || '');
  const country = ppNormalizeCheckoutCountryValue(address.country || 'España');

  return {
    firstName: name.firstName,
    lastName: name.lastName,
    address1: address.line1 || '',
    address2: address.line2 || '',
    postalCode: address.postcode || '',
    city: address.city || '',
    state: address.province || '',
    country,
    phoneCode: country,
    phone: address.phone || '',
    gender: '4',
    shippingMethod: 'home',
    source: 'firestore-address',
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

  __ppApplyingStoredAddress = true;

  try {
    ppSetFieldValue(form, 'ship_gender', details.gender || '4');
    ppSetFieldValue(form, 'ship_firstName', details.firstName);
    ppSetFieldValue(form, 'ship_lastName', details.lastName);
    ppSetFieldValue(form, 'ship_address1', details.address1);
    ppSetFieldValue(form, 'ship_address2', details.address2);
    ppSetFieldValue(form, 'ship_postal', details.postalCode);
    ppSetFieldValue(form, 'ship_city', details.city);
    ppSetFieldValue(form, 'ship_state', ppNormalizeLegacyProvinceValue(details.state));
    ppSetFieldValue(form, 'ship_country', details.country || 'es');
    ppSetFieldValue(form, 'ship_phoneCode', details.phoneCode || details.country || 'es');
    ppSetFieldValue(form, 'ship_phone', details.phone);
  } finally {
    window.setTimeout(() => {
      __ppApplyingStoredAddress = false;
    }, 0);
  }
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
  let savedEmail = localStorage.getItem(LS_EMAIL) || '';
  if (!savedEmail) return;

  try {
    const hasSavedShipping = !!localStorage.getItem(LS_SHIP_DETAILS);

    /*
      Primero cargamos el select SIEMPRE.
      Aunque el usuario haya tocado el formulario, sus direcciónes deben aparecer.
    */
    await ppLoadFirestoreAddressesIntoSelect({
      selectDefault: !__ppShippingFormTouched && !hasSavedShipping
    });

    if (__ppDefaultAddressApplied || __ppShippingFormTouched || hasSavedShipping) {
      return;
    }

    const select = document.getElementById('ckShipAddressList') ||
      document.querySelector('select[name="ship_addressList"]');

    let address = ppGetAddressFromSelectValue(select?.value || '');

    if (!address) {
      address = await ppLoadDefaultFirestoreAddress();
    }

    const details = ppMapFirestoreAddressToCheckout(address);

    if (!details) return;

    const homeRadio = document.querySelector('input[name="shipping"][value="home"]');

    if (homeRadio) {
      homeRadio.checked = true;
    }

    if (select && address?.id) {
      select.value = `firestore:${address.id}`;
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
const goDetails = async () => { const cart = loadCart(); if (!cart.length) { return; } /* * El invitado entra en Detalles inmediatamente. * Solo sincronizamos Firebase si ya existe sesión. */ if ( getVerifiedCheckoutUser() ) { await syncCheckoutAuthFromFirebase(); } enableTabs(); setTab( 'nav-js-details-checkoutnc' ); };

E.basketCTA?.addEventListener('click', goDetails);
E.sideCTA?.addEventListener('click', goDetails);

   // Login y registro se enlazan desde initCheckoutAuth().

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

    const savedShippingSelection = safeJsonParse(localStorage.getItem(LS_SHIP_DETAILS), null);

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
      shippingMethod: 'home',
      shippingRateId: savedShippingSelection?.shippingRateId || null,
      serviceLevel: savedShippingSelection?.serviceLevel || null
    };

ppClearCheckoutAddressNotice();

const guestIntentResult = collectGuestAccountIntent();
if (!guestIntentResult.ok) {
  setFieldError(guestIntentResult.field, guestIntentResult.message);
  guestIntentResult.field?.focus?.();
  return;
}

const submitBtn = document.getElementById('ckShippingSubmit');
let savedAddressResult = {
  saved: false,
  details
};

try {
  setCheckoutAuthButtonLoading(submitBtn, true, 'GUARDANDO...');
  savedAddressResult = await ppSaveNewCheckoutAddressIfNeeded(details);
} catch (error) {
  console.error('[checkout] No se pudo guardar la dirección de envío:', error);
  ppShowCheckoutAddressNotice(
    error.message || 'No se ha podido guardar la dirección. Revisa tus datos e intentalo de nuevo.',
    'error'
  );
  return;
} finally {
  setCheckoutAuthButtonLoading(submitBtn, false);
}

const finalDetails = savedAddressResult?.details || details;

localStorage.setItem(LS_SHIP_DETAILS, JSON.stringify(finalDetails));
try {
  await renderCart();
} catch (error) {
  console.error('[checkout] renderCart tras guardar envío fallo:', error);
  showPaymentError(error.message || 'No se ha podido calcular el envío.');
  return;
}
if (!isShippingReady(ppSecureCartSummary)) {
  enablePayment(false);
  renderShippingOptions(ppSecureCartSummary || {});
  document.getElementById('ckShippingOptions')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.querySelector('input[name="shippingRateId"]')?.focus({ preventScroll: true });
  return;
}
enablePayment(true);
enableTabs();

    // Render resumen estilo “Prophetia-like”
    const email = localStorage.getItem(LS_EMAIL) || '';
    renderShippingSummary(email, finalDetails);

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
    const storeGuestIntentResult = collectGuestAccountIntent();
    if (!storeGuestIntentResult.ok) {
      setFieldError(storeGuestIntentResult.field, storeGuestIntentResult.message);
      storeGuestIntentResult.field?.focus?.();
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

function fillSelectedAddressFromSelect() {
  const form = document.getElementById('ckShippingForm');
  const select = form?.querySelector('select[name="ship_addressList"]');

  if (!form || !select) return;

  const value = select.value;

  if (!value || value === 'new') {
    return;
  }

  const address = ppGetAddressFromSelectValue(value);
  const details = ppMapFirestoreAddressToCheckout(address);

  if (!details) return;

  const homeRadio = document.querySelector('input[name="shipping"][value="home"]');

  if (homeRadio) {
    homeRadio.checked = true;
  }

  applyShippingMode('home');
  ppClearCheckoutAddressNotice();
  const previousDetails = safeJsonParse(localStorage.getItem(LS_SHIP_DETAILS), null);
  if (previousDetails?.shippingRateId) {
    const { shippingRateId, serviceLevel, ...addressOnly } = previousDetails;
    localStorage.setItem(LS_SHIP_DETAILS, JSON.stringify(addressOnly));
    ppSecureCartSummary = null;
    enablePayment(false);
  }
  ppFillShippingFormFromAddress(details);
  ppShowDefaultAddressNotice();
}
// ========= Helpers form =========
function val(form, name) {
  const el = form?.querySelector(`[name="${name}"]`);
  if (!el) return '';
  return (el.value ?? '').toString().trim();
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

  const isGuest = isGuestCheckout();
  const accountSummaryTitle = isGuest ? 'Compra como invitado' : 'Detalles de inicio de sesión';
  const accountSummaryAction = isGuest ? 'Cambiar email' : 'Cerrar sesión';

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
const shippingTitle = isStore
  ? 'Recogida en tienda'
  : (shippingRate.displayName || shippingRate.label || 'Servicio de envío');

const shippingDelivery = isStore
  ? 'Recogida no disponible actualmente'
  : shippingEstimateLabel(shippingRate);

const shippingPriceLabel = shippingAmountLabel(ppSecureCartSummary || {});
const shippingPrivilegeLabel = getShippingPrivilegeLabel(ppSecureCartSummary);
 E.shipSummaryContainer.innerHTML = `
  <div class="ck-box">
<h3 class="ck-h">${escapeHtml(summaryTitle)}</h3>

    <div class="ck-summaryCard" style="border:1px solid rgba(0,0,0,.18); padding:18px; margin-top:12px;">
      <div style="display:flex; justify-content:space-between; gap:12px;">
        <strong>${accountSummaryTitle}</strong>
        <button type="button" class="ck-link ck-link--muted" id="ckSummaryLogout">${accountSummaryAction}</button>
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

  // En invitado vuelve a detalles; en cuenta, reutiliza el cierre de sesión real.
  document.getElementById('ckSummaryLogout')?.addEventListener('click', () => {
    if (isGuest) {
      clearGuestCheckoutState({ keepEmail: false });
      hideShippingSummaryAndShowForm();
      setTab('nav-js-details-checkoutnc');
      syncUIFromStorage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
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
const shippingPriceLabel = shippingAmountLabel(ppSecureCartSummary || {});
const shippingPrivilegeLabel = getShippingPrivilegeLabel(ppSecureCartSummary);

const shippingInfo = `
  <div style="margin-top:10px"><strong>Método de envío</strong></div>
  <div>
    ${escapeHtml(shippingRate.displayName || shippingRate.label || (details.shippingMethod === 'store' ? 'Recogida en tienda' : 'Servicio de envío'))}
    · ${escapeHtml(shippingEstimateLabel(shippingRate))}
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
document.addEventListener(
  'DOMContentLoaded',
  async () => {
    try {
      await waitForCheckoutCart();
    } catch (error) {
      console.error(
        '[checkout] El carrito global no está disponible:',
        error
      );
    }

    markShippingFormTouched();

    renderCart().catch((error) => {
      console.error(
        '[checkout] renderCart inicial falló:',
        error
      );
    });
    window.addEventListener(
  'pp:cart-scope-changed',
  () => {
    ppSecureCartSummary = null;

    renderCart().catch((error) => {
      console.error(
        '[checkout] No se pudo actualizar la cesta tras cambiar la sesión:',
        error
      );
    });

    enableTabs();
  }
);
window.addEventListener('pp:auth-ready', () => {
  syncCheckoutAuthFromFirebase()
    .finally(() => {
      syncUIFromStorage();

      ppLoadFirestoreAddressesIntoSelect().catch((error) => {
        console.warn('[checkout] No se pudieron recargar direcciónes tras auth-ready:', error);
      });

      ppMaybeApplyDefaultAddress();

      renderCart().catch((error) => {
        console.error('[checkout] renderCart tras pp:auth-ready falló:', error);
      });
    });
});

window.addEventListener('pp:auth-changed', () => {
  syncCheckoutAuthFromFirebase()
    .finally(() => {
      syncUIFromStorage();

      ppLoadFirestoreAddressesIntoSelect().catch((error) => {
        console.warn('[checkout] No se pudieron recargar direcciónes tras auth-changed:', error);
      });

      ppMaybeApplyDefaultAddress();

      renderCart().catch((error) => {
        console.error('[checkout] renderCart tras pp:auth-changed falló:', error);
      });
    });
});
initCartEvents();
initTabClicks();
initCheckoutAuth();
initSteps();
initTribeDiscountBox();

ppInitProvinceSelects();

if ( getVerifiedCheckoutUser() ) { ppLoadFirestoreAddressesIntoSelect() .catch(error => { console.warn( '[checkout] No se pudieron cargar direcciónes Firestore:', error ); }); }

const sel = document.getElementById('ckShipAddressList') ||
  document.querySelector('select[name="ship_addressList"]');

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
if ( address1.__ppPlacesBound ) { return; } if ( !window.google ?.maps ?.importLibrary ) { console.warn( '[checkout] Google Maps Places todavía no está disponible.' ); return; } address1.__ppPlacesBound = true; await window.google.maps .importLibrary( 'places' );

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

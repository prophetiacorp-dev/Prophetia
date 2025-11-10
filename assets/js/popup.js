// assets/js/popup.js
(() => {
  const LS_KEY = 'pp_tribe_seen_v1';

  const $ = (sel, root = document) => root.querySelector(sel);

  let modal, panel, backdrop, btnClose, btnReopen, form, success, btnSuccessClose;

  function cacheDom() {
    modal  = $('#tribeModal');
    panel  = modal && $('.tribe-panel', modal);
    backdrop = modal && $('.tribe-backdrop', modal);
    btnClose = modal && $('.tribe-close', modal);
    btnReopen = $('#tribeReopen');
    form = modal && $('#tribeForm');
    success = modal && $('#tribeSuccess');
    btnSuccessClose = success && $('.tribe-success__close', success);
  }

  function ensureDom() {
    if (!modal) cacheDom();
    return !!modal;
  }

  function open() {
    if (!ensureDom()) return console.warn('[Tribe] modal no encontrado');
    modal.classList.add('is-open');
    modal.removeAttribute('aria-hidden');
    document.body.classList.add('no-scroll');
    panel && panel.setAttribute('tabindex', '-1');
    panel && panel.focus();
    btnReopen && (btnReopen.hidden = true);
  }

  function close() {
    if (!ensureDom()) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    if (localStorage.getItem(LS_KEY)) btnReopen && (btnReopen.hidden = false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    success && success.removeAttribute('hidden');
    form && form.setAttribute('hidden', 'true');
    localStorage.setItem(LS_KEY, '1');
  }

  function wireEvents() {
    [backdrop, btnClose, btnSuccessClose].forEach(el => el && el.addEventListener('click', close));
    btnReopen && btnReopen.addEventListener('click', open);
    document.addEventListener('keydown', ev => (ev.key === 'Escape' && modal?.classList.contains('is-open')) && close());
    form && form.addEventListener('submit', handleSubmit);
  }

  function firstTimeAutoOpen() {
    if (!localStorage.getItem(LS_KEY)) open();
    else btnReopen && (btnReopen.hidden = false);
  }

  function init() {
    cacheDom();
    if (!modal) { console.warn('[Tribe] #tribeModal no está en el DOM en init'); return; }
    wireEvents();
    firstTimeAutoOpen();
  }

  // API pública + helper de estado
  window.ppTribeInit  = init;
  window.ppTribeOpen  = open;
  window.ppTribeClose = close;
  window.ppTribeState = () => ({ modal, panel, backdrop, btnClose, btnReopen, form, success });

  // init robusto
  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', () => !modal && init());

  // compatibilidad con o sin Swup
  if (window.swup) {
    try {
      window.swup.hooks.on('page:view', () => init());
    } catch (e) {
      console.warn('[Tribe] Swup no detectado o sin hooks:', e);
    }
  } else {
    console.log('[Tribe] Swup no encontrado, usando init clásico.');
  }
})();

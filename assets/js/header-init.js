/* ============================================================
   PROPHETIA — Interacciones de la cabecera
   ============================================================ */
(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  /* ---------- Mega-menus: accesibles ---------- */
  $$('.mega').forEach(m => {
    const btn = $('.mega-toggle', m);
    const panel = $('.mega-panel', m);

    // Abrir por hover (desktop)
    m.addEventListener('mouseenter', () => {
      panel.style.display = 'block';
      btn.setAttribute('aria-expanded', 'true');
    });
    m.addEventListener('mouseleave', () => {
      panel.style.display = 'none';
      btn.setAttribute('aria-expanded', 'false');
    });

    // Toggle por click (móviles/tablets)
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const open = panel.style.display === 'block';
      panel.style.display = open ? 'none' : 'block';
      btn.setAttribute('aria-expanded', String(!open));
    });
  });

  /* ---------- Modal de cuenta ---------- */
    /* ---------- Modal de cuenta (alineado a header.html) ---------- */
    const btnAuthLogo = document.getElementById('ppAuthLogoBtn');
btnAuthLogo?.addEventListener('click', openAuth);

  const authModal    = $('#ppAuthModal');                 // <dialog id="ppAuthModal">
  const btnAccount   = $('#ppAuthBtn');                   // botón abrir
  const btnAuthClose = $('[data-close="auth"]');          // botón cerrar por data-attr
  const formLogin    = $('#ppLoginForm');                 // <form id="ppLoginForm">
  const formRegister = $('#ppRegisterForm');              // <form id="ppRegisterForm">
  const tabLogin     = $('[data-auth-tab="login"]');      // botón pestaña Login
  const tabRegister  = $('[data-auth-tab="register"]');   // botón pestaña Register

  function openAuth() {
    if (!authModal) return;
    // Si es <dialog>, usa API nativa; si no, usa clase 'hidden' como fallback.
    if (typeof authModal.showModal === 'function') {
      authModal.showModal();
    } else {
      authModal.classList.remove('hidden');
      authModal.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('no-scroll');
  }
  function closeAuth() {
    if (!authModal) return;
    if (typeof authModal.close === 'function') {
      authModal.close();
    } else {
      authModal.classList.add('hidden');
      authModal.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('no-scroll');
  }

  btnAccount?.addEventListener('click', openAuth);
  btnAuthClose?.addEventListener('click', closeAuth);
  authModal?.addEventListener('click', (e) => {
    // Cerrar si clicas sobre el backdrop del <dialog> (solo si no hay modal-card)
    if (e.target === authModal) closeAuth();
  });

  // Tabs login / register
  tabLogin?.addEventListener('click', () => {
    tabLogin.classList.add('active'); tabRegister.classList.remove('active');
    formLogin.classList.remove('hidden'); formRegister.classList.add('hidden');
    tabLogin.setAttribute('aria-selected', 'true');
    tabRegister.setAttribute('aria-selected', 'false');
  });
  tabRegister?.addEventListener('click', () => {
    tabRegister.classList.add('active'); tabLogin.classList.remove('active');
    formRegister.classList.remove('hidden'); formLogin.classList.add('hidden');
    tabRegister.setAttribute('aria-selected', 'true');
    tabLogin.setAttribute('aria-selected', 'false');
  });


  // Submit fake
  formLogin?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('¡Bienvenido de nuevo!');
    closeAuth();
  });
  formRegister?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Cuenta creada (demo).');
    closeAuth();
  });

  /* ---------- Carrito (drawer) ---------- */
    /* ---------- Carrito (drawer) — IDs pp… del parcial ---------- */
  const cartOverlay  = $('#ppCartOverlay');
  const cartDrawer   = $('#ppCartDrawer');
  const btnCart      = $('#ppCartBtn');
  const btnCartClose = $('[data-close="cart"]');

  function openCart() {
    cartOverlay?.classList.add('active');
    cartDrawer?.classList.add('open');
    document.body.classList.add('no-scroll');
  }
  function closeCart() {
    cartOverlay?.classList.remove('active');
    cartDrawer?.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }

  btnCart?.addEventListener('click', openCart);
  btnCartClose?.addEventListener('click', closeCart);
  cartOverlay?.addEventListener('click', closeCart);

  // Escape para cerrar modal/cart (compatible dialog)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Si <dialog> está abierto → .open === true
    if (authModal && (authModal.open || !authModal.classList.contains('hidden'))) closeAuth();
    if (cartOverlay?.classList.contains('active')) closeCart();
  });


  /* ---------- Spotify: botón y arrastre robusto ---------- */
const audioBtn = $('#ppAudioChip');     // coincide con header.html
const audioPanel = $('#ppAudioPanel');


  // Toggle panel
  audioBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    audioPanel.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    // Cierra si se hace click fuera
    if (!audioPanel.classList.contains('hidden')) {
      if (!audioPanel.contains(e.target) && e.target !== audioBtn) {
        audioPanel.classList.add('hidden');
      }
    }
  });

  // Drag del chip con Pointer Events + persistencia
  (function enableDrag() {
    if (!audioBtn) return;

    // Restaura posición guardada
    try {
      const p = JSON.parse(localStorage.getItem('ppAudioPosV1') || 'null');
      if (p && typeof p.x === 'number' && typeof p.y === 'number') {
        audioBtn.style.position = 'fixed';
        audioBtn.style.left = p.x + 'px';
        audioBtn.style.top = p.y + 'px';
        audioBtn.style.right = 'auto';
      }
    } catch {}

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    let id = null, sx = 0, sy = 0, ox = 0, oy = 0, moved = false;

    audioBtn.style.touchAction = 'none';

    audioBtn.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      audioBtn.setPointerCapture(id);
      const r = audioBtn.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; moved = false;
      audioBtn.classList.add('dragging');
    });

    audioBtn.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      const x = clamp(ox + dx, 6, window.innerWidth - audioBtn.offsetWidth - 6);
      const y = clamp(oy + dy, 6, window.innerHeight - audioBtn.offsetHeight - 6);
      audioBtn.style.position = 'fixed';
      audioBtn.style.left = x + 'px';
      audioBtn.style.top = y + 'px';
      audioBtn.style.right = 'auto';
    });

    function up(e) {
      if (e.pointerId !== id) return;
      audioBtn.releasePointerCapture(id);
      audioBtn.classList.remove('dragging');
      id = null;
      // Guarda posición
      const r = audioBtn.getBoundingClientRect();
      try {
        localStorage.setItem('ppAudioPosV1', JSON.stringify({ x: r.left, y: r.top }));
      } catch {}
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    audioBtn.addEventListener('pointerup', up);
    audioBtn.addEventListener('pointercancel', up);
  })();

  /* ---------- Mejora: evitar que el buscador tape iconos (solo UI ya lo resuelve con CSS) ---------- */
  // Sin lógica adicional necesaria: el CSS reducido la anchura con media-queries.
})();

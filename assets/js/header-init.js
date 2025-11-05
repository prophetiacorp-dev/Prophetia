/* ==============================================================
   PROPHETIA — Header interactions (mega, auth modal tipo LOEWE)
   ==============================================================
   Requisitos HTML esperados:
   - Botón abrir modal (cualquiera de los dos):
       #ppAuthLogoBtn   (logo redondo)
       #ppAuthBtn       (otro botón opcional)
   - <dialog id="ppAuthModal" class="modal">
       <div class="modal-card"> ... </div>
       Botones cerrar con [data-close="auth"]
       Tabs: <button class="tab" data-auth-tab="login"    aria-selected="true"></button>
             <button class="tab" data-auth-tab="register" aria-selected="false"></button>
       Formularios:
         <form id="ppLoginForm"    class="auth-form">...</form>
         <form id="ppRegisterForm" class="auth-form hidden">...</form>
       Inputs password con type="password"
   ============================================================== */

(() => {
  // Helpers
  const $  = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  // --- Mega menus (accesibles, opcional) ---

  // --- AUTH MODAL ---
  let authBound = false;

  function switchAuthTab(modal, which) {
    const tabBtns = $$('[data-auth-tab]', modal);
    const forms = {
      login:    $('#ppLoginForm', modal),
      register: $('#ppRegisterForm', modal)
    };
    const isLogin = which === 'login';

    tabBtns.forEach(b => {
      const val = b.getAttribute('data-auth-tab');
      const active = val === which;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
      // A11y: foco al tab activo si vino por teclado
      if (active && document.activeElement !== b) {
        // no forzamos focus aquí para no robar foco a inputs
      }
    });

    if (forms.login)    forms.login.classList.toggle('hidden', !isLogin);
    if (forms.register) forms.register.classList.toggle('hidden', isLogin);
  }

  function openAuth(modal, defaultTab = 'login') {
    if (!modal) return;
    if (typeof modal.showModal === 'function') modal.showModal();
    else {
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden','false');
    }
    document.body.classList.add('no-scroll');
    switchAuthTab(modal, defaultTab);

    // Foco inicial a primer input o al primer botón
    const focusable = modal.querySelector('input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable && focusable.focus({ preventScroll: true });
  }

  function closeAuth(modal) {
    if (!modal) return;
    if (typeof modal.close === 'function') modal.close();
    else {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden','true');
    }
    document.body.classList.remove('no-scroll');
  }

  function bindAuthModal(root = document) {
    if (authBound) return; // evita doble binding si el header se reinserta
    const modal       = $('#ppAuthModal', root) || document.getElementById('ppAuthModal');
    const btnLogo     = $('#ppAuthLogoBtn', root) || document.getElementById('ppAuthLogoBtn');
    const btnAccount  = $('#ppAuthBtn', root)     || document.getElementById('ppAuthBtn');

    if (!modal || (!btnLogo && !btnAccount)) return;

    // Abrir desde logo -> pestaña 'register' por UX (como LOEWE)
    btnLogo && btnLogo.addEventListener('click', () => openAuth(modal, 'register'));
    // Abrir desde otro botón -> pestaña 'login'
    btnAccount && btnAccount.addEventListener('click', () => openAuth(modal, 'login'));

    // Botones cerrar [data-close="auth"]
    $$('[data-close="auth"]', modal).forEach(b => b.addEventListener('click', () => closeAuth(modal)));

    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!modal.open && modal.classList?.contains?.('hidden')) return;
      closeAuth(modal);
    });
    // — Exponer binder de auth para poder llamarlo tras inyectar parciales
window.ppBindAuth = () => {
  try { bindAuthModal(document); } catch(e) { console.warn('[Auth] bind falló:', e); }
};


    // Cerrar click fuera (cuando se usa <dialog>)
    modal.addEventListener('click', (e) => {
      const card = $('.modal-card', modal) || modal.firstElementChild;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const out = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      if (out) closeAuth(modal);
    });

    // Tabs
    $$('[data-auth-tab]', modal).forEach(btn => {
      btn.addEventListener('click', () => {
        const which = btn.getAttribute('data-auth-tab');
        switchAuthTab(modal, which);
      });
    });

    // Mostrar / ocultar contraseña (añade botón 👁 al lado de cada password)
    $$('input[type="password"]', modal).forEach(input => {
      // Evita duplicar
      if (input.nextElementSibling?.classList?.contains('toggle-pass')) return;

      const wrapper = input.parentElement;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toggle-pass';
      btn.setAttribute('aria-label', 'Mostrar contraseña');
      btn.textContent = '👁';
      input.insertAdjacentElement('afterend', btn);

      btn.addEventListener('click', () => {
        const showing = input.type === 'password';
        input.type = showing ? 'text' : 'password';
        btn.textContent = showing ? '🙈' : '👁';
        btn.setAttribute('aria-label', showing ? 'Ocultar contraseña' : 'Mostrar contraseña');
        input.focus({ preventScroll: true });
      });
    });

    // Validación suave de formularios (visual + preventDefault)
    $$('.auth-form', modal).forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const required = $$('input[required], select[required], textarea[required]', form);
        const allOk = required.every(i => i.value.trim() !== '');
        if (!allOk) {
          form.classList.add('shake');
          setTimeout(() => form.classList.remove('shake'), 450);
          // marca inputs vacíos
          required.forEach(i => i.classList.toggle('is-invalid', i.value.trim() === ''));
          (required.find(i => i.value.trim() === '') || required[0])?.focus({ preventScroll: true });
          return;
        }
        // Aquí integrarías tu backend / fetch
        // Demo:
        console.info('✅ Auth OK:', form.id);
        closeAuth(modal);
      });
    });

    authBound = true;
  }

/* ===== Prophetia · Mega Menu controller (sticky + hover-intent) ===== */
/* ===== Prophetia · Mega Menu controller — click only ===== */
(() => {
  const mega = document.querySelector('[data-prop-mega]');
  if (!mega) return;

  const toggles  = mega.querySelectorAll('.mega-toggle[role="tab"]');
  const panel    = mega.querySelector('.mega-panel');
  const sections = panel ? panel.querySelectorAll('.panel[role="tabpanel"]') : [];

  let open = false;

  function showPanel(id){
    // 1) mostrar solo el panel objetivo
    sections.forEach(sec => {
      const active = sec.id === `panel-${id}`;
      sec.classList.toggle('is-visible', active);
      if (active) sec.removeAttribute('hidden');
      else        sec.setAttribute('hidden','');
    });

    // 2) marcar pestañas
    toggles.forEach(btn => {
      const active = btn.dataset.panel === id;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
      btn.setAttribute('aria-expanded', String(active));
    });

    // 3) A11y del contenedor
    if (panel){
      const activeTab = mega.querySelector(`.mega-toggle[data-panel="${id}"]`);
      if (activeTab){
        if (!activeTab.id) activeTab.id = `tab-${id}`;
        panel.setAttribute('aria-labelledby', activeTab.id);
      }
    }

    // 4) abrir panel (sin hover)
    mega.classList.add('is-open');
    panel.style.display = 'block';
    requestAnimationFrame(() => {
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0)';
    });
    open = true;
  }

  function hidePanel(){
    mega.classList.remove('is-open');
    toggles.forEach(btn => btn.setAttribute('aria-expanded','false'));
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(8px)';
    // esperar la transición CSS (~280ms) y ocultar
    setTimeout(() => { if (!mega.classList.contains('is-open')) panel.style.display = 'none'; }, 300);
    open = false;
  }

  // Click + teclado: único disparador permitido
  toggles.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.panel;
      if (!id) return;
      if (open && btn.classList.contains('is-active')) hidePanel();
      else showPanel(id);
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
      // accesibilidad: ← → para moverte entre tabs
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
        const arr = Array.from(toggles);
        const i = arr.indexOf(btn);
        const next = e.key === 'ArrowRight' ? (i+1) % arr.length : (i-1+arr.length)%arr.length;
        arr[next].focus();
      }
    });
  });

  // Cerrar si haces click fuera del mega-panel
  document.addEventListener('click', (e) => {
    if (!open) return;
    const inside = e.target.closest('[data-prop-mega]') || e.target.closest('.mega-panel');
    if (!inside) hidePanel();
  });

  // ESC cierra
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) hidePanel(); });

  // Estado inicial: muestra el primer tab activo del HTML (si lo hay) pero sin auto-abrir
  const initial = mega.querySelector('.mega-toggle.is-active')?.dataset.panel;
  if (initial) { sections.forEach(s => s.setAttribute('hidden','')); }
})();



// ===== Inyección de parciales (rutas CORRECTAS) =====
// ===== Inyección de header y footer por fetch =====
(async () => {
  async function inject(id, url) {
    const host = document.getElementById(id);
    if (!host) return;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
    host.innerHTML = await res.text();
  }
await inject('header', 'assets/partials/header.html');
await inject('footer', 'assets/partials/footer.html');

window.dispatchEvent(new CustomEvent('partials:ready'));
document.documentElement.style.setProperty('--pp-header-h', '64px');
})();
// 🔥 Tras inyectar header/footer, inicializa carrito si existe
window.addEventListener('partials:ready', () => {
  try { window.ppCartInit && window.ppCartInit(); } catch(e){}
    try { window.ppBindAuth && window.ppBindAuth(); } catch(e){}
});
// 🔒 Fallback robusto: abrir el modal de auth en cuanto exista
window.addEventListener('partials:ready', () => {
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('#ppAuthLogoBtn');
    if (!btn) return;
    const modal = document.getElementById('ppAuthModal');
    if (!modal) return;
    try { modal.showModal(); } catch (e) { modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); }
  }, { passive:true });
});
// ===== Auth + Cart · Cierres globales + Focus Return + Focus Trap =====
(() => {
  const $id = (x) => document.getElementById(x);
  let lastFocus = null; // Para devolver foco

  /* --- Helpers --- */
  const disableScroll = () => document.body.classList.add('no-scroll');
  const enableScroll  = () => document.body.classList.remove('no-scroll');

  function openAuth(){
    const m = $id('ppAuthModal');
    if (!m) return;

    lastFocus = document.activeElement;
    
    try { m.showModal(); } 
    catch { m.classList.remove('hidden'); m.setAttribute('aria-hidden','false'); }
    
    disableScroll();

    // Foco al primer campo
    const first = m.querySelector('input, button, select, textarea');
    first && first.focus();

    trapFocus(m);
  }

  function closeAuth(){
    const m = $id('ppAuthModal');
    if (!m) return;
    try { m.close(); } 
    catch { m.classList.add('hidden'); m.setAttribute('aria-hidden','true'); }

    enableScroll();

    // Devuelve el foco a quien abrió
    lastFocus && lastFocus.focus();
  }

function openCart(){
  const drawer  = document.getElementById('ppCartDrawer') || document.getElementById('cartDrawer');
  const overlay = document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay');
  drawer && drawer.classList.add('open');     // clase que tu CSS usa
  overlay && overlay.classList.add('active'); // idem
  document.body.classList.add('no-scroll');
}

function closeCart(){
  const drawer  = document.getElementById('ppCartDrawer') || document.getElementById('cartDrawer');
  const overlay = document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay');
  drawer && drawer.classList.remove('open');
  overlay && overlay.classList.remove('active');
  document.body.classList.remove('no-scroll');
}

  /* --- Focus Trap premium — versión Loewe™ --- */
  function trapFocus(modal) {
    const focusables = modal.querySelectorAll('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];

    modal.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });
  }

  /* --- Delegación global de clicks --- */
  document.addEventListener('click', (ev) => {
    // Abrir auth desde logo / botón
    if (ev.target.closest('#ppAuthLogoBtn') || ev.target.closest('#ppAuthBtn')) {
      ev.preventDefault();
      openAuth();
      return;
    }

    // Cerrar auth
    if (ev.target.closest('[data-close="auth"]')) {
      ev.preventDefault();
      closeAuth();
      return;
    }

    // Cerrar carrito
    if (ev.target.closest('[data-close="cart"]') || ev.target === $id('cartOverlay')) {
      ev.preventDefault();
      closeCart();
      return;
    }

    // Abrir carrito
    if (ev.target.closest('.js-open-cart')) {
      ev.preventDefault();
      openCart();
      return;
    }
  });

  /* --- Escape maneja ambos --- */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAuth();
      closeCart();
    }
  });
})();

  
})();

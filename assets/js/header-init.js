/* ==============================================================
   PROPHETIA — header-init.js (Nov 2025)
   - Parciales (header/footer) por fetch + evento 'partials:ready'
   - Mega-menú (un solo .mega-panel con varias .panel[role="tabpanel"])
   - Modal Auth (ppBindAuth)
   - Cart helpers (ppOpenCart / ppCloseCart - fallback si no existen)
   - Ajuste de --pp-header-h tras inyección
   ============================================================== */

(() => {
  /* =============== Utils =============== */
  const $  = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  /* =============== Parciales (header/footer) =============== */
  let partialsInjected = false;

  async function injectPartial(hostId, url) {
    const host = document.getElementById(hostId);
    if (!host) return;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
    host.innerHTML = await res.text();
  }

  async function injectHeaderFooter() {
    if (partialsInjected) return;
    await injectPartial('header', 'assets/partials/header.html');
    await injectPartial('footer', 'assets/partials/footer.html');
    partialsInjected = true;
    window.dispatchEvent(new CustomEvent('partials:ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHeaderFooter, { once: true });
  } else {
    injectHeaderFooter();
  }

 /* =============== Auth Modal =============== */
(function defineAuthBinder(){
  // Caché efímera (RAM) para no perder lo escrito
  const authCache = {
    login:    { email: '', pass: '' },
    register: { email: '', pass: '' }
  };

  const q = (sel, root=document) => root.querySelector(sel);

  function switchAuthTab(modal, which) {
    const tabs  = modal.querySelectorAll('[data-auth-tab]');
    const login = q('#ppLoginForm', modal);
    const reg   = q('#ppRegisterForm', modal);
    const isLogin = which === 'login';

    tabs.forEach(b => {
      const active = b.getAttribute('data-auth-tab') === which;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    login && login.classList.toggle('hidden', !isLogin);
    reg   && reg.classList.toggle('hidden',  isLogin);
  }

  function restoreCachedValues(modal) {
    const lg = q('#ppLoginForm', modal);
    const rg = q('#ppRegisterForm', modal);
    if (lg) {
      const email = q('#ppLoginEmail', lg);
      const pass  = q('#ppLoginPass', lg);
      if (email) email.value = authCache.login.email ?? email.value ?? '';
      if (pass)  pass.value  = authCache.login.pass  ?? pass.value  ?? '';
    }
    if (rg) {
      const email = q('#ppRegEmail', rg);
      const pass  = q('#ppRegPass', rg);
      if (email) email.value = authCache.register.email ?? email.value ?? '';
      if (pass)  pass.value  = authCache.register.pass  ?? pass.value  ?? '';
    }
  }

  function bindInputsCache(modal){
    const lg = q('#ppLoginForm', modal);
    const rg = q('#ppRegisterForm', modal);
    if (lg) {
      const email = q('#ppLoginEmail', lg);
      const pass  = q('#ppLoginPass', lg);
      email && email.addEventListener('input', ()=> authCache.login.email = email.value);
      pass  && pass.addEventListener('input',  ()=> authCache.login.pass  = pass.value);
    }
    if (rg) {
      const email = q('#ppRegEmail', rg);
      const pass  = q('#ppRegPass', rg);
      email && email.addEventListener('input', ()=> authCache.register.email = email.value);
      pass  && pass.addEventListener('input',  ()=> authCache.register.pass  = pass.value);
    }
  }

  function attachPasswordToggles(modal){
    modal.querySelectorAll('input[type="password"]').forEach(input => {
      let btn = input.parentElement?.querySelector('.toggle-pass');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'toggle-pass';
        btn.setAttribute('aria-label','Mostrar contraseña');
        btn.textContent = '👁';
        input.insertAdjacentElement('afterend', btn);
      }
      if (btn.__ppBound) return;
      btn.__ppBound = true;
      btn.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? '🙈' : '👁';
        btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
        input.focus({ preventScroll: true });
      });
    });
  }

  function openAuth(defaultTab = 'login'){
  const modal = document.getElementById('ppAuthModal') || document.querySelector('#ppAuthModal');
  if (!modal) return;

  // 🔑 SIEMPRE quita el oculto antes de intentar showModal
  modal.classList.remove('hidden');
  modal.removeAttribute('aria-hidden');

  // Intenta abrir como <dialog>; si no, queda visible por CSS fallback
  try { if (!modal.open) modal.showModal(); } catch {}

  document.body.classList.add('no-scroll');

  switchAuthTab(modal, defaultTab);
  restoreCachedValues(modal);
  attachPasswordToggles(modal);
  bindInputsCache(modal);

  const first = modal.querySelector('.auth-form:not(.hidden) input, .auth-form:not(.hidden) button');
  first && first.focus({ preventScroll: true });
}

function closeAuth(){
  const modal = document.getElementById('ppAuthModal') || document.querySelector('#ppAuthModal');
  if (!modal) return;

  // Cierra el <dialog> si está abierto
  try { if (modal.open) modal.close(); } catch {}

  // 🔒 Luego aplica el oculto (para el fallback visual)
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden','true');

  document.body.classList.remove('no-scroll');
  // (No reseteamos inputs para conservar lo escrito)
}


  // ===== Delegación GLOBAL (nunca se queda “tieso”) =====
  document.addEventListener('click', (e) => {
    // Abrir: logo o botón de cuenta
    if (e.target.closest('#ppAuthLogoBtn') || e.target.closest('#ppAuthBtn')) {
      e.preventDefault();
      const isLogo = !!e.target.closest('#ppAuthLogoBtn');
      openAuth(isLogo ? 'register' : 'login');
      return;
    }
    // Cerrar: botones con data-close="auth"
    if (e.target.closest('[data-close="auth"]')) {
      e.preventDefault();
      closeAuth();
      return;
    }
  });

  // Click fuera (cuando se usa <dialog>): escucha en el propio <dialog> si existe
  document.addEventListener('click', (e) => {
    const modal = document.getElementById('ppAuthModal');
    if (!modal || e.target !== modal) return;
    // Si el click cae sobre el backdrop del <dialog> (la propia caja), cierra
    // (en muchos navegadores, el click “fuera” llega con target = dialog)
    closeAuth();
  });

  // ESC cierra
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAuth(); });

  // Tabs login/register (delegado)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-auth-tab]');
    if (!btn) return;
    const modal = document.getElementById('ppAuthModal');
    if (!modal) return;
    e.preventDefault();
    switchAuthTab(modal, btn.getAttribute('data-auth-tab'));
    restoreCachedValues(modal);
  });

  // Envío demo (delegado)
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('.auth-form');
    if (!form) return;
    e.preventDefault();
    const required = form.querySelectorAll('input[required], select[required], textarea[required]');
    const ok = Array.from(required).every(i => i.value.trim() !== '');
    if (!ok) {
      form.classList.add('shake');
      setTimeout(() => form.classList.remove('shake'), 450);
      (Array.from(required).find(i => i.value.trim()==='') || required[0])?.focus({ preventScroll: true });
      return;
    }
    console.info('✅ Auth OK:', form.id);
    closeAuth();
  });

  // Exponer helpers por si los usas en otros sitios
  window.ppOpenAuth  = openAuth;
  window.ppCloseAuth = closeAuth;
})();


  
  /* =============== Mega-menú (un solo contenedor con muchas panels) =============== */
  (function defineMegaTabsBinder(){
    let megaBound = false;

    function bindMegaTabs(root = document) {
      if (megaBound) return;

      const scope = root.querySelector('#header') || root.getElementById?.('header') || document;
      const mega  = scope.querySelector('.mega[data-prop-mega]');
      if (!mega) { megaBound = true; return; }

      const panelContainer = mega.querySelector('.mega-panel');
      const tabs  = mega.querySelectorAll('.mega-toggle[role="tab"]');
      const panes = panelContainer?.querySelectorAll('.panel[role="tabpanel"]') || [];

      if (!tabs.length || !panes.length) { megaBound = true; return; }

      function hideAll() {
        tabs.forEach(t => {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected','false');
          t.setAttribute('aria-expanded','false');
        });
        panes.forEach(p => {
          p.setAttribute('hidden','');
          p.classList.remove('is-visible');
        });
      }

      function openTabById(id, tabBtn) {
        const pane = id ? panelContainer.querySelector('#' + id) : null;
        if (!pane) return;

        hideAll();

        tabBtn?.classList.add('is-active');
        tabBtn?.setAttribute('aria-selected','true');
        tabBtn?.setAttribute('aria-expanded','true');

        pane.removeAttribute('hidden');
        pane.classList.add('is-visible');

        mega.classList.add('is-open');
        panelContainer.style.display  = 'block';
        panelContainer.style.opacity  = '1';
        panelContainer.style.transform= 'translateY(0)';

        if (tabBtn?.id) panelContainer.setAttribute('aria-labelledby', tabBtn.id);
      }

      function closeAll() {
        hideAll();
        mega.classList.remove('is-open');
        panelContainer.style.opacity   = '0';
        panelContainer.style.transform = 'translateY(8px)';
        setTimeout(() => {
          if (!mega.classList.contains('is-open')) panelContainer.style.display = 'none';
        }, 250);
      }

      tabs.forEach(btn => {
        const paneId = btn.getAttribute('aria-controls'); // ej: panel-hombre
        btn.setAttribute('aria-expanded','false');

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const isActive = btn.classList.contains('is-active');
          if (isActive) { closeAll(); return; }
          openTabById(paneId, btn);
        });

        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            const arr = Array.from(tabs);
            const i = arr.indexOf(btn);
            const j = e.key === 'ArrowRight' ? (i + 1) % arr.length : (i - 1 + arr.length) % arr.length;
            arr[j]?.focus();
          }
        });
      });

      document.addEventListener('click', (e) => {
        const inside = e.target.closest('.mega') || e.target.closest('.mega-panel');
        if (!inside) closeAll();
      });

      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

      // Inicial: respeta .is-active si existe; si no, abre la primera
      const initialBtn = mega.querySelector('.mega-toggle.is-active') || tabs[0];
      if (initialBtn) {
        const paneId = initialBtn.getAttribute('aria-controls');
        openTabById(paneId, initialBtn);
      }

      megaBound = true;
    }

    window.ppBindMegaMenus = () => { try { bindMegaTabs(document); } catch(e){ console.warn('[Mega] bind falló:', e);} };
  })();

  /* =============== Cart helpers (fallback) =============== */
  (function defineCartHelpers(){
    if (typeof window.ppOpenCart !== 'function') {
      window.ppOpenCart = function(){
        const d = document.getElementById('ppCartDrawer') || document.getElementById('cartDrawer');
        const o = document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay');
        d && d.classList.add('open');
        o && o.classList.add('active');
        document.body.classList.add('no-scroll');
      };
    }
    if (typeof window.ppCloseCart !== 'function') {
      window.ppCloseCart = function(){
        const d = document.getElementById('ppCartDrawer') || document.getElementById('cartDrawer');
        const o = document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay');
        d && d.classList.remove('open');
        o && o.classList.remove('active');
        document.body.classList.remove('no-scroll');
      };
    }

    document.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-close="cart"]') || ev.target.id === 'cartOverlay' || ev.target.id === 'ppCartOverlay') {
        ev.preventDefault(); window.ppCloseCart(); return;
      }
      if (ev.target.closest('.js-open-cart')) {
        ev.preventDefault(); window.ppOpenCart(); return;
      }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.ppCloseCart(); });
  })();

  /* =============== Ajuste de --pp-header-h =============== */
  function setHeaderHeightVar() {
    const hd = document.getElementById('header');
    const el = hd ? hd.firstElementChild : null;
    const h  = (el?.getBoundingClientRect?.().height) || 64;
    document.documentElement.style.setProperty('--pp-header-h', `${Math.round(h)}px`);
  }
  window.addEventListener('resize', () => setHeaderHeightVar());

  /* =============== Re-bind tras inyección de parciales =============== */
  window.addEventListener('partials:ready', () => {
    try { window.ppBindAuth && window.ppBindAuth(); } catch(e){}
    try { window.ppBindMegaMenus && window.ppBindMegaMenus(); } catch(e){}
    setHeaderHeightVar();
  });

})();

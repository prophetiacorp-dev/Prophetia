
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
function waitForGlobalFn(fnName, timeoutMs = 1800) {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const fn = window[fnName];
      if (typeof fn === "function") return resolve(fn);
      if (Date.now() - start > timeoutMs) return resolve(null);
      setTimeout(tick, 50);
    };
    tick();
  });
}
/* =========================================================
   PROPHETIA · Header auth icon normalizer
   Evita doble icono login/perfil en header
   ========================================================= */
function normalizeHeaderAuthIcons() {
  const header = document.getElementById("header");
  if (!header) return;

  const account = header.querySelector(".pp-account");
  if (!account) return;

  const guestBtns = Array.from(account.querySelectorAll("#ppAuthLogoBtn"));
  const profileBtns = Array.from(account.querySelectorAll("#ppProfileChip, [data-pp-profile]"));

  // Si por error hay duplicados con el mismo ID, dejamos solo el primero.
  guestBtns.slice(1).forEach((btn) => btn.remove());
  profileBtns.slice(1).forEach((btn) => btn.remove());

  const guestBtn = account.querySelector("#ppAuthLogoBtn");
  const profileBtn = account.querySelector("#ppProfileChip, [data-pp-profile]");

  const isLogged = document.body.classList.contains("pp-auth-logged");

  if (guestBtn) {
    guestBtn.hidden = isLogged;
    guestBtn.style.display = isLogged ? "none" : "inline-flex";
    guestBtn.setAttribute("aria-hidden", isLogged ? "true" : "false");
  }

  if (profileBtn) {
    profileBtn.hidden = !isLogged;
    profileBtn.style.display = isLogged ? "inline-flex" : "none";
    profileBtn.setAttribute("aria-hidden", isLogged ? "false" : "true");
  }
}
 // --- DESPUÉS ---
async function injectHeaderFooter() {
  if (partialsInjected) return;

  const t = {
    h: '/assets/partials/header.html',
    f: '/assets/partials/footer.html',
    p: '/assets/partials/popup.html',
  };

  try {
    await injectPartial('header', t.h);
    console.log('[partials] header OK:', t.h);

    await injectPartial('footer', t.f);
    console.log('[partials] footer OK:', t.f);

    await injectPartial('popup-area', t.p);
    console.log('[partials] popup OK:', t.p);
    normalizeHeaderAuthIcons();

    // 1) DEDUPE (por si Swup/recargas parciales dejaron residuos)
    const allAuth = Array.from(document.querySelectorAll('#ppAuthModal'));
    if (allAuth.length > 1) {
      const preferred =
        allAuth.find(m => m.closest('#header') && m.querySelector('.auth-bottom')) ||
        allAuth.find(m => m.querySelector('.auth-bottom')) ||
        allAuth.find(m => m.closest('#header')) ||
        allAuth[allAuth.length - 1];

      allAuth.filter(m => m !== preferred).forEach(m => m.remove());
      console.log('[partials] ppAuthModal dedupe -> kept hasBottom:', !!preferred?.querySelector?.('.auth-bottom'));
    }

    // 2) Modal definitivo
    const modal = document.querySelector('#header #ppAuthModal');

    // 3) Fallback auth-bottom si el partial está desactualizado
    if (modal && !modal.querySelector('.auth-bottom')) {
      const body = modal.querySelector('.modal-body');
      if (body) {
        body.insertAdjacentHTML('beforeend', `
          <div class="auth-bottom">
            <div class="auth-benefits" data-auth-benefits>
           <a href="/wishlist" class="sp-benefit-link">Lista de deseos</a>
<a href="/my-services" class="sp-benefit-link">Beneficios y servicios</a>
<a href="/pedidos" class="sp-benefit-link">Seguimiento de pedido</a>
            </div>
            <div class="auth-social" data-auth-social aria-label="Acceso con proveedores">
              <p class="auth-social__title">O continúa con</p>
              <div class="auth-social__row" role="group" aria-label="Proveedores">
                <button type="button" class="auth-social__iconbtn auth-social__iconbtn--google" data-pp-google aria-label="Continuar con Google">
                  <img class="auth-social__icon" src="/assets/img/logo/google.png" alt="" width="18" height="18" loading="lazy" decoding="async">
                </button>
                <button type="button" class="auth-social__iconbtn auth-social__iconbtn--apple" data-pp-apple disabled aria-disabled="true"
                  aria-label="Continuar con Apple" title="Apple requiere Apple Developer Program (de pago)">
                  <img class="auth-social__icon" src="/assets/img/logo/apple-provider.svg" alt="" width="18" height="18" loading="lazy" decoding="async">
                </button>
              </div>
              <p class="auth-social__note">Apple estará disponible próximamente.</p>
            </div>
          </div>
        `);
        console.warn('[AUTH] injected missing .auth-bottom fallback (header partial outdated)');
      }
    }

    // 4) Reset binds del modal final
    if (modal) delete modal.__ppStepsBound;

    // 5) Sanity check
    const okBottom = !!document.getElementById('header')?.querySelector('#ppAuthModal .auth-bottom');
    if (!okBottom) {
      console.error('[partials] header inyectado NO contiene .auth-bottom. Revisa /assets/partials/header.html servido.');
    }

    partialsInjected = true;
    window.dispatchEvent(new CustomEvent('partials:ready'));
  } catch (e) {
    console.error('[PROPHETIA] No se pudieron inyectar parciales:', e);
  }
}







 


  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHeaderFooter, { once: true });
  } else {
    injectHeaderFooter();
  }

/* =============== Auth Modal (Prophetia flow estable) =============== */
(function defineAuthBinder(){
  const state = { step: 'email', email: '', loginMode: 'password' }; // password | google
  const q = (sel, root=document) => root.querySelector(sel);

  function showAuthError(modal, step, code){
    const box = modal.querySelector(`[data-step="${step}"] [data-auth-error]`);
    if (!box) return;

    const map = {
      'auth/wrong-password': 'Correo o contraseña incorrectos.',
      'auth/invalid-credential': 'No se pudo iniciar sesión. Revisa el correo o el método de acceso.',
      'auth/too-many-requests': 'Demasiados intentos. Inténtalo más tarde.',
      'pp/email-not-verified': 'Tu cuenta aún no está verificada. Te hemos enviado un correo de verificación. Revisa Bandeja y Spam.',
      'auth/weak-password': 'La contraseña es demasiado débil.',
      'auth/invalid-email': 'El correo no es válido.',
      'auth/email-already-in-use': 'Ese correo ya existe. Inicia sesión.',
      'auth/user-not-found': 'No existe cuenta en PROPHETIA. Crea una nueva.'
    };

    box.textContent = map[code] || 'No se pudo completar la operación.';
    box.hidden = false;
  }

  function showStep(modal, step){
    state.step = step;

    // Solo un step visible
    modal.querySelectorAll('[data-step]').forEach(s => s.classList.add('hidden'));
    const active = modal.querySelector(`[data-step="${step}"]`);
    if (active) active.classList.remove('hidden');

    // aria-hidden coherente
    modal.querySelectorAll('[data-step]').forEach(s => {
      if (s.classList.contains('hidden')) s.setAttribute('aria-hidden', 'true');
      else s.removeAttribute('aria-hidden');
    });

    // Pintar email en chips
    modal.querySelectorAll('[data-email-value]').forEach(el => {
      el.textContent = state.email || '';
    });
    // Registro: si ya había email escrito, lo pasamos al campo real
    if (step === 'register') {
      const sourceEmail = (
        state.email ||
        q('#ppAuthEmail', modal)?.value ||
        q('#ppRegEmailHidden', modal)?.value ||
        ''
      ).trim();

      const regEmailInput = q('#ppRegEmail', modal);
      const regEmailHidden = q('#ppRegEmailHidden', modal);

      if (regEmailInput && sourceEmail && !regEmailInput.value) {
        regEmailInput.value = sourceEmail;
      }

      if (regEmailHidden && sourceEmail) {
        regEmailHidden.value = sourceEmail;
      }
    }
// Copy (estable B1)
const titleEl = modal.querySelector('[data-auth-title]');
const subEl   = modal.querySelector('[data-auth-subtitle]');

if (titleEl && subEl) {
  if (step === 'login') {
    titleEl.textContent = 'Bienvenido de nuevo';
    subEl.textContent   = 'Introduce tu contraseña para acceder.';
  } else if (step === 'register') {
    titleEl.textContent = 'Es un placer conocerte.';
    subEl.textContent   = 'Cuéntanos un poco más sobre ti.';
  } else {
    titleEl.textContent = 'Te damos la bienvenida';
    subEl.textContent   = 'Únete para desbloquear accesos exclusivos, beneficios y servicios.';
  }
}


    // Back visible solo fuera de email
    const backBtn = modal.querySelector('[data-back-auth]');
    if (backBtn) backBtn.classList.toggle('hidden', step === 'email');

    // Bottom: existe en HTML -> nunca lo mates
    const bottom = modal.querySelector('.auth-bottom');
    if (bottom) bottom.classList.remove('hidden');

    const benefits = modal.querySelector('[data-auth-benefits]');
    if (benefits) benefits.classList.toggle('hidden', !(step === 'email' || step === 'register'));

    // Modo login: password vs google
    if (step === 'login') {
      const switchEl = modal.querySelector('.pp-auth-switch');
      if (switchEl) switchEl.classList.toggle('hidden', state.loginMode === 'google');

  const passWrap    = modal.querySelector('[data-login-passwrap]');
const submitBtn   = modal.querySelector('[data-login-submit]');
const forgot      = modal.querySelector('[data-login-forgot]');
const providerBox = modal.querySelector('[data-login-provider]');
const goRegister  = modal.querySelector('[data-step="login"] [data-go="register"]');

// B1: siempre visible
if (goRegister) goRegister.classList.remove('hidden');

// B1: ocultar cualquier caja “provider-only”
if (providerBox) providerBox.classList.add('hidden');

// B1: siempre mostramos password UI
if (passWrap)  passWrap.classList.remove('hidden');
if (submitBtn) submitBtn.classList.remove('hidden');
if (forgot)    forgot.classList.remove('hidden');

    }

    // Limpia errores
    modal.querySelectorAll('[data-auth-error]').forEach(b => {
      b.hidden = true;
      b.textContent = '';
    });

    // Focus
    const focusEl = modal.querySelector(`[data-step="${step}"] input, [data-step="${step}"] button`);
    if (focusEl) focusEl.focus({ preventScroll: true });
  }

async function decideFlowByEmail(email){
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!ok) return { nextStep: 'email' };
  return { nextStep: 'login' };
}







  function closeAuth(){
    const modal = document.querySelector('#header #ppAuthModal');
    if (!modal) return;
    try { if (modal.open) modal.close(); } catch {}
    document.body.classList.remove('no-scroll');
  }

  function closeAuthWhenLoggedIn() {
    if (document.body.classList.contains('pp-auth-logged')) {
      closeAuth();
      return;
    }

    const obs = new MutationObserver(() => {
      if (document.body.classList.contains('pp-auth-logged')) {
        obs.disconnect();
        closeAuth();
      }
    });

    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    setTimeout(() => obs.disconnect(), 5000);
  }
function bindAuthSteps(modal) {
  if (modal.__ppStepsBound) return;
  modal.__ppStepsBound = true;

  const emailForm = q('#ppAuthEmailForm', modal);
  const emailInp  = q('#ppAuthEmail', modal);
  const loginForm = q('#ppLoginForm', modal);
  const regForm   = q('#ppRegisterForm', modal);

  // Click router dentro del modal
  modal.addEventListener('click', (ev) => {
    const gcta = ev.target.closest('[data-login-google-cta]');
    if (gcta) {
      ev.preventDefault();
      const gb = modal.querySelector('[data-pp-google]');
      if (gb) gb.click();
      return;
    }

    const back = ev.target.closest('[data-back-auth]');
    if (back) {
      ev.preventDefault();
      showStep(modal, 'email');
      if (emailInp) emailInp.value = state.email || '';
      return;
    }

    const edit = ev.target.closest('[data-edit-email]');
    if (edit) {
      ev.preventDefault();
      showStep(modal, 'email');
      if (emailInp) emailInp.value = state.email || '';
      return;
    }

    const go = ev.target.closest('[data-go]');
    if (go) {
      ev.preventDefault();
      const step = go.getAttribute('data-go');
      if (step === 'login' || step === 'register') showStep(modal, step);
      return;
    }
  });

  // Submit email (STEP 1 -> STEP 2/3)
  emailForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    const email = (emailInp?.value || '').trim();
    if (!email) { emailInp?.focus(); return; }

    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) {
      showStep(modal, 'email');
      showAuthError(modal, 'email', 'auth/invalid-email');
      emailInp?.focus();
      return;
    }

    const submitBtn = emailForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
    }

    try {
      state.email = email;

      const loginHidden = q('#ppLoginEmailHidden', modal);
      const regHidden   = q('#ppRegEmailHidden', modal);
      if (loginHidden) loginHidden.value = email;
      if (regHidden)   regHidden.value   = email;

      // ✅ Económico: no intentamos “adivinar” si existe. Mostramos login.
      // En STEP 1 ya tienes botón “Crear cuenta” si no es miembro.
      const flow = await decideFlowByEmail(email);

      if (flow.nextStep === 'register') {
        showStep(modal, 'register');
        return;
      }

      showStep(modal, 'login');
      q('#ppLoginPass', modal)?.focus?.({ preventScroll: true });

    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
      }
    }
  });

  // Submit login (STEP 2)
  loginForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    const passInp = q('#ppLoginPass', loginForm);
    const pass = (passInp?.value ?? '');
    if (!pass) { passInp?.focus(); return; }

    const email = (q('#ppLoginEmailHidden', modal)?.value || state.email || '').trim();
    if (!email) { showStep(modal, 'email'); return; }

    try {
      const fn = window.ppSignInWithEmailPass;
      if (typeof fn !== 'function') throw new Error('Missing ppSignInWithEmailPass');


const cred = await fn(email, pass);
const user = cred?.user;

if (user && user.emailVerified === false) {
  // 1) Reenvío opcional (RECOMENDADO): refresca UX
  try { await user.reload?.(); } catch {}

  // 2) Reenvía verificación (si quieres automático)
  try {
    const resend = window.ppResendVerificationForCurrentUser;
    if (typeof resend === "function") await resend();
  } catch {}

  // 3) Fuera de sesión hasta verificar
  try { await window.ppSignOut?.(); } catch {}

  // 4) Mensaje elegante (en el propio modal)
  showStep(modal, "login");
  showAuthError(modal, "login", "pp/email-not-verified");

  // 5) Toast opcional
  window.dispatchEvent(new CustomEvent("pp:toast", {
    detail: { msg: "Te hemos enviado (o reenviado) el email de verificación. Revisa Bandeja y Spam." }
  }));
  return;
}

// ✅ Verificado => entra
closeAuthWhenLoggedIn();

     
    } catch (err) {
      const code = err?.code || 'auth/unknown';
      showStep(modal, 'login');
      showAuthError(modal, 'login', code === 'auth/wrong-password' ? 'auth/invalid-credential' : code);
    }
  });

  // Submit register (STEP 3)
  regForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    const gender = (q('#ppRegGender', regForm)?.value || '').trim();
    if (!gender) { q('#ppRegGender', regForm)?.focus(); return; }

    const first = (q('#ppRegFirstName', regForm)?.value || '').trim();
    if (!first) { q('#ppRegFirstName', regForm)?.focus(); return; }

    const last = (q('#ppRegLastName', regForm)?.value || '').trim();
    if (!last) { q('#ppRegLastName', regForm)?.focus(); return; }

    const country = (q('#ppRegCountry', regForm)?.value || '').trim();
    if (!country) { q('#ppRegCountry', regForm)?.focus(); return; }

    const phone = (q('#ppRegPhone', regForm)?.value || '').trim();
    if (!phone) { q('#ppRegPhone', regForm)?.focus(); return; }

    const passInp = q('#ppRegPass', regForm);
    const pass = (passInp?.value ?? '');
    if (!pass) { passInp?.focus(); return; }
    if (String(pass).length < 8) { showAuthError(modal, 'register', 'auth/weak-password'); return; }

    const termsOk = q('#ppRegTerms', regForm)?.checked;
    if (!termsOk) { q('#ppRegTerms', regForm)?.focus(); return; }

    const regEmailInput = q('#ppRegEmail', regForm);
    const regEmailHidden = q('#ppRegEmailHidden', modal);

    const email = (
      regEmailInput?.value ||
      regEmailHidden?.value ||
      state.email ||
      ''
    ).trim();

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!emailOk) {
      regEmailInput?.focus();
      showAuthError(modal, 'register', 'auth/invalid-email');
      return;
    }

    state.email = email;

    if (regEmailHidden) {
      regEmailHidden.value = email;
    }

const displayName = `${first} ${last}`.trim();

const profileData = {
  gender,
  firstName: first,
  lastName: last,
  birth: (q('#ppRegBirth', regForm)?.value || '').trim(),
  country,
  phoneCode: (q('#ppRegPhoneCode', regForm)?.value || '').trim(),
  phone,
  newsletter: !!q('#ppRegNewsletter', regForm)?.checked,
  termsAccepted: !!termsOk
};

try {
  const fn = window.ppCreateUserWithEmailPass;
  if (typeof fn !== 'function') throw new Error('Missing ppCreateUserWithEmailPass');

  await fn(email, pass, displayName, profileData);

      const titleEl = modal.querySelector('[data-auth-title]');
      const subEl   = modal.querySelector('[data-auth-subtitle]');
if (titleEl) titleEl.textContent = 'Revisa tu correo';
if (subEl) {
  subEl.textContent =
    'Te hemos enviado un enlace de verificación. Confirma tu cuenta antes de iniciar sesión en Prophetia.';
}
    // Mantiene visible el mensaje de verificación antes de volver al login
setTimeout(() => {
  state.email = email;

  const loginHidden = q('#ppLoginEmailHidden', modal);
  if (loginHidden) loginHidden.value = email;

  showStep(modal, 'login');
}, 5000);

    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') {
        showStep(modal, 'login');
        return;
      }
      showAuthError(modal, 'register', code);
    }
  });
}


  function openAuth(){
    const modal = document.querySelector('#header #ppAuthModal');
    if (!modal) return;

    showStep(modal, 'email');

    try { if (!modal.open) modal.showModal(); } catch (e) {
      console.error('[AUTH] showModal failed', e);
      return;
    }

    document.body.classList.add('no-scroll');
    bindAuthSteps(modal);
  }
// ✅ Toggle password · login + registro
document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('#ppAuthModal .toggle-pass');
  if (!btn) return;

  ev.preventDefault();
  ev.stopPropagation();

  const wrap = btn.closest('.sp-password');
  if (!wrap) return;

  const input = wrap.querySelector('input[type="password"], input[type="text"]');
  if (!input) return;

  const isHidden = input.type === 'password';

  input.type = isHidden ? 'text' : 'password';

  btn.setAttribute('aria-pressed', String(isHidden));
  btn.setAttribute(
    'aria-label',
    isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña'
  );

  btn.textContent = isHidden ? '🙈' : '👁';

  input.focus({ preventScroll: true });
}, true);

  // ===== Global open/close handlers (limpios) =====
document.addEventListener('click', (e) => {
  const guestBtn   = e.target.closest('#ppAuthLogoBtn');
  const profileBtn = e.target.closest('#ppProfileChip');
  const closeBtn   = e.target.closest('[data-close="auth"]');

  if (guestBtn) {
    e.preventDefault();
    if (!partialsInjected || !document.querySelector('#header #ppAuthModal')) return;
    openAuth();
    return;
  }

  if (profileBtn) {
    e.preventDefault();

    // ✅ si está logado -> abrir panel cuenta
    if (document.body.classList.contains('pp-auth-logged')) {
      window.ppOpenAccount?.();
      return;
    }

    // fallback: si por lo que sea no está logado, abre auth
    openAuth();
    return;
  }

  if (closeBtn) {
    e.preventDefault();
    closeAuth();
  }
});


  // Backdrop click
  document.addEventListener('click', (e) => {
    const modal = document.querySelector('#header #ppAuthModal');
    if (!modal || !modal.open) return;
    if (e.target !== modal) return;
    closeAuth();
  });

  // ESC
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAuth(); });

  // Expose globals
  window.ppOpenAuth  = openAuth;
  window.ppCloseAuth = closeAuth;
  window.ppCloseAuthWhenLoggedIn = closeAuthWhenLoggedIn;

})();


  
 /* =============== Mega menú (delegado) =============== */
(function () {
  const closeMega = () => {
    const mega = document.querySelector('.mega');
    if (!mega) return;

    mega.classList.remove('is-open');
    mega.querySelectorAll('.mega-toggle').forEach(b => {
      b.classList.remove('is-active');
      b.setAttribute('aria-expanded', 'false');
      b.setAttribute('aria-selected', 'false');
    });
    mega.querySelectorAll('.panel[role="tabpanel"]').forEach(p => p.hidden = true);
    const wrap = mega.querySelector('.mega-panel[data-mega]');
    if (wrap) {
      wrap.setAttribute('aria-hidden', 'true');
      wrap.hidden = true;
      wrap.style.display = 'none';
      wrap.style.opacity = '0';
      wrap.style.transform = 'translateY(8px)';
    }
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.mega-toggle');
    const mega = e.target.closest('.mega');

    // Click fuera del mega => cerrar
    if (!btn && !mega) {
      closeMega();
      return;
    }

    // Click en botón del mega
    if (btn) {
      const root = btn.closest('.mega');
      const key = btn.dataset.panel; // mujer / hombre / colecciones / house
      const wrap = root.querySelector('.mega-panel[data-mega]');
      const panel = root.querySelector(`#panel-${key}`);
      if (!wrap || !panel) return;

      const isSame = btn.classList.contains('is-active');
      const isOpen = root.classList.contains('is-open');

      // Reset de todos
      root.querySelectorAll('.mega-toggle').forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-expanded', 'false');
        b.setAttribute('aria-selected', 'false');
      });
      root.querySelectorAll('.panel[role="tabpanel"]').forEach(p => p.hidden = true);

      if (isOpen && isSame) {
        closeMega();
        return;
      }

      // Abrir + activar
      root.classList.add('is-open');
      wrap.hidden = false;
      wrap.style.display = 'block';
      wrap.style.opacity = '1';
      wrap.style.transform = 'translateY(0px)';
      wrap.setAttribute('aria-hidden', 'false');

      btn.classList.add('is-active');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-selected', 'true');
      panel.hidden = false;
    }
  });

  // ESC cierra
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMega();
  });
})();


    /* =============== Ajuste de --pp-header-h =============== */
function setHeaderHeightVar() {
  const hd = document.getElementById('header');
  const el = hd ? hd.firstElementChild : null;
  const h  = (el?.getBoundingClientRect?.().height) || 64;
  document.documentElement.style.setProperty('--pp-header-h', `${Math.round(h)}px`);
}

window.addEventListener('resize', () => setHeaderHeightVar());



window.addEventListener('partials:ready', () => {
  setHeaderHeightVar();
});


window.addEventListener("partials:ready", normalizeHeaderAuthIcons);
window.addEventListener("pp:auth-changed", normalizeHeaderAuthIcons);

document.addEventListener("DOMContentLoaded", () => {
  normalizeHeaderAuthIcons();
});

const ppAuthClassObserver = new MutationObserver(() => {
  normalizeHeaderAuthIcons();
});

ppAuthClassObserver.observe(document.body, {
  attributes: true,
  attributeFilter: ["class"]
});
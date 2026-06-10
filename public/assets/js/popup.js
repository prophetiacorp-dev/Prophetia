// assets/js/popup.js
// =====================================================
// PROPHETIA · TRIBE POPUP (unificado)
// - Abre/cierra modal (botón flotante + backdrop + botones)
// - Valida edad >= 18 con dobMM/dobDD/dobYY
// - Mensaje de éxito en la columna izquierda
// - Compatible con parciales (ppInitTribePopup + partials:ready)
// =====================================================
(function () {
  const $  = (s, r = document) => r.querySelector(s);

  // ---- cálculo de edad ----
  function calcAge(day, month, year) {
    const today = new Date();
    let age = today.getFullYear() - year;
    const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
    if (today < birthdayThisYear) age--;
    return age;
  }

  function initTribePopup() {
    const modal     = $('#tribeModal');
    const reopenBtn = $('#tribeReopen');

    if (!modal || !reopenBtn) {
      // En páginas sin popup no hacemos nada
      return;
    }

    const backdrop   = modal.querySelector('.tribe-backdrop');
    const closeEls   = modal.querySelectorAll('[data-close]');
    const form       = $('#tribeForm', modal);
    const leftCol    = modal.querySelector('.tribe-left');
    const rightCol   = modal.querySelector('.tribe-right');
    const banner     = $('#tribeBanner', modal);        // zona de mensaje a la IZQUIERDA
    const successBox = $('#tribeSuccess', modal);
    const successMsg = successBox?.querySelector('.tribe-success__msg');

    const nameEl  = $('#tribeName', modal);
    const emailEl = $('#tribeEmail', modal);
    const mmEl    = $('#dobMM', modal);
    const ddEl    = $('#dobDD', modal);
    const yyEl    = $('#dobYY', modal);

    // Caja de error en la columna derecha
    let errorBox = $('#tribeError', modal);
    if (!errorBox && rightCol) {
      errorBox = document.createElement('div');
      errorBox.id = 'tribeError';
      errorBox.className = 'tribe-error';
      errorBox.hidden = true;
      rightCol.insertBefore(errorBox, rightCol.firstChild);
    }

    // Toast en la izquierda (solo se crea una vez)
    let toast = leftCol?.querySelector('.tribe-toast');
    if (!toast && leftCol) {
      toast = document.createElement('div');
      toast.className = 'tribe-toast';
      toast.hidden = true;
      leftCol.style.position = leftCol.style.position || 'relative';
      leftCol.appendChild(toast);
    }

    // -------- helpers UI --------
    function clearFieldErrors() {
      [nameEl, emailEl, mmEl, ddEl, yyEl].forEach(el => el && el.classList.remove('is-error'));
    }

    function showError(message) {
      clearFieldErrors();
      if (errorBox) {
        errorBox.textContent = message;
        errorBox.hidden = false;
      }
      if (banner) banner.hidden = true;
      if (successBox) successBox.hidden = true;
      if (toast) toast.hidden = true;
    }

   function showSuccess(data = {}) {
  if (errorBox) errorBox.hidden = true;
  clearFieldErrors();

  if (banner) banner.hidden = true;

  if (toast) {
    toast.hidden = true;
    toast.classList.remove('is-shown');
  }

  const title = rightCol?.querySelector('.tribe-title');
  const sub = rightCol?.querySelector('.tribe-sub');
  const formEl = rightCol?.querySelector('.tribe-form');
  const successTitle = successBox?.querySelector('.tribe-success__title');
  const successText = successBox?.querySelector('.tribe-success__text');

  title?.setAttribute('hidden', 'true');
  sub?.setAttribute('hidden', 'true');
  formEl?.setAttribute('hidden', 'true');

  if (successBox) {
    successBox.hidden = false;
    successBox.classList.add('is-visible');
  }

  if (data.codeIssuedNow) {
    if (successMsg) {
      successMsg.textContent = 'Tu acceso Prophetia Tribe está activo.';
    }

    if (successTitle) {
      successTitle.textContent = 'Bienvenido/a a la Tribe';
    }

    if (successText) {
      successText.innerHTML = `
        Te hemos enviado tu código privado de bienvenida.<br>
        Podrás usar <strong>TRIBE10</strong> una sola vez en tu próxima compra.
      `;
    }
  } else if (data.member?.discountStatus === 'used') {
    if (successMsg) {
      successMsg.textContent = 'Ya formas parte de Prophetia Tribe.';
    }

    if (successTitle) {
      successTitle.textContent = 'Código inicial utilizado';
    }

    if (successText) {
      successText.innerHTML = `
        Tu código de bienvenida ya fue utilizado.<br>
        Sigue acumulando puntos Prophetia para desbloquear nuevos beneficios privados.
      `;
    }
  } else {
    if (successMsg) {
      successMsg.textContent = 'Ya formas parte de Prophetia Tribe.';
    }

    if (successTitle) {
      successTitle.textContent = 'Acceso privado activo';
    }

    if (successText) {
      successText.innerHTML = `
        No se ha generado un nuevo código porque este email ya está registrado.<br>
        Seguirás recibiendo acceso anticipado, drops privados y beneficios reservados.
      `;
    }
  }

  form?.classList.add('is-sent');
}

    function resetUI() {
      if (form) {
        form.reset();
        form.hidden = false;
        form.classList.remove('is-sent');
      }
      if (successBox) successBox.hidden = true;
      if (banner) banner.hidden = true;
      if (errorBox) errorBox.hidden = true;
      if (toast) {
        toast.hidden = true;
        toast.classList.remove('is-shown');
      }
      rightCol?.querySelector('.tribe-title')?.removeAttribute('hidden');
rightCol?.querySelector('.tribe-sub')?.removeAttribute('hidden');
rightCol?.querySelector('.tribe-form')?.removeAttribute('hidden');

if (successBox) {
  successBox.hidden = true;
  successBox.classList.remove('is-visible');
}

clearFieldErrors();
    }

    // -------- abrir / cerrar modal --------
    function openModal() {
      resetUI();
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('is-open');
      document.body.classList.add('tribe-open');
      reopenBtn.hidden = true;
    }

    function closeModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      modal.hidden = true;
      document.body.classList.remove('tribe-open');
      reopenBtn.hidden = false;
    }

    // Exponer por si otras piezas (cookies, etc.) necesitan abrirlo
    window.ppTribeOpen = openModal;

    // Botón flotante
    reopenBtn.hidden = false;
    reopenBtn.addEventListener('click', openModal);

    // Cerrar con backdrop y botones data-close
    backdrop?.addEventListener('click', (ev) => {
      if (ev.target === backdrop) closeModal();
    });
    modal.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', closeModal);
    });

    // ESC
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !modal.hidden) closeModal();
    });

    // -------- validación + submit --------
    if (form) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        clearFieldErrors();

        const name  = nameEl?.value.trim()  ?? '';
        const email = emailEl?.value.trim() ?? '';
        const mmVal = mmEl?.value.trim()    ?? '';
        const ddVal = ddEl?.value.trim()    ?? '';
        const yyVal = yyEl?.value.trim()    ?? '';

        // Nombre
        if (!name || name.length < 2) {
          nameEl?.classList.add('is-error');
          return showError('Por favor, indica tu nombre completo.');
        }

        // Email básico
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(email)) {
          emailEl?.classList.add('is-error');
          return showError('Introduce un correo electrónico válido.');
        }

        // Fecha de nacimiento
        if (!mmVal || !ddVal || !yyVal) {
          [mmEl, ddEl, yyEl].forEach(el => el?.classList.add('is-error'));
          return showError('Completa tu fecha de nacimiento.');
        }

        const month = parseInt(mmVal, 10);
        const day   = parseInt(ddVal, 10);
        const year  = parseInt(yyVal, 10);

        const birth = new Date(year, month - 1, day);
        const validDate =
          !Number.isNaN(birth.getTime()) &&
          birth.getFullYear() === year &&
          birth.getMonth() === month - 1 &&
          birth.getDate() === day;

        if (!validDate) {
          [mmEl, ddEl, yyEl].forEach(el => el?.classList.add('is-error'));
          return showError('Introduce una fecha de nacimiento válida.');
        }

        const age = calcAge(day, month, year);
        if (age < 18) {
          [mmEl, ddEl, yyEl].forEach(el => el?.classList.add('is-error'));
          return showError('Debes ser mayor de 18 años para unirte a Prophetia Tribe.');
        }

        const optinEl = $('#tribeOptIn', modal);
const submitBtn = form.querySelector('.tribe-btn[type="submit"]');

const birthDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

try {
  submitBtn?.classList.add('is-loading');
  if (submitBtn) submitBtn.disabled = true;

  const res = await fetch('/api/tribe/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      email,
      birthDate,
      optin: !!optinEl?.checked
    })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'No se ha podido completar la suscripción.');
  }

  try {
    localStorage.setItem('pp_tribe_email', email.toLowerCase());
    localStorage.setItem('pp_tribe_code_hint', data.member?.discountCode || 'TRIBE10');
  } catch {}

  showSuccess(data);
} catch (err) {
  showError(err.message || 'No se ha podido completar la suscripción.');
} finally {
  submitBtn?.classList.remove('is-loading');
  if (submitBtn) submitBtn.disabled = false;
}
      });
    }

    console.log('[Prophetia Tribe] popup inicializado');
  }

  // Lanzar al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTribePopup);
  } else {
    initTribePopup();
  }

  // Para páginas donde inyectas el HTML por parciales
  window.ppInitTribePopup = initTribePopup;
})();
 
// Re-init cuando tus parciales se inyecten (línea que ya tenías)
window.addEventListener('partials:ready', () => {
  window.ppInitTribePopup && window.ppInitTribePopup();
});
// Delegación global para el botón flotante de Prophetia Tribe
document.addEventListener('click', (ev) => {
  const trigger = ev.target.closest('#tribeReopen');
  if (!trigger) return;

  if (typeof window.ppTribeOpen === 'function') {
    ev.preventDefault();
    window.ppTribeOpen();
  } else {
    console.warn('[Prophetia Tribe] ppTribeOpen no está disponible todavía');
  }
});

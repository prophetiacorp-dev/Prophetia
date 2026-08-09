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

  /* =====================================================
     PROPHETIA TRIBE · Sonido ceremonial de éxito
     ===================================================== */

  const TRIBE_SUCCESS_AUDIO_SRC =
    '/assets/audio/chorus.mp3';

  const TRIBE_SUCCESS_AUDIO_VOLUME = 0.28;
/* =====================================================
   PROPHETIA TRIBE · Descubrimiento inicial
   ===================================================== */

const TRIBE_AUTO_OPEN_DELAY_MS = 6_000;

const TRIBE_AUTO_SHOWN_KEY =
  'pp_tribe_auto_shown_v1';

const TRIBE_REOPEN_HINT_KEY =
  'pp_tribe_reopen_hint_seen_v1';

const TRIBE_MEMBER_EMAIL_KEY =
  'pp_tribe_email';
  const tribeSuccessAudio =
    new Audio(TRIBE_SUCCESS_AUDIO_SRC);

  tribeSuccessAudio.preload = 'auto';
  tribeSuccessAudio.loop = false;
  tribeSuccessAudio.volume =
    TRIBE_SUCCESS_AUDIO_VOLUME;

  let tribeSuccessAudioPrimed = false;

  async function primeTribeSuccessAudio() {
    if (tribeSuccessAudioPrimed) return;

    try {
      /*
        Se activa silenciosamente dentro de la interacción
        del usuario para evitar bloqueos de autoplay.
      */
      tribeSuccessAudio.volume = 0;
      tribeSuccessAudio.currentTime = 0;

      await tribeSuccessAudio.play();

      tribeSuccessAudio.pause();
      tribeSuccessAudio.currentTime = 0;

      tribeSuccessAudioPrimed = true;
    } catch (error) {
      console.warn(
        '[Prophetia Tribe] No se pudo preparar el audio',
        error
      );
    } finally {
      tribeSuccessAudio.volume =
        TRIBE_SUCCESS_AUDIO_VOLUME;
    }
  }

  function playTribeSuccessAudio() {
    try {
      tribeSuccessAudio.pause();
      tribeSuccessAudio.currentTime = 0;
      tribeSuccessAudio.volume =
        TRIBE_SUCCESS_AUDIO_VOLUME;

      const playback = tribeSuccessAudio.play();

      playback?.catch((error) => {
        console.warn(
          '[Prophetia Tribe] Audio bloqueado por el navegador',
          error
        );
      });
    } catch (error) {
      console.warn(
        '[Prophetia Tribe] Error reproduciendo el audio',
        error
      );
    }
  }

  function stopTribeSuccessAudio() {
    try {
      tribeSuccessAudio.pause();
      tribeSuccessAudio.currentTime = 0;
    } catch {}
  }


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
if (modal.dataset.tribeBound === 'true') {
  return;
}

modal.dataset.tribeBound = 'true';
    const closeEls   = modal.querySelectorAll('[data-close]');
    const closeButton = modal.querySelector('.tribe-close');
    const tribePanel = modal.querySelector('.tribe-panel');
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
let tribeAutoOpenTimer = 0;
let tribeCoachmarkTimer = 0;
let tribeAttentionTimer = 0;
let tribeCloseTimer = 0;
let tribeFocusFrame = 0;
let tribeTransitionRevision = 0;
let tribeReturnFocus = null;
const tribeReducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const TRIBE_EXIT_DURATION = 250;

function isVisibleTribeFocusTarget(element) {
  return element instanceof HTMLElement &&
    element.isConnected &&
    !element.hidden &&
    !element.closest('[inert]') &&
    element.getClientRects().length > 0;
}

function cancelPendingTribePresentation() {
  window.clearTimeout(tribeCloseTimer);
  tribeCloseTimer = 0;
  if (tribeFocusFrame) {
    window.cancelAnimationFrame(tribeFocusFrame);
    tribeFocusFrame = 0;
  }
}

function initTribeDobPickers() {
  const currentYear = new Date().getFullYear();
  const monthLabels = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre'
  ];

  const configs = [
    {
      input: ddEl,
      kind: 'day',
      label: 'día',
      placeholder: 'DD'
    },
    {
      input: mmEl,
      kind: 'month',
      label: 'mes',
      placeholder: 'MM'
    },
    {
      input: yyEl,
      kind: 'year',
      label: 'año',
      placeholder: 'YYYY'
    }
  ].filter(config => config.input);

  if (!configs.length) return;

  const pad = (value, length = 2) => String(value).padStart(length, '0');

  function getMaxDay() {
    const month = parseInt(mmEl?.value || '', 10);
    const year = parseInt(yyEl?.value || '', 10);

    if (month && year) {
      return new Date(year, month, 0).getDate();
    }

    return 31;
  }

  function getOptions(kind) {
    if (kind === 'day') {
      return Array.from({ length: getMaxDay() }, (_, index) => {
        const value = pad(index + 1);
        return {
          value,
          label: value
        };
      });
    }

    if (kind === 'month') {
      return monthLabels.map((label, index) => {
        const value = pad(index + 1);
        return {
          value,
          label: `${value} ${label}`
        };
      });
    }

    return Array.from({ length: currentYear - 1899 }, (_, index) => {
      const value = String(currentYear - index);
      return {
        value,
        label: value
      };
    });
  }

  function closeAllPickers({ restoreFocus = null } = {}) {
    configs.forEach(({ input }) => {
      const field = input.closest('.tribe-dob__field');
      const picker = field?.querySelector('.tribe-dob-picker');

      field?.classList.remove('is-open');
      picker?.classList.remove('is-open');
      if (picker) picker.hidden = true;
      input.setAttribute('aria-expanded', 'false');
    });

    restoreFocus?.focus({ preventScroll: true });
  }

  function keepDayInRange() {
    if (!ddEl?.value) return;

    const day = parseInt(ddEl.value, 10);
    const maxDay = getMaxDay();

    if (!day || day > maxDay) {
      ddEl.value = '';
      ddEl.dispatchEvent(new Event('input', { bubbles: true }));
      ddEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function setInputValue(config, value) {
    config.input.value = config.kind === 'year' ? value : pad(value);
    config.input.classList.remove('is-error');
    config.input.dispatchEvent(new Event('input', { bubbles: true }));
    config.input.dispatchEvent(new Event('change', { bubbles: true }));

    if (config.kind === 'month' || config.kind === 'year') {
      keepDayInRange();
    }
  }

  function getConfigByKind(kind) {
    return configs.find(item => item.kind === kind);
  }

  function scrollSelectedOption(config) {
    const field = config.input.closest('.tribe-dob__field');
    const picker = field?.querySelector('.tribe-dob-picker');

    if (!field?.classList.contains('is-open') || !picker) return;

    renderPicker(config, picker);
    picker.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  function normalizeTypedValue(config, { commit = false } = {}) {
    const maxLength = config.kind === 'year' ? 4 : 2;
    const raw = String(config.input.value || '').replace(/\D/g, '').slice(0, maxLength);
    let next = raw;

    if (commit && raw) {
      if (config.kind === 'day') {
        const value = Math.min(Math.max(parseInt(raw, 10) || 1, 1), getMaxDay());
        next = pad(value);
      } else if (config.kind === 'month') {
        const value = Math.min(Math.max(parseInt(raw, 10) || 1, 1), 12);
        next = pad(value);
      } else if (raw.length === 4) {
        const value = Math.min(Math.max(parseInt(raw, 10) || 1900, 1900), currentYear);
        next = String(value);
      }
    }

    const changed = config.input.value !== next;
    if (changed) {
      config.input.value = next;
    }

    config.input.classList.remove('is-error');

    if (config.kind === 'month' || config.kind === 'year') {
      keepDayInRange();
    }

    if (changed && commit) {
      config.input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    return next;
  }

  function focusNextDobField(config) {
    const nextKind = config.kind === 'day' ? 'month' : config.kind === 'month' ? 'year' : null;
    const nextConfig = nextKind ? getConfigByKind(nextKind) : null;

    if (!nextConfig?.input) {
      closeAllPickers();
      return;
    }

    nextConfig.input.focus({ preventScroll: true });
    nextConfig.input.select?.();
    openPicker(nextConfig);
  }

  function applyPastedDate(config, text) {
    if (config.kind !== 'day') return false;

    const digits = String(text || '').replace(/\D/g, '');
    if (digits.length < 6 || !mmEl || !yyEl) return false;

    const yearLength = digits.length >= 8 ? 4 : 2;
    const yearDigits = digits.slice(4, 4 + yearLength);
    const yearValue = yearLength === 2 ? `19${yearDigits}` : yearDigits;

    ddEl.value = digits.slice(0, 2);
    mmEl.value = digits.slice(2, 4);
    yyEl.value = yearValue;

    [getConfigByKind('day'), getConfigByKind('month'), getConfigByKind('year')].forEach((item) => {
      if (!item) return;
      normalizeTypedValue(item, { commit: true });
      item.input.dispatchEvent(new Event('input', { bubbles: true }));
      item.input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    closeAllPickers();
    yyEl.focus({ preventScroll: true });
    yyEl.select?.();
    return true;
  }
  function renderPicker(config, picker) {
    const rawSelectedValue = String(config.input.value || '');
    const selectedValue = config.kind === 'year' || !rawSelectedValue
      ? rawSelectedValue
      : pad(parseInt(rawSelectedValue, 10));

    picker.innerHTML = getOptions(config.kind).map((option) => {
      const isSelected = option.value === selectedValue;

      return `
        <button
          class="tribe-dob-picker__option"
          type="button"
          role="option"
          data-value="${option.value}"
          aria-selected="${isSelected ? 'true' : 'false'}"
        >
          ${option.label}
        </button>
      `;
    }).join('');
  }

  function openPicker(config) {
    const field = config.input.closest('.tribe-dob__field');
    const picker = field?.querySelector('.tribe-dob-picker');

    if (!field || !picker) return;

    const alreadyOpen = field.classList.contains('is-open');

    if (alreadyOpen) {
      renderPicker(config, picker);
      return;
    }

    closeAllPickers();
    renderPicker(config, picker);

    const rect = field.getBoundingClientRect();
    const shouldOpenAbove = window.innerHeight - rect.bottom < 230 && rect.top > 230;

    picker.classList.toggle('is-above', shouldOpenAbove);
    picker.hidden = false;
    field.classList.add('is-open');
    config.input.setAttribute('aria-expanded', 'true');

    requestAnimationFrame(() => {
      picker.classList.add('is-open');

      const active = picker.querySelector('[aria-selected="true"]');
      active?.scrollIntoView({ block: 'nearest' });
    });
  }

  let suppressNextFocusOpen = false;

  configs.forEach((config) => {
    const input = config.input;
    const field = input.parentElement;

    if (!field || field.dataset.tribeDobBound === 'true') return;

    field.dataset.tribeDobBound = 'true';
    field.classList.add('tribe-dob__field', `tribe-dob__field--${config.kind}`);

    input.readOnly = false;
    input.removeAttribute('readonly');
    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-autocomplete', 'none');

    const picker = document.createElement('div');
    picker.className = `tribe-dob-picker tribe-dob-picker--${config.kind}`;
    picker.id = `${input.id}Picker`;
    picker.hidden = true;
    picker.setAttribute('role', 'listbox');
    picker.setAttribute('aria-label', `Seleccionar ${config.label} de nacimiento`);

    input.setAttribute('aria-controls', picker.id);
    field.appendChild(picker);

    input.addEventListener('click', () => {
      openPicker(config);
    });

    input.addEventListener('focus', () => {
      if (suppressNextFocusOpen) {
        suppressNextFocusOpen = false;
        return;
      }

      openPicker(config);
      input.select?.();
    });

    input.addEventListener('input', (event) => {
      const value = normalizeTypedValue(config);
      scrollSelectedOption(config);

      const completeLength = config.kind === 'year' ? 4 : 2;
      if (event.isTrusted && value.length >= completeLength) {
        normalizeTypedValue(config, { commit: true });
        scrollSelectedOption(config);
        focusNextDobField(config);
      }
    });

    input.addEventListener('paste', (event) => {
      const pasted = event.clipboardData?.getData('text') || '';
      if (!applyPastedDate(config, pasted)) return;

      event.preventDefault();
    });

    input.addEventListener('blur', () => {
      window.setTimeout(() => {
        normalizeTypedValue(config, { commit: true });
        scrollSelectedOption(config);

        if (!document.activeElement?.closest('.tribe-dob__field')) {
          closeAllPickers();
        }
      }, 0);
    });

    function choosePickerOption(option) {
      setInputValue(config, option.dataset.value || '');
      suppressNextFocusOpen = true;
      closeAllPickers({ restoreFocus: input });
    }

    picker.addEventListener('pointerdown', (event) => {
      const option = event.target.closest('.tribe-dob-picker__option');
      if (!option) return;

      event.preventDefault();
      choosePickerOption(option);
    });

    picker.addEventListener('keydown', (event) => {
      const option = event.target.closest('.tribe-dob-picker__option');
      if (!option || !['Enter', ' '].includes(event.key)) return;

      event.preventDefault();
      choosePickerOption(option);
    });
  });

  document.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.tribe-dob__field')) return;
    closeAllPickers();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeAllPickers({ restoreFocus: document.activeElement });
  });
}

initTribeDobPickers();

/*
  Estados posibles:
  - unknown: Firebase aún no ha respondido.
  - checking: consultando al servidor.
  - guest: visitante sin sesión.
  - non-member: usuario autenticado sin Tribe.
  - member: usuario autenticado y miembro.
  - error: no se pudo verificar con seguridad.
*/
let tribeMembershipState = 'unknown';
let tribeMembershipUid = '';
let tribeMembershipSyncId = 0;
function getCurrentFirebaseUser() {
  return (
    window.__ppFirebaseAuth?.currentUser ||
    window.__ppAuthCurrentUser ||
    window.__ppLastUser ||
    null
  );
}

async function getCurrentFirebaseToken() {
  const user = getCurrentFirebaseUser();

  if (
    !user ||
    typeof user.getIdToken !== 'function'
  ) {
    return '';
  }

  try {
    await user.reload?.();
  } catch {}

  return user.getIdToken(true);
}

function normalizeEmail(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase();
}

async function getCurrentTribeStatus() {
  const user = getCurrentFirebaseUser();

  if (!user) {
    return {
      authenticated: false,
      isMember: false,
      member: null
    };
  }

  const token =
    await getCurrentFirebaseToken();

  if (!token) {
    throw new Error(
      'No se ha podido verificar tu sesión Prophetia.'
    );
  }

  const response = await fetch(
    '/api/tribe/me',
    {
      method: 'GET',
      headers: {
        Authorization:
          `Bearer ${token}`
      },
      cache: 'no-store'
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
      'No se pudo comprobar tu acceso Tribe.'
    );
  }

  const rawMember =
    data.member &&
    typeof data.member === 'object'
      ? data.member
      : null;

  const member = rawMember
    ? {
        ...rawMember,

        discountStatus:
          rawMember.discountStatus ||
          data.discountStatus ||
          'available',

        discountCode:
          rawMember.discountCode ||
          data.discountCode ||
          'TRIBE10',

        usedCount:
          Number(
            rawMember.usedCount ??
            data.usedCount ??
            0
          )
      }
    : null;

  return {
    authenticated: true,

    isMember:
      data.isMember === true ||
      Boolean(member),

    member
  };
}
/* =====================================================
   PROPHETIA TRIBE · Visibilidad segura de Tribe Reopen
   ===================================================== */

function hideReopenButton() {
  clearReopenCoachmark();

  reopenBtn.hidden = true;
  reopenBtn.setAttribute(
    'aria-hidden',
    'true'
  );
}

function showReopenButton() {
  const canBeDisplayed =
    (
      tribeMembershipState === 'guest' ||
      tribeMembershipState === 'non-member'
    ) &&
    !modal.classList.contains('is-open');

  if (!canBeDisplayed) {
    hideReopenButton();
    return false;
  }

  reopenBtn.hidden = false;
  reopenBtn.setAttribute(
    'aria-hidden',
    'false'
  );

  return true;
}

async function syncTribeReopenVisibility({
  reason = 'manual-sync'
} = {}) {
  const syncId =
    ++tribeMembershipSyncId;

  const user =
    getCurrentFirebaseUser();

  /*
    Mientras verificamos no mostramos el botón.
    Así evitamos el parpadeo miembro → botón → oculto.
  */
  hideReopenButton();

  if (!user) {
    tribeMembershipState = 'guest';
    tribeMembershipUid = '';

    showReopenButton();

    return {
      authenticated: false,
      isMember: false,
      member: null
    };
  }

  tribeMembershipState = 'checking';
  tribeMembershipUid = user.uid;

  try {
    const status =
      await getCurrentTribeStatus();

    /*
      Otra sincronización más reciente ha comenzado.
      Ignoramos esta respuesta antigua.
    */
    if (syncId !== tribeMembershipSyncId) {
      return null;
    }

    const currentUser =
      getCurrentFirebaseUser();

    /*
      Evita que una respuesta correspondiente a la cuenta A
      cambie la interfaz después de entrar con la cuenta B.
    */
    if (
      !currentUser ||
      currentUser.uid !== user.uid
    ) {
      return null;
    }

    if (
      status.authenticated &&
      status.isMember
    ) {
      tribeMembershipState = 'member';
      tribeMembershipUid = user.uid;

      window.clearTimeout(
        tribeAutoOpenTimer
      );

      hideReopenButton();

      return status;
    }

    tribeMembershipState = 'non-member';
    tribeMembershipUid = user.uid;

    showReopenButton();

    return status;
  } catch (error) {
    if (syncId !== tribeMembershipSyncId) {
      return null;
    }

    /*
      Ante un error de verificación no asumimos que el
      usuario no es miembro. Lo mantenemos oculto.
    */
    tribeMembershipState = 'error';
    tribeMembershipUid = user.uid;

    hideReopenButton();

    console.warn(
      '[Prophetia Tribe] No se pudo sincronizar Tribe Reopen:',
      reason,
      error
    );

    return null;
  }
}

async function waitForInitialAuthState(
  timeoutMs = 3000
) {
  const startedAt = Date.now();

  while (
    window.__ppAuthStateResolved !== true &&
    Date.now() - startedAt < timeoutMs
  ) {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 50);
    });
  }
}

async function bootstrapTribeVisibility() {
  await waitForInitialAuthState();

  const status =
    await syncTribeReopenVisibility({
      reason: 'initial-auth-state'
    });

  if (!status?.isMember) {
    scheduleFirstTribeOpen();
  }
}

async function handleTribeAuthChange() {
  window.clearTimeout(
    tribeAutoOpenTimer
  );

  const status =
    await syncTribeReopenVisibility({
      reason: 'auth-changed'
    });

  if (!status?.isMember) {
    scheduleFirstTribeOpen();
  }
}
function readTribeLocalValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeTribeLocalValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function clearReopenCoachmark() {
  window.clearTimeout(tribeCoachmarkTimer);
  window.clearTimeout(tribeAttentionTimer);

  reopenBtn.classList.remove(
    'is-coachmark',
    'is-attention'
  );
}

function showReopenCoachmark() {
  /*
    Nunca mostramos la llamada de atención a miembros
    ni mientras el servidor está comprobando su estado.
  */
  if (!showReopenButton()) {
    return;
  }

  const hintAlreadySeen =
    readTribeLocalValue(
      TRIBE_REOPEN_HINT_KEY
    ) === '1';

  reopenBtn.classList.add(
    'is-attention'
  );

  if (!hintAlreadySeen) {
    reopenBtn.classList.add(
      'is-coachmark'
    );

    writeTribeLocalValue(
      TRIBE_REOPEN_HINT_KEY,
      '1'
    );

    tribeCoachmarkTimer =
      window.setTimeout(
        () => {
          reopenBtn.classList.remove(
            'is-coachmark'
          );
        },
        8_000
      );
  }

  tribeAttentionTimer =
    window.setTimeout(
      () => {
        reopenBtn.classList.remove(
          'is-attention'
        );
      },
      12_000
    );
}

function shouldAutoOpenTribe() {
  /*
    Durante el pre-lanzamiento damos prioridad a los avisos de producto.
    Tribe sigue accesible desde su botón, pero no interrumpe al visitante.
  */
  if (window.ppStorefront?.salesEnabled === false) {
    return false;
  }

  /*
    Solo visitantes y usuarios confirmados como no miembros
    pueden recibir la presentación automática.
  */
  if (
    tribeMembershipState !== 'guest' &&
    tribeMembershipState !== 'non-member'
  ) {
    return false;
  }

  /*
    Solo se abre automáticamente en la portada.
  */
  if (
    document.body?.dataset.page !== 'home'
  ) {
    return false;
  }
  /*
    Ya fue presentado automáticamente en este navegador.
  */
  if (
    readTribeLocalValue(
      TRIBE_AUTO_SHOWN_KEY
    ) === '1'
  ) {
    return false;
  }

  /*
    El navegador ya completó alguna suscripción Tribe.
    Los miembros conectados también serán verificados
    mediante /api/tribe/me dentro de openModal().
  */
  if (
    readTribeLocalValue(
      TRIBE_MEMBER_EMAIL_KEY
    )
  ) {
    return false;
  }

  return true;
}

function scheduleFirstTribeOpen() {
  if (!shouldAutoOpenTribe()) {
    return;
  }

  window.clearTimeout(
    tribeAutoOpenTimer
  );

  tribeAutoOpenTimer = window.setTimeout(
    async () => {
      /*
        No interrumpimos otro diálogo ni abrimos
        el modal con la pestaña en segundo plano.
      */
      if (
        document.hidden ||
        modal.classList.contains('is-open') ||
        document.querySelector('dialog[open]')
      ) {
        return;
      }

      writeTribeLocalValue(
        TRIBE_AUTO_SHOWN_KEY,
        '1'
      );

      await openModal({
        source: 'auto'
      });
    },
    TRIBE_AUTO_OPEN_DELAY_MS
  );
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

   function showSuccess(
  data = {},
  {
    playAudio = true
  } = {}
) {
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
rightCol?.classList.add('is-success');
if (successBox) {
  successBox.hidden = false;
  successBox.classList.add('is-visible');
}

if (playAudio) {
  playTribeSuccessAudio();
} else {
  stopTribeSuccessAudio();
}

  if (
  data.publicStatus === 'submitted'
) {
  if (successMsg) {
    successMsg.textContent =
      'Solicitud Prophetia Tribe recibida.';
  }

  if (successTitle) {
    successTitle.textContent =
      'Revisa tu correo';
  }

  if (successText) {
    successText.innerHTML = `
      Si el correo es válido y corresponde a una nueva suscripción,
      recibirás allí la información de acceso a Prophetia Tribe.<br><br>

      Por seguridad, no confirmamos desde esta pantalla si un correo
      ya estaba registrado anteriormente.
    `;
  }
} else if (data.codeIssuedNow) {
    if (successMsg) {
      successMsg.textContent = 'Tu acceso Prophetia Tribe está activo.';
    }

    if (successTitle) {
      successTitle.textContent = 'Bienvenido/a a la Tribe';
    }


if (successText) {
  successText.innerHTML = `
    Te hemos enviado tu código privado de bienvenida.<br>
    Podrás usar <strong>TRIBE10</strong> una sola vez en tu próxima compra.<br><br>

    Cuando accedas a tu cuenta Prophetia con este mismo correo,
    también encontrarás tu beneficio en <strong>Mi perfil</strong>,
    junto a tus emblemas, misiones y próximos beneficios.
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
  stopTribeSuccessAudio();
rightCol?.classList.remove('is-success');
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
function revealModal() {
  const revision = ++tribeTransitionRevision;
  cancelPendingTribePresentation();
  hideReopenButton();

  modal.classList.remove('closing');
  modal.hidden = false;
  modal.removeAttribute('inert');

  modal.setAttribute(
    'aria-hidden',
    'false'
  );

  modal.classList.add(
    'is-open'
  );

  document.body.classList.add(
    'tribe-open'
  );

  tribeFocusFrame = window.requestAnimationFrame(() => {
    tribeFocusFrame = 0;
    if (revision !== tribeTransitionRevision || !modal.classList.contains('is-open')) return;
    const target = closeButton || nameEl || emailEl;
    target?.focus({ preventScroll: true });
  });
}

async function openModal({
  source = 'manual'
} = {}) {
  if (modal.classList.contains('closing')) {
    tribeTransitionRevision += 1;
    cancelPendingTribePresentation();
    modal.classList.remove('closing', 'is-open');
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('inert', '');
    modal.hidden = true;
    modal.dataset.openSource = '';
    document.body.classList.remove('tribe-open');
  }

  if (!modal.classList.contains('is-open')) {
    const active = document.activeElement;
    tribeReturnFocus = isVisibleTribeFocusTarget(active) && !modal.contains(active)
      ? active
      : null;
  }
  clearReopenCoachmark();
  resetUI();
  hideReopenButton();

  modal.dataset.openSource = source;

  const user =
    getCurrentFirebaseUser();

  if (user?.email && emailEl) {
    emailEl.value =
      normalizeEmail(user.email);

    emailEl.readOnly = true;

    emailEl.setAttribute(
      'aria-readonly',
      'true'
    );
  } else if (emailEl) {
    emailEl.readOnly = false;

    emailEl.removeAttribute(
      'aria-readonly'
    );
  }

  if (user) {
    try {
      const status =
        await getCurrentTribeStatus();

      if (
        status.authenticated &&
        status.isMember
      ) {
        /*
          El servidor ha confirmado la membresía.
          No mostramos ni formulario ni success modal:
          toda la experiencia del miembro está en Mi perfil.
        */
        tribeMembershipState = 'member';
        tribeMembershipUid = user.uid;

        window.clearTimeout(
          tribeAutoOpenTimer
        );

        modal.dataset.openSource = '';

        hideReopenButton();
        return;
      }

      tribeMembershipState = 'non-member';
      tribeMembershipUid = user.uid;
    } catch (error) {
      tribeMembershipState = 'error';
      tribeMembershipUid = user.uid;

      hideReopenButton();

      /*
        Una apertura automática nunca debe interrumpir
        la portada si falla la comprobación.
      */
      if (source === 'auto') {
        modal.dataset.openSource = '';
        return;
      }

      form?.setAttribute(
        'hidden',
        'true'
      );

      showError(
        error.message ||
        'No hemos podido verificar tu acceso Tribe.'
      );

      revealModal();
      return;
    }
  } else {
    tribeMembershipState = 'guest';
    tribeMembershipUid = '';
  }

  revealModal();
}

async function restoreReopenAfterClose({
  showCoachmark = false
} = {}) {
  /*
    Si acabamos de confirmar una membresía durante el submit,
    no necesitamos consultar otra vez para decidir la interfaz.
  */
  if (
    tribeMembershipState === 'member'
  ) {
    hideReopenButton();
    return;
  }

  const user =
    getCurrentFirebaseUser();

  if (user) {
    const status =
      await syncTribeReopenVisibility({
        reason: 'modal-closed'
      });

    if (
      status?.isMember ||
      tribeMembershipState !== 'non-member'
    ) {
      hideReopenButton();
      return;
    }
  } else {
    tribeMembershipState = 'guest';
    tribeMembershipUid = '';

    showReopenButton();
  }

  if (showCoachmark) {
    showReopenCoachmark();
  } else {
    showReopenButton();
  }
}

function closeModal() {
  if (!modal.classList.contains('is-open')) return;
  const revision = ++tribeTransitionRevision;
  cancelPendingTribePresentation();
  const wasAutomaticallyOpened =
    modal.dataset.openSource === 'auto';

  const wasShowingRegistrationForm =
    form &&
    form.hidden !== true &&
    !form.hasAttribute('hidden') &&
    successBox?.hidden !== false;

  stopTribeSuccessAudio();

  rightCol?.classList.remove(
    'is-success'
  );

  if (modal.contains(document.activeElement)) {
    document.activeElement?.blur?.();
  }
  modal.setAttribute('inert', '');
  modal.classList.add('closing');
  modal.classList.remove(
    'is-open'
  );

  const focusTarget = tribeReturnFocus;
  tribeReturnFocus = null;
  const finalizeClose = () => {
    tribeCloseTimer = 0;
    if (revision !== tribeTransitionRevision || modal.classList.contains('is-open')) return;

    modal.classList.remove('closing');
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('inert', '');
    modal.hidden = true;
    document.body.classList.remove('tribe-open');
    modal.dataset.openSource = '';

    /*
      Primero ocultamos. Después el servidor decide
      si debe volver a aparecer.
    */
    hideReopenButton();

    void restoreReopenAfterClose({
      showCoachmark:
        wasAutomaticallyOpened &&
        wasShowingRegistrationForm
    }).finally(() => {
      if (revision !== tribeTransitionRevision || modal.classList.contains('is-open')) return;
      const target = isVisibleTribeFocusTarget(focusTarget)
        ? focusTarget
        : (isVisibleTribeFocusTarget(reopenBtn) ? reopenBtn : null);
      target?.focus({ preventScroll: true });
    });
  };

  if (tribeReducedMotionQuery.matches) finalizeClose();
  else tribeCloseTimer = window.setTimeout(finalizeClose, TRIBE_EXIT_DURATION);
}
    // Exponer por si otras piezas (cookies, etc.) necesitan abrirlo
    window.ppTribeOpen = openModal;

// Botón flotante
// Permanece oculto hasta resolver Firebase + servidor.
hideReopenButton();

reopenBtn.addEventListener(
  'click',
  () => {
    void openModal({
      source: 'manual'
    });
  }
);

    // Cerrar con backdrop y botones data-close (un único listener por control)
    closeEls.forEach(btn => {
      btn.addEventListener('click', closeModal);
    });

    // ESC
    document.addEventListener('keydown', (ev) => {
      if (!modal.classList.contains('is-open')) return;

      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        closeModal();
        return;
      }

      if (ev.key === 'Tab' && tribePanel) {
        const focusable = Array.from(tribePanel.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter(isVisibleTribeFocusTarget);
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!tribePanel.contains(document.activeElement)) {
          ev.preventDefault();
          (ev.shiftKey ? last : first).focus({ preventScroll: true });
        } else if (ev.shiftKey && document.activeElement === first) {
          ev.preventDefault();
          last.focus({ preventScroll: true });
        } else if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    });

    // -------- validación + submit --------
    if (form) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        clearFieldErrors();

const currentUser =
  getCurrentFirebaseUser();

const authenticatedEmail =
  normalizeEmail(
    currentUser?.email || ''
  );

const name =
  nameEl?.value.trim() ?? '';

const email =
  authenticatedEmail ||
  normalizeEmail(
    emailEl?.value || ''
  );

const mmVal =
  mmEl?.value.trim() ?? '';

const ddVal =
  ddEl?.value.trim() ?? '';

const yyVal =
  yyEl?.value.trim() ?? '';

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

const birthDate =
  `${String(year).padStart(4, '0')}-` +
  `${String(month).padStart(2, '0')}-` +
  `${String(day).padStart(2, '0')}`;

const tribeAudioReady =
  primeTribeSuccessAudio();

try {
  submitBtn?.classList.add('is-loading');
  if (submitBtn) submitBtn.disabled = true;
const firebaseToken =
  currentUser
    ? await getCurrentFirebaseToken()
    : '';
if (currentUser && !firebaseToken) {
  throw new Error(
    'No se ha podido verificar tu sesión. Vuelve a iniciar sesión.'
  );
}
const requestHeaders = {
  'Content-Type':
    'application/json'
};

if (firebaseToken) {
  requestHeaders.Authorization =
    `Bearer ${firebaseToken}`;
}
  const res = await fetch('/api/tribe/subscribe', {
    method: 'POST',
  headers: requestHeaders,
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
  localStorage.setItem(
    TRIBE_MEMBER_EMAIL_KEY,
    normalizeEmail(
      data.member?.email || email
    )
  );

  /*
    La respuesta anónima segura no devuelve códigos
    ni información sobre la existencia del email.
  */
  if (
    data.publicStatus === 'submitted'
  ) {
    localStorage.removeItem(
      'pp_tribe_code_hint'
    );
  } else {
    localStorage.setItem(
      'pp_tribe_code_hint',
      data.member?.discountCode ||
      'TRIBE10'
    );
  }
} catch {}

const liveUser =
  getCurrentFirebaseUser();

/*
  El servidor ha confirmado que la cuenta autenticada
  acaba de convertirse en miembro.
*/
if (
  currentUser &&
  liveUser?.uid === currentUser.uid &&
  data.isMember === true
) {
  tribeMembershipState = 'member';
  tribeMembershipUid = currentUser.uid;

  hideReopenButton();
}

await tribeAudioReady;
showSuccess(data);
} catch (err) {
  showError(err.message || 'No se ha podido completar la suscripción.');
} finally {
  submitBtn?.classList.remove('is-loading');
  if (submitBtn) submitBtn.disabled = false;
}
      });
    }
window.addEventListener(
  'pp:auth-changed',
  () => {
    void handleTribeAuthChange();
  }
);

window.addEventListener(
  'pp:auth-ready',
  () => {
    void bootstrapTribeVisibility();
  }
);

void bootstrapTribeVisibility();

console.log(
  '[Prophetia Tribe] popup inicializado'
);
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

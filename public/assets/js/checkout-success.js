//checkout-success.js//
    const money = (value, currency = 'EUR') => {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency
      }).format(Number(value || 0));
    };

const escapeHtml = (value = '') => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

const formatLegacyPoints = (value = 0) => {
  return `${Number(value || 0).toLocaleString('es-ES')} LP`;
};

const replaceXpWithLp = (value = '') => {
  return String(value || '').replace(/\bXP\b/g, 'LP');
};

const isGuestSuccessOrder = (order = {}) => {
  return order.customerType === 'guest' || Boolean(order.guestAccountIntent);
};
const normalizeCheckoutEmail = (value = '') => String(value || '').trim().toLowerCase();

const getVerifiedSuccessUserSnapshot = (user = null) => {
  const rawUser = user || window.__ppFirebaseAuth?.currentUser || window.__ppAuthCurrentUser || window.__ppLastUser || null;
  const email = normalizeCheckoutEmail(rawUser?.email || '');
  const uid = String(rawUser?.uid || '').trim();

  if (!uid || !email || rawUser.emailVerified === false) return null;

  return { uid, email };
};

const getSuccessAccountStorageKey = (baseKey, user = null) => {
  const verifiedUser = getVerifiedSuccessUserSnapshot(user);
  if (!verifiedUser?.uid) return '';

  return window.ppGetAccountStorageKey?.(baseKey, user) ||
    `${baseKey}:user:${verifiedUser.uid}`;
};

const canExposeSuccessXpEvent = (order = {}, user = null) => {
  if (isGuestSuccessOrder(order)) return false;

  const verifiedUser = getVerifiedSuccessUserSnapshot(user);
  const orderEmail = normalizeCheckoutEmail(order.customerEmail || '');

  return Boolean(verifiedUser && orderEmail && verifiedUser.email === orderEmail);
};

async function markGuestAccountIntentForOrder(order = {}, email = '', sessionId = '') {
  const orderDraftId = String(order.orderDraftId || '').trim();
  const cleanEmail = normalizeCheckoutEmail(email || order.customerEmail || '');

  if (!orderDraftId || !cleanEmail) return;

  try {
    await fetch('/api/guest-order-account-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderDraftId,
        sessionId: String(sessionId || '').trim(),
        email: cleanEmail
      })
    });
  } catch (error) {
    console.warn('[checkout-success] No se pudo marcar la cuenta invitada pendiente:', error);
  }
}

const getShippingProfileFromOrder = (order = {}) => {
  const shipping = order.shippingDetails || {};
  const firstName = String(shipping.firstName || '').trim();
  const lastName = String(shipping.lastName || '').trim();

  return {
    firstName,
    lastName,
    displayName: [firstName, lastName].filter(Boolean).join(' '),
    gender: shipping.gender || '',
    country: shipping.country || '',
    phoneCode: shipping.phoneCode || '',
    phone: shipping.phone || '',
    termsAccepted: true
  };
};

function renderGuestAccountInvite(order = {}, options = {}) {
  const box = document.getElementById('ppGuestAccountInvite');
  const actions = document.querySelector('.success-actions');
  const ordersLink = actions?.querySelector('a[href="pedidos"]');

  if (!box) return;

  if (!isGuestSuccessOrder(order)) {
    box.hidden = true;
    box.innerHTML = '';
    if (ordersLink) ordersLink.hidden = false;
    return;
  }

  const email = String(order.customerEmail || '').trim().toLowerCase();
  const sessionId = String(options.sessionId || '').trim();

  if (ordersLink) ordersLink.hidden = true;

  box.hidden = false;
  box.innerHTML = `
    <div class="success-guest-account__copy">
      <p class="success-guest-account__kicker">Compra como invitado</p>
      <h2>Crea tu cuenta Prophetia</h2>
      <p>Guarda este pedido, tus direcciones y tu Vault con el mismo email de compra.</p>
      <strong>${escapeHtml(email)}</strong>
    </div>

    <form class="success-guest-account__form" data-guest-account-form novalidate>
      <label class="success-guest-account__field">
        <span>Contraseña</span>
        <input type="password" name="password" autocomplete="new-password" minlength="8" required>
      </label>

      <label class="success-guest-account__field">
        <span>Confirmar contraseña</span>
        <input type="password" name="confirmPassword" autocomplete="new-password" minlength="8" required>
      </label>

      <label class="success-guest-account__check">
        <input type="checkbox" name="terms" required>
        <span>Acepto crear mi cuenta Prophetia con este email.</span>
      </label>

      <button class="success-btn" type="submit">Crear cuenta</button>
      <p class="success-guest-account__message" data-guest-account-message role="status"></p>
    </form>
  `;

  const form = box.querySelector('[data-guest-account-form]');
  const message = box.querySelector('[data-guest-account-message]');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const password = String(form.elements.password?.value || '');
    const confirmPassword = String(form.elements.confirmPassword?.value || '');
    const termsAccepted = Boolean(form.elements.terms?.checked);
    const submitButton = form.querySelector('button[type="submit"]');

    const setMessage = (messageText, type = '') => {
      if (!message) return;
      message.textContent = messageText;
      message.dataset.type = type;
    };

const successShippingLabel = (order, currency = 'EUR') => {
  const amount = order?.shippingRate?.shippingAmount ?? order?.shipping;
  if (Number(amount) > 0) return money(amount, currency);
  if (Number(amount) === 0 && order?.shippingRate?.freeShippingApplied === true) return 'Gratis';
  if (Number(amount) === 0 && order?.shippingStatus === 'not_required') return 'No requiere envío';
  return 'Pendiente de confirmación';
};

const successDeliveryLabel = (order) => {
  if (order?.estimatedDelivery) return String(order.estimatedDelivery);
  const estimate = order?.shippingRate?.deliveryEstimate || {};
  if (typeof estimate === 'string' && estimate.trim()) return estimate.trim();
  if (estimate.label) return String(estimate.label);
  if (Number.isInteger(estimate.minBusinessDays) && Number.isInteger(estimate.maxBusinessDays)) {
    return `${estimate.minBusinessDays}–${estimate.maxBusinessDays} días laborables`;
  }
  return 'Pendiente de confirmación';
};

    if (!email) {
      setMessage('No se ha podido recuperar el email del pedido.', 'error');
      return;
    }

    if (password.length < 8) {
      setMessage('La contraseña debe tener al menos 8 caracteres.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Las contraseñas no coinciden.', 'error');
      return;
    }

    if (!termsAccepted) {
      setMessage('Confirma que quieres crear la cuenta con este email.', 'error');
      return;
    }

    if (typeof window.ppCreateUserWithEmailPass !== 'function') {
      setMessage('El registro no está disponible todavía. Recarga la página e inténtalo de nuevo.', 'error');
      return;
    }

    try {
      submitButton.disabled = true;
      setMessage('Creando tu cuenta...', '');

      const profile = getShippingProfileFromOrder(order);
      await window.ppCreateUserWithEmailPass(email, password, profile.displayName, profile);
      await markGuestAccountIntentForOrder(order, email, sessionId);

      form.reset();
      setMessage('Cuenta creada. Te hemos enviado un correo para verificarla antes de iniciar sesión.', 'success');
      submitButton.textContent = 'Cuenta creada';
    } catch (error) {
      const code = String(error?.code || '');
      const friendly = code === 'auth/email-already-in-use'
        ? 'Este email ya tiene cuenta. Inicia sesión para vincular y consultar tus pedidos.'
        : code === 'auth/weak-password'
          ? 'La contraseña es demasiado débil. Usa al menos 8 caracteres.'
          : 'No se ha podido crear la cuenta ahora. Revisa los datos e inténtalo de nuevo.';

      setMessage(friendly, 'error');
      submitButton.disabled = false;
    }
  });
}

function clearPurchasedCart(user = null) {
  const uid = String(
    user?.uid ||
    window.__ppFirebaseAuth?.currentUser?.uid ||
    window.__ppAuthCurrentUser?.uid ||
    window.__ppLastUser?.uid ||
    ''
  ).trim();

  const keys = new Set([
    'pp_cart_v2',
    'pp_cart_v3:guest',
    'pp_checkout_order_draft_id',
    'pp_checkout_email',
    'pp_checkout_shipping',
    'pp_checkout_shipping_details',
    'pp_checkout_tribe_code',
    'pp_checkout_step',
    'pp_checkout_isGift',
    'pp_checkout_invoiceWanted',
    'pp_checkout_mode',
    'pp_checkout_guest_account_intent'
  ]);

  if (uid) {
    keys.add(`pp_cart_v3:user:${uid}`);
  }

  try {
    keys.forEach((key) => localStorage.removeItem(key));

    window.dispatchEvent(new CustomEvent('pp:cart-cleared-after-payment', {
      detail: { uid }
    }));
  } catch (error) {
    console.warn('[checkout-success] No se pudo limpiar la cesta pagada:', error);
  }
}

const normalizeRankId = (rank = 'member') => {
  const clean = String(rank || 'member')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  return clean === 'seer' ? 'archivist' : clean;
};

const getRankEmblemSrc = (rank = 'member') => {
  const rankId = normalizeRankId(rank);

  const emblems = {
    member: '/assets/img/logo/propnegro.png',
    initiate: '/assets/img/ranks/initiate.png',
    adeptus: '/assets/img/ranks/adeptus.png',
    oracle: '/assets/img/ranks/oracle.png',
    archivist: '/assets/img/ranks/archivist.png',
    prophet: '/assets/img/ranks/prophet.png',
    'prophet-base': '/assets/img/ranks/prophet.png',
    'prestige-i': '/assets/img/ranks/prestigio1.png',
    'prophet-prestige-1': '/assets/img/ranks/prestigio1.png'
  };

  return emblems[rankId] || emblems.member;
};
const isProphetRankId = (rankId = '') => {
  const id = normalizeRankId(rankId);

  return (
    id === 'prophet' ||
    id === 'prophet-base' ||
    id === 'prestige-i' ||
    id.startsWith('prophet-prestige-')
  );
};
const getVisualRankKeyFromState = (rank = 'member', prestigeLabel = '') => {
  const rankId = normalizeRankId(rank);
  const prestigeId = normalizeRankId(prestigeLabel);

  if (rankId !== 'prophet') {
    return rankId;
  }

  if (!prestigeId || prestigeId === 'prophet-base') {
    return 'prophet';
  }

  return prestigeId;
};
const hasPrestigeUnlockStep = (xpEvent = {}) => {
  return Boolean(xpEvent.prestigeUnlocked) ||
    (
      Array.isArray(xpEvent.xpAnimationSteps) &&
      xpEvent.xpAnimationSteps.some((step) => step?.type === 'prestige-up')
    );
};

const getFirstFillStep = (xpEvent = {}) => {
  const steps = Array.isArray(xpEvent.xpAnimationSteps)
    ? xpEvent.xpAnimationSteps
    : [];

  return steps.find((step) => step?.type === 'fill') || null;
};

const getInitialPrestigeLabel = (xpEvent = {}) => {
  const firstFill = getFirstFillStep(xpEvent);

  if (hasPrestigeUnlockStep(xpEvent)) {
    return (
      xpEvent.previousPrestigeLabel ||
      firstFill?.prestigeLabel ||
      'Prophet Base'
    );
  }

  return (
    xpEvent.prestigeLabel ||
    xpEvent.newPrestige?.prestigeLabel ||
    firstFill?.prestigeLabel ||
    'Prophet Base'
  );
};

const getFinalPrestigeLabel = (xpEvent = {}) => {
  return (
    xpEvent.prestigeLabel ||
    xpEvent.newPrestige?.prestigeLabel ||
    'Prophet Base'
  );
};
const SUCCESS_RANK_CLASSES = [
  'rank-member',
  'rank-initiate',
  'rank-adeptus',
  'rank-oracle',
  'rank-archivist',
  'rank-prophet',
  'rank-prestige-i',
  'rank-prophet-prestige-1'
];

const setSuccessVisualRank = (box, visualRankKey = 'member') => {
  if (!box) return;

  const normalizedKey = normalizeRankId(visualRankKey || 'member');
  const cssRankKey = normalizedKey === 'prophet-prestige-1'
    ? 'prestige-i'
    : normalizedKey;

  box.classList.remove(...SUCCESS_RANK_CLASSES);
  box.classList.add(`rank-${cssRankKey}`);
  box.dataset.rank = cssRankKey;
};
const TRIBE_NEXT_GOALS = [
  {
    min: 0,
    max: 0,
    label: 'Initiate',
    rankId: 'initiate',
    requiredXp: 1,
    type: 'rank',
    eyebrow: 'Primer rango'
  },
  {
    min: 1,
    max: 99,
    label: 'Adeptus',
    rankId: 'adeptus',
    requiredXp: 100,
    type: 'rank',
    eyebrow: 'Siguiente umbral'
  },
  {
    min: 100,
    max: 249,
    label: 'Oracle',
    rankId: 'oracle',
    requiredXp: 250,
    type: 'rank',
    eyebrow: 'Siguiente rango'
  },
  {
    min: 250,
    max: 499,
    label: 'Archivist',
    rankId: 'archivist',
    requiredXp: 500,
    type: 'rank',
    eyebrow: 'Siguiente rango'
  },
  {
    min: 500,
    max: 999,
    label: 'Prophet',
    rankId: 'prophet',
    requiredXp: 1000,
    type: 'rank',
    eyebrow: 'Siguiente rango'
  }
];
const TRIBE_NEXT_PRESTIGE_GOALS = [
  {
    min: 1000,
    max: 1499,
    label: 'Prestige I',
    rankId: 'prestige-i',
    requiredXp: 1500,
    type: 'prestige',
    eyebrow: 'Siguiente prestigio'
  }
];
const getNextGoalPreview = (xpEvent = {}) => {
  const newPrestige = xpEvent.newPrestige || {};

  const lifetimePoints = Number(
    xpEvent.newLifetimePoints ||
    xpEvent.lifetimePoints ||
    xpEvent.newPoints ||
    0
  );

  const rawCurrentRank =
    xpEvent.newRank ||
    xpEvent.previousRank ||
    xpEvent.newRankId ||
    xpEvent.rankId ||
    'member';

  const currentRankId = normalizeRankId(rawCurrentRank);

  const isProphetCurrent =
    normalizeRankId(xpEvent.newRank || xpEvent.previousRank) === 'prophet' ||
    isProphetRankId(currentRankId) ||
    lifetimePoints >= 1000;

  if (isProphetCurrent) {
    const prestigeGoal = TRIBE_NEXT_PRESTIGE_GOALS.find((item) => {
      return lifetimePoints >= item.min && lifetimePoints <= item.max;
    });

    const explicitPointsToNextPrestige = Number(
      xpEvent.pointsToNextPrestige ??
      newPrestige.pointsToNextPrestige ??
      0
    );

    const explicitNextPrestigeLabel =
      xpEvent.nextPrestigeLabel ||
      newPrestige.nextPrestigeLabel ||
      '';

    const nextPrestigeLabel =
      explicitNextPrestigeLabel ||
      prestigeGoal?.label ||
      '';

    const nextPrestigeAt = Number(
      xpEvent.nextPrestigeAt ||
      newPrestige.nextPrestigeAt ||
      prestigeGoal?.requiredXp ||
      0
    );

    const pointsToNextPrestige = explicitPointsToNextPrestige > 0
      ? explicitPointsToNextPrestige
      : nextPrestigeAt > lifetimePoints
        ? nextPrestigeAt - lifetimePoints
        : 0;

    if (nextPrestigeLabel && nextPrestigeAt && pointsToNextPrestige > 0) {
      const rankId = prestigeGoal?.rankId || 'prestige-i';

      return {
        type: 'prestige',
        eyebrow: prestigeGoal?.eyebrow || 'Siguiente prestigio',
        rank: nextPrestigeLabel,
        rankId,
        requiredXp: nextPrestigeAt,
        remainingXp: pointsToNextPrestige,
        emblemSrc: getRankEmblemSrc(rankId),
note: `Faltan ${pointsToNextPrestige.toLocaleString('es-ES')} LP para revelar tu emblema de prestigio.`      };
    }
  }

  const goal = TRIBE_NEXT_GOALS.find((item) => {
    return lifetimePoints >= item.min && lifetimePoints <= item.max;
  });

  if (!goal) return null;

  const remainingXp = Math.max(0, goal.requiredXp - lifetimePoints);

  if (remainingXp <= 0) return null;

  return {
    type: goal.type,
    eyebrow: goal.eyebrow,
    rank: goal.label,
    rankId: goal.rankId,
    requiredXp: goal.requiredXp,
    remainingXp,
    emblemSrc: getRankEmblemSrc(goal.rankId),
    note: `Faltan ${remainingXp.toLocaleString('es-ES')} LP para revelar tu siguiente emblema ceremonial.`
  };
};

const getXpRitualText = (xpEvent = {}) => {
  if (xpEvent.initiationUnlocked) {
    return 'Initiate activado. Tu archivo Prophetia ha comenzado.';
  }

  return 'Tu legado crece.';
};

const getXpRankMicrocopy = (rank = '', xpEvent = {}) => {
  if (xpEvent.initiationUnlocked && normalizeRankId(rank) === 'initiate') {
    return 'Primer rango ceremonial';
  }

  if (normalizeRankId(rank) === 'prophet') {
    return 'Círculo supremo';
  }

  return 'Rango ceremonial';
};
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    function animateXpFill({
  fillEl,
  textEl,
  fromPercent = 0,
  toPercent = 0,
  fromText = '',
  toText = '',
  duration = 3600
} = {}) {
  return new Promise((resolve) => {
    if (!fillEl) {
      resolve();
      return;
    }

    const startPercent = Math.max(0, Math.min(100, Number(fromPercent || 0)));
    const endPercent = Math.max(0, Math.min(100, Number(toPercent || 0)));
    const start = performance.now();

    fillEl.style.transition = 'none';
    fillEl.style.transformOrigin = 'left center';
    fillEl.style.transform = `scaleX(${startPercent / 100})`;

    if (textEl) {
      textEl.textContent = replaceXpWithLp(fromText) || '';
    }

   const easeOutCubic = (t) => t < 0.5
  ? 2 * t * t
  : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const tick = (now) => {
      const elapsed = now - start;
      const rawProgress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(rawProgress);

      const currentPercent = startPercent + ((endPercent - startPercent) * eased);

      fillEl.style.transform = `scaleX(${currentPercent / 100})`;

      if (textEl) {
        textEl.textContent = rawProgress < 1
          ? `${currentPercent.toFixed(1)}%`
          : replaceXpWithLp(toText) || `${endPercent}%`;
      }

      if (rawProgress < 1) {
        requestAnimationFrame(tick);
      } else {
        fillEl.style.transform = `scaleX(${endPercent / 100})`;

        if (textEl) {
         textEl.textContent = replaceXpWithLp(toText) || '';
        }

        resolve();
      }
    };

    requestAnimationFrame(tick);
  });
}
    const PP_SUCCESS_AUDIO = {
  xp: '/assets/audio/xpgain.mp3',
  rank: '/assets/audio/tribetoast.mp3',
  prestige: '/assets/audio/prestige.mp3'
};

function playSuccessSound(type = 'xp') {
  const src = PP_SUCCESS_AUDIO[type] || PP_SUCCESS_AUDIO.xp;

  try {
    const audio = new Audio(src);

    audio.volume = type === 'xp' ? 0.34 : 0.5;
    audio.preload = 'auto';

    const playPromise = audio.play();

    if (playPromise?.then) {
      return playPromise
        .then(() => true)
        .catch((error) => {
          console.warn('[Prophetia checkout audio] El navegador bloqueó el sonido:', error?.name || error);
          return false;
        });
    }

    return Promise.resolve(true);
  } catch (error) {
    console.warn('[Prophetia checkout audio] No se pudo reproducir:', error);
    return Promise.resolve(false);
  }
}

function getXpEventSoundType(xpEvent = {}) {
  if (xpEvent.prestigeUnlocked) return 'prestige';
  if (xpEvent.initiationUnlocked) return 'rank';
  if (xpEvent.leveledUp) return 'rank';

  const steps = Array.isArray(xpEvent.xpAnimationSteps) ? xpEvent.xpAnimationSteps : [];

  if (steps.some((step) => step?.type === 'prestige-up')) return 'prestige';
  if (steps.some((step) => step?.type === 'level-up')) return 'rank';

  return 'xp';
}

function getXpSoundDelay(type = 'xp') {
  if (type === 'prestige') return 1050;
  if (type === 'rank') return 850;

  return 420;
}

function rememberXpSoundPlayed() {
  try {
    sessionStorage.setItem('pp_xp_sound_played_at', String(Date.now()));
  } catch {}
}

function bindXpSoundNavigation() {
  document.addEventListener('click', async (event) => {
    const link = event.target.closest('[data-pp-xp-sound-nav]');
    if (!link) return;

    const href = link.getAttribute('href') || '/home';

    event.preventDefault();

    let soundType = 'xp';

    try {
      soundType = sessionStorage.getItem('pp_pending_xp_sound_type') || 'xp';
    } catch {}

    const played = await playSuccessSound(soundType);

    if (played) {
      rememberXpSoundPlayed();
    }

    window.setTimeout(() => {
      window.location.href = href;
    }, getXpSoundDelay(soundType));
  });
}

async function playSuccessXpAnimation(xpEvent) {
  const box = document.getElementById('ppSuccessXp');
  if (!box || !xpEvent) return;
if (box.dataset.animating === 'true') return;
box.dataset.animating = 'true';
const steps = Array.isArray(xpEvent.xpAnimationSteps)
  ? xpEvent.xpAnimationSteps
  : [];

const safeSteps = steps.length
  ? steps
  : [{
      type: 'fill',
      rank: xpEvent.newRank || xpEvent.previousRank || 'Initiate',
      rankId: xpEvent.newRankId || xpEvent.rankId || 'initiate',
      nextRank: xpEvent.nextRank || null,
      fromPercent: Number(xpEvent.previousProgressPercent || 0),
      toPercent: Number(xpEvent.newProgressPercent || 0),
      fromText: '',
      toText: formatLegacyPoints(xpEvent.newLifetimePoints || xpEvent.newPoints || 0)
    }];

  const pointsEarned = Number(xpEvent.pointsEarned || 0);
  const lifetimePoints = Number(
    xpEvent.newLifetimePoints ||
    xpEvent.lifetimePoints ||
    xpEvent.newPoints ||
    0
  );

  const currentRank = xpEvent.newRank || xpEvent.previousRank || 'Initiate';
  const currentRankId = normalizeRankId(
    xpEvent.newRankId ||
    xpEvent.rankId ||
    currentRank
  );

  const visualRankId = normalizeRankId(currentRank);
  const isProphet = visualRankId === 'prophet' || isProphetRankId(currentRankId);

const nextGoalPreview = getNextGoalPreview(xpEvent);


  const newPrestige = xpEvent.newPrestige || {};
  const prestigeLabel =
    xpEvent.prestigeLabel ||
    newPrestige.prestigeLabel ||
    '';

  const nextPrestigeLabel =
    xpEvent.nextPrestigeLabel ||
    newPrestige.nextPrestigeLabel ||
    '';

  const pointsToNextPrestige = Number(
    xpEvent.pointsToNextPrestige ??
    newPrestige.pointsToNextPrestige ??
    0
  );

  const pointsToNextRank = Number(xpEvent.pointsToNextRank || 0);
  const nextRank = xpEvent.nextRank || '';

const initialPrestigeDisplay = isProphet
  ? getInitialPrestigeLabel(xpEvent)
  : '—';

const finalPrestigeDisplay = isProphet
  ? getFinalPrestigeLabel(xpEvent)
  : '—';

const currentVisualRankKey = getVisualRankKeyFromState(
  currentRank,
  initialPrestigeDisplay
);

const finalGoalText = nextGoalPreview
  ? `${nextGoalPreview.rank} te espera a los ${nextGoalPreview.requiredXp.toLocaleString('es-ES')} LP. ${nextGoalPreview.note}`
  : isProphet
    ? 'Prestigio máximo Prophetia alcanzado'
    : 'Rango máximo Prophetia alcanzado';
  box.hidden = false;
box.classList.add('success-xp--legacy');
setSuccessVisualRank(box, currentVisualRankKey);

  box.innerHTML = `
    <div class="success-xp__aura" aria-hidden="true"></div>

    <p class="success-xp__kicker">Prophetia Tribe</p>

    <h2 class="success-xp__title">
     +<span data-xp-earned>0</span> LP
    </h2>

    <p class="success-xp__ritual">
      ${escapeHtml(getXpRitualText(xpEvent))}
    </p>

    <div class="success-xp__prestige">
      <div class="success-xp__prestigeItem success-xp__prestigeItem--rank">
        <div class="success-xp__rankIdentity">
          <div class="success-xp__rankText">
            <span class="success-xp__label">Rango actual</span>
            <strong data-xp-rank>${escapeHtml(currentRank)}</strong>
            <small data-xp-rank-copy>${escapeHtml(getXpRankMicrocopy(currentRank, xpEvent))}</small>
          </div>

          <div class="success-xp__rankEmblem" aria-hidden="true">
            <span class="success-xp__rankEmblemAura"></span>
<img
  data-xp-rank-emblem
  data-rank-emblem="${escapeHtml(currentVisualRankKey)}"
  src="${escapeHtml(getRankEmblemSrc(currentVisualRankKey))}"
  alt=""
  loading="eager"
  decoding="async"
>
          </div>
        </div>
      </div>

      <div class="success-xp__prestigeItem success-xp__prestigeItem--prestige">
        <span class="success-xp__label">Prestigio</span>
        <strong data-xp-prestige>${escapeHtml(initialPrestigeDisplay)}</strong>
        <small>Emblema de legado</small>
      </div>
    </div>

    <div class="success-xp__legacy">
      <span>LEGADO</span>
      <strong data-xp-lifetime>${formatLegacyPoints(lifetimePoints)}</strong>
    </div>

    <div class="success-xp__rank">
      <strong data-xp-rank-inline>${escapeHtml(currentRank)}</strong>
      <span data-xp-text>Calculando legado...</span>
    </div>

    <div class="success-xp__bar" aria-label="Progreso de rango Prophetia">
      <span class="success-xp__segments" aria-hidden="true"></span>
      <span class="success-xp__fill" data-xp-fill></span>
      <span class="success-xp__gloss" aria-hidden="true"></span>
      <span class="success-xp__pulse" aria-hidden="true"></span>
    </div>

    <p class="success-xp__note" data-xp-note>
      ${escapeHtml(finalGoalText)}
    </p>


  `;
  if (nextGoalPreview) {
    const preview = document.createElement('aside');

    preview.className = `success-xp__nextRank ${
      nextGoalPreview.type === 'prestige'
        ? 'success-xp__nextRank--prestige'
        : ''
    }`.trim();

    preview.setAttribute('aria-label', 'Siguiente objetivo Prophetia Tribe');

    preview.innerHTML = `
      <div class="success-xp__nextRankCopy">
        <span>${escapeHtml(nextGoalPreview.eyebrow)}</span>
        <strong>${escapeHtml(nextGoalPreview.rank)}</strong>
        <p>${escapeHtml(nextGoalPreview.note)}</p>
      </div>

      <div class="success-xp__nextRankEmblem" aria-hidden="true">
        <span></span>
        <img
          src="${escapeHtml(nextGoalPreview.emblemSrc)}"
          data-rank-emblem="${escapeHtml(nextGoalPreview.rankId)}"
          alt=""
          loading="eager"
          decoding="async"
        >
      </div>
    `;

    box.appendChild(preview);
  }
  const rankEl = box.querySelector('[data-xp-rank]');
  const rankInlineEl = box.querySelector('[data-xp-rank-inline]');
  const rankEmblemEl = box.querySelector('[data-xp-rank-emblem]');
    const rankCopyEl = box.querySelector('[data-xp-rank-copy]');
  const prestigeEl = box.querySelector('[data-xp-prestige]');
  const textEl = box.querySelector('[data-xp-text]');
  const fillEl = box.querySelector('[data-xp-fill]');
  const barEl = box.querySelector('.success-xp__bar');
  const noteEl = box.querySelector('[data-xp-note]');
  const earnedEl = box.querySelector('[data-xp-earned]');
    if (
    !rankEl ||
    !rankInlineEl ||
    !textEl ||
    !fillEl ||
    !noteEl ||
    !earnedEl
  ) {
    console.error('[checkout-success] No se pudo renderizar el bloque XP correctamente.');
    box.dataset.animating = 'false';
    return;
  }

  const animateEarnedXp = () => {
    const duration = 1100;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);

      earnedEl.textContent = String(Math.round(pointsEarned * eased));

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        earnedEl.textContent = String(pointsEarned);
      }
    };

    requestAnimationFrame(tick);
  };

playSuccessSound(getXpEventSoundType(xpEvent));
animateEarnedXp();

  await wait(420);

  for (const step of safeSteps) {
     if (step.type === 'fill') {
      const rankName = step.rank || currentRank;
      const stepPrestigeLabel =
  step.prestigeLabel ||
  (
    hasPrestigeUnlockStep(xpEvent)
      ? initialPrestigeDisplay
      : finalPrestigeDisplay
  );
      const targetLabel =
  step.nextPrestigeLabel ||
  xpEvent.nextPrestigeLabel ||
  xpEvent.newPrestige?.nextPrestigeLabel ||
  step.nextRank ||
  xpEvent.nextRank ||
  nextGoalPreview?.rank ||
  '';

      const fromPercent = Math.max(0, Math.min(100, Number(step.fromPercent || 0)));
      const toPercent = Math.max(0, Math.min(100, Number(step.toPercent || 0)));

      rankEl.textContent = rankName;
      rankInlineEl.textContent = rankName;

      if (rankCopyEl) {
        rankCopyEl.textContent = getXpRankMicrocopy(rankName, xpEvent);
      }

const stepVisualRankKey = getVisualRankKeyFromState(rankName, stepPrestigeLabel);

setSuccessVisualRank(box, stepVisualRankKey);

if (rankEmblemEl) {
  rankEmblemEl.src = getRankEmblemSrc(stepVisualRankKey);
  rankEmblemEl.setAttribute('data-rank-emblem', normalizeRankId(stepVisualRankKey));
}

      if (prestigeEl && String(rankName).toLowerCase() === 'prophet') {
        prestigeEl.textContent = stepPrestigeLabel || 'Prophet Base';
      }

noteEl.textContent = nextGoalPreview?.note
  ? nextGoalPreview.note
  : targetLabel
    ? `Progreso hacia ${targetLabel}`
    : isProphet
      ? 'Prestigio máximo Prophetia alcanzado'
      : 'Legado Prophetia consolidado';

      barEl?.classList.add('is-charging');

      await wait(360);

      await animateXpFill({
        fillEl,
        textEl,
        fromPercent,
        toPercent,
        fromText: step.fromText || '',
        toText: step.toText || '',
        duration: 4200
      });

      barEl?.classList.remove('is-charging');
      barEl?.classList.add('is-settled');

      await wait(900);

      barEl?.classList.remove('is-settled');
    }

    if (step.type === 'level-up') {
      box.classList.add('is-level-up');

const toRank = step.toRank || xpEvent.newRank || 'Nuevo rango';
const levelUpVisualRankKey = normalizeRankId(toRank);

setSuccessVisualRank(box, levelUpVisualRankKey);

rankEl.textContent = toRank;
rankInlineEl.textContent = toRank;

      if (rankCopyEl) {
        rankCopyEl.textContent = getXpRankMicrocopy(toRank, xpEvent);
      }

      if (rankEmblemEl) {
        rankEmblemEl.src = getRankEmblemSrc(toRank);
        rankEmblemEl.setAttribute('data-rank-emblem', normalizeRankId(toRank));
      }
      noteEl.textContent = `Ascenso desbloqueado: ${toRank}`;
playSuccessSound('rank');
      if (navigator.vibrate) {
        try {
          navigator.vibrate([22, 48, 30]);
        } catch {}
      }

      await wait(1450);

      fillEl.style.transition = 'none';
fillEl.style.transform = 'scaleX(0)';
fillEl.offsetHeight;

      box.classList.remove('is-level-up');

      await wait(340);
    }

if (step.type === 'prestige-up') {
  box.classList.add('is-level-up', 'is-prestige-up', 'is-prestige-i');

      const toPrestige =
  step.toPrestige ||
  xpEvent.newPrestige?.prestigeLabel ||
  xpEvent.prestigeLabel ||
  finalPrestigeDisplay ||
  'Nuevo prestigio';

      rankEl.textContent = 'Prophet';
      rankInlineEl.textContent = 'Prophet';

      if (rankCopyEl) {
        rankCopyEl.textContent = getXpRankMicrocopy('Prophet', xpEvent);
      }

const prestigeVisualRankKey = getVisualRankKeyFromState('Prophet', toPrestige);

setSuccessVisualRank(box, prestigeVisualRankKey);

if (rankEmblemEl) {
  rankEmblemEl.src = getRankEmblemSrc(prestigeVisualRankKey);
  rankEmblemEl.setAttribute('data-rank-emblem', normalizeRankId(prestigeVisualRankKey));
}
      if (prestigeEl) {
        prestigeEl.textContent = toPrestige;
      }

      noteEl.textContent = `Prestigio desbloqueado: ${toPrestige}`;
playSuccessSound('prestige');
      if (navigator.vibrate) {
        try {
          navigator.vibrate([30, 60, 34]);
        } catch {}
      }

      await wait(1650);

fillEl.style.transition = 'none';
fillEl.style.transform = 'scaleX(0)';
fillEl.offsetHeight;

      box.classList.remove('is-level-up', 'is-prestige-up');
box.classList.add('has-prestige-i');

      await wait(420);
    }
  }

noteEl.textContent = nextGoalPreview?.note || finalGoalText;
box.dataset.animating = 'false';
}
function renderUnlockedRewards(xpEvent = {}) {
  const box = document.getElementById('ppSuccessRewards');
  if (!box) return;

  const rewards = Array.isArray(xpEvent.unlockedRewards)
    ? xpEvent.unlockedRewards.filter((reward) => {
        return reward?.type === 'rank_discount' && reward.code && Number(reward.percent || 0) > 0;
      })
    : [];

  if (!rewards.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }

  const title =
    rewards.length > 1
      ? 'Has desbloqueado nuevas recompensas privadas'
      : `Has desbloqueado ${rewards[0].rank || 'Tribe'} Reward — ${Number(rewards[0].percent || 0)}%`;

  box.hidden = false;

  box.innerHTML = `
    <p class="success-rewards__kicker">Prophetia Tribe</p>

    <h2 class="success-rewards__title">
      ${escapeHtml(title)}
    </h2>

    <p class="success-rewards__text">
      Tu código privado ya está disponible en Mi perfil. También lo recibirás por email si tu cuenta tiene notificaciones activas.
    </p>

    <div class="success-rewards__list">
      ${rewards.map((reward) => {
        const rank = reward.rank || 'Tribe';
        const percent = Number(reward.percent || 0);
        const minSubtotal = Number(reward.minSubtotal || 0);
        const code = String(reward.code || '').trim().toUpperCase();

        return `
          <article class="success-rewards__item">
            <div>
              <p class="success-rewards__name">
                ${escapeHtml(rank)} Reward — ${percent}%
              </p>
              <p class="success-rewards__meta">
                Pedido mínimo: ${minSubtotal} €
              </p>
            </div>

            <code>${escapeHtml(code)}</code>
          </article>
        `;
      }).join('')}
    </div>

    <a class="success-rewards__link" href="/my-content">
      Ver en Mi perfil
    </a>
  `;
}
async function waitForSuccessFirebaseUser(timeoutMs = 5000) {
  const directUser =
    window.__ppFirebaseAuth?.currentUser ||
    window.__ppAuthCurrentUser ||
    window.__ppLastUser ||
    null;

  if (directUser?.getIdToken) return directUser;

  try {
    await window.__ppFirebaseAuthReady;
  } catch {}

  const readyUser =
    window.__ppFirebaseAuth?.currentUser ||
    window.__ppAuthCurrentUser ||
    window.__ppLastUser ||
    null;

  if (readyUser?.getIdToken) return readyUser;

  return new Promise((resolve) => {
    let done = false;

    const finish = (user = null) => {
      if (done) return;
      done = true;
      window.removeEventListener('pp:auth-changed', onAuthChanged);
      resolve(user?.getIdToken ? user : null);
    };

    const onAuthChanged = (event) => {
      finish(event.detail?.user || null);
    };

    window.addEventListener('pp:auth-changed', onAuthChanged);

    window.setTimeout(() => {
      finish(
        window.__ppFirebaseAuth?.currentUser ||
        window.__ppAuthCurrentUser ||
        window.__ppLastUser ||
        null
      );
    }, timeoutMs);
  });
}
    function setSuccessHeading(state = 'checking') {
      const kicker = document.querySelector('.success-kicker');
      const title = document.querySelector('.success-title');
      const copy = {
        checking: ['Confirmación de pedido', 'Comprobando tu pago', 'Confirmación de pedido — PROPHETIA'],
        paid: ['Pedido confirmado', 'Gracias por tu pedido', 'Pedido confirmado — PROPHETIA'],
        pending: ['Pago en comprobación', 'Tu pedido está pendiente', 'Pago en comprobación — PROPHETIA'],
        error: ['Confirmación no disponible', 'No podemos mostrar este pedido', 'Confirmación no disponible — PROPHETIA']
      }[state] || null;

      if (!copy) return;
      if (kicker) kicker.textContent = copy[0];
      if (title) title.textContent = copy[1];
      document.title = copy[2];
    }

    async function loadOrder() {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');

      const status = document.getElementById('status');
      const orderSummary = document.getElementById('orderSummary');
      const orderItems = document.getElementById('orderItems');
      const orderBox = document.getElementById('orderBox');

      if (!sessionId) {
        setSuccessHeading('error');
        status.textContent = 'No se ha recibido session_id.';
        status.classList.add('success-error');
        return;
      }

      try {
        const headers = {};
        let successUser = null;

try {
  const user = await waitForSuccessFirebaseUser();
  successUser = user;

  if (user?.getIdToken) {
    const token = await user.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  }
} catch (error) {
  console.warn('[checkout-success] No se pudo obtener token Firebase:', error);
}
const res = await fetch(`/api/order-by-session?session_id=${encodeURIComponent(sessionId)}`, {
  headers
});

        const raw = await res.text();
        let data = {};

        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error('El servidor no ha devuelto un pedido válido. Revisa /api/order-by-session en server.js.');
        }

        if (!res.ok) {
          throw new Error(data.error || 'No se pudo recuperar el pedido.');
        }

        const order = data.order || {};
        const currency = order.currency || 'EUR';
        const isPaid = order.status === 'paid' || order.paymentStatus === 'paid';
        setSuccessHeading(isPaid ? 'paid' : 'pending');

        status.textContent = isPaid
          ? 'Pedido pagado correctamente. Recibirás la confirmación en tu correo electrónico.'
          : 'Pedido pendiente de confirmación. Si el pago se ha realizado, puede tardar unos minutos.';

        orderSummary.innerHTML = `
          <div class="success-row">
            <div class="success-label">Estado</div>
            <div class="success-value">${isPaid ? 'Pagado' : 'Pendiente de confirmación'}</div>
          </div>

          <div class="success-row">
            <div class="success-label">Número de pedido</div>
            <div class="success-value">${escapeHtml(order.orderNumber || order.orderDraftId || '')}</div>
          </div>

          <div class="success-row">
            <div class="success-label">Email</div>
            <div class="success-value">${escapeHtml(order.customerEmail || '')}</div>
          </div>

          <div class="success-row">
            <div class="success-label">Subtotal</div>
            <div class="success-value">${money(order.subtotal, currency)}</div>
          </div>

          <div class="success-row">
            <div class="success-label">Envío</div>
            <div class="success-value">${escapeHtml(successShippingLabel(order, currency))}</div>
          </div>
          <div class="success-row">
  <div class="success-label">Entrega estimada</div>
  <div class="success-value">${escapeHtml(successDeliveryLabel(order))}</div>
</div>

          <div class="success-row">
            <div class="success-label">Total</div>
            <div class="success-value">${money(order.total ?? order.amountTotal, currency)}</div>
          </div>
        `;

        const items = Array.isArray(order.items) ? order.items : [];

        orderItems.innerHTML = items.map((item) => {
          const meta = [
            item.color ? `Color: ${item.color}` : '',
            item.size ? `Talla: ${item.size}` : '',
            item.qty ? `Cantidad: ${item.qty}` : ''
          ].filter(Boolean);

          return `
            <article class="success-item">
             <img class="success-item__img" src="${escapeHtml(item.img || 'assets/img/placeholder.png')}" alt="${escapeHtml(item.title || 'Producto Prophetia')}">
              <div>
                <strong class="success-item__title">${escapeHtml(item.title || 'Producto Prophetia')}</strong>
                ${meta.map((line) => `<span class="success-item__meta">${escapeHtml(line)}</span>`).join('')}
              </div>
              <div class="success-item__price">
                ${money(item.lineTotal || item.unitPrice, currency)}
              </div>
            </article>
          `;
        }).join('');

        orderBox.textContent = JSON.stringify(order, null, 2);
        renderGuestAccountInvite(order, { sessionId });

      if (isPaid) {
  clearPurchasedCart(successUser);

  if (isGuestSuccessOrder(order)) {
    try {
      sessionStorage.removeItem('pp_pending_xp_sound_type');
    } catch {}
  }

if (canExposeSuccessXpEvent(order, successUser) && order.tribeXpEvent && Number(order.tribeXpEvent.pointsEarned || 0) > 0) {
  const exposedXpEvent = {
    ...order.tribeXpEvent,
    customerType: 'account',
    checkoutMode: 'account'
  };
  const xpSoundType = getXpEventSoundType(exposedXpEvent);

  try {
    sessionStorage.setItem('pp_pending_xp_sound_type', xpSoundType);
  } catch {}

  const xpEventStorageKey = getSuccessAccountStorageKey('pp_tribe_xp_event', successUser);

  if (xpEventStorageKey) {
    localStorage.setItem(xpEventStorageKey, JSON.stringify({
      ...exposedXpEvent,
      storedAt: Date.now()
    }));
  }

  playSuccessXpAnimation(exposedXpEvent);
  renderUnlockedRewards(exposedXpEvent);
}
}
      } catch (err) {
        setSuccessHeading('error');
        status.textContent = err.message;
        status.classList.add('success-error');
        orderSummary.innerHTML = '';
        orderItems.innerHTML = '';
        orderBox.textContent = '';
      }
    }

  bindXpSoundNavigation();
loadOrder();

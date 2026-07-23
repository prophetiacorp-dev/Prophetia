// assets/js/tribe-xp-toast.js
// =====================================================
// PROPHETIA · Tribe XP Toast
// Muestra barra de experiencia tras una compra pagada
// =====================================================

(() => {
  const STORAGE_KEY = 'pp_tribe_xp_event';
  const MAX_EVENT_AGE_MS = 1000 * 60 * 30;
  const SHOWN_KEY_PREFIX = 'pp_tribe_xp_shown:';
  let lastShownSignature = '';
  let claimFetchInFlight = false;
  let claimCheckedUid = '';

  function safeParse(raw) {
    try {
      return JSON.parse(raw || '');
    } catch {
      return null;
    }
  }

  function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Number(value || 0)));
  }
function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
function formatLegacyPoints(value = 0) {
  return `${Number(value || 0).toLocaleString('es-ES')} LP`;
}

function replaceXpWithLp(value = '') {
  return String(value || '').replace(/\bXP\b/g, 'LP');
}
  function getRawToastUser() {
    return window.__ppFirebaseAuth?.currentUser || window.__ppAuthCurrentUser || window.__ppLastUser || null;
  }

  function getVerifiedToastUser(rawUser = getRawToastUser()) {
    const uid = String(rawUser?.uid || '').trim();
    const email = String(rawUser?.email || '').trim().toLowerCase();

    if (!uid || !email || rawUser.emailVerified === false) return null;

    return { rawUser, uid, email };
  }

  function isGuestToastEvent(event = {}) {
    const customerType = String(event.customerType || event.checkoutMode || '').trim().toLowerCase();

    return customerType === 'guest' || event.guestCheckout === true || event.guestCheckout === 'yes';
  }

  function toastEventBelongsToUser(event = {}, user = null) {
    if (!user || isGuestToastEvent(event)) return false;

    const eventEmail = String(event.email || event.customerEmail || event.userEmail || '').trim().toLowerCase();
    const eventUid = String(event.firebaseUid || event.uid || event.userId || '').trim();

    if (eventUid && eventUid !== user.uid) return false;
    if (eventEmail && eventEmail !== user.email) return false;

    return Boolean(eventUid || eventEmail);
  }

  function getShownEventKey(event = {}, user = null) {
    if (!user) return '';

    return `${SHOWN_KEY_PREFIX}${user.uid}:${getXpEventSignature(event)}`;
  }

  function hasEventBeenShownForUser(event = {}, user = null) {
    const key = getShownEventKey(event, user);
    if (!key) return false;

    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  }

  function markEventShownForUser(event = {}, user = null) {
    const key = getShownEventKey(event, user);
    if (!key) return;

    try {
      localStorage.setItem(key, '1');
    } catch {}
  }

  async function tryShowClaimedXpAfterLogin() {
    const user = getVerifiedToastUser();

    if (!user || !user.rawUser?.getIdToken || claimFetchInFlight || claimCheckedUid === user.uid) return;

    claimFetchInFlight = true;
    claimCheckedUid = user.uid;

    try {
      const token = await user.rawUser.getIdToken();
      const response = await fetch('/api/tribe/me', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });

      if (!response.ok) return;

      const data = await response.json();
      const claimedEvents = Array.isArray(data.claimedXpEvents) ? data.claimedXpEvents : [];
      const claimedEvent = data.claimedXpEvent || claimedEvents[claimedEvents.length - 1] || null;

      if (claimedEvent) {
        showToastEvent(claimedEvent);
      }
    } catch (error) {
      console.warn('[tribe-xp-toast] No se pudo consultar LP pendientes:', error);
    } finally {
      claimFetchInFlight = false;
    }
  }
 function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
function animateToastFill({
  fillEl,
  metaXpEl,
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

    const startPercent = clamp(fromPercent);
    const endPercent = clamp(toPercent);
    const start = performance.now();

    fillEl.style.transition = 'none';
    fillEl.style.transformOrigin = 'left center';
    fillEl.style.transform = `scaleX(${startPercent / 100})`;

    if (metaXpEl) {
     metaXpEl.textContent = replaceXpWithLp(fromText) || '';
    }

    const easeInOutQuad = (t) => {
      return t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
    };

    const tick = (now) => {
      const elapsed = now - start;
      const rawProgress = Math.min(1, elapsed / duration);
      const eased = easeInOutQuad(rawProgress);
      const currentPercent = startPercent + ((endPercent - startPercent) * eased);

      fillEl.style.transform = `scaleX(${currentPercent / 100})`;

      if (metaXpEl) {
        metaXpEl.textContent = rawProgress < 1
          ? `${currentPercent.toFixed(1)}%`
          : replaceXpWithLp(toText) || `${endPercent}%`;
      }

      if (rawProgress < 1) {
        requestAnimationFrame(tick);
      } else {
        fillEl.style.transform = `scaleX(${endPercent / 100})`;

        if (metaXpEl) {
          metaXpEl.textContent = replaceXpWithLp(toText) || '';
        }

        resolve();
      }
    };

    requestAnimationFrame(tick);
  });
}
const PP_AUDIO = {
  xp: '/assets/audio/xpgain.mp3',
  rank: '/assets/audio/tribetoast.mp3',
  prestige: '/assets/audio/prestige.mp3'
};

function playProphetiaSound(type = 'xp', toast = null) {
  if (wasXpSoundRecentlyPlayed()) {
    return Promise.resolve(true);
  }

  const src = PP_AUDIO[type] || PP_AUDIO.xp;

  try {
    const audio = new Audio(src);

    audio.volume = type === 'xp' ? 0.34 : 0.48;
    audio.preload = 'auto';

    const playPromise = audio.play();

    if (playPromise?.then) {
      return playPromise
        .then(() => true)
        .catch((error) => {
          console.warn('[Prophetia audio] El navegador bloqueó el sonido:', error?.name || error);

          // No mostramos botón de sonido: el desbloqueo se intenta en checkout-success
// usando el clic natural de “Volver al inicio”.
         // if (toast) {
            //showAudioUnlockButton(toast, type);//
          //}//

          return false;
        });
    }

    return Promise.resolve(true);
  } catch (error) {
    console.warn('[Prophetia audio] No se pudo reproducir:', error);
    return Promise.resolve(false);
  }
}
function wasXpSoundRecentlyPlayed() {
  try {
    const playedAt = Number(sessionStorage.getItem('pp_xp_sound_played_at') || 0);

    return playedAt > 0 && Date.now() - playedAt < 12000;
  } catch {
    return false;
  }
}
function showAudioUnlockButton(toast, type = 'xp') {
  if (!toast || toast.querySelector('[data-pp-audio-unlock]')) return;

  const content = toast.querySelector('.pp-xpToast__content');
  if (!content) return;

  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'pp-xpToast__audioUnlock';
  button.setAttribute('data-pp-audio-unlock', '');
  button.textContent = 'Activar sonido';

  button.addEventListener('click', async () => {
    const played = await playProphetiaSound(type, null);

    if (played) {
      button.remove();
    }
  });

  const cta = content.querySelector('.pp-xpToast__cta');

  if (cta) {
    cta.insertAdjacentElement('afterend', button);
  } else {
    content.appendChild(button);
  }
}
const TRIBE_TOAST_PRESTIGE_GOALS = [
  {
    id: 'prestige-i',
    label: 'Prestige I',
    fromXp: 1000,
    requiredXp: 1500,
    visualRankKey: 'prestige-i',
    isCurrentMax: true
  }

  /*
  Futuro Prestige II:

  {
    id: 'prestige-ii',
    label: 'Prestige II',
    fromXp: 1500,
    requiredXp: 2500,
    visualRankKey: 'prestige-ii',
    isCurrentMax: true
  }

  Cuando se active Prestige II:
  - quitar isCurrentMax de Prestige I
  - añadir emblema en getRankEmblemSrc()
  - añadir tema en getRankTheme()
  - añadir CSS .pp-xpToast.rank-prestige-ii
  */
];

function getNextToastPrestigeGoal(lifetimePoints = 0) {
  const points = Number(lifetimePoints || 0);

  return TRIBE_TOAST_PRESTIGE_GOALS.find((goal) => {
    const fromXp = Number(goal.fromXp || 0);
    const requiredXp = Number(goal.requiredXp || 0);

    return points >= fromXp && points < requiredXp;
  }) || null;
}
function getLastFillStep(event) {
  const steps = Array.isArray(event.xpAnimationSteps) ? event.xpAnimationSteps : [];
  const fills = steps.filter((step) => step?.type === 'fill');

  return fills[fills.length - 1] || null;
}

function getInitialFillStep(event) {
  const steps = Array.isArray(event.xpAnimationSteps) ? event.xpAnimationSteps : [];
  const fills = steps.filter((step) => step?.type === 'fill');

  return fills[0] || null;
}

function getToastProgress(event) {
  const firstFill = getInitialFillStep(event);
  const lastFill = getLastFillStep(event);
  const newPrestige = event.newPrestige || {};

  const lifetimePoints = Number(
    event.newLifetimePoints ||
    event.lifetimePoints ||
    event.newPoints ||
    0
  );

  const previousLifetimePoints = Number(
    event.previousLifetimePoints ||
    event.oldLifetimePoints ||
    0
  );

  const hasPrestigeUnlock = !!event.prestigeUnlocked ||
    (Array.isArray(event.xpAnimationSteps) &&
      event.xpAnimationSteps.some((step) => step?.type === 'prestige-up'));

  const initialRank =
    firstFill?.rank ||
    event.previousRank ||
    event.newRank ||
    'member';

  const finalRank =
    event.newRank ||
    lastFill?.rank ||
    event.previousRank ||
    initialRank;

  const initialPrestigeLabel =
    firstFill?.prestigeLabel ||
    event.previousPrestigeLabel ||
    (
      hasPrestigeUnlock
        ? 'Prophet Base'
        : event.prestigeLabel || newPrestige.prestigeLabel || ''
    );

  const finalPrestigeLabel =
    event.prestigeLabel ||
    newPrestige.prestigeLabel ||
    lastFill?.prestigeLabel ||
    initialPrestigeLabel ||
    '';

  const currentRank = hasPrestigeUnlock ? initialRank : finalRank;
  const currentRankId = normalizeRankId(currentRank);

  const isProphet =
    currentRankId === 'prophet' ||
    normalizeRankId(finalRank) === 'prophet' ||
    lifetimePoints >= 1000;

  const prestigeGoal = isProphet
    ? getNextToastPrestigeGoal(lifetimePoints)
    : null;

  const explicitPointsToNextPrestige = Number(
    event.pointsToNextPrestige ??
    newPrestige.pointsToNextPrestige ??
    0
  );

  const nextPrestigeLabel =
    event.nextPrestigeLabel ||
    newPrestige.nextPrestigeLabel ||
    lastFill?.nextPrestigeLabel ||
    prestigeGoal?.label ||
    '';

  const nextPrestigeAt = Number(
    event.nextPrestigeAt ||
    newPrestige.nextPrestigeAt ||
    prestigeGoal?.requiredXp ||
    0
  );

  const pointsToNextPrestige = explicitPointsToNextPrestige > 0
    ? explicitPointsToNextPrestige
    : nextPrestigeAt > lifetimePoints
      ? nextPrestigeAt - lifetimePoints
      : 0;

  const nextRank = isProphet
    ? nextPrestigeLabel || null
    : lastFill?.nextRank || event.nextRank || null;

  return {
    fromPercent: clamp(firstFill?.fromPercent ?? event.previousProgressPercent ?? 0),
    toPercent: clamp(lastFill?.toPercent ?? event.newProgressPercent ?? 0),
    fromText: firstFill?.fromText || '',
    toText: lastFill?.toText || '',
    lifetimePoints,
    previousLifetimePoints,
    currentRank,
    currentRankId,
    finalRank,
    initialPrestigeLabel,
    prestigeLabel: isProphet
      ? initialPrestigeLabel || 'Prophet Base'
      : '',
    finalPrestigeLabel: isProphet
      ? finalPrestigeLabel || 'Prophet Base'
      : '',
    nextRank,
    nextPrestigeLabel,
    pointsToNextPrestige,
    hasPrestigeUnlock
  };
}

async function animateToastXp({ toast, event, fill, rankEl, metaXpEl, noteEl }) {
  const steps = Array.isArray(event.xpAnimationSteps) ? event.xpAnimationSteps : [];

if (!steps.length) {
  const progress = getToastProgress(event);
  const barEl = fill?.closest('.pp-xpToast__bar');

  fill.style.transition = 'none';
  fill.style.transform = `scaleX(${progress.fromPercent / 100})`;
  fill.offsetHeight;

  await wait(420);

  barEl?.classList.add('is-charging');

  await animateToastFill({
    fillEl: fill,
    metaXpEl,
    fromPercent: progress.fromPercent,
    toPercent: progress.toPercent,
    fromText: progress.fromText,
    toText: progress.toText,
    duration: 3600
  });

  barEl?.classList.remove('is-charging');
  barEl?.classList.add('is-settled');

  await wait(850);

  barEl?.classList.remove('is-settled');

rankEl.textContent =
  progress.currentRankId === 'prophet' && progress.prestigeLabel
    ? `Prophet · ${progress.prestigeLabel}`
    : progress.currentRank;

const isProphetProgress = String(progress.currentRank).toLowerCase() === 'prophet';
const pointsToNextGoal = isProphetProgress
  ? Number(progress.pointsToNextPrestige || 0)
  : Number(event.pointsToNextRank || 0);

noteEl.innerHTML = pointsToNextGoal > 0 && progress.nextRank
  ? `Faltan <strong>${pointsToNextGoal}</strong> LP para ${escapeHtml(progress.nextRank)}.`
  : isProphetProgress
    ? `Prestige activo. Nuevos círculos de prestigio podrán revelarse en futuras temporadas.`
    : `Has alcanzado el rango máximo Prophetia.`;

    return;
  }

  for (const step of steps) {
if (step.type === 'fill') {
  const progress = getToastProgress(event);

  const stepRank =
    step.rank ||
    event.previousRank ||
    event.newRank ||
    'member';

  const stepPrestigeLabel =
    step.prestigeLabel ||
    event.previousPrestigeLabel ||
    (
      event.prestigeUnlocked
        ? 'Prophet Base'
        : progress.prestigeLabel || event.prestigeLabel || event.newPrestige?.prestigeLabel || ''
    );

  const stepVisualRankKey = getVisualRankKeyFromState(stepRank, stepPrestigeLabel);

  setToastVisualRank(toast, stepVisualRankKey);

  const barEl = fill?.closest('.pp-xpToast__bar');

  rankEl.textContent =
    String(stepRank).toLowerCase() === 'prophet' && stepPrestigeLabel
      ? `Prophet · ${stepPrestigeLabel}`
      : stepRank;

  const stepRankId = normalizeRankId(stepRank);
  const isProphetStep = stepRankId === 'prophet';

  const pointsToNextGoal = isProphetStep
    ? Number(progress.pointsToNextPrestige || 0)
    : Number(event.pointsToNextRank || 0);

  const targetLabel =
    step.nextPrestigeLabel ||
    event.nextPrestigeLabel ||
    event.newPrestige?.nextPrestigeLabel ||
    step.nextRank ||
    event.nextRank ||
    (
      isProphetStep && pointsToNextGoal > 0
        ? 'Prestige I'
        : ''
    );

  noteEl.innerHTML = targetLabel && pointsToNextGoal > 0
   ? `Faltan <strong>${pointsToNextGoal}</strong> LP para ${escapeHtml(targetLabel)}.`
    : targetLabel
      ? `Progreso hacia <strong>${escapeHtml(targetLabel)}</strong>.`
      : isProphetStep
        ? `Prestige activo. Nuevos círculos de prestigio podrán revelarse en futuras temporadas.`
        : `Has alcanzado el rango máximo Prophetia.`;

  barEl?.classList.add('is-charging');

  await wait(260);

  await animateToastFill({
    fillEl: fill,
    metaXpEl,
    fromPercent: step.fromPercent,
    toPercent: step.toPercent,
    fromText: step.fromText || '',
    toText: step.toText || '',
    duration: 3600
  });

  barEl?.classList.remove('is-charging');
  barEl?.classList.add('is-settled');

  await wait(680);

  barEl?.classList.remove('is-settled');
}
    if (step.type === 'level-up') {
      const rankTheme = getRankTheme(step.toRank);

      toast.classList.add('is-level-up', `rank-${rankTheme.id}`);
      toast.dataset.rank = rankTheme.id;

      rankEl.textContent = step.toRank || event.newRank || 'Nuevo rango';
      noteEl.innerHTML = `Nuevo rango desbloqueado: <strong>${escapeHtml(step.toRank || event.newRank)}</strong>.`;

spawnGoldParticles(toast);
playProphetiaSound('rank', toast);
playSoftChime();
triggerHaptic();

      await wait(1050);

fill.style.transition = 'none';
fill.style.transform = 'scaleX(0)';
fill.offsetHeight;

      toast.classList.remove('is-level-up');

      await wait(320);
    }
if (step.type === 'prestige-up') {
  const toPrestige =
  step.toPrestige ||
  event.newPrestige?.prestigeLabel ||
  event.prestigeLabel ||
  'Prestige I';
  const prestigeVisualKey = getVisualRankKeyFromState('prophet', toPrestige);
  const rankTheme = getRankTheme(prestigeVisualKey);

  setToastVisualRank(toast, prestigeVisualKey);
const emblemImg = toast.querySelector('.pp-xpToast__emblem img');

if (emblemImg) {
  emblemImg.src = getRankEmblemSrc(prestigeVisualKey);
  emblemImg.dataset.rankEmblem = normalizeRankId(prestigeVisualKey);
}
  toast.classList.add('is-level-up');
  toast.dataset.rank = rankTheme.id;

      rankEl.textContent = `Prophet · ${toPrestige}`;
      noteEl.innerHTML = `Prestigio desbloqueado: <strong>${escapeHtml(toPrestige)}</strong>.`;

spawnGoldParticles(toast);
playProphetiaSound('prestige', toast);
playSoftChime();
triggerHaptic();

      await wait(1250);

fill.style.transition = 'none';
fill.style.transform = 'scaleX(0)';
fill.offsetHeight;

      toast.classList.remove('is-level-up');

      await wait(360);
    }
  }
}
function getVisualRankKeyFromState(rank = 'member', prestigeLabel = '') {
  const rankId = normalizeRankId(rank);
  const prestigeId = normalizeRankId(prestigeLabel);

  if (rankId !== 'prophet') {
    return rankId;
  }

  if (!prestigeId || prestigeId === 'prophet-base') {
    return 'prophet';
  }

  return prestigeId;
}

function setToastVisualRank(toast, visualRankKey = 'member') {
  if (!toast) return;

  const safeVisualRankKey = normalizeRankId(visualRankKey || 'member');
  const theme = getRankTheme(safeVisualRankKey);
  const img = toast.querySelector('.pp-xpToast__emblem img');

  const isVisible = toast.classList.contains('is-visible');
  const isLeaving = toast.classList.contains('is-leaving');
  const isLevelUp = toast.classList.contains('is-level-up');

  toast.className = [
    'pp-xpToast',
    `rank-${theme.id}`,
    isVisible ? 'is-visible' : '',
    isLeaving ? 'is-leaving' : '',
    isLevelUp ? 'is-level-up' : ''
  ].filter(Boolean).join(' ');

  toast.dataset.rank = theme.id;

  if (img) {
    img.src = getRankEmblemSrc(theme.id);
    img.dataset.rankEmblem = theme.id;
  }


}
function getToastSoundType(event = {}) {
  if (event.prestigeUnlocked) return 'prestige';
  if (event.initiationUnlocked) return 'rank';
  if (event.leveledUp) return 'rank';

  const steps = Array.isArray(event.xpAnimationSteps) ? event.xpAnimationSteps : [];

  if (steps.some((step) => step?.type === 'prestige-up')) return 'prestige';
  if (steps.some((step) => step?.type === 'level-up')) return 'rank';

  return 'xp';
}
function createToast(event) {
  const pointsEarned = Number(event.pointsEarned || 0);
  const lifetimePoints = Number(event.newLifetimePoints || 0);
  const progress = getToastProgress(event);

const rank = progress.currentRank || event.previousRank || event.newRank || 'member';
const rankId = normalizeRankId(rank);
const nextRank = progress.nextRank || event.nextRank || null;
const pointsToNextRank = Number(event.pointsToNextRank || 0);

const prestigeLabel = progress.prestigeLabel || '';
const visualRankKey = getVisualRankKeyFromState(rank, prestigeLabel);
const rankTheme = getRankTheme(visualRankKey);
const pointsToNextPrestige = Number(
  progress.pointsToNextPrestige ||
  event.pointsToNextPrestige ||
  event.newPrestige?.pointsToNextPrestige ||
  0
);
const leveledUp = !!event.leveledUp;
const prestigeUnlocked = !!event.prestigeUnlocked;
const initiationUnlocked = !!event.initiationUnlocked;
const isProphet = rankId === 'prophet';

const rankDisplay = isProphet && prestigeLabel
  ? `Prophet · ${prestigeLabel}`
  : rankTheme.id === 'member'
    ? 'Prophetia Member'
    : rankTheme.label || rank;
const titleMarkup = initiationUnlocked
  ? 'Initiate activado'
  : `+<span data-xp-count>0</span> LP añadidos`;

const microNextLabel = nextRank
  ? `Siguiente: ${escapeHtml(nextRank)}`
  : isProphet
    ? 'Prestigio máximo'
    : 'Rango máximo';

const initialNote = prestigeUnlocked
  ? 'Preparando nuevo prestigio...'
  : initiationUnlocked
    ? 'Tu primer rango ceremonial ha sido desbloqueado.'
    : leveledUp
      ? 'Preparando subida de rango...'
      : isProphet && pointsToNextPrestige > 0 && nextRank
        ? `Faltan <strong>${pointsToNextPrestige}</strong> LP para ${escapeHtml(nextRank)}.`
        : pointsToNextRank > 0 && nextRank
          ? `Faltan <strong>${pointsToNextRank}</strong> LP para ${escapeHtml(nextRank)}.`
: isProphet
  ? 'Prestige activo. Nuevos círculos de prestigio podrán revelarse en futuras temporadas.'
  : 'Has alcanzado el rango máximo Prophetia.';

  const toast = document.createElement('section');
  toast.className = `pp-xpToast rank-${rankTheme.id}`;
  toast.dataset.rank = rankTheme.id;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  toast.innerHTML = `
    <div class="pp-xpToast__inner">
      <div class="pp-xpToast__aura" aria-hidden="true"></div>

      <div class="pp-xpToast__emblem" aria-hidden="true">
        <span class="pp-xpToast__emblemAura"></span>
        <span class="pp-xpToast__emblemSheen"></span>
        
<img
  src="${escapeHtml(getRankEmblemSrc(visualRankKey))}"
  data-rank-emblem="${escapeHtml(rankTheme.id)}"
  alt=""
  loading="eager"
  decoding="async"
>
      </div>

      <div class="pp-xpToast__content">
        <p class="pp-xpToast__kicker">Prophetia Tribe</p>

      <h2 class="pp-xpToast__title">
  ${titleMarkup}
</h2>

        <div class="pp-xpToast__meta">
          <strong data-xp-rank>${escapeHtml(rankDisplay)}</strong>
          <span data-xp-total>${formatLegacyPoints(lifetimePoints)} total</span>
        </div>

        <div class="pp-xpToast__bar" aria-label="Progreso de rango">
          <span class="pp-xpToast__barTrack" aria-hidden="true"></span>
          <span class="pp-xpToast__barFill" style="transform:scaleX(${progress.fromPercent / 100})"></span>
          <span class="pp-xpToast__barGlow" aria-hidden="true"></span>
        </div>

        <div class="pp-xpToast__micro">
          <span data-xp-step>${escapeHtml(replaceXpWithLp(progress.fromText || ''))}</span>
          <span>${microNextLabel}</span>
        </div>

<p class="pp-xpToast__note">
  ${initialNote}
</p>

        <a class="pp-xpToast__cta" href="/my-content">Ver mi rango</a>
      </div>

      <button class="pp-xpToast__close" type="button" aria-label="Cerrar">
        ×
      </button>
    </div>
  `;

  document.body.appendChild(toast);
  applyRankTheme(toast, rankTheme);

  const fill = toast.querySelector('.pp-xpToast__barFill');
  const close = toast.querySelector('.pp-xpToast__close');
  const countEl = toast.querySelector('[data-xp-count]');
  const rankEl = toast.querySelector('[data-xp-rank]');
  const metaXpEl = toast.querySelector('[data-xp-step]');
  const noteEl = toast.querySelector('.pp-xpToast__note');

  toast.getBoundingClientRect();

const animateCount = () => {
  if (!countEl) return;

  const duration = 1100;
    const start = performance.now();

    const tick = (now) => {
      const progressValue = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progressValue, 3);

      countEl.textContent = String(Math.round(pointsEarned * eased));

      if (progressValue < 1) {
        requestAnimationFrame(tick);
      } else {
        countEl.textContent = String(pointsEarned);
      }
    };

    requestAnimationFrame(tick);
  };

window.setTimeout(() => {
  toast.classList.add('is-visible');

playProphetiaSound(getToastSoundType(event), toast);
animateCount();

  const animationPromise = animateToastXp({
    toast,
    event,
    fill,
    rankEl,
    metaXpEl,
    noteEl
  }).catch((error) => {
    console.warn('[Prophetia Tribe] No se pudo completar la animación XP:', error);
  });

  animationPromise.then(() => {
    window.setTimeout(remove, 1400);
  });
}, 40);

  const remove = () => {
    if (toast.classList.contains('is-leaving')) return;

    toast.classList.add('is-leaving');
    toast.classList.remove('is-visible');

    window.setTimeout(() => {
      toast.remove();
    }, 920);
  };

  close?.addEventListener('click', remove);

}
function normalizeRankId(rank) {
  const clean = String(rank || 'member')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  return clean === 'seer' ? 'archivist' : clean;
}

function getRankEmblemSrc(rank) {
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
}
function getRankTheme(rank) {
  const rankId = normalizeRankId(rank);

  const themes = {
    member: {
      id: 'member',
      label: 'Archivo abierto',
      particleCount: 6
    },
    initiate: {
      id: 'initiate',
      label: 'Initiate',
      particleCount: 10
    },
    adeptus: {
      id: 'adeptus',
      label: 'Adeptus',
      particleCount: 14
    },
    oracle: {
      id: 'oracle',
      label: 'Oracle',
      particleCount: 18
    },
    archivist: {
      id: 'archivist',
      label: 'Archivist',
      particleCount: 16
    },
    prophet: {
      id: 'prophet',
      label: 'Prophet',
      particleCount: 26
    },
    'prestige-i': {
      id: 'prestige-i',
      label: 'Prestige I',
      particleCount: 30
    },
    'prophet-prestige-1': {
      id: 'prestige-i',
      label: 'Prestige I',
      particleCount: 30
    }
  };

  return themes[rankId] || themes.member;
}

  function applyRankTheme(toast, rank) {
    if (!toast) return;

    const theme = typeof rank === 'string' ? getRankTheme(rank) : rank;

    toast.classList.add(`rank-${theme.id}`);
    toast.dataset.rank = theme.id;
  }

  function playSoftChime() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) return;

    try {
      const audio = new AudioContext();
      const now = audio.currentTime;

      const master = audio.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.025, now + 0.04);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
      master.connect(audio.destination);

      const notes = [392, 493.88, 659.25];

      notes.forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const start = now + index * 0.11;

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);

        oscillator.connect(gain);
        gain.connect(master);

        oscillator.start(start);
        oscillator.stop(start + 0.6);
      });

      window.setTimeout(() => {
        audio.close?.().catch(() => {});
      }, 1400);
    } catch {
      // El audio es una mejora estética. Si el navegador lo bloquea, no debe romper nada.
    }
  }

  function triggerHaptic() {
    if (!navigator.vibrate) return;

    try {
      navigator.vibrate([18, 42, 24]);
    } catch {
      // Vibración opcional. No todos los navegadores la permiten.
    }
  }

  function spawnGoldParticles(toast) {
    if (!toast) return;

    const themeId = toast.dataset.rank || 'member';
    const theme = getRankTheme(themeId);
    const inner = toast.querySelector('.pp-xpToast__inner') || toast;

    for (let i = 0; i < theme.particleCount; i += 1) {
      const particle = document.createElement('span');

      particle.className = 'pp-xpParticle';
      particle.setAttribute('aria-hidden', 'true');

      particle.style.setProperty('--x', `${Math.random() * 100}%`);
      particle.style.setProperty('--drift', `${Math.random() * 44 - 22}px`);
      particle.style.setProperty('--delay', `${Math.random() * 180}ms`);
      particle.style.setProperty('--scale', `${0.65 + Math.random() * 0.85}`);

      inner.appendChild(particle);

      window.setTimeout(() => {
        particle.remove();
      }, 1200);
    }
  }

  function getXpEventSignature(event = {}) {
    return [
      event.createdAt || event.storedAt || '',
      event.missionId || event.orderId || event.orderDraftId || '',
      event.pointsEarned || 0,
      event.previousLifetimePoints || 0,
      event.newLifetimePoints || 0
    ].join('|');
  }

  function normalizeToastEvent(detail = {}) {
    const event = detail.missionEvent || detail.xpEvent || detail.tribeXpEvent || detail;

    if (!event || typeof event !== 'object') return null;
    if (Number(event.pointsEarned || 0) <= 0) return null;

    return {
      ...event,
      storedAt: Number(event.storedAt || 0) || Date.now()
    };
  }

  function clearStoredXpEventSoon() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}

    window.setTimeout(() => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }, 160);
  }

  function showToastEvent(event) {
    const normalizedEvent = normalizeToastEvent(event);

    if (!normalizedEvent) return;

    const user = getVerifiedToastUser();

    if (!toastEventBelongsToUser(normalizedEvent, user)) return;

    const signature = getXpEventSignature(normalizedEvent);

    if (signature && signature === lastShownSignature) return;
    if (hasEventBeenShownForUser(normalizedEvent, user)) {
      clearStoredXpEventSoon();
      return;
    }

    lastShownSignature = signature;
    markEventShownForUser(normalizedEvent, user);
    clearStoredXpEventSoon();
    createToast(normalizedEvent);
  }

  function handleMissionCompleted(event) {
    const detail = event.detail || {};

    if (detail.completedNow === false && !detail.missionEvent) return;

    showToastEvent(detail);
  }

  function initXpToast() {
    const event = safeParse(localStorage.getItem(STORAGE_KEY));

    if (!event) {
      tryShowClaimedXpAfterLogin();
      return;
    }

    const storedAt = Number(event.storedAt || 0) || Date.parse(event.createdAt || '');

    if (!storedAt || Date.now() - storedAt > MAX_EVENT_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const user = getVerifiedToastUser();

    if (!user) return;

    if (!toastEventBelongsToUser(event, user)) {
      localStorage.removeItem(STORAGE_KEY);
      tryShowClaimedXpAfterLogin();
      return;
    }

    showToastEvent(event);
  }

  window.addEventListener('pp:tribe-mission-completed', handleMissionCompleted);
  window.addEventListener('pp:tribe-xp-earned', (event) => showToastEvent(event.detail || {}));
  window.addEventListener('pp:auth-changed', () => initXpToast());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initXpToast, { once: true });
  } else {
    initXpToast();
  }
})();
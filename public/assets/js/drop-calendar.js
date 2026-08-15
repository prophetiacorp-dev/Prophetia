/* =========================================================
   PROPHETIA · Drop Calendar
   Drops + fechas personales en localStorage
   ========================================================= */

(() => {
const DROPS_URL = '/assets/data/drops.json';
const PRIVATE_DROPS_URL = '/api/drops/private';
const PERSONAL_KEY = 'pp_calendar_events_v1';
const WISHLIST_KEY = 'pp_wishlist_v1';
const REMINDER_SEEN_KEY = 'pp_calendar_seen_reminders_v1';

  function getVerifiedAccountUser() {
    const user =
      window.__ppAuthCurrentUser ||
      window.__ppLastUser ||
      window.__ppFirebaseAuth?.currentUser ||
      null;

    return user?.uid && user.emailVerified !== false ? user : null;
  }

  function getAccountScopedKey(baseKey) {
    const user = getVerifiedAccountUser();
    return window.ppGetAccountStorageKey?.(baseKey, user) ||
      (user ? `${baseKey}:user:${user.uid}` : '');
  }
  const monthLabel = document.querySelector('[data-calendar-month-label]');
  const selectedLabel = document.querySelector('[data-selected-date-label]');
  const grid = document.querySelector('[data-calendar-grid]');
  const eventsList = document.querySelector('[data-events-list]');
  const summary = document.querySelector('[data-calendar-summary]');

  const prevBtn = document.querySelector('[data-calendar-prev]');
  const nextBtn = document.querySelector('[data-calendar-next]');
  const todayBtn = document.querySelector('[data-calendar-today]');

  const modal = document.querySelector('[data-calendar-modal]');
  const form = document.querySelector('[data-calendar-form]');

  const openFormBtns = document.querySelectorAll('[data-open-calendar-form]');
  const closeFormBtns = document.querySelectorAll('[data-close-calendar-form]');

  if (!grid) return;

  const state = {
    drops: [],
    personal: [],
    viewDate: new Date(),
    selectedDate: toDateKey(new Date())
  };

  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  function toDateKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function parseDateKey(key) {
    const [year, month, day] = String(key || '').split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function escapeHtml(value = '') {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function readPersonalEvents() {
    const key = getAccountScopedKey(PERSONAL_KEY);
    if (!key) return [];

    try {
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(data) ? data.filter(item => item && item.date) : [];
    } catch {
      return [];
    }
  }

  function writePersonalEvents(events) {
    const key = getAccountScopedKey(PERSONAL_KEY);
    if (!key) return false;
    localStorage.setItem(key, JSON.stringify(Array.isArray(events) ? events : []));
    return true;
  }

  function readWishlistCount() {
    const key = getAccountScopedKey(WISHLIST_KEY);
    if (!key) return 0;

    try {
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(data) ? data.filter(item => item && item.id).length : 0;
    } catch {
      return 0;
    }
  }

  async function loadDrops() {
    try {
      const res = await fetch(DROPS_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      state.drops = Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn('[Drop Calendar] No se pudo cargar drops.json:', error);
      state.drops = [];
    }
  }
async function loadPrivateDrops() {
  const token = await getFirebaseUserToken();

  if (!token) {
    return [];
  }

  try {
    const res = await fetch(PRIVATE_DROPS_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    return Array.isArray(data.drops) ? data.drops : [];
  } catch (error) {
    console.warn('[Drop Calendar] No se pudieron cargar fechas privadas:', error);
    return [];
  }
}
  async function getFirebaseUserToken() {
  try {
    const authReady = window.__ppFirebaseAuthReady;
    const auth = window.__ppFirebaseAuth;

    if (authReady) {
      await authReady;
    }

    const directUser =
      auth?.currentUser ||
      window.__ppAuthCurrentUser ||
      window.__ppLastUser ||
      null;

    if (directUser?.getIdToken) {
      return await directUser.getIdToken();
    }

    return await new Promise((resolve) => {
      let resolved = false;

      const finish = async (user) => {
        if (resolved) return;
        resolved = true;

        window.removeEventListener('pp:auth-changed', onAuthChanged);
        window.removeEventListener('pp:auth-ready', onAuthReady);

        if (!user?.getIdToken) {
          resolve(null);
          return;
        }

        try {
          resolve(await user.getIdToken());
        } catch {
          resolve(null);
        }
      };

      const onAuthChanged = (event) => {
        finish(event.detail?.user || null);
      };

      const onAuthReady = () => {
        finish(window.__ppAuthCurrentUser || window.__ppLastUser || auth?.currentUser || null);
      };

      window.addEventListener('pp:auth-changed', onAuthChanged, { once: true });
      window.addEventListener('pp:auth-ready', onAuthReady, { once: true });

      window.setTimeout(() => {
        finish(window.__ppAuthCurrentUser || window.__ppLastUser || auth?.currentUser || null);
      }, 2500);
    });
  } catch {
    return null;
  }
}
function readSeenReminders() {
  const key = getAccountScopedKey(REMINDER_SEEN_KEY);
  if (!key) return {};

  try {
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeSeenReminders(data) {
  const key = getAccountScopedKey(REMINDER_SEEN_KEY);
  if (!key) return false;
  localStorage.setItem(key, JSON.stringify(data || {}));
  return true;
}
function isEventUnlocked(event = {}) {
  if (!event.unlockAt) {
    return true;
  }

  const unlockDate = new Date(event.unlockAt);

  if (Number.isNaN(unlockDate.getTime())) {
    return false;
  }

  return Date.now() >= unlockDate.getTime();
}

function formatUnlockDate(value = '') {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Fecha por confirmar';
  }

  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function buildPrivateDropHref(event = {}) {
  const dropId = String(event.dropId || event.id || '').trim();

  if (!dropId) {
    return event.href || '/prophet-private';
  }

  return `/prophet-private?id=${encodeURIComponent(dropId)}`;
}
function daysUntil(dateKey) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = parseDateKey(dateKey);
  target.setHours(0, 0, 0, 0);

  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / 86400000);
}

function getActiveReminders() {
const seen = readSeenReminders();

return state.personal.filter((event) => {
  if (seen[event.id]) return false;
    if (!event.remind) return false;

    const diff = daysUntil(event.date);
    const remindDays = Number(event.remindDays ?? 3);

    return diff >= 0 && diff <= remindDays;
  });
}

function renderReminderNotice() {
  const reminders = getActiveReminders();
  const existing = document.querySelector('[data-calendar-reminder-notice]');

  if (!reminders.length) {
    existing?.remove();
    return;
  }

  const first = reminders[0];
  const diff = daysUntil(first.date);

  const text =
    diff === 0
      ? `Hoy tienes una fecha guardada: ${first.title}.`
      : `Tienes una fecha guardada en ${diff} día${diff === 1 ? '' : 's'}: ${first.title}.`;

  if (existing) {
    existing.querySelector('[data-calendar-reminder-text]').textContent = text;
    return;
  }

  const notice = document.createElement('section');
  notice.className = 'drop-reminder-notice';
  notice.setAttribute('data-calendar-reminder-notice', '');

  notice.innerHTML = `
    <div>
      <p class="account-kicker">PRIVATE REMINDER</p>
      <strong data-calendar-reminder-text>${escapeHtml(text)}</strong>
    </div>

    <div class="drop-reminder-notice__actions">
      <a href="/wishlist">Ver wishlist</a>
      <button type="button" data-calendar-dismiss-reminder>Ocultar</button>
    </div>
  `;

  const shell = document.querySelector('.drop-calendar-shell');
  shell?.prepend(notice);

  notice.querySelector('[data-calendar-dismiss-reminder]')?.addEventListener('click', () => {
    const seen = readSeenReminders();
    seen[first.id] = new Date().toISOString();
    writeSeenReminders(seen);
    notice.remove();
  });
}
function normalizeEvent(event, source = 'drop') {
  const type = event.type || source;
  const visibility = event.visibility || 'private';
  const isPrivateDrop =
    source === 'drop' &&
    String(visibility).toLowerCase() !== 'public';

  return {
    id: event.id || `${source}-${Date.now()}`,
    dropId: event.dropId || '',
    title: event.title || 'Evento Prophetia',
    date: event.date,
    time: event.time || '',
    unlockAt: event.unlockAt || '',
    type,
    source,
    status: event.status || '',
    visibility,
    requiredRankId: event.requiredRankId || null,
    description: event.description || event.note || '',
    href: event.href || '',
    ctaLocked: event.ctaLocked || '',
    ctaUnlocked: event.ctaUnlocked || '',
    note: event.note || '',
    isPrivateDrop
  };
}

  function getAllEvents() {
    return [
      ...state.drops.map(event => normalizeEvent(event, 'drop')),
      ...state.personal.map(event => normalizeEvent(event, 'personal'))
    ].filter(event => event.date);
  }

  function getEventsForDate(dateKey) {
    return getAllEvents()
      .filter(event => event.date === dateKey)
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));
  }

  function getEventTypeLabel(type) {
 const labels = {
  drop: 'Drop',
  'early-access': 'Early Access',
  restock: 'Restock',
  private: 'Privado',
  'private-drop': 'Private Drop',
  'private-preview': 'Private Preview',
  'private-calendar': 'Private Window',
  birthday: 'Cumpleaños',
  gift: 'Regalo',
  anniversary: 'Aniversario',
  personal: 'Personal'
};

    return labels[type] || 'Evento';
  }

  function getSelectedDateLabel(dateKey) {
    const date = parseDateKey(dateKey);
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  function renderSummary() {
    if (!summary) return;

    const upcoming = getAllEvents()
      .filter(event => event.date >= toDateKey(new Date()))
      .length;

    const wishlistCount = readWishlistCount();

    summary.textContent =
      `${upcoming} fechas próximas · ${wishlistCount} piezas guardadas en wishlist.`;
  }

  function renderCalendar() {
    const year = state.viewDate.getFullYear();
    const month = state.viewDate.getMonth();

    if (monthLabel) {
      monthLabel.textContent = `${monthNames[month]} ${year}`;
    }

    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);

    const startOffset = (first.getDay() + 6) % 7;
    const totalDays = last.getDate();

    const cells = [];

    weekDays.forEach(day => {
      cells.push(`
        <div class="drop-calendar-weekday">
          ${escapeHtml(day)}
        </div>
      `);
    });

    for (let i = 0; i < startOffset; i++) {
      cells.push('<div class="drop-calendar-day is-empty"></div>');
    }

    const todayKey = toDateKey(new Date());

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      const key = toDateKey(date);
      const events = getEventsForDate(key);

      const hasDrop = events.some(event => event.source === 'drop');
      const hasPersonal = events.some(event => event.source === 'personal');

      cells.push(`
        <button
          class="drop-calendar-day ${key === todayKey ? 'is-today' : ''} ${key === state.selectedDate ? 'is-selected' : ''}"
          type="button"
          data-date="${escapeHtml(key)}"
          aria-label="${escapeHtml(getSelectedDateLabel(key))}"
        >
          <span class="drop-calendar-day__number">${day}</span>

          ${
            events.length
              ? `<span class="drop-calendar-day__dots">
                  ${hasDrop ? '<i class="is-drop"></i>' : ''}
                  ${hasPersonal ? '<i class="is-personal"></i>' : ''}
                </span>`
              : ''
          }
        </button>
      `);
    }

    grid.innerHTML = cells.join('');
  }

  function renderEvents() {
    const events = getEventsForDate(state.selectedDate);

    if (selectedLabel) {
      selectedLabel.textContent = getSelectedDateLabel(state.selectedDate);
    }

    if (!eventsList) return;

    if (!events.length) {
      eventsList.innerHTML = `
        <div class="drop-empty">
          <p>No hay movimientos guardados para esta fecha.</p>
          <button type="button" data-open-calendar-form>Añadir fecha personal</button>
        </div>
      `;

      bindDynamicOpenButtons();
      return;
    }

eventsList.innerHTML = events.map(event => {
  const canDelete = event.source === 'personal';
  const unlocked = isEventUnlocked(event);
  const isPrivateDrop = event.isPrivateDrop === true;

  const eventClasses = [
    'drop-event',
    `drop-event--${event.source}`,
    isPrivateDrop ? 'drop-event--private-window' : '',
    isPrivateDrop && unlocked ? 'is-unlocked' : '',
    isPrivateDrop && !unlocked ? 'is-locked' : ''
  ].filter(Boolean).join(' ');

  const actionHref = isPrivateDrop
    ? buildPrivateDropHref(event)
    : event.href;

  const lockedLabel =
    event.ctaLocked ||
    (event.unlockAt
      ? `Disponible el ${formatUnlockDate(event.unlockAt)}`
      : 'Acceso programado');

  const unlockedLabel =
    event.ctaUnlocked ||
    'Ver drop privado';

  return `
    <article class="${escapeHtml(eventClasses)}">
      <div class="drop-event__top">
        <span>${escapeHtml(getEventTypeLabel(event.type))}</span>
        ${event.time ? `<time>${escapeHtml(event.time)}</time>` : ''}
      </div>

      <h3>${escapeHtml(event.title)}</h3>

      ${
        event.description
          ? `<p>${escapeHtml(event.description)}</p>`
          : ''
      }

      ${
        event.requiredRankId
          ? `<strong class="drop-event__rank">Rango requerido: ${escapeHtml(event.requiredRankId)}</strong>`
          : ''
      }

      ${
        isPrivateDrop
          ? `<span class="drop-event__unlock-state">
              ${unlocked ? 'Ventana abierta' : escapeHtml(lockedLabel)}
            </span>`
          : ''
      }

      <div class="drop-event__actions">
        ${
          isPrivateDrop
            ? unlocked
              ? `<a class="drop-event__primary" href="${escapeHtml(actionHref)}">${escapeHtml(unlockedLabel)}</a>`
              : `<span class="drop-event__locked">${escapeHtml(lockedLabel)}</span>`
            : event.href
              ? `<a href="${escapeHtml(event.href)}">Ver detalle</a>`
              : `<a href="/wishlist">Ver wishlist</a>`
        }

        ${
          canDelete
            ? `<button type="button" data-delete-personal-event="${escapeHtml(event.id)}">Eliminar</button>`
            : ''
        }
      </div>
    </article>
  `;
}).join('');
  }

function render() {
  renderCalendar();
  renderEvents();
  renderSummary();
  renderReminderNotice();
}

  function openModal() {
    if (!modal) return;

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');

    const dateInput = form?.querySelector('[name="date"]');
    if (dateInput && !dateInput.value) {
      dateInput.value = state.selectedDate;
    }
  }

  function closeModal() {
    if (!modal) return;

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
  }

  function bindDynamicOpenButtons() {
    document.querySelectorAll('[data-open-calendar-form]').forEach((btn) => {
      if (btn.__ppCalendarOpenBound) return;
      btn.__ppCalendarOpenBound = true;

      btn.addEventListener('click', openModal);
    });
  }

  function bindEvents() {
    grid.addEventListener('click', (event) => {
      const day = event.target.closest('[data-date]');
      if (!day) return;

      state.selectedDate = day.dataset.date;
      render();
    });

    prevBtn?.addEventListener('click', () => {
      state.viewDate = new Date(
        state.viewDate.getFullYear(),
        state.viewDate.getMonth() - 1,
        1
      );

      render();
    });

    nextBtn?.addEventListener('click', () => {
      state.viewDate = new Date(
        state.viewDate.getFullYear(),
        state.viewDate.getMonth() + 1,
        1
      );

      render();
    });

    todayBtn?.addEventListener('click', () => {
      state.viewDate = new Date();
      state.selectedDate = toDateKey(new Date());
      render();
    });

    openFormBtns.forEach(btn => {
      btn.addEventListener('click', openModal);
    });

    closeFormBtns.forEach(btn => {
      btn.addEventListener('click', closeModal);
    });

    form?.addEventListener('submit', (event) => {
      event.preventDefault();

      if (!getVerifiedAccountUser()) {
        window.ppPromptAccountAccess?.(
          'Inicia sesión para guardar fechas en tu calendario personal.'
        );
        return;
      }

      const data = new FormData(form);

const item = {
  id: `personal-${Date.now()}`,
  title: String(data.get('title') || '').trim(),
  date: String(data.get('date') || '').trim(),
  type: String(data.get('type') || 'personal'),
  note: String(data.get('note') || '').trim(),
  remind: data.get('remind') === '1',
  remindDays: Number(data.get('remindDays') || 3),
  createdAt: new Date().toISOString()
};

      if (!item.title || !item.date) return;

      state.personal.push(item);
      writePersonalEvents(state.personal);

      state.selectedDate = item.date;
      state.viewDate = parseDateKey(item.date);

      form.reset();
      closeModal();
      render();
    });

    eventsList?.addEventListener('click', (event) => {
      const deleteBtn = event.target.closest('[data-delete-personal-event]');
      if (!deleteBtn) return;

      event.preventDefault();

      const id = deleteBtn.dataset.deletePersonalEvent;

      state.personal = state.personal.filter(item => String(item.id) !== String(id));
      writePersonalEvents(state.personal);

      render();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    });
  }

let calendarEventsBound = false;
let calendarInitRunning = false;
let calendarInitQueued = false;

async function init() {
  if (calendarInitRunning) {
    calendarInitQueued = true;
    return;
  }

  calendarInitRunning = true;

  state.personal = readPersonalEvents();

  await loadDrops();

  const privateDrops = await loadPrivateDrops();

  state.drops = [
    ...state.drops.filter((event) => {
      return String(event.visibility || 'public').toLowerCase() === 'public';
    }),
    ...privateDrops
  ];

  if (!calendarEventsBound) {
    calendarEventsBound = true;
    bindEvents();
  }

  bindDynamicOpenButtons();
  render();

  calendarInitRunning = false;

  if (calendarInitQueued) {
    calendarInitQueued = false;
    void init();
  }
}

init();

window.addEventListener('pp:auth-changed', () => {
  init();
});

window.addEventListener('pp:auth-ready', () => {
  init();
});
})();

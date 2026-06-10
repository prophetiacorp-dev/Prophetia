/* =========================================================
   PROPHETIA · Prophet Private Window
   Carga segura desde /api/private-drops
   ========================================================= */

(() => {
  const PRIVATE_DROPS_URL = '/api/private-drops';

  const rankSlot = document.querySelector('[data-private-access-rank]');
  const messageSlot = document.querySelector('[data-private-access-message]');
  const availableCountSlot = document.querySelector('[data-private-available-count]');
  const upcomingCountSlot = document.querySelector('[data-private-upcoming-count]');

  const availableList = document.querySelector('[data-private-available-list]');
  const upcomingList = document.querySelector('[data-private-upcoming-list]');

  const detailSection = document.querySelector('[data-private-detail]');
  const detailCover = document.querySelector('[data-private-detail-cover]');
  const detailKicker = document.querySelector('[data-private-detail-kicker]');
  const detailTitle = document.querySelector('[data-private-detail-title]');
  const detailLead = document.querySelector('[data-private-detail-lead]');
  const detailStory = document.querySelector('[data-private-detail-story]');
  const detailProducts = document.querySelector('[data-private-detail-products]');

  if (!availableList || !upcomingList) return;

  let currentToken = '';

  function escapeHtml(value = '') {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getSelectedDropId() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('id') || '').trim();
  }

  function formatUnlockDate(value = '') {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Fecha por confirmar';
    }

    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
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

  async function fetchPrivateDrops() {
    currentToken = await getFirebaseUserToken();

    if (!currentToken) {
      throw new Error('Necesitas iniciar sesión para acceder a la sala Prophet.');
    }

    const res = await fetch(PRIVATE_DROPS_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${currentToken}`
      }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'No se ha podido cargar la sala privada.');
    }

    return data;
  }

  async function fetchPrivateDropDetail(dropId) {
    if (!currentToken) {
      currentToken = await getFirebaseUserToken();
    }

    if (!currentToken) {
      throw new Error('Necesitas iniciar sesión para acceder a este drop.');
    }

    const res = await fetch(`${PRIVATE_DROPS_URL}/${encodeURIComponent(dropId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${currentToken}`
      }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error = new Error(data.error || 'No se ha podido cargar este drop privado.');
      error.payload = data;
      error.status = res.status;
      throw error;
    }

    return data;
  }

  function renderAccess(access = {}) {
    const allowed = access.allowed !== false;

    document.body.classList.toggle('is-private-denied', !allowed);

    if (rankSlot) {
      rankSlot.textContent = allowed
        ? access.rank || 'Prophet Access'
        : access.rank || 'Acceso privado';
    }

    if (messageSlot) {
      messageSlot.textContent = allowed
        ? 'Acceso validado. Esta sala mostrará tus ventanas privadas Prophet.'
        : access.message || 'No tienes acceso a esta sala privada.';
    }

    if (availableCountSlot) {
      availableCountSlot.textContent = String(access.availableCount ?? 0);
    }

    if (upcomingCountSlot) {
      upcomingCountSlot.textContent = String(access.upcomingCount ?? 0);
    }
  }

  function renderDropCard(drop = {}, mode = 'available') {
    const isUnlocked = drop.unlocked === true;
    const unlockText = formatUnlockDate(drop.unlockAt);

    const statusText = isUnlocked
      ? 'Desbloqueado'
      : `Disponible ${unlockText}`;

    const action = isUnlocked
      ? `<button class="prophet-private-card__action" type="button" data-private-open-drop="${escapeHtml(drop.id)}">Entrar al drop</button>`
      : `<button class="prophet-private-card__action" type="button" disabled>Acceso programado</button>`;

    return `
      <article class="prophet-private-card ${isUnlocked ? 'is-unlocked' : 'is-locked'}" data-private-drop-card="${escapeHtml(drop.id)}">
        <div>
          <div class="prophet-private-card__meta">
            <span>${escapeHtml(drop.hero?.kicker || drop.type || 'Private')}</span>
            <span>${escapeHtml(drop.requiredRankId || 'prophet')}</span>
          </div>

          <h3>${escapeHtml(drop.title || 'Prophet Private Drop')}</h3>

          ${
            drop.hero?.lead
              ? `<p>${escapeHtml(drop.hero.lead)}</p>`
              : ''
          }
        </div>

        <div>
          <span class="prophet-private-card__status">
            ${escapeHtml(statusText)}
          </span>

          ${action}
        </div>
      </article>
    `;
  }

  function renderLists(data = {}) {
    const availableDrops = Array.isArray(data.availableDrops) ? data.availableDrops : [];
    const upcomingDrops = Array.isArray(data.upcomingDrops) ? data.upcomingDrops : [];

    availableList.innerHTML = availableDrops.length
      ? availableDrops.map((drop) => renderDropCard(drop, 'available')).join('')
      : `
        <article class="prophet-private-empty">
          No hay drops privados disponibles ahora mismo. Las próximas ventanas aparecerán cuando llegue su fecha de apertura.
        </article>
      `;

    upcomingList.innerHTML = upcomingDrops.length
      ? upcomingDrops.map((drop) => renderDropCard(drop, 'upcoming')).join('')
      : `
        <article class="prophet-private-empty">
          No hay próximas ventanas privadas programadas.
        </article>
      `;
  }

  function renderDetail(drop = {}) {
    if (!detailSection) return;

    detailSection.hidden = false;

    if (detailCover) {
      const cover = drop.media?.cover || '';
      detailCover.src = cover || '';
      detailCover.alt = drop.title || 'Prophet Private Drop';
      detailCover.parentElement.hidden = !cover;
    }

    if (detailKicker) {
      detailKicker.textContent = drop.hero?.kicker || 'PROPHET PRIVATE WINDOW';
    }

    if (detailTitle) {
      detailTitle.textContent = drop.hero?.title || drop.title || 'Prophet Private Drop';
    }

    if (detailLead) {
      detailLead.textContent = drop.hero?.lead || '';
    }

    if (detailStory) {
      const story = Array.isArray(drop.story) ? drop.story : [];

      detailStory.innerHTML = story.length
        ? story.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')
        : '';
    }

    if (detailProducts) {
      const products = Array.isArray(drop.products) ? drop.products : [];

      detailProducts.innerHTML = products.length
        ? products.map((product) => {
            return `
              <article class="prophet-private-product">
                ${
                  product.image
                    ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}">`
                    : `<img src="" alt="" aria-hidden="true">`
                }

                <div>
                  <h3>${escapeHtml(product.title || 'Pieza privada')}</h3>
                  <p>${escapeHtml(product.description || '')}</p>
                </div>

                ${
                  product.href
                    ? `<a href="${escapeHtml(product.href)}">${escapeHtml(product.cta || 'Ver pieza')}</a>`
                    : ''
                }
              </article>
            `;
          }).join('')
        : '';
    }

    detailSection.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  function renderLockedDetail(error) {
    if (!detailSection) return;

    const payload = error?.payload || {};
    const unlockAt = payload.unlockAt || '';

    detailSection.hidden = false;

    if (detailCover?.parentElement) {
      detailCover.parentElement.hidden = true;
    }

    if (detailKicker) {
      detailKicker.textContent = 'PRIVATE WINDOW LOCKED';
    }

    if (detailTitle) {
      detailTitle.textContent = 'Acceso programado';
    }

    if (detailLead) {
      detailLead.textContent = unlockAt
        ? `Este drop privado estará disponible el ${formatUnlockDate(unlockAt)}.`
        : 'Este drop privado todavía no está disponible.';
    }

    if (detailStory) {
      detailStory.innerHTML = `
        <p>${escapeHtml(error.message || 'El contenido completo se desbloqueará cuando llegue la fecha de apertura.')}</p>
      `;
    }

    if (detailProducts) {
      detailProducts.innerHTML = '';
    }

    detailSection.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  function renderError(message = '') {
    if (rankSlot) {
      rankSlot.textContent = 'Acceso no disponible';
    }

    if (messageSlot) {
      messageSlot.textContent = message || 'No se ha podido cargar la sala privada.';
    }

    if (availableCountSlot) availableCountSlot.textContent = '0';
    if (upcomingCountSlot) upcomingCountSlot.textContent = '0';

    availableList.innerHTML = `
      <article class="prophet-private-empty">
        ${escapeHtml(message || 'No se ha podido cargar la sala privada.')}
      </article>
    `;

    upcomingList.innerHTML = `
      <article class="prophet-private-empty">
        Inicia sesión con una cuenta Prophetia Tribe con rango suficiente.
      </article>
    `;
  }

  function bindActions() {
    document.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-private-open-drop]');
      if (!btn) return;

      event.preventDefault();

      const dropId = btn.dataset.privateOpenDrop;
      if (!dropId) return;

      btn.disabled = true;
      const previousText = btn.textContent;
      btn.textContent = 'Cargando...';

      try {
        const data = await fetchPrivateDropDetail(dropId);
        renderDetail(data.drop);
      } catch (error) {
        renderLockedDetail(error);
      } finally {
        btn.disabled = false;
        btn.textContent = previousText;
      }
    });
  }

  async function init() {
    try {
      const data = await fetchPrivateDrops();

      renderAccess(data.access || {});
      renderLists(data);

      const selectedDropId = getSelectedDropId();

      if (selectedDropId) {
        try {
          const detailData = await fetchPrivateDropDetail(selectedDropId);
          renderDetail(detailData.drop);
        } catch (error) {
          renderLockedDetail(error);
        }
      }
    } catch (error) {
      renderError(error.message);
    }
  }

  bindActions();
  init();

  window.addEventListener('pp:auth-changed', () => {
    init();
  });

  window.addEventListener('pp:auth-ready', () => {
    init();
  });
})();
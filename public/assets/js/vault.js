/* =========================================================
   PROPHETIA · Vault
   Archivo privado por rango Tribe
   ========================================================= */

(function () {
  const VAULT_URL = "/assets/data/vault.json";

  const RANK_ORDER = {
    "tribe-member": 0,
    "member": 0,
    "initiate": 1,
    "adeptus": 2,
    "oracle": 3,
    "seer": 4,
    "archivist": 4,
    "prophet": 5,
    "prophet-i": 6,
    "prophet-ii": 7,
    "prophet-iii": 8
  };

  const RANK_LABELS = {
    "tribe-member": "Tribe Member",
    "member": "Tribe Member",
    "initiate": "Initiate",
    "adeptus": "Adeptus",
    "oracle": "Oracle",
    "seer": "Archivist",
    "archivist": "Archivist",
    "prophet": "Prophet",
    "prophet-i": "Prophet I",
    "prophet-ii": "Prophet II",
    "prophet-iii": "Prophet III"
  };

  const state = {
    member: null,
    vault: [],
    loading: true
  };

  const $ = (selector, root = document) => root.querySelector(selector);

  function escapeHtml(value = "") {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }

  function normalizeRankId(rankId = "") {
    const clean = String(rankId || "tribe-member")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");

    return clean === "seer" ? "archivist" : clean;
  }

  function getRankLevel(rankId = "") {
    const clean = normalizeRankId(rankId);
    return RANK_ORDER[clean] ?? 0;
  }

  function hasRequiredRank(userRankId = "", requiredRankId = "tribe-member") {
    const userLevel = getRankLevel(userRankId);
    const requiredLevel = getRankLevel(requiredRankId);

    return userLevel >= requiredLevel;
  }

  function getRankLabel(rankId = "") {
    const clean = normalizeRankId(rankId);
    return RANK_LABELS[clean] || rankId || "Tribe Member";
  }

  function formatLegacyPoints(value = 0) {
    return `${Number(value || 0).toLocaleString("es-ES")} LP`;
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

          window.removeEventListener("pp:auth-changed", onAuthChanged);
          window.removeEventListener("pp:auth-ready", onAuthReady);

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

        window.addEventListener("pp:auth-changed", onAuthChanged, { once: true });
        window.addEventListener("pp:auth-ready", onAuthReady, { once: true });

        window.setTimeout(() => {
          finish(window.__ppAuthCurrentUser || window.__ppLastUser || auth?.currentUser || null);
        }, 2500);
      });
    } catch {
      return null;
    }
  }

  async function loadTribeProfile() {
    const token = await getFirebaseUserToken();

    if (!token) {
      return null;
    }

    try {
      const res = await fetch("/api/tribe/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        console.warn("[Vault] /api/tribe/me error:", res.status);
        return null;
      }

      return await res.json();
    } catch (err) {
      console.warn("[Vault] No se pudo cargar Tribe:", err);
      return null;
    }
  }

  async function loadVaultItems() {
    try {
      const res = await fetch(VAULT_URL, { cache: "no-store" });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn("[Vault] No se pudo cargar vault.json:", err);
      return [];
    }
  }

  function renderHeader() {
    const rankSlot = $("[data-vault-rank]");
    const summarySlot = $("[data-vault-summary]");
    const pointsSlot = $("[data-vault-points]");
    const earlySlot = $("[data-vault-early]");
    const statusSlot = $("[data-vault-status-text]");

    const member = state.member;

    if (!member) {
      document.body.classList.add("vault-signed-out");
      document.body.classList.remove("vault-loading");

      if (rankSlot) rankSlot.textContent = "Sesión requerida";
      if (summarySlot) {
        summarySlot.textContent =
          "Inicia sesión para ver tu archivo privado, tus ventajas y los accesos asociados a tu rango.";
      }
      if (pointsSlot) pointsSlot.textContent = "—";
      if (earlySlot) earlySlot.textContent = "Privado";
      if (statusSlot) {
        statusSlot.textContent =
          "Vault se organiza por rango: cuanto más avanzas en Prophetia Tribe, más accesos y ventajas puedes consultar aquí.";
      }

      return;
    }

    document.body.classList.remove("vault-signed-out", "vault-loading");

    const rankId = normalizeRankId(member.rankId || member.prestigeId || "tribe-member");
    const displayRank =
      member.isPrestigeActive && member.prestigeLabel
        ? member.prestigeLabel
        : member.rank || getRankLabel(rankId);

    const earlyHours = Number(member.earlyAccessHours || 0);

    if (rankSlot) rankSlot.textContent = displayRank;

    if (summarySlot) {
      summarySlot.textContent =
        member.rankMessage ||
        member.objective ||
        "Tu archivo privado se actualiza con tu rango, tus LP y las misiones verificadas de tu perfil.";
    }

    if (pointsSlot) {
      pointsSlot.textContent = formatLegacyPoints(member.lifetimePoints || member.points || 0);
    }

    if (earlySlot) {
      earlySlot.textContent = earlyHours > 0 ? `${earlyHours} h` : "Base";
    }

    if (statusSlot) {
      statusSlot.textContent =
        "Accesos disponibles según tu rango actual. Las entradas bloqueadas muestran qué necesitas para desbloquearlas.";
    }
  }

  function getUserRankId(member) {
    if (!member) return "tribe-member";

    return member?.isPrestigeActive && member?.prestigeId
      ? member.prestigeId
      : member?.rankId || "tribe-member";
  }

  function renderVaultCard(item, unlocked) {
    const requiredRankId = normalizeRankId(item.requiredRankId || "tribe-member");

    const statusLabel = unlocked
      ? "Desbloqueado"
      : `Requiere ${getRankLabel(requiredRankId)}`;

    const action = unlocked
      ? `<a class="vault-card__link" href="${escapeHtml(item.href || "/my-content")}">${escapeHtml(item.cta || "Abrir")}</a>`
      : `<span class="vault-card__locked">Bloqueado</span>`;

    return `
      <article class="vault-card ${unlocked ? "is-unlocked" : "is-locked"}" data-vault-id="${escapeHtml(item.id)}">
        <span class="vault-card__rank">
          ${escapeHtml(getRankLabel(requiredRankId))}
        </span>

        <div class="vault-card__top">
          <p class="vault-card__eyebrow">
            ${escapeHtml(item.eyebrow || item.type || "Vault")}
          </p>

          <h3>${escapeHtml(item.title || "Entrada Vault")}</h3>

          <p class="vault-card__description">
            ${escapeHtml(item.description || "")}
          </p>
        </div>

        <div class="vault-card__bottom">
          <span class="vault-card__status">
            ${escapeHtml(statusLabel)}
          </span>

          ${action}
        </div>
      </article>
    `;
  }

  function getNextRequiredRank(lockedItems = []) {
    if (!lockedItems.length) return "Todo desbloqueado";

    const sorted = [...lockedItems].sort((a, b) => {
      const aRank = getRankLevel(a.requiredRankId || "tribe-member");
      const bRank = getRankLevel(b.requiredRankId || "tribe-member");

      return aRank - bRank;
    });

    return getRankLabel(sorted[0]?.requiredRankId || "tribe-member");
  }

  function renderVault() {
    const unlockedGrid = $("[data-vault-unlocked-grid]");
    const lockedGrid = $("[data-vault-locked-grid]");

    if (!unlockedGrid || !lockedGrid) return;

    const availableCountSlot = $("[data-vault-available-count]");
    const lockedCountSlot = $("[data-vault-locked-count]");
    const nextRankSlot = $("[data-vault-next-rank]");
    const unlockedNoteSlot = $("[data-vault-unlocked-note]");
    const lockedNoteSlot = $("[data-vault-locked-note]");
    const statusSlot = $("[data-vault-status-text]");

    const member = state.member;
    const userRankId = getUserRankId(member);

    if (!state.vault.length) {
      unlockedGrid.innerHTML = `
        <article class="vault-loading">
          No hay entradas disponibles en el Vault.
        </article>
      `;

      lockedGrid.innerHTML = "";

      if (availableCountSlot) availableCountSlot.textContent = "0";
      if (lockedCountSlot) lockedCountSlot.textContent = "0";
      if (nextRankSlot) nextRankSlot.textContent = "—";

      return;
    }

    const preparedItems = state.vault.map((item) => {
      const requiredRankId = normalizeRankId(item.requiredRankId || "tribe-member");
      const unlocked = member ? hasRequiredRank(userRankId, requiredRankId) : false;

      return {
        ...item,
        requiredRankId,
        unlocked
      };
    });

    const unlockedItems = preparedItems.filter((item) => item.unlocked);
    const lockedItems = preparedItems.filter((item) => !item.unlocked);

    if (availableCountSlot) {
      availableCountSlot.textContent = String(unlockedItems.length);
    }

    if (lockedCountSlot) {
      lockedCountSlot.textContent = String(lockedItems.length);
    }

    if (nextRankSlot) {
      nextRankSlot.textContent = getNextRequiredRank(lockedItems);
    }

    if (statusSlot) {
      statusSlot.textContent = member
        ? `${unlockedItems.length} accesos disponibles según tu rango actual.`
        : "Inicia sesión para consultar los accesos privados de Prophetia Tribe.";
    }

    if (unlockedNoteSlot) {
      unlockedNoteSlot.textContent = unlockedItems.length
        ? "Accesos activos para tu rango actual."
        : "Todavía no hay accesos activos para mostrar.";
    }

    if (lockedNoteSlot) {
      lockedNoteSlot.textContent = lockedItems.length
        ? "Nuevas entradas aparecerán cuando subas de rango o completes misiones verificadas de Prophetia Tribe."
        : "Todo el Vault actual está desbloqueado.";
    }

    unlockedGrid.innerHTML = unlockedItems.length
      ? unlockedItems.map((item) => renderVaultCard(item, true)).join("")
      : `
        <article class="vault-loading">
          Inicia sesión o progresa dentro de Prophetia Tribe para desbloquear accesos.
        </article>
      `;

    lockedGrid.innerHTML = lockedItems.length
      ? lockedItems.map((item) => renderVaultCard(item, false)).join("")
      : `
        <article class="vault-loading vault-loading--complete">
          Todo el Vault actual está desbloqueado.
        </article>
      `;

    document.body.classList.toggle("vault-all-unlocked", lockedItems.length === 0);
  }

  async function initVault() {
    document.body.classList.add("vault-loading");

    const [member, vault] = await Promise.all([
      loadTribeProfile(),
      loadVaultItems()
    ]);

    state.member = member;
    state.vault = vault;
    state.loading = false;

    renderHeader();
    renderVault();
  }

  function bindAuthRefresh() {
    window.addEventListener("pp:auth-changed", () => {
      initVault();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindAuthRefresh();
      initVault();
    }, { once: true });
  } else {
    bindAuthRefresh();
    initVault();
  }
})();
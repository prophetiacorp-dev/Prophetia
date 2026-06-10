/* =========================================================
   PROPHETIA · ACCOUNT CONTENT
   Preferencia de exploración: mujer / hombre / todo
   ========================================================= */

(function () {
  const STORAGE_KEY = "pp_shop_preference";
  const WISHLIST_KEY = "pp_wishlist_v1";

const TRIBE_MISSION_ORDER = [
  "join-tribe",
  "first-address",
  "first-order",
  "initiate-unlocked",
  "wishlist-3"
];

 const routes = {
  women: "/mujer",
  men: "/hombre",
  all: "/colecciones",
};

  const labels = {
    women: "Mujer",
    men: "Hombre",
    all: "Todo Prophetia",
  };

  function getSavedPreference() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return routes[saved] ? saved : "all";
  }

  function savePreference(value) {
    if (!routes[value]) return;
    localStorage.setItem(STORAGE_KEY, value);
  }

  function updateActiveButton(value) {
    document.querySelectorAll("[data-pref-shop]").forEach((btn) => {
      const isActive = btn.dataset.prefShop === value;

      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
  }

  function updateExploreLinks(value) {
    const targetUrl = routes[value] || routes.all;

    document.querySelectorAll("[data-profile-explore-link]").forEach((link) => {
      link.setAttribute("href", targetUrl);
      link.setAttribute("data-current-preference", value);
      link.setAttribute("aria-label", `Explorar piezas: ${labels[value] || labels.all}`);
    });
  }

  function applyPreference(value) {
    savePreference(value);
    updateActiveButton(value);
    updateExploreLinks(value);
  }

  function bindPreferenceButtons() {
    const buttons = document.querySelectorAll("[data-pref-shop]");

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.prefShop;
        applyPreference(value);
      });
    });
  }

  function init() {
    const initialPreference = getSavedPreference();

    bindPreferenceButtons();
    applyPreference(initialPreference);
  }

const TRIBE_RANKS = {
  member: {
    label: "Archivo abierto",
    min: 0,
    next: "Initiate",
    nextAt: 1,
  },
initiate: {
  label: "Initiate",
  min: 1,
  next: "Adeptus",
  nextAt: 100,
},
    adeptus: {
      label: "Adeptus",
      min: 100,
      next: "Oracle",
      nextAt: 250,
    },
    oracle: {
      label: "Oracle",
      min: 250,
      next: "Archivist",
      nextAt: 500,
    },
    archivist: {
      label: "Archivist",
      min: 500,
      next: "Prophet",
      nextAt: 1000,
    },
    prophet: {
      label: "Prophet",
      min: 1000,
      next: null,
      nextAt: null,
    },
  };

function normalizeRankId(rank) {
  return String(rank || "member")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}
function getRankEmblemSrc(rank) {
  const rankId = normalizeRankId(rank);

const emblems = {
  member: "/assets/img/logo/propnegro.png",
  initiate: "/assets/img/ranks/initiate.png",
  adeptus: "/assets/img/ranks/adeptus.png",
  oracle: "/assets/img/ranks/oracle.png",
  archivist: "/assets/img/ranks/archivist.png",
  prophet: "/assets/img/ranks/prophet.png",
  "prophet-base": "/assets/img/ranks/prophet.png",
  "prestige-i": "/assets/img/ranks/prestigio1.png",
  "prophet-prestige-1": "/assets/img/ranks/prestigio1.png",
};

  return emblems[rankId] || emblems.member;
}

function getFallbackTribeData() {
  return {
    points: 0,
    lifetimePoints: 0,
    rank: "Archivo abierto",
    rankId: "member",
    nextRank: "Initiate",
    nextRankAt: 1,
    pointsToNextRank: 1,
    progressPercent: 0,
    discountStatus: "pending",
    usedCount: 0,
    isRankActivated: false,
    rankMessage: "Tu archivo Prophetia está abierto. Tu primer rango ceremonial se activa con tu primera adquisición.",
  };
}
function escapeHtml(value = "") {
  const div = document.createElement("div");
  div.textContent = String(value || "");
  return div.innerHTML;
}

function formatLegacyPoints(value = 0) {
  return `${Number(value || 0).toLocaleString("es-ES")} LP`;
}

function getVisualRankKeyFromState(rank = "member", prestigeLabel = "") {
  const rankId = normalizeRankId(rank);
  const prestigeId = normalizeRankId(prestigeLabel);

  if (rankId !== "prophet") {
    return rankId;
  }

  if (!prestigeId || prestigeId === "prophet-base") {
    return "prophet";
  }

  return prestigeId;
}
function calculateProgress(member) {
  const rankId = normalizeRankId(member.rankId || member.rank);
  const rankData = TRIBE_RANKS[rankId] || TRIBE_RANKS.member;
  const lifetimePoints = Number(member.lifetimePoints ?? member.points ?? 0);
  const points = rankId === "member"
    ? lifetimePoints
    : Number(member.points || 0);

  if (rankId === "member") {
    return 0;
  }

  if (!rankData.nextAt) {
    return 100;
  }

  const currentRange = rankData.nextAt - rankData.min;
  const currentPoints = Math.max(0, points - rankData.min);

  return Math.max(0, Math.min(100, Math.round((currentPoints / currentRange) * 100)));
}

function renderBenefitList(card, benefits = []) {
  let list = card.querySelector("[data-tribe-benefits-list]");

  if (!Array.isArray(benefits) || !benefits.length) {
    if (list) list.remove();
    return;
  }

  if (!list) {
    list = document.createElement("ul");
    list.className = "account-tribe__benefits";
    list.setAttribute("data-tribe-benefits-list", "");
  }

  list.innerHTML = benefits
    .map((benefit) => `<li>${escapeHtml(benefit)}</li>`)
    .join("");

  const benefitText = card.querySelector("[data-tribe-benefit]");

  if (benefitText) {
    benefitText.insertAdjacentElement("beforebegin", list);
  } else {
    card.appendChild(list);
  }
}
  function getRewardStatusLabel(status = "") {
  const cleanStatus = String(status || "").toLowerCase();

  if (cleanStatus === "used") return "Utilizada";
  if (cleanStatus === "available") return "Disponible";

  return "Privada";
}

function getLocalWishlistCount() {
  try {
    const data = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
    return Array.isArray(data)
      ? data.filter((item) => item && item.id).length
      : 0;
  } catch {
    return 0;
  }
}

function normalizeMissionStatus(mission = {}) {
  const status = String(mission.status || "").toLowerCase();

  if (mission.completed || status === "completed") return "completed";
  if (status === "locked") return "locked";

  return "pending";
}

function getMissionAction(mission = {}) {
  const id = String(mission.id || "");

  if (id === "first-address") {
    return {
      label: "Añadir dirección",
      href: "/addresses"
    };
  }

  if (id === "first-order") {
    return {
      label: "Explorar piezas",
      href: "/colecciones"
    };
  }

  if (id === "wishlist-3") {
    return {
      label: "Guardar piezas",
      href: "/wishlist"
    };
  }

  return null;
}

function preparePublicMissions(missions = []) {
  const wishlistCount = getLocalWishlistCount();

  const safeMissions = Array.isArray(missions) ? missions : [];

  const mapped = safeMissions.map((mission) => {
    if (mission.id !== "wishlist-3") {
      return mission;
    }

    const target = Number(mission.target || 3);
    const progress = Math.max(0, Math.min(wishlistCount, target));
    const completed = progress >= target;

    return {
      ...mission,
      progress,
      completed,
      status: completed ? "completed" : "pending"
    };
  });

  return mapped.sort((a, b) => {
    const indexA = TRIBE_MISSION_ORDER.indexOf(a.id);
    const indexB = TRIBE_MISSION_ORDER.indexOf(b.id);

    return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
  });
}
/* =========================================================
   PROPHETIA · Account Calendar Preview
   ========================================================= */

const PP_CALENDAR_EVENTS_KEY = "pp_calendar_events_v1";
const PP_WISHLIST_KEY = "pp_wishlist_v1";
const PP_DROPS_URL = "/assets/data/drops.json";
const PP_VAULT_URL = "/assets/data/vault.json";

const PP_VAULT_RANK_ORDER = {
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

const PP_VAULT_RANK_LABELS = {
  "tribe-member": "Tribe Member",
  "member": "Tribe Member",
  "initiate": "Initiate",
  "adeptus": "Adeptus",
  "oracle": "Oracle",
  "seer": "Seer",
  "archivist": "Archivist",
  "prophet": "Prophet",
  "prophet-i": "Prophet I",
  "prophet-ii": "Prophet II",
  "prophet-iii": "Prophet III"
};

function ppDateKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function ppReadCalendarPersonalEvents() {
  try {
    const data = JSON.parse(localStorage.getItem(PP_CALENDAR_EVENTS_KEY) || "[]");
    return Array.isArray(data) ? data.filter((item) => item && item.date) : [];
  } catch {
    return [];
  }
}

function ppReadWishlistCount() {
  try {
    const data = JSON.parse(localStorage.getItem(PP_WISHLIST_KEY) || "[]");
    return Array.isArray(data) ? data.filter((item) => item && item.id).length : 0;
  } catch {
    return 0;
  }
}

function ppFormatCalendarDate(dateKey) {
  try {
    const [year, month, day] = String(dateKey || "").split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "long"
    }).format(date);
  } catch {
    return "fecha privada";
  }
}

async function ppLoadDropsForAccountPreview() {
  try {
    const res = await fetch(PP_DROPS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function renderAccountCalendarPreview() {
  const summarySlot = document.querySelector("[data-account-calendar-summary]");
  const nextSlot = document.querySelector("[data-account-calendar-next]");

  if (!summarySlot && !nextSlot) return;

  const todayKey = ppDateKey(new Date());
  const personal = ppReadCalendarPersonalEvents();
  const drops = await ppLoadDropsForAccountPreview();

  const allEvents = [
    ...drops.map((event) => ({
      ...event,
      source: "drop"
    })),
    ...personal.map((event) => ({
      ...event,
      source: "personal"
    }))
  ].filter((event) => event.date && event.date >= todayKey)
   .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const wishlistCount = ppReadWishlistCount();

  if (summarySlot) {
    summarySlot.textContent =
      `${allEvents.length} fechas próximas · ${wishlistCount} pieza${wishlistCount === 1 ? "" : "s"} guardada${wishlistCount === 1 ? "" : "s"} en wishlist.`;
  }

  if (nextSlot) {
    const next = allEvents[0];

    if (!next) {
      nextSlot.textContent = "No hay próximas fechas guardadas.";
      return;
    }

    const typeLabel = next.source === "personal" ? "Fecha personal" : "Lanzamiento";
    nextSlot.textContent = `${typeLabel}: ${next.title || "Movimiento Prophetia"} · ${ppFormatCalendarDate(next.date)}.`;
  }
}


let ppCachedTribeMember = null;

function ppNormalizeVaultRank(rankId = "") {
  return String(rankId || "tribe-member")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function ppGetVaultRankLevel(rankId = "") {
  const clean = ppNormalizeVaultRank(rankId);
  return PP_VAULT_RANK_ORDER[clean] ?? 0;
}

function ppGetVaultRankLabel(rankId = "") {
  const clean = ppNormalizeVaultRank(rankId);
  return PP_VAULT_RANK_LABELS[clean] || rankId || "Tribe Member";
}

function ppHasVaultRank(userRankId = "", requiredRankId = "tribe-member") {
  return ppGetVaultRankLevel(userRankId) >= ppGetVaultRankLevel(requiredRankId);
}

async function ppLoadVaultItemsForAccountPreview() {
  try {
    const res = await fetch(PP_VAULT_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function renderAccountVaultPreview(member = ppCachedTribeMember) {
  const summarySlot = document.querySelector("[data-account-vault-summary]");
  const nextSlot = document.querySelector("[data-account-vault-next]");

  if (!summarySlot && !nextSlot) return;

  const vaultItems = await ppLoadVaultItemsForAccountPreview();

  if (!member) {
    if (summarySlot) {
      summarySlot.textContent =
        "Inicia sesión para consultar tus accesos privados dentro del Vault.";
    }

    if (nextSlot) {
      nextSlot.textContent = "Vault privado pendiente de sesión.";
    }

    return;
  }

  const userRankId = member?.isPrestigeActive && member?.prestigeId
    ? member.prestigeId
    : member?.rankId || "tribe-member";

  const unlocked = vaultItems.filter((item) => {
    return ppHasVaultRank(userRankId, item.requiredRankId || "tribe-member");
  });

  const locked = vaultItems.filter((item) => {
    return !ppHasVaultRank(userRankId, item.requiredRankId || "tribe-member");
  });

  if (summarySlot) {
    summarySlot.textContent =
      `${unlocked.length} acceso${unlocked.length === 1 ? "" : "s"} disponible${unlocked.length === 1 ? "" : "s"} · ${locked.length} entrada${locked.length === 1 ? "" : "s"} bloqueada${locked.length === 1 ? "" : "s"} por rango.`;
  }

  if (nextSlot) {
    const next = locked
      .slice()
      .sort((a, b) => {
        return ppGetVaultRankLevel(a.requiredRankId) - ppGetVaultRankLevel(b.requiredRankId);
      })[0];

    if (!next) {
      nextSlot.textContent = "Todo el Vault actual está desbloqueado.";
      return;
    }

    nextSlot.textContent =
      `Próximo acceso: ${next.title || "Entrada Vault"} · requiere ${ppGetVaultRankLabel(next.requiredRankId)}.`;
  }
}
function renderTribeMissions(card, missions = []) {
  const section = card.querySelector("[data-tribe-missions]");
  const list = card.querySelector("[data-tribe-missions-list]");
  const summary = card.querySelector("[data-tribe-missions-summary]");

  if (!section || !list) return;

  const prepared = preparePublicMissions(missions);

  if (!prepared.length) {
    section.hidden = true;
    list.innerHTML = "";
    return;
  }

  section.hidden = false;

  const completedCount = prepared.filter((mission) => {
    return normalizeMissionStatus(mission) === "completed";
  }).length;

  const allCompleted = completedCount === prepared.length;

  section.classList.toggle("is-all-completed", allCompleted);

  const storageKey = "pp_tribe_missions_expanded";
  const savedExpanded = localStorage.getItem(storageKey) === "true";

  section.classList.toggle("is-expanded", allCompleted && savedExpanded);

  if (summary) {
    summary.textContent = `${completedCount}/${prepared.length} completadas`;
  }

  let toggle = section.querySelector("[data-tribe-missions-toggle]");

  if (allCompleted) {
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "account-tribe__missionsToggle";
      toggle.setAttribute("data-tribe-missions-toggle", "");

      const head = section.querySelector(".account-tribe__missionsHead");
      if (head) {
        head.appendChild(toggle);
      }
    }

    const isExpanded = section.classList.contains("is-expanded");

    toggle.textContent = isExpanded ? "Ocultar archivo" : "Ver archivo";
    toggle.setAttribute("aria-expanded", String(isExpanded));
    toggle.setAttribute("aria-controls", "accountTribeMissionsList");

    if (!toggle.__ppMissionsToggleBound) {
      toggle.__ppMissionsToggleBound = true;

      toggle.addEventListener("click", () => {
        const nextExpanded = !section.classList.contains("is-expanded");

        section.classList.toggle("is-expanded", nextExpanded);
        localStorage.setItem(storageKey, String(nextExpanded));

        toggle.textContent = nextExpanded ? "Ocultar archivo" : "Ver archivo";
        toggle.setAttribute("aria-expanded", String(nextExpanded));
      });
    }
  } else if (toggle) {
    toggle.remove();
    localStorage.removeItem(storageKey);
    section.classList.remove("is-expanded");
  }

  list.id = "accountTribeMissionsList";

  list.innerHTML = prepared.map((mission) => {
    const status = normalizeMissionStatus(mission);
    const target = Math.max(1, Number(mission.target || 1));
    const progress = Math.max(0, Math.min(Number(mission.progress || 0), target));
    const percent = Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
    const action = status === "pending" ? getMissionAction(mission) : null;

    const points = Number(mission.points || 0);
    const pointsLabel = points > 0 ? `+${points} LP` : "Archivo";

    return `
      <article class="account-tribe__mission is-${escapeHtml(status)}" data-mission-id="${escapeHtml(mission.id)}">
        <div class="account-tribe__missionTop">
          <div>
            <p class="account-tribe__missionTitle">
              ${escapeHtml(mission.title || "Misión Prophetia")}
            </p>

            <p class="account-tribe__missionText">
              ${escapeHtml(mission.description || "")}
            </p>
          </div>

          <span class="account-tribe__missionReward">
            ${escapeHtml(pointsLabel)}
          </span>
        </div>

        <div class="account-tribe__missionBar" aria-label="Progreso de misión">
          <span style="width:${percent}%"></span>
        </div>

        <div class="account-tribe__missionMeta">
          <span>
            ${progress}/${target}
          </span>

          ${
            status === "completed"
              ? `<strong>Completada</strong>`
              : status === "locked"
                ? `<strong>Bloqueada</strong>`
                : action
                  ? `<a href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`
                  : `<strong>Pendiente</strong>`
          }
        </div>
      </article>
    `;
  }).join("");
}

function renderPrivateRewards(card, rewards = []) {
  let section = card.querySelector("[data-tribe-rewards]");

  const privateRewards = Array.isArray(rewards)
    ? rewards.filter((reward) => {
        return reward?.type === "rank_discount" && reward.code && Number(reward.percent || 0) > 0;
      })
    : [];

  if (!privateRewards.length) {
    if (section) section.remove();
    return;
  }

  if (!section) {
    section = document.createElement("section");
    section.className = "account-tribe__rewards";
    section.setAttribute("data-tribe-rewards", "");
  }

  section.innerHTML = `
    <div class="account-tribe__rewardsHead">
      <p>Recompensas privadas</p>
      <span>Códigos desbloqueados por rango</span>
    </div>

    <div class="account-tribe__rewardsList">
      ${privateRewards
        .map((reward) => {
          const status = String(reward.status || "available").toLowerCase();
          const isUsed = status === "used";
          const statusLabel = getRewardStatusLabel(status);
          const rank = reward.rank || "Tribe";
          const percent = Number(reward.percent || 0);
          const minSubtotal = Number(reward.minSubtotal || 0);
          const code = String(reward.code || "").trim().toUpperCase();

          return `
            <article class="account-tribe__reward is-${escapeHtml(status)}">
              <div class="account-tribe__rewardTop">
                <div>
                  <p class="account-tribe__rewardName">
                    ${escapeHtml(rank)} Reward — ${percent}%
                  </p>
                  <p class="account-tribe__rewardMeta">
                    Pedido mínimo: ${minSubtotal} €
                  </p>
                </div>

                <span class="account-tribe__rewardStatus">
                  ${escapeHtml(statusLabel)}
                </span>
              </div>

              <div class="account-tribe__rewardCode">
                <code>${escapeHtml(code)}</code>

                ${
                  isUsed
                    ? `<span class="account-tribe__rewardUsed">Usada</span>`
                    : `<button type="button" data-tribe-copy-reward="${escapeHtml(code)}">Copiar</button>`
                }
              </div>

              ${
                isUsed && reward.usedOrderId
                  ? `<p class="account-tribe__rewardOrder">Usada en ${escapeHtml(reward.usedOrderId)}</p>`
                  : ''
              }
            </article>
          `;
        })
        .join("")}
    </div>
  `;

  const benefitText = card.querySelector("[data-tribe-benefit]");

  if (benefitText) {
    benefitText.insertAdjacentElement("beforebegin", section);
  } else {
    card.appendChild(section);
  }

  section.querySelectorAll("[data-tribe-copy-reward]").forEach((button) => {
    if (button.__ppCopyBound) return;

    button.__ppCopyBound = true;

    button.addEventListener("click", async () => {
      const code = button.getAttribute("data-tribe-copy-reward") || "";

      try {
        await navigator.clipboard.writeText(code);

        const previousText = button.textContent;
        button.textContent = "Copiado";

        window.setTimeout(() => {
          button.textContent = previousText || "Copiar";
        }, 1300);
      } catch {
        button.textContent = "Copia manual";
      }
    });
  });
}

function getAvailableRewardLabel(member) {
  const rewards = Array.isArray(member.availableRewards)
    ? member.availableRewards
    : Array.isArray(member.rewards)
      ? member.rewards.filter((reward) => String(reward.status || "").toLowerCase() === "available")
      : [];

  if (!rewards.length) return "";

  return `Recompensas disponibles: ${rewards
    .map((reward) => `${reward.rank} Reward ${Number(reward.percent || 0)}%`)
    .join(" · ")}.`;
}
  function getBenefitLabel(member) {
    const usedCount = Number(member.usedCount || 0);
    const discountStatus = String(member.discountStatus || "").toLowerCase();
if (discountStatus === "signed_out") {
  return "Sesión cerrada. Inicia sesión para ver tus privilegios.";
}
        if (discountStatus === "loading") {
      return "Consultando tu estado Prophetia Tribe.";
    }

    if (discountStatus === "not_member") {
      return "Beneficio actual: únete a Prophetia Tribe para activar ventajas.";
    }

    if (usedCount > 0 || discountStatus === "used") {
      return "Beneficio actual: TRIBE10 utilizado.";
    }

    if (discountStatus === "available" || discountStatus === "pending") {
      return "Beneficio actual: TRIBE10 disponible.";
    }

    return "Beneficio actual: acceso Prophetia Tribe activo.";
  }

function getPrestigeDisplay(data = {}) {
  const prestige = data.prestige || {};
  const prestigeLabel =
    data.prestigeLabel ||
    prestige.prestigeLabel ||
    "";

  const nextPrestigeLabel =
    data.nextPrestigeLabel ||
    prestige.nextPrestigeLabel ||
    "";

  const pointsToNextPrestige = Number(
    data.pointsToNextPrestige ??
    prestige.pointsToNextPrestige ??
    0
  );

  const prestigeProgressPercent = Number(
    data.prestigeProgressPercent ??
    prestige.prestigeProgressPercent ??
    0
  );

  const prestigeBenefits = Array.isArray(data.prestigeBenefits)
    ? data.prestigeBenefits
    : Array.isArray(prestige.prestigeBenefits)
      ? prestige.prestigeBenefits
      : [];

  return {
    isActive: !!(data.isPrestigeActive || prestige.isPrestigeActive),
    label: prestigeLabel,
    displayLabel: prestigeLabel || "Prophet Base",
    nextLabel: nextPrestigeLabel,
    pointsToNext: pointsToNextPrestige,
    progress: Math.max(0, Math.min(100, prestigeProgressPercent)),
    benefits: prestigeBenefits
  };
}

function renderTribeCard(member) {
  const card = document.querySelector("[data-tribe-profile-card]");
  if (!card) return;

  const data = {
    ...getFallbackTribeData(),
    ...(member || {}),
  };

const rankId = normalizeRankId(data.rankId || data.rank);
const isMember = rankId === "member";
const rankData = TRIBE_RANKS[rankId] || TRIBE_RANKS.member;
const prestige = getPrestigeDisplay(data);
const isProphet = rankId === "prophet";

  const progress = isProphet && prestige.isActive
    ? prestige.progress
    : Number.isFinite(Number(data.progressPercent))
      ? Math.max(0, Math.min(100, Number(data.progressPercent)))
      : calculateProgress(data);

  const points = Number(data.points || 0);
  const lifetimePoints = Number(data.lifetimePoints || 0);

  const nextRank = isProphet && prestige.isActive
    ? prestige.nextLabel
    : data.nextRank || rankData.next;

  const nextRankAt = Number(data.nextRankAt || rankData.nextAt || 0);

  const pointsToNextRank = isProphet && prestige.isActive
    ? prestige.pointsToNext
    : Number(data.pointsToNextRank ?? Math.max(0, nextRankAt - points));

const visualRankKey = getVisualRankKeyFromState(
  rankId,
  prestige.displayLabel
);

const visualRankId = normalizeRankId(visualRankKey);

card.classList.remove(
  "rank-member",
  "rank-initiate",
  "rank-adeptus",
  "rank-oracle",
  "rank-archivist",
  "rank-prophet",
  "rank-prestige-i",
  "rank-prophet-prestige-1"
);

card.classList.add(`rank-${visualRankId}`);
card.dataset.rank = visualRankId;

  if (isProphet && prestige.isActive) {
    card.setAttribute("data-prestige", data.prestigeId || data.prestige?.prestigeId || "prophet-base");
  } else {
    card.removeAttribute("data-prestige");
  }

const rankEl = card.querySelector("[data-tribe-rank]");
const prestigeEl = card.querySelector("[data-tribe-prestige]");
const emblemEl = card.querySelector("[data-tribe-emblem]");
const summaryEl = card.querySelector("[data-tribe-summary]");
const progressEl = card.querySelector("[data-tribe-progress]");
const pointsEl = card.querySelector("[data-tribe-points]");
const nextEl = card.querySelector("[data-tribe-next]");
const lifetimeEl = card.querySelector("[data-tribe-lifetime]");
const remainingEl = card.querySelector("[data-tribe-remaining]");
const benefitEl = card.querySelector("[data-tribe-benefit]");
const remainingLabelEl = card.querySelector(".account-tribe__details p:nth-child(2) span");

if (rankEl) {
  rankEl.textContent = data.rank || rankData.label;
}

if (prestigeEl) {
  if (isProphet) {
    prestigeEl.textContent = prestige.displayLabel || "Prophet Base";
    prestigeEl.hidden = false;
  } else if (isMember) {
    prestigeEl.textContent = "Primer rango pendiente";
    prestigeEl.hidden = false;
  } else {
    prestigeEl.textContent = "";
    prestigeEl.hidden = true;
  }
}

if (emblemEl) {
  const emblemSrc = getRankEmblemSrc(visualRankId);

  if (emblemEl.getAttribute("src") !== emblemSrc) {
    emblemEl.setAttribute("src", emblemSrc);
  }

  emblemEl.setAttribute("data-rank-emblem", visualRankId);
}

  if (data.accessLabel && rankEl) {
    rankEl.setAttribute("title", data.accessLabel);
  }

  const benefitsToRender = isProphet && prestige.isActive && prestige.benefits.length
    ? [...(Array.isArray(data.benefits) ? data.benefits : []), ...prestige.benefits]
    : data.benefits;

renderBenefitList(card, benefitsToRender);
renderPrivateRewards(card, data.rewards || data.availableRewards || []);
renderTribeMissions(card, data.missions || []);

if (summaryEl) {
  if (isMember) {
    summaryEl.textContent =
      data.rankMessage ||
      "Tu archivo Prophetia está abierto. Tu primer rango ceremonial se activa con tu primera adquisición.";
  } else if (isProphet && prestige.isActive) {
    summaryEl.textContent = prestige.nextLabel
      ? `Tu título Prophet permanece. Tu emblema evoluciona hacia ${prestige.nextLabel}.`
      : "Prestige activo. Nuevos círculos de prestigio podrán revelarse en futuras temporadas.";
  } else {
    summaryEl.textContent =
      data.rankMessage ||
      data.message ||
      (
        rankId === "prophet"
          ? "Has alcanzado el rango maestro de Prophetia Tribe."
          : "Tu archivo personal dentro de Prophetia está creciendo con cada adquisición."
      );
  }
}

  if (progressEl) {
    window.requestAnimationFrame(() => {
      progressEl.style.width = `${progress}%`;
    });
  }

if (pointsEl) {
  if (isMember) {
    pointsEl.textContent = "0 LP";
  } else if (isProphet && prestige.isActive) {
    const target = prestige.nextLabel && data.nextPrestigeAt
      ? Number(data.nextPrestigeAt).toLocaleString("es-ES")
      : lifetimePoints.toLocaleString("es-ES");

    pointsEl.textContent = data.nextPrestigeAt
      ? `${lifetimePoints.toLocaleString("es-ES")} / ${target} LP`
      : formatLegacyPoints(lifetimePoints);
  } else {
    pointsEl.textContent = nextRankAt
      ? `${Number(points).toLocaleString("es-ES")} / ${Number(nextRankAt).toLocaleString("es-ES")} LP`
      : formatLegacyPoints(points);
  }
}

if (nextEl) {
  if (isMember) {
    nextEl.textContent = "Primer emblema por revelar";
  } else if (isProphet && prestige.isActive) {
    nextEl.textContent = prestige.nextLabel
      ? `Siguiente emblema: ${prestige.nextLabel}`
      : "Prestige activo";
  } else {
    nextEl.textContent = nextRank
      ? `Próximo emblema: ${nextRank}`
      : "Rango completo";
  }
}

if (lifetimeEl) {
  lifetimeEl.textContent = formatLegacyPoints(lifetimePoints);
}

  if (remainingLabelEl) {
    remainingLabelEl.textContent = isProphet && prestige.isActive
      ? "Prestigio"
      : "Restante";
  }

if (remainingEl) {
  if (isMember) {
    remainingEl.textContent = "1 LP";
  } else if (isProphet && prestige.isActive) {
    remainingEl.textContent = prestige.nextLabel
      ? formatLegacyPoints(pointsToNextRank)
      : "Completo";
  } else {
    remainingEl.textContent = nextRank
      ? formatLegacyPoints(pointsToNextRank)
      : "Completo";
  }
}

  if (benefitEl) {
    const rewardLabel = getAvailableRewardLabel(data);
if (isMember) {
  benefitEl.textContent = "Primer objetivo: realiza tu primera adquisición para activar Initiate.";
  return;
}
    if (rewardLabel) {
      benefitEl.textContent = rewardLabel;
} else if (isProphet && prestige.isActive && prestige.nextLabel) {
  benefitEl.textContent = `${formatLegacyPoints(pointsToNextRank)} para revelar ${prestige.nextLabel}.`;
    } else if (isProphet && prestige.isActive) {
      benefitEl.textContent = "Privilegio activo: círculo Prophetia superior.";
    } else if (data.freeShipping?.enabled && rankId === "prophet") {
      benefitEl.textContent = "Privilegio activo: envío gratuito permanente.";
    } else if (data.freeShipping?.enabled) {
      benefitEl.textContent = `Privilegio activo: envío gratuito desde ${data.freeShipping.minSubtotal} €.`;
    } else {
      benefitEl.textContent = getBenefitLabel(data);
    }
  }
}

  async function getFirebaseUserToken() {
    const directUser =
      window.__ppAuthCurrentUser ||
      window.__ppLastUser ||
      null;

    if (directUser?.getIdToken) {
      try {
        return await directUser.getIdToken();
      } catch {
        return null;
      }
    }

    return new Promise((resolve) => {
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
          const token = await user.getIdToken();
          resolve(token);
        } catch {
          resolve(null);
        }
      };

      const onAuthChanged = (event) => {
        finish(event.detail?.user || null);
      };

      const onAuthReady = () => {
        finish(window.__ppAuthCurrentUser || window.__ppLastUser || null);
      };

      window.addEventListener("pp:auth-changed", onAuthChanged, { once: true });
      window.addEventListener("pp:auth-ready", onAuthReady, { once: true });

      window.setTimeout(() => {
        finish(window.__ppAuthCurrentUser || window.__ppLastUser || null);
      }, 2500);
    });
  }

  async function loadTribeProfile() {
    const card = document.querySelector("[data-tribe-profile-card]");
    if (!card) return;

    if (!tribeProfileRequested) {
      tribeProfileRequested = true;

  renderTribeCard({
  ...getFallbackTribeData(),
  rank: "Cargando",
  rankId: "member",
  nextRank: "Consultando archivo",
        points: 0,
        lifetimePoints: 0,
        pointsToNextRank: 0,
        progressPercent: 0,
        discountStatus: "loading",
      });
    }

    const token = await getFirebaseUserToken();

    if (!token) {
      console.warn("[Prophetia Tribe] No hay token Firebase todavía.");
      return;
    }

    try {
      const response = await fetch("/api/tribe/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn("[Prophetia Tribe] Error API:", response.status);
        return;
      }

const member = await response.json();

console.info("[Prophetia Tribe] Perfil cargado:", member);

ppCachedTribeMember = member;

renderTribeCard(member);
renderAccountVaultPreview(member);
    } catch (err) {
      console.warn("[Prophetia Tribe] No se pudo cargar el perfil:", err);
    }
  }

  let tribeProfileRequested = false;

  function refreshTribeProfile() {
    const card = document.querySelector("[data-tribe-profile-card]");
    if (!card) return;

    loadTribeProfile();
  }
function handleTribeMissionCompleted(event) {
  const detail = event.detail || {};
  const missionEvent = detail.missionEvent || null;

  console.info("[Prophetia Tribe] Misión completada:", detail);

  if (missionEvent) {
    try {
      localStorage.setItem("pp_tribe_xp_event", JSON.stringify(missionEvent));
    } catch {}
  }

  tribeProfileRequested = false;
  refreshTribeProfile();
  renderAccountVaultPreview();
}

function initPage() {
  init();
  renderAccountCalendarPreview();
  renderAccountVaultPreview();
    /*
      Primer intento: por si Firebase ya está listo.
    */
    refreshTribeProfile();

    /*
      Segundo intento: cuando firebase-auth.js confirme usuario.
      Este es el importante para Firebase modular.
    */
 window.addEventListener("pp:auth-changed", (event) => {
  const user = event.detail?.user || null;

if (!user) {
  tribeProfileRequested = false;
  ppCachedTribeMember = null;

  renderTribeCard({
    ...getFallbackTribeData(),
    rank: "Sesión cerrada",
    rankId: "member",
    nextRank: "Inicia sesión",
    points: 0,
    lifetimePoints: 0,
    pointsToNextRank: 0,
    progressPercent: 0,
    discountStatus: "signed_out",
    benefits: [],
    rankMessage: "Inicia sesión para consultar tu archivo Prophetia Tribe."
  });

  renderAccountVaultPreview(null);
  return;
}

refreshTribeProfile();
renderAccountVaultPreview();
});

    /*
      Tercer intento: seguridad por si el evento ya ocurrió antes
      de que account-content.js estuviera escuchando.
    */
    window.setTimeout(() => {
      refreshTribeProfile();
    }, 900);

    window.setTimeout(() => {
      refreshTribeProfile();
    }, 1800);
window.addEventListener("storage", (event) => {
  if (event.key === WISHLIST_KEY) {
    refreshTribeProfile();
    renderAccountCalendarPreview();
    renderAccountVaultPreview();
  }

  if (event.key === PP_CALENDAR_EVENTS_KEY) {
    renderAccountCalendarPreview();
  }
});

window.addEventListener("pp:wishlist-updated", () => {
  refreshTribeProfile();
  renderAccountCalendarPreview();
  renderAccountVaultPreview();
});
window.addEventListener("pp:tribe-mission-completed", handleTribeMissionCompleted);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPage, { once: true });
  } else {
    initPage();
  }
})();
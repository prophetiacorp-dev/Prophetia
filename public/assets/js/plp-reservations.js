/* =========================================================
   PROPHETIA - PLP Reservations / Stock Waitlist / Collection pill
   Reservations: users/{uid}/reservations/{productId}
   Stock waitlist: stockWaitlist/{sku}/entries/{email}
   ========================================================= */

import { auth, db } from "./firebase-init.js";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

(() => {
  if (window.__PP_PLP_RESERVATIONS__) return;

  const grid = document.getElementById("plp-grid");
  if (!grid) return;

  window.__PP_PLP_RESERVATIONS__ = true;

  const RESERVE_SELECTOR = "[data-plp-reserve]";
  const STOCK_NOTIFY_SELECTOR = "[data-stock-notify]";
  const COLLECTION_PILL_SELECTOR = "[data-plp-collection-pill]";
  const RESERVATION_PATH = "/reservas";
  const NOTIFY_ENDPOINT = "/api/reservations/notify";

  let activeStockCard = null;
  let activeStockOptions = [];
  let stockModal = null;

  function normalize(value = "") {
    return String(value ?? "").trim();
  }

  function normalizeLower(value = "") {
    return normalize(value).toLowerCase();
  }

  function getVariantPartLabel(value = "", kind = "") {
    const raw = normalize(value);
    const key = raw.toLowerCase();
    const labels = kind === "color"
      ? {
          black: "Negro", white: "Blanco", beige: "Beige", cream: "Crema",
          navy: "Azul marino", blue: "Azul", yellow: "Amarillo", red: "Rojo",
          green: "Verde", orange: "Naranja", pink: "Rosa", grey: "Gris",
          gray: "Gris", brown: "Marrón", multicolor: "Multicolor"
        }
      : {
          classic: "Clásico", regular: "Regular", oversize: "Oversize",
          oversized: "Oversize", boxy: "Boxy", fitted: "Entallado"
        };

    return labels[key] || (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "");
  }

  function normalizePath(value = "") {
    const raw = normalize(value);
    if (!raw) return "";

    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin === window.location.origin) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
      return url.href;
    } catch {
      return raw.startsWith("/") ? raw : `/${raw}`;
    }
  }

  function isValidEmail(value = "") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalize(value));
  }

  function escapeHtml(value = "") {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }

  function getCurrentUser() {
    return (
      auth.currentUser ||
      window.ppGetCurrentUser?.() ||
      window.__ppAuthCurrentUser ||
      window.__ppLastUser ||
      null
    );
  }

  function getProductId(card, product) {
    return normalize(
      product?.id ||
      product?._id ||
      card?.dataset?.id ||
      card?.querySelector("[data-id]")?.dataset?.id ||
      ""
    );
  }

  function getProduct(card) {
    const productId = getProductId(card);

    if (
      productId &&
      typeof window.ppPLP?.getProduct === "function"
    ) {
      const product = window.ppPLP.getProduct(productId);
      if (product) return product;
    }

    if (
      productId &&
      typeof window.ppPLP?.getFirestoreProducts === "function"
    ) {
      return (
        window.ppPLP
          .getFirestoreProducts()
          .find((item) => {
            return (
              String(item?.id || "") === productId ||
              String(item?._id || "") === productId
            );
          }) ||
        null
      );
    }

    return null;
  }

  function getVariants(product) {
    return Array.isArray(product?.variants)
      ? product.variants
      : [];
  }

  function totalVariantStock(product) {
    return getVariants(product).reduce((total, variant) => {
      return total + Math.max(0, Number(variant?.stock) || 0);
    }, 0);
  }

  function isOutOfStock(product) {
    if (!product) return false;

    const variants = getVariants(product);
    if (variants.length > 0) {
      return totalVariantStock(product) <= 0;
    }

    return product.inStock === false;
  }

  function pickMedia(product) {
    if (product?._media) return product._media;

    const media =
      product?.media &&
      typeof product.media === "object"
        ? product.media
        : null;

    if (!media) return null;

    const gender = normalizeLower(grid.dataset.gender);
    if (gender && media[gender]) return media[gender];
    if (gender === "hombre" && media.men) return media.men;
    if (gender === "mujer" && media.women) return media.women;

    return (
      media.default ||
      media.unisex ||
      media.hombre ||
      media.mujer ||
      media.men ||
      media.women ||
      null
    );
  }

  function pickImage(card, product) {
    const cardImage =
      card?.querySelector(".card-media img, .plp-media img, img")
        ?.getAttribute("src") || "";

    const media = pickMedia(product);
    const mediaImage =
      media?.cover ||
      (Array.isArray(media?.images) ? media.images[0] : "") ||
      "";

    return normalizePath(
      cardImage ||
      mediaImage ||
      product?.image ||
      product?.img ||
      product?.cover ||
      "assets/img/placeholder.png"
    );
  }

  function getProductUrl(card, product) {
    const href =
      card?.querySelector(".card-title a[href], .card-link[href], .card-media[href], a[href]")
        ?.getAttribute("href") ||
      product?.url ||
      "";

    if (href) return normalizePath(href);

    const productId = getProductId(card, product);
    const gender = normalize(grid.dataset.gender);
    const params = new URLSearchParams({ id: productId });

    if (gender) params.set("g", gender);

    return `/producto?${params.toString()}`;
  }

  function getProductPrice(card, product) {
    if (
      product?.price !== undefined &&
      product?.price !== null &&
      product?.price !== ""
    ) {
      return product.price;
    }

    const raw =
      card?.dataset?.price ||
      card?.querySelector(".card-price, .price, [data-price]")
        ?.textContent ||
      "";

    return normalize(raw);
  }

  function getProductTitle(card, product) {
    return normalize(
      product?.title ||
      card?.querySelector(".card-title, .product-card__title, h3, h4")
        ?.textContent ||
      "Producto Prophetia"
    );
  }

  function getFallbackProduct(card) {
    const productId = getProductId(card);
    if (!productId) return null;

    return {
      id: productId,
      title: getProductTitle(card, null),
      price: getProductPrice(card, null),
      image: pickImage(card, null),
      url: getProductUrl(card, null),
      variants: []
    };
  }

  function slug(value = "") {
    return normalize(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function prettifyCollectionLabel(label = "") {
    const clean = normalize(label)
      .replace(/\s*Prophetia\s*/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) return "";
    if (/after\s*hour/i.test(clean) || /afterhour/i.test(clean)) return "Afterhour";
    if (/myth/i.test(clean)) return "Myth Series";

    return clean;
  }

  function resolveCollectionLabel(product) {
    if (!product) return "";

    const idTitle = slug([
      product.id,
      product._id,
      product.slug,
      product.title,
      product.collection,
      product.collectionLabel
    ].join(" "));

    if (
      idTitle.includes("like-gods") ||
      idTitle.includes("freestyler-drift") ||
      idTitle.includes("break-negra") ||
      idTitle.includes("breakbeat") ||
      idTitle.includes("afterhour")
    ) {
      return "Afterhour";
    }

    if (
      idTitle.includes("atlas") ||
      idTitle.includes("calyra") ||
      slug(product.collection || product._collection) === "myth-series"
    ) {
      return "Myth Series";
    }

    const collection = slug(product.collection || product._collection || "");
    const labels = {
      "afterhour": "Afterhour",
      "myth-series": "Myth Series",
      "letters-from-the-soul": "Letters From The Soul",
      "summer-archive": "Summer Archive",
      "prophetia-originals": "Prophetia Originals"
    };

    if (labels[collection]) return labels[collection];

    return prettifyCollectionLabel(
      product.collectionLabel ||
      product.collectionName ||
      product.collectionTitle ||
      ""
    );
  }

  function getProductSnapshot(card, product) {
    return {
      productId: getProductId(card, product),
      title: getProductTitle(card, product),
      image: pickImage(card, product),
      url: getProductUrl(card, product),
      price: getProductPrice(card, product)
    };
  }

  function showNotice(
    message = "Producto añadido a reservas",
    href = RESERVATION_PATH
  ) {
    if (
      typeof window.ppToast === "function" &&
      document.getElementById("ppToast")
    ) {
      window.ppToast(message, href);
      return;
    }

    let toast = document.getElementById("ppReservationToast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "ppReservationToast";
      toast.className = "pp-toast pp-reservation-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      toast.hidden = true;
      toast.innerHTML = `
        <div class="pp-toast__inner">
          <span data-reservation-toast-message></span>
          <a class="pp-toast__cta" data-reservation-toast-link href="/reservas">Ver</a>
        </div>
      `;
      document.body.appendChild(toast);
    }

    const text = toast.querySelector("[data-reservation-toast-message]");
    const link = toast.querySelector("[data-reservation-toast-link]");

    if (text) text.textContent = message;
    if (link) link.setAttribute("href", href);

    toast.hidden = false;
    toast.classList.add("is-open");

    window.clearTimeout(toast.__ppTimer);
    toast.__ppTimer = window.setTimeout(() => {
      toast.classList.remove("is-open");
    }, 3000);
  }

  function promptLogin() {
    if (typeof window.ppPromptAccountAccess === "function") {
      window.ppPromptAccountAccess(
        "Inicia sesion para reservar esta pieza",
        RESERVATION_PATH
      );
      return;
    }

    showNotice(
      "Inicia sesion para reservar esta pieza",
      RESERVATION_PATH
    );

    if (typeof window.ppOpenAuth === "function") {
      window.ppOpenAuth();
    } else {
      document.getElementById("ppAuthLogoBtn")?.click();
    }
  }

  function createReserveButton(card, product) {
    const button = document.createElement("button");
    const title = getProductTitle(card, product);

    button.type = "button";
    button.className = "pp-reserve-btn";
    button.dataset.plpReserve = "";
    button.title = "Reservar";
    button.setAttribute("aria-label", `Reservar ${title}`);
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4.75h10a1.5 1.5 0 0 1 1.5 1.5v13l-6.5-3.5-6.5 3.5v-13A1.5 1.5 0 0 1 7 4.75Z"></path>
        <path d="M12 7.75v4.5"></path>
        <path d="M9.75 10h4.5"></path>
      </svg>
      <span class="pp-reserve-btn__label">Reservar</span>
    `;

    return button;
  }

  function placeReserveButton(card, product) {
    let button = card.querySelector(RESERVE_SELECTOR);

    if (!button) {
      button = createReserveButton(card, product);
    }

    const quickAddToggle = card.querySelector("[data-quick-add-toggle], .pp-quick-add-toggle");
    const stockNotify = card.querySelector(STOCK_NOTIFY_SELECTOR);
    const options =
      quickAddToggle?.closest(".pp-card-options") ||
      stockNotify?.closest(".pp-card-options") ||
      card.querySelector(".pp-card-options");

    if (options) {
      if (stockNotify?.parentElement === options) {
        if (button.nextElementSibling !== stockNotify) {
          stockNotify.before(button);
        }
      } else if (quickAddToggle) {
        if (button.nextElementSibling !== quickAddToggle) {
          quickAddToggle.before(button);
        }
      } else if (stockNotify) {
        if (button.nextElementSibling !== stockNotify) {
          stockNotify.before(button);
        }
      } else {
        if (button.parentElement !== options) {
          options.appendChild(button);
        }
      }
      return button;
    }

    const meta = card.querySelector(".card-meta");
    if (meta) {
      if (button.parentElement !== meta) {
        meta.appendChild(button);
      }
      return button;
    }

    const body = card.querySelector(".card-body, .body") || card;
    if (button.parentElement !== body) {
      body.appendChild(button);
    }
    return button;
  }

  function createStockNotifyButton(card, product) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "pp-stock-notify-btn";
    button.dataset.stockNotify = "";
    button.textContent = "Avisarme cuando haya stock";
    button.setAttribute(
      "aria-label",
      `Avisarme cuando haya stock de ${getProductTitle(card, product)}`
    );

    return button;
  }

  function syncStockNotify(card, product) {
    const out = isOutOfStock(product);
    const quickAddToggle = card.querySelector("[data-quick-add-toggle], .pp-quick-add-toggle");
    let button = card.querySelector(STOCK_NOTIFY_SELECTOR);

    card.classList.toggle("is-plp-out-of-stock", out);

    if (!out) {
      button?.remove();
      if (quickAddToggle) {
        quickAddToggle.hidden = false;
        quickAddToggle.removeAttribute("aria-hidden");
      }
      return;
    }

    if (!button) {
      button = createStockNotifyButton(card, product);
    }

    if (quickAddToggle) {
      quickAddToggle.hidden = true;
      quickAddToggle.setAttribute("aria-hidden", "true");
      if (button.nextElementSibling !== quickAddToggle) {
        quickAddToggle.before(button);
      }
      return;
    }

    const reserveButton = card.querySelector(RESERVE_SELECTOR);
    const options = reserveButton?.closest(".pp-card-options") || card.querySelector(".pp-card-options");

    if (options) {
      if (reserveButton?.parentElement === options) {
        if (reserveButton.nextElementSibling !== button) {
          reserveButton.after(button);
        }
      } else {
        if (button.parentElement !== options) {
          options.appendChild(button);
        }
      }
      return;
    }

    const meta = card.querySelector(".card-meta");
    if (meta) {
      if (button.parentElement !== meta) {
        meta.appendChild(button);
      }
      return;
    }

    const body = card.querySelector(".card-body, .body") || card;
    if (button.parentElement !== body) {
      body.appendChild(button);
    }
  }

  function syncCollectionPill(card, product) {
    const label = resolveCollectionLabel(product);
    let pill = card.querySelector(COLLECTION_PILL_SELECTOR);

    if (!label) {
      pill?.remove();
      return;
    }

    if (!pill) {
      pill = document.createElement("span");
      pill.className = "pp-card-collection-pill";
      pill.dataset.plpCollectionPill = "";
      pill.setAttribute("aria-hidden", "true");
    }

    pill.textContent = label;

    const media =
      card.querySelector(".plp-media") ||
      card.querySelector(".card-media") ||
      card.querySelector(".img-wrap");

    if (media && pill.parentElement !== media) {
      media.appendChild(pill);
    }
  }

  async function getAuthHeaders() {
    const user = getCurrentUser();

    if (!user || typeof user.getIdToken !== "function") {
      return {};
    }

    try {
      const token = await user.getIdToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }

  async function notifyProphetia(type, payload = {}) {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(NOTIFY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify({
        ...payload,
        type,
        source: "plp-grid",
        page: window.location.href
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error || "No se pudo avisar a Prophetia.");
    }

    return data;
  }

  async function saveReservation(card) {
    const user = getCurrentUser();

    if (!user) {
      promptLogin();
      return;
    }

    const product = getProduct(card) || getFallbackProduct(card);
    const productId = getProductId(card, product);
    if (!productId) return;

    const button = card.querySelector(RESERVE_SELECTOR);
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    }

    const reservationRef = doc(
      db,
      "users",
      user.uid,
      "reservations",
      productId
    );

    const now = serverTimestamp();
    const existing = await getDoc(reservationRef);
    const previous = existing.exists() ? existing.data() : null;
    const snapshot = getProductSnapshot(card, product);
    const reservationData = {
      productId,
      title: snapshot.title,
      image: snapshot.image,
      url: snapshot.url,
      price: snapshot.price,
      status: "active",
      statusLabel: "Reserva activa",
      estimatedDate: "Fecha por confirmar",
      createdAt: previous?.createdAt || now,
      updatedAt: now
    };

    await setDoc(
      reservationRef,
      reservationData,
      { merge: true }
    );

    showNotice("Producto añadido a reservas", RESERVATION_PATH);

    void notifyProphetia("reservation", {
      ...snapshot,
      productId,
      userId: user.uid,
      userEmail: user.email || ""
    }).catch((error) => {
      console.warn("[PLP Reservations] No se pudo enviar aviso interno:", error);
    });

    if (button) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }

  function getWaitlistOptions(card, product) {
    const productId = getProductId(card, product);
    const variants = getVariants(product);

    if (!variants.length) {
      return [
        {
          sku: productId,
          label: "Producto Prophetia",
          image: pickImage(card, product)
        }
      ];
    }

    return variants
      .filter((variant) => Math.max(0, Number(variant?.stock) || 0) <= 0)
      .map((variant, index) => {
      const label = [
        getVariantPartLabel(variant?.cut, "cut"),
        getVariantPartLabel(variant?.color, "color"),
        normalize(variant?.size).toUpperCase()
      ].filter(Boolean).join(" · ");

      return {
        sku: normalize(variant?.sku || `${productId}_${index + 1}`),
        label: label || normalize(variant?.sku) || `Variante ${index + 1}`,
        image: normalizePath(
          variant?.img ||
          variant?.image ||
          pickImage(card, product)
        )
      };
      });
  }

  function ensureStockModal() {
    if (stockModal) return stockModal;

    stockModal = document.createElement("div");
    stockModal.className = "pp-stock-modal";
    stockModal.dataset.stockWaitlistModal = "";
    stockModal.hidden = true;
    stockModal.innerHTML = `
      <div class="pp-stock-modal__card" role="dialog" aria-modal="true" aria-labelledby="ppStockModalTitle">
        <button class="pp-stock-modal__close" type="button" data-stock-modal-close aria-label="Cerrar">×</button>
        <p class="pp-stock-modal__kicker">Producto agotado</p>
        <h2 id="ppStockModalTitle" class="pp-stock-modal__title">Avisarme cuando haya stock</h2>
        <p class="pp-stock-modal__copy" data-stock-modal-copy></p>
        <form class="pp-stock-modal__form" data-stock-modal-form>
          <label class="pp-stock-modal__field" data-stock-modal-sku-field>
            <span>Variante</span>
            <select data-stock-modal-sku></select>
          </label>
          <label class="pp-stock-modal__field">
            <span>Correo electrónico</span>
            <input type="email" autocomplete="email" inputmode="email" data-stock-modal-email required>
          </label>
          <small class="pp-stock-modal__privacy">
            Usaremos tu correo únicamente para este aviso. Consulta nuestra
            <a href="/privacy">política de privacidad</a>.
          </small>
          <p class="pp-stock-modal__status" data-stock-modal-status aria-live="polite"></p>
          <button class="pp-stock-modal__submit" type="submit">Recibir aviso</button>
        </form>
      </div>
    `;

    document.body.appendChild(stockModal);

    stockModal.addEventListener("click", (event) => {
      if (
        event.target === stockModal ||
        event.target.closest("[data-stock-modal-close]")
      ) {
        closeStockModal();
      }
    });

    stockModal
      .querySelector("[data-stock-modal-form]")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        void submitStockWaitlist();
      });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !stockModal.hidden) {
        closeStockModal();
      }
    });

    return stockModal;
  }

  function setStockModalStatus(message = "", isError = false) {
    const status = stockModal?.querySelector("[data-stock-modal-status]");
    if (!status) return;

    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function openStockModal(card, preferred = {}) {
    const product = getProduct(card) || getFallbackProduct(card);

    if (!product) return;

    activeStockCard = card;
    activeStockOptions = getWaitlistOptions(card, product);
    if (!activeStockOptions.length) return;

    const modal = ensureStockModal();
    const copy = modal.querySelector("[data-stock-modal-copy]");
    const skuField = modal.querySelector("[data-stock-modal-sku-field]");
    const skuSelect = modal.querySelector("[data-stock-modal-sku]");
    const emailInput = modal.querySelector("[data-stock-modal-email]");
    const title = getProductTitle(card, product);
    const user = getCurrentUser();

    if (copy) {
      copy.textContent = `Déjanos tu correo y te avisaremos por email cuando ${title} vuelva a estar disponible.`;
    }

    if (skuSelect) {
      skuSelect.innerHTML = activeStockOptions.map((option, index) => {
        return `
          <option value="${String(index)}">
            ${escapeHtml(option.label)}
          </option>
        `;
      }).join("");

      const preferredSku = normalize(preferred.sku);
      const preferredIndex = preferredSku
        ? activeStockOptions.findIndex((option) => option.sku === preferredSku)
        : -1;
      skuSelect.value = String(preferredIndex >= 0 ? preferredIndex : 0);
    }

    if (skuField) {
      skuField.hidden = activeStockOptions.length <= 1;
    }

    if (emailInput) {
      emailInput.value = normalize(user?.email || "");
    }

    setStockModalStatus("");
    modal.hidden = false;

    window.requestAnimationFrame(() => {
      emailInput?.focus({ preventScroll: true });
    });
  }

  function closeStockModal() {
    if (!stockModal) return;

    stockModal.hidden = true;
    activeStockCard = null;
    activeStockOptions = [];
    setStockModalStatus("");
  }

  function getSelectedWaitlistOption() {
    const select = stockModal?.querySelector("[data-stock-modal-sku]");
    const index = Number(select?.value || 0);
    return activeStockOptions[index] || activeStockOptions[0] || null;
  }

  async function submitStockWaitlist() {
    const card = activeStockCard;
    const product = card ? (getProduct(card) || getFallbackProduct(card)) : null;
    const emailInput = stockModal?.querySelector("[data-stock-modal-email]");
    const submit = stockModal?.querySelector(".pp-stock-modal__submit");
    const email = normalizeLower(emailInput?.value || "");
    const option = getSelectedWaitlistOption();
    const user = getCurrentUser();

    if (!card || !product || !option) {
      setStockModalStatus("No se ha podido identificar la pieza.", true);
      return;
    }

    if (!isValidEmail(email)) {
      setStockModalStatus("Introduce un correo válido.", true);
      emailInput?.focus();
      return;
    }

    const snapshot = getProductSnapshot(card, product);
    const payload = {
      ...snapshot,
      productId: snapshot.productId,
      sku: option.sku || snapshot.productId,
      variantLabel: option.label || "",
      image: option.image || snapshot.image,
      email,
      userId: user?.uid || "",
      userEmail: user?.email || ""
    };

    if (submit) {
      submit.disabled = true;
      submit.setAttribute("aria-busy", "true");
    }

    setStockModalStatus("Guardando aviso...");

    try {
      const serverResult = await notifyProphetia("stock-waitlist", payload);

      if (!serverResult?.waitlistSaved && !serverResult?.emailSent) {
        throw new Error("No se pudo registrar el aviso.");
      }

      showNotice(
        serverResult?.alreadyRegistered
          ? "Ya tienes un aviso activo para esta talla"
          : "Aviso guardado. Te escribiremos cuando vuelva el stock",
        snapshot.url
      );
      closeStockModal();
    } catch (error) {
      console.error("[PLP Reservations] No se pudo guardar aviso de stock:", error);
      setStockModalStatus("No se pudo guardar el aviso. Inténtalo de nuevo.", true);
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.removeAttribute("aria-busy");
      }
    }
  }

  function syncCard(card) {
    if (!card) return;

    const product = getProduct(card) || getFallbackProduct(card);

    if (!product || !getProductId(card, product)) {
      return;
    }

    syncCollectionPill(card, product);
    placeReserveButton(card, product);
    syncStockNotify(card, product);
    card.classList.add("has-plp-reserve");
  }

  function syncGrid() {
    grid
      .querySelectorAll(".card, .product-card")
      .forEach(syncCard);
  }

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(syncGrid);
  });

  observer.observe(grid, {
    childList: true,
    subtree: true
  });

  document.addEventListener("pp:plp:rendered", () => {
    window.requestAnimationFrame(syncGrid);
  });

  window.addEventListener("pp:auth-changed", syncGrid);
  window.addEventListener("pp:auth-ready", syncGrid);

  document.addEventListener("pp:stock-notify-variant", (event) => {
    const detail = event?.detail || {};
    const card = detail.card;

    if (!card || !card.matches?.(".card, .product-card")) return;

    openStockModal(card, {
      sku: normalize(detail.sku),
      color: normalize(detail.color),
      size: normalize(detail.size)
    });
  });

  document.addEventListener(
    "click",
    (event) => {
      const reserveButton = event.target.closest(RESERVE_SELECTOR);
      const stockButton = event.target.closest(STOCK_NOTIFY_SELECTOR);

      if (!reserveButton && !stockButton) return;

      event.preventDefault();
      event.stopPropagation();

      const card = (reserveButton || stockButton).closest(".card, .product-card");
      if (!card) return;

      if (reserveButton) {
        if (reserveButton.disabled) return;

        void saveReservation(card).catch((error) => {
          console.error("[PLP Reservations] No se pudo guardar la reserva:", error);
          showNotice("No se pudo guardar la reserva", RESERVATION_PATH);
          reserveButton.disabled = false;
          reserveButton.removeAttribute("aria-busy");
        });
        return;
      }

      if (stockButton) {
        openStockModal(card);
      }
    },
    true
  );

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncGrid, { once: true });
  } else {
    syncGrid();
  }
})();

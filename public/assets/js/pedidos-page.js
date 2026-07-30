/* =========================================================
   PROPHETIA · Pedidos Page
   Fuente: /api/my-orders desde data/orders.json
   ========================================================= */

import { auth } from "./firebase-init.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const ordersLoading = document.querySelector("[data-orders-loading]");
const loggedBlock = document.querySelector("[data-pp-orders-logged]");
const ordersList = document.querySelector("[data-orders-list]");
const ordersEmpty = document.querySelector("[data-orders-empty]");

let currentUser = null;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value = 0, currency = "EUR") {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency
    }).format(Number(value || 0));
  } catch {
    return `${Number(value || 0).toFixed(2)} €`;
  }
}

function orderDeliveryLabel(order = {}) {
  if (order.estimatedDelivery) return String(order.estimatedDelivery);
  const estimate = order.shippingRate?.deliveryEstimate || {};
  if (typeof estimate === "string" && estimate.trim()) return estimate.trim();
  if (estimate.label) return String(estimate.label);
  if (Number.isInteger(estimate.minBusinessDays) && Number.isInteger(estimate.maxBusinessDays)) {
    return `${estimate.minBusinessDays}–${estimate.maxBusinessDays} días laborables`;
  }
  return "Pendiente de confirmación";
}

function formatDate(value) {
  if (!value) return "Fecha no disponible";

  try {
    const date = new Date(value);

    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  } catch {
    return "Fecha no disponible";
  }
}



function showLoggedState() {
  if (loggedBlock) loggedBlock.hidden = false;

  document.body.classList.add("pp-auth-logged");
  document.body.classList.remove("pp-auth-guest");
}

function getStatusStep(order) {
  const fulfillment = String(order.fulfillmentStatus || "").toLowerCase();
  const payment = String(order.paymentStatus || order.status || "").toLowerCase();

  if (payment !== "paid" && payment !== "succeeded") return 0;
  if (fulfillment === "preparing") return 1;
  if (fulfillment === "shipped") return 2;
  if (fulfillment === "delivered") return 3;

  return 1;
}

function renderStatus(order) {
  const current = getStatusStep(order);

const payment = String(order.paymentStatus || order.status || "").toLowerCase();

const steps = [
  payment === "paid" || payment === "succeeded"
    ? "Pago confirmado"
    : "Pago pendiente",
  "En preparación",
  "Enviado",
  "Entregado"
];

  return `
    <div class="order-status" aria-label="Estado del pedido">
      ${steps.map((label, index) => {
        const stateClass = index < current ? "is-done" : index === current ? "is-active" : "";

        return `
          <div class="order-status__step ${stateClass}">
            ${escapeHtml(label)}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderItems(order) {
  const items = Array.isArray(order.items) ? order.items : [];

  if (!items.length) {
    return `
      <div class="order-items">
        <p class="order-item__meta">No hay artículos registrados en este pedido.</p>
      </div>
    `;
  }

  return `
    <div class="order-items">
      ${items.map((item) => {
        const title = escapeHtml(item.title || "Pieza Prophetia");
        const image = escapeHtml(item.image || item.img || "assets/img/placeholder.png");
        const qty = Number(item.qty || 1);
        const lineTotal = Number(item.lineTotal || item.unitPrice * qty || item.price * qty || 0);
        const currency = order.currency || "EUR";

        const meta = [
          item.size ? `Talla: ${item.size}` : "",
          item.color ? `Color: ${item.color}` : "",
          `Cantidad: ${qty}`
        ].filter(Boolean).join(" · ");

        return `
          <article class="order-item">
            <div class="order-item__media">
              <img src="${image}" alt="${title}" loading="lazy">
            </div>

            <div>
              <h4 class="order-item__title">${title}</h4>
              <p class="order-item__meta">${escapeHtml(meta)}</p>
            </div>

            <div class="order-item__price">
              ${money(lineTotal, currency)}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderOrders(orders) {
  if (!ordersList) return;
if (ordersLoading) {
  ordersLoading.hidden = true;
}
  const hasOrders = Array.isArray(orders) && orders.length > 0;

  // Si hay usuario logado, nunca debe verse el bloque de invitado
 if (currentUser) {
  showLoggedState();
}

  if (ordersEmpty) {
    ordersEmpty.hidden = hasOrders;
  }

  if (!hasOrders) {
    ordersList.innerHTML = "";
    return;
  }

  ordersList.innerHTML = orders.map((order) => {
    const orderNumber = escapeHtml(order.orderNumber || `Pedido ${order.id}`);
    const statusLabel = escapeHtml(order.statusLabel || "Pedido confirmado");
    const createdAt = formatDate(order.paidAt || order.createdAt);
    const estimatedDelivery = escapeHtml(orderDeliveryLabel(order));
    const currency = order.currency || "EUR";
    const total = money(order.total || order.amountTotal || 0, currency);
    const trackingUrl = order.trackingUrl ? escapeHtml(order.trackingUrl) : "";

    return `
      <article class="order-card" data-order-id="${escapeHtml(order.id)}">
        <div class="order-card__top">
          <div>
            <span class="order-card__tag">${statusLabel}</span>

            <h3 class="order-card__title">${orderNumber}</h3>

            <p class="order-card__meta">
              Pedido realizado: ${escapeHtml(createdAt)}<br>
              Entrega estimada: ${estimatedDelivery}
            </p>
          </div>

          <div class="order-card__total">
            Total
            <span class="order-card__price">${total}</span>
          </div>
        </div>

        ${renderStatus(order)}

        ${renderItems(order)}

        <div class="order-card__actions">
          ${trackingUrl ? `<a href="${trackingUrl}" target="_blank" rel="noopener">Seguimiento</a>` : ""}
          <a href="/contact">Necesito ayuda</a>
        </div>
      </article>
    `;
  }).join("");
}

async function loadOrdersForUser(user) {
  if (!user || !user.email) {
    window.location.assign("/home");
    return;
  }

  showLoggedState();

  try {
    const idToken = await user.getIdToken(true);

    const res = await fetch("/api/my-orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({})
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "No se han podido cargar los pedidos.");
    }

    renderOrders(Array.isArray(data.orders) ? data.orders : []);
} catch (error) {
  console.error("[PEDIDOS] Error cargando pedidos:", error);

  if (ordersLoading) {
    ordersLoading.hidden = true;
  }

  if (ordersEmpty) {
    ordersEmpty.hidden = false;
    ordersEmpty.innerHTML = `
      <p class="orders-empty__kicker">Error de conexión</p>

      <h3>No se han podido cargar tus pedidos.</h3>

      <p>
        Recarga la página o vuelve a iniciar sesión. Si el problema continúa,
        contacta con Prophetia para revisar tu pedido.
      </p>

      <a href="/contact" class="orders-empty__link">
        Contactar con Prophetia
      </a>
    `;
  }

  if (ordersList) {
    ordersList.innerHTML = "";
  }
}
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const openLogin = event.target.closest("[data-pp-open-login]");
    const openRegister = event.target.closest("[data-pp-open-register]");

    if (!openLogin && !openRegister) return;

    event.preventDefault();

    if (typeof window.ppOpenAuth === "function") {
      window.ppOpenAuth(openRegister ? "register" : "login");
    }
  });
}

bindEvents();

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;

  if (!currentUser) {
    window.location.assign("/home");
    return;
  }

  showLoggedState();
  loadOrdersForUser(currentUser);
});

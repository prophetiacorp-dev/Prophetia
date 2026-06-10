/* =========================================================
   PROPHETIA · Reservas Page
   Firestore: users/{uid}/reservations/{reservationId}
   ========================================================= */

import { auth, db } from "./firebase-init.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const guestBlock = document.querySelector("[data-pp-reservations-guest]");
const loggedBlock = document.querySelector("[data-pp-reservations-logged]");
const reservationsList = document.querySelector("[data-reservations-list]");
const reservationsEmpty = document.querySelector("[data-reservations-empty]");

let currentUser = null;
let unsubscribeReservations = null;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getReservationsRef() {
  if (!currentUser) return null;
  return collection(db, "users", currentUser.uid, "reservations");
}

function showGuestState() {
  if (guestBlock) guestBlock.hidden = false;
  if (loggedBlock) loggedBlock.hidden = true;

  document.body.classList.remove("pp-auth-logged");
  document.body.classList.add("pp-auth-guest");

  renderReservations([]);
}

function showLoggedState() {
  if (guestBlock) guestBlock.hidden = true;
  if (loggedBlock) loggedBlock.hidden = false;

  document.body.classList.add("pp-auth-logged");
  document.body.classList.remove("pp-auth-guest");
}

function renderReservations(reservations) {
  if (!reservationsList) return;

  const hasReservations = reservations.length > 0;

  if (reservationsEmpty) {
    reservationsEmpty.hidden = hasReservations;
  }

  reservationsList.innerHTML = reservations.map((reservation) => {
    const id = escapeHtml(reservation.id);
    const title = escapeHtml(reservation.title || "Pieza Prophetia");
    const status = escapeHtml(reservation.statusLabel || "Reserva activa");
    const date = escapeHtml(reservation.estimatedDate || "Fecha por confirmar");
    const image = escapeHtml(reservation.image || "assets/img/placeholder.png");
    const url = escapeHtml(reservation.url || "/colecciones");

    return `
      <article class="reservation-card" data-reservation-id="${id}">
        <div class="reservation-card__media">
          <img src="${image}" alt="${title}" loading="lazy">
        </div>

        <div class="reservation-card__content">
          <span class="reservation-card__tag">${status}</span>

          <h3 class="reservation-card__title">${title}</h3>

          <p class="reservation-card__text">
            Fecha estimada: ${date}<br>
            Te avisaremos cuando esta pieza esté disponible para finalizar la compra.
          </p>
        </div>

        <div class="reservation-card__actions">
          <a href="${url}">Ver pieza</a>
          <button type="button" data-reservation-delete="${id}">
            Cancelar
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function listenReservations() {
  if (!currentUser) return;

  if (unsubscribeReservations) {
    unsubscribeReservations();
  }

  const reservationsRef = getReservationsRef();
  const reservationsQuery = query(reservationsRef, orderBy("createdAt", "desc"));

  unsubscribeReservations = onSnapshot(reservationsQuery, (snapshot) => {
    const reservations = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    renderReservations(reservations);
  }, (error) => {
    console.error("[RESERVAS] Error leyendo reservas:", error);
    renderReservations([]);
  });
}

async function deleteReservation(reservationId) {
  if (!currentUser || !reservationId) return;

  const ok = window.confirm("¿Cancelar esta reserva del archivo Prophetia?");
  if (!ok) return;

  const reservationRef = doc(db, "users", currentUser.uid, "reservations", reservationId);
  await deleteDoc(reservationRef);
}

function bindEvents() {
  document.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest("[data-reservation-delete]");
    if (!deleteBtn) return;

    event.preventDefault();
    await deleteReservation(deleteBtn.dataset.reservationDelete);
  });

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
    if (unsubscribeReservations) unsubscribeReservations();
    showGuestState();
    return;
  }

  showLoggedState();
  listenReservations();
});
/* =========================================================
   PROPHETIA · Account Page
   account.html
   Usa la MISMA instancia Firebase/Auth que el header.
   ========================================================= */

import { auth } from "./firebase-init.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const SHOP_PREF_KEY = "pp_shop_preference";

const prefMap = {
  women: {
    label: "Mujer",
    href: "/camisetas-punto-mujer"
  },
  men: {
    label: "Hombre",
    href: "/camisetas-punto-hombre"
  },
  all: {
    label: "Todo Prophetia",
    href: "/colecciones"
  }
};

function getShopPref() {
  const saved = localStorage.getItem(SHOP_PREF_KEY);
  return prefMap[saved] ? saved : "all";
}

function setShopPref(pref) {
  if (!prefMap[pref]) return;

  localStorage.setItem(SHOP_PREF_KEY, pref);

  document.querySelectorAll("[data-pref-shop]").forEach((btn) => {
    const active = btn.dataset.prefShop === pref;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });

  const genderSlot = document.querySelector("[data-account-gender]");
  if (genderSlot) genderSlot.textContent = prefMap[pref].label;
}

function getDisplayName(user) {
  if (!user) return "Cliente Prophetia";

  if (user.displayName) return user.displayName;

  const email = user.email || "";
  if (!email) return "Cliente Prophetia";

  return email.split("@")[0];
}

function showLoggedState(user) {
  const loggedBlocks = document.querySelectorAll("[data-pp-account-logged]");
  const guestBlock = document.querySelector("[data-pp-account-guest]");

  loggedBlocks.forEach((block) => {
    block.hidden = false;
  });

  if (guestBlock) {
    guestBlock.hidden = true;
  }

  const email = user.email || "Cuenta registrada";
  const displayName = getDisplayName(user);

  const emailSlot = document.querySelector("[data-account-email]");
  const nameSlot = document.querySelector("[data-account-name]");
  const lastnameSlot = document.querySelector("[data-account-lastname]");
  const birthSlot = document.querySelector("[data-account-birth]");
  const countrySlot = document.querySelector("[data-account-country]");
  const phoneSlot = document.querySelector("[data-account-phone]");
  const addressSlot = document.querySelector("[data-account-address]");

  if (emailSlot) emailSlot.textContent = email;
  if (nameSlot) nameSlot.textContent = displayName;
  if (lastnameSlot) lastnameSlot.textContent = "—";
  if (birthSlot) birthSlot.textContent = "—";
  if (countrySlot) countrySlot.textContent = "España";
  if (phoneSlot) phoneSlot.textContent = "—";
  if (addressSlot) addressSlot.textContent = "—";

  setShopPref(getShopPref());

  document.body.classList.add("pp-auth-logged");
  document.body.classList.remove("pp-auth-guest", "pp-account-loading");


}

function showGuestState() {
  const loggedBlocks = document.querySelectorAll("[data-pp-account-logged]");
  const guestBlock = document.querySelector("[data-pp-account-guest]");

  loggedBlocks.forEach((block) => {
    block.hidden = true;
  });

  if (guestBlock) {
    guestBlock.hidden = false;
  }

  document.body.classList.remove("pp-auth-logged", "pp-account-loading");
  document.body.classList.add("pp-auth-guest");

 
}

function bindPreferenceButtons() {
  document.querySelectorAll("[data-pref-shop]").forEach((btn) => {
    if (btn.__ppPrefBound) return;
    btn.__ppPrefBound = true;

    btn.addEventListener("click", () => {
      setShopPref(btn.dataset.prefShop);
    });
  });
}

function bindGuestAuthButtons() {
  document.addEventListener("click", (e) => {
    const openLogin = e.target.closest("[data-pp-open-login]");
    const openRegister = e.target.closest("[data-pp-open-register]");

    if (!openLogin && !openRegister) return;

    e.preventDefault();

    if (typeof window.ppOpenAuth === "function") {
      window.ppOpenAuth();
      return;
    }

    console.warn("[ACCOUNT] ppOpenAuth todavía no está disponible.");
  });
}

function initAccountPage() {
  document.body.classList.add("pp-account-loading");

  bindPreferenceButtons();
  bindGuestAuthButtons();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      showLoggedState(user);
    } else {
      showGuestState();
    }
  });

  window.addEventListener("pp:auth-changed", (ev) => {
    const user = ev.detail?.user || null;

    if (user) {
      showLoggedState(user);
    } else {
      showGuestState();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAccountPage, { once: true });
} else {
  initAccountPage();
}
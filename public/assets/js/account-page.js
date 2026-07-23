/* =========================================================
   PROPHETIA · Account Page
   Datos personales sincronizados con Firestore.
   ========================================================= */

import { auth, db } from "./firebase-init.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  onAuthStateChanged,
  updateProfile
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

const genderLabels = {
  female: "Mujer",
  male: "Hombre",
  other: "Otro",
  na: "Prefiero no decirlo"
};

const countryLabels = {
  ES: "España",
  PT: "Portugal",
  FR: "Francia",
  IT: "Italia",
  DE: "Alemania",
  AD: "Andorra"
};

let currentUser = null;
let currentProfile = {};
let profileRequestId = 0;

function cleanText(value = "") {
  return String(value || "").trim();
}

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
}

function getDisplayName(user) {
  if (!user) return "Cliente Prophetia";
  if (user.displayName) return user.displayName;

  const email = user.email || "";
  return email ? email.split("@")[0] : "Cliente Prophetia";
}

function getNameParts(user, profile = {}) {
  const firstName = cleanText(profile.firstName);
  const lastName = cleanText(profile.lastName);

  if (firstName || lastName) {
    return { firstName, lastName };
  }

  const displayName = cleanText(profile.displayName || user?.displayName);
  if (!displayName) {
    return {
      firstName: getDisplayName(user),
      lastName: ""
    };
  }

  const parts = displayName.split(/\s+/);
  return {
    firstName: parts.shift() || "",
    lastName: parts.join(" ")
  };
}

function formatBirthFromISO(value = "") {
  const match = cleanText(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function birthISOFromDisplay(value = "") {
  const match = cleanText(value).match(/^(\d{2})[/.\-](\d{2})[/.\-](\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function getBirthISO(profile = {}) {
  return cleanText(profile.birthISO) || birthISOFromDisplay(profile.birth);
}

function getCountryLabel(value = "") {
  const clean = cleanText(value);
  if (!clean) return "—";
  return countryLabels[clean.toUpperCase()] || clean;
}

function normalizeCountryForStorage(value = "") {
  const clean = cleanText(value);
  if (!clean) return "";

  const entry = Object.entries(countryLabels).find(([, label]) => {
    return label.localeCompare(clean, "es", { sensitivity: "base" }) === 0;
  });

  return entry?.[0] || clean;
}

function setSlot(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = cleanText(value) || "—";
}

function buildProfileView(user, profile = {}) {
  const { firstName, lastName } = getNameParts(user, profile);
  const phone = [cleanText(profile.phoneCode), cleanText(profile.phone)]
    .filter(Boolean)
    .join(" ");

  return {
    gender: genderLabels[cleanText(profile.gender)] || cleanText(profile.gender),
    firstName,
    lastName,
    email: cleanText(user?.email || profile.email) || "Cuenta registrada",
    birth: cleanText(profile.birth) || formatBirthFromISO(profile.birthISO),
    country: getCountryLabel(profile.country),
    phone,
    address: cleanText(profile.address)
  };
}

function renderProfile(user, profile = {}) {
  const view = buildProfileView(user, profile);

  setSlot("[data-account-gender]", view.gender);
  setSlot("[data-account-name]", view.firstName);
  setSlot("[data-account-lastname]", view.lastName);
  setSlot("[data-account-email]", view.email);
  setSlot("[data-account-birth]", view.birth);
  setSlot("[data-account-country]", view.country);
  setSlot("[data-account-phone]", view.phone);
  setSlot("[data-account-address]", view.address);
}

function closePersonalEditor({ restoreFocus = false } = {}) {
  const form = document.querySelector("[data-account-personal-form]");
  const view = document.querySelector("[data-account-personal-view]");
  const editButton = document.querySelector("[data-account-edit-personal]");
  const status = document.querySelector("[data-account-personal-status]");

  if (form) form.hidden = true;
  if (view) view.hidden = false;

  if (editButton) {
    editButton.hidden = false;
    editButton.setAttribute("aria-expanded", "false");
    if (restoreFocus) editButton.focus({ preventScroll: true });
  }

  if (status) {
    status.hidden = true;
    status.textContent = "";
    status.classList.remove("is-error");
  }
}

function fillPersonalForm() {
  const form = document.querySelector("[data-account-personal-form]");
  if (!form || !currentUser) return;

  const { firstName, lastName } = getNameParts(currentUser, currentProfile);

  form.elements.gender.value = cleanText(currentProfile.gender);
  form.elements.firstName.value = firstName;
  form.elements.lastName.value = lastName;
  form.elements.birthISO.value = getBirthISO(currentProfile);
  form.elements.country.value = getCountryLabel(currentProfile.country) === "—"
    ? ""
    : getCountryLabel(currentProfile.country);
  form.elements.phoneCode.value = cleanText(currentProfile.phoneCode);
  form.elements.phone.value = cleanText(currentProfile.phone);
  form.elements.address.value = cleanText(currentProfile.address);
}

function openPersonalEditor() {
  const form = document.querySelector("[data-account-personal-form]");
  const view = document.querySelector("[data-account-personal-view]");
  const editButton = document.querySelector("[data-account-edit-personal]");

  if (!form || !currentUser) return;

  fillPersonalForm();
  form.hidden = false;
  if (view) view.hidden = true;

  if (editButton) {
    editButton.hidden = true;
    editButton.setAttribute("aria-expanded", "true");
  }

  requestAnimationFrame(() => {
    form.elements.firstName?.focus({ preventScroll: true });
  });
}

function setPersonalStatus(message = "", { error = false } = {}) {
  const status = document.querySelector("[data-account-personal-status]");
  if (!status) return;

  status.textContent = message;
  status.hidden = !message;
  status.classList.toggle("is-error", error);
}

async function savePersonalProfile(form) {
  if (!currentUser) return;

  const firstName = cleanText(form.elements.firstName.value);
  const lastName = cleanText(form.elements.lastName.value);

  if (!firstName || !lastName) {
    setPersonalStatus("Indica tu nombre y apellidos.", { error: true });
    (!firstName ? form.elements.firstName : form.elements.lastName)
      ?.focus({ preventScroll: true });
    return;
  }

  const birthISO = cleanText(form.elements.birthISO.value);
  const payload = {
    uid: currentUser.uid,
    email: cleanText(currentUser.email),
    displayName: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    gender: cleanText(form.elements.gender.value),
    birth: formatBirthFromISO(birthISO),
    birthISO,
    country: normalizeCountryForStorage(form.elements.country.value),
    phoneCode: cleanText(form.elements.phoneCode.value),
    phone: cleanText(form.elements.phone.value),
    address: cleanText(form.elements.address.value),
    updatedAt: serverTimestamp()
  };

  const submitButton = form.querySelector("[data-account-personal-save]");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
  }

  setPersonalStatus("Guardando cambios…");

  try {
    await Promise.all([
      setDoc(doc(db, "users", currentUser.uid), payload, { merge: true }),
      updateProfile(currentUser, { displayName: payload.displayName })
    ]);

    currentProfile = {
      ...currentProfile,
      ...payload
    };

    renderProfile(currentUser, currentProfile);
    window.dispatchEvent(new CustomEvent("pp:account-profile-updated", {
      detail: {
        user: currentUser,
        profile: currentProfile
      }
    }));

    closePersonalEditor({ restoreFocus: true });
  } catch (error) {
    console.error("[ACCOUNT] No se pudieron guardar los datos personales", error);
    setPersonalStatus(
      "No hemos podido guardar los cambios. Inténtalo de nuevo.",
      { error: true }
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
    }
  }
}

function showLoggedState(user, profile = {}) {
  document.querySelectorAll("[data-pp-account-logged]").forEach((block) => {
    block.hidden = false;
  });

  const guestBlock = document.querySelector("[data-pp-account-guest]");
  if (guestBlock) guestBlock.hidden = true;

  currentUser = user;
  currentProfile = profile;

  renderProfile(user, profile);
  setShopPref(getShopPref());

  document.body.classList.add("pp-auth-logged");
  document.body.classList.remove("pp-auth-guest", "pp-account-loading");
}

async function loadLoggedProfile(user) {
  const requestId = ++profileRequestId;

  try {
    const snapshot = await getDoc(doc(db, "users", user.uid));
    if (requestId !== profileRequestId || auth.currentUser?.uid !== user.uid) return;

    showLoggedState(user, snapshot.exists() ? snapshot.data() : {});
  } catch (error) {
    console.error("[ACCOUNT] No se pudo cargar el perfil", error);
    if (requestId === profileRequestId) showLoggedState(user, {});
  }
}

function showGuestState() {
  profileRequestId += 1;
  currentUser = null;
  currentProfile = {};
  closePersonalEditor();

  document.querySelectorAll("[data-pp-account-logged]").forEach((block) => {
    block.hidden = true;
  });

  const guestBlock = document.querySelector("[data-pp-account-guest]");
  if (guestBlock) guestBlock.hidden = false;

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

function bindPersonalEditor() {
  const editButton = document.querySelector("[data-account-edit-personal]");
  const form = document.querySelector("[data-account-personal-form]");
  const cancelButton = document.querySelector("[data-account-personal-cancel]");

  editButton?.addEventListener("click", openPersonalEditor);
  cancelButton?.addEventListener("click", () => {
    closePersonalEditor({ restoreFocus: true });
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    void savePersonalProfile(form);
  });
}

function bindGuestAuthButtons() {
  document.addEventListener("click", (event) => {
    const openLogin = event.target.closest("[data-pp-open-login]");
    const openRegister = event.target.closest("[data-pp-open-register]");

    if (!openLogin && !openRegister) return;
    event.preventDefault();

    if (typeof window.ppOpenAuth === "function") {
      window.ppOpenAuth();
      return;
    }

    console.warn("[ACCOUNT] ppOpenAuth todavía no está disponible.");
  });
}

function handleAuthUser(user) {
  if (user) {
    void loadLoggedProfile(user);
  } else {
    showGuestState();
  }
}

function initAccountPage() {
  document.body.classList.add("pp-account-loading");

  bindPreferenceButtons();
  bindPersonalEditor();
  bindGuestAuthButtons();

  onAuthStateChanged(auth, handleAuthUser);

  window.addEventListener("pp:auth-changed", (event) => {
    handleAuthUser(event.detail?.user || null);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAccountPage, { once: true });
} else {
  initAccountPage();
}

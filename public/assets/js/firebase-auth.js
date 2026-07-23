// =============================================================
// PROPHETIA — firebase-auth.js (versión limpia PRO)
// Login / Registro / Google / Reset password / Estado global
// =============================================================

// firebase-auth.js (usa init único)
const PP_DEV =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1";
import { auth, db } from "./firebase-init.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

if (PP_DEV) {
  console.info("[AUTH Prophetia] firebase-auth.js cargado");
}

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  EmailAuthProvider,
  linkWithCredential,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
window.ppResendVerificationForCurrentUser = async () => {
  if (!auth) throw new Error("Firebase auth no inicializado");
  const user = auth.currentUser;
  if (!user) throw new Error("No hay usuario logado.");

  await user.reload?.();

  if (user.emailVerified) {
    return { ok: true, alreadyVerified: true };
  }

  await sendEmailVerification(user);

  window.dispatchEvent(new CustomEvent("pp:auth-verify-sent", {
    detail: { email: user.email }
  }));

  return { ok: true, alreadyVerified: false };
};

// =============================================================
// Registro manual email/password + perfil Firestore
// =============================================================
window.ppCreateUserWithEmailPass = async (
  email,
  pass,
  displayName = "",
  profileData = {}
) => {
  if (!auth) throw new Error("Firebase auth no inicializado");

  const cleanEmail = String(email || "").trim().toLowerCase();

  if (!cleanEmail) {
    const e = new Error("Email vacío");
    e.code = "auth/invalid-email";
    throw e;
  }

  if (String(pass || "").length < 8) {
    const e = new Error("Password demasiado corta");
    e.code = "auth/weak-password";
    throw e;
  }

  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);

  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }

  const profileDocument = {
    uid: cred.user.uid,
    email: cleanEmail,
    displayName: displayName || "",
    firstName: profileData.firstName || "",
    lastName: profileData.lastName || "",
    gender: profileData.gender || "",
    birth: profileData.birth || "",
    birthISO: profileData.birthISO || "",
    country: profileData.country || "",
    phoneCode: profileData.phoneCode || "",
    phone: profileData.phone || "",
    newsletter: !!profileData.newsletter,
    termsAccepted: !!profileData.termsAccepted,
    provider: "password",
    emailVerified: false,
    role: "customer",

    profileOnboardingEligible: true,
    profileOnboardingSeen: false,
    profileOnboardingVersion: 1,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(
    doc(db, "users", cred.user.uid),
    profileDocument,
    { merge: true }
  );

  cacheAccountProfile(cred.user.uid, profileDocument);

  /*
    El registro de la cuenta abre también la membresía Tribe.
    Un fallo de correo no invalida la cuenta: queda guardado
    para explicarlo durante el primer acceso.
  */
  await ensureTribeMembership(
    cred.user,
    profileDocument,
    { force: true }
  );

  await sendEmailVerification(cred.user);

  await signOut(auth);

  window.dispatchEvent(new CustomEvent("pp:auth-verify-sent", {
    detail: { email: cred.user.email }
  }));

  return cred;
};

window.ppLinkPasswordToCurrentUser = async (pass) => {
  if (!auth) throw new Error("Firebase auth no inicializado");
  const user = auth.currentUser;
  if (!user) throw new Error("No hay usuario logado (haz login con Google primero).");

  const email = user.email;
  if (!email) throw new Error("El usuario no tiene email.");

  if (String(pass || "").length < 8) {
    const e = new Error("Password demasiado corta");
    e.code = "auth/weak-password";
    throw e;
  }

  const cred = EmailAuthProvider.credential(email, pass);
  return linkWithCredential(user, cred);
};
// =============================================================
// API global para que header-init.js pueda decidir el flujo (Prophetia)
// =============================================================
window.__ppFetchSignInMethodsForEmail = async (email) => {
  const e = String(email || "").trim();
  if (!auth) throw new Error("Firebase auth no inicializado");

  // Si el email es inválido, Firebase devuelve auth/invalid-email.
  // Lo dejamos pasar para que el caller lo gestione.
  return fetchSignInMethodsForEmail(auth, e);
};

if (PP_DEV) {
  window.ppDebugSignInMethods = async (email) => {
    const e = String(email || "").trim();
    const fn = window.__ppFetchSignInMethodsForEmail;

    if (typeof fn !== "function") {
      throw new Error("__ppFetchSignInMethodsForEmail no está disponible.");
    }

    const methods = await fn(e);
    console.info("[AUTH DEBUG] methods:", e, methods);
    return methods;
  };
}



// 4. Proveedor Google (para botón "G")
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// ================== Utils DOM ==================
const $ = (sel, root = document) => root.querySelector(sel);

function showFormError(form, message) {
  if (!form) return;

  let box = form.querySelector(".auth-error-msg");
  if (!box) {
    box = document.createElement("p");
    box.className = "auth-error-msg";
    box.style.marginTop = "8px";
    box.style.fontSize = "12px";
    box.style.color = "#b00020";
    box.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont";
    form.appendChild(box);
  }
  box.textContent = message;
}

function clearFormError(form) {
  const box = form?.querySelector(".auth-error-msg");
  if (box) box.textContent = "";
}

// Traducción rápida de errores Firebase → mensaje humano
function mapFirebaseError(code) {
  switch (code) {
    case "auth/email-not-verified":
  return "Necesitas verificar tu correo antes de iniciar sesión. Te hemos enviado un nuevo email de verificación.";

case "auth/missing-password":
  return "Introduce tu contraseña.";
        case "auth/popup-closed-by-user":
      return "La ventana de Google se ha cerrado antes de completar el inicio de sesión.";
    case "auth/popup-blocked":
      return "El navegador ha bloqueado la ventana de Google. Permite ventanas emergentes para Prophetia.";
    case "auth/cancelled-popup-request":
      return "Ya hay una ventana de inicio de sesión abierta. Cierra la anterior e inténtalo de nuevo.";
    case "auth/unauthorized-domain":
      return "Este dominio no está autorizado en Firebase Authentication.";
    case "auth/invalid-email":
      return "El correo electrónico no es válido.";
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Correo o contraseña incorrectos.";
    case "auth/email-already-in-use":
      return "Este correo ya está registrado. Prueba a iniciar sesión.";
    case "auth/weak-password":
      return "La contraseña es demasiado débil. Elige una más segura.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
    default:
      return "Ha ocurrido un error. Inténtalo de nuevo más tarde.";
  }
}

// =============================================================
// PERFIL DE CUENTA + ALTA TRIBE DEL USUARIO REGISTRADO
// =============================================================

const ppAccountProfileCache = new Map();
const ppTribeEnrollmentPromises = new Map();
const ppTribeEnrollmentAttempted = new Set();

function cleanProfileText(value = "") {
  return String(value || "").trim();
}

function cacheAccountProfile(uid, profile = {}) {
  const nextProfile = {
    ...(ppAccountProfileCache.get(uid) || {}),
    ...profile
  };

  ppAccountProfileCache.set(uid, nextProfile);
  return nextProfile;
}

async function getAccountProfile(user, { force = false } = {}) {
  if (!user?.uid) return {};

  if (!force && ppAccountProfileCache.has(user.uid)) {
    return ppAccountProfileCache.get(user.uid);
  }

  const snapshot = await getDoc(doc(db, "users", user.uid));
  return cacheAccountProfile(
    user.uid,
    snapshot.exists() ? snapshot.data() : {}
  );
}

function getTribeEnrollmentName(user, profile = {}) {
  return cleanProfileText(
    profile.displayName ||
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    user?.displayName ||
    String(user?.email || "").split("@")[0]
  );
}

async function requestTribeEnrollment(user, profile = {}) {
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);
  let response;

  try {
    response = await fetch("/api/tribe/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: getTribeEnrollmentName(user, profile),
        email: cleanProfileText(user.email || profile.email).toLowerCase(),
        birthDate: cleanProfileText(profile.birthISO),
        optin: Boolean(profile.newsletter)
      }),
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.error || "No se ha podido activar tu acceso Prophetia Tribe."
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

async function persistTribeEnrollmentResult(user, profile, result) {
  const welcomeSent = result?.welcomeEmail?.sent;
  const patch = {
    tribeMembershipStatus: result?.isMember ? "active" : "pending",
    tribeMembershipCheckedAt: serverTimestamp(),
    tribeEnrollmentMessage: cleanProfileText(result?.message),
    updatedAt: serverTimestamp()
  };

  if (typeof welcomeSent === "boolean") {
    patch.tribeWelcomeEmailSent = welcomeSent;
    patch.tribeWelcomeEmailStatus = cleanProfileText(
      result?.welcomeEmail?.status
    ) || (welcomeSent ? "sent" : "send_failed");
  } else if (!profile.tribeWelcomeEmailStatus) {
    patch.tribeWelcomeEmailStatus = cleanProfileText(
      result?.welcomeEmail?.status
    ) || "already_member";
  }

  await setDoc(doc(db, "users", user.uid), patch, { merge: true });
  const updatedProfile = cacheAccountProfile(user.uid, patch);

  window.dispatchEvent(new CustomEvent("pp:tribe-membership-ready", {
    detail: {
      user,
      profile: updatedProfile,
      result
    }
  }));

  return updatedProfile;
}

async function persistTribeEnrollmentFailure(user, profile, error) {
  const profileIncomplete = Number(error?.status) === 400;
  const patch = {
    tribeMembershipStatus: profileIncomplete ? "profile_incomplete" : "pending",
    tribeWelcomeEmailSent: false,
    tribeWelcomeEmailStatus: profileIncomplete
      ? "profile_incomplete"
      : "enrollment_failed",
    tribeEnrollmentMessage: cleanProfileText(error?.message),
    tribeMembershipCheckedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, "users", user.uid), patch, { merge: true });
  } catch (writeError) {
    console.warn(
      "[AUTH Prophetia] No se pudo guardar el estado de Tribe",
      writeError
    );
  }

  return cacheAccountProfile(user.uid, {
    ...profile,
    ...patch
  });
}

async function ensureTribeMembership(
  user,
  profile = {},
  { force = false } = {}
) {
  if (!user?.uid) return profile;

  const knownProfile = cacheAccountProfile(user.uid, profile);

  if (!force && knownProfile.tribeMembershipStatus === "active") {
    return knownProfile;
  }

  if (
    !force &&
    (
      knownProfile.tribeMembershipStatus === "profile_incomplete" ||
      ppTribeEnrollmentAttempted.has(user.uid)
    )
  ) {
    return knownProfile;
  }

  if (ppTribeEnrollmentPromises.has(user.uid)) {
    return ppTribeEnrollmentPromises.get(user.uid);
  }

  ppTribeEnrollmentAttempted.add(user.uid);

  const promise = (async () => {
    try {
      const result = await requestTribeEnrollment(user, knownProfile);
      return await persistTribeEnrollmentResult(
        user,
        knownProfile,
        result
      );
    } catch (error) {
      console.warn(
        "[AUTH Prophetia] Alta Tribe pendiente",
        error
      );

      return await persistTribeEnrollmentFailure(
        user,
        knownProfile,
        error
      );
    } finally {
      ppTribeEnrollmentPromises.delete(user.uid);
    }
  })();

  ppTribeEnrollmentPromises.set(user.uid, promise);
  return promise;
}

function renderAccountPanelFirstAccess(user, profile = {}) {
  const notice = document.querySelector("[data-pp-account-first-access]");
  if (!notice) return;

  const isFirstAccess = Boolean(
    user &&
    profile.profileOnboardingEligible === true &&
    profile.profileOnboardingSeen !== true
  );

  if (!isFirstAccess) {
    notice.hidden = true;
    notice.classList.remove("is-warning");
    return;
  }

  const title = notice.querySelector(
    "[data-pp-account-first-access-title]"
  );
  const message = notice.querySelector(
    "[data-pp-account-first-access-message]"
  );
  const membershipStatus = cleanProfileText(
    profile.tribeMembershipStatus
  );
  const welcomeEmailSent = profile.tribeWelcomeEmailSent;

  if (title) title.textContent = "Tu archivo Prophetia está abierto";

  let copy =
    "Tu perfil y tus misiones Prophetia Tribe ya están disponibles en Mi perfil.";
  let warning = false;

  if (membershipStatus === "profile_incomplete") {
    copy = profile.tribeEnrollmentMessage ||
      "Completa tu fecha de nacimiento en Datos de cuenta para activar las misiones Tribe.";
    warning = true;
  } else if (membershipStatus === "pending") {
    copy =
      "No hemos podido terminar de activar Tribe. Tu cuenta está creada y volveremos a comprobarlo en tu próximo acceso.";
    warning = true;
  } else if (welcomeEmailSent === true) {
    copy =
      "Tus misiones ya están activas. También te hemos enviado por correo la bienvenida y tu acceso Prophetia Tribe.";
  } else if (welcomeEmailSent === false) {
    copy =
      "Tus misiones ya están activas, pero no hemos podido enviar el correo de bienvenida. Puedes consultar ahora tus beneficios en Mi perfil.";
    warning = true;
  }

  if (message) message.textContent = copy;
  notice.classList.toggle("is-warning", warning);
  notice.hidden = false;
}

async function syncFirstAccessExperience(user, { forceEnrollment = false } = {}) {
  if (!user?.uid || user.emailVerified !== true) {
    renderAccountPanelFirstAccess(null, {});
    return {};
  }

  try {
    const profile = await getAccountProfile(user);
    renderAccountPanelFirstAccess(user, profile);

    const updatedProfile = await ensureTribeMembership(
      user,
      profile,
      { force: forceEnrollment }
    );

    renderAccountPanelFirstAccess(user, updatedProfile);
    return updatedProfile;
  } catch (error) {
    console.warn(
      "[AUTH Prophetia] No se pudo sincronizar el primer acceso",
      error
    );
    return {};
  }
}

// =============================================================
// PROPHETIA · ONBOARDING DEL PRIMER ACCESO VERIFICADO
// =============================================================

const PP_PROFILE_ONBOARDING_VERSION = 1;
const PP_PROFILE_ONBOARDING_ROUTE = "/my-content";

const ppProfileOnboardingChecks = new Set();

function getProfileOnboardingSnoozeKey(uid) {
  return [
    "pp_profile_onboarding_snoozed",
    PP_PROFILE_ONBOARDING_VERSION,
    uid
  ].join("_");
}

function getProfileOnboardingDialog() {
  return document.querySelector("#ppProfileOnboarding");
}

function closeProfileOnboarding({
  snooze = false,
  uid = ""
} = {}) {
  const dialog = getProfileOnboardingDialog();

  if (snooze && uid) {
    try {
      sessionStorage.setItem(
        getProfileOnboardingSnoozeKey(uid),
        "1"
      );
    } catch {}
  }

  if (!dialog) return;

  try {
    if (dialog.open) {
      dialog.close();
    }
  } catch {}
}

function bindProfileOnboardingDialog(dialog) {
  if (!dialog || dialog.__ppOnboardingBound) return;

  dialog.__ppOnboardingBound = true;

  const snoozeCurrentUser = () => {
    const uid = dialog.dataset.uid || "";

    closeProfileOnboarding({
      snooze: true,
      uid
    });
  };

  dialog.addEventListener("click", async (event) => {
    const primaryButton = event.target.closest(
      "[data-profile-onboarding-open]"
    );

    if (primaryButton) {
      event.preventDefault();

      const uid = dialog.dataset.uid || "";
      const status = dialog.querySelector(
        "[data-profile-onboarding-status]"
      );

      if (!uid) return;

const isPreview =
  PP_DEV &&
  dialog.dataset.preview === "true";

if (isPreview) {
  delete dialog.dataset.preview;

  closeProfileOnboarding();

  window.location.assign(
    PP_PROFILE_ONBOARDING_ROUTE
  );

  return;
}


      primaryButton.disabled = true;
      primaryButton.setAttribute("aria-busy", "true");

      if (status) {
        status.hidden = true;
        status.textContent = "";
      }

      try {
        await setDoc(
          doc(db, "users", uid),
          {
            profileOnboardingSeen: true,
            profileOnboardingSeenAt: serverTimestamp(),
            profileOnboardingVersion:
              PP_PROFILE_ONBOARDING_VERSION,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );

        try {
          sessionStorage.setItem(
            getProfileOnboardingSnoozeKey(uid),
            "1"
          );
        } catch {}

        closeProfileOnboarding();

        window.location.assign(
          PP_PROFILE_ONBOARDING_ROUTE
        );
      } catch (error) {
        console.error(
          "[AUTH Prophetia] No se pudo completar el onboarding",
          error
        );

        primaryButton.disabled = false;
        primaryButton.removeAttribute("aria-busy");

        if (status) {
          status.textContent =
            "No hemos podido guardar el progreso. Inténtalo de nuevo.";
          status.hidden = false;
        }
      }

      return;
    }

    const laterButton = event.target.closest(
      "[data-profile-onboarding-later]"
    );

    const closeButton = event.target.closest(
      "[data-profile-onboarding-close]"
    );

    if (laterButton || closeButton) {
      event.preventDefault();
      snoozeCurrentUser();
      return;
    }

    /*
      En un dialog nativo, el clic sobre el fondo puede
      tener como target el propio elemento dialog.
    */
    if (event.target === dialog) {
      snoozeCurrentUser();
    }
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    snoozeCurrentUser();
  });
}

async function maybeShowProfileOnboarding(user) {
  if (
    !user ||
    !user.uid ||
    user.emailVerified !== true
  ) {
    return;
  }

  const uid = user.uid;

  try {
    const snoozed = sessionStorage.getItem(
      getProfileOnboardingSnoozeKey(uid)
    );

    if (snoozed === "1") return;
  } catch {}

  const dialog = getProfileOnboardingDialog();

  /*
    popup.html todavía puede no haberse inyectado.
    partials:ready volverá a ejecutar esta comprobación.
  */
  if (!dialog || !dialog.isConnected) return;

  if (
    dialog.open ||
    ppProfileOnboardingChecks.has(uid)
  ) {
    return;
  }

  ppProfileOnboardingChecks.add(uid);

  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return;

    const profile = userSnap.data() || {};

    /*
      Solo nuevos registros que hayan sido marcados
      expresamente como elegibles.
    */
    if (
      profile.profileOnboardingEligible !== true ||
      profile.profileOnboardingSeen === true
    ) {
      return;
    }

    /*
      Sincroniza Firestore tras el primer login confirmado.
      El error de esta actualización no bloquea el onboarding.
    */
const verifiedPatch = {
  updatedAt: serverTimestamp()
};

    if (!profile.firstVerifiedLoginAt) {
      verifiedPatch.firstVerifiedLoginAt =
        serverTimestamp();
    }

    try {
      await setDoc(
        userRef,
        verifiedPatch,
        { merge: true }
      );
    } catch (error) {
      console.warn(
        "[AUTH Prophetia] No se sincronizó el login verificado",
        error
      );
    }

    bindProfileOnboardingDialog(dialog);
    dialog.dataset.uid = uid;

    /*
      No superponemos esta ventana sobre el panel Auth.
      Esperamos a que dicho panel termine de cerrarse.
    */
    const authDialog = document.querySelector(
      "#ppAuthModal"
    );

    if (authDialog?.open) {
      authDialog.addEventListener(
        "close",
        () => {
          window.setTimeout(
            () => maybeShowProfileOnboarding(user),
            260
          );
        },
        { once: true }
      );

      return;
    }

    if (
      typeof dialog.showModal === "function" &&
      !dialog.open
    ) {
      dialog.showModal();

      requestAnimationFrame(() => {
        dialog
          .querySelector(
            "[data-profile-onboarding-open]"
          )
          ?.focus({ preventScroll: true });
      });
    }
  } catch (error) {
    console.error(
      "[AUTH Prophetia] Error comprobando el onboarding",
      error
    );
  } finally {
    ppProfileOnboardingChecks.delete(uid);
  }
}

/*
  ppSignInWithEmailPass emite este evento después de
  recargar el usuario y confirmar emailVerified.
*/
window.addEventListener(
  "pp:auth-changed",
  (event) => {
    const user = event.detail?.user || null;

    if (user) {
      window.setTimeout(
        () => maybeShowProfileOnboarding(user),
        180
      );
    }
  }
);

/*
  Herramienta local de prueba.
  No existirá en producción.
*/

if (PP_DEV) {
  window.ppDebugProfileOnboarding = async () => {
    const user = auth.currentUser;

    if (!user) {
      throw new Error(
        "Inicia sesión antes de ejecutar la prueba."
      );
    }

    const dialog = getProfileOnboardingDialog();

    if (!dialog || !dialog.isConnected) {
      throw new Error(
        "El popup de onboarding todavía no está cargado."
      );
    }

    bindProfileOnboardingDialog(dialog);

    dialog.dataset.uid = user.uid;
    dialog.dataset.preview = "true";

    try {
      sessionStorage.removeItem(
        getProfileOnboardingSnoozeKey(user.uid)
      );
    } catch {}

    if (
      typeof dialog.showModal === "function" &&
      !dialog.open
    ) {
      dialog.showModal();

      requestAnimationFrame(() => {
        dialog
          .querySelector(
            "[data-profile-onboarding-open]"
          )
          ?.focus({ preventScroll: true });
      });
    }

    return true;
  };
}



// =============================================================
// Login manual email/password + bloqueo si email no está verificado
// =============================================================
window.ppSignInWithEmailPass = async (email, pass) => {
  if (!auth) throw new Error("Firebase auth no inicializado");

  const cleanEmail = String(email || "").trim().toLowerCase();

  if (!cleanEmail) {
    const e = new Error("Email vacío");
    e.code = "auth/invalid-email";
    throw e;
  }

  if (!pass) {
    const e = new Error("Contraseña vacía");
    e.code = "auth/missing-password";
    throw e;
  }

  const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);

  await cred.user.reload?.();

  /*
    Seguridad Prophetia:
    si el usuario se registró con email/password,
    no dejamos entrar hasta verificar correo.
  */
  if (!cred.user.emailVerified) {
    await sendEmailVerification(cred.user).catch(() => {});
    await signOut(auth);

    window.dispatchEvent(new CustomEvent("pp:auth-verify-required", {
      detail: { email: cleanEmail }
    }));

    const e = new Error("Email no verificado");
    e.code = "auth/email-not-verified";
    throw e;
  }

  window.__ppLastUser = cred.user;
  window.__ppAuthCurrentUser = cred.user;

  syncAuthUI(cred.user);

  window.dispatchEvent(
    new CustomEvent("pp:auth-changed", {
      detail: { user: cred.user }
    })
  );

  return cred;
};

// =============================================================
// Logout global para checkout / cuenta / header
// =============================================================
window.ppSignOut = async () => {
  if (!auth) throw new Error("Firebase auth no inicializado");

  await signOut(auth);

  window.__ppLastUser = null;
  window.__ppAuthCurrentUser = null;

  window.dispatchEvent(
    new CustomEvent("pp:auth-changed", {
      detail: { user: null }
    })
  );

  return true;
};

function logAuthEvent(label, data) {
  if (!PP_DEV) return;
  console.info(`[AUTH Prophetia] ${label}`, data || "");
}
function isLocalAuthHost() {
  return (
    location.hostname === "127.0.0.1" ||
    location.hostname === "localhost"
  );
}
let googleAuthInProgress = false;

async function handleGoogleAuth() {
  if (googleAuthInProgress) return;
  googleAuthInProgress = true;

  try {
    sessionStorage.removeItem("pp_google_redirect_pending");

    logAuthEvent("Google login attempt");

const result = await signInWithPopup(auth, googleProvider);

const userRef = doc(db, "users", result.user.uid);
const userSnap = await getDoc(userRef);

if (!userSnap.exists()) {
  await setDoc(userRef, {
    uid: result.user.uid,
    email: String(result.user.email || "").trim(),
    displayName: result.user.displayName || "",
    provider: "google",
    emailVerified: !!result.user.emailVerified,
    role: "customer",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
} else {
  await setDoc(userRef, {
    displayName: result.user.displayName || "",
    updatedAt: serverTimestamp()
  }, { merge: true });
}
    logAuthEvent("Google login OK", {
      uid: result.user.uid,
      email: result.user.email
    });

    __ppLastUser = result.user;
    window.__ppLastUser = result.user;
    window.__ppAuthCurrentUser = result.user;

    syncAuthUI(result.user);
    window.ppCloseAuthWhenLoggedIn?.();

    window.dispatchEvent(
      new CustomEvent("pp:auth-changed", {
        detail: { user: result.user }
      })
    );
  } catch (err) {
    if (PP_DEV) {
  console.error("[AUTH Prophetia] Google login error", err);
}
    alert(mapFirebaseError(err.code));
  } finally {
    googleAuthInProgress = false;
  }
}
// =============================================================
// BIND FORMULARIOS (LOGIN / REGISTRO / GOOGLE / RESET)
// =============================================================
function bindAuthForms() {
  const modal = $("#ppAuthModal");
  if (!modal) return;

  const loginForm = $("#ppLoginForm", modal);
  const regForm = $("#ppRegisterForm", modal);
  const forgotLink = modal.querySelector('a.sp-link[href="#forgot"]');
  const googleBtns = modal.querySelectorAll("[data-pp-google]");

  // ---------- RESET PASSWORD (compatible con tu login-step por chip) ----------
  if (forgotLink && !forgotLink.__ppBound) {
    forgotLink.__ppBound = true;
    forgotLink.addEventListener("click", async (e) => {
      e.preventDefault();

      // 1) intenta el hidden del modal
      const hidden = modal.querySelector("#ppLoginEmailHidden");

      // 2) fallback: el chip
      const chipVal = modal.querySelector('[data-step="login"] [data-email-value]');
      const currentEmail = (hidden?.value || chipVal?.textContent || "").trim();

      const email = window.prompt(
        "Introduce el correo con el que te registraste en PROPHETIA:",
        currentEmail
      );
      if (!email) return;

      try {
        await sendPasswordResetEmail(auth, email);
        alert(
          "Te hemos enviado un correo para restablecer la contraseña, si existe una cuenta asociada."
        );
      } catch (err) {
        console.error("[AUTH Prophetia] Reset password error", err);
        alert(mapFirebaseError(err.code));
      }
    });
  }

  // ---------- BOTONES GOOGLE ----------
  googleBtns.forEach((btn) => {
    if (btn.__ppBound) return;
    btn.__ppBound = true;

    btn.addEventListener("click", async (e) => {
      e.preventDefault();

      try {
        await handleGoogleAuth();
      } catch (err) {
        console.error("[AUTH Prophetia] Google login error", err);
        alert(mapFirebaseError(err.code));
      }
    });
  });
}
// =============================================================
// OBSERVER GLOBAL + SYNC UI (estable con parciales)
// =============================================================
let authObserverAttached = false;
let __ppLastUser = null;

/*
  Evita que Tribe Reopen aparezca durante unos milisegundos
  antes de que Firebase termine de restaurar la sesión.
*/
window.__ppAuthStateResolved = false;

function syncAuthUI(user) {
  const guestBtn = document.querySelector("#ppAuthLogoBtn");
  const profileChip = document.querySelector("#ppProfileChip, [data-pp-profile]");
  const profileNameEl = document.querySelector("#ppProfileName, [data-pp-profile-name]");
  const profileAvatar = document.querySelector(".pp-profile-avatar");
  const accountName = document.querySelector("[data-pp-account-name]");
  const accountEmail = document.querySelector("[data-pp-account-email]");

  if (user) {
    document.body.classList.add("pp-auth-logged");

    if (guestBtn) guestBtn.setAttribute("hidden", "true");

    if (profileChip) {
      profileChip.removeAttribute("hidden");
      profileChip.title = "Mi cuenta · PROPHETIA";
      profileChip.setAttribute("aria-label", "Abrir mi cuenta Prophetia");
    }

    const email = user.email || "";
    const short = email ? email.split("@")[0] : "Mi cuenta";
    const initial = email ? email.charAt(0).toUpperCase() : "P";

    if (profileAvatar) profileAvatar.textContent = initial;
    if (profileNameEl) profileNameEl.textContent = ""; // nada de email en header

    if (accountName) accountName.textContent = user.displayName || short;
    if (accountEmail) accountEmail.textContent = email;

    updateAccountGreeting(user);

    logAuthEvent("User logged IN", { uid: user.uid, email });
} else {
  sessionStorage.removeItem("pp_google_redirect_pending");

  document.body.classList.remove("pp-auth-logged");

  if (guestBtn) guestBtn.removeAttribute("hidden");
  if (profileChip) profileChip.setAttribute("hidden", "true");

  if (profileAvatar) profileAvatar.textContent = "P";
  if (profileNameEl) profileNameEl.textContent = "Mi cuenta";

  if (accountName) accountName.textContent = "";
  if (accountEmail) accountEmail.textContent = "";

  updateAccountGreeting(null);

  logAuthEvent("User logged OUT");
}
}

function attachAuthObserver() {
  if (authObserverAttached) return;
  authObserverAttached = true;

onAuthStateChanged(auth, (user) => {
  /*
    Desde este momento sabemos con seguridad si existe
    una sesión Firebase restaurada o si es un visitante.
  */
  window.__ppAuthStateResolved = true;

  if (user) {
    sessionStorage.removeItem(
      "pp_google_redirect_pending"
    );
  } else {
    ppTribeEnrollmentAttempted.clear();
  }
  __ppLastUser = user || null;

  window.__ppLastUser = __ppLastUser;
  window.__ppAuthCurrentUser = auth.currentUser || null;

  syncAuthUI(user);
  void syncFirstAccessExperience(user || null);

  window.dispatchEvent(
    new CustomEvent("pp:auth-changed", { detail: { user: user || null } })
  );
});
}






// =============================================================
// BOTÓN CABECERA: Login vs Mi Cuenta (modo Lacoste)
// =============================================================

// =============================================================
// ABRIR / CERRAR PANEL MI CUENTA
// =============================================================
window.ppOpenAccount = () => {
  const dlg = document.querySelector("#ppAccountPanel");
  if (dlg && typeof dlg.showModal === "function") {
    dlg.showModal();
  }
};

window.ppCloseAccount = () => {
  const dlg = document.querySelector("#ppAccountPanel");
  if (dlg && typeof dlg.close === "function") {
    dlg.close();
  }
};

document.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-pp-accountpanel-close]");
  if (!closeButton) return;

  event.preventDefault();
  window.ppCloseAccount?.();
});

function ppBindAccountPanelOutsideClose() {
  if (window.__ppAccountPanelOutsideCloseBound) return;
  window.__ppAccountPanelOutsideCloseBound = true;

  document.addEventListener("pointerdown", (event) => {
    const dlg = document.querySelector("#ppAccountPanel");
    if (!dlg || !dlg.open) return;

    const card = dlg.querySelector(".pp-accountpanel-card");
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const clickInsideCard = card && (card.contains(event.target) || path.includes(card));

    if (clickInsideCard) return;

    window.ppCloseAccount?.();
  }, true);
}

ppBindAccountPanelOutsideClose();

// Logout botón dentro de account panel
function isAccountPage() {
  return (
    document.body?.classList.contains("account-page") ||
    document.body?.dataset?.page === "my-content" ||
    location.pathname.includes("my-content.html") ||
    location.pathname.includes("account.html") ||
    location.pathname.includes("pedidos.html") ||
    location.pathname.includes("addresses.html") ||
    location.pathname.includes("wishlist.html") ||
    location.pathname.includes("reservas.html") ||
    location.pathname.includes("my-services.html")
  );
}

function clearProphetiaSessionStorage() {
  try {
    localStorage.removeItem("pp_checkout_email");
    localStorage.removeItem("pp_checkout_shipping");
    localStorage.removeItem("pp_checkout_shipping_details");
    localStorage.removeItem("pp_checkout_tribe_code");
    localStorage.removeItem("pp_checkout_step");
  } catch {}
}

function bindLogoutButton() {
  document.querySelectorAll("[data-pp-logout]").forEach((logoutBtn) => {
    if (!logoutBtn || logoutBtn.__ppBound) return;

    logoutBtn.__ppBound = true;

    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      try {
        await signOut(auth);

        window.__ppLastUser = null;
        window.__ppAuthCurrentUser = null;

        clearProphetiaSessionStorage();

        window.dispatchEvent(
          new CustomEvent("pp:auth-changed", {
            detail: { user: null }
          })
        );

        logAuthEvent("Logout OK");
        window.ppCloseAccount?.();

        if (isAccountPage()) {
          window.location.assign("/home");
        }
      } catch (err) {
        console.error("[AUTH Prophetia] Logout error", err);
      }
    });
  });
}

// =============================================================
// HOOKS DE INICIALIZACIÓN
// =============================================================
function initProphetiaAuth() {
  sessionStorage.removeItem("pp_google_redirect_pending");

  attachAuthObserver();
  bindAuthForms();
  bindLogoutButton();

  syncAuthUI(__ppLastUser || auth.currentUser || null);

  window.dispatchEvent(new CustomEvent("pp:auth-ready"));
}
// DOM listo
document.addEventListener("DOMContentLoaded", () => {
  initProphetiaAuth();
});

window.addEventListener("partials:ready", () => {
  initProphetiaAuth();

  const currentUser =
    __ppLastUser ||
    auth.currentUser ||
    null;

  if (currentUser) {
    void syncFirstAccessExperience(currentUser);

    window.setTimeout(
      () => maybeShowProfileOnboarding(currentUser),
      180
    );
  } else {
    renderAccountPanelFirstAccess(null, {});
  }
});

window.addEventListener("pp:account-profile-updated", (event) => {
  const user = event.detail?.user || auth.currentUser || null;
  const profile = event.detail?.profile || {};

  if (!user) return;

  cacheAccountProfile(user.uid, profile);
  ppTribeEnrollmentAttempted.delete(user.uid);
  void syncFirstAccessExperience(user, { forceEnrollment: true });
});

function updateAccountGreeting(user) {
  const span = document.querySelector("#ppAccountName"); // saludo antiguo (si existe)
  const hello = document.querySelector("#ppAccountHelloName"); // nuevo Prophetia-like

  const setName = (value) => {
    if (span) span.textContent = value || "usuario";
    if (hello) hello.textContent = value || "";
  };

  if (!user) {
    setName("usuario");
    return;
  }

  const email = user.email || "";
  const nameFromEmail = email ? email.split("@")[0] : "usuario";

  setName(user.displayName || nameFromEmail);
}

if (PP_DEV) {
  window.__ppAuthAppInfo = () => ({
    projectId: auth?.app?.options?.projectId,
    authDomain: auth?.app?.options?.authDomain
  });
}

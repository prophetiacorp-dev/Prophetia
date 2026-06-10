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

  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    email: cleanEmail,
    displayName: displayName || "",
    firstName: profileData.firstName || "",
    lastName: profileData.lastName || "",
    gender: profileData.gender || "",
    birth: profileData.birth || "",
    country: profileData.country || "",
    phoneCode: profileData.phoneCode || "",
    phone: profileData.phone || "",
    newsletter: !!profileData.newsletter,
    termsAccepted: !!profileData.termsAccepted,
    provider: "password",
    emailVerified: false,
    role: "customer",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

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
  if (user) {
    sessionStorage.removeItem("pp_google_redirect_pending");
  }

  __ppLastUser = user || null;

  window.__ppLastUser = __ppLastUser;
  window.__ppAuthCurrentUser = auth.currentUser || null;

  syncAuthUI(user);

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
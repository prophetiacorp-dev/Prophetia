// assets/js/admin-firebase.js
import { auth, db } from "./firebase-init.js";

import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";


import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ALLOWED_UIDS = new Set([
  "Z9HEs3YmEgePYdmsD6UaY9idv0A2"
]);

const els = {
  
  gate: document.getElementById("adminGate"),
  app: document.getElementById("adminApp"),
  who: document.getElementById("adminWho"),
  btnLogin: document.getElementById("btnLogin"),
  btnLogout: document.getElementById("btnLogout"),

  homeTitle: document.getElementById("homeTitle"),
  homeSubtitle: document.getElementById("homeSubtitle"),
  homeCta: document.getElementById("homeCta"),
  btnHomeLoad: document.getElementById("btnHomeLoad"),
  btnHomeSave: document.getElementById("btnHomeSave"),
  homeStatus: document.getElementById("homeStatus")
};

function setHomeStatus(ok, msg){
  els.homeStatus.textContent = msg;
  els.homeStatus.classList.toggle("good", !!ok);
  els.homeStatus.classList.toggle("bad", !ok);
}


function isAllowed(user){
  return !!user && ALLOWED_UIDS.has(user.uid);
}

async function loadHome(){
  try{
    const ref = doc(db, "site", "home");
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};

    els.homeTitle.value = data.herotitle ?? "";
    els.homeSubtitle.value = data.herosubtitle ?? "";
    els.homeCta.value = data.heroCTA ?? "";

    setHomeStatus(true, "Cargado desde Firestore");
  } catch (err){
    console.error("[ADMIN] loadHome error:", err);
    setHomeStatus(false, "Error cargando site/home");
  }
}

async function saveHome(){
  try{
    const ref = doc(db, "site", "home");
    await setDoc(ref, {
      herotitle: (els.homeTitle.value || "").trim(),
      herosubtitle: (els.homeSubtitle.value || "").trim(),
      heroCTA: (els.homeCta.value || "").trim(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    setHomeStatus(true, "Guardado en Firestore");
  } catch (err){
    console.error("[ADMIN] saveHome error:", err);
    setHomeStatus(false, "Error guardando site/home");
  }
}

els.btnLogin?.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error("[ADMIN] signIn popup error:", e);

    const code = e?.code || "auth/error";

    if (els.who) {
      els.who.textContent =
        code === "auth/popup-blocked"
          ? "El navegador ha bloqueado la ventana emergente de Google."
          : code === "auth/popup-closed-by-user"
            ? "Has cerrado la ventana de Google antes de completar el acceso."
            : `Error login: ${code}`;
    }
  }
});



els.btnLogout?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("[ADMIN] signOut error:", e);
  }
});

els.btnHomeLoad?.addEventListener("click", loadHome);
els.btnHomeSave?.addEventListener("click", saveHome);

onAuthStateChanged(auth, async (user) => {
  console.info("[ADMIN] auth state:", user?.uid, user?.email);

  if (!user){
    els.gate.classList.remove("hide");
    els.app.classList.add("hide");
    els.who.textContent = "No autenticado";
    return;
  }

  els.who.textContent = `${user.email || "sin email"} · ${user.uid}`;

  if (!isAllowed(user)){
    els.gate.classList.remove("hide");
    els.app.classList.add("hide");
    setHomeStatus(false, "Usuario no autorizado");
    return;
  }

  els.gate.classList.add("hide");
  els.app.classList.remove("hide");
  await loadHome();
});

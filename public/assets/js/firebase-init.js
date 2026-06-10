// assets/js/firebase-init.js
import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const PP_DEV =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1";

const firebaseConfig = {
  apiKey: "AIzaSyBKDHecLX6khGF3-R7OHd3SJM64DBlAgzk",
authDomain: PP_DEV
  ? "prophetia-8a714.firebaseapp.com"
  : "auth.prophetia.es",
  projectId: "prophetia-8a714",
  storageBucket: "prophetia-8a714.firebasestorage.app",
  messagingSenderId: "62402082012",
  appId: "1:62402082012:web:942da96357f059c4707019"
};

export const app = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const authReady = setPersistence(auth, browserLocalPersistence)
  .then(() => {
    if (PP_DEV) {
      console.info("[AUTH Prophetia] Persistencia local activada");
    }

    return auth;
  })
  .catch((err) => {
    if (PP_DEV) {
      console.error("[AUTH Prophetia] Error activando persistencia local", err);
    }

    return auth;
  });

window.__ppFirebaseApp = app;
window.__ppFirebaseAuth = auth;
window.__ppFirestore = db;
window.__ppFirebaseAuthReady = authReady;
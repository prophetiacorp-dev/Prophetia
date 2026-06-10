// assets/js/home-cms.js
import { db } from "./firebase-init.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const elTitle = document.getElementById("homeHeroTitle");
const elSub   = document.getElementById("homeHeroSubtitle");
const elCta   = document.getElementById("homeHeroCta");

const ref = doc(db, "site", "home");

onSnapshot(ref, (snap) => {
  if (!snap.exists()) return;
  const d = snap.data() || {};

  if (elTitle && typeof d.herotitle === "string" && d.herotitle.trim()) {
    elTitle.innerHTML = escapeHtml(d.herotitle).replace(/\n/g, "<br>");
  }
  if (elSub && typeof d.herosubtitle === "string" && d.herosubtitle.trim()) {
    elSub.textContent = d.herosubtitle.trim();
  }
  if (elCta && typeof d.heroCTA === "string" && d.heroCTA.trim()) {
    elCta.textContent = d.heroCTA.trim();
  }
}, (err) => console.error("[HOME CMS] onSnapshot error:", err));

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

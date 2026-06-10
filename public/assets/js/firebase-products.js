// assets/js/firebase-products.js
import { db } from "./firebase-init.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export async function ppGetProductById(id) {
  const cleanId = String(id || "").trim();
  if (!cleanId) return null;

  const ref = doc(db, "products", cleanId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data()
  };
}

export async function ppGetProductBySlug(slug) {
  const cleanSlug = String(slug || "").trim();
  if (!cleanSlug) return null;

  const q = query(
    collection(db, "products"),
    where("slug", "==", cleanSlug)
  );

  const snap = await getDocs(q);

  if (snap.empty) return null;

  const first = snap.docs[0];

  return {
    id: first.id,
    ...first.data()
  };
}

export async function ppGetProductsBySection({ section = "", gender = "" } = {}) {
  const cleanSection = String(section || "").trim();

  let q;

  if (cleanSection) {
    q = query(
      collection(db, "products"),
      where("section", "==", cleanSection),
      where("active", "==", true),
      orderBy("sortOrder", "asc")
    );
  } else {
    q = query(
      collection(db, "products"),
      where("active", "==", true),
      orderBy("sortOrder", "asc")
    );
  }

  const snap = await getDocs(q);

  const products = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  const cleanGender = String(gender || "").trim().toLowerCase();

  if (!cleanGender) return products;

  return products.filter((product) => {
    if (!product.media || typeof product.media !== "object") return true;

    if (cleanGender === "hombre" || cleanGender === "men") {
      return !!product.media.hombre || product.gender === "unisex";
    }

    if (cleanGender === "mujer" || cleanGender === "women") {
      return !!product.media.mujer || product.gender === "unisex";
    }

    return true;
  });
}
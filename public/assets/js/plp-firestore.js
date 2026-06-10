// assets/js/plp-firestore.js
import { db } from "./firebase-init.js";

import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/**
 * Normaliza textos para comparar sin dramas.
 */
function norm(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Convierte rutas relativas a rutas absolutas desde raíz.
 * Útil para imágenes guardadas en Firestore como assets/img/...
 */
function toAbsPath(path) {
  const value = String(path || "").trim();
  if (!value) return "";
  if (/^(https?:)?\/\//i.test(value)) return value;
  return value.startsWith("/") ? value : "/" + value;
}

/**
 * Normaliza media para que script.js pueda leer bien cover/images.
 */
function normalizeMedia(product) {
  const media = product.media && typeof product.media === "object"
    ? product.media
    : {};

  const normalizeBucket = (bucket) => {
    if (!bucket || typeof bucket !== "object") return null;

    const images = Array.isArray(bucket.images)
      ? bucket.images.map(toAbsPath).filter(Boolean)
      : [];

    const cover = toAbsPath(bucket.cover || images[0] || "");

    return {
      ...bucket,
      cover,
      images: images.length ? images : (cover ? [cover] : [])
    };
  };

  const normalized = {};

  // Estructura profesional recomendada: media.hombre / media.mujer
  const hombre = media.hombre || media.men || product.hombre || product.men || null;
  const mujer = media.mujer || media.women || product.mujer || product.women || null;
  const unisex = media.unisex || product.unisex || null;
  const def = media.default || product.default || null;

  const hombreBucket = normalizeBucket(hombre);
  const mujerBucket = normalizeBucket(mujer);
  const unisexBucket = normalizeBucket(unisex);
  const defaultBucket = normalizeBucket(def);

  if (hombreBucket) normalized.hombre = hombreBucket;
  if (mujerBucket) normalized.mujer = mujerBucket;
  if (unisexBucket) normalized.unisex = unisexBucket;
  if (defaultBucket) normalized.default = defaultBucket;

  return normalized;
}

/**
 * Comprueba si un producto encaja con el género solicitado.
 *
 * Soporta:
 * - gender: "unisex"
 * - gender: "hombre"
 * - gender: "mujer"
 * - gender: ["hombre", "mujer"]
 * - media.hombre / media.mujer
 */
function matchesGender(product, gender) {
  const wanted = norm(gender);
  if (!wanted) return true;

  const aliases = {
    hombre: ["hombre", "men", "man", "male", "unisex"],
    men: ["hombre", "men", "man", "male", "unisex"],
    mujer: ["mujer", "women", "woman", "female", "unisex"],
    women: ["mujer", "women", "woman", "female", "unisex"],
    unisex: ["unisex"]
  };

  const allowed = aliases[wanted] || [wanted, "unisex"];

  if (Array.isArray(product.gender)) {
    const values = product.gender.map(norm);
    if (values.some(value => allowed.includes(value))) return true;
  }

  if (typeof product.gender === "string") {
    if (allowed.includes(norm(product.gender))) return true;
  }

  const media = product.media || {};

  if ((wanted === "hombre" || wanted === "men") && media.hombre) return true;
  if ((wanted === "mujer" || wanted === "women") && media.mujer) return true;

  return false;
}

/**
 * Trae productos desde Firestore para PLP.
 *
 * Firestore esperado:
 * collection: products
 *
 * Campos recomendados:
 * active: true
 * section: "camisetas-punto"
 * collection: "myth-series"
 * gender: "unisex" o ["hombre", "mujer"]
 * title, price, media, variants, badges, labels...
 */
export async function fetchProductsForPLP({
  section = "",
  collection: coll = "",
  gender = ""
} = {}) {
  const ref = collection(db, "products");

  const constraints = [
    where("active", "==", true)
  ];

  if (coll) {
    constraints.push(where("collection", "==", coll));
  } else if (section) {
    constraints.push(where("section", "==", section));
  }

  const q = query(ref, ...constraints);
  const snap = await getDocs(q);

  const products = snap.docs.map((docSnap) => {
    const data = docSnap.data() || {};

    return {
      id: docSnap.id,
      ...data,
      media: normalizeMedia(data)
    };
  });

  return products.filter(product => matchesGender(product, gender));
}

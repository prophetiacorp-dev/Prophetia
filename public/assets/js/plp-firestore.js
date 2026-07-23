
// assets/js/plp-firestore.js
import { db } from "./firebase-init.js";

import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/*
 * Registro compartido de productos cargados desde Firestore.
 * Quick Add consultará directamente este mapa.
 */
const firestoreProductsById = new Map();

let fallbackGetProduct = null;

/**
 * Normaliza textos para realizar comparaciones seguras.
 */
function norm(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/**
 * Convierte rutas relativas en rutas absolutas desde la raíz.
 */
function toAbsPath(path) {
  const value = String(path || "").trim();

  if (!value) {
    return "";
  }

  if (/^(https?:)?\/\//i.test(value)) {
    return value;
  }

  return value.startsWith("/")
    ? value
    : `/${value}`;
}

/**
 * Normaliza media para que script.js y Quick Add
 * puedan leer correctamente cover e images.
 */
function normalizeMedia(product) {
  const media =
    product.media &&
    typeof product.media === "object"
      ? product.media
      : {};

  const normalizeBucket = (bucket) => {
    if (
      !bucket ||
      typeof bucket !== "object"
    ) {
      return null;
    }

    const images = Array.isArray(
      bucket.images
    )
      ? bucket.images
          .map(toAbsPath)
          .filter(Boolean)
      : [];

    const cover = toAbsPath(
      bucket.cover ||
      images[0] ||
      ""
    );

    return {
      ...bucket,
      cover,
      images:
        images.length > 0
          ? images
          : cover
            ? [cover]
            : []
    };
  };

  const normalized = {};

  const hombre =
    media.hombre ||
    media.men ||
    product.hombre ||
    product.men ||
    null;

  const mujer =
    media.mujer ||
    media.women ||
    product.mujer ||
    product.women ||
    null;

  const unisex =
    media.unisex ||
    product.unisex ||
    null;

  const defaultMedia =
    media.default ||
    product.default ||
    null;

  const hombreBucket =
    normalizeBucket(hombre);

  const mujerBucket =
    normalizeBucket(mujer);

  const unisexBucket =
    normalizeBucket(unisex);

  const defaultBucket =
    normalizeBucket(defaultMedia);

  if (hombreBucket) {
    normalized.hombre =
      hombreBucket;
  }

  if (mujerBucket) {
    normalized.mujer =
      mujerBucket;
  }

  if (unisexBucket) {
    normalized.unisex =
      unisexBucket;
  }

  if (defaultBucket) {
    normalized.default =
      defaultBucket;
  }

  return normalized;
}

/**
 * Normaliza las variantes procedentes de Firestore.
 *
 * Cada variante válida necesita:
 * - sku
 * - color
 * - size
 * - stock
 */
function normalizeVariants(
  product,
  productId
) {
  if (
    !Array.isArray(product.variants)
  ) {
    return [];
  }

  return product.variants
    .map((variant, index) => {
      if (
        !variant ||
        typeof variant !== "object"
      ) {
        console.warn(
          `[PLP Firestore] Variante ${index} inválida en ${productId}.`
        );

        return null;
      }

      const sku = String(
        variant.sku || ""
      ).trim();

      const color = norm(
        variant.color || ""
      );

      const size = String(
        variant.size || ""
      )
        .trim()
        .toUpperCase();

      const stock = Math.max(
        0,
        Number(variant.stock) || 0
      );

      const img = toAbsPath(
        variant.img ||
        variant.image ||
        ""
      );

      if (
        !sku ||
        !color ||
        !size
      ) {
        console.warn(
          `[PLP Firestore] Variante incompleta en ${productId}:`,
          variant
        );

        return null;
      }

      return {
        ...variant,
        sku,
        color,
        size,
        stock,
        img
      };
    })
    .filter(Boolean);
}

/**
 * Comprueba si un producto corresponde al género solicitado.
 */
function matchesGender(
  product,
  gender
) {
  const wanted = norm(gender);

  if (!wanted) {
    return true;
  }

  const aliases = {
    hombre: [
      "hombre",
      "men",
      "man",
      "male",
      "unisex"
    ],

    men: [
      "hombre",
      "men",
      "man",
      "male",
      "unisex"
    ],

    mujer: [
      "mujer",
      "women",
      "woman",
      "female",
      "unisex"
    ],

    women: [
      "mujer",
      "women",
      "woman",
      "female",
      "unisex"
    ],

    unisex: [
      "unisex"
    ]
  };

  const allowed =
    aliases[wanted] ||
    [wanted, "unisex"];

  if (
    Array.isArray(product.gender)
  ) {
    const values =
      product.gender.map(norm);

    if (
      values.some((value) =>
        allowed.includes(value)
      )
    ) {
      return true;
    }
  }

  if (
    typeof product.gender ===
    "string"
  ) {
    if (
      allowed.includes(
        norm(product.gender)
      )
    ) {
      return true;
    }
  }

  const media =
    product.media || {};

  if (
    (
      wanted === "hombre" ||
      wanted === "men"
    ) &&
    media.hombre
  ) {
    return true;
  }

  if (
    (
      wanted === "mujer" ||
      wanted === "women"
    ) &&
    media.mujer
  ) {
    return true;
  }

  return false;
}

/**
 * Expone los productos Firestore mediante la API pública ppPLP.
 *
 * Mantiene como fallback el getProduct anterior,
 * por ejemplo el correspondiente a catalog.json.
 */
function exposeFirestoreRegistry() {
  window.ppPLP =
    window.ppPLP || {};

  const currentGetter =
    window.ppPLP.getProduct;

  if (
    typeof currentGetter ===
      "function" &&
    currentGetter
      .__ppFirestoreResolver !== true
  ) {
    fallbackGetProduct =
      currentGetter;
  }

  const firestoreResolver = (
    productId
  ) => {
    const id = String(
      productId || ""
    ).trim();

    if (!id) {
      return null;
    }

    const firestoreProduct =
      firestoreProductsById.get(id);

    if (firestoreProduct) {
      return firestoreProduct;
    }

    if (
      typeof fallbackGetProduct ===
      "function"
    ) {
      return (
        fallbackGetProduct(id) ||
        null
      );
    }

    return null;
  };

  Object.defineProperty(
    firestoreResolver,
    "__ppFirestoreResolver",
    {
      value: true
    }
  );

  window.ppPLP.getProduct =
    firestoreResolver;

  window.ppPLP.getFirestoreProducts =
    () => {
      return Array.from(
        firestoreProductsById.values()
      );
    };
}

/**
 * Registra los productos completos cargados desde Firestore.
 */
function registerFirestoreProducts(
  products
) {
  firestoreProductsById.clear();

  products.forEach((product) => {
    const id = String(
      product?.id || ""
    ).trim();

    if (!id) {
      return;
    }

    firestoreProductsById.set(
      id,
      product
    );
  });

  exposeFirestoreRegistry();
}

/**
 * Notifica a Quick Add después de que el catálogo
 * haya podido renderizar las tarjetas.
 */
function notifyPLPRendered(
  products
) {
  window.requestAnimationFrame(() => {
    /*
     * Permite reintentar tarjetas que Quick Add
     * había marcado antes como unsupported.
     */
    document
      .querySelectorAll(
        '#plp-grid [data-quick-add-ready="unsupported"]'
      )
      .forEach((card) => {
        card.removeAttribute(
          "data-quick-add-ready"
        );
      });

    document.dispatchEvent(
      new CustomEvent(
        "pp:plp:rendered",
        {
          detail: {
            source: "firestore",
            count: products.length
          }
        }
      )
    );
  });
}

/**
 * Trae productos desde Firestore para el PLP.
 *
 * Firestore:
 * collection: products
 */
export async function fetchProductsForPLP({
  section = "",
  collection: coll = "",
  gender = ""
} = {}) {
  const ref = collection(
    db,
    "products"
  );

  const constraints = [
    where("active", "==", true)
  ];

  if (coll) {
    constraints.push(
      where(
        "collection",
        "==",
        coll
      )
    );
  } else if (section) {
    constraints.push(
      where(
        "section",
        "==",
        section
      )
    );
  }

  const firestoreQuery = query(
    ref,
    ...constraints
  );

  const snapshot = await getDocs(
    firestoreQuery
  );

  const products =
    snapshot.docs.map((docSnap) => {
      const data =
        docSnap.data() || {};

      const id = String(
        data.id ||
        docSnap.id
      ).trim();

      const normalizedProduct = {
        ...data,
        id,
        media:
          normalizeMedia(data)
      };

      normalizedProduct.variants =
        normalizeVariants(
          normalizedProduct,
          id
        );

      return normalizedProduct;
    });

  const filteredProducts =
    products.filter((product) => {
      return matchesGender(
        product,
        gender
      );
    });

  /*
   * Firestore pasa a ser la fuente prioritaria
   * para Quick Add en esta página.
   */
  registerFirestoreProducts(
    filteredProducts
  );

  notifyPLPRendered(
    filteredProducts
  );

  return filteredProducts;
}

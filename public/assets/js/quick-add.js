
// assets/js/quick-add.js
(() => {
  if (window.__PP_QUICK_ADD__) return;

  /*
   * El componente solo se activa en páginas
   * que lo declaren expresamente en el body.
   */
  if (
    !document.body?.hasAttribute(
      "data-quick-add-enabled"
    )
  ) {
    return;
  }

  window.__PP_QUICK_ADD__ = true;



const selectedColors = new Map();
const selectedCuts = new Map();
const closeTimers = new WeakMap();
const portalRestoreTimers = new WeakMap();
const skipFocusOpen = new WeakSet();

let activeCard = null;
let observedGrid = null;

function resolveOwnerCard(target) {
  const directCard = target?.closest?.(".card.has-quick-add");
  if (directCard) {
    return directCard;
  }

  const panel = target?.closest?.("[data-quick-add-panel]");
  return panel?.__ppQuickAddOwnerCard || null;
}

function canSellVariant() {
  return window.ppStorefront?.salesEnabled !== false;
}
let gridObserver = null;

const MOBILE_QUICK_ADD_QUERY =
  "(hover: none), (pointer: coarse), (max-width: 760px)";

function isMobileQuickAdd() {
  return window.matchMedia(
    MOBILE_QUICK_ADD_QUERY
  ).matches;
}

function ensureQuickAddBackdrop() {
  let backdrop = document.querySelector(
    "[data-quick-add-backdrop]"
  );

  if (backdrop) {
    return backdrop;
  }

  backdrop = document.createElement("div");

  backdrop.className =
    "pp-quick-add-backdrop";

  backdrop.dataset.quickAddBackdrop = "";

  backdrop.setAttribute(
    "aria-hidden",
    "true"
  );

  backdrop.hidden = true;

  document.body.appendChild(backdrop);

  return backdrop;
}

function openMobileBackdrop() {
  if (!isMobileQuickAdd()) return;

  const backdrop =
    ensureQuickAddBackdrop();

  backdrop.hidden = false;

  backdrop.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add(
    "pp-quick-add-mobile-open"
  );

  window.requestAnimationFrame(() => {
    backdrop.classList.add("is-open");
  });
}

function closeMobileBackdrop() {
  const backdrop = document.querySelector(
    "[data-quick-add-backdrop]"
  );

  document.body.classList.remove(
    "pp-quick-add-mobile-open"
  );

  if (!backdrop) return;

  backdrop.classList.remove("is-open");

  backdrop.setAttribute(
    "aria-hidden",
    "true"
  );

  window.setTimeout(() => {
    if (
      !backdrop.classList.contains(
        "is-open"
      )
    ) {
      backdrop.hidden = true;
    }
  }, 220);
}

const COLOR_META = {
    black: {
      label: "Negro",
      value: "#151515"
    },
    white: {
      label: "Blanco",
      value: "#f4f2ed"
    },
    navy: {
      label: "Azul marino",
      value: "#1d2940"
    },
    blue: {
      label: "Azul",
      value: "#315f93"
    },
    yellow: {
      label: "Amarillo",
      value: "#d5b73f"
    },
    orange: {
      label: "Naranja",
      value: "#c96f35"
    },
    red: {
      label: "Rojo",
      value: "#9d3939"
    },
    beige: {
      label: "Beige",
      value: "#c9bba4"
    },
    latte: {
      label: "Latte",
      value: "#d1a06f"
    },
    rosa: {
      label: "Rosa",
      value: "#d979a7"
    },
    "blue-ice": {
      label: "Blue Ice",
      value: "#dceef3"
    },
    "off-white": {
      label: "Off White",
      value: "#f4f1e9"
    },
    brown: {
      label: "Marrón",
      value: "#665143"
    },
    green: {
      label: "Verde",
      value: "#536853"
    },
    grey: {
      label: "Gris",
      value: "#8a8a86"
    },
    gray: {
      label: "Gris",
      value: "#8a8a86"
    },
    multicolor: {
      label: "Multicolor",
      value:
        "linear-gradient(135deg, #ad6d79 0 25%, #b99a63 25% 50%, #577d87 50% 75%, #615c7d 75% 100%)"
    }
  };

  const normalize = (value = "") => {
    return String(value ?? "")
      .trim()
      .toLowerCase();
  };

  const upper = (value = "") => {
    return String(value ?? "")
      .trim()
      .toUpperCase();
  };

  function safeId(value = "") {
    return String(value)
      .replace(/[^a-zA-Z0-9_-]/g, "-");
  }

  function getProductId(card) {
    return String(card?.dataset?.id || "").trim();
  }

  function getProduct(card) {
    const productId = getProductId(card);

    if (!productId) return null;

    if (
      typeof window.ppPLP?.getProduct !==
      "function"
    ) {
      return null;
    }

    return window.ppPLP.getProduct(productId);
  }

  function getProductKey(product) {
    return String(
      product?._id ||
        product?.id ||
        ""
    ).trim();
  }

  function getCuts(product) {
    if (!Array.isArray(product?.cuts)) {
      return [];
    }

    return product.cuts.filter((cut) => {
      return normalize(cut?.id);
    });
  }

  function getSelectedCut(product) {
    const cuts = getCuts(product);

    if (!cuts.length) return "";

    const productKey = getProductKey(product);
    const remembered = normalize(
      selectedCuts.get(productKey)
    );

    if (
      remembered &&
      cuts.some((cut) => {
        return normalize(cut?.id) === remembered;
      })
    ) {
      return remembered;
    }

    const configured = normalize(
      product?.defaultCut
    );

    if (
      configured &&
      cuts.some((cut) => {
        return normalize(cut?.id) === configured;
      })
    ) {
      return configured;
    }

    return normalize(cuts[0]?.id);
  }

  function getVariants(product) {
    if (!Array.isArray(product?.variants)) {
      return [];
    }

    const selectedCut = getSelectedCut(product);

    return product.variants
      .filter((variant) => {
        const variantCut = normalize(variant?.cut);
        return (
          variant &&
          variant.sku &&
          variant.color &&
          variant.size &&
          (!selectedCut || !variantCut || variantCut === selectedCut)
        );
      })
      .map((variant) => {
        return {
          ...variant,
          color: normalize(variant.color),
          size: upper(variant.size),
          stock: Math.max(
            0,
            Number(variant.stock) || 0
          )
        };
      });
  }

  function getSelectedCutLabel(product) {
    const cutId = getSelectedCut(product);
    const cut = getCuts(product).find(
      (item) => normalize(item?.id) === cutId
    );

    return String(cut?.label || cutId || '').trim();
  }

  function getSelectedVersion(product) {
    const cutId = getSelectedCut(product);
    const cut = getCuts(product).find(
      (item) => normalize(item?.id) === cutId
    );
    const versionId = String(cut?.defaultVersion || '').trim();
    const version = Array.isArray(product?.versions)
      ? product.versions.find((item) => String(item?.id || '').trim() === versionId)
      : null;

    return version || null;
  }

  function getColorMeta(color) {
    const normalizedColor = normalize(color);

    if (COLOR_META[normalizedColor]) {
      return COLOR_META[normalizedColor];
    }

    return {
      label: normalizedColor
        ? normalizedColor
            .charAt(0)
            .toUpperCase() +
          normalizedColor.slice(1)
        : "Color",
      value: "#77746f"
    };
  }

  function getColors(product) {
    const colors = getVariants(product).map(
      (variant) => variant.color
    );

    return [...new Set(colors)];
  }

  function getColorStock(product, color) {
    const normalizedColor = normalize(color);

    return getVariants(product)
      .filter((variant) => {
        return (
          variant.color === normalizedColor
        );
      })
      .reduce((total, variant) => {
        return total + variant.stock;
      }, 0);
  }

  function getPageGender() {
    const raw =
      document.getElementById("plp-grid")
        ?.dataset?.gender ||
      document.body?.dataset?.gender ||
      localStorage.getItem("pp_gender") ||
      "hombre";

    const clean = normalize(raw);

    if (
      clean === "mujer" ||
      clean === "women" ||
      clean === "woman"
    ) {
      return "mujer";
    }

    if (
      clean === "hombre" ||
      clean === "men" ||
      clean === "man"
    ) {
      return "hombre";
    }

    return clean || "hombre";
  }

  function getColorMediaImage(
    product,
    color
  ) {
    const key = normalize(color);
    const selectedVersion =
      getSelectedVersion(product);
    const mediaByColor =
      selectedVersion?.mediaByColor ||
      product?.mediaByColor;

    if (
      !key ||
      !mediaByColor ||
      typeof mediaByColor !== "object"
    ) {
      return "";
    }

    const gender = getPageGender();
    const genderMap =
      mediaByColor[gender] ||
      mediaByColor.hombre ||
      mediaByColor.mujer ||
      null;

    const bucket =
      (genderMap && genderMap[key]) ||
      mediaByColor[key] ||
      null;

    if (!bucket) return "";

    return (
      bucket.cover ||
      (Array.isArray(bucket.images)
        ? bucket.images[0]
        : "") ||
      ""
    );
  }

  function getSelectedColor(product) {
    const productId = getProductKey(product);

    const colors = getColors(product);

    const rememberedColor = normalize(
      selectedColors.get(productId)
    );

    if (
      rememberedColor &&
      colors.includes(rememberedColor)
    ) {
      return rememberedColor;
    }

    const firstAvailableColor =
      colors.find((color) => {
        return (
          getColorStock(product, color) > 0
        );
      });

    return (
      firstAvailableColor ||
      colors[0] ||
      ""
    );
  }

  function getPanel(card) {
    if (!card) return null;

    return (
      card.__ppQuickAddPanel ||
      card.querySelector(
        "[data-quick-add-panel]"
      ) ||
      null
    );
  }

  function clearPortalRestoreTimer(panel) {
    const timer = portalRestoreTimers.get(panel);

    if (!timer) return;

    window.clearTimeout(timer);
    portalRestoreTimers.delete(panel);
  }

  function restoreMobilePanel(panel) {
    if (!panel?.__ppQuickAddPortalParent) return;

    clearPortalRestoreTimer(panel);

    const parent = panel.__ppQuickAddPortalParent;
    const nextSibling = panel.__ppQuickAddPortalNextSibling;

    panel.classList.remove(
      "is-mobile-portal",
      "is-mobile-portal-open"
    );

    if (
      nextSibling &&
      nextSibling.parentNode === parent
    ) {
      parent.insertBefore(panel, nextSibling);
    } else {
      parent.appendChild(panel);
    }

    delete panel.__ppQuickAddPortalParent;
    delete panel.__ppQuickAddPortalNextSibling;
    delete panel.__ppQuickAddOwnerCard;
    delete panel.__ppQuickAddOwnerProduct;
    delete panel.__ppQuickAddOriginToggle;
  }

  function portalPanelToBody(card, panel) {
    if (
      !isMobileQuickAdd() ||
      !card ||
      !panel ||
      panel.__ppQuickAddPortalParent
    ) {
      return;
    }

    panel.__ppQuickAddPortalParent = panel.parentNode;
    panel.__ppQuickAddPortalNextSibling = panel.nextSibling;

    document.body.appendChild(panel);
    panel.classList.add("is-mobile-portal");
  }

  function schedulePanelRestore(panel) {
    if (!panel?.__ppQuickAddPortalParent) return;

    clearPortalRestoreTimer(panel);

    const timer = window.setTimeout(() => {
      if (
        !panel.classList.contains(
          "is-mobile-portal-open"
        )
      ) {
        restoreMobilePanel(panel);
      }
    }, 300);

    portalRestoreTimers.set(panel, timer);
  }

  function getToggle(card) {
    return (
      card?.querySelector(
        "[data-quick-add-toggle]"
      ) || null
    );
  }

  function setStatus(
    card,
    message = "",
    state = ""
  ) {
    const status = card?.querySelector(
      "[data-quick-add-status]"
    );

    if (!status) return;

    status.textContent = message;
    status.dataset.state = state;
    status.hidden = !message;
  }

  function clearCloseTimer(card) {
    const timer = closeTimers.get(card);

    if (!timer) return;

    window.clearTimeout(timer);
    closeTimers.delete(card);
  }

  function closeQuickAdd(
    card,
    {
      restoreFocus = false
    } = {}
  ) {
    if (!card) return;

    clearCloseTimer(card);

    const panel = getPanel(card);
    const toggle = getToggle(card);

    if (panel) {
      panel.classList.remove(
        "is-mobile-portal-open"
      );
      panel.setAttribute(
        "aria-hidden",
        "true"
      );
      panel.inert = true;
    }

    card.classList.remove(
      "is-quick-add-open"
    );

    card.dataset.quickAddPinned =
      "false";

    if (toggle) {
      toggle.setAttribute(
        "aria-expanded",
        "false"
      );
    }

    if (panel) {
      window.setTimeout(() => {
        const stillClosed =
          !card.classList.contains(
            "is-quick-add-open"
          );

        if (stillClosed) {
          panel.hidden = true;
          schedulePanelRestore(panel);
        }
      }, 180);
    }

    const originToggle =
      panel?.__ppQuickAddOriginToggle || toggle;

    if (activeCard === card) {
  activeCard = null;
}

closeMobileBackdrop();

if (restoreFocus && originToggle) {
  skipFocusOpen.add(originToggle);

  originToggle.focus({
    preventScroll: true
  });

  window.requestAnimationFrame(() => {
    skipFocusOpen.delete(originToggle);
  });
}
  }

  function closeOtherCards(exceptCard) {
    document
      .querySelectorAll(
        "#plp-grid .card.is-quick-add-open"
      )
      .forEach((card) => {
        if (card !== exceptCard) {
          closeQuickAdd(card);
        }
      });
  }

  function openQuickAdd(
    card,
    {
      pinned = false,
      focusFirstSize = false
    } = {}
  ) {
    if (!card) return;

    const panel = getPanel(card);
    const toggle = getToggle(card);

    if (!panel || !toggle) return;

    clearCloseTimer(card);
    closeOtherCards(card);
    clearPortalRestoreTimer(panel);

    panel.__ppQuickAddOwnerCard = card;
    panel.__ppQuickAddOwnerProduct = getProduct(card);
    panel.__ppQuickAddOriginToggle = toggle;

    portalPanelToBody(card, panel);

    panel.hidden = false;
    panel.inert = false;
    panel.setAttribute(
      "aria-hidden",
      "false"
    );

    window.requestAnimationFrame(() => {
      card.classList.add(
        "is-quick-add-open"
      );
      panel.classList.add(
        "is-mobile-portal-open"
      );
    });

    card.dataset.quickAddPinned =
      pinned ? "true" : "false";

    toggle.setAttribute(
      "aria-expanded",
      "true"
    );

activeCard = card;

openMobileBackdrop();

if (focusFirstSize || isMobileQuickAdd()) {
      window.requestAnimationFrame(() => {
        const focusTarget =
          panel.querySelector(
            "[data-quick-add-size]:not(:disabled)"
          ) ||
          panel.querySelector(
            "[data-quick-add-close]"
          );

        focusTarget?.focus({
          preventScroll: true
        });
      });
    }
  }

  function scheduleClose(card) {
    if (!card) return;

    if (
      card.dataset.quickAddPinned ===
      "true"
    ) {
      return;
    }

    clearCloseTimer(card);

    const timer = window.setTimeout(() => {
      closeQuickAdd(card);
    }, 180);

    closeTimers.set(card, timer);
  }

  function updateCardImage(
    card,
    product,
    color
  ) {
    const image = card?.querySelector(
      ".card-media img"
    );

    if (!image) return;

    const normalizedColor =
      normalize(color);

    const matchingVariant =
      getVariants(product).find(
        (variant) => {
          return (
            variant.color ===
              normalizedColor &&
            variant.img
          );
        }
      );

    const nextImage =
      getColorMediaImage(
        product,
        normalizedColor
      ) ||
      matchingVariant?.img ||
      product?._media?.cover ||
      product?.cover ||
      "";

    if (!nextImage) return;

    image.src = nextImage;

    // Reinicia el carrusel al cambiar color.
    card.dataset.imgIndex = "0";
  }

  function createSizeButton(variant) {
    const button =
      document.createElement("button");

    const available =
      variant.stock > 0 &&
      canSellVariant();

    button.type = "button";
    button.className =
      "pp-quick-add-size";

    button.textContent = variant.size;

    button.dataset.quickAddSize =
      variant.size;

    button.dataset.quickAddSku =
      variant.sku;

    button.dataset.quickAddColor =
      variant.color;

    button.dataset.quickAddStock =
      String(variant.stock);

    button.disabled = !available;

    button.setAttribute(
      "aria-label",
      available
        ? `Añadir talla ${variant.size}, color ${
            getColorMeta(
              variant.color
            ).label
          }`
        : `Avisarme cuando la talla ${variant.size}, color ${
            getColorMeta(variant.color).label
          }, vuelva a estar disponible`
    );

    if (!available) {
      button.classList.add("is-out");

      const row = document.createElement("div");
      row.className = "pp-quick-add-size-row";

      const notifyButton = document.createElement("button");
      notifyButton.type = "button";
      notifyButton.className = "pp-quick-add-size__notify";
      notifyButton.dataset.quickAddNotifyStock = "";
      notifyButton.dataset.quickAddSize = variant.size;
      notifyButton.dataset.quickAddSku = variant.sku;
      notifyButton.dataset.quickAddColor = variant.color;
      notifyButton.textContent = "Avisarme";
      notifyButton.setAttribute(
        "aria-label",
        `Avisarme cuando la talla ${variant.size}, color ${
          getColorMeta(variant.color).label
        }, vuelva a estar disponible`
      );

      row.append(button, notifyButton);
      return row;
    }

    return button;
  }

  function renderSizes(
    card,
    product,
    color
  ) {
    const panel = getPanel(card);

    const sizeContainer =
      panel?.querySelector(
        "[data-quick-add-sizes]"
      );

    const colorLabel =
      panel?.querySelector(
        "[data-quick-add-color-label]"
      );

    if (!panel || !sizeContainer) {
      return;
    }

    const normalizedColor =
      normalize(color);

    const sizeOrder = [
      "XXS",
      "XS",
      "S",
      "M",
      "L",
      "XL",
      "XXL",
      "3XL"
    ];

    const variants = getVariants(product)
      .filter((variant) => {
        return (
          variant.color ===
          normalizedColor
        );
      })
      .sort((a, b) => {
        return (
          sizeOrder.indexOf(a.size) -
          sizeOrder.indexOf(b.size)
        );
      });

    sizeContainer.replaceChildren(
      ...variants.map(
        createSizeButton
      )
    );

    if (colorLabel) {
      const cutLabel =
        getSelectedCutLabel(product);
      const colorName = getColorMeta(
        normalizedColor
      ).label;

      colorLabel.textContent = cutLabel
        ? `${cutLabel} · ${colorName}`
        : colorName;
    }

    if (!variants.length) {
      setStatus(
        card,
        "No hay tallas configuradas para este color.",
        "error"
      );

      return;
    }

    const hasAvailableSize =
      variants.some((variant) => {
        return variant.stock > 0;
      });

    if (!hasAvailableSize) {
      setStatus(
        card,
        "Este color no tiene tallas disponibles.",
        "error"
      );

      return;
    }

    setStatus(card);
  }

  function selectColor(
    card,
    product,
    color
  ) {
    const normalizedColor =
      normalize(color);

    const productId = getProductKey(product);

    if (
      !normalizedColor ||
      !productId
    ) {
      return;
    }

    selectedColors.set(
      productId,
      normalizedColor
    );

card
  .querySelectorAll(
    "[data-quick-add-color-option]"
  )
  .forEach((button) => {
    const selected =
      normalize(
        button.dataset
          .quickAddColorOption
      ) === normalizedColor;

        button.classList.toggle(
          "is-selected",
          selected
        );

        button.setAttribute(
          "aria-pressed",
          String(selected)
        );
      });

    updateCardImage(
      card,
      product,
      normalizedColor
    );

    renderSizes(
      card,
      product,
      normalizedColor
    );
  }

  function createColorButton(
    product,
    color
  ) {
    const meta = getColorMeta(color);

    const stock = getColorStock(
      product,
      color
    );

    const button =
      document.createElement("button");

    const dot =
      document.createElement("span");

    const tooltip =
      document.createElement("span");

    button.type = "button";
    button.className = "pp-card-color";

button.dataset.quickAddColorOption =
  color;

    button.setAttribute(
      "aria-label",
      `${meta.label}${
        stock > 0
          ? ""
          : ", sin stock; ver tallas para recibir aviso"
      }`
    );

    button.title = meta.label;
    button.dataset.colorLabel = meta.label;

    button.setAttribute(
      "aria-pressed",
      "false"
    );

    button.style.setProperty(
      "--pp-quick-add-color",
      meta.value
    );

    if (stock <= 0) {
      button.classList.add("is-out");
    }

    dot.className =
      "pp-card-color__dot";

    dot.setAttribute(
      "aria-hidden",
      "true"
    );

    tooltip.className =
      "pp-card-color__tooltip";

    tooltip.textContent = meta.label;

    tooltip.setAttribute(
      "aria-hidden",
      "true"
    );

    button.append(dot, tooltip);

    return button;
  }

  function createCutButton(cut) {
    const cutId = normalize(cut?.id);
    const cutLabel = String(
      cut?.label || cutId || "Corte"
    ).trim();
    const button =
      document.createElement("button");

    button.type = "button";
    button.className = "pp-card-cut";
    button.dataset.quickAddCutOption =
      cutId;
    button.textContent = cutLabel;
    button.setAttribute(
      "aria-label",
      `Corte ${cutLabel}`
    );
    button.setAttribute(
      "aria-pressed",
      "false"
    );

    if (cut?.description) {
      button.title = String(
        cut.description
      ).trim();
    }

    return button;
  }

  function renderColors(card, product) {
    const colorsContainer =
      card?.querySelector(
        "[data-quick-add-colors]"
      );

    if (!colorsContainer) return;

    colorsContainer.replaceChildren(
      ...getColors(product).map((color) => {
        return createColorButton(
          product,
          color
        );
      })
    );

    selectColor(
      card,
      product,
      getSelectedColor(product)
    );
  }

  function selectCut(card, product, cutId) {
    const normalizedCut = normalize(cutId);
    const productKey = getProductKey(product);
    const validCut = getCuts(product).some(
      (cut) => {
        return (
          normalize(cut?.id) ===
          normalizedCut
        );
      }
    );

    if (
      !normalizedCut ||
      !productKey ||
      !validCut
    ) {
      return;
    }

    selectedCuts.set(
      productKey,
      normalizedCut
    );

    card
      .querySelectorAll(
        "[data-quick-add-cut-option]"
      )
      .forEach((button) => {
        const selected =
          normalize(
            button.dataset
              .quickAddCutOption
          ) === normalizedCut;

        button.classList.toggle(
          "is-selected",
          selected
        );
        button.setAttribute(
          "aria-pressed",
          String(selected)
        );
      });

    renderColors(card, product);
  }
/**
 * Crea una zona visual que contiene únicamente:
 * - la imagen del producto;
 * - el panel Quick Add.
 *
 * La información y el precio permanecen fuera.
 */
function ensureQuickAddStage(card) {
  if (!card) {
    return null;
  }

  let stage = card.querySelector(
    ":scope > .pp-quick-add-stage"
  );

  if (stage) {
    return stage;
  }

  const media =
    card.querySelector(
      ":scope > .plp-media"
    ) ||
    card.querySelector(
      ":scope > .card-media"
    );

  if (!media) {
    return null;
  }

  stage = document.createElement("div");

  stage.className =
    "pp-quick-add-stage";

  media.before(stage);
  stage.appendChild(media);

  return stage;
}
  function createQuickAddPanel(
    card,
    product,
    panelId
  ) {
    const panel =
      document.createElement("section");

    panel.id = panelId;

    panel.className =
      "pp-quick-add pp-quick-add-panel";

    panel.dataset.quickAdd = "";
    panel.dataset.quickAddPanel = "";

    panel.setAttribute(
      "aria-label",
      `Seleccionar talla para ${
        product.title ||
        "producto Prophetia"
      }`
    );

    panel.hidden = true;
    card.__ppQuickAddPanel = panel;

    const header =
      document.createElement("div");

    header.className =
      "pp-quick-add-panel__head";

    const heading =
      document.createElement("div");

    const kicker =
      document.createElement("p");

    kicker.className =
      "pp-quick-add-panel__kicker";

    kicker.textContent =
      "Selecciona una talla";

    const selectedColor =
      document.createElement("p");

    selectedColor.className =
      "pp-quick-add-panel__color";

    selectedColor.dataset.quickAddColorLabel =
      "";

    const price =
      document.createElement("p");

    price.className =
      "pp-quick-add-panel__price";

    const numericPrice = Number(
      product?.price
    );

    price.textContent = Number.isFinite(
      numericPrice
    )
      ? new Intl.NumberFormat("es-ES", {
          style: "currency",
          currency: "EUR"
        }).format(numericPrice)
      : "";

    heading.append(
      kicker,
      selectedColor,
      price
    );

    const closeButton =
      document.createElement("button");

    closeButton.type = "button";

    closeButton.className =
      "pp-quick-add-panel__close";

    closeButton.dataset.quickAddClose =
      "";

    closeButton.setAttribute(
      "aria-label",
      "Cerrar selector de tallas"
    );

    closeButton.textContent = "×";

    header.append(
      heading,
      closeButton
    );

    const sizes =
      document.createElement("div");

    sizes.className =
      "pp-quick-add-sizes";

    sizes.dataset.quickAddSizes = "";

    const fitGuide =
      document.createElement("button");

    fitGuide.type = "button";

    fitGuide.className =
      "pp-quick-add-fit-guide";

    fitGuide.dataset.quickAddFitGuide =
      "";

    fitGuide.textContent =
      "Recomendador de talla";

    const status =
      document.createElement("p");

    status.className =
      "pp-quick-add-status";

    status.dataset.quickAddStatus = "";

    status.setAttribute(
      "role",
      "status"
    );

    status.setAttribute(
      "aria-live",
      "polite"
    );

    status.hidden = true;

    panel.append(
      header,
      sizes,
      fitGuide,
      status
    );

    const stage =
      ensureQuickAddStage(card);

    if (!stage) {
      console.warn(
        "[Quick Add] No se encontró .card-media:",
        card
      );

      card.appendChild(panel);

      return panel;
    }

    stage.appendChild(panel);

    return panel;
  }

  function enhanceCard(card) {
    if (!card) return;

    if (
      card.dataset.quickAddReady ===
      "true"
    ) {
      return;
    }

    const product = getProduct(card);
    const variants = getVariants(product);

    if (
      !product ||
      !variants.length
    ) {
      card.dataset.quickAddReady =
        "unsupported";

      return;
    }

    const cardBody =
      card.querySelector(".card-body");

    if (!cardBody) return;

    const productId =
      getProductId(card);

    const panelId =
      `ppQuickAdd-${safeId(productId)}`;

    const options =
      document.createElement("div");

    options.className =
      "pp-quick-add pp-card-options";

    options.dataset.quickAdd = "";

    const productCuts = getCuts(product);
    let cuts = null;

    if (productCuts.length > 1) {
      options.classList.add(
        "has-cut-options"
      );

      cuts = document.createElement("div");
      cuts.className = "pp-card-cuts";
      cuts.setAttribute("role", "group");
      cuts.setAttribute(
        "aria-label",
        "Tipo de corte"
      );

      const cutsLabel =
        document.createElement("span");
      cutsLabel.className =
        "pp-card-cuts__label";
      cutsLabel.textContent = "Corte";
      cutsLabel.setAttribute(
        "aria-hidden",
        "true"
      );

      cuts.append(
        cutsLabel,
        ...productCuts.map(
          createCutButton
        )
      );
    }

    const colors =
      document.createElement("div");

    colors.className =
      "pp-card-colors";

    colors.dataset.quickAddColors = "";

    colors.setAttribute(
      "role",
      "group"
    );

    colors.setAttribute(
      "aria-label",
      "Colores disponibles"
    );

    const toggle =
      document.createElement("button");

    toggle.type = "button";

    toggle.className =
      "pp-quick-add-toggle";

    toggle.dataset.quickAddToggle = "";

    toggle.setAttribute(
      "aria-label",
      "Abrir selector de tallas"
    );

    toggle.setAttribute(
      "aria-controls",
      panelId
    );

    toggle.setAttribute(
      "aria-expanded",
      "false"
    );

    toggle.textContent = "+";

    if (cuts) {
      options.append(cuts);
    }

    options.append(colors, toggle);
    cardBody.appendChild(options);

    createQuickAddPanel(
      card,
      product,
      panelId
    );

    card.classList.add(
      "has-quick-add"
    );

    card.dataset.quickAddReady =
      "true";

    card.dataset.quickAddPinned =
      "false";

    const selectedCut =
      getSelectedCut(product);

    if (selectedCut) {
      selectCut(
        card,
        product,
        selectedCut
      );
    } else {
      renderColors(card, product);
    }
  }


function injectQuickAdd() {
  if (
    typeof window.ppPLP?.getProduct !==
    "function"
  ) {
    return;
  }

  document
    .querySelectorAll(
      "#plp-grid .card, " +
      "#plp-grid .product-card"
    )
    .forEach(enhanceCard);
}

function observeQuickAddGrid() {
  const grid =
    document.getElementById("plp-grid");

  if (!grid) return;

  /*
   * Evita registrar varios observadores
   * sobre el mismo grid.
   */
  if (observedGrid === grid) {
    return;
  }

  if (gridObserver) {
    gridObserver.disconnect();
  }

  observedGrid = grid;

  gridObserver =
    new MutationObserver(() => {
      window.requestAnimationFrame(
        injectQuickAdd
      );
    });

  gridObserver.observe(grid, {
    childList: true,
    subtree: true
  });
}

async function startQuickAdd() {
  await window.ppStorefront?.ready;
  observeQuickAddGrid();

  window.requestAnimationFrame(
    injectQuickAdd
  );
}



function animateToCart(card) {
  return new Promise((resolve) => {
    const source = card?.querySelector(
      ".card-media img"
    );

    const target = document.getElementById(
      "ppCartBtn"
    );

    if (!source || !target) {
      resolve();
      return;
    }

    const reducedMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    /*
     * Reinicia el pulso si se añaden
     * varias prendas seguidas.
     */
    target.classList.remove(
      "is-quick-add-pulse"
    );

    void target.offsetWidth;

    if (reducedMotion) {
      target.classList.add(
        "is-quick-add-pulse"
      );

      window.setTimeout(() => {
        target.classList.remove(
          "is-quick-add-pulse"
        );

        resolve();
      }, 260);

      return;
    }

    const sourceRect =
      source.getBoundingClientRect();

    const targetRect =
      target.getBoundingClientRect();

    const startSize = Math.min(
      84,
      Math.max(
        58,
        sourceRect.width * 0.22
      )
    );

    const startLeft =
      sourceRect.right -
      startSize -
      18;

    const startTop =
      sourceRect.bottom -
      startSize -
      18;

    const fly =
      document.createElement("div");

    fly.className =
      "pp-quick-add-fly";

    fly.setAttribute(
      "aria-hidden",
      "true"
    );

    const flyImage =
      document.createElement("img");

    flyImage.src =
      source.currentSrc ||
      source.src;

    flyImage.alt = "";

    fly.appendChild(flyImage);

    Object.assign(fly.style, {
      left: `${startLeft}px`,
      top: `${startTop}px`,
      width: `${startSize}px`,
      height: `${startSize}px`
    });

    document.body.appendChild(fly);

    const translateX =
      targetRect.left +
      targetRect.width / 2 -
      (startLeft + startSize / 2);

    const translateY =
      targetRect.top +
      targetRect.height / 2 -
      (startTop + startSize / 2);

    const animation = fly.animate(
      [
        {
          transform:
            "translate3d(0, 0, 0) scale(1)",
          opacity: 1
        },
        {
          offset: 0.45,
          transform:
            `translate3d(
              ${translateX * 0.46}px,
              ${translateY * 0.38}px,
              0
            ) scale(.72)`,
          opacity: 0.92
        },
        {
          transform:
            `translate3d(
              ${translateX}px,
              ${translateY}px,
              0
            ) scale(.08)`,
          opacity: 0.12
        }
      ],
      {
        duration: 620,
        easing:
          "cubic-bezier(.22, .78, .24, 1)",
        fill: "forwards"
      }
    );

    animation.finished
      .catch(() => {})
      .finally(() => {
        fly.remove();

        target.classList.add(
          "is-quick-add-pulse"
        );

        window.setTimeout(() => {
          target.classList.remove(
            "is-quick-add-pulse"
          );
        }, 580);

        resolve();
      });
  });
}
async function addVariantToCart(
  card,
  product,
  sizeButton
) {
  if (
    card.dataset.quickAddAdding ===
    "true"
  ) {
    return;
  }

  const selectedColor = normalize(
    sizeButton.dataset.quickAddColor
  );

  const selectedSize = upper(
    sizeButton.dataset.quickAddSize
  );

  const selectedSku = String(
    sizeButton.dataset.quickAddSku || ""
  ).trim();

  const variant = getVariants(
    product
  ).find((entry) => {
    return (
      entry.sku === selectedSku &&
      entry.color === selectedColor &&
      entry.size === selectedSize
    );
  });

  if (
    !variant ||
    variant.stock <= 0
  ) {
    setStatus(
      card,
      "La talla seleccionada ya no está disponible.",
      "error"
    );

    return;
  }

  if (
    typeof window.ppAddToCart !==
    "function"
  ) {
    setStatus(
      card,
      "La cesta todavía no está disponible.",
      "error"
    );

    console.warn(
      "[Quick Add] ppAddToCart no está disponible."
    );

    return;
  }

  const currentImage =
    card
      .querySelector(
        ".card-media img"
      )
      ?.getAttribute("src") ||
    variant.img ||
    product?._media?.cover ||
    product?.cover ||
    "assets/img/placeholder.png";

  const selectedCutId = getSelectedCut(product);
  const selectedVersion = getSelectedVersion(product);

  const cartProduct = {
    id: String(
      product.id ||
      product._id ||
      ""
    ),

    sku: variant.sku,

    title:
      product.title ||
      "Producto Prophetia",

    cut: selectedCutId || null,
    cutLabel: getSelectedCutLabel(product) || null,
    version: selectedVersion?.id || null,
    versionLabel: selectedVersion?.label || null,

    price:
      Number(
        variant.price ??
        product.price
      ) || 0,

    color: variant.color,
    size: variant.size,

    img:
      variant.img ||
      currentImage,

    qty: 1
  };

  card.dataset.quickAddAdding =
    "true";

  card.classList.add(
    "is-quick-add-adding"
  );

  card.setAttribute(
    "aria-busy",
    "true"
  );

  const sizeButtons =
    card.querySelectorAll(
      "[data-quick-add-size]"
    );

  sizeButtons.forEach((button) => {
    button.disabled = true;
  });

  try {
    /*
     * La animación empieza antes de cerrar
     * el panel para capturar bien la imagen.
     */
    const animationPromise =
      animateToCart(card);

    /*
     * Añadimos sin abrir todavía el drawer.
     */
    window.ppAddToCart(
      cartProduct,
      {
        open: false
      }
    );

    setStatus(
      card,
      `Añadido: ${
        getColorMeta(
          variant.color
        ).label
      } · ${variant.size}`,
      "success"
    );

    closeQuickAdd(card);

await animationPromise;

/*
 * Quick Add mantiene al usuario en el grid.
 * La cantidad ya se actualiza en la bolsa
 * mediante pp:cart-updated.
 */
window.ppTopNotice?.(
  `${getColorMeta(variant.color).label} · ${variant.size} añadido a la cesta`
);
  } finally {
    card.dataset.quickAddAdding =
      "false";

    card.classList.remove(
      "is-quick-add-adding"
    );

    card.removeAttribute(
      "aria-busy"
    );

    sizeButtons.forEach((button) => {
      const stock = Number(
        button.dataset.quickAddStock
      );

      button.disabled = !(
        stock > 0 &&
        canSellVariant()
      );
    });
  }
}
  function openFitGuide(
    card,
    product
  ) {
    const productId = String(
      product?.id ||
        product?._id ||
        ""
    ).trim();

    const gender = String(
      card
        .closest("#plp-grid")
        ?.dataset?.gender ||
        ""
    ).trim();

    const fitGuideEvent =
      new CustomEvent(
        "pp:fit-guide:open",
        {
          cancelable: true,

          detail: {
            product,
            productId,
            gender,
            cut: getSelectedCut(product),
            source: "quick-add"
          }
        }
      );

    const handled =
      !window.dispatchEvent(
        fitGuideEvent
      );

    if (handled) return;

    const params =
      new URLSearchParams({
        id: productId
      });

    if (gender) {
      params.set("g", gender);
    }

    const selectedCut =
      getSelectedCut(product);

    if (selectedCut) {
      params.set("cut", selectedCut);
    }

    window.location.assign(
      `/producto?${params.toString()}#fit-guide`
    );
  }

  /*
   * El PLP vuelve a construir las tarjetas
   * cuando se filtra u ordena.
   */
document.addEventListener(
  "pp:plp:rendered",
  () => {
    activeCard = null;
    startQuickAdd();
  }
);

if (
  document.readyState === "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    startQuickAdd,
    {
      once: true
    }
  );
} else {
  startQuickAdd();
}

window.addEventListener(
  "partials:ready",
  startQuickAdd
);

  /*
   * Escritorio:
   * pasar el ratón sobre + abre el panel.
   */
  document.addEventListener(
    "pointerover",
    (event) => {
      if (
        event.pointerType &&
        event.pointerType !== "mouse"
      ) {
        return;
      }

      const toggle =
        event.target.closest(
          "[data-quick-add-toggle]"
        );

      if (!toggle) return;

      if (skipFocusOpen.has(toggle)) {
        return;
      }

      const card = toggle.closest(
        ".card.has-quick-add"
      );

      openQuickAdd(card);
    },
    true
  );

  /*
   * Cierra cuando el cursor sale
   * completamente de la tarjeta.
   */
  document.addEventListener(
    "pointerout",
    (event) => {
      const card = resolveOwnerCard(event.target);

      if (!card) return;

      if (
        card.contains(
          event.relatedTarget
        )
      ) {
        return;
      }

      scheduleClose(card);
    },
    true
  );

  /*
   * Abrir también al navegar
   * con teclado hasta el botón +.
   */
  document.addEventListener(
    "focusin",
    (event) => {
      const toggle =
        event.target.closest(
          "[data-quick-add-toggle]"
        );

      if (!toggle) return;

      if (skipFocusOpen.has(toggle)) {
        return;
      }

      const card = toggle.closest(
        ".card.has-quick-add"
      );

      openQuickAdd(card);
    },
    true
  );

    /*
   * Delegación de todas las acciones del Quick Add.
   */
  document.addEventListener(
    "click",
    (event) => {

      const backdrop = event.target.closest(
  "[data-quick-add-backdrop]"
);

if (backdrop) {
  event.preventDefault();
  event.stopPropagation();

  if (activeCard) {
    closeQuickAdd(activeCard);
  }

  return;
}
      /*
       * Selección del tipo de corte.
       */
      const cutButton = event.target.closest(
        "[data-quick-add-cut-option]"
      );

      if (cutButton) {
        event.preventDefault();
        event.stopPropagation();

        const card = cutButton.closest(
          ".card.has-quick-add"
        );
        const product = getProduct(card);

        if (!card || !product) {
          return;
        }

        selectCut(
          card,
          product,
          cutButton.dataset.quickAddCutOption
        );

        return;
      }
      /*
       * Selección del color.
       */
      const colorButton = event.target.closest(
        "[data-quick-add-color-option]"
      );

      if (colorButton) {
        event.preventDefault();
        event.stopPropagation();

        const card = colorButton.closest(
          ".card.has-quick-add"
        );

        const product = getProduct(card);

        if (
          !card ||
          !product ||
          colorButton.disabled
        ) {
          return;
        }

        selectColor(
          card,
          product,
          colorButton.dataset.quickAddColorOption
        );

        return;
      }

      /*
       * Abrir o cerrar selector mediante +.
       */
      const toggle = event.target.closest(
        "[data-quick-add-toggle]"
      );

      if (toggle) {
        event.preventDefault();
        event.stopPropagation();

        const card = toggle.closest(
          ".card.has-quick-add"
        );

        if (!card) return;

        const isOpen = card.classList.contains(
          "is-quick-add-open"
        );

        const isPinned =
          card.dataset.quickAddPinned === "true";

        if (isOpen && isPinned) {
          closeQuickAdd(card, {
            restoreFocus: true
          });
        } else {
          openQuickAdd(card, {
            pinned: true,
            focusFirstSize: true
          });
        }

        return;
      }

      /*
       * Cerrar selector.
       */
      const closeButton = event.target.closest(
        "[data-quick-add-close]"
      );

      if (closeButton) {
        event.preventDefault();
        event.stopPropagation();

        const card = resolveOwnerCard(closeButton);

        closeQuickAdd(card, {
          restoreFocus: true
        });

        return;
      }

      /*
       * Seleccionar talla y añadir variante.
       */
      const sizeButton = event.target.closest(
        "[data-quick-add-size]"
      );

      if (sizeButton) {
        event.preventDefault();
        event.stopPropagation();

        const card = resolveOwnerCard(sizeButton);
        const product =
          card &&
          (getProduct(card) ||
            sizeButton.closest("[data-quick-add-panel]")
              ? sizeButton.closest("[data-quick-add-panel]")
                  ? sizeButton.closest("[data-quick-add-panel]").__ppQuickAddOwnerProduct
                  : getProduct(card)
              : getProduct(card));

        if (
          card &&
          product &&
          sizeButton.hasAttribute(
            "data-quick-add-notify-stock"
          )
        ) {
          document.dispatchEvent(
            new CustomEvent(
              "pp:stock-notify-variant",
              {
                detail: {
                  card,
                  sku: String(
                    sizeButton.dataset.quickAddSku || ""
                  ).trim(),
                  color: String(
                    sizeButton.dataset.quickAddColor || ""
                  ).trim(),
                  size: String(
                    sizeButton.dataset.quickAddSize || ""
                  ).trim()
                }
              }
            )
          );

          return;
        }

        if (
          !card ||
          !product ||
          sizeButton.disabled ||
          !canSellVariant()
        ) {
          return;
        }

        void addVariantToCart(
          card,
          product,
          sizeButton
        );

        return;
      }

      /*
       * Abrir recomendador.
       */
      const fitGuideButton = event.target.closest(
        "[data-quick-add-fit-guide]"
      );

      if (fitGuideButton) {
        event.preventDefault();
        event.stopPropagation();

        const card = resolveOwnerCard(fitGuideButton);
        const panel =
          fitGuideButton.closest("[data-quick-add-panel]");
        const product =
          (card && getProduct(card)) ||
          panel?.__ppQuickAddOwnerProduct ||
          null;

        if (card && product) {
          openFitGuide(
            card,
            product
          );
        }

        return;
      }

      /*
       * Clic fuera del componente.
       */
      if (
        activeCard &&
        !event.target.closest(
          ".card.has-quick-add"
        ) &&
        !event.target.closest(
          "[data-quick-add-panel]"
        )
      ) {
        closeQuickAdd(activeCard);
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key !== "Escape" ||
        !activeCard
      ) {
        return;
      }

      event.preventDefault();

      closeQuickAdd(activeCard, {
        restoreFocus: true
      });
    },
    true
  );
})();

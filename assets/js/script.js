/* -----------------------------------------------
   PROPHETIA Front — Catálogo + PDP + Zoom + UI
   ----------------------------------------------- */
(function () {
  "use strict";

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byId = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const q = (k, d = "") => (params.get(k) ?? d).toLowerCase();

  const pageType = document.body?.dataset?.page || ""; // 'tshirts' | 'hoodies' | 'collections' | etc.

  // ---------- Carga de catálogo ----------
  async function loadCatalog() {
    if (window.PROPHETIA_CATALOG) return window.PROPHETIA_CATALOG;
    try {
      const res = await fetch("assets/data/catalog.json", { cache: "no-store" });
      if (!res.ok) throw new Error("no catalog");
      return await res.json();
    } catch (e) {
      console.warn("Catalog not found, using fallback.", e);
      return [
        {
          id: "atlas-seal",
          type: "tshirt",
          title: "Atlas by Prophetia",
          collection: "myth-series",
          gender: "unisex",
          fit: "regular",
          price: 59.0,
          inStock: true,
          images: [
            "assets/img/atlas/atlas-front.png",
            "assets/img/atlas/atlas-back.png"
          ],
          short: "Perfil escultórico y sello griego. DTG-ready.",
          sizes: ["S", "M", "L", "XL"]
        }
      ];
    }
  }

  // ---------- Pretty ----------
  function prettyCollection(c) {
    if (!c) return "";
    if (c === "myth-series") return "Myth Series";
    if (c === "letters-from-the-soul") return "Letters from the Soul";
    return c.replace(/-/g, " ");
  }

  /* ==========================================================
   *  LISTADO (camisetas / hoodies / colecciones)
   * ========================================================== */
  (async function initListing() {
    const grid = byId("productsGrid");
    if (!grid) return; // no es página de listado

    // Estado (desde URL)
    const state = {
      type:
        pageType === "hoodies"
          ? "hoodie"
          : pageType === "tshirts"
          ? "tshirt"
          : pageType === "collections"
          ? "" // admite todo si lo deseas; ajusta a 'tshirt' para solo tees
          : "",
      fit: q("fit", "all"),
      gender: q("gender", "all"),
      collection: q("collection", "all"),
      stock: q("stock", "") === "1",
      order: q("order", "relevance")
    };

    // Aplica hash como filtro de colección en colecciones.html (#myth-series / #letters-from-the-soul)
    (function applyHashToFiltersIfNeeded() {
      const h = (location.hash || "").replace("#", "").toLowerCase();
      if (h === "myth-series" || h === "letters-from-the-soul") {
        state.collection = h;
      }
    })();

    // UI chips ⇄ estado
    function initChipsFromState() {
      $$(".chip[data-k]").forEach((btn) => {
        const k = btn.dataset.k;
        const v = (btn.dataset.v || "").toLowerCase();
        const active =
          (state[k] || "all") === v ||
          (v === "all" && (state[k] === "all" || !state[k]));
        btn.classList.toggle("chip-active", active);
      });
      const onlyStock = byId("onlyStock");
      if (onlyStock) onlyStock.checked = !!state.stock;
      const orderSel = byId("orderSelect");
      if (orderSel) orderSel.value = state.order;
    }

    function bindFilters() {
      $$(".chip[data-k]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const k = btn.dataset.k;
          const v = btn.dataset.v.toLowerCase();
          state[k] = v;
          $$(`.chip[data-k="${k}"]`).forEach((b) =>
            b.classList.remove("chip-active")
          );
          btn.classList.add("chip-active");
          render();
          syncUrl();
        });
      });
      const onlyStock = byId("onlyStock");
      if (onlyStock) {
        onlyStock.addEventListener("change", () => {
          state.stock = onlyStock.checked;
          render();
          syncUrl();
        });
      }
      const orderSel = byId("orderSelect");
      if (orderSel) {
        orderSel.addEventListener("change", () => {
          state.order = orderSel.value;
          render();
          syncUrl();
        });
      }
    }

    function syncUrl() {
      const p = new URLSearchParams();
      if (state.gender !== "all") p.set("gender", state.gender);
      if (state.fit !== "all") p.set("fit", state.fit);
      if (state.collection !== "all") p.set("collection", state.collection);
      if (state.stock) p.set("stock", "1");
      if (state.order && state.order !== "relevance") p.set("order", state.order);
      const newUrl =
        location.pathname +
        (p.toString() ? "?" + p.toString() : "") +
        (location.hash || "");
      history.replaceState(null, "", newUrl);
    }

    // Predicados
    const passType = (p) => (!state.type ? true : p.type === state.type);
    const passFit = (p) =>
      state.fit === "all" ? true : (p.fit || "regular").toLowerCase() === state.fit;
    const passGender = (p) =>
      state.gender === "all"
        ? true
        : (p.gender || "unisex").toLowerCase() === state.gender;
    const passCollection = (p) =>
      state.collection === "all"
        ? true
        : (p.collection || "").toLowerCase() === state.collection;
    const passStock = (p) => (!state.stock ? true : !!p.inStock);

    function sortProducts(list) {
      const s = state.order;
      if (s === "price-asc") return list.slice().sort((a, b) => a.price - b.price);
      if (s === "price-desc") return list.slice().sort((a, b) => b.price - a.price);
      return list; // relevance: orden original
    }

    function cardHTML(p) {
      const base = (p.images && p.images[0]) || "assets/img/placeholder.png";
      const hi = base.replace(/(\.\w+)$/, "@2x$1");
      const price = (p.price ?? 0).toFixed(2).replace(".", ",");
      const title = p.title || "Producto";
      return `
        <article class="card">
          <div class="img-wrap">
            <img src="${base}" srcset="${base} 1x, ${hi} 2x" alt="${title}" loading="lazy" decoding="async">
          </div>
          <h4>${title}</h4>
          <p class="collection">${prettyCollection(p.collection)}</p>
          <span class="price">€${price}</span>
          <a class="btn-primary" href="producto.html?id=${encodeURIComponent(
            p.id
          )}">Ver</a>
        </article>
      `;
    }

    /* ---------- QUICK ZOOM (Lightbox) para GRID ---------- */
    function ensureLightboxDOM() {
      if (byId("lb")) return;
      const div = document.createElement("div");
      div.id = "lb";
      div.className = "lb hidden";
      div.setAttribute("aria-hidden", "true");
      div.setAttribute("role", "dialog");
      div.setAttribute("aria-label", "Vista ampliada");
      div.innerHTML = `
        <div class="lb-backdrop" data-lb-close></div>
        <figure class="lb-figure">
          <img id="lbImg" class="lb-img" alt="">
          <button class="lb-close" id="lbClose" aria-label="Cerrar" title="Cerrar">&times;</button>
          <button class="lb-prev"  id="lbPrev"  aria-label="Anterior">‹</button>
          <button class="lb-next"  id="lbNext"  aria-label="Siguiente">›</button>
        </figure>
      `;
      document.body.appendChild(div);
    }

    function initGridQuickZoom() {
      ensureLightboxDOM();
      const lb = byId("lb");
      const lbImg = byId("lbImg");
      const btnPrev = byId("lbPrev");
      const btnNext = byId("lbNext");
      const btnClose = byId("lbClose");

      if (!lb || !lbImg) return;

      // Evitar doble binding
      if (window.__ppQuickZoomBound) return;
      window.__ppQuickZoomBound = true;

      let gallery = [];
      let index = 0;

      function collectGallery() {
        gallery = $$(".products-grid .card .img-wrap img").map(
          (img) => img.currentSrc || img.src
        );
      }
      function show(i) {
        if (!gallery.length) return;
        index = (i + gallery.length) % gallery.length;
        lbImg.src = gallery[index];
        lb.classList.remove("hidden");
        lb.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
      }
      function hide() {
        lb.classList.add("hidden");
        lb.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
      }
      const next = () => show(index + 1);
      const prev = () => show(index - 1);

      lb.addEventListener("click", (e) => {
        if (e.target === lb || e.target.hasAttribute("data-lb-close")) hide();
      });
      btnClose?.addEventListener("click", hide);
      btnNext?.addEventListener("click", next);
      btnPrev?.addEventListener("click", prev);

      document.addEventListener("keydown", (e) => {
        if (lb.classList.contains("hidden")) return;
        if (e.key === "Escape") hide();
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") prev();
      });

      // Delegación click en imágenes del grid
      document.addEventListener("click", (e) => {
        const img = e.target.closest(".products-grid .card .img-wrap img");
        if (!img) return;
        e.preventDefault(); // que no navegue si la img está envuelta en <a>
        collectGallery();
        const src = img.currentSrc || img.src;
        const i = gallery.indexOf(src);
        show(i >= 0 ? i : 0);
      });
    }

    // Render
    let CATALOG = [];
    async function render() {
      let items = CATALOG.filter(passType)
        .filter(passFit)
        .filter(passGender)
        .filter(passCollection)
        .filter(passStock);

      items = sortProducts(items);

      if (!items.length) {
        grid.innerHTML =
          '<div class="muted" style="padding:24px;">No hay productos para este filtro.</div>';
        return;
      }
      grid.innerHTML = items.map(cardHTML).join("");
      initGridQuickZoom(); // activar zoom tras pintar
    }

    // Init
    initChipsFromState();
    bindFilters();
    CATALOG = await loadCatalog();
    render();
  })();

  /* ==========================================================
   *  PDP (producto.html)
   * ========================================================== */
  (async function initPDP() {
    const wrap = $(".product-wrap");
    if (!wrap) return; // no es PDP

    const id = q("id", "");
    const title = byId("pTitle");
    const price = byId("pPrice");
    const desc = byId("pDesc");
    const mainImg = byId("pMain");
    const dots = byId("pDots");
    const thumbs = byId("pThumbs");
    const sizesRow = byId("sizeRow");
    const qty = byId("qty");

    // Crea overlay zoom si falta
    function ensurePdpLightbox() {
      if (byId("pdpZoom")) return;
      const div = document.createElement("div");
      div.id = "pdpZoom";
      div.className = "lb hidden";
      div.setAttribute("aria-hidden", "true");
      div.setAttribute("role", "dialog");
      div.innerHTML = `
        <div class="lb-backdrop" data-lb-close></div>
        <figure class="lb-figure">
          <img id="pdpZoomImg" class="lb-img" alt="">
          <button class="lb-close" id="pdpZoomClose" aria-label="Cerrar">&times;</button>
          <button class="lb-prev"  id="pdpZoomPrev"  aria-label="Anterior">‹</button>
          <button class="lb-next"  id="pdpZoomNext"  aria-label="Siguiente">›</button>
        </figure>`;
      document.body.appendChild(div);
    }
    ensurePdpLightbox();

    const lb = byId("pdpZoom");
    const lbImg = byId("pdpZoomImg");
    const lbPrev = byId("pdpZoomPrev");
    const lbNext = byId("pdpZoomNext");
    const lbClose = byId("pdpZoomClose");

    let CATALOG = await loadCatalog();
    let p = CATALOG.find((x) => String(x.id) === id) || CATALOG[0];

    // Si no hay producto, salir
    if (!p) return;

    // Render básico
    title && (title.textContent = p.title || "Producto");
    price && (price.textContent = "€" + (p.price ?? 0).toFixed(2).replace(".", ","));
    desc && (desc.textContent = p.short || "");

    // Tallas
    if (sizesRow) {
      sizesRow.innerHTML = (p.sizes || ["S", "M", "L", "XL"])
        .map((s) => `<button type="button" class="size-btn" data-size="${s}">${s}</button>`)
        .join("");
      sizesRow.addEventListener("click", (e) => {
        const btn = e.target.closest(".size-btn");
        if (!btn) return;
        $$(".size-btn", sizesRow).forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    }

    // Galería
    const imgs = (p.images && p.images.length ? p.images : []).slice();
    if (!imgs.length) imgs.push("assets/img/placeholder.png");
    let idx = 0;

    function renderGallery() {
      if (mainImg) mainImg.src = imgs[idx];

      if (dots) {
        dots.innerHTML = imgs
          .map(
            (_, i) =>
              `<span class="dot ${i === idx ? "active" : ""}" data-i="${i}"></span>`
          )
          .join("");
      }
      if (thumbs) {
        thumbs.innerHTML = imgs
          .map(
            (src, i) =>
              `<img class="${i === idx ? "active" : ""}" data-i="${i}" src="${src}" alt="thumb ${i + 1}">`
          )
          .join("");
      }
    }
    renderGallery();

    // Navegación flechas
    const prevBtn = $(".g-prev");
    const nextBtn = $(".g-next");
    function show(i) {
      idx = (i + imgs.length) % imgs.length;
      renderGallery();
    }
    prevBtn?.addEventListener("click", () => show(idx - 1));
    nextBtn?.addEventListener("click", () => show(idx + 1));

    dots?.addEventListener("click", (e) => {
      const d = e.target.closest(".dot");
      if (!d) return;
      show(+d.dataset.i);
    });
    thumbs?.addEventListener("click", (e) => {
      const t = e.target.closest("img[data-i]");
      if (!t) return;
      show(+t.dataset.i);
    });

    // ---------- Zoom fullscreen al clicar la imagen principal ----------
    function pdpZoomOpen(i) {
      idx = i;
      lbImg.src = imgs[idx];
      lb.classList.remove("hidden");
      lb.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
    function pdpZoomClose() {
      lb.classList.add("hidden");
      lb.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
    function pdpZoomNext() {
      idx = (idx + 1) % imgs.length;
      lbImg.src = imgs[idx];
    }
    function pdpZoomPrev() {
      idx = (idx - 1 + imgs.length) % imgs.length;
      lbImg.src = imgs[idx];
    }

    // Abrir zoom al clicar imagen principal
    mainImg?.addEventListener("click", () => pdpZoomOpen(idx));
    lb.addEventListener("click", (e) => {
      if (e.target === lb || e.target.hasAttribute("data-lb-close")) pdpZoomClose();
    });
    lbClose?.addEventListener("click", pdpZoomClose);
    lbNext?.addEventListener("click", pdpZoomNext);
    lbPrev?.addEventListener("click", pdpZoomPrev);
    document.addEventListener("keydown", (e) => {
      if (lb.classList.contains("hidden")) return;
      if (e.key === "Escape") pdpZoomClose();
      if (e.key === "ArrowRight") pdpZoomNext();
      if (e.key === "ArrowLeft") pdpZoomPrev();
    });

    // Compra (demo)
    byId("buyForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const sizeSel =
        $(".size-btn.active", sizesRow)?.dataset?.size || (p.sizes || [])[0] || "";
      const qn = parseInt(qty?.value || "1", 10) || 1;
      alert(`Añadido: ${p.title} — Talla ${sizeSel} × ${qn}`);
    });
  })();

  /* ==========================================================
   *  Mega menú hover/click
   * ========================================================== */
  (function bindMegaMenu() {
    $$(".mega").forEach((m) => {
      const btn = $(".mega-toggle", m);
      const panel = $(".mega-panel", m);
      if (!btn || !panel) return;
      let over = false;
      m.addEventListener("mouseenter", () => {
        m.classList.add("open");
        over = true;
      });
      m.addEventListener("mouseleave", () => {
        over = false;
        setTimeout(() => !over && m.classList.remove("open"), 120);
      });
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        m.classList.toggle("open");
      });
    });
  })();

  /* ==========================================================
   *  Pop-up Prophetia Tribe (global)
   * ========================================================== */
  (function initTribePopup() {
    const MODAL = byId("tribeModal");
    if (!MODAL) return;

    const OPEN_DELAY_MS = 6500;
        const LS_KEY = 'pp_tribe_closed_until';
    const back   = MODAL.querySelector('.tribe-backdrop');
    const closes = MODAL.querySelectorAll('[data-close], .tribe-close');
    const form   = MODAL.querySelector('#tribeForm');

    function open() {
      MODAL.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      MODAL.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    function snooze(days = 7) {
      const ms = days * 24 * 60 * 60 * 1000;
      localStorage.setItem(LS_KEY, String(Date.now() + ms));
    }

    // Cierre por botón/fondo
    closes.forEach(btn => btn.addEventListener('click', () => { close(); snooze(7); }));
    if (back) back.addEventListener('click', () => { close(); snooze(7); });

    // Esc para cerrar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && MODAL.getAttribute('aria-hidden') === 'false') {
        close();
        snooze(7);
      }
    });

    // Mostrar si no está en "descanso"
    const now   = Date.now();
    const until = +localStorage.getItem(LS_KEY) || 0;
    if (now > until) setTimeout(open, OPEN_DELAY_MS);

    // Envío del formulario (demo)
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        snooze(7);
        close();
        alert('¡Gracias por unirte a Prophetia Tribe!');
      });
    }

    // Disparador manual opcional (por si pones un enlace en la web):
    document.querySelectorAll('[data-open-tribe]').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); open(); });
    });
  })(); // ← fin del initTribePopup()

})(); // ← fin del wrapper principal "(function(){ ... })()"


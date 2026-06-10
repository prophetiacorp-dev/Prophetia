/* =========================================================
   PROPHETIA · collection-reveal.js
   - Multi-toggle accesible (aria-expanded / hidden)
   - Animación height
   - Hook para renderizar grid una sola vez por panel
   - Clases MS: ms-reveal-inner / ms-reveal-content
   ========================================================= */

(() => {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else fn();
  }

  function setupReveal(root = document) {
    const buttons = root.querySelectorAll("[data-reveal-btn]");
    if (!buttons || !buttons.length) return;

    buttons.forEach((btn) => {
      const targetId = btn.getAttribute("aria-controls") || btn.dataset.revealBtn;
      if (!targetId) return;

      const panel = document.getElementById(targetId);
      if (!panel) return;

      // Envolver para animar height (clases MS)
      let inner = panel.querySelector(".ms-reveal-inner");
      if (!inner) {
        const innerWrap = document.createElement("div");
        innerWrap.className = "ms-reveal-inner";

        const contentWrap = document.createElement("div");
        contentWrap.className = "ms-reveal-content";

        while (panel.firstChild) contentWrap.appendChild(panel.firstChild);
        innerWrap.appendChild(contentWrap);
        panel.appendChild(innerWrap);

        inner = innerWrap;
      }

      const eventName = btn.dataset.revealEvent || "collection:reveal-open";

    function open() {
  panel.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  panel.__ppBtn = btn; // ✅ clave: el listener de content-ready necesita esto

  // Ocultar botón al abrir
  if (btn.hasAttribute("data-hide-on-open") && btn.dataset.hideOnOpen !== "false") {
    btn.hidden = true;
  }


        // Hook para cargar (solo 1 vez por panel)
        if (!panel.__ppRevealLoaded) {
          panel.__ppRevealLoaded = true;

          const payload = {
            targetId,
            cat: btn.dataset.cat || panel.dataset.cat || "",
            mount: btn.dataset.mount || panel.dataset.mount || "#plp-grid",
            page: document.body?.dataset?.page || ""
          };

          window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
        }

        inner.style.height = "0px";

        requestAnimationFrame(() => {
          inner.style.height = inner.scrollHeight + "px";
        });

        setTimeout(() => {
          if (btn.getAttribute("aria-expanded") === "true") {
            inner.style.height = inner.scrollHeight + "px";
          }
        }, 80);

        setTimeout(() => {
          if (btn.getAttribute("aria-expanded") === "true") {
            inner.style.height = inner.scrollHeight + "px";
          }
        }, 280);

        setTimeout(() => {
          panel.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);
      }

   function close() {
  btn.setAttribute("aria-expanded", "false");
  const currentH = inner.scrollHeight;

  inner.style.height = currentH + "px";
  requestAnimationFrame(() => {
    inner.style.height = "0px";
  });

  const onEnd = () => {
    inner.removeEventListener("transitionend", onEnd);
    panel.hidden = true;
    inner.style.height = "";
  };
  inner.addEventListener("transitionend", onEnd);
}

// ✅ evita doble binding (partials:ready / swup / reinyecciones)
if (btn.__ppRevealBound) return;
btn.__ppRevealBound = true;

btn.addEventListener("click", () => {
  console.log("[reveal] click", targetId);
  const isOpen = btn.getAttribute("aria-expanded") === "true";
  isOpen ? close() : open();
});


      window.addEventListener("resize", () => {
        if (btn.getAttribute("aria-expanded") === "true") {
          inner.style.height = inner.scrollHeight + "px";
        }
      });
    });
  }

  ready(() => {
    setupReveal(document);
    window.addEventListener("partials:ready", () => setupReveal(document));
  });
})();

window.addEventListener("collection:reveal-open", (e) => {
  const { cat, mount } = e.detail || {};
  if (!cat || !mount) return;

  if (window.PP_PLP?.renderInto) {
    window.PP_PLP.renderInto(mount, { collection: cat, gender: "" });
  }
});

window.addEventListener("pp:reveal:content-ready", (ev) => {
  const sel = ev.detail?.mountSelector;
  if (!sel) return;

  const mount = document.querySelector(sel);
  if (!mount) return;

  const panel = mount.closest(".ms-reveal");
  if (!panel || panel.hidden) return;

  const inner = panel.querySelector(".ms-reveal-inner");
  if (!inner) return;

  const btn = panel.__ppBtn;

  if (!btn || btn.getAttribute("aria-expanded") !== "true") return;

  // 1) Fuerza cálculo real
  inner.style.height = inner.scrollHeight + "px";
  // ✅ MS-only: si hay imágenes lazy, al cargar cambian el layout -> recalculamos height
  // (solo una vez por "ciclo" de render)
  const imgs = mount.querySelectorAll("img");
  if (imgs && imgs.length) {
    let pending = 0;
    imgs.forEach((img) => {
      if (!img.complete) pending++;
    });

    if (pending) {
      let done = false;

      const bump = () => {
        if (done) return;
        // recalcula altura tras cargas; 2 raf para asegurar layout
        requestAnimationFrame(() => {
          inner.style.height = inner.scrollHeight + "px";
          requestAnimationFrame(() => {
            inner.style.height = inner.scrollHeight + "px";
          });
        });
      };

      const onImg = () => {
        pending--;
        bump();
        if (pending <= 0) {
          done = true;
        }
      };

      imgs.forEach((img) => {
        if (img.complete) return;
        img.addEventListener("load", onImg, { once: true });
        img.addEventListener("error", onImg, { once: true });
      });

      // safety: por si alguna imagen tarda demasiado o no dispara eventos
      setTimeout(bump, 250);
      setTimeout(bump, 600);
    }
  }

  // 2) Reintentos por imágenes/lazy layout
  setTimeout(() => { inner.style.height = inner.scrollHeight + "px"; }, 120);
  setTimeout(() => { inner.style.height = inner.scrollHeight + "px"; }, 320);

  // 3) Cuando termine la transición: auto (clave)
  inner.addEventListener("transitionend", function onEnd() {
    inner.removeEventListener("transitionend", onEnd);
    if (btn.getAttribute("aria-expanded") === "true") inner.style.height = "auto";
  });
});

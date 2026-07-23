(() => {
  const grid = document.getElementById("originalsDropGrid");

  if (!grid) return;

  const DATA_URL = "/assets/data/originals-drops.json";

  const escapeHtml = (value = "") =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const formatPrice = (value) => {
    const number = Number(value || 0);

    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }).format(number);
  };

  const renderPiece = (piece) => {
    const image = piece.image || "/assets/img/placeholder-product.png";
    const href = piece.href || "#";

    return `
      <article class="po-piece">
        <a class="po-piece__media" href="${escapeHtml(href)}" aria-label="${escapeHtml(piece.title)}">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(piece.title)}" loading="lazy">
          <span class="po-piece__tag">${escapeHtml(piece.tag || "Originals")}</span>
        </a>

        <div class="po-piece__body">
          <h3>
            <a href="${escapeHtml(href)}">${escapeHtml(piece.title)}</a>
          </h3>

          <p>${escapeHtml(piece.description)}</p>

          <div class="po-piece__meta">
            <span>${formatPrice(piece.price)}</span>
            <a href="${escapeHtml(href)}">Ver pieza</a>
          </div>
        </div>
      </article>
    `;
  };

  const loadDrop = async () => {
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`No se pudo cargar ${DATA_URL}`);
      }

      const data = await response.json();
      const pieces = data?.currentDrop?.pieces || [];

      if (!pieces.length) {
        grid.innerHTML = `
          <p class="po-empty">
            La próxima selección Prophetia Originals está en preparación.
          </p>
        `;
        return;
      }

      grid.innerHTML = pieces.map(renderPiece).join("");
    } catch (error) {
      console.error("[Prophetia Originals]", error);

      grid.innerHTML = `
        <p class="po-empty">
          No se ha podido cargar la selección actual.
        </p>
      `;
    }
  };

  loadDrop();
})();

/* =========================================================
   PROPHETIA ORIGINALS · BACKGROUND FX
   Light sweep editorial, ligero y sin WebGL
   ========================================================= */

(() => {
  const page = document.body;

  if (!page || !page.classList.contains("originals-page")) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const canvas = document.createElement("canvas");
  canvas.id = "poOriginalsFx";
  canvas.setAttribute("aria-hidden", "true");

  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });

  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = null;
  let stars = [];
  let sweeps = [];

  const rand = (min, max) => Math.random() * (max - min) + min;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    createScene();
  };

  const createScene = () => {
    const starCount = width < 720 ? 8 : 14;

    stars = Array.from({ length: starCount }, () => ({
      x: rand(width * 0.04, width * 0.96),
      y: rand(height * 0.12, height * 0.88),
      r: rand(0.7, 1.8),
      alpha: rand(0.16, 0.48),
      speed: rand(0.0012, 0.0038),
      phase: rand(0, Math.PI * 2),
      tint: Math.random() > 0.55 ? "pink" : "ice"
    }));

    sweeps = [
      {
        x: -width * 0.4,
        y: height * 0.72,
        w: width * 0.72,
        h: 2,
        speed: width < 720 ? 0.22 : 0.34,
        alpha: 0.16
      },
      {
        x: width * 0.15,
        y: height * 0.18,
        w: width * 0.48,
        h: 1,
        speed: width < 720 ? 0.12 : 0.20,
        alpha: 0.10
      }
    ];
  };

  const drawStar = (x, y, r, alpha, tint) => {
    const color =
      tint === "pink"
        ? `rgba(245,138,216,${alpha})`
        : `rgba(180,220,255,${alpha})`;

    ctx.save();
    ctx.translate(x, y);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    ctx.beginPath();

    ctx.moveTo(-r * 5.5, 0);
    ctx.lineTo(r * 5.5, 0);

    ctx.moveTo(0, -r * 5.5);
    ctx.lineTo(0, r * 5.5);

    ctx.moveTo(-r * 3.2, -r * 3.2);
    ctx.lineTo(r * 3.2, r * 3.2);

    ctx.moveTo(r * 3.2, -r * 3.2);
    ctx.lineTo(-r * 3.2, r * 3.2);

    ctx.stroke();
    ctx.restore();
  };

  const drawSweep = (sweep) => {
    const gradient = ctx.createLinearGradient(
      sweep.x,
      sweep.y,
      sweep.x + sweep.w,
      sweep.y
    );

    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.28, `rgba(245,138,216,${sweep.alpha})`);
    gradient.addColorStop(0.50, `rgba(245,245,239,${sweep.alpha * 1.8})`);
    gradient.addColorStop(0.72, `rgba(83,168,255,${sweep.alpha})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = gradient;
    ctx.shadowColor = "rgba(160,120,255,0.24)";
    ctx.shadowBlur = 18;
    ctx.fillRect(sweep.x, sweep.y, sweep.w, sweep.h);
    ctx.restore();

    sweep.x += sweep.speed;

    if (sweep.x > width + sweep.w * 0.25) {
      sweep.x = -sweep.w;
      sweep.y = rand(height * 0.15, height * 0.82);
    }
  };

  const frame = (time) => {
    ctx.clearRect(0, 0, width, height);

    ctx.globalCompositeOperation = "source-over";

    sweeps.forEach(drawSweep);

    stars.forEach((star, index) => {
      const pulse =
        0.58 + Math.sin(time * star.speed + star.phase + index) * 0.32;

      drawStar(
        star.x,
        star.y,
        star.r,
        Math.max(0.06, star.alpha * pulse),
        star.tint
      );
    });

    raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (prefersReducedMotion.matches) return;

    resize();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  };

  const stop = () => {
    cancelAnimationFrame(raf);
    raf = null;
    ctx.clearRect(0, 0, width, height);
  };

  window.addEventListener("resize", resize, { passive: true });

  prefersReducedMotion.addEventListener?.("change", () => {
    if (prefersReducedMotion.matches) {
      stop();
    } else {
      start();
    }
  });

  start();
})();

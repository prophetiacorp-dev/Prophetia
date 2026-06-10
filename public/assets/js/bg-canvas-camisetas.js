(() => {
  const BODY_CLASS = "camisetas-page";

  const throttle = (fn, wait = 350) => {
    let t = 0, timer = null;
    return (...args) => {
      const now = Date.now();
      if (now - t >= wait) { t = now; fn(...args); }
      else {
        clearTimeout(timer);
        timer = setTimeout(() => { t = Date.now(); fn(...args); }, wait);
      }
    };
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // --- Brush stamp (carbón) ---
  function makeCharcoalBrush(size = 220) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");

    // base: nube irregular
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);

    const r0 = size * 0.18;
    const r1 = size * 0.46;

    // mancha principal
    const g = ctx.createRadialGradient(0, 0, r0, 0, 0, r1);
 g.addColorStop(0.0, "rgba(0,0,0,0.34)");
g.addColorStop(0.5, "rgba(0,0,0,0.11)");
    g.addColorStop(1.0, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, r1, r1 * 0.78, rand(-0.6, 0.6), 0, Math.PI * 2);
    ctx.fill();

    // granos/splatter (carbón)
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 520; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.pow(Math.random(), 0.6) * (size * 0.48);
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr * 0.85;

      const dot = rand(0.6, 2.4);
      const op = rand(0.015, 0.065);
      ctx.fillStyle = `rgba(0,0,0,${op})`;
      ctx.beginPath();
      ctx.arc(x, y, dot, 0, Math.PI * 2);
      ctx.fill();
    }

    // desgaste (recortes) para borde irregular
    ctx.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = rand(size * 0.25, size * 0.52);
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr * 0.8;
      const cut = rand(6, 18);
      ctx.beginPath();
      ctx.arc(x, y, cut, 0, Math.PI * 2);
      ctx.fill();
    }

    return c;
  }
  // --- Paper editorial limpio ---
  function drawPaper(ctx, w, h) {
    ctx.fillStyle = "#e7e2d8";
    ctx.fillRect(0, 0, w, h);

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, "rgba(255,255,255,0.34)");
    g.addColorStop(0.22, "rgba(255,255,255,0.10)");
    g.addColorStop(1.0, "rgba(0,0,0,0.035)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // nubes de papel MUY suaves
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < 12; i++) {
      const rx = rand(w * 0.12, w * 0.32);
      const ry = rand(h * 0.05, h * 0.16);
      const x = rand(-rx * 0.2, w - rx * 0.8);
      const y = rand(-ry * 0.2, h - ry * 0.8);

      const rad = ctx.createRadialGradient(
        x + rx * 0.5, y + ry * 0.5, Math.min(rx, ry) * 0.12,
        x + rx * 0.5, y + ry * 0.5, Math.max(rx, ry) * 0.9
      );
      rad.addColorStop(0, `rgba(120,95,70,${rand(0.008, 0.022)})`);
      rad.addColorStop(1, "rgba(120,95,70,0)");
      ctx.fillStyle = rad;
      ctx.fillRect(x, y, rx, ry);
    }
    ctx.restore();

    // grain fino
    const noise = document.createElement("canvas");
    noise.width = noise.height = 220;
    const nctx = noise.getContext("2d");
    const img = nctx.createImageData(220, 220);
    const d = img.data;

    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 10;
    }
    nctx.putImageData(img, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.drawImage(noise, 0, 0, w, h);
    ctx.restore();

    // viñeta muy leve
    const v = ctx.createRadialGradient(
      w * 0.5, h * 0.42, Math.min(w, h) * 0.22,
      w * 0.5, h * 0.56, Math.max(w, h) * 0.90
    );
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.045)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  // --- Stroke field (stamping) ---
  function stampStroke(ctx, brush, x0, y0, x1, y1, baseSize, alpha, wiggle = 10) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(12, Math.floor(dist / 18));

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = alpha;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;

      // easing para que el trazo “apoye” y “levante”
      const press = Math.sin(Math.PI * t);
      const size = baseSize * (0.55 + press * 0.65) * rand(0.90, 1.12);

      const x = x0 + dx * t + rand(-wiggle, wiggle);
      const y = y0 + dy * t + rand(-wiggle, wiggle);

      // ligera rotación del sello
      const ang = Math.atan2(dy, dx) + rand(-0.25, 0.25);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);

      // smear: doble sello desplazado (arrastre)
      ctx.globalAlpha = alpha * rand(0.55, 0.95);
      ctx.drawImage(brush, -size * 0.5, -size * 0.34, size, size * 0.68);

      ctx.globalAlpha = alpha * rand(0.18, 0.35);
      ctx.drawImage(
        brush,
        -size * 0.5 + rand(-6, 8),
        -size * 0.34 + rand(-4, 10),
        size * rand(0.92, 1.08),
        size * 0.68 * rand(0.92, 1.10)
      );

      ctx.restore();
    }

    ctx.restore();
  }

   function drawCharcoalField(ctx, w, h) {
    const brush = makeCharcoalBrush(240);

    // diagonal más elegante y menos agresiva
    const baseAng = (-12 * Math.PI) / 180;

    const density = (w * h) / 320000;

    const softCount = Math.floor(clamp(density * 26, 16, 42));
    const midCount  = Math.floor(softCount * 0.28);
    const hardCount = Math.floor(softCount * 0.08);

    // CAPA SUAVE
    for (let i = 0; i < softCount; i++) {
      const x = rand(-w * 0.08, w * 1.08);
      const y = rand(-h * 0.08, h * 1.08);
      const len = rand(h * 0.14, h * 0.34);
      const ang = baseAng + rand(-0.10, 0.10);
      const x1 = x + Math.cos(ang) * len;
      const y1 = y + Math.sin(ang) * len;

      stampStroke(ctx, brush, x, y, x1, y1, rand(34, 70), rand(0.025, 0.060), 8);
    }

    // CAPA MEDIA
    for (let i = 0; i < midCount; i++) {
      const x = rand(-w * 0.06, w * 1.06);
      const y = rand(-h * 0.06, h * 1.06);
      const len = rand(h * 0.24, h * 0.58);
      const ang = baseAng + rand(-0.08, 0.08);
      const x1 = x + Math.cos(ang) * len;
      const y1 = y + Math.sin(ang) * len;

      stampStroke(ctx, brush, x, y, x1, y1, rand(42, 82), rand(0.032, 0.075), 5);
    }

    // CAPA OSCURA MUY ESCASA
    for (let i = 0; i < hardCount; i++) {
      const x = rand(-w * 0.04, w * 1.04);
      const y = rand(-h * 0.04, h * 1.04);
      const len = rand(h * 0.20, h * 0.52);
      const ang = baseAng + rand(-0.05, 0.05);
      const x1 = x + Math.cos(ang) * len;
      const y1 = y + Math.sin(ang) * len;

      stampStroke(ctx, brush, x, y, x1, y1, rand(80, 145), rand(0.055, 0.12), 6);
    }

    // micro rayitas muy sutiles
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = "rgba(0,0,0,0.045)";
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";

    for (let i = 0; i < 90; i++) {
      const x = rand(0, w);
      const y = rand(0, h);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rand(-14, 14), y + rand(-8, 8));
      ctx.stroke();
    }
    ctx.restore();
  }
  // Símbolos, MUY tenues (como “fantasma”)
  function drawSymbols(ctx, w, h) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
  ctx.strokeStyle = "rgba(0,0,0,0.035)";
ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const P = (x, y) => ({ x: x * w, y: y * h });

    // cruz arriba izq
    {
      const p = P(0.16, 0.20);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 26);
      ctx.lineTo(p.x, p.y + 26);
      ctx.moveTo(p.x - 20, p.y);
      ctx.lineTo(p.x + 20, p.y);
      ctx.stroke();
    }

    // reloj arena centro-dcha
    {
      const p = P(0.60, 0.36);
      const s = 26;
      ctx.beginPath();
      ctx.moveTo(p.x - s, p.y - s);
      ctx.lineTo(p.x + s, p.y + s);
      ctx.moveTo(p.x + s, p.y - s);
      ctx.lineTo(p.x - s, p.y + s);
      ctx.stroke();
    }

    // triángulos
    const tris = [P(0.86, 0.56), P(0.30, 0.80), P(0.90, 0.62)];
    ctx.lineWidth = 1.6;
    for (const p of tris) {
      const size = rand(18, 32);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - size);
      ctx.lineTo(p.x - size, p.y + size * 0.7);
      ctx.lineTo(p.x + size, p.y + size * 0.7);
      ctx.closePath();
      ctx.stroke();
    }

    // una “X” suave en medio
    {
      const p = P(0.68, 0.52);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p.x - 18, p.y - 18);
      ctx.lineTo(p.x + 18, p.y + 18);
      ctx.moveTo(p.x + 18, p.y - 18);
      ctx.lineTo(p.x - 18, p.y + 18);
      ctx.stroke();
    }

    ctx.restore();
  }

  function buildBackgroundDataURL() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);

    const cssW = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const cssH = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    const W = Math.round(cssW * dpr);
    const H = Math.round(cssH * 1.35 * dpr);

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;

    drawPaper(ctx, W, H);
    drawCharcoalField(ctx, W, H);
    

    // unifica (baja contraste general un pelín)
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#f6f1e8";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    ctx.save();
    const sheen = ctx.createLinearGradient(0, 0, W, H * 0.9);
    sheen.addColorStop(0, "rgba(255,255,255,0.10)");
    sheen.addColorStop(0.35, "rgba(255,255,255,0.00)");
    sheen.addColorStop(0.65, "rgba(255,255,255,0.04)");
    sheen.addColorStop(1, "rgba(255,255,255,0.00)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  function applyBackground() {
    const body = document.body;
    if (!body.classList.contains(BODY_CLASS)) return;

    const url = buildBackgroundDataURL();
    body.style.setProperty("--pp-canvas-bg", `url("${url}")`);
  }

  const boot = () => {
    applyBackground();
    window.addEventListener("resize", throttle(applyBackground, 400), { passive: true });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

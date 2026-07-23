/* =========================================================
   PROPHETIA · Streetwear Mujer Background FX
   - Movimiento sutil del halo premium
   - Sin canvas
   - Sin listeners pesados
   ========================================================= */

(() => {
  const body = document.body;

  if (!body.classList.contains("women-page") || !body.classList.contains("streetwear-page")) {
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    return;
  }

  let targetX = 68;
  let targetY = 24;
  let currentX = targetX;
  let currentY = targetY;
  let rafId = null;

  const updateTarget = (event) => {
    const x = (event.clientX / window.innerWidth) * 100;
    const y = (event.clientY / window.innerHeight) * 100;

    targetX = Math.max(12, Math.min(88, x));
    targetY = Math.max(10, Math.min(72, y));

    if (!rafId) {
      rafId = requestAnimationFrame(tick);
    }
  };

  const tick = () => {
    currentX += (targetX - currentX) * 0.055;
    currentY += (targetY - currentY) * 0.055;

    body.style.setProperty("--sw-mouse-x", `${currentX.toFixed(2)}%`);
    body.style.setProperty("--sw-mouse-y", `${currentY.toFixed(2)}%`);

    const dx = Math.abs(targetX - currentX);
    const dy = Math.abs(targetY - currentY);

    if (dx > 0.05 || dy > 0.05) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  };

  window.addEventListener("pointermove", updateTarget, { passive: true });
})();
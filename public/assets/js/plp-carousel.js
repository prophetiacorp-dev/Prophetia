(() => {
  const grid = document.getElementById("plp-grid");
  if (!grid) return;

  const svgLeft = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  const svgRight = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  function parseImages(card, imgEl){
    // 1) data-images='["url1","url2"]' en el card (ideal)
    const raw = card.getAttribute("data-images") || card.dataset.images;
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr.filter(Boolean);
      } catch {}
      // fallback: "url1|url2|url3"
      const arr = raw.split("|").map(s => s.trim()).filter(Boolean);
      if (arr.length) return arr;
    }

    // 2) fallback: img + data-alt-img en el propio img
    const alt = imgEl?.dataset?.altImg || imgEl?.getAttribute("data-alt-img");
    if (imgEl?.src && alt) return [imgEl.src, alt];

    // 3) si no hay nada, devolvemos 1 sola
    return imgEl?.src ? [imgEl.src] : [];
  }

  function ensureMediaWrap(card){
    // Queremos un wrapper NO-<a> para poder meter botones dentro legalmente
    let wrap = card.querySelector(".plp-media");
    if (wrap) return wrap;

    const media = card.querySelector(".card-media, .img-wrap, picture");
    if (!media) return null;

    wrap = document.createElement("div");
    wrap.className = "plp-media";
    media.parentNode.insertBefore(wrap, media);
    wrap.appendChild(media);
    return wrap;
  }

  function enhanceCard(card){
    if (card.__ppCarouselReady) return;

    const img = card.querySelector(".card-media img, .img-wrap img, picture img");
    if (!img) return;

    const images = parseImages(card, img);
    card.dataset.imgIndex = card.dataset.imgIndex || "0";
    card.dataset.images = JSON.stringify(images);
    card.classList.toggle("has-carousel", images.length > 1);

    const wrap = ensureMediaWrap(card);
    if (!wrap) return;

    const makeNav = (direction, svg, label) => {
      const existing =
        wrap.querySelector(`:scope > .nav.${direction}`) ||
        card.querySelector(`:scope > .nav.${direction}`) ||
        document.createElement("button");

      existing.type = "button";
      existing.className = `nav ${direction}`;
      existing.setAttribute("aria-label", label);
      if (!existing.innerHTML.trim()) existing.innerHTML = svg;
      return existing;
    };

    const prev = makeNav("prev", svgLeft, "Imagen anterior");
    const next = makeNav("next", svgRight, "Imagen siguiente");

    prev.hidden = images.length < 2;
    next.hidden = images.length < 2;

    if (prev.parentElement !== wrap) wrap.appendChild(prev);
    if (next.parentElement !== wrap) wrap.appendChild(next);

    card.querySelectorAll(".nav.prev").forEach((btn) => {
      if (btn !== prev) btn.remove();
    });
    card.querySelectorAll(".nav.next").forEach((btn) => {
      if (btn !== next) btn.remove();
    });

    card.__ppCarouselReady = true;
  }

  function scan(){
    grid.querySelectorAll(".card, .product-card").forEach(enhanceCard);
  }

  // Click handler (delegado)
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav.prev, .nav.next");

    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const card = btn.closest(".card, .product-card");
    const wrap = card?.querySelector(".plp-media");
    const img  = card?.querySelector(".card-media img, .img-wrap img, picture img");
    if (!card || !wrap || !img) return;

    let images = [];
    try { images = JSON.parse(card.dataset.images || "[]"); } catch {}
    if (!Array.isArray(images) || images.length < 2) return;

    let i = Number(card.dataset.imgIndex || "0");
    i = btn.classList.contains("prev")
      ? (i - 1 + images.length) % images.length
      : (i + 1) % images.length;

    img.src = images[i];
    card.dataset.imgIndex = String(i);
  });

  // Por si el grid se pinta después: MutationObserver
  const mo = new MutationObserver(scan);
  mo.observe(grid, { childList: true, subtree: true });
  scan();
})();

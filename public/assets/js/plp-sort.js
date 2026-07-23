(() => {
  const grid = document.querySelector("#plp-grid");
  const sortRoot = document.querySelector(".pp-sort");

  if (!grid || !sortRoot) return;

  function getCards(){
    return Array.from(grid.querySelectorAll(".card"));
  }

  function ensureOriginalOrder(){
    getCards().forEach((card, index) => {
      if (!card.dataset.originalIndex) {
        card.dataset.originalIndex = String(index);
      }
    });
  }

  function getCardTitle(card){
    return (
      card.querySelector(".card-title")?.textContent ||
      card.querySelector("[data-title]")?.dataset.title ||
      ""
    ).trim().toLowerCase();
  }

  function getCardPrice(card){
    const priceNode = card.querySelector(".price, .card-price, [data-price]");

    const raw = (
      priceNode?.dataset?.price ||
      priceNode?.textContent ||
      ""
    )
      .replace(/\s/g, "")
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3})/g, "")
      .replace(",", ".");

    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : 0;
  }

  function sortCards(mode){
    ensureOriginalOrder();

    const cards = getCards();

    cards.sort((a, b) => {
      if (mode === "price-asc") {
        return getCardPrice(a) - getCardPrice(b);
      }

      if (mode === "price-desc") {
        return getCardPrice(b) - getCardPrice(a);
      }

      if (mode === "name-asc") {
        return getCardTitle(a).localeCompare(getCardTitle(b), "es", {
          sensitivity: "base"
        });
      }

      return Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex);
    });

    const fragment = document.createDocumentFragment();
    cards.forEach(card => fragment.appendChild(card));
    grid.appendChild(fragment);
  }

  document.addEventListener("click", event => {
    const option = event.target.closest(".pp-sort-menu .pp-sort-option");

    if (!option || !sortRoot.contains(option)) return;

    event.preventDefault();

    const mode = option.dataset.sort || "relevance";

    sortCards(mode);

    sortRoot.querySelectorAll(".pp-sort-option").forEach(btn => {
      btn.classList.toggle("is-active", btn === option);
    });

    sortRoot.removeAttribute("open");
  });
})();
(() => {
  function initArchiveCarousels() {
    const carousels = document.querySelectorAll("[data-carousel]");

    carousels.forEach((carousel) => {
      const slides = Array.from(carousel.querySelectorAll(".archive-carousel__slide"));
      const prevBtn = carousel.querySelector("[data-prev]");
      const nextBtn = carousel.querySelector("[data-next]");

      if (!slides.length) return;

      if (slides.length === 1) {
        carousel.classList.add("is-single");
        slides[0].classList.add("is-active");
        slides[0].setAttribute("aria-hidden", "false");
        slides[0].removeAttribute("inert");
        return;
      }

      let current = slides.findIndex((slide) => slide.classList.contains("is-active"));
      if (current < 0) current = 0;

      function render(index) {
        slides.forEach((slide, i) => {
          const isActive = i === index;
          slide.classList.toggle("is-active", isActive);
          slide.setAttribute("aria-hidden", isActive ? "false" : "true");
          slide.toggleAttribute("inert", !isActive);
        });
      }

      render(current);

      prevBtn?.addEventListener("click", () => {
        current = (current - 1 + slides.length) % slides.length;
        render(current);
      });

      nextBtn?.addEventListener("click", () => {
        current = (current + 1) % slides.length;
        render(current);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initArchiveCarousels);
  } else {
    initArchiveCarousels();
  }
})();

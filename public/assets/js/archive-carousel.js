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
        return;
      }

      let current = slides.findIndex((slide) => slide.classList.contains("is-active"));
      if (current < 0) current = 0;

      function render(index) {
        slides.forEach((slide, i) => {
          slide.classList.toggle("is-active", i === index);
        });
      }

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
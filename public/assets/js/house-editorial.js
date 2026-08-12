(() => {
  const items = Array.from(document.querySelectorAll('[data-house-reveal]'));
  if (!items.length) return;

  const revealAll = () => items.forEach((item) => item.classList.add('is-revealed'));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.add('house-motion-ready');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealAll();
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, {
    rootMargin: '0px 0px -8% 0px',
    threshold: 0.1
  });

  items.forEach((item) => observer.observe(item));
})();

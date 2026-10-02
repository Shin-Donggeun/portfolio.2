// Reveal on scroll: each .reveal element gets .is-visible once it enters the viewport.
(function () {
  const els = document.querySelectorAll('.reveal');
  const show = el => el.classList.add('is-visible');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    els.forEach(show);
    return;
  }

  const inView = (el) => {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      show(entry.target);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.01 });

  // Whatever is already on screen is revealed right away (no waiting for the
  // first observer callback); the rest waits for the observer.
  const check = () => els.forEach(el => {
    if (el.classList.contains('is-visible')) return;
    if (inView(el)) {
      show(el);
      io.unobserve(el);
    }
  });

  check();
  els.forEach(el => { if (!el.classList.contains('is-visible')) io.observe(el); });
  window.addEventListener('load', check);
})();

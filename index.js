(function () {
  const outline = document.querySelector('nav .outline');
  const navLinks = document.querySelectorAll('nav a[href^="#"]');
  const sections = document.querySelectorAll('section[id]');

  // Nav click: eased scroll to the section. A new click or a manual
  // wheel/touch scroll cancels the running animation instead of fighting it.
  let scrollRun = 0;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function smoothScrollTo(targetY, duration) {
    const run = ++scrollRun;
    const startY = window.scrollY;
    const distance = targetY - startY;
    const startTime = performance.now();

    function step(now) {
      if (run !== scrollRun) return;
      const progress = Math.min(Math.max((now - startTime) / duration, 0), 1);
      window.scrollTo(0, startY + distance * easeInOutCubic(progress));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  ['wheel', 'touchstart'].forEach(type => {
    window.addEventListener(type, () => { scrollRun++; }, { passive: true });
  });

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      // offsetTop, not getBoundingClientRect: the reveal offset (translateY) must not shift the target.
      smoothScrollTo(id === '#first' ? 0 : target.offsetTop, 450);
    });
  });

  // Touch: tapping a link shows the expanded nav pill briefly (mouse uses :hover).
  let clearTimer = null;
  const scheduleClear = (delay = 220) => {
    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => outline.classList.remove('is-touch-active'), delay);
  };

  outline.querySelectorAll('a').forEach(link => {
    link.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      outline.classList.add('is-touch-active');
      scheduleClear(400);
    }, { passive: true });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
      link.addEventListener(type, (e) => {
        if (e.pointerType !== 'mouse') scheduleClear();
      }, { passive: true });
    });
  });

  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || outline.contains(e.target)) return;
    outline.classList.remove('is-touch-active');
    clearTimeout(clearTimer);
  }, { passive: true });

  // Highlight the nav link of the section closest to the viewport center.
  function setActiveNav() {
    const viewportCenter = window.innerHeight / 2;
    let closestId = null;
    let closestDistance = Infinity;

    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = section.id;
      }
    });

    navLinks.forEach(link => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${closestId}`);
    });
  }

  let navQueued = false;
  const queueActiveNav = () => {
    if (navQueued) return;
    navQueued = true;
    requestAnimationFrame(() => {
      navQueued = false;
      setActiveNav();
    });
  };

  window.addEventListener('scroll', queueActiveNav, { passive: true });
  window.addEventListener('resize', queueActiveNav);
  window.addEventListener('load', setActiveNav);
  setActiveNav();
})();

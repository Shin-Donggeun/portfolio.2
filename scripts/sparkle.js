// The sparkle: a four-pointed star with a small one close at its lower right
// (blue to violet, one gradient across both) that follows the mouse, a
// little below and to the right of the pointer, catching up with a slight
// lag. Over a link, a button or a project card it grows and twinkles once; a
// press sends a streak of white light across it; it fades out while the
// mouse is outside the window. Mouse only: none on touch screens or with reduced motion
// (styles/sparkle.css hides it there too). Never in the way of a click.

const OFFSET_X = 14;
const OFFSET_Y = 16;
const FOLLOW = 0.2; // share of the remaining distance covered each frame
const TARGETS = 'a, button, [role="button"], .card';

const offQuery = window.matchMedia('(hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)');

// Original stars: four points, the upright pair longer, sides curving in;
// the large one 22px tall, the small one 11px, close down and to its right.
// Over them, kept inside their outline, a band of white light waits off to
// the side for a press.
const BIG = 'M12 1 Q13.2 10.8 20 12 Q13.2 13.2 12 23 Q10.8 13.2 4 12 Q10.8 10.8 12 1 Z';
const SMALL = 'M21.5 16 Q22.1 20.9 25.5 21.5 Q22.1 22.1 21.5 27 Q20.9 22.1 17.5 21.5 Q20.9 20.9 21.5 16 Z';
const STAR = `
  <svg class="sparkleStar" viewBox="0 0 28 28" focusable="false">
    <defs>
      <linearGradient id="sparkleFill" gradientUnits="userSpaceOnUse" x1="4" y1="1" x2="25.5" y2="27">
        <stop offset="0" />
        <stop offset="1" />
      </linearGradient>
      <linearGradient id="sparkleShineFill">
        <stop offset="0" stop-color="#fff" stop-opacity="0" />
        <stop offset=".5" stop-color="#fff" stop-opacity=".95" />
        <stop offset="1" stop-color="#fff" stop-opacity="0" />
      </linearGradient>
      <clipPath id="sparkleClip"><path d="${BIG}" /><path d="${SMALL}" /></clipPath>
    </defs>
    <path class="sparklePart" fill="url(#sparkleFill)" d="${BIG}" />
    <path class="sparklePart" fill="url(#sparkleFill)" d="${SMALL}" />
    <g clip-path="url(#sparkleClip)">
      <g transform="rotate(45 14 14)">
        <rect class="sparkleShine" x="-16" y="-14" width="10" height="56" fill="url(#sparkleShineFill)" />
      </g>
    </g>
  </svg>`;

const sparkle = document.createElement('span');
sparkle.className = 'sparkle';
sparkle.setAttribute('aria-hidden', 'true');
sparkle.innerHTML = `<span class="sparkleScale">${STAR}</span>`;
const star = sparkle.querySelector('.sparkleStar');
const shine = sparkle.querySelector('.sparkleShine');
const parts = sparkle.querySelectorAll('.sparklePart');

let x = 0;
let y = 0;
let toX = 0;
let toY = 0;
let frame = 0;
let placed = false;
let over = null; // the link, button or card under the pointer

function place() {
  sparkle.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

// Move a share of the way each frame; stop once caught up.
function follow() {
  x += (toX - x) * FOLLOW;
  y += (toY - y) * FOLLOW;
  if (Math.abs(toX - x) < 0.1 && Math.abs(toY - y) < 0.1) {
    x = toX;
    y = toY;
    frame = 0;
  } else {
    frame = requestAnimationFrame(follow);
  }
  place();
}

function onMove(event) {
  if (event.pointerType === 'touch') return;
  toX = event.clientX + OFFSET_X;
  toY = event.clientY + OFFSET_Y;
  if (!placed) {
    // The first move: start right there rather than fly in from a corner.
    placed = true;
    x = toX;
    y = toY;
    place();
  }
  sparkle.classList.add('shown');
  if (!frame) frame = requestAnimationFrame(follow);
}

// Over something to press: grow, and twinkle once (a flash, each star
// turning on its own centre, the small one a moment later); again only
// after leaving it.
function onOver(event) {
  const target = event.target.closest?.(TARGETS) ?? null;
  if (target === over) return;
  over = target;
  sparkle.classList.toggle('over', Boolean(target));
  if (target) {
    star.animate([
      { filter: 'brightness(1)' },
      { filter: 'brightness(1.8)', offset: 0.45 },
      { filter: 'brightness(1)' },
    ], { duration: 500, easing: 'ease-out' });
    // A full turn: the gradient turns with each star, so it ends as it began.
    parts.forEach((part, i) => part.animate([
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(360deg)' },
    ], { duration: 520 - i * 80, delay: i * 80, easing: 'ease-out' }));
  }
}

// A press: the white band sweeps across the stars, top left to bottom right.
function onDown(event) {
  if (event.pointerType === 'touch') return;
  shine.animate([
    { transform: 'translateX(0)' },
    { transform: 'translateX(52px)' },
  ], { duration: 900, easing: 'ease-in-out' });
}

// The mouse left the window (no element to go to): fade out until it is back.
function onOut(event) {
  if (!event.relatedTarget) sparkle.classList.remove('shown');
}

function start() {
  document.body.append(sparkle);
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerover', onOver, { passive: true });
  document.addEventListener('pointerdown', onDown, { passive: true });
  document.addEventListener('mouseout', onOut, { passive: true });
}

function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
  placed = false;
  over = null;
  sparkle.classList.remove('shown', 'over');
  sparkle.remove();
  window.removeEventListener('pointermove', onMove);
  document.removeEventListener('pointerover', onOver);
  document.removeEventListener('pointerdown', onDown);
  document.removeEventListener('mouseout', onOut);
}

if (!offQuery.matches) start();
offQuery.addEventListener('change', () => (offQuery.matches ? stop() : start()));

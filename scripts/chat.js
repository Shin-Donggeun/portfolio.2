// The conversation: turns that play in one by one, the "thinking" glow, the
// hero input that types itself, case studies that open in place, the
// conversation list (scroll spy, phone drawer) and links by hash.
//
// Everything is in the HTML from the start; this only stages it. Turns play
// as they reach the middle of the screen; the conversation already passed
// (jumped over, flown past, or scrolled back to) is simply there.

const calmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const calm = () => calmQuery.matches;

// Coming back to the page (typing its address again, reloading) starts at
// the top, not where the browser last left off.
history.scrollRestoration = 'manual';

// The old site's section anchors (index.html#second, ...): browsers offer
// them back from history when the address is typed, so they lead to the top.
const oldAnchors = new Set(['first', 'second', 'third', 'fourth', 'experience']);

// The address stays plain: a link with a hash (a project, a section) is
// followed once, then the hash is cleared, so the browser never offers the
// address back with one.
const clearHash = () => {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
};

const hero = document.querySelector('.hero');
const heroBox = document.getElementById('heroComposer');
const heroText = document.getElementById('heroText');
const heroLine = heroText.textContent;
let typingTimer = 0;


/* Glow: a streak running along a border (styles/chat.css). Each .glow gets
   its border light and soft halo: a chain of soft beads following the border
   path, sized to the element (kept in fit as it resizes); while "thinking"
   it plays on one element at a time, never longer than 2 s. */

const BEADS = 30;
const TAIL = 0.39; // streak length, as a share of the border
const HEAD_AT = 0.3; // where the head rests while the streak is still
const BLUE = [79, 124, 255];
const VIOLET = [139, 92, 246];

// Colour along the streak, p = 0 at the tail end, 1 at the head tip:
// clear to blue, blue to violet, then fading out at the very head.
function streakColor(p) {
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const [rgb, alpha] = p < 0.45 ? [BLUE, p / 0.45]
    : p < 0.88 ? [mix(BLUE, VIOLET, (p - 0.45) / 0.43), 1]
      : [VIOLET, (1 - p) / 0.12];
  return `rgb(${rgb.join(' ')} / ${(alpha * 0.6).toFixed(3)})`; // beads overlap about 3 deep
}

function glowLayer(name) {
  const layer = document.createElement('span');
  layer.className = name;
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < BEADS; i++) {
    // Where the bead starts, as a share of a lap (0 to 1, so its delay is never positive).
    const phase = (HEAD_AT - (i * TAIL) / (BEADS - 1) + 1) % 1;
    const bead = document.createElement('span');
    bead.className = 'glowBead';
    bead.style.setProperty('--c', streakColor(1 - i / (BEADS - 1)));
    bead.style.setProperty('--at', `${(phase * 100).toFixed(2)}%`);
    bead.style.setProperty('--lag', `calc(var(--glow-lap) * ${(-phase).toFixed(4)})`);
    layer.append(bead);
  }
  return layer;
}

// The path's corners and the beads' length (about three beads overlap).
function fitGlow(el) {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (!w || !h) return;
  const style = getComputedStyle(el);
  const radii = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius']
    .map((corner) => Math.min(parseFloat(style[corner]) || 0, w / 2, h / 2));
  const border = 2 * (w + h) + radii.reduce((sum, r) => sum + r * (Math.PI / 2 - 2), 0);
  el.style.setProperty('--glow-radius', radii.map((r) => `${r}px`).join(' '));
  el.style.setProperty('--bead-len', `${((3 * TAIL * border) / (BEADS - 1)).toFixed(1)}px`);
}

const glowFit = new ResizeObserver((entries) => entries.forEach(({ target }) => fitGlow(target)));
document.querySelectorAll('.glow').forEach((el) => {
  el.append(glowLayer('glowRing'), glowLayer('glowHalo'));
  glowFit.observe(el);
});

let glowing = null;
let glowTimer = 0;

function glow(el, ms) {
  if (calm()) return;
  stopGlow();
  glowing = el;
  el.classList.add('glowing');
  glowTimer = setTimeout(stopGlow, Math.min(ms, 2000));
}

function stopGlow(el = glowing) {
  if (!el || el !== glowing) return;
  clearTimeout(glowTimer);
  glowing.classList.remove('glowing');
  glowing = null;
}


/* Turns, like a chat: empty until the turn reaches the middle of the screen,
   then the question is sent, the assistant types, and the answer arrives
   piece by piece. Turns already scrolled past simply show (chat history). */

const turns = [...document.querySelectorAll('.turn')];
const SEND_MS = 450; // question bubble, then the typing dots
const THINK_MS = 2250; // typing dots, then the answer

// The pieces an answer arrives in, in order: its blocks, with lists and
// cards split into their items.
function pieces(answer) {
  const out = [];
  const walk = (el) => {
    if (el.matches('.workGroup')) [...el.children].forEach(walk);
    else if (el.matches('.cards')) out.push(...el.querySelectorAll(':scope > .card'));
    else if (el.matches('.meanings, .contactList, .facts')) out.push(...el.children);
    else out.push(el);
  };
  [...answer.children].forEach(walk);
  return out;
}

for (const turn of turns) {
  pieces(turn.querySelector('.answer')).forEach((piece, i) => {
    piece.classList.add('unit');
    piece.style.setProperty('--i', i);
  });
  turn.classList.add('staged');
}

function settle(turn, { instant = false } = {}) {
  if (turn.classList.contains('done')) return;
  stopGlow(turn.querySelector('.typing'));
  turn.classList.toggle('instant', instant);
  turn.classList.remove('asked', 'thinking');
  turn.classList.add('done');
  turn.dispatchEvent(new Event('settled'));
}

function play(turn) {
  if (turn.classList.contains('done') || turn.classList.contains('asked')) return;
  turn.classList.add('asked');
  setTimeout(() => {
    if (turn.classList.contains('done')) return;
    turn.classList.add('thinking');
    glow(turn.querySelector('.typing'), THINK_MS);
    setTimeout(() => settle(turn), THINK_MS);
  }, SEND_MS);
}

// A turn reaching the middle of the screen plays; one already above the
// screen (scrolled past fast, or the page opened further down) just shows.
function start(turn) {
  if (calm() || turn.getBoundingClientRect().bottom < 0) settle(turn, { instant: true });
  else play(turn);
}

function catchUp() {
  for (const turn of turns) {
    if (!turn.classList.contains('done') && turn.getBoundingClientRect().bottom < 0) settle(turn, { instant: true });
  }
}

// Reduced motion: the whole conversation is simply there (and the hero has
// its line written in, without typing).
const showAll = () => turns.forEach((turn) => turn.classList.add('done', 'instant'));
if (calm()) showAll();

const turnWatcher = new IntersectionObserver((entries) => {
  for (const entry of entries) if (entry.isIntersecting) start(entry.target);
}, { rootMargin: '0px 0px -45% 0px' });
turns.forEach((turn) => turnWatcher.observe(turn));

calmQuery.addEventListener('change', () => {
  if (!calm()) return;
  stopTyping();
  heroText.textContent = heroLine;
  showAll();
  stopGlow();
});

// Printing shows the whole conversation (CSS opens every case; load their images).
window.addEventListener('beforeprint', () => {
  turns.forEach((turn) => settle(turn, { instant: true }));
  document.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
});


/* 러닝머신 → 머신러닝: the closing line under the meanings. Its word first
   reads 러닝머신, then the two halves swap places (0.6 s, arcing past each
   other), once, when the line is in view and has arrived; then it lights up
   with the glow gradient (.lit). The HTML holds the final word in order
   (머신, 러닝): until the swap, each half is only shifted into the other's
   place. Reduced motion: no swap, the word simply lit. */

const swapWord = document.querySelector('.swapWord');
const [swapFront, swapBack] = swapWord.querySelectorAll('.swapHalf');
const swapTurn = swapWord.closest('.turn');
const SWAP_MS = 600;
let swapSeen = false;
let swapPlayed = false;

function holdSwap() {
  if (swapPlayed || calm()) return;
  swapFront.style.transform = `translateX(${swapBack.offsetWidth}px)`;
  swapBack.style.transform = `translateX(${-swapFront.offsetWidth}px)`;
}

// The swap is over: one plain word again (the gradient fills its letters),
// lit up.
function lightSwap() {
  swapPlayed = true;
  swapWord.textContent = swapWord.textContent;
  swapWord.classList.add('lit');
}

function trySwap() {
  if (swapPlayed || !swapSeen || !swapTurn.classList.contains('done')) return;
  swapPlayed = true;
  // Let the line arrive first (its turn in the answer's reveal), then a beat.
  const line = swapWord.closest('.unit');
  const arriving = swapTurn.classList.contains('instant') ? 300
    : (parseFloat(line?.style.getPropertyValue('--i')) || 0) * 110 + 900;
  setTimeout(() => {
    const moves = [[swapFront, swapBack.offsetWidth, -0.4], [swapBack, -swapFront.offsetWidth, 0.4]].map(([half, dx, lift]) => {
      half.style.transform = '';
      const frames = Array.from({ length: 9 }, (_, k) => {
        const t = k / 8;
        return { transform: `translate(${dx * (1 - t)}px, ${lift * Math.sin(Math.PI * t)}em)` };
      });
      return half.animate(frames, { duration: SWAP_MS, easing: 'cubic-bezier(.65, 0, .35, 1)' }).finished;
    });
    Promise.all(moves).finally(lightSwap);
  }, arriving);
}

if (calm()) lightSwap();
holdSwap();
document.fonts?.ready.then(holdSwap);
window.addEventListener('resize', holdSwap);
new IntersectionObserver((entries, observer) => {
  if (!entries.some((entry) => entry.isIntersecting)) return;
  swapSeen = true;
  observer.disconnect();
  trySwap();
}, { threshold: 1 }).observe(swapWord);
swapTurn.addEventListener('settled', trySwap);
calmQuery.addEventListener('change', () => { if (calm()) lightSwap(); });


/* Hero: an input-like box (not a real input) where its line types itself in
   once, on landing, its gradient border turning. Scrolling down, the hero
   stays in place and fades out with the scroll. */

function stopTyping() {
  clearTimeout(typingTimer);
  heroBox.classList.remove('writing');
}

if (!calm()) {
  heroText.textContent = '';
  typingTimer = setTimeout(() => {
    heroBox.classList.add('writing');
    let length = 0;
    const type = () => {
      heroText.textContent = heroLine.slice(0, ++length);
      if (length < heroLine.length) typingTimer = setTimeout(type, 110);
      else heroBox.classList.remove('writing');
    };
    type();
  }, 500);
}

// --leave: 0 at the top, 1 once the hero is half scrolled away (eased out).
// The border keeps turning until the hero is mostly gone.
function heroLeave() {
  const progress = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * 0.5)));
  const leave = 1 - (1 - progress) ** 2;
  hero.style.setProperty('--leave', leave.toFixed(3));
  hero.classList.toggle('gone', leave === 1);
  heroBox.classList.toggle('spinning', leave < 0.9);
}


/* Scrolling: page by page, gliding with an ease-in-out. With a mouse or
   trackpad (and the keyboard), a scroll past a little moves on to the next
   screen, the top or a turn; a turn taller than the screen first scrolls
   freely inside. Touch screens keep the browser's own snapping
   (styles/chat.css), and reduced motion plain scrolling. Jumps by link and
   case studies opening glide the same way. */

const root = document.documentElement;
const fineQuery = window.matchMedia('(pointer: fine)');
const paged = () => fineQuery.matches && !calm();
const GLIDE_MS = 800; // gliding one screen; shorter hops are quicker, longer jumps slower
const NUDGE = 50; // px of wheel that moves on a page
const QUIET_MS = 200; // a wheel gesture ends after this long without events

const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

let glide = 0; // animation frame of a glide in progress
let glideTo = 0;

function stopGlide() {
  cancelAnimationFrame(glide);
  glide = 0;
  root.classList.remove('gliding');
}

function scrollToY(y, { smooth = true } = {}) {
  stopGlide();
  const max = root.scrollHeight - window.innerHeight;
  const to = Math.round(Math.min(max, Math.max(0, y)));
  const from = window.scrollY;
  if (!smooth || calm() || Math.abs(to - from) < 2) {
    window.scrollTo({ top: to, behavior: 'instant' });
    return;
  }
  const ms = Math.min(1400, GLIDE_MS * Math.max(0.6, Math.sqrt(Math.abs(to - from) / window.innerHeight)));
  const start = performance.now();
  let last = from;
  glideTo = to;
  root.classList.add('gliding'); // the browser's snapping waits meanwhile
  const step = (now) => {
    // Something else scrolled (a scrollbar drag, find in page): let it.
    if (Math.abs(window.scrollY - last) > 2) {
      stopGlide();
      return;
    }
    const t = Math.min(1, (now - start) / ms);
    last = Math.round(from + (to - from) * ease(t));
    window.scrollTo({ top: last, behavior: 'instant' });
    if (t < 1) glide = requestAnimationFrame(step);
    else stopGlide();
  };
  glide = requestAnimationFrame(step);
}

// Where a box sits once scrolled to: at the top of the screen, less its
// scroll margin (the phone's top bar, a card's breathing room).
const scrollMargin = (el) => parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
const topOf = (el) => el.getBoundingClientRect().top + window.scrollY - scrollMargin(el);

// The screens: the top and each turn, each from where it starts to where it
// ends (a turn taller than the screen: its bottom at the bottom of the screen).
function screens() {
  const max = root.scrollHeight - window.innerHeight;
  const tops = turns.map((turn) => turn.getBoundingClientRect().top + window.scrollY);
  const starts = [0, ...turns.map((turn, i) => tops[i] - scrollMargin(turn))].map((y) => Math.min(max, y));
  return starts.map((start, i) => ({
    start,
    end: Math.max(start, i < turns.length ? Math.min(max, tops[i] - window.innerHeight) : max),
  }));
}

const screenAt = (all, y) => all.findLast((screen) => screen.start <= y + 1) ?? all[0];

// Where to go from y in a direction: the next screen's start (or a tall
// one's end, coming from below). Inside a tall turn, moving inward: nowhere
// (null); the page scrolls as usual.
function nextStop(y, dir, all = screens()) {
  const here = screenAt(all, y);
  const tall = here.end > here.start;
  if (tall && y <= here.end + 1 && (dir > 0 ? y < here.end - 1 : y > here.start + 1)) return null;
  const stops = all.flatMap(({ start, end }) => [start, end]);
  return dir > 0 ? stops.find((stop) => stop > y + 1) : stops.findLast((stop) => stop < y - 1);
}

let nudge = 0;
let lastWheel = 0;
let quietUntil = 0;

window.addEventListener('wheel', (event) => {
  if (!paged() || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  if (event.target.closest('.sidebar')) return;
  const now = performance.now();
  // During a glide, and for the rest of the gesture that started it (a
  // trackpad's momentum), the wheel waits.
  if (glide || now < quietUntil) {
    event.preventDefault();
    quietUntil = now + QUIET_MS;
    return;
  }
  if (now - lastWheel > QUIET_MS) nudge = 0;
  lastWheel = now;
  const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
  const dir = Math.sign(dy);
  const y = window.scrollY;
  const all = screens();
  const stop = nextStop(y, dir, all);
  if (stop === null) {
    // Inside a tall turn: as usual, but stop at its edge.
    const { start, end } = screenAt(all, y);
    const edge = dir > 0 ? end : start;
    if (dir > 0 ? y + dy > edge : y + dy < edge) {
      event.preventDefault();
      scrollToY(edge);
      quietUntil = now + QUIET_MS;
    }
    return;
  }
  event.preventDefault();
  nudge += dy;
  if (Math.abs(nudge) < NUDGE || stop === undefined) return;
  nudge = 0;
  scrollToY(stop);
}, { passive: false });

const pageKeys = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1, Home: -Infinity, End: Infinity };

document.addEventListener('keydown', (event) => {
  const dir = event.key === ' ' && event.shiftKey ? -1 : pageKeys[event.key];
  if (!paged() || !dir || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.closest('input, textarea, select, video, [contenteditable], .sidebar')) return;
  if (event.key === ' ' && event.target.closest('a, button')) return; // Space presses it
  if (!Number.isFinite(dir)) {
    event.preventDefault();
    scrollToY(dir);
    return;
  }
  // Pressed again mid-glide: go on from where it was heading.
  const stop = nextStop(glide ? glideTo : window.scrollY, dir);
  if (stop === null) return;
  event.preventDefault();
  if (stop !== undefined) scrollToY(stop);
});

const markPaged = () => root.classList.toggle('paged', paged());
fineQuery.addEventListener('change', markPaged);
calmQuery.addEventListener('change', markPaged);
markPaged();


/* Work: each card opens its case study right below it, one at a time. */

const cards = [...document.querySelectorAll('button.card')];
const caseOf = (card) => document.getElementById(card.getAttribute('aria-controls'));
const cardOf = (box) => document.querySelector(`[aria-controls="${box.id}"]`);
const isOpen = (card) => card.getAttribute('aria-expanded') === 'true';

function openCase(card, { scroll = true } = {}) {
  cards.forEach((other) => { if (other !== card) closeCase(other, { scroll: false }); });
  caseOf(card).removeAttribute('hidden');
  card.setAttribute('aria-expanded', 'true');
  if (scroll) scrollToY(topOf(card));
}

function closeCase(card, { scroll = true } = {}) {
  if (!isOpen(card)) return;
  // until-found: the browser's find in page still finds (and opens) it.
  caseOf(card).setAttribute('hidden', 'until-found');
  card.setAttribute('aria-expanded', 'false');
  // Folding from the bottom of a long case: bring its card back into view.
  if (scroll && card.getBoundingClientRect().top < 0) {
    scrollToY(topOf(card));
  }
}

for (const card of cards) {
  card.addEventListener('click', () => (isOpen(card) ? closeCase(card) : openCase(card)));
  caseOf(card).addEventListener('beforematch', () => openCase(card, { scroll: false }));
}

document.querySelectorAll('[data-fold]').forEach((button) => {
  button.addEventListener('click', () => {
    const card = cardOf(button.closest('.case'));
    closeCase(card);
    card.focus({ preventScroll: true });
  });
});

// A tap on the empty space around an open case (anything but the case, a
// link or a button, while it is on screen) folds it too. Selecting text
// does not.
document.addEventListener('click', (event) => {
  const card = cards.find(isOpen);
  if (!card || event.defaultPrevented || !window.getSelection().isCollapsed) return;
  if (event.target.closest('a, button, input, label, video, .case, .closing, .sidebar, .topBar, .scrim')) return;
  const onScreen = card.getBoundingClientRect().top < window.innerHeight
    && caseOf(card).getBoundingClientRect().bottom > 0;
  if (onScreen) closeCase(card);
});

// Videos play only while they are on screen (their case open); with
// reduced motion they get controls instead of playing by themselves.
const videos = [...document.querySelectorAll('.videos video')];
const videoWatcher = new IntersectionObserver((entries) => {
  for (const { target, isIntersecting } of entries) {
    if (isIntersecting && !calm()) target.play().catch(() => {});
    else target.pause();
  }
}, { rootMargin: '200px 0px' });
videos.forEach((video) => {
  if (calm()) video.controls = true;
  videoWatcher.observe(video);
});


/* Going to a hash: everything up to it shows at once; a project opens. */

function goTo(hash, { smooth = true, landing = false } = {}) {
  let id = decodeURIComponent(hash.replace(/^#/, ''));
  clearHash();
  if (!id) return;
  if (oldAnchors.has(id)) id = 'top';
  const target = document.getElementById(id);
  if (!target) return;
  if (id === 'top') {
    scrollToY(0, { smooth });
  } else {
    // The conversation before the target is history: it shows at once. A
    // turn jumped to plays as it arrives; a project shows straight away.
    const turn = target.closest('.turn');
    if (turn) {
      const upTo = turns.indexOf(turn) + (target === turn ? 0 : 1);
      turns.slice(0, upTo).forEach((t) => settle(t, { instant: true }));
    }
    if (cards.includes(target)) openCase(target, { scroll: false });
    scrollToY(topOf(target), { smooth });
  }
  // Opening the page on a hash: the browser already starts keyboard
  // navigation there; no focus ring before any input (it would also focus
  // a card by itself).
  if (landing) {
    if (document.activeElement === target) target.blur();
    return;
  }
  // Keyboard and screen reader users continue from where they landed.
  const focusTarget = cards.includes(target) ? target
    : id === 'top' ? document.getElementById('heroTitle')
      : target.querySelector('h2') ?? target;
  if (!focusTarget.matches('a, button, input')) focusTarget.setAttribute('tabindex', '-1');
  focusTarget.focus({ preventScroll: true });
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
  event.preventDefault();
  closeDrawer({ returnFocus: false });
  goTo(link.getAttribute('href'));
});

window.addEventListener('hashchange', () => goTo(location.hash));

if (location.hash) {
  // Wait one frame so the browser's own jump to the hash doesn't fight ours.
  requestAnimationFrame(() => goTo(location.hash, { smooth: false, landing: true }));
}


/* Conversation list: highlight what is on screen. */

const links = [...document.querySelectorAll('.chatLink')];
const linkFor = (id) => links.find((link) => link.getAttribute('href') === `#${id}`);
let activeLinks = [];

const allCards = [...document.querySelectorAll('#work .card')];

// The card being read: an open case under the line wins; otherwise the last
// card whose top has passed the line (the left one of a row).
function cardAt(line) {
  const open = cards.find(isOpen);
  if (open) {
    const box = caseOf(open).getBoundingClientRect();
    if (open.getBoundingClientRect().top <= line && box.bottom >= line) return open;
  }
  let found = null;
  let foundTop = -Infinity;
  for (const card of allCards) {
    const top = card.getBoundingClientRect().top;
    if (top <= line && top > foundTop + 2) {
      found = card;
      foundTop = top;
    }
  }
  return found;
}

function spy() {
  const line = window.innerHeight * 0.35;
  const turn = turns.filter((el) => el.getBoundingClientRect().top <= line).pop();
  const card = turn?.id === 'work' ? cardAt(line) : null;
  const next = [turn && linkFor(turn.id), card && linkFor(card.id)].filter(Boolean);
  if (next.length === activeLinks.length && next.every((link, i) => link === activeLinks[i])) return;
  activeLinks.forEach((link) => { link.classList.remove('active'); link.removeAttribute('aria-current'); });
  next.forEach((link) => { link.classList.add('active'); link.setAttribute('aria-current', 'true'); });
  activeLinks = next;
}

let scrollQueued = false;
window.addEventListener('scroll', () => {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    heroLeave();
    catchUp();
    spy();
  });
}, { passive: true });
window.addEventListener('resize', spy);
heroLeave();
catchUp();
spy();


/* Phones: the conversation list is a drawer. */

const phone = window.matchMedia('(max-width: 767.98px)');
const sidebar = document.getElementById('sidebar');
const menuButton = document.getElementById('menuButton');
const closeButton = document.getElementById('closeButton');
const scrim = document.getElementById('scrim');
const behindDrawer = [document.querySelector('.topBar'), document.querySelector('main')];

function setDrawer(open, { returnFocus = true } = {}) {
  sidebar.classList.toggle('open', open);
  scrim.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  sidebar.inert = phone.matches && !open;
  behindDrawer.forEach((el) => { el.inert = open; });
  if (open) sidebar.querySelector('.chatLink').focus();
  else if (returnFocus) menuButton.focus();
}

function closeDrawer(options) {
  if (sidebar.classList.contains('open')) setDrawer(false, options);
}

menuButton.addEventListener('click', () => setDrawer(true));
closeButton.addEventListener('click', () => setDrawer(false));
scrim.addEventListener('click', () => setDrawer(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDrawer();
});
phone.addEventListener('change', () => {
  if (!phone.matches) closeDrawer({ returnFocus: false });
  sidebar.inert = phone.matches && !sidebar.classList.contains('open');
});
sidebar.inert = phone.matches;


/* Closing: the last turn and the closing box share the last screen, and the
   box floats at the bottom like a chat input; the CSS sizes the last turn
   from the box's height, and every turn's bottom room from the floating
   input's (with its 24px gap). */

const closing = document.querySelector('.closing');
const dock = closing.querySelector('.composer');

// Set at once too, so a page opened on a link already has its final layout.
function fitDock() {
  root.style.setProperty('--closing-height', `${closing.offsetHeight}px`);
  root.style.setProperty('--dock-height', `${dock.offsetHeight + 24}px`);
}

fitDock();
new ResizeObserver(fitDock).observe(closing);


/* Contact: the e-mail address copies itself, with a short note after it. */

const mailCopy = document.getElementById('mailCopy');
const mailCopyNote = document.getElementById('mailCopyNote');
let copyNoteTimer = 0;

mailCopy.addEventListener('click', async () => {
  let copied = true;
  try {
    await navigator.clipboard.writeText(mailCopy.dataset.copy);
  } catch {
    copied = false; // no clipboard here (or not allowed)
  }
  mailCopyNote.textContent = copied ? '복사했어요' : '복사하지 못했어요'; // TODO: copy
  clearTimeout(copyNoteTimer);
  copyNoteTimer = setTimeout(() => { mailCopyNote.textContent = ''; }, 2000);
});


window.chatReady = true;

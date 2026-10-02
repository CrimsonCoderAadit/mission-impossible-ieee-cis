import { CONFIG } from './config.js';

const FRAME_STEPS = [8, 4, 1];
const PHASE_SEPARATOR = ' · ';
const REVEAL_STAGGER_MS = 30;
const REVEAL_STAGGER_MAX = 8;
const REVEAL_TARGETS = [
  '.briefing-stats',
  '.phase', '.transmission',
  '.leak-card', '#leaks .small-print',
  '.prize-list', '.participation',
  '.criterion', '.manual-spec', '.manual-side'
].join(', ');
const TOPBAR_SCROLLED_PX = 24;
const DESCENT_END = 0.30;
const INFILTRATION_END = 0.70;
const CROSSFADE_CENTER = 0.72;
const CROSSFADE_WIDTH = 0.08;
const WINDOW_FRAMES = 25;
const CIPHER_GLYPHS = '▓▒░█▚▞ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FRAME_TARGETS = '.card, .transmission, .briefing-stats, .prize-list, .rulebook-download, .timeline-panel';
const ENTRY_MARGIN = '0px 0px -12% 0px';
const EDGE_SWEEP_MS = 700;
const EYEBROW_DECRYPT_MS = 400;
const TIMELINE_MIN_BLOCK_PX = 72;
const TIMELINE_DESC_GAP_PX = 16;
const TIMELINE_LIVE_MS = 30000;
const CAMERA_PUSH = 0.06;
const CAMERA_STEPS = 3000;
const CUT_MS = 250;
const CUT_GHOST_SCALE = 0.25;
const CUT_STILL_SCALE = 0.5;
const INTRO_KEY = 'mi-intro-seen';
const INTRO_DECRYPT_MS = 500;
const INTRO_STRIKE_AT = 650;
const INTRO_IGNITE_AT = 850;
const INTRO_CUT_AT = 1520;
const INTRO_END_AT = 1800;
const INTRO_LATE_MS = 3000;
const FUSE_QUERY = '(min-width: 48rem)';
const FUSE_IGNITE_AT = 0.998;
const FUSE_RESET_AT = 0.97;
const FUSE_JUMP_MS = 420;
const IGNITE_MS = 1400;
const HEAT_SPEED = 3;
const HEAT_SMOOTHING_MS = 120;
const ATMOSPHERE_MAX = 120;
const ATMOSPHERE_EMBERS = 14;
const ATMOSPHERE_AREA_PER_DROP = 18000;
const ATMOSPHERE_BOOST = 3;
const LASER_FLASH_MS = 200;
const RETICLE_FOLLOW_MS = 60;
const RETICLE_HOT = 'a, button, .card, [role="button"], summary, label';
const RETICLE_TEXT = 'input, textarea, select, [contenteditable]';

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = () => document.documentElement.dataset.motion === 'reduced';
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const motionOn = () => !reducedMotion() && !motionQuery.matches;

const scroll = { y: window.scrollY, max: 1, speed: 0, heat: 0 };
function measureScroll() {
  scroll.max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}

const ticker = (() => {
  const tasks = new Set();
  let frame = 0;
  let last = 0;
  const run = (now) => {
    frame = 0;
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    const y = window.scrollY;
    const instant = Math.abs(y - scroll.y) / dt;
    scroll.y = y;
    scroll.speed += (instant - scroll.speed) * (1 - Math.exp(-dt / HEAT_SMOOTHING_MS));
    scroll.heat = clamp01(scroll.speed / HEAT_SPEED);
    tasks.forEach((task) => { if (task(now, dt) === false) tasks.delete(task); });
    if (tasks.size && !document.hidden) frame = requestAnimationFrame(run);
    else last = 0;
  };
  const start = () => {
    if (!frame && tasks.size && !document.hidden) frame = requestAnimationFrame(run);
  };
  document.addEventListener('visibilitychange', start);
  return {
    add(task) {
      tasks.add(task);
      start();
    },
    delete(task) { tasks.delete(task); }
  };
})();

function span(className, text) {
  const node = document.createElement('span');
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function coarseToFine(count) {
  const order = [];
  const seen = new Set();
  const add = (index) => {
    if (!seen.has(index)) { seen.add(index); order.push(index); }
  };
  FRAME_STEPS.forEach((step, pass) => {
    for (let index = 0; index < count; index += step) add(index);
    if (pass === 0) add(count - 1);
  });
  return order;
}

function splitDirective(node) {
  const text = node.textContent;
  const at = text.indexOf(': ');
  if (at < 0) return;
  node.replaceChildren(span('directive-main', text.slice(0, at + 1)), ' ', span('directive-sub', text.slice(at + 2)));
}

function setupHero() {
  const directive = document.querySelector('.mission-directive');
  if (directive) splitDirective(directive);
}

function setupFilm() {
  const layer = document.querySelector('.film-layer');
  const canvas = layer.querySelector('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  const names = ['descent', 'infiltration', 'extraction'];
  const connection = navigator.connection;
  const crossStart = CROSSFADE_CENTER - CROSSFADE_WIDTH / 2;
  const crossEnd = CROSSFADE_CENTER + CROSSFADE_WIDTH / 2;
  let chapters = [];
  let variant = '';
  let queued = false;
  let lastDraw = '';
  let poster = '';
  let maxScroll = 1;
  let generation = 0;
  let shownChapter = -1;
  let cutUntil = 0;
  let cutFresh = false;
  const [redGhost, cyanGhost, still] = [0, 1, 2].map(() => document.createElement('canvas'));
  const feed = document.querySelector('.film-feed');
  const fallback = () => motionQuery.matches || connection?.saveData || !context;

  function release(chapter) {
    if (!chapter) return;
    chapter.generation = ++generation;
    chapter.frames = [];
    chapter.loading = false;
    chapter.failed = false;
  }

  function measure() {
    const viewport = window.innerHeight;
    const nextVariant = window.innerWidth < 768 ? 'mobile' : 'desktop';
    if (variant !== nextVariant) {
      variant = nextVariant;
      chapters.forEach(release);
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(viewport * dpr);
    [[redGhost, CUT_GHOST_SCALE], [cyanGhost, CUT_GHOST_SCALE], [still, CUT_STILL_SCALE]].forEach(([buffer, scale]) => {
      buffer.width = Math.max(1, Math.round(canvas.width * scale));
      buffer.height = Math.max(1, Math.round(canvas.height * scale));
    });
    if (context) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
    }
    maxScroll = Math.max(1, document.documentElement.scrollHeight - viewport);
    lastDraw = '';
    schedule();
  }

  async function load(chapter) {
    if (!chapter || chapter.loading || chapter.failed || fallback()) return;
    chapter.loading = true;
    const token = chapter.generation = ++generation;
    const order = coarseToFine(chapter.frameCount);
    let cursor = 0;
    let failures = 0;
    async function worker() {
      while (cursor < order.length && chapter.generation === token && !fallback()) {
        const index = order[cursor++];
        if (chapter.frames[index]) continue;
        const image = new Image();
        image.decoding = 'async';
        image.src = `${chapter[variant]}/frame_${String(index + 1).padStart(3, '0')}.webp`;
        try {
          await image.decode();
          if (chapter.generation !== token) return;
          chapter.frames[index] = image;
          schedule();
        } catch {
          if (++failures >= 8 && !chapter.frames.some(Boolean)) {
            chapter.failed = true;
            chapter.generation = ++generation;
            schedule();
            return;
          }
        }
      }
    }
    // Four decodes at a time keep the coarse passes ahead of the fine frames.
    await Promise.all(Array.from({ length: 4 }, worker));
  }

  function nearest(chapter, index) {
    if (!chapter) return null;
    for (let distance = 0; distance < chapter.frameCount; distance += 1) {
      for (const candidate of [index - distance, index + distance]) {
        if (chapter.frames[candidate]) return { image: chapter.frames[candidate], key: `${chapter.name}:${candidate}:${chapter.generation}` };
      }
    }
    return null;
  }

  function paint(image, alpha = 1, zoom = 1) {
    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * zoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.globalAlpha = alpha;
    context.drawImage(image, (canvas.width - width) * 0.68, (canvas.height - height) / 2, width, height);
    context.globalAlpha = 1;
  }

  function glitch(intensity) {
    context.globalCompositeOperation = 'screen';
    context.globalAlpha = intensity * 0.16;
    for (let line = 0; line < 14; line += 1) {
      const seed = (line * 127 + Math.round(intensity * 1000) * 31) % 997;
      context.fillStyle = line % 2 ? '#2bd9ff' : '#ff3b2b';
      context.fillRect(seed / 997 * canvas.width * 0.6, line / 14 * canvas.height, canvas.width * 0.4, 1 + seed % 2);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  }

  function capture(buffer, tint) {
    const bufferContext = buffer.getContext('2d');
    bufferContext.globalCompositeOperation = 'copy';
    bufferContext.drawImage(canvas, 0, 0, buffer.width, buffer.height);
    if (!tint) return;
    bufferContext.globalCompositeOperation = 'multiply';
    bufferContext.fillStyle = tint;
    bufferContext.fillRect(0, 0, buffer.width, buffer.height);
  }

  // The cut samples the frame once and replays it, so the 250ms glitch never reads the canvas back mid-scroll.
  function cut(remaining) {
    if (cutFresh) {
      cutFresh = false;
      capture(redGhost, '#ff0000');
      capture(cyanGhost, '#00ffff');
      capture(still);
    }
    const strength = remaining / CUT_MS;
    const shift = Math.round(canvas.width * 0.006 * (0.5 + strength));
    context.globalCompositeOperation = 'screen';
    context.globalAlpha = 0.6 * strength + 0.2;
    context.drawImage(redGhost, shift, 0, canvas.width, canvas.height);
    context.drawImage(cyanGhost, -shift, 0, canvas.width, canvas.height);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    const ratio = still.height / canvas.height;
    for (let slice = 0; slice < 6; slice += 1) {
      const y = Math.random() * canvas.height;
      const height = 4 + Math.random() * canvas.height * 0.06;
      const offset = (Math.random() - 0.5) * canvas.width * 0.08 * strength;
      context.drawImage(still, 0, y * ratio, still.width, height * ratio, offset, y, canvas.width, height);
    }
  }

  function announce(chapter) {
    if (!feed) return;
    feed.textContent = `FEED ${String(chapter + 1).padStart(2, '0')}`;
    feed.classList.remove('is-flashing');
    void feed.offsetWidth;
    feed.classList.add('is-flashing');
  }

  const push = (t) => 1 + Math.round(clamp01(t) * CAMERA_STEPS) / CAMERA_STEPS * CAMERA_PUSH;

  function timeline(total) {
    if (total < DESCENT_END) return { chapter: 0, t: total / DESCENT_END };
    const infiltration = clamp01((total - DESCENT_END) / (INFILTRATION_END - DESCENT_END));
    const extraction = clamp01((total - INFILTRATION_END) / (1 - INFILTRATION_END));
    if (total < crossStart) return { chapter: 1, t: infiltration };
    if (total < crossEnd) return { chapter: 2, cross: (total - crossStart) / CROSSFADE_WIDTH, infiltration, t: extraction };
    return { chapter: 2, t: extraction };
  }

  function frameIndex(chapter, t) {
    if (!chapter) return 0;
    const last = chapter.frameCount - 1;
    // The first 25 window frames consume half of the infiltration scroll.
    const exponent = last > WINDOW_FRAMES ? Math.log(WINDOW_FRAMES / last) / Math.log(0.5) : 1.5;
    const progress = chapter.name === 'infiltration' ? Math.pow(clamp01(t), exponent) : clamp01(t);
    return Math.round(progress * last);
  }

  function update() {
    queued = false;
    const state = timeline(clamp01(window.scrollY / maxScroll));
    const crossing = state.cross !== undefined;
    const active = crossing ? [1, 2] : [state.chapter];

    chapters.forEach((item, index) => {
      if (!item) return;
      const distance = Math.min(...active.map((chapter) => Math.abs(chapter - index)));
      if (distance > 1) {
        if (item.loading || item.frames.length) release(item);
      } else load(item);
    });

    const posterUrl = chapters[state.chapter]?.poster || 'assets/hero-poster.jpg';
    if (poster !== posterUrl) {
      poster = posterUrl;
      layer.style.backgroundImage = `url("${posterUrl}"), url("assets/hero-poster.jpg")`;
    }
    const staticMode = fallback();
    layer.dataset.mode = staticMode ? 'poster' : 'film';
    if (staticMode) { canvas.hidden = true; return; }

    let base;
    let overlay = null;
    let mix = 1;
    let baseZoom = push(state.t);
    let overlayZoom = baseZoom;
    if (crossing) {
      const from = chapters[1];
      const to = chapters[2];
      base = from && nearest(from, frameIndex(from, state.infiltration));
      overlay = to && nearest(to, frameIndex(to, state.t));
      baseZoom = push(state.infiltration);
      mix = Math.round(state.cross * 24) / 24;
      if (!base) { base = overlay; overlay = null; baseZoom = overlayZoom; }
    } else {
      const chapter = chapters[state.chapter];
      base = chapter && nearest(chapter, frameIndex(chapter, state.t));
    }
    if (!base) { canvas.hidden = true; return; }
    canvas.hidden = false;
    const now = performance.now();
    if (shownChapter !== state.chapter) {
      if (shownChapter >= 0 && motionOn()) {
        cutUntil = now + CUT_MS;
        cutFresh = true;
        announce(state.chapter);
      }
      shownChapter = state.chapter;
    }
    const cutting = now < cutUntil;
    const key = `${base.key}:${overlay?.key || ''}:${mix}:${baseZoom}:${overlayZoom}`;
    if (key === lastDraw && !cutting) return;
    lastDraw = cutting ? '' : key;
    paint(base.image, 1, baseZoom);
    if (overlay) {
      paint(overlay.image, mix, overlayZoom);
      const intensity = Math.sin(mix * Math.PI);
      if (intensity > 0.05) glitch(intensity);
    }
    if (cutting) {
      cut(cutUntil - now);
      schedule();
    }
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  function preferenceChanged() {
    chapters.forEach(release);
    measure();
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  motionQuery.addEventListener('change', preferenceChanged);
  connection?.addEventListener('change', preferenceChanged);
  new ResizeObserver(measure).observe(document.querySelector('main'));
  document.fonts?.ready.then(measure);
  measure();
  fetch('assets/film/manifest.json').then((response) => {
    if (!response.ok) throw new Error('Film manifest unavailable');
    return response.json();
  }).then((manifest) => {
    chapters = names.map((name) => {
      const entry = manifest.chapters.find((item) => item.name === name);
      return entry && Number.isInteger(entry.frameCount) && entry.frameCount > 0
        ? { ...entry, frames: [], generation: 0, loading: false, failed: false } : null;
    });
    measure();
  }).catch(() => { layer.dataset.mode = 'poster'; });
}

function setupPhaseChips() {
  document.querySelectorAll('.phase h3 + p').forEach((paragraph) => {
    const segments = [[]];
    [...paragraph.childNodes].forEach((child) => {
      if (child.nodeType !== Node.TEXT_NODE) {
        segments[segments.length - 1].push(child);
        return;
      }
      child.textContent.split(PHASE_SEPARATOR).forEach((part, index) => {
        if (index > 0) segments.push([]);
        if (part) segments[segments.length - 1].push(document.createTextNode(part));
      });
    });
    const parts = segments.flatMap((nodes, index) => {
      const segment = span('');
      segment.append(...nodes);
      segment.className = /\bmin\b/.test(segment.textContent) ? 'phase-chip' : 'phase-note';
      return index > 0 ? [span('visually-hidden', PHASE_SEPARATOR), segment] : [segment];
    });
    paragraph.replaceChildren(...parts);
  });
}

function splitLabel(node, labelClass) {
  const text = node.textContent;
  const at = text.indexOf(': ');
  if (at < 0) return;
  node.replaceChildren(span(labelClass, text.slice(0, at)), span('visually-hidden', ': '), span('leak-value', text.slice(at + 2)));
}

function scrambled(text, revealed = 0) {
  return [...text].map((character, index) => index < revealed || /\s/.test(character)
    ? character : CIPHER_GLYPHS[Math.floor(Math.random() * CIPHER_GLYPHS.length)]).join('');
}

function decrypt(node, text, complete, stepMs = 25) {
  let frame = 0;
  const started = performance.now();
  const length = [...text].length;
  const update = (now) => {
    const revealed = Math.min(length, Math.floor((now - started) / stepMs));
    node.textContent = scrambled(text, revealed);
    if (revealed < length) frame = requestAnimationFrame(update);
    else complete();
  };
  frame = requestAnimationFrame(update);
  return () => cancelAnimationFrame(frame);
}

function setupLeaks() {
  const states = [];
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const state = states.find((item) => item.card === entry.target);
      if (state) state.visible = entry.isIntersecting;
    });
  }) : null;

  document.querySelectorAll('[data-leak]').forEach((card) => {
    card.classList.add('card');
    const concept = card.querySelector('.leak-concept');
    const audience = card.querySelector('.leak-audience');
    splitLabel(concept, 'tag');
    splitLabel(audience, 'leak-label');
    audience.classList.add('visually-hidden');
    const text = audience.querySelector('.leak-value').textContent;
    const hint = span('leak-hint', 'CLASSIFIED · TAP TO DECRYPT');
    const cipherBlock = span('leak-cipher');
    cipherBlock.setAttribute('aria-hidden', 'true');
    const cipher = span('leak-cipher-text leak-value', scrambled(text));
    cipherBlock.append(span('leak-cipher-layout', text), cipher);
    const content = span('leak-content');
    content.append(concept, hint, cipherBlock, audience);
    card.append(content);
    const state = { card, cipher, text, visible: !observer, busy: false };
    states.push(state);
    observer?.observe(card);
    let glitchTimer = 0;
    let fade = null;
    let cancelDecrypt = () => {};

    const clear = () => {
      clearTimeout(glitchTimer);
      fade?.cancel();
      fade = null;
      cancelDecrypt();
      card.classList.remove('is-glitching', 'is-encrypting');
      card.querySelectorAll('.leak-slice').forEach((slice) => slice.remove());
      state.busy = false;
    };
    const settled = (expanded) => {
      clear();
      card.classList.toggle('is-decrypted', expanded);
      hint.textContent = expanded ? 'DECRYPTED' : 'CLASSIFIED · TAP TO DECRYPT';
      cipher.textContent = expanded ? text : scrambled(text);
    };
    const change = () => {
      clear();
      const expanded = card.getAttribute('aria-expanded') === 'true';
      card.classList.remove('is-decrypted');
      if (reducedMotion()) {
        settled(expanded);
        fade = cipher.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
        return;
      }
      state.busy = true;
      for (let index = 0; index < 2; index += 1) {
        const slice = content.cloneNode(true);
        slice.className = 'leak-content leak-slice';
        slice.setAttribute('aria-hidden', 'true');
        slice.querySelector('.leak-audience').remove();
        card.append(slice);
      }
      void card.offsetWidth;
      card.classList.add('is-glitching');
      card.classList.toggle('is-encrypting', !expanded);
      glitchTimer = setTimeout(() => {
        clear();
        if (!expanded) { settled(false); return; }
        state.busy = true;
        cancelDecrypt = decrypt(cipher, text, () => {
          settled(true);
          flashLasers();
        });
      }, expanded ? 400 : 180);
    };
    card.addEventListener('click', change);
    motionQuery.addEventListener('change', () => settled(card.getAttribute('aria-expanded') === 'true'));
  });
  setInterval(() => {
    if (document.hidden || reducedMotion()) return;
    states.forEach((state) => {
      if (state.visible && !state.busy && state.card.getAttribute('aria-expanded') !== 'true') {
        state.cipher.textContent = scrambled(state.text);
      }
    });
  }, 120);
}

function setupManual() {
  document.querySelectorAll('[data-fees]').forEach((node) => {
    const lines = node.textContent.split(' / ');
    node.replaceChildren(...lines.map((text, index) => {
      const line = span('fee-line', text);
      if (index > 0) line.prepend(span('visually-hidden', ' / '));
      return line;
    }));
  });
}

function setupCriteria() {
  document.querySelectorAll('.criterion').forEach((row) => {
    [...row.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).forEach((node) => node.remove());
  });
}

function setupTopbar() {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  let queued = false;
  const update = () => {
    queued = false;
    topbar.classList.toggle('is-scrolled', window.scrollY > TOPBAR_SCROLLED_PX);
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    topbar.style.setProperty('--fx-read', scrollable > 0 ? clamp01(window.scrollY / scrollable) : 0);
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  update();

  if (!('IntersectionObserver' in window)) return;
  const nav = topbar.querySelector('.topnav');
  const indicator = span('nav-indicator');
  indicator.setAttribute('aria-hidden', 'true');
  nav?.append(indicator);
  const place = () => {
    const link = nav?.querySelector('a[aria-current]');
    if (!link) { indicator.classList.remove('is-active'); return; }
    const appearing = !indicator.classList.contains('is-active');
    if (appearing) indicator.style.transition = 'none';
    indicator.style.setProperty('--fx-nav-x', `${link.offsetLeft}px`);
    indicator.style.setProperty('--fx-nav-w', `${link.offsetWidth}px`);
    if (appearing) {
      void indicator.offsetWidth;
      indicator.style.transition = '';
    }
    indicator.classList.add('is-active');
  };
  window.addEventListener('resize', place, { passive: true });
  document.fonts?.ready.then(place);
  const links = new Map([...topbar.querySelectorAll('.topnav a')].map((link) => [link.hash.slice(1), link]));
  const observer = new IntersectionObserver((entries) => {
    entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
      links.forEach((link, id) => {
        if (id === entry.target.id) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    });
    place();
  }, { rootMargin: '-45% 0px -50% 0px' });
  [...links.keys(), 'hero', 'accept'].forEach((id) => {
    const target = document.getElementById(id);
    if (target) observer.observe(target);
  });
}

function setupReveal() {
  if (reducedMotion() || !('IntersectionObserver' in window)) return;
  const pending = new Set();
  const reveal = (node, index) => {
    pending.delete(node);
    observer.unobserve(node);
    node.style.setProperty('--reveal-delay', `${Math.min(index, REVEAL_STAGGER_MAX - 1) * REVEAL_STAGGER_MS}ms`);
    node.classList.add('is-revealed');
  };
  const observer = new IntersectionObserver((entries) => {
    entries.filter((entry) => entry.isIntersecting).forEach((entry, index) => reveal(entry.target, index));
  }, { rootMargin: '0px 0px -5% 0px', threshold: 0 });
  // A jump past a node (anchor link, fast fling) never reports it as intersecting.
  let queued = false;
  const sweep = () => {
    queued = false;
    pending.forEach((node) => { if (node.getBoundingClientRect().bottom < 0) reveal(node, 0); });
  };
  window.addEventListener('scroll', () => {
    if (queued || !pending.size) return;
    queued = true;
    requestAnimationFrame(sweep);
  }, { passive: true });
  document.querySelectorAll(REVEAL_TARGETS).forEach((node) => {
    if (node.getBoundingClientRect().top < window.innerHeight) return;
    node.classList.add('reveal');
    pending.add(node);
    observer.observe(node);
  });
}

function onceInView(nodes, enter) {
  if (!('IntersectionObserver' in window)) { nodes.forEach(enter); return; }
  const observer = new IntersectionObserver((entries) => {
    entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
      observer.unobserve(entry.target);
      enter(entry.target);
    });
  }, { rootMargin: ENTRY_MARGIN });
  nodes.forEach((node) => observer.observe(node));
}

const markSeen = (node) => node.classList.add('is-seen');

function setupAccents() {
  document.documentElement.classList.add('has-fx');

  const cards = [...document.querySelectorAll(FRAME_TARGETS)];
  cards.forEach((card) => {
    const frame = span('fx-frame');
    frame.setAttribute('aria-hidden', 'true');
    card.classList.add('fx-card');
    card.append(frame);
  });
  onceInView(cards, (card) => {
    markSeen(card);
    if (reducedMotion()) return;
    card.classList.add('is-entering');
    setTimeout(() => card.classList.remove('is-entering'), EDGE_SWEEP_MS);
  });

  onceInView([...document.querySelectorAll('main > section + section')], markSeen);

  onceInView([...document.querySelectorAll('.section-head')], (head) => {
    markSeen(head);
    const eyebrow = head.querySelector('.eyebrow');
    if (!eyebrow || reducedMotion()) return;
    const text = eyebrow.textContent;
    decrypt(eyebrow, text, () => {}, EYEBROW_DECRYPT_MS / [...text].length);
  });

  const criteria = [...document.querySelectorAll('.criteria-list')];
  criteria.forEach((list) => {
    [...list.children].forEach((row, index) => row.style.setProperty('--fx-i', index));
  });
  onceInView(criteria, markSeen);
}

const toMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

function setupTimeline() {
  const panel = document.querySelector('.timeline-panel');
  const list = panel?.querySelector('.timeline-list');
  const rows = list ? [...list.children] : [];
  if (rows.length < 2) return;
  const spans = rows.map((row) => {
    const [from, to] = row.querySelectorAll('time');
    return { from: from.dateTime, to: to.dateTime, start: toMinutes(from.dateTime), end: toMinutes(to.dateTime) };
  });
  const kinds = rows.map((row) => row.dataset.phase ? `round${row.dataset.phase}` : 'setup');
  panel.style.setProperty('--tl-cols', spans
    .map(({ start, end }) => `minmax(${TIMELINE_MIN_BLOCK_PX}px, ${end - start}fr)`).join(' '));

  rows.forEach((row, index) => {
    const { from, to, start, end } = spans[index];
    const kind = kinds[index];
    const label = row.querySelector('.timeline-label');
    const name = label.textContent;
    const at = name.lastIndexOf(PHASE_SEPARATOR);
    if (at >= 0) {
      label.replaceChildren(
        span('timeline-label-prefix', name.slice(0, at + PHASE_SEPARATOR.length)),
        span('timeline-label-name', name.slice(at + PHASE_SEPARATOR.length))
      );
    }
    row.dataset.kind = kind;
    if (index > 0 && kinds[index - 1] === kind && kind !== 'setup') row.dataset.shade = 'alt';
    row.style.setProperty('--fx-i', index);
    row.append(span('timeline-duration', `${end - start} min`));
    if (kind === 'setup') {
      const mark = span('timeline-mark', name.trim().charAt(0));
      const tip = span('timeline-tip', `${name} · ${from} to ${to}`);
      mark.setAttribute('aria-hidden', 'true');
      tip.setAttribute('aria-hidden', 'true');
      row.append(mark, tip);
      row.tabIndex = 0;
    }
  });

  const axis = panel.querySelector('.timeline-axis');
  const ticks = panel.querySelector('.timeline-ticks');
  axis?.replaceChildren(...spans.map(({ from }) => span('timeline-axis-time', from)));
  ticks?.replaceChildren(...spans.map(() => span('timeline-tick')));

  const rounds = [];
  kinds.forEach((kind, index) => {
    if (kind === 'setup') return;
    const round = rounds.find((item) => item.kind === kind);
    if (round) round.last = index;
    else rounds.push({ kind, first: index, last: index, phase: rows[index].dataset.phase });
  });
  panel.querySelector('.timeline-rounds')?.replaceChildren(...rounds.map(({ kind, first, last, phase }) => {
    const bracket = span('timeline-round', `Round ${phase}`);
    bracket.dataset.kind = kind;
    bracket.style.gridColumn = `${first + 1} / ${last + 2}`;
    return bracket;
  }));

  const setup = panel.querySelector('.timeline-setup');
  if (setup) {
    setup.textContent = `Setup: ${rows
      .map((row, index) => kinds[index] === 'setup' ? `${row.querySelector('.timeline-label').textContent} ${spans[index].from}` : '')
      .filter(Boolean).join(' · ')}`;
  }

  const described = rows.filter((row, index) => kinds[index] !== 'setup');
  const layout = () => {
    const width = list.clientWidth;
    let depth = 0;
    described.forEach((row, index) => {
      const next = described[index + 1];
      const right = next ? next.offsetLeft : width;
      row.style.setProperty('--fx-desc-w', `${Math.max(row.offsetWidth, right - row.offsetLeft) - TIMELINE_DESC_GAP_PX}px`);
    });
    described.forEach((row) => {
      depth = Math.max(depth, row.querySelector('.timeline-detail').offsetHeight);
    });
    panel.style.setProperty('--tl-desc-h', `${depth}px`);
    live();
  };

  const marker = panel.querySelector('.timeline-now');
  const eventStart = new Date(CONFIG.start).getTime();
  const eventEnd = new Date(CONFIG.end).getTime();
  function live() {
    const now = Date.now();
    const on = now >= eventStart && now < eventEnd;
    rows.forEach((row) => row.classList.remove('is-active'));
    if (marker) marker.hidden = !on;
    if (!on || !marker) return;
    const minute = spans[0].start + (now - eventStart) / 60000;
    const index = spans.findIndex(({ start, end }) => minute >= start && minute < end);
    if (index < 0) { marker.hidden = true; return; }
    const row = rows[index];
    const { start, end } = spans[index];
    rows[index].classList.add('is-active');
    marker.style.transform = `translateX(${row.offsetLeft + (minute - start) / (end - start) * row.offsetWidth}px)`;
  }
  if (Date.now() < eventEnd) setInterval(live, TIMELINE_LIVE_MS);

  new ResizeObserver(layout).observe(list);
  document.fonts?.ready.then(layout);
  layout();

  const lasers = document.querySelector('.lasers');
  if (lasers && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => lasers.classList.toggle('is-dimmed', entry.isIntersecting));
    }).observe(document.getElementById('timeline'));
  }
}

function flashLasers() {
  if (!motionOn()) return;
  document.querySelectorAll('.laser').forEach((laser) => {
    laser.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: getComputedStyle(laser).opacity }], { duration: LASER_FLASH_MS, easing: 'ease-out' });
  });
}

function setupFuse() {
  const fuse = document.querySelector('.fuse');
  const burnt = fuse?.querySelector('.fuse-burnt');
  const head = fuse?.querySelector('.fuse-head');
  const spark = fuse?.querySelector('.fuse-spark');
  const target = document.querySelector('#accept .button--primary');
  if (!fuse || !burnt || !head || !spark) return;
  const wide = window.matchMedia(FUSE_QUERY);
  let length = 0;
  let drawn = '';
  let spent = false;
  let jump = null;
  let igniteTimer = 0;

  const measure = () => {
    length = fuse.clientHeight;
    measureScroll();
    drawn = '';
    ticker.add(frame);
  };

  const reset = () => {
    spent = false;
    jump?.cancel();
    jump = null;
    clearTimeout(igniteTimer);
    target?.classList.remove('is-ignited');
    fuse.classList.remove('is-spent');
  };

  const ignite = () => {
    spent = true;
    if (!target) return;
    const from = spark.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    if (to.bottom < 0 || to.top > window.innerHeight) {
      fuse.classList.add('is-spent');
      return;
    }
    const dx = to.left + 12 - from.left;
    const dy = to.top + to.height / 2 - from.top;
    jump = spark.animate([
      { translate: '0 0' },
      { translate: `${dx * 0.5}px ${dy * 0.5 - 80}px`, offset: 0.5 },
      { translate: `${dx}px ${dy}px` }
    ], { duration: FUSE_JUMP_MS, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' });
    jump.onfinish = () => {
      fuse.classList.add('is-spent');
      target.classList.remove('is-ignited');
      void target.offsetWidth;
      target.classList.add('is-ignited');
      igniteTimer = setTimeout(() => target.classList.remove('is-ignited'), IGNITE_MS);
    };
  };

  function frame() {
    if (!wide.matches || !motionOn()) return false;
    const progress = clamp01(scroll.y / scroll.max);
    const heat = Math.round(scroll.heat * 20) / 20;
    const state = `${progress.toFixed(4)}:${heat}`;
    if (state !== drawn) {
      drawn = state;
      burnt.style.transform = `scaleY(${progress})`;
      head.style.transform = `translate3d(0, ${progress * length}px, 0)`;
      fuse.style.setProperty('--fx-heat', heat);
    }
    if (!spent && progress >= FUSE_IGNITE_AT) ignite();
    else if (spent && progress < FUSE_RESET_AT) reset();
    return scroll.speed > 0.01;
  }

  window.addEventListener('scroll', () => ticker.add(frame), { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  wide.addEventListener('change', measure);
  motionQuery.addEventListener('change', measure);
  new ResizeObserver(measure).observe(document.querySelector('main'));
  measure();
}

function setupIntro() {
  const root = document.documentElement;
  const intro = document.querySelector('.intro');
  if (!root.classList.contains('intro-pending') || !intro) return;
  try { sessionStorage.setItem(INTRO_KEY, '1'); } catch {}
  const timers = [];
  let cancelDecrypt = () => {};
  const finish = () => {
    timers.forEach(clearTimeout);
    cancelDecrypt();
    root.classList.remove('intro-pending', 'intro-ignite');
    intro.remove();
    window.removeEventListener('pointerdown', finish, true);
    window.removeEventListener('keydown', finish, true);
  };
  if (!motionOn() || performance.now() > INTRO_LATE_MS) {
    finish();
    return;
  }
  window.addEventListener('pointerdown', finish, true);
  window.addEventListener('keydown', finish, true);
  const text = intro.querySelector('.intro-text');
  const message = text.textContent;
  cancelDecrypt = decrypt(text, message, () => {}, INTRO_DECRYPT_MS / [...message].length);
  if (!window.matchMedia(FUSE_QUERY).matches) intro.style.setProperty('--fx-strike-x', '50%');
  const at = (ms, step) => timers.push(setTimeout(step, ms));
  at(INTRO_STRIKE_AT, () => intro.classList.add('is-striking'));
  at(INTRO_IGNITE_AT, () => root.classList.add('intro-ignite'));
  at(INTRO_CUT_AT, () => intro.classList.add('is-cut'));
  at(INTRO_END_AT, finish);
}

function setupReticle() {
  const reticle = document.querySelector('.reticle');
  const fine = window.matchMedia('(pointer: fine)');
  if (!reticle) return;
  const root = document.documentElement;
  const position = { x: 0, y: 0, tx: 0, ty: 0, placed: false };
  const enabled = () => fine.matches && motionOn();

  const frame = (now, dt) => {
    if (!enabled()) return false;
    const follow = 1 - Math.exp(-dt / RETICLE_FOLLOW_MS);
    position.x += (position.tx - position.x) * follow;
    position.y += (position.ty - position.y) * follow;
    const settled = Math.abs(position.tx - position.x) < 0.1 && Math.abs(position.ty - position.y) < 0.1;
    if (settled) {
      position.x = position.tx;
      position.y = position.ty;
    }
    reticle.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
    return !settled;
  };

  const sync = () => {
    root.classList.toggle('has-reticle', enabled());
    if (!enabled()) reticle.classList.remove('is-visible');
  };
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || !enabled()) return;
    position.tx = event.clientX;
    position.ty = event.clientY;
    if (!position.placed) {
      position.x = position.tx;
      position.y = position.ty;
      position.placed = true;
    }
    ticker.add(frame);
  }, { passive: true });
  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    const typing = event.target.closest?.(RETICLE_TEXT);
    reticle.classList.toggle('is-visible', !typing);
    reticle.classList.toggle('is-hot', !typing && Boolean(event.target.closest?.(RETICLE_HOT)));
  });
  document.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) reticle.classList.remove('is-visible');
  });
  fine.addEventListener('change', sync);
  motionQuery.addEventListener('change', sync);
  sync();
}

function setupAtmosphere() {
  const canvas = document.querySelector('.atmosphere');
  const context = canvas?.getContext('2d');
  if (!context) return;
  const drops = [];
  const embers = [];
  const sprite = document.createElement('canvas');
  let dpr = 1;
  let width = 0;
  let height = 0;

  sprite.width = sprite.height = 32;
  const spriteContext = sprite.getContext('2d');
  const glow = spriteContext.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, 'rgba(255, 214, 170, 1)');
  glow.addColorStop(0.2, 'rgba(255, 90, 50, 0.9)');
  glow.addColorStop(1, 'rgba(255, 40, 30, 0)');
  spriteContext.fillStyle = glow;
  spriteContext.fillRect(0, 0, 32, 32);

  const seed = (drop, anywhere) => {
    drop.x = Math.random() * (width + height * 0.2);
    drop.y = anywhere ? Math.random() * height : -drop.length;
    return drop;
  };

  const measure = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = canvas.width = Math.round(window.innerWidth * dpr);
    height = canvas.height = Math.round(window.innerHeight * dpr);
    const area = window.innerWidth * window.innerHeight;
    const emberCount = Math.min(ATMOSPHERE_EMBERS, Math.round(area / 90000));
    const dropCount = Math.min(ATMOSPHERE_MAX - emberCount, Math.round(area / ATMOSPHERE_AREA_PER_DROP));
    drops.length = 0;
    embers.length = 0;
    for (let index = 0; index < dropCount; index += 1) {
      drops.push(seed({
        length: (10 + Math.random() * 14) * dpr,
        speed: (0.5 + Math.random() * 0.45) * dpr,
        layer: index % 3
      }, true));
    }
    for (let index = 0; index < emberCount; index += 1) {
      embers.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: (5 + Math.random() * 7) * dpr,
        rise: (0.012 + Math.random() * 0.025) * dpr,
        sway: Math.random() * Math.PI * 2,
        flicker: Math.random() * Math.PI * 2
      });
    }
  };

  const layerAlpha = [0.05, 0.085, 0.13];
  const frame = (now, dt) => {
    if (!motionOn()) {
      context.clearRect(0, 0, width, height);
      return false;
    }
    const boost = 1 + scroll.heat * ATMOSPHERE_BOOST;
    context.clearRect(0, 0, width, height);
    context.lineWidth = dpr;
    for (let layer = 0; layer < 3; layer += 1) {
      context.strokeStyle = `rgba(235, 225, 225, ${layerAlpha[layer]})`;
      context.beginPath();
      drops.forEach((drop) => {
        if (drop.layer !== layer) return;
        const step = drop.speed * (0.7 + layer * 0.25) * boost * dt;
        drop.y += step;
        drop.x -= step * 0.18;
        if (drop.y - drop.length > height || drop.x < -drop.length) seed(drop, false);
        const length = drop.length * (1 + scroll.heat);
        context.moveTo(drop.x, drop.y);
        context.lineTo(drop.x + length * 0.18, drop.y - length);
      });
      context.stroke();
    }
    embers.forEach((item) => {
      item.y -= item.rise * boost * dt;
      item.sway += dt * 0.0012;
      item.flicker += dt * 0.01;
      const x = item.x + Math.sin(item.sway) * 18 * dpr;
      if (item.y < -item.size) {
        item.y = height + item.size;
        item.x = Math.random() * width;
      }
      context.globalAlpha = 0.35 + Math.sin(item.flicker) * 0.2;
      context.drawImage(sprite, x - item.size / 2, item.y - item.size / 2, item.size, item.size);
    });
    context.globalAlpha = 1;
    return true;
  };

  const start = () => {
    if (motionOn()) ticker.add(frame);
    else context.clearRect(0, 0, width, height);
  };
  window.addEventListener('resize', measure, { passive: true });
  motionQuery.addEventListener('change', start);
  measure();
  start();
}

function setupCountdownTick() {
  const seconds = document.querySelector('#hero [data-secs]');
  if (!seconds) return;
  new MutationObserver(() => {
    if (document.hidden || reducedMotion()) return;
    seconds.animate([{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }, { opacity: 0.6 }, { opacity: 1 }], { duration: 120 });
  }).observe(seconds, { childList: true, characterData: true, subtree: true });
}

function setupButtons() {
  document.querySelectorAll('.button--primary').forEach((button) => {
    const label = span('button-label');
    label.append(...button.childNodes);
    button.append(label);
  });
}

setupIntro();
setupTopbar();
setupHero();
setupPhaseChips();
setupLeaks();
setupManual();
setupCriteria();
setupReveal();
setupAccents();
setupTimeline();
setupCountdownTick();
setupButtons();
setupFilm();
setupAtmosphere();
setupFuse();
setupReticle();

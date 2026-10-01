const FRAME_STEPS = [8, 4, 1];
const PHASE_SEPARATOR = ' · ';
const REVEAL_STAGGER_MS = 30;
const REVEAL_STAGGER_MAX = 8;
const REVEAL_TARGETS = [
  '.briefing-stats',
  '.phase', '.transmission',
  '.leak-card', '#leaks .small-print',
  '.prize-list', '.participation',
  '.timeline-row', '.criterion', '.event-spec', '.rules-panel'
].join(', ');
const TOPBAR_SCROLLED_PX = 24;
const DESCENT_END = 0.30;
const INFILTRATION_END = 0.70;
const CROSSFADE_CENTER = 0.72;
const CROSSFADE_WIDTH = 0.08;
const WINDOW_FRAMES = 25;
const CIPHER_GLYPHS = '▓▒░█▚▞ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = () => document.documentElement.dataset.motion === 'reduced';
const clamp01 = (value) => Math.min(1, Math.max(0, value));

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

  function paint(image, alpha = 1) {
    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
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
    if (crossing) {
      const from = chapters[1];
      const to = chapters[2];
      base = from && nearest(from, frameIndex(from, state.infiltration));
      overlay = to && nearest(to, frameIndex(to, state.t));
      mix = Math.round(state.cross * 24) / 24;
      if (!base) { base = overlay; overlay = null; }
    } else {
      const chapter = chapters[state.chapter];
      base = chapter && nearest(chapter, frameIndex(chapter, state.t));
    }
    if (!base) { canvas.hidden = true; return; }
    canvas.hidden = false;
    const key = `${base.key}:${overlay?.key || ''}:${mix}`;
    if (key === lastDraw) return;
    lastDraw = key;
    paint(base.image);
    if (overlay) {
      paint(overlay.image, mix);
      const intensity = Math.sin(mix * Math.PI);
      if (intensity > 0.05) glitch(intensity);
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

function decrypt(node, text, complete) {
  let frame = 0;
  const started = performance.now();
  const length = [...text].length;
  const update = (now) => {
    const revealed = Math.min(length, Math.floor((now - started) / 25));
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
        cancelDecrypt = decrypt(cipher, text, () => settled(true));
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
  };
  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }, { passive: true });
  update();

  if (!('IntersectionObserver' in window)) return;
  const links = new Map([...topbar.querySelectorAll('.topnav a')].map((link) => [link.hash.slice(1), link]));
  const observer = new IntersectionObserver((entries) => {
    entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
      links.forEach((link, id) => {
        if (id === entry.target.id) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  [...links.keys(), 'hero', 'accept'].forEach((id) => {
    const target = document.getElementById(id);
    if (target) observer.observe(target);
  });
}

function setupLogos() {
  document.querySelectorAll('.logo img').forEach((image) => {
    const missing = () => image.closest('.logo').classList.add('is-missing');
    if (image.complete && image.naturalWidth === 0) missing();
    else image.addEventListener('error', missing, { once: true });
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

setupTopbar();
setupLogos();
setupHero();
setupPhaseChips();
setupLeaks();
setupManual();
setupCriteria();
setupReveal();
setupFilm();

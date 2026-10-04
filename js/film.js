const FILM_FRAME_OFFSETS = [0, 1, -1, 2, -2, 4, -4, 8, -8];
const FILM_LOAD_CONCURRENCY = 2;
const FILM_CACHE_DESKTOP = 24;
const FILM_CACHE_MOBILE = 20;
const FILM_WARM_AT = 0.7;
const DESCENT_END = 0.30;
const INFILTRATION_END = 0.70;
const CROSSFADE_CENTER = 0.72;
const CROSSFADE_WIDTH = 0.08;
const WINDOW_FRAMES = 25;
const CAMERA_PUSH = 0.06;
const CAMERA_STEPS = 3000;
const CUT_MS = 250;
const CUT_GHOST_SCALE = 0.25;
const CUT_STILL_SCALE = 0.5;
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = () => document.documentElement.dataset.motion === 'reduced';
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const motionOn = () => !reducedMotion() && !motionQuery.matches;

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
  const cache = new Map();
  const pending = new Map();
  let wanted = new Map();
  let queued = false;
  let lastDraw = '';
  let poster = '';
  let maxScroll = 1;
  let loadGeneration = 0;
  let shownChapter = -1;
  let cutUntil = 0;
  let cutFresh = false;
  const [redGhost, cyanGhost, still] = [0, 1, 2].map(() => document.createElement('canvas'));
  const feed = document.querySelector('.film-feed');
  const fallback = () => motionQuery.matches || connection?.saveData || !context;

  function clearFrames() {
    loadGeneration += 1;
    pending.forEach(({ image }) => image.removeAttribute('src'));
    pending.clear();
    cache.forEach(({ image }) => image.removeAttribute('src'));
    cache.clear();
    wanted = new Map();
    chapters.forEach((chapter) => {
      if (!chapter) return;
      chapter.frames = [];
      chapter.failedFrames = new Set();
      chapter.failures = 0;
      chapter.failed = false;
    });
  }

  function measure() {
    const viewport = window.innerHeight;
    const nextVariant = window.innerWidth < 768 ? 'mobile' : 'desktop';
    if (variant !== nextVariant) {
      variant = nextVariant;
      clearFrames();
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(window.innerWidth * dpr);
    const height = Math.round(viewport * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      [[redGhost, CUT_GHOST_SCALE], [cyanGhost, CUT_GHOST_SCALE], [still, CUT_STILL_SCALE]].forEach(([buffer, scale]) => {
        buffer.width = Math.max(1, Math.round(width * scale));
        buffer.height = Math.max(1, Math.round(height * scale));
      });
      if (context) {
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
      }
      lastDraw = '';
    }
    maxScroll = Math.max(1, document.documentElement.scrollHeight - viewport);
    schedule();
  }

  function touch(key) {
    const entry = cache.get(key);
    if (!entry) return;
    cache.delete(key);
    cache.set(key, entry);
  }

  function trimCache() {
    const limit = variant === 'mobile' ? FILM_CACHE_MOBILE : FILM_CACHE_DESKTOP;
    while (cache.size > limit) {
      const key = [...cache.keys()].find((candidate) => !wanted.has(candidate)) || cache.keys().next().value;
      const entry = cache.get(key);
      cache.delete(key);
      entry.chapter.frames[entry.index] = null;
      entry.image.removeAttribute('src');
    }
  }

  function pump() {
    if (fallback()) return;
    while (pending.size < FILM_LOAD_CONCURRENCY) {
      const target = [...wanted.values()].find(({ key, chapter, index }) =>
        !cache.has(key) && !pending.has(key) && !chapter.failed && !chapter.failedFrames.has(index));
      if (!target) return;
      const { chapter, index, key } = target;
      const image = new Image();
      const record = { image, generation: loadGeneration };
      const active = () => pending.get(key) === record && record.generation === loadGeneration;
      image.decoding = 'async';
      pending.set(key, record);
      image.src = `${chapter[variant]}/frame_${String(index + 1).padStart(3, '0')}.webp`;
      image.decode().then(() => {
        if (!active() || !wanted.has(key)) return;
        chapter.frames[index] = image;
        cache.set(key, { image, chapter, index });
        trimCache();
        schedule();
      }).catch(() => {
        if (!active() || !wanted.has(key)) return;
        chapter.failedFrames.add(index);
        chapter.failures += 1;
        if (chapter.failures >= 8 && !chapter.frames.some(Boolean)) chapter.failed = true;
        schedule();
      }).finally(() => {
        if (!active()) return;
        pending.delete(key);
        pump();
      });
    }
  }

  function queueFrames(state) {
    const next = new Map();
    const add = (chapter, index) => {
      if (!chapter || index < 0 || index >= chapter.frameCount) return;
      const key = `${variant}:${chapter.name}:${index}`;
      if (!next.has(key)) next.set(key, { key, chapter, index });
    };
    const active = state.cross === undefined
      ? [{ chapter: chapters[state.chapter], index: frameIndex(chapters[state.chapter], state.t) }]
      : [
          { chapter: chapters[1], index: frameIndex(chapters[1], state.infiltration) },
          { chapter: chapters[2], index: frameIndex(chapters[2], state.t) }
        ];
    FILM_FRAME_OFFSETS.forEach((offset) => active.forEach(({ chapter, index }) => add(chapter, index + offset)));
    if (state.chapter < 2 && state.t >= FILM_WARM_AT) add(chapters[state.chapter + 1], 0);
    wanted = next;
    pending.forEach(({ image }, key) => {
      if (wanted.has(key)) return;
      image.removeAttribute('src');
      pending.delete(key);
    });
    pump();
  }

  function nearest(chapter, index) {
    if (!chapter) return null;
    for (let distance = 0; distance < chapter.frameCount; distance += 1) {
      for (const candidate of [index - distance, index + distance]) {
        if (chapter.frames[candidate]) {
          const key = `${variant}:${chapter.name}:${candidate}`;
          touch(key);
          return { image: chapter.frames[candidate], key };
        }
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

    const posterUrl = chapters[state.chapter]?.poster || 'assets/hero-poster.jpg';
    if (poster !== posterUrl) {
      poster = posterUrl;
      layer.style.backgroundImage = `url("${posterUrl}"), url("assets/hero-poster.jpg")`;
    }
    const staticMode = fallback();
    layer.dataset.mode = staticMode ? 'poster' : 'film';
    if (staticMode) { canvas.hidden = true; return; }
    queueFrames(state);

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
    clearFrames();
    measure();
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  motionQuery.addEventListener('change', preferenceChanged);
  connection?.addEventListener('change', preferenceChanged);
  new ResizeObserver(() => {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    schedule();
  }).observe(document.querySelector('main'));
  document.fonts?.ready.then(measure);
  measure();
  fetch('assets/film/manifest.json').then((response) => {
    if (!response.ok) throw new Error('Film manifest unavailable');
    return response.json();
  }).then((manifest) => {
    chapters = names.map((name) => {
      const entry = manifest.chapters.find((item) => item.name === name);
      return entry && Number.isInteger(entry.frameCount) && entry.frameCount > 0
        ? { ...entry, frames: [], failedFrames: new Set(), failures: 0, failed: false } : null;
    });
    measure();
  }).catch(() => { layer.dataset.mode = 'poster'; });
}


setupFilm();

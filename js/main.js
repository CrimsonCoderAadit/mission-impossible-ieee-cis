import { CONFIG } from './config.js';

const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
function updateMotionPreference() {
  if (motionPreference.matches) {
    document.documentElement.dataset.motion = 'reduced';
  } else {
    delete document.documentElement.dataset.motion;
  }
}
updateMotionPreference();
motionPreference.addEventListener('change', updateMotionPreference);

const selectAll = (selector) => document.querySelectorAll(selector);
const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0
});
const start = new Date(CONFIG.start);
const end = new Date(CONFIG.end);
const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: CONFIG.timeZone
});
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: CONFIG.timeZone
});
const eventTime = `${timeFormatter.format(start)}–${timeFormatter.format(end)} ${CONFIG.timeZoneLabel}`;

function fill(selector, value) {
  selectAll(selector).forEach((element) => { element.textContent = value; });
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderList(name, items, renderItem) {
  const container = document.querySelector(`[data-list="${name}"]`);
  container.replaceChildren(...items.map(renderItem));
}

selectAll('[data-field]').forEach((node) => { node.textContent = CONFIG[node.dataset.field]; });
selectAll('[data-operation]').forEach((node) => { node.textContent = CONFIG.operation[node.dataset.operation]; });
selectAll('[data-contact]').forEach((node) => { node.textContent = CONFIG.contact[node.dataset.contact]; });
const titleParts = CONFIG.eventName.split(':');
const title = document.querySelector('[data-event-title]');
title.children[0].textContent = `${titleParts[0]}:`;
title.children[1].textContent = titleParts.slice(1).join(':').trim();
document.title = `${CONFIG.eventName} — ${CONFIG.shortOrganiser} · ${CONFIG.occasion}`;
selectAll('meta[property="og:title"], meta[name="twitter:title"]').forEach((meta) => {
  meta.content = document.title;
});
selectAll('[data-date]').forEach((node) => {
  node.dateTime = CONFIG.start;
  node.textContent = dateFormatter.format(start);
});
fill('[data-event-time]', eventTime);
fill('[data-duration-hours]', (end - start) / 3_600_000);
fill('[data-fees]', `${currency.format(CONFIG.fees.member)} ${CONFIG.fees.unit} · CIS members / ${currency.format(CONFIG.fees.nonMember)} ${CONFIG.fees.unit} · non-members`);
fill('[data-selfdestruct]', `This message will self-destruct in ${CONFIG.selfDestructSeconds}`);

const links = {
  register: CONFIG.registerUrl,
  rulebook: CONFIG.rulebookUrl,
  call: `tel:${CONFIG.contact.phone}`,
  whatsapp: `https://wa.me/${CONFIG.contact.phone.replace(/\D/g, '')}`
};
selectAll('[data-link]').forEach((link) => {
  if (!links[link.dataset.link]) return;
  link.href = links[link.dataset.link];
  if (link.href.startsWith('https://')) {
    link.target = '_blank';
    link.rel = 'noopener';
  }
});

renderList('schedule', CONFIG.schedule, (item) => {
  const row = element('li', 'timeline-row');
  if (item.phase) row.dataset.phase = item.phase;
  const time = element('span', 'timeline-time');
  const from = element('time', '', item.time);
  from.dateTime = item.time;
  const to = element('time', '', item.end);
  to.dateTime = item.end;
  time.append(from, '–', to);
  row.append(time, element('h3', 'timeline-label', item.label), element('p', 'timeline-detail', item.detail));
  return row;
});

renderList('judging', CONFIG.judging, (item) => {
  const row = element('li', 'criterion');
  const bar = element('div', 'criterion-bar');
  bar.style.setProperty('--w', `${item.weight}%`);
  bar.setAttribute('aria-hidden', 'true');
  row.append(element('h3', 'criterion-name', item.name), element('span', 'criterion-round', item.round), ' · ', element('span', 'criterion-weight', `${item.weight}%`), bar);
  return row;
});

renderList('leaks', CONFIG.leaks, (item, index) => {
  const card = element('button', 'leak-card');
  card.type = 'button';
  card.setAttribute('data-leak', '');
  card.setAttribute('aria-expanded', 'false');
  const audience = element('span', 'leak-audience', `Audience: ${item.audience}`);
  audience.id = `leak-audience-${index}`;
  audience.hidden = true;
  card.setAttribute('aria-controls', audience.id);
  card.append(element('span', 'leak-concept', `Concept: ${item.concept}`), audience);
  return card;
});

selectAll('[data-leak]').forEach((card) => {
  card.addEventListener('click', () => {
    const expanded = card.getAttribute('aria-expanded') !== 'true';
    card.setAttribute('aria-expanded', String(expanded));
    card.classList.toggle('is-open', expanded);
    const audience = document.getElementById(card.getAttribute('aria-controls'));
    if (audience) audience.hidden = !expanded;
  });
});

renderList('prizes', CONFIG.prizes, (item) => {
  const prize = element('li', 'prize');
  prize.append(element('h3', 'prize-place', item.place), element('p', 'prize-amount', currency.format(item.amount)), element('p', 'prize-certificate', item.cert));
  return prize;
});
renderList('rules', CONFIG.rules, (rule) => element('li', 'rule', rule));

function updateCountdown() {
  const now = Date.now();
  const state = now < start.getTime() ? 'pre' : now < end.getTime() ? 'live' : 'done';
  document.body.dataset.state = state;
  const remaining = Math.max(0, Math.floor((start.getTime() - now) / 1000));
  const values = {
    days: Math.floor(remaining / 86400),
    hours: Math.floor(remaining / 3600) % 24,
    mins: Math.floor(remaining / 60) % 60,
    secs: remaining % 60
  };
  selectAll('[data-countdown]').forEach((countdown) => {
    for (const [unit, value] of Object.entries(values)) {
      countdown.querySelector(`[data-${unit}]`).textContent = String(value).padStart(2, '0');
    }
    countdown.querySelector('[data-countdown-label]').textContent = state === 'pre'
      ? 'T-minus to deployment'
      : state === 'live' ? 'Mission live' : 'Mission complete — debrief incoming';
  });
}
updateCountdown();
let countdownInterval = setInterval(updateCountdown, 1000);
document.addEventListener('visibilitychange', () => {
  clearInterval(countdownInterval);
  if (!document.hidden) {
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
  }
});

const sticky = document.querySelector('[data-sticky]');
const hero = document.querySelector('#hero');
const accept = document.querySelector('#accept');
function updateSticky() {
  const pastHero = hero.getBoundingClientRect().bottom <= 0;
  const acceptRect = accept.getBoundingClientRect();
  const acceptVisible = acceptRect.top < window.innerHeight && acceptRect.bottom > 0;
  sticky.hidden = !pastHero || acceptVisible;
  sticky.classList.toggle('is-visible', !sticky.hidden);
}
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(updateSticky);
  observer.observe(hero);
  observer.observe(accept);
} else {
  window.addEventListener('scroll', updateSticky, { passive: true });
}
window.addEventListener('resize', updateSticky, { passive: true });
updateSticky();

const selfDestruct = document.querySelector('footer [data-selfdestruct]');
let selfDestructStarted = false;
function startSelfDestruct() {
  if (selfDestructStarted || !selfDestruct) return;
  selfDestructStarted = true;
  let seconds = CONFIG.selfDestructSeconds;
  function tick() {
    selfDestruct.textContent = `This message will self-destruct in ${seconds}`;
    if (seconds > 0) {
      seconds -= 1;
      setTimeout(tick, 1000);
    } else {
      document.body.classList.add('is-destroyed');
      setTimeout(() => {
        document.body.classList.remove('is-destroyed');
        selfDestruct.textContent = "…or not. Registration's still open.";
      }, 1200);
    }
  }
  tick();
}
if (selfDestruct && 'IntersectionObserver' in window) {
  const footerObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      footerObserver.disconnect();
      startSelfDestruct();
    }
  });
  footerObserver.observe(selfDestruct);
}

import './main.js?v=20261004-hero-v2';
import './film.js?v=20261004-hero-v2';

const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

function setupLeaks() {
  document.querySelectorAll('[data-leak]').forEach((card) => {
    card.addEventListener('click', () => {
      const open = card.getAttribute('aria-expanded') !== 'true';
      card.setAttribute('aria-expanded', String(open));
      card.classList.toggle('is-decrypted', open);
      card.querySelector('.leak-audience').hidden = !open;
      card.querySelector('.leak-hint').textContent = open ? 'Hide audience' : 'Reveal audience';
      card.querySelector('.leak-clearance').textContent = open ? 'DECLASSIFIED' : 'CLASSIFIED';
    });
  });
}

function setupDetails() {
  document.querySelectorAll('.criterion').forEach((row) => {
    [...row.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).forEach((node) => node.remove());
  });
  document.querySelectorAll('[data-fees]').forEach((node) => {
    const lines = node.textContent.split(' / ');
    node.replaceChildren(...lines.map((text) => {
      const line = document.createElement('span');
      line.className = 'fee-line';
      line.textContent = text;
      return line;
    }));
  });
}

function setupRegistration() {
  const dispatch = document.querySelector('.dispatch');
  const background = [...document.querySelectorAll('main, .topbar, .footer, .skip-link')];
  let timer;
  let activeLink;
  const reset = () => {
    clearTimeout(timer);
    dispatch.hidden = true;
    background.forEach((node) => { node.inert = false; });
    activeLink?.focus({ preventScroll: true });
    activeLink = null;
  };
  document.querySelectorAll('[data-link="register"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || motion.matches) return;
      event.preventDefault();
      if (activeLink) return;
      activeLink = link;
      dispatch.hidden = false;
      background.forEach((node) => { node.inert = true; });
      dispatch.focus({ preventScroll: true });
      timer = setTimeout(() => {
        window.location.assign(link.href);
      }, 750);
    });
  });
  window.addEventListener('pageshow', reset);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeLink) reset();
  });
  motion.addEventListener('change', () => {
    if (motion.matches && activeLink) {
      const href = activeLink.href;
      reset();
      window.location.assign(href);
    }
  });
}

setupLeaks();
setupDetails();
setupRegistration();

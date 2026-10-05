import './main.js?v=20261005-ui-v1';
import './film.js?v=20261005-ui-v1';

const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

const GLYPHS = 'ØX9#?%@!&$*0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function scrambleText(element, finalText, duration = 900) {
  if (motion.matches) {
    element.textContent = finalText;
    return;
  }
  if (element._scrambleTimer) {
    clearInterval(element._scrambleTimer);
  }
  const steps = 14;
  const interval = Math.floor(duration / steps);
  let step = 0;

  element._scrambleTimer = setInterval(() => {
    step += 1;
    const progress = step / steps;
    const revealedLength = Math.floor(progress * finalText.length);
    let output = finalText.slice(0, revealedLength);

    for (let i = revealedLength; i < finalText.length; i += 1) {
      const char = finalText[i];
      if (char === ' ') {
        output += ' ';
      } else {
        output += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
    }

    element.textContent = output;

    if (step >= steps) {
      clearInterval(element._scrambleTimer);
      element._scrambleTimer = null;
      element.textContent = finalText;
    }
  }, interval);
}

function setupLeaks() {
  document.querySelectorAll('[data-leak]').forEach((card) => {
    const cipherText = card.querySelector('.leak-cipher-text');
    const originalText = cipherText ? cipherText.textContent : '';

    card.addEventListener('click', () => {
      const open = card.getAttribute('aria-expanded') !== 'true';
      card.setAttribute('aria-expanded', String(open));
      card.classList.toggle('is-decrypted', open);
      card.querySelector('.leak-audience').hidden = !open;
      card.querySelector('.leak-hint').textContent = open ? 'Hide audience' : 'Reveal audience';
      card.querySelector('.leak-clearance').textContent = open ? 'DECLASSIFIED' : 'CLASSIFIED';

      if (cipherText) {
        if (open) {
          scrambleText(cipherText, originalText);
        } else {
          if (cipherText._scrambleTimer) {
            clearInterval(cipherText._scrambleTimer);
            cipherText._scrambleTimer = null;
          }
          cipherText.textContent = originalText;
        }
      }
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

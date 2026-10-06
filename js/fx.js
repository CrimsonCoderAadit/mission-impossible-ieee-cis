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
  const cards = document.querySelectorAll('[data-leak]');
  const dotsContainer = document.querySelector('.leak-dots');

  // Setup dots for mobile carousel
  if (dotsContainer && cards.length > 0) {
    dotsContainer.innerHTML = '';
    cards.forEach((card, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `leak-dot${index === 0 ? ' is-active' : ''}`;
      dot.setAttribute('aria-label', `Go to dossier file ${index + 1}`);
      dot.addEventListener('click', () => {
        card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
      dotsContainer.appendChild(dot);
    });

    // IntersectionObserver to sync active dot with scrolled card
    if ('IntersectionObserver' in window) {
      const dots = dotsContainer.querySelectorAll('.leak-dot');
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const index = Array.from(cards).indexOf(entry.target);
            if (index !== -1) {
              dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
            }
          }
        });
      }, {
        root: document.querySelector('.leak-grid'),
        threshold: 0.5
      });
      cards.forEach((card) => observer.observe(card));
    }
  }

  cards.forEach((card) => {
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

function setupTimelineFilter() {
  const filterBtns = document.querySelectorAll('.timeline-filter-btn');
  const rows = document.querySelectorAll('.timeline-row');
  if (!filterBtns.length || !rows.length) return;

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');

      const filter = btn.dataset.filter;
      rows.forEach((row) => {
        if (filter === 'all') {
          row.classList.remove('is-filtered-out');
        } else {
          const match = row.dataset.phase === filter;
          row.classList.toggle('is-filtered-out', !match);
        }
      });
    });
  });
}

function setupMobileNav() {
  const toggleBtn = document.querySelector('[data-toggle-nav]');
  const drawer = document.querySelector('#mobile-drawer');
  const mobileBar = document.querySelector('.mobile-bar');
  if (!drawer) return;

  const closeButtons = drawer.querySelectorAll('[data-close-nav]');
  const navLinks = drawer.querySelectorAll('[data-nav-link]');

  const openDrawer = () => {
    drawer.hidden = false;
    toggleBtn?.setAttribute('aria-expanded', 'true');
    toggleBtn?.classList.add('is-active');
    document.body.style.overflow = 'hidden';
  };

  const closeDrawer = () => {
    drawer.hidden = true;
    toggleBtn?.setAttribute('aria-expanded', 'false');
    toggleBtn?.classList.remove('is-active');
    document.body.style.overflow = '';
  };

  toggleBtn?.addEventListener('click', () => {
    if (drawer.hidden) {
      openDrawer();
    } else {
      closeDrawer();
    }
  });

  closeButtons.forEach((btn) => btn.addEventListener('click', closeDrawer));
  navLinks.forEach((link) => link.addEventListener('click', closeDrawer));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !drawer.hidden) {
      closeDrawer();
    }
  });

  // Smart auto-hide on downward scroll for mobile bar
  if (mobileBar) {
    let lastScrollY = window.scrollY;
    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          if (currentScrollY > 180 && currentScrollY > lastScrollY + 12 && drawer.hidden) {
            mobileBar.classList.add('is-hidden');
          } else if (currentScrollY < lastScrollY - 6 || currentScrollY <= 80) {
            mobileBar.classList.remove('is-hidden');
          }
          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }
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
  const background = [...document.querySelectorAll('main, .topbar, .footer, .skip-link, .mobile-bar, .mobile-drawer')];
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
setupTimelineFilter();
setupMobileNav();
setupDetails();
setupRegistration();


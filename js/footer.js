(function () {
  const STORAGE_KEY = 'olr_language';

  function getLang() {
    return localStorage.getItem(STORAGE_KEY) || 'en';
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
  }

  function syncSelectors(lang) {
    document.querySelectorAll('.footer-lang-select').forEach(sel => {
      sel.value = lang;
    });
  }

  function setGoogCookie(lang) {
    if (lang === 'en') {
      document.cookie = 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'googtrans=; path=/; domain=.' + location.hostname + '; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    } else {
      document.cookie = 'googtrans=/en/' + lang + '; path=/';
      document.cookie = 'googtrans=/en/' + lang + '; path=/; domain=.' + location.hostname;
    }
  }

  function applyLang(lang) {
    setLang(lang);
    syncSelectors(lang);
    setGoogCookie(lang);
    location.reload();
  }

  /* ── Re-translate dynamically loaded content ── */
  function retranslateDynamic() {
    const lang = getLang();
    if (!lang || lang === 'en') return;
    const combo = document.querySelector('.goog-te-combo');
    if (combo) combo.dispatchEvent(new Event('change'));
  }

  // Expose globally so index.js can call it after products render
  window.retranslateDynamic = retranslateDynamic;

  /* ── On page load: auto-apply stored language ── */
  function autoApplyLang() {
    const lang = getLang();
    if (!lang || lang === 'en') return;
    // Set cookie — Google Translate reads it automatically on page load
    setGoogCookie(lang);
    // Also try combo in case GT is already loaded
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const combo = document.querySelector('.goog-te-combo');
      if (combo) {
        clearInterval(interval);
        setTimeout(() => {
          combo.value = lang;
          combo.dispatchEvent(new Event('change'));
        }, 1500);
      } else if (attempts > 50) {
        clearInterval(interval);
      }
    }, 150);
  }

  function initFooterLang() {
    const selects = document.querySelectorAll('.footer-lang-select');
    if (!selects.length) return;
    syncSelectors(getLang());
    selects.forEach(select => {
      select.addEventListener('change', function () {
        applyLang(this.value);
      });
    });
  }

  /* ── Build menu ONCE, not on every click ── */
  function buildNavMenu(menu, footerSelect) {
    menu.innerHTML = '';
    const stored = getLang();
    Array.from(footerSelect.options).forEach(opt => {
      const item = document.createElement('div');
      item.className = 'nav-lang-item' + (opt.value === stored ? ' active' : '');
      item.textContent = opt.textContent;

      // mousedown fires before document click closes menu
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        menu.querySelectorAll('.nav-lang-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        menu.classList.remove('open');
        applyLang(opt.value);
      });

      // touchend for mobile
      item.addEventListener('touchend', (e) => {
        e.preventDefault();
        menu.querySelectorAll('.nav-lang-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        menu.classList.remove('open');
        applyLang(opt.value);
      });

      menu.appendChild(item);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initFooterLang();
    autoApplyLang();

    ['navLangBtn', 'navLangBtnMobile'].forEach(btnId => {
      const btn = document.getElementById(btnId);
      const menuId = btnId === 'navLangBtn' ? 'navLangMenu' : 'navLangMenuMobile';
      const menu = document.getElementById(menuId);
      const footerSelect = document.querySelector('.footer-lang-select');

      if (!btn || !menu || !footerSelect) return;

      // Build menu ONCE on init
      buildNavMenu(menu, footerSelect);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();

        // Smart positioning - never go off screen
        const rect = btn.getBoundingClientRect();
        const menuWidth = 210;
        const viewportWidth = window.innerWidth;

        let left = rect.left;
        if (left + menuWidth > viewportWidth - 10) {
          left = viewportWidth - menuWidth - 10;
        }
        if (left < 10) left = 10;

        menu.style.top = (rect.bottom + 8) + 'px';
        menu.style.left = left + 'px';
        menu.style.right = 'auto';
        menu.classList.toggle('open');
      });

      document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && e.target !== btn) {
          menu.classList.remove('open');
        }
      });
    });
  });

})();
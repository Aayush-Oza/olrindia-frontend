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

  function triggerTranslate(lang) {
    document.cookie = 'googtrans=/en/' + lang + '; path=/';
    document.cookie = 'googtrans=/en/' + lang + '; path=/; domain=.' + location.hostname;

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const combo = document.querySelector('.goog-te-combo');
      if (combo) {
        clearInterval(interval);
        combo.value = lang;
        combo.dispatchEvent(new Event('change'));
      } else if (attempts > 50) {
        clearInterval(interval);
      }
    }, 150);
  }

  function retranslateDynamic() {
    const lang = getLang();
    if (!lang || lang === 'en') return;
    const combo = document.querySelector('.goog-te-combo');
    if (combo) combo.dispatchEvent(new Event('change'));
  }

  window.retranslateDynamic = retranslateDynamic;

  function autoApplyLang() {
    const lang = getLang();
    if (!lang || lang === 'en') return;

    document.cookie = 'googtrans=/en/' + lang + '; path=/';
    document.cookie = 'googtrans=/en/' + lang + '; path=/; domain=.' + location.hostname;

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
        const lang = this.value;
        setLang(lang);
        syncSelectors(lang);
        triggerTranslate(lang);
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

      // Use mousedown instead of click — fires before document click closes menu
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // prevent blur/close race
        const lang = opt.value;
        setLang(lang);
        syncSelectors(lang);
        triggerTranslate(lang);
        menu.querySelectorAll('.nav-lang-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        menu.classList.remove('open');
      });

      // Touch support for mobile - same fix
      item.addEventListener('touchend', (e) => {
        e.preventDefault();
        const lang = opt.value;
        setLang(lang);
        syncSelectors(lang);
        triggerTranslate(lang);
        menu.querySelectorAll('.nav-lang-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        menu.classList.remove('open');
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

      // Build menu ONCE here, not on every click
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
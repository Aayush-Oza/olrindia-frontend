(function () {
  const STORAGE_KEY = 'olr_language';

  // Store original labels BEFORE Google Translate touches them
  const LANG_LABELS = {};
  document.querySelectorAll('.footer-lang-select option').forEach(opt => {
    LANG_LABELS[opt.value] = opt.textContent;
  });

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
    setGoogCookie(lang);
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

  function buildNavMenu(menu, footerSelect) {
    menu.innerHTML = '';
    const stored = getLang();
    Array.from(footerSelect.options).forEach(opt => {
      const item = document.createElement('div');
      item.className = 'nav-lang-item notranslate' + (opt.value === stored ? ' active' : '');
      item.setAttribute('translate', 'no');
      item.textContent = LANG_LABELS[opt.value] || opt.textContent;

      let touchStartY = 0;  // ← track where the finger landed

      item.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
      }, { passive: true });

      item.addEventListener('touchend', (e) => {
        const delta = Math.abs(e.changedTouches[0].clientY - touchStartY);
        if (delta > 8) return;  // ← finger moved = scroll, not a tap, ignore it
        e.preventDefault();
        menu.querySelectorAll('.nav-lang-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        menu.classList.remove('open');
        applyLang(opt.value);
      });

      item.addEventListener('mousedown', (e) => {
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

      buildNavMenu(menu, footerSelect);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();

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
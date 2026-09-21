/* ══════════════════════════════════════════════════════
   footer.js -language selector + Google Translate
   Session-based: language persists across all pages
   ══════════════════════════════════════════════════════ */

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

  /* ── Core: trigger Google Translate ── */
  function triggerTranslate(lang) {
    if (lang === 'en') {
      // Reset to English via cookie + reload
      document.cookie = 'googtrans=/en/en; path=/';
      document.cookie = 'googtrans=/en/en; path=/; domain=.' + location.hostname;
      location.reload();
      return;
    }

    // Set cookie so GT picks it up
    document.cookie = 'googtrans=/en/' + lang + '; path=/';
    document.cookie = 'googtrans=/en/' + lang + '; path=/; domain=.' + location.hostname;

    // Try the combo box directly
    const combo = document.querySelector('.goog-te-combo');
    if (combo) {
      combo.value = lang;
      combo.dispatchEvent(new Event('change'));
    } else {
      // If widget not ready yet, reload -cookie will auto-apply
      location.reload();
    }
  }

  /* ── On page load: auto-apply stored language ── */
  function autoApplyLang() {
    const lang = getLang();
    if (!lang || lang === 'en') return;

    // Set the cookie first
    document.cookie = 'googtrans=/en/' + lang + '; path=/';
    document.cookie = 'googtrans=/en/' + lang + '; path=/; domain=.' + location.hostname;

    // Poll for GT combo to be ready (up to 5s)
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const combo = document.querySelector('.goog-te-combo');
      if (combo) {
        clearInterval(interval);
        combo.value = lang;
        combo.dispatchEvent(new Event('change'));
      } else if (attempts > 33) { // ~5s
        clearInterval(interval);
      }
    }, 150);
  }

  /* ── Init selector ── */
  function initFooterLang() {
    const selects = document.querySelectorAll('.footer-lang-select');
    if (!selects.length) return;

    const stored = getLang();
    syncSelectors(stored);

    selects.forEach(select => {
      select.addEventListener('change', function () {
        const lang = this.value;
        setLang(lang);
        syncSelectors(lang);
        triggerTranslate(lang);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initFooterLang();
    autoApplyLang();
    ['navLangBtn', 'navLangBtnMobile'].forEach(btnId => {
      const btn = document.getElementById(btnId);
      const menu = btnId === 'navLangBtn'
        ? document.getElementById('navLangMenu')
        : document.getElementById('navLangMenuMobile');
      const footerSelect = document.querySelector('.footer-lang-select');
      if (!btn || !menu || !footerSelect) return;

      function buildMenu() {
        menu.innerHTML = '';
        Array.from(footerSelect.options).forEach(opt => {
          const item = document.createElement('div');
          item.className = 'nav-lang-item' + (opt.value === footerSelect.value ? ' active' : '');
          item.textContent = opt.textContent;
          item.addEventListener('click', () => {
            footerSelect.value = opt.value;
            footerSelect.dispatchEvent(new Event('change', { bubbles: true }));
            menu.classList.remove('open');
          });
          menu.appendChild(item);
        });
      }

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        buildMenu();
        menu.classList.toggle('open');
      });

      document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && e.target !== btn) menu.classList.remove('open');
      });
    });
  });

})();
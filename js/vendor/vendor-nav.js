/* ============================================================
   OLR INDIA – VENDOR NAV  (shared across all dashboard pages)
   Load BEFORE page-specific JS.
   ============================================================ */

let vendorProfile = null;

function renderNavAvatar() {
  if (!vendorProfile) return;
  const initial = getInitials(vendorProfile.name || 'V');
  ['navUserAvatar', 'navUserAvatarMobile'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = vendorProfile.profile_photo
      ? `<img src="${vendorProfile.profile_photo}" alt="">`
      : initial;
  });
  const nameEl = document.getElementById('navUserName');
  const nameElM = document.getElementById('navUserNameMobile');
  if (nameEl) nameEl.textContent = vendorProfile.name || '';
  if (nameElM) nameElM.textContent = vendorProfile.name || '';
}

function renderSuspendedBanner(extraSelectors = '') {
  if (!vendorProfile) return;
  const banner = document.getElementById('suspendedBanner');
  if (!banner) return;
  if (!vendorProfile.is_active) {
    banner.style.display = 'block';
    const sel = ['#addProductBtn', '#planUsageUpgradeBtn', extraSelectors]
      .filter(Boolean).join(', ');
    if (sel) document.querySelectorAll(sel).forEach(btn => {
      btn.disabled = true; btn.style.opacity = '0.4'; btn.style.cursor = 'not-allowed';
    });
  } else {
    banner.style.display = 'none';
  }
}

async function loadVendorProfile(onLoaded) {
  const res = await apiRequest('/auth/vendor/profile', 'GET');
  if (!res.success) return;
  vendorProfile = res.vendor;
  renderNavAvatar();
  renderSuspendedBanner();
  if (typeof onLoaded === 'function') onLoaded(vendorProfile);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hamburgerBtn')?.addEventListener('click', () =>
    document.getElementById('mobileMenu').classList.toggle('open')
  );
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 860) document.getElementById('mobileMenu')?.classList.remove('open');
});
/* ============================================================
   OLR INDIA - VENDOR NAV (shared across all vendor pages)
   Provides: renderNavAvatar, renderSuspendedBanner, loadVendorProfile
   Requires: vendorProfile (declared in each page's own JS)
   ============================================================ */

const PLAN_LABELS = {
  free: 'Free',
  starter: 'Starter', starter_yearly: 'Starter Yearly',
  growth: 'Growth',   growth_yearly: 'Growth Yearly',
  premium: 'Premium', premium_yearly: 'Premium Yearly',
};

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
  const nameEl  = document.getElementById('navUserName');
  const nameElM = document.getElementById('navUserNameMobile');
  if (nameEl)  nameEl.textContent  = vendorProfile.name || '';
  if (nameElM) nameElM.textContent = vendorProfile.name || '';
}

function renderSuspendedBanner(disableSelectors = '') {
  if (!vendorProfile) return;
  const banner = document.getElementById('suspendedBanner');
  if (!banner) return;
  if (!vendorProfile.is_active) {
    banner.style.display = 'block';
    if (disableSelectors) {
      document.querySelectorAll(disableSelectors).forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed';
      });
    }
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
  if (typeof onLoaded === 'function') onLoaded();
}
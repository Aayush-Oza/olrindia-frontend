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

const PLAN_PRICES = {
  starter: 249, growth: 449, premium: 999,
  starter_yearly: 2499, growth_yearly: 4499, premium_yearly: 9999,
};

const PLAN_YEARLY_DISCOUNT = {
  starter_yearly: { original: 2988,  saving: 489,  percent: 16 },
  growth_yearly:  { original: 5388,  saving: 889,  percent: 17 },
  premium_yearly: { original: 11988, saving: 1989, percent: 17 },
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

// ── Plan usage strip ──────────────────────────────────────────
function renderPlanUsageStrip() {
  if (!vendorProfile) return;
  const v = vendorProfile;
  const strip = document.getElementById('planUsageStrip');
  const badgeEl = document.getElementById('planUsageBadge');
  const textEl = document.getElementById('planUsageText');
  const fillEl = document.getElementById('planUsageBarFill');
  if (!strip || !badgeEl || !textEl || !fillEl) return;
  strip.style.display = '';
  badgeEl.textContent = PLAN_LABELS[v.subscription_plan] || v.subscription_plan;
  const used = v.active_product_count ?? 0;
  const limit = v.max_active_posts;
  if (limit === null || limit === undefined) {
    textEl.textContent = `${used} active listings - unlimited on your plan`;
    fillEl.style.width = '8%';
    fillEl.classList.remove('danger');
  } else {
    textEl.textContent = `${used} of ${limit} active listings used`;
    const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
    fillEl.style.width = pct + '%';
    fillEl.classList.toggle('danger', pct >= 90);
  }
}

document.getElementById('planUsageUpgradeBtn')?.addEventListener('click', () => openUpgradeModal());

async function loadVendorProfile(onLoaded) {
  const res = await apiRequest('/auth/vendor/profile', 'GET');
  if (!res.success) return;
  vendorProfile = res.vendor;
  renderNavAvatar();
  renderSuspendedBanner();
  renderPlanUsageStrip();
  if (typeof onLoaded === 'function') onLoaded();
}
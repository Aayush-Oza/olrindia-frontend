/* ============================================================
   OLR INDIA – VENDOR PROFILE JS  (profile.html)
   Requires: vendor-nav.js, vendor-upgrade.js
   ============================================================ */

// ── Load & render profile ─────────────────────────────────────
async function loadVendorProfile() {
  const res = await apiRequest('/auth/vendor/profile', 'GET');
  if (!res.success) return;
  vendorProfile = res.vendor;
  renderNavAvatar();
  renderSuspendedBanner('#profileForm button[type="submit"], #profileAvatarEditBtn, #profileAvatarRemoveBtn');
  renderProfileFields();
  renderProfileAvatar();
  renderProfilePlanSection();
  await loadBillingHistory();
}


function renderProfileFields() {
  const v = vendorProfile;
  const nameEl = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  const infoEmail = document.getElementById('infoEmail');
  if (nameEl) nameEl.textContent = v.name || '';
  if (emailEl) emailEl.textContent = v.email || '';
  if (infoEmail) infoEmail.textContent = v.email || '';
  const form = document.getElementById('profileForm');
  if (!form) return;
  form.querySelector('[name="name"]').value = v.name || '';
  form.querySelector('[name="mobile"]').value = v.mobile || '';
  form.querySelector('[name="gst_number"]').value = v.gst_number || '';
  form.querySelector('[name="pincode"]').value = v.pincode || '';
  form.querySelector('[name="area"]').value = v.area || '';
  form.querySelector('[name="city"]').value = v.city || '';
  form.querySelector('[name="state"]').value = v.state || '';
  const verifiedBadge = document.getElementById('verifiedBadge');
  const featuredBadge = document.getElementById('featuredBadge');
  if (verifiedBadge) verifiedBadge.style.display = v.badge === 'verified' ? '' : 'none';
  if (featuredBadge) featuredBadge.style.display = v.badge === 'featured' ? '' : 'none';
}

function renderProfileAvatar() {
  if (!vendorProfile) return;
  const avatarBig = document.getElementById('profileAvatar');
  const avatarImg = document.getElementById('profileAvatarImg');
  const removeBtn = document.getElementById('profileAvatarRemoveBtn');
  if (!avatarBig || !avatarImg) return;
  if (vendorProfile.profile_photo) {
    avatarImg.src = vendorProfile.profile_photo;
    avatarImg.style.display = 'block';
    avatarBig.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'inline-flex';
  } else {
    avatarImg.style.display = 'none';
    avatarBig.style.display = 'flex';
    avatarBig.textContent = getInitials(vendorProfile.name || 'V');
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

function renderProfilePlanSection() {
  const el = document.getElementById('profilePlanSection');
  if (!el || !vendorProfile) return;
  const v = vendorProfile;
  const plan = v.subscription_plan || 'free';
  const label = PLAN_LABELS[plan] || plan;
  const expires = v.subscription_expires_at;
  const badge = v.badge;
  const used = v.active_product_count ?? 0;
  const limit = v.max_active_posts;
  let expiryHtml = '';
  if (expires && plan !== 'free') {
    const formatted = parseExpiryDate(expires).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const expiryLabel = v.expiry_label || null;
    const urgentClass = expiryLabel ? 'expiring-soon' : '';
    const urgentText = expiryLabel ? ` (${expiryLabel})` : '';
    expiryHtml = `<div class="profile-plan-expires ${urgentClass}">Active until ${formatted}${urgentText}</div>`;
  }
  let badgeHtml = '';
  if (badge === 'verified') badgeHtml = `<span class="profile-plan-badge verified">✓ Verified vendor badge</span>`;
  else if (badge === 'featured') badgeHtml = `<span class="profile-plan-badge featured">★ Featured vendor badge</span>`;
  let pendingHtml = '';
  if (v.pending_plan && v.pending_plan !== plan) {
    const pendingLabel = PLAN_LABELS[v.pending_plan] || v.pending_plan;
    pendingHtml = `<div class="profile-plan-expires" style="color:var(--c-ink-faint);margin-top:4px;">🔄 Switches to ${pendingLabel} after current period ends</div>`;
  }
  const limitText = limit === null ? 'Unlimited active listings' : `${used} of ${limit} active listings used`;
  el.innerHTML = `
    <div class="profile-plan-section">
      <div class="profile-plan-left">
        <div class="profile-plan-label">Current plan</div>
        <div class="profile-plan-name">${label}</div>
        <div class="profile-plan-detail">${limitText}</div>
        ${badgeHtml}${expiryHtml}${pendingHtml}
      </div>
      <button class="btn btn-primary" style="width:auto;padding:10px 20px;flex-shrink:0;" onclick="openUpgradeModal()">
        ${plan === 'premium' ? 'Manage plan' : 'Upgrade plan'}
      </button>
    </div>`;
}

// ── Billing history ───────────────────────────────────────────
async function loadBillingHistory() {
  const res = await apiRequest('/auth/vendor/billing', 'GET');
  if (!res.success) return;
  const el = document.getElementById('billingHistorySection');
  if (!el) return;
  const billing = res.billing;
  if (!billing || billing.length === 0) {
    el.innerHTML = `<p style="color:var(--c-ink-faint);font-size:13.5px;">No payment history yet.</p>`; return;
  }
  el.innerHTML = billing.map(b => {
    const start = b.period_start ? new Date(b.period_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
    const end = b.period_end ? new Date(b.period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
    const tag = b.is_current
      ? `<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">CURRENT</span>`
      : b.is_future
        ? `<span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">UPCOMING</span>`
        : `<span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">PAST</span>`;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--c-border-soft);gap:12px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${PLAN_LABELS[b.plan] || b.plan} &nbsp; ${tag}</div>
          <div style="font-size:12.5px;color:var(--c-ink-faint);">${start} → ${end}</div>
        </div>
        <div style="font-weight:700;font-size:15px;color:var(--c-blue-deep);">₹${b.amount_inr}</div>
      </div>`;
  }).join('');
}

// ── Profile photo ─────────────────────────────────────────────
document.getElementById('profileAvatarEditBtn')?.addEventListener('click', () => document.getElementById('profilePhotoInput').click());

document.getElementById('profileAvatarRemoveBtn')?.addEventListener('click', async () => {
  const confirmed = await showConfirm({ title: 'Remove profile photo?', text: 'Your profile will show your initials instead.', confirmLabel: 'Remove', cancelLabel: 'Cancel' });
  if (!confirmed) return;
  const res = await apiRequest('/auth/vendor/profile/photo', 'DELETE');
  if (res.success) { toastSuccess('Profile photo removed.'); await loadVendorProfile(); }
  else toastError(res.message || 'Failed to remove photo.');
});

document.getElementById('profilePhotoInput')?.addEventListener('change', async function () {
  const file = this.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('photo', file);
  const resp = await fetch(API_BASE + '/auth/vendor/profile/photo', { method: 'PUT', body: fd, credentials: 'include' });
  const res = await resp.json();
  if (res.success) { toastSuccess('Profile photo updated!'); await loadVendorProfile(); }
  else toastError(res.message || 'Failed to update photo.');
  this.value = '';
});

// ── Profile form submit ───────────────────────────────────────
document.getElementById('profileForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const saveBtn = form.querySelector('button[type="submit"]');
  setButtonLoading(saveBtn, true);
  const data = {
    name: form.querySelector('[name="name"]').value.trim(),
    mobile: form.querySelector('[name="mobile"]').value.trim(),
    gst_number: form.querySelector('[name="gst_number"]').value.trim(),
    pincode: form.querySelector('[name="pincode"]').value.trim(),
    area: form.querySelector('[name="area"]').value.trim(),
    city: form.querySelector('[name="city"]').value.trim(),
    state: form.querySelector('[name="state"]').value.trim(),
  };
  const res = await apiRequest('/auth/vendor/profile', 'PUT', data);
  setButtonLoading(saveBtn, false);
  if (res.success) { toastSuccess('Profile saved!'); await loadVendorProfile(); }
  else toastError(res.message || 'Failed to save profile.');
});

// ── Upgrade modal ─────────────────────────────────────────────
// ── Pincode autofill ──────────────────────────────────────────
function initModalPincodeAutofill() {
  const pincodeInput = document.getElementById('modalPincode');

  if (!pincodeInput) return;

  wirePincodeAutofill({
    pincodeInput,
    areaInput: document.getElementById('modalArea'),
    cityInput: document.getElementById('modalCity'),
    stateInput: document.getElementById('modalState'),
    statusEl: document.getElementById('modalPincodeStatus'),
  });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  wirePincodeAutofill({
    pincodeInput: document.getElementById('pincode'),
    areaInput: document.getElementById('area'),
    cityInput: document.getElementById('city'),
    stateInput: document.getElementById('state'),
    statusEl: document.getElementById('pincodeStatus'),
  });
  loadVendorProfile();
});
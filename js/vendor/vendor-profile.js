/* ============================================================
   OLR INDIA – VENDOR PROFILE JS  (profile.html)
   ============================================================ */

let vendorProfile = null;
const PLAN_LABELS = { free: 'Free', starter: 'Starter', growth: 'Growth', premium: 'Premium' };

// ── Nav avatar ────────────────────────────────────────────────
function renderNavAvatar() {
  if (!vendorProfile) return;
  const initial = getInitials(vendorProfile.name || 'V');
  ['navUserAvatar', 'navUserAvatarMobile'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = vendorProfile.profile_photo ? `<img src="${vendorProfile.profile_photo}" alt="">` : initial;
  });
  const nameEl = document.getElementById('navUserName');
  const nameElM = document.getElementById('navUserNameMobile');
  if (nameEl) nameEl.textContent = vendorProfile.name || '';
  if (nameElM) nameElM.textContent = vendorProfile.name || '';
}

// ── Suspended banner ──────────────────────────────────────────
function renderSuspendedBanner() {
  if (!vendorProfile) return;
  const banner = document.getElementById('suspendedBanner');
  if (!banner) return;
  if (!vendorProfile.is_active) {
    banner.style.display = 'block';
    document.querySelectorAll('#profileForm button[type="submit"], #profileAvatarEditBtn, #profileAvatarRemoveBtn').forEach(btn => {
      btn.disabled = true; btn.style.opacity = '0.4'; btn.style.cursor = 'not-allowed';
    });
  } else {
    banner.style.display = 'none';
  }
}

// ── Load & render profile ─────────────────────────────────────
async function loadVendorProfile() {
  const res = await apiRequest('/auth/vendor/profile', 'GET');
  if (!res.success) return;
  vendorProfile = res.vendor;
  renderNavAvatar();
  renderSuspendedBanner();
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
    const d = new Date(expires);
    const now = new Date();
    const daysLeft = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    const formatted = d.toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    const urgentClass = daysLeft <= 7 ? 'expiring-soon' : '';
    const urgentText = daysLeft <= 7 ? ` (${daysLeft} day${daysLeft === 1 ? '' : 's'} left!)` : '';
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
    const start = b.period_start ? new Date(b.period_start).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '-';
    const end = b.period_end ? new Date(b.period_end).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '-';
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
function openUpgradeModal(message) {
  const sub = document.getElementById('upgradeModalText');
  if (sub) sub.textContent = message || 'Upgrade your plan to list more products and get better visibility.';
  renderPlanCards();
  document.getElementById('upgradeModalOverlay').classList.add('open');
}

document.getElementById('upgradeModalCancel')?.addEventListener('click', () => document.getElementById('upgradeModalOverlay').classList.remove('open'));
document.getElementById('upgradeModalOverlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('upgradeModalOverlay')) document.getElementById('upgradeModalOverlay').classList.remove('open');
});

function renderPlanCards() {
  if (!vendorProfile) return;
  const current = vendorProfile.subscription_plan || 'free';
  const expires = vendorProfile.subscription_expires_at;
  const bar = document.getElementById('plansCurrentBar');
  if (bar) {
    const planName = PLAN_LABELS[current] || current;
    let expiryText = '';
    if (expires && current !== 'free') {
      const d = new Date(expires);
      expiryText = ` · renews ${d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`;
    }
    bar.innerHTML = `You're on <strong>${planName}</strong>${expiryText}`;
  }
  const order = ['free','starter','growth','premium'];
  const currentIdx = order.indexOf(current);
  order.forEach((plan, idx) => {
    const card = document.getElementById(`planCard-${plan}`);
    const tag = document.getElementById(`planTag-${plan}`);
    const btn = document.getElementById(`planBtn-${plan}`);
    if (!card) return;
    if (plan === 'free') { card.style.display = current !== 'free' ? 'flex' : 'none'; return; }
    card.style.display = 'flex'; card.style.flexDirection = 'column';
    const isCurrent = plan === current, isLower = idx < currentIdx;
    if (tag) tag.style.display = isCurrent ? 'block' : 'none';
    if (btn) {
      if (isCurrent) { btn.disabled = true; btn.querySelector('.btn-label').textContent = 'Current plan'; }
      else if (isLower) { btn.disabled = true; btn.querySelector('.btn-label').textContent = 'Downgrade'; btn.style.opacity = '0.35'; }
      else { btn.disabled = false; btn.style.opacity = '1'; btn.querySelector('.btn-label').textContent = `Get ${plan.charAt(0).toUpperCase() + plan.slice(1)}`; }
      setButtonLoading(btn, false);
    }
  });
}

async function handlePlanSelect(plan) {
  const btn = document.getElementById(`planBtn-${plan}`);
  try {
    setButtonLoading(btn, true);
    const res = await apiRequest('/auth/vendor/subscribe', 'POST', { plan });
    if (!res.success) { toastError(res.message || 'Could not start payment.'); setButtonLoading(btn, false); return; }
    setButtonLoading(btn, false);
    const options = {
      key: res.key_id, amount: res.amount, currency: res.currency,
      name: 'OLR India', description: `${res.plan_label} Plan · 30 days`, order_id: res.order_id,
      prefill: { name: res.vendor?.name || '', email: res.vendor?.email || '' },
      theme: { color: '#2563eb' },
      handler: async function (response) {
        document.getElementById('upgradeModalOverlay').classList.remove('open');
        const vRes = await apiRequest('/auth/vendor/payment/verify', 'POST', { razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature });
        if (vRes.success) { toastSuccess(`🎉 ${vRes.message}`); await loadVendorProfile(); }
        else toastError(vRes.message || 'Payment verification failed. Contact support.');
      },
      modal: { ondismiss: () => setButtonLoading(btn, false) },
    };
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', r => { toastError(`Payment failed: ${r.error.description || 'Try again.'}`); setButtonLoading(btn, false); });
    rzp.open();
  } catch (err) { toastError('Something went wrong.'); if (btn) setButtonLoading(btn, false); }
}

// ── Pincode autofill ──────────────────────────────────────────
function initProfilePincodeAutofill() {
  wirePincodeAutofill({
    pincodeInput: document.getElementById('edit_pincode'),
    areaInput: document.getElementById('edit_area'),
    cityInput: document.getElementById('edit_city'),
    stateInput: document.getElementById('edit_state'),
    statusEl: document.getElementById('profilePincodeStatus'),
  });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hamburgerBtn')?.addEventListener('click', () => document.getElementById('mobileMenu').classList.toggle('open'));
  initProfilePincodeAutofill();
  loadVendorProfile();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 860) document.getElementById('mobileMenu')?.classList.remove('open');
});
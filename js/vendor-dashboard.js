/* ============================================================
   OLR INDIA - VENDOR DASHBOARD JS
   NOTE: vendor-auth.js handles page init - calling loadCategories,
   loadProducts, initImageSlots, and profile form submit.
   This file only defines dashboard functions and wires its own
   UI events. Nothing here duplicates what auth.js already does.
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
let allProducts = [];
let CATEGORIES = {};
let vendorProfile = null;
let editingId = null;
const slotFiles = {};
const slotUrls = {};
let previewProductId = null;
let originalProductSnapshot = null;
// ── View Site state ───────────────────────────────────────────
let vsAllProducts = [];
let vsFilteredProducts = [];
let vsCurrentPage = 1;
let vsTotalProducts = 0;
let vsHasMore = false;
let vsIsLoadingMore = false;
let vsSentinel = null;
let vsScrollObserver = null;
let vsActiveFilters = {
  category: '', city: '', priceType: 'day', priceMin: 0, priceMax: Infinity,
};

function slugify(text) {
  return (text || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
const PLAN_LABELS = {
  free: 'Free',
  starter: 'Starter',
  growth: 'Growth',
  premium: 'Premium'
};

// ── Tab switching ─────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.tab === name));
  document.querySelectorAll('.mobile-nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.tab === name));
  document.querySelectorAll('.dash-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'panel-' + name));
  document.getElementById('mobileMenu').classList.remove('open');
  history.replaceState(null, '', '#' + name);
}

// ── Load categories ───────────────────────────────────────────
// Called by vendor-auth.js after profile loads
async function loadCategories() {
  const res = await apiRequest('/auth/vendor/categories', 'GET');
  if (res.success) CATEGORIES = res.categories;
  const sel = document.getElementById('modalCategory');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select category</option>';
  Object.keys(CATEGORIES).forEach(cat => {
    const o = document.createElement('option');
    o.value = cat; o.textContent = cat;
    sel.appendChild(o);
  });
}

// Subcategory cascade
document.getElementById('modalCategory')?.addEventListener('change', function () {
  const subSel = document.getElementById('modalSubcategory');
  subSel.innerHTML = '<option value="">Select subcategory (optional)</option>';
  (CATEGORIES[this.value] || []).forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    subSel.appendChild(o);
  });
});

// ── Category-aware rent field visibility ──────────────────────
const RENT_FIELDS_BY_CATEGORY = {
  "Passenger Vehicles": ["hour", "km", "day", "month"],
  "Bikes & Scooters": ["hour", "km", "day", "month"],
  "Commercial Vehicles": ["hour", "km", "day", "month"],
  "Cargo & Shipping": ["hour", "km", "day", "month"],
  "Construction Equipment": ["hour", "day", "month"],
  "Furniture & Home Appliances": ["day", "month"],
  "Photography & Content Creator Gear": ["hour", "day"],
  "Events & Weddings": ["hour", "day"],
  "Fashion & Designer Wear": ["day"],
  "Agricultural Equipment": ["hour", "day", "month"],
  "Medical Equipment": ["hour", "day", "month"],
  "Baby & Kids Gear": ["day", "month"],
  "Adventure & Trekking Gear": ["day", "month"],
  "Sports & Fitness Equipment": ["hour", "day", "month"],
  "Electrical & Power Tools": ["hour", "day", "month"],
  "Tools & Tackles": ["hour", "day", "month"],
  "Properties": ["day", "month"],
  "Industrial Equipment": ["hour", "day", "month"],
  "Warehouse & Storage": ["day", "month"],
  "Machineries": ["hour", "day", "month"],
  "Musical Instruments": ["day", "month"],
};

function updateRentFields() {
  const cat = document.getElementById('modalCategory').value;
  const allowed = RENT_FIELDS_BY_CATEGORY[cat] || ["day", "month"];
  ["hour", "km", "day", "month"].forEach(field => {
    const wrap = document.getElementById(`rentWrap_${field}`);
    const input = document.querySelector(`[name="rent_per_${field}"]`);
    if (!wrap || !input) return;
    const show = allowed.includes(field);
    wrap.style.display = show ? '' : 'none';
    if (!show) input.value = '';
  });
}

document.getElementById('modalCategory')?.addEventListener('change', updateRentFields);
// ── Pincode autofill - product modal only ─────────────────────
// Profile form pincode is already wired by vendor-auth.js.
// wirePincodeAutofill() is defined in vendor-auth.js with signature
// { pincodeInput, areaInput, cityInput, stateInput, statusEl } (DOM elements).
function initModalPincodeAutofill() {
  wirePincodeAutofill({
    pincodeInput: document.getElementById('modalPincode'),
    areaInput: document.getElementById('modalArea'),
    cityInput: document.getElementById('modalCity'),
    stateInput: document.getElementById('modalState'),
    statusEl: document.getElementById('modalPincodeStatus'),
  });
}
// ── Load vendor profile (plan strip + nav avatar) ─────────────
// Also called after any product status change so counts stay fresh.
async function loadVendorProfile() {
  const res = await apiRequest('/auth/vendor/profile', 'GET');
  if (!res.success) return;
  vendorProfile = res.vendor;
  renderPlanUsageStrip();
  renderNavAvatar();
  renderProfileAvatar();
  renderSuspendedBanner();
  renderProfilePlanSection();
  await loadBillingHistory();
}
function renderSuspendedBanner() {
  if (!vendorProfile) return;
  const banner = document.getElementById('suspendedBanner');
  if (!banner) return;
  if (!vendorProfile.is_active) {
    banner.style.display = 'block';
    // disable all action buttons except logout
    document.querySelectorAll(
      '#addProductBtn, #planUsageUpgradeBtn, #profileForm button[type="submit"], #profileAvatarEditBtn, #profileAvatarRemoveBtn'
    ).forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.style.cursor = 'not-allowed';
    });
    document.querySelectorAll('[data-tab="chats"]').forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.style.cursor = 'not-allowed';
    });
  } else {
    banner.style.display = 'none';
  }
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
function renderNavAvatar() {
  if (!vendorProfile) return;
  const initial = getInitials(vendorProfile.name || 'V');
  ['navUserAvatar', 'navUserAvatarMobile'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (vendorProfile.profile_photo) {
      el.innerHTML = `<img src="${vendorProfile.profile_photo}" alt="">`;
    } else {
      el.textContent = initial;
    }
  });
  const nameEl = document.getElementById('navUserName');
  const nameElM = document.getElementById('navUserNameMobile');
  if (nameEl) nameEl.textContent = vendorProfile.name || '';
  if (nameElM) nameElM.textContent = vendorProfile.name || '';
}

function renderPlanUsageStrip() {
  if (!vendorProfile) return;
  const v = vendorProfile;
  const badgeEl = document.getElementById('planUsageBadge');
  const textEl = document.getElementById('planUsageText');
  const fillEl = document.getElementById('planUsageBarFill');
  if (!badgeEl || !textEl || !fillEl) return;

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

document.getElementById('planUsageUpgradeBtn')?.addEventListener('click', () => {
  openUpgradeModal();
});

// ── Profile photo upload ──────────────────────────────────────
document.getElementById('profileAvatarEditBtn')?.addEventListener('click', () => {
  document.getElementById('profilePhotoInput').click();
});
document.getElementById('profileAvatarRemoveBtn')?.addEventListener('click', async () => {
  const confirmed = await showConfirm({
    title: 'Remove profile photo?',
    text: 'Your profile will show your initials instead.',
    confirmLabel: 'Remove',
    cancelLabel: 'Cancel',
  });
  if (!confirmed) return;
  const res = await apiRequest('/auth/vendor/profile/photo', 'DELETE');
  if (res.success) {
    toastSuccess('Profile photo removed.');
    await loadVendorProfile();
  } else {
    toastError(res.message || 'Failed to remove photo.');
  }
});
document.getElementById('profilePhotoInput')?.addEventListener('change', async function () {
  const file = this.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('photo', file);
  const resp = await fetch(API_BASE + '/auth/vendor/profile/photo', {
    method: 'PUT', body: fd, credentials: 'include'
  });
  const res = await resp.json();
  if (res.success) {
    toastSuccess('Profile photo updated!');
    await loadVendorProfile();
  } else {
    toastError(res.message || 'Failed to update photo.');
  }
  this.value = '';
});
function renderExpiryBanner(banner) {
  let el = document.getElementById('expiryBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'expiryBanner';
    // Insert it right above the product grid
    const grid = document.getElementById('productGrid');
    grid?.parentNode.insertBefore(el, grid);
  }
  if (!banner || !banner.show) {
    el.style.display = 'none';
    return;
  }
  el.style.cssText = `
    display:flex; align-items:center; justify-content:space-between;
    background:#fff7ed; border:1px solid #f97316; color:#9a3412;
    padding:12px 16px; border-radius:8px; margin-bottom:16px;
    font-size:13.5px; gap:12px; flex-wrap:wrap;
  `;
  el.innerHTML = `
    <span>⚠️ ${banner.message}</span>
    <button class="btn btn-primary" style="width:auto;padding:8px 16px;flex-shrink:0;font-size:13px;"
      onclick="openUpgradeModal()">Renew Now</button>
  `;
}
// ── Load products ─────────────────────────────────────────────
// Called by vendor-auth.js after profile loads, and after any CRUD action.
async function loadProducts() {
  const res = await apiRequest('/auth/vendor/products', 'GET');
  if (!res.success) return;
  allProducts = res.products;
  renderProducts();
  updateStats();
  renderExpiryBanner(res.expiry_banner);
  await loadVendorProfile(); // keep plan strip + nav fresh
}

function updateStats() {
  const totalEl = document.getElementById('statTotal');
  const activeEl = document.getElementById('statActive');
  const clicksEl = document.getElementById('statClicks');
  if (totalEl) totalEl.textContent = allProducts.length;
  if (activeEl) activeEl.textContent = allProducts.filter(p => p.is_active).length;
  if (clicksEl) clicksEl.textContent = allProducts.reduce((s, p) => s + (p.click_count || 0), 0);
}

function rentLine(p) {
  if (p.rent_per_hour) return `₹${p.rent_per_hour} <span>/ hour</span>`;
  if (p.rent_per_km) return `₹${p.rent_per_km} <span>/ km</span>`;
  if (p.rent_per_day) return `₹${p.rent_per_day} <span>/ day</span>`;
  if (p.rent_per_month) return `₹${p.rent_per_month} <span>/ month</span>`;
  return `<span style="font-size:12px;color:var(--c-ink-faint);">Price not set</span>`;
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  if (allProducts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">📦</div>
        <h3>No products listed yet</h3>
        <p>Add your first product to start getting rental enquiries.</p>
        <button class="btn btn-primary" onclick="openAddModal()"
          style="width:auto;padding:10px 24px;display:inline-flex;margin-top:8px;">
          Add first product
        </button>
      </div>`;
    return;
  }
  grid.innerHTML = allProducts.map(p => {
    const img = p.images && p.images[0]
      ? `<img class="product-img" src="${p.images[0]}" alt="${p.name}" loading="lazy">`
      : `<div class="product-img-placeholder">📦</div>`;
    const interestText = (p.click_count || 0) > 0
      ? `🔥 ${p.click_count} ${p.click_count === 1 ? 'person has' : 'people have'} viewed this`
      : 'Not viewed yet';
    const isAdminFlagged = p.deactivated_by === 'admin';
    const statusBtnLabel = p.is_active ? 'Deactivate' : 'Reactivate';
    const statusBtnClass = p.is_active ? 'warn' : '';
    const daysLeft = p.edit_days_remaining ?? 0;
    const strikeBanner = isAdminFlagged ? `
      <div style="background:#fff7ed;border:1px solid #f97316;color:#9a3412;padding:10px 12px;border-radius:6px;margin:8px 0;font-size:13px;">
        ⚠️ <strong>Removed by Admin</strong><br>
        <span>Reason: ${p.strike_reason || 'Policy violation'}</span><br>
        Edit this product to bring it back live.
        <strong style="display:block;margin-top:4px;">${daysLeft} day${daysLeft === 1 ? '' : 's'} left before permanent deletion.</strong>
      </div>` : '';
    const expiredBanner = p.deactivated_by === 'plan_expired' ? `
  <div style="background:#fff7ed;border:1px solid #f97316;color:#9a3412;padding:10px 12px;border-radius:6px;margin:8px 0;font-size:13px;">
    ⏸️ <strong>Hidden - Plan Expired</strong><br>
    Renew your plan to bring this listing back live.
    <button onclick="event.stopPropagation();openUpgradeModal()" 
      style="margin-top:6px;display:block;background:#f97316;color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;">
      Renew Plan
    </button>
  </div>` : '';
    return `
    <div class="product-card" onclick="handleCardClick(event,${p.id})">
      ${img}
      <span class="product-status-badge ${p.is_active ? '' : 'inactive'}">${p.is_active ? 'Live' : 'Inactive'}</span>
      <button class="product-share-btn"
        onclick="event.stopPropagation();openShareModal(${p.id})" title="Share">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="18" cy="5" r="3" stroke="currentColor" stroke-width="1.8"/>
          <circle cx="6" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>
          <circle cx="18" cy="19" r="3" stroke="currentColor" stroke-width="1.8"/>
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" stroke="currentColor" stroke-width="1.8"/>
        </svg>
      </button>
      <div class="product-body">
        ${strikeBanner}
        ${expiredBanner}
        <div class="product-cat">${p.category || ''}</div>
        <div class="product-title">${p.name}</div>
        <div class="product-desc">${p.description || 'No description.'}</div>
        <div class="product-meta">
          <div class="product-price">${rentLine(p)}</div>
          <div class="product-interest">${interestText}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// Clicking the card (not its buttons) opens the preview modal
function handleCardClick(evt, productId) {
  if (evt.target.closest('.product-action-btn') || evt.target.closest('.product-share-btn')) return;
  openPreviewModal(productId);
}

// ── Deactivate / Reactivate ──────────────────────────────
async function toggleProductStatus(productId, newStatus) {
  if (vendorProfile && !vendorProfile.is_active && !vendorProfile.is_active) {
    toastError('Your account is suspended. Contact support to regain access.');
    return;
  }
  const res = await apiRequest(`/auth/vendor/products/${productId}/status`, 'PUT', { is_active: newStatus });
  if (res.success) {
    toastSuccess(newStatus
      ? 'Product reactivated - visible to renters again.'
      : 'Marked as rented - hidden from renters.');
    await loadProducts();
    if (previewProductId === productId) renderPreviewModal(productId);
  } else {
    if (res.message && res.message.toLowerCase().includes('limit')) {
      openUpgradeModal(res.message);
    } else {
      toastError(res.message || 'Failed to update status.');
    }
  }
}

// ── Product preview modal ─────────────────────────────────────
function openPreviewModal(productId) {
  previewProductId = productId;
  renderPreviewModal(productId);
  document.getElementById('previewModalOverlay').classList.add('open');
}

function closePreviewModal() {
  document.getElementById('previewModalOverlay').classList.remove('open');
  previewProductId = null;
}

function renderPreviewModal(productId) {
  const p = allProducts.find(x => x.id === productId);
  const body = document.getElementById('previewModalBody');
  const foot = document.getElementById('previewModalFoot');
  if (!p || !body || !foot) return;

  const images = p.images && p.images.length ? p.images : [];
  const imagesHtml = images.length
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;margin-bottom:16px;">
        ${images.map(url =>
      `<img src="${url}" alt="${p.name}"
            style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--r-md);border:1px solid var(--c-border-soft);">`
    ).join('')}
       </div>`
    : `<div class="product-img-placeholder" style="border-radius:var(--r-md);margin-bottom:16px;">📦</div>`;

  const priceRows = [
    p.rent_per_hour ? `₹${p.rent_per_hour} / hour` : null,
    p.rent_per_km ? `₹${p.rent_per_km} / km` : null,
    p.rent_per_day ? `₹${p.rent_per_day} / day` : null,
    p.rent_per_month ? `₹${p.rent_per_month} / month` : null,
  ].filter(Boolean).join(' &nbsp;•&nbsp; ');

  body.innerHTML = `
    ${p.deactivated_by === 'admin' ? `
    <div style="background:#fff7ed;border:1px solid #f97316;color:#9a3412;padding:12px 14px;border-radius:6px;margin-bottom:12px;font-size:13px;">
      ⚠️ <strong>Removed by Admin</strong><br>
      Reason: ${p.strike_reason || 'Policy violation'}<br>
      <strong>${p.edit_days_remaining ?? 0} day(s) left</strong> - edit this product to bring it back live, or it will be permanently deleted.
    </div>` : ''}
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span class="product-status-badge ${p.is_active ? '' : 'inactive'}"
        style="position:static;">${p.is_active ? 'Live' : 'Inactive'}</span>
      <span class="product-cat" style="margin:0;">
        ${p.category || ''}${p.subcategory ? ' · ' + p.subcategory : ''}
      </span>
    </div>
    ${imagesHtml}
    <h3 style="margin:0 0 6px;font-size:18px;">${p.name}</h3>
    <p style="font-size:13.5px;color:var(--c-ink-soft);line-height:1.5;margin-bottom:12px;">
      ${p.description || 'No description.'}
    </p>
    <div style="font-size:15px;font-weight:700;color:var(--c-blue-deep);margin-bottom:6px;">
      ${priceRows || 'Price not set'}
    </div>
    ${p.security_deposit
      ? `<div style="font-size:13px;color:var(--c-ink-faint);margin-bottom:6px;">
           Security deposit: ₹${p.security_deposit}
         </div>` : ''}
    <div style="font-size:13px;color:var(--c-ink-faint);margin-bottom:6px;">
      ${[p.area, p.city, p.state, p.pincode].filter(Boolean).join(', ')}
    </div>
    <div style="font-size:13px;color:#B5790A;font-weight:600;">
      ${(p.click_count || 0) > 0
      ? `🔥 ${p.click_count} ${p.click_count === 1 ? 'person has' : 'people have'} viewed this`
      : 'Not viewed yet'}
    </div>`;

  foot.innerHTML = `
    <button class="btn btn-secondary" style="width:auto;padding:10px 16px;"
      onclick="openShareModal(${p.id})">Share</button>
    ${p.deactivated_by !== 'admin' && p.deactivated_by !== 'plan_expired' ? `
<button class="btn btn-secondary" style="width:auto;padding:10px 16px;"
  onclick="toggleProductStatus(${p.id},${!p.is_active})">
  ${p.is_active ? 'Deactivate' : 'Reactivate'}
</button>` : ''}
${p.deactivated_by === 'plan_expired' ? `
<button class="btn btn-primary" style="width:auto;padding:10px 16px;"
  onclick="closePreviewModal();openUpgradeModal('Renew your plan to reactivate this product.')">
  🔄 Renew to Reactivate
</button>` : ''}
    <button class="btn btn-secondary" style="width:auto;padding:10px 16px;"
      onclick="closePreviewModal();openEditModal(${p.id})">
      ${p.deactivated_by === 'admin' ? '✏️ Edit to go live' : 'Edit'}
    </button>
    <button class="btn btn-primary" style="width:auto;padding:10px 16px;background:var(--c-error);"
      onclick="closePreviewModal();confirmDelete(${p.id})">Delete</button>`;
}

// ── Share ─────────────────────────────────────────────────────
// On mobile/modern browsers: opens the OS native share sheet directly.
// On desktop browsers without Web Share API: falls back to a copy+WhatsApp modal.
function openShareModal(productId) {
  const p = allProducts.find(x => x.id === productId);
  if (!p || !p.share_slug) {
    toastError('Share link not available for this product yet.');
    return;
  }
  const url = `https://olrindia.com/product/${slugify(p.category)}/${slugify(p.city || 'india')}/${p.share_slug}`;
  const title = p.name || 'Check this out';

  if (navigator.share) {
    navigator.share({ title, text: title, url }).catch(() => { });
    return;
  }

  // Fallback: manual copy / WhatsApp
  document.getElementById('shareLinkInput').value = url;
  const waBtn = document.getElementById('shareWhatsappBtn');
  if (waBtn) waBtn.href = `https://wa.me/?text=${encodeURIComponent(title + ' - ' + url)}`;
  // Hide "Share via…" - irrelevant in fallback (navigator.share not available)
  const nativeBtn = document.getElementById('shareNativeBtn');
  if (nativeBtn) nativeBtn.style.display = 'none';
  document.getElementById('shareModalOverlay').classList.add('open');
}

document.getElementById('shareModalClose')?.addEventListener('click', () => {
  document.getElementById('shareModalOverlay').classList.remove('open');
});
document.getElementById('shareLinkCopyBtn')?.addEventListener('click', async () => {
  const val = document.getElementById('shareLinkInput').value;
  try {
    await navigator.clipboard.writeText(val);
  } catch {
    const inp = document.getElementById('shareLinkInput');
    inp.select(); document.execCommand('copy');
  }
  toastSuccess('Link copied!');
});

// ── Upgrade modal ─────────────────────────────────────────────
function openUpgradeModal(message) {
  document.getElementById('upgradeModalText').textContent =
    message || 'Upgrade your plan to list more active products.';
  document.getElementById('upgradeModalOverlay').classList.add('open');
}
// Close plans modal
document.getElementById('upgradeModalCancel')?.addEventListener('click', () => {
  document.getElementById('upgradeModalOverlay').classList.remove('open');
});

// Close on overlay click (outside the modal box)
document.getElementById('upgradeModalOverlay')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('upgradeModalOverlay')) {
    document.getElementById('upgradeModalOverlay').classList.remove('open');
  }
});

const PLAN_PRICES = {
  starter: 249,
  growth: 449,
  premium: 999,
};

function openUpgradeModal(message) {
  const sub = document.getElementById('upgradeModalText');
  if (sub) {
    sub.textContent = message || 'Upgrade your plan to list more products and get better visibility.';
  }

  // Mark current plan on the cards
  renderPlanCards();

  document.getElementById('upgradeModalOverlay').classList.add('open');
}

/**
 * Highlights current plan card, disables its button,
 * hides the button for lower plans.
 */
function renderPlanCards() {
  if (!vendorProfile) return;

  const current = vendorProfile.subscription_plan || 'free';
  const expires = vendorProfile.subscription_expires_at;

  // Update the "current plan" bar at top of modal
  const bar = document.getElementById('plansCurrentBar');
  if (bar) {
    const planName = PLAN_LABELS[current] || current;
    let expiryText = '';
    if (expires && current !== 'free') {
      const d = new Date(expires);
      expiryText = ` · renews ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    bar.innerHTML = `You're on <strong>${planName}</strong>${expiryText}`;
  }

  const order = ['free', 'starter', 'growth', 'premium'];
  const currentIdx = order.indexOf(current);

  order.forEach((plan, idx) => {
    const card = document.getElementById(`planCard-${plan}`);
    const tag = document.getElementById(`planTag-${plan}`);
    const btn = document.getElementById(`planBtn-${plan}`);

    if (!card) return;

    // Show free card only if vendor is on a paid plan (for reference)
    if (plan === 'free') {
      card.style.display = (current !== 'free') ? 'flex' : 'none';
      return;
    }

    card.style.display = 'flex';
    card.style.flexDirection = 'column';

    const isCurrent = (plan === current);
    const isLower = idx < currentIdx;

    // Tag
    if (tag) tag.style.display = isCurrent ? 'block' : 'none';

    // Button
    if (btn) {
      if (isCurrent) {
        btn.disabled = true;
        btn.querySelector('.btn-label').textContent = 'Current plan';
      } else if (isLower) {
        btn.disabled = true;
        btn.querySelector('.btn-label').textContent = 'Downgrade';
        btn.style.opacity = '0.35';
      } else {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.querySelector('.btn-label').textContent =
          `Get ${plan.charAt(0).toUpperCase() + plan.slice(1)}`;
      }
      // Reset spinner
      setButtonLoading(btn, false);
    }
  });
}

/**
 * Called when vendor clicks a plan's "Get X" button.
 * Opens Razorpay checkout for that plan.
 */
async function handlePlanSelect(plan) {
  const btn = document.getElementById(`planBtn-${plan}`);

  try {
    setButtonLoading(btn, true);

    // Step 1: Create Razorpay order on backend
    const res = await apiRequest('/auth/vendor/subscribe', 'POST', { plan });

    if (!res.success) {
      toastError(res.message || 'Could not start payment. Please try again.');
      setButtonLoading(btn, false);
      return;
    }

    setButtonLoading(btn, false);

    // Step 2: Open Razorpay checkout popup
    const options = {
      key: res.key_id,
      amount: res.amount,
      currency: res.currency,
      name: 'OLR India',
      description: `${res.plan_label} Plan · 30 days`,
      order_id: res.order_id,

      prefill: {
        name: res.vendor?.name || '',
        email: res.vendor?.email || '',
      },

      theme: { color: '#2563eb' },

      // Step 3a: Payment done → verify on backend
      handler: async function (response) {
        // Close plans modal first
        document.getElementById('upgradeModalOverlay').classList.remove('open');

        await verifyAndActivatePlan({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
      },

      modal: {
        ondismiss: function () {
          // Vendor closed popup without paying - reset button
          setButtonLoading(btn, false);
        },
      },
    };

    const rzp = new Razorpay(options);

    rzp.on('payment.failed', function (response) {
      toastError(`Payment failed: ${response.error.description || 'Please try again.'}`);
      setButtonLoading(btn, false);
    });

    rzp.open();

  } catch (err) {
    console.error('Plan select error:', err);
    toastError('Something went wrong. Please try again.');
    if (btn) setButtonLoading(btn, false);
  }
}

/**
 * Called after Razorpay reports success.
 * Sends all 3 IDs to backend - backend verifies signature and activates plan.
 */
async function verifyAndActivatePlan({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  try {
    const res = await apiRequest('/auth/vendor/payment/verify', 'POST', {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (res.success) {
      toastSuccess(`🎉 ${res.message}`);
      await loadVendorProfile();
      await loadProducts();
      renderProfilePlanSection();
    } else {
      toastError(res.message || 'Payment verification failed. Contact support.');
    }

  } catch (err) {
    console.error('Verify payment error:', err);
    // Show retry option instead of just an error
    showPaymentRetryBanner({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });
  }
}

function showPaymentRetryBanner({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  let el = document.getElementById('paymentRetryBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'paymentRetryBanner';
    // Insert at top of products panel
    const panel = document.getElementById('panel-products');
    panel?.insertBefore(el, panel.firstChild);
  }
  el.style.cssText = `
    display:flex; align-items:center; justify-content:space-between;
    background:#fff7ed; border:1px solid #f97316; color:#9a3412;
    padding:14px 16px; border-radius:8px; margin-bottom:16px;
    font-size:13.5px; gap:12px; flex-wrap:wrap;
  `;
  el.innerHTML = `
    <span>⚠️ Payment was deducted but your plan is being activated. Click Retry or wait a few minutes and refresh. If issue persists contact <a href="mailto:support@olrindia.com" style="color:#9a3412;font-weight:600;">support@olrindia.com</a> with your payment ID: <strong>${razorpay_payment_id}</strong></span>
    <button class="btn btn-primary" style="width:auto;padding:8px 16px;flex-shrink:0;font-size:13px;"
      id="paymentRetryBtn">Retry Activation</button>
  `;
  document.getElementById('paymentRetryBtn').addEventListener('click', async () => {
    el.innerHTML = `<span>⏳ Retrying...</span>`;
    await verifyAndActivatePlan({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
    el.remove();
  });
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

  // Expiry display
  let expiryHtml = '';
  if (expires && plan !== 'free') {
    const d = new Date(expires);
    const now = new Date();
    const daysLeft = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    const formatted = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const urgentClass = daysLeft <= 7 ? 'expiring-soon' : '';
    const urgentText = daysLeft <= 7 ? ` (${daysLeft} day${daysLeft === 1 ? '' : 's'} left!)` : '';
    expiryHtml = `<div class="profile-plan-expires ${urgentClass}">
      Active until ${formatted}${urgentText}
    </div>`;
  }

  // Badge pill
  let badgeHtml = '';
  if (badge === 'verified') {
    badgeHtml = `<span class="profile-plan-badge verified">✓ Verified vendor badge</span>`;
  } else if (badge === 'featured') {
    badgeHtml = `<span class="profile-plan-badge featured">★ Featured vendor badge</span>`;
  }
  // Pending plan (downgrade scheduled for next cycle)
  let pendingHtml = '';
  if (v.pending_plan && v.pending_plan !== plan) {
    const pendingLabel = PLAN_LABELS[v.pending_plan] || v.pending_plan;
    pendingHtml = `<div class="profile-plan-expires" style="color:var(--c-ink-faint);margin-top:4px;">
      🔄 Switches to ${pendingLabel} after current period ends
    </div>`;
  }

  // Listing limit
  const limitText = limit === null
    ? 'Unlimited active listings'
    : `${used} of ${limit} active listings used`;

  el.innerHTML = `
    <div class="profile-plan-section">
      <div class="profile-plan-left">
        <div class="profile-plan-label">Current plan</div>
        <div class="profile-plan-name">${label}</div>
        <div class="profile-plan-detail">${limitText}</div>
        ${badgeHtml}
        ${expiryHtml}
        ${pendingHtml}
      </div>
      <button class="btn btn-primary" style="width:auto;padding:10px 20px;flex-shrink:0;"
        onclick="openUpgradeModal()">
        ${plan === 'premium' ? 'Manage plan' : 'Upgrade plan'}
      </button>
    </div>`;
}

// ── Image slots ───────────────────────────────────────────────
// initImageSlots is called once by vendor-auth.js after the page loads.
// The guard prevents it running twice if anything else calls it.
function setSlotImage(i, src) {
  const slot = document.getElementById(`slot${i}`);
  if (!slot) return;
  let img = slot.querySelector('img');
  if (!img) { img = document.createElement('img'); slot.appendChild(img); }
  img.src = src;
  slot.classList.add('has-image');
}

function clearSlotImage(i) {
  delete slotFiles[i];
  const slot = document.getElementById(`slot${i}`);
  if (!slot) return;
  const img = slot.querySelector('img');
  if (img) img.remove();
  slot.classList.remove('has-image');
  const input = slot.querySelector('input[type="file"]');
  if (input) input.value = '';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function compressImage(file, maxWidthPx = 1920, qualityJpeg = 0.82) {
  return new Promise((resolve) => {
    if (file.size < 500 * 1024) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxWidthPx) { h = Math.round(h * maxWidthPx / w); w = maxWidthPx; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
      }, 'image/jpeg', qualityJpeg);
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

function initImageSlots() {
  // Guard - only ever run once no matter who calls this
  if (window.__slotsReady) return;
  window.__slotsReady = true;

  for (let i = 1; i <= 5; i++) {
    const slot = document.getElementById(`slot${i}`);
    if (!slot) continue;

    // Click empty slot → open its own file picker
    slot.addEventListener('click', () => {
      if (slot.classList.contains('has-image')) return;
      slot.querySelector('input[type="file"]').click();
    });

    // Individual slot file chosen
    slot.querySelector('input[type="file"]').addEventListener('change', async function () {
      if (!this.files[0]) return;
      slotFiles[i] = this.files[0];
      try {
        setSlotImage(i, await readFileAsDataUrl(this.files[0]));
      } catch {
        toastError('Could not read that image - try a different file.');
        delete slotFiles[i];
      }
    });

    // × delete button on a slot
    slot.querySelector('.img-slot-del')?.addEventListener('click', e => {
      e.stopPropagation();
      if (editingId && slotUrls[i]) {
        // Has a real saved image on server - delete it from backend too
        deleteImageSlot(editingId, i);
      } else {
        // Just a locally picked file not yet saved - clear it locally
        clearSlotImage(i);
      }
    });
  }

  // Bulk "Select photos" button - uses the hidden <input multiple>
  const bulkInput = document.getElementById('bulkImageInput');
  if (bulkInput) {

    bulkInput.addEventListener('change', async function () {
      const files = Array.from(this.files || []);
      if (!files.length) return;

      // Fill empty slots first; if all full, overwrite from slot 1
      const empty = [];
      for (let i = 1; i <= 5; i++) {
        if (!document.getElementById(`slot${i}`)?.classList.contains('has-image')) empty.push(i);
      }
      const targets = empty.length ? empty : [1, 2, 3, 4, 5];
      const toAdd = files.slice(0, targets.length);

      if (files.length > targets.length) {
        toastError(`Only ${targets.length} slot(s) free - extra photos skipped.`);
      }

      for (let idx = 0; idx < toAdd.length; idx++) {
        const file = toAdd[idx];
        const slotNum = targets[idx];
        if (!file.type.startsWith('image/')) continue;
        slotFiles[slotNum] = file;
        try {
          setSlotImage(slotNum, await readFileAsDataUrl(file));
        } catch {
          delete slotFiles[slotNum];
        }
      }

      this.value = ''; // reset so same files can be picked again
      toastSuccess(`${toAdd.length} photo(s) added.`);
    });
  }
}

// ── Open ADD modal ────────────────────────────────────────────
function openAddModal() {
  if (vendorProfile && !vendorProfile.is_active && !vendorProfile.is_active) {
    toastError('Your account is suspended. Contact support to regain access.');
    return;
  }
  if (vendorProfile && vendorProfile.max_active_posts !== null &&
    vendorProfile.active_product_count >= vendorProfile.max_active_posts) {
    openUpgradeModal(`You've reached your plan's limit of ${vendorProfile.max_active_posts} active posts. Upgrade to list more.`);
    return;
  }
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add new product';
  document.getElementById('productForm').reset();

  // Auto-fill location from saved session
  const account = getSessionAccount('vendor');
  if (account) {
    const f = document.getElementById('productForm');
    f.querySelector('[name="pincode"]').value = account.pincode || '';
    f.querySelector('[name="area"]').value = account.area || '';
    f.querySelector('[name="city"]').value = account.city || '';
    f.querySelector('[name="state"]').value = account.state || '';
  }

  for (let i = 1; i <= 5; i++) clearSlotImage(i);
  document.getElementById('modalSubcategory').innerHTML =
    '<option value="">Select subcategory (optional)</option>';
  document.getElementById('productModalOverlay').classList.add('open');
}

async function loadBillingHistory() {
  const res = await apiRequest('/auth/vendor/billing', 'GET');
  if (!res.success) return;
  renderBillingHistory(res.billing);
}

function renderBillingHistory(billing) {
  const el = document.getElementById('billingHistorySection');
  if (!el) return;

  if (!billing || billing.length === 0) {
    el.innerHTML = `<p style="color:var(--c-ink-faint);font-size:13.5px;">No payment history yet.</p>`;
    return;
  }

  el.innerHTML = billing.map(b => {
    const start = b.period_start
      ? new Date(b.period_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '-';
    const end = b.period_end
      ? new Date(b.period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '-';

    const tag = b.is_current
      ? `<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">CURRENT</span>`
      : b.is_future
        ? `<span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">UPCOMING</span>`
        : `<span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">PAST</span>`;

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:12px 0;border-bottom:1px solid var(--c-border-soft);gap:12px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:600;font-size:14px;margin-bottom:4px;">
            ${PLAN_LABELS[b.plan] || b.plan} &nbsp; ${tag}
          </div>
          <div style="font-size:12.5px;color:var(--c-ink-faint);">
            ${start} → ${end}
          </div>
        </div>
        <div style="font-weight:700;font-size:15px;color:var(--c-blue-deep);">
          ₹${b.amount_inr}
        </div>
      </div>`;
  }).join('');
}

// ── Open EDIT modal ───────────────────────────────────────────
async function openEditModal(productId) {
  editingId = productId;
  const p = allProducts.find(x => x.id === productId);
  if (!p) return;

  document.getElementById('modalTitle').textContent = 'Edit product';
  const form = document.getElementById('productForm');
  form.reset();

  form.querySelector('[name="name"]').value = p.name || '';
  form.querySelector('[name="description"]').value = p.description || '';
  form.querySelector('[name="rent_per_hour"]').value = p.rent_per_hour || '';
  form.querySelector('[name="rent_per_km"]').value = p.rent_per_km || '';
  form.querySelector('[name="rent_per_day"]').value = p.rent_per_day || '';
  form.querySelector('[name="rent_per_month"]').value = p.rent_per_month || '';
  updateRentFields(); // show/hide fields based on category
  form.querySelector('[name="security_deposit"]').value = p.security_deposit || '';
  form.querySelector('[name="pincode"]').value = p.pincode || '';
  form.querySelector('[name="area"]').value = p.area || '';
  form.querySelector('[name="city"]').value = p.city || '';
  form.querySelector('[name="state"]').value = p.state || '';
  originalProductSnapshot = {
    name: p.name || '', description: p.description || '',
    rent_per_hour: String(p.rent_per_hour || ''),
    rent_per_km: String(p.rent_per_km || ''),
    rent_per_day: String(p.rent_per_day || ''),
    rent_per_month: String(p.rent_per_month || ''),
    security_deposit: String(p.security_deposit || ''),
    category: p.category || '', subcategory: p.subcategory || '',
    pincode: p.pincode || '', area: p.area || '',
    city: p.city || '', state: p.state || '',
  };
  const catSel = document.getElementById('modalCategory');
  catSel.value = p.category || '';
  catSel.dispatchEvent(new Event('change'));
  setTimeout(() => {
    document.getElementById('modalSubcategory').value = p.subcategory || '';
  }, 50);

  for (let i = 1; i <= 5; i++) {
    delete slotFiles[i];
    const url = p.images && p.images[i - 1] ? p.images[i - 1] : null;
    slotUrls[i] = url;
    if (url) { setSlotImage(i, url); } else { clearSlotImage(i); }
  }

  document.getElementById('productModalOverlay').classList.add('open');
}

function closeProductModal() {
  document.getElementById('productModalOverlay').classList.remove('open');
  editingId = null;
}

// ── Save product ──────────────────────────────────────────────
document.getElementById('productForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const saveBtn = document.getElementById('modalSaveBtn');

  const name = form.querySelector('[name="name"]').value.trim();
  const rentHour = form.querySelector('[name="rent_per_hour"]').value.trim();
  const rentKm = form.querySelector('[name="rent_per_km"]').value.trim();
  const rentDay = form.querySelector('[name="rent_per_day"]').value.trim();
  const rentMonth = form.querySelector('[name="rent_per_month"]').value.trim();
  const category = document.getElementById('modalCategory').value;

  if (editingId === null) {
    if (!name) {
      toastError('Please enter a product name.');
      return;
    }
    if (!category) {
      toastError('Please select a category.');
      return;
    }
    if (!(rentHour || rentKm || rentDay || rentMonth)) {
      toastError('Please enter at least one rent price - per hour, km, day, or month.');
      return;
    }
    if (Object.keys(slotFiles).length === 0) {
      toastError('Please upload at least one photo of your product.');
      return;
    }

    const fd = new FormData();
    fd.append('name', name);
    fd.append('description', form.querySelector('[name="description"]').value.trim());
    fd.append('rent_per_hour', rentHour);
    fd.append('rent_per_km', rentKm);
    fd.append('rent_per_day', rentDay);
    fd.append('rent_per_month', rentMonth);
    fd.append('security_deposit', form.querySelector('[name="security_deposit"]').value.trim());
    fd.append('category', category);
    fd.append('subcategory', document.getElementById('modalSubcategory').value);
    fd.append('pincode', form.querySelector('[name="pincode"]').value.trim());
    fd.append('area', form.querySelector('[name="area"]').value.trim());
    fd.append('city', form.querySelector('[name="city"]').value.trim());
    fd.append('state', form.querySelector('[name="state"]').value.trim());
    for (let i = 1; i <= 5; i++) {
      if (slotFiles[i]) {
        const compressed = await compressImage(slotFiles[i]);
        fd.append(`image${i}`, compressed);
      }
    }

    setButtonLoading(saveBtn, true);
    const resp = await fetch(API_BASE + '/auth/vendor/products',
      { method: 'POST', body: fd, credentials: 'include' });
    let res;
    try { res = await resp.json(); } catch {
      toastError(`Upload failed (${resp.status}) - try smaller images.`);
      setButtonLoading(saveBtn, false); return;
    }
    setButtonLoading(saveBtn, false);

    if (res.success) {
      toastSuccess('Product listed!');
      closeProductModal();
      await loadProducts();
    } else if (res.message?.toLowerCase().includes('limit')) {
      closeProductModal();
      openUpgradeModal(res.message);
    } else {
      toastError(res.message || 'Failed to add product.');
    }

  } else {
    const n = form.querySelector('[name="name"]').value.trim();
    const rh = form.querySelector('[name="rent_per_hour"]').value.trim();
    const rk = form.querySelector('[name="rent_per_km"]').value.trim();
    const rd = form.querySelector('[name="rent_per_day"]').value.trim();
    const rm = form.querySelector('[name="rent_per_month"]').value.trim();
    const sd = form.querySelector('[name="security_deposit"]').value.trim();
    const cat = document.getElementById('modalCategory').value;
    const sub = document.getElementById('modalSubcategory').value;
    const desc = form.querySelector('[name="description"]').value.trim();
    const pincode = form.querySelector('[name="pincode"]').value.trim();
    const area = form.querySelector('[name="area"]').value.trim();
    const city = form.querySelector('[name="city"]').value.trim();
    const state = form.querySelector('[name="state"]').value.trim();

    const data = {
      name: n || undefined,
      category: cat || undefined,
      description: desc === '' ? null : desc,
      rent_per_hour: rh === '' ? null : rh,
      rent_per_km: rk === '' ? null : rk,
      rent_per_day: rd === '' ? null : rd,
      rent_per_month: rm === '' ? null : rm,
      security_deposit: sd === '' ? null : sd,
      subcategory: sub === '' ? null : sub,
      pincode: pincode === '' ? null : pincode,
      area: area === '' ? null : area,
      city: city === '' ? null : city,
      state: state === '' ? null : state,
    };
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
    const hasImageChange = Object.keys(slotFiles).length > 0;
    const hasFieldChange =
      n !== originalProductSnapshot.name ||
      desc !== originalProductSnapshot.description ||
      rd !== originalProductSnapshot.rent_per_day ||
      rh !== originalProductSnapshot.rent_per_hour ||
      rk !== originalProductSnapshot.rent_per_km ||
      rm !== originalProductSnapshot.rent_per_month ||
      sd !== originalProductSnapshot.security_deposit ||
      cat !== originalProductSnapshot.category ||
      sub !== originalProductSnapshot.subcategory ||
      pincode !== originalProductSnapshot.pincode ||
      area !== originalProductSnapshot.area ||
      city !== originalProductSnapshot.city ||
      state !== originalProductSnapshot.state;

    if (!hasFieldChange && !hasImageChange) {
      toastError('No changes detected. Make at least one change to save.');
      setButtonLoading(saveBtn, false);
      return;
    }
    setButtonLoading(saveBtn, true);
    const res = await apiRequest(`/auth/vendor/products/${editingId}`, 'PUT', data);

    for (let i = 1; i <= 5; i++) {
      if (slotFiles[i]) {
        const fd = new FormData();
        const compressed = await compressImage(slotFiles[i]);
        fd.append('image', compressed);
        await fetch(`${API_BASE}/auth/vendor/products/${editingId}/image/${i}`,
          { method: 'PUT', body: fd, credentials: 'include' });
      }
    }

    setButtonLoading(saveBtn, false);

    if (res.success) {
      toastSuccess('Product updated!');
      closeProductModal();
      await loadProducts();
    } else {
      toastError(res.message || 'Update failed.');
    }
  }
});

// ── Delete image slot ─────────────────────────────────────────
async function deleteImageSlot(productId, slot) {
  const confirmed = await showConfirm({
    title: 'Delete image?',
    text: 'This image will be permanently removed.',
    confirmLabel: 'Delete', cancelLabel: 'Cancel',
  });
  if (!confirmed) return;
  const res = await apiRequest(`/auth/vendor/products/${productId}/image/${slot}`, 'DELETE');
  if (res.success) {
    toastSuccess('Image deleted.');
    slotUrls[slot] = null;
    clearSlotImage(slot);
  } else {
    toastError(res.message || 'Failed to delete image.');
  }
}

// ── Delete product ────────────────────────────────────────────
async function confirmDelete(productId) {
  const p = allProducts.find(x => x.id === productId);
  const confirmed = await showConfirm({
    title: 'Delete product?',
    text: `"${p?.name}" and all its images will be permanently deleted.`,
    confirmLabel: 'Delete', cancelLabel: 'Cancel',
  });
  if (!confirmed) return;
  const res = await apiRequest(`/auth/vendor/products/${productId}`, 'DELETE');
  if (res.success) {
    toastSuccess('Product deleted.');
    await loadProducts();
  } else {
    toastError(res.message || 'Delete failed.');
  }
}

// ── Messages tab entry point ────────────────────────────────────
document.querySelectorAll('[data-tab="chats"]').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (vendorProfile && !vendorProfile.is_active && !vendorProfile.is_active) {
      toastError('Your account is suspended. Contact support to regain access.');
      return;
    }
    openChatOverlay();
    document.getElementById('chatListBody').innerHTML = `
      <div class="chat-empty-state"><div class="icon">💬</div><h3>Loading…</h3></div>`;
    const ok = await initChatAuth('vendor');
    if (!ok) return;
    renderChatList();
  });
});

// ── Keyboard shortcuts ────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('productModalOverlay')?.classList.contains('open')) closeProductModal();
  if (document.getElementById('previewModalOverlay')?.classList.contains('open')) closePreviewModal();
  document.getElementById('shareModalOverlay')?.classList.remove('open');
  document.getElementById('upgradeModalOverlay')?.classList.remove('open');
});

// ── DOMContentLoaded - UI wiring only ────────────────────────
// loadCategories / loadProducts / initImageSlots are called by
// vendor-auth.js > initVendorDashboard after the profile loads.
// This block only wires static UI events that don't depend on data.
document.addEventListener('DOMContentLoaded', () => {
  // Tab nav
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(btn => {
    if (!btn.dataset.tab) return;
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Hamburger
  document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
    document.getElementById('mobileMenu').classList.toggle('open');
  });
  document.querySelectorAll('[data-tab="viewsite"]').forEach(btn => {
    btn.addEventListener('click', () => {
      vsLoadBrowseHomepage();
    });
  });
  // Add product buttons (header + empty state)
  document.getElementById('addProductBtn')?.addEventListener('click', openAddModal);
  document.getElementById('addProductBtnEmpty')?.addEventListener('click', openAddModal);

  // Product modal pincode autofill
  // (Profile form pincode is wired by vendor-auth.js)
  initModalPincodeAutofill();

  // ── Restore tab (and open chat thread) from URL hash on refresh ──
  const hashRaw = location.hash.replace('#', '');
  const savedTab = hashRaw.split('=')[0];
  const validTabs = ['products', 'chats', 'profile', 'privacy', 'terms', 'viewsite'];

  if (validTabs.includes(savedTab)) {
    switchTab(savedTab);

    if (savedTab === 'viewsite') {
      vsLoadBrowseHomepage();
    }
  }

  if (savedTab === 'chats') {
    (async () => {
      const ok = await initChatAuth('vendor');
      if (!ok) return;
      openChatOverlay();
      const convIdFromHash = hashRaw.split('=')[1];
      if (convIdFromHash) {
        openThread(convIdFromHash);
      } else {
        renderChatList();
      }
    })();
  }
});
// ADD after the validTabs/savedTab block
if (sessionStorage.getItem('olr_vs_return')) {
  sessionStorage.removeItem('olr_vs_return');
  switchTab('viewsite');
  vsLoadBrowseHomepage();
}
// ══════════════════════════════════════════════════════════════
// VIEW SITE BROWSE PANEL
// ══════════════════════════════════════════════════════════════

const VS_CATEGORIES = [
  'Construction Equipment', 'Furniture & Home Appliances','Photography & Content Creator Gear',
  'Events & Weddings', 'Fashion & Designer Wear', 'Agricultural Equipment', 'Passenger Vehicles', 'Bikes & Scooters',
  'Medical Equipment', 'Baby & Kids Gear', 'Adventure & Trekking Gear', 'Sports & Fitness Equipment', 'Electrical & Power Tools',
  'Commercial Vehicles', 'Tools & Tackles', 'Properties', 'Industrial Equipment', 'Warehouse & Storage', 'Cargo & Shipping',
  'Machineries', 'Musical Instruments'
];

function vsCatEmoji(cat) {
  const m = {
    'Construction Equipment': '🏗️', 'Furniture & Home Appliances': '🪑','Photography & Content Creator Gear': '📸',
    'Events & Weddings': '🎉', 'Fashion & Designer Wear': '👗', 'Agricultural Equipment': '🌾', 'Passenger Vehicles': '🚗',
    'Bikes & Scooters': '🏍️', 'Medical Equipment': '🩺', 'Baby & Kids Gear': '👶', 'Adventure & Trekking Gear': '🏕️',
    'Sports & Fitness Equipment': '🏋️', 'Electrical & Power Tools': '⚡', 'Commercial Vehicles': '🚛', 'Tools & Tackles': '🛠️',
    'Properties': '🏢', 'Industrial Equipment': '⚙️', 'Warehouse & Storage': '🏭', 'Cargo & Shipping': '📦',
    'Machineries': '🔧','Musical Instruments': '🎵'
  };
  return m[cat] || '📦';
}

function vsCatImg(cat) {
  const m = {
    'Construction Equipment': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80',
    'Furniture & Home Appliances': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80',
    'Photography & Content Creator Gear': '../assets/categories/PhotographyContentCreatorGear.png',
    'Events & Weddings': '../assets/categories/EventsWeddings.png',
    'Fashion & Designer Wear': '../assets/categories/FashionDesignerWear.png',
    'Agricultural Equipment': '../assets/categories/AgriculturalEquipment.png',
    'Passenger Vehicles': '../assets/categories/PassengerVehicles.png',
    'Bikes & Scooters': '../assets/categories/BikesScooters.png',
    'Medical Equipment': '../assets/categories/MedicalEquipment.png',
    'Baby & Kids Gear': '../assets/categories/BabyKidsGear.png',
    'Adventure & Trekking Gear': '../assets/categories/AdventureTrekkingGear.png',
    'Sports & Fitness Equipment': '../assets/categories/SportsFitnessEquipment.png',
    'Electrical & Power Tools': 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=400&q=80',
    'Commercial Vehicles': '../assets/categories/CommercialVehicles.png',
    'Tools & Tackles': '../assets/categories/ToolsTackles.png',
    'Properties': '../assets/categories/Properties.png',
    'Industrial Equipment': '../assets/categories/IndustrialEquipment.png',
    'Warehouse & Storage': '../assets/categories/WarehouseStorage.png',
    'Cargo & Shipping': '../assets/categories/CargoShipping.png',
    'Machineries': '../assets/categories/Machineries.png',
    'Musical Instruments': '../assets/categories/Musical Instruments.png',
  };
  return m[cat] || '';
}

function vsCatColor(cat) {
  const m = {
    'Construction Equipment': { main: '#F59E0B', bg: '#FFFBEB' },
    'Furniture & Home Appliances': { main: '#8B5CF6', bg: '#F5F3FF' },
    'Photography & Content Creator Gear': { main: '#EC4899', bg: '#FDF2F8' },
    'Events & Weddings': { main: '#F97316', bg: '#FFF7ED' },
    'Fashion & Designer Wear': { main: '#EC4899', bg: '#FDF2F8' },
    'Agricultural Equipment': { main: '#22C55E', bg: '#F0FDF4' },
    'Passenger Vehicles': { main: '#0EA5E9', bg: '#F0F9FF' },
    'Bikes & Scooters': { main: '#EF4444', bg: '#FEF2F2' },
    'Medical Equipment': { main: '#06B6D4', bg: '#ECFEFF' },
    'Baby & Kids Gear': { main: '#F472B6', bg: '#FDF2F8' },
    'Adventure & Trekking Gear': { main: '#10B981', bg: '#ECFDF5' },
    'Sports & Fitness Equipment': { main: '#14B8A6', bg: '#F0FDFA' },
    'Electrical & Power Tools': { main: '#EF4444', bg: '#FEF2F2' },
    'Commercial Vehicles': { main: '#14B8A6', bg: '#F0FDFA' },
    'Tools & Tackles': { main: '#10B981', bg: '#ECFDF5' },
    'Properties': { main: '#6366F1', bg: '#EEF2FF' },
    'Industrial Equipment': { main: '#78716C', bg: '#FAFAF9' },
    'Warehouse & Storage': { main: '#64748B', bg: '#F8FAFC' },
    'Cargo & Shipping': { main: '#8B5CF6', bg: '#F5F3FF' },
    'Machineries': { main: '#F59E0B', bg: '#FFFBEB' },
    'Musical Instruments': { main: '#EC4899', bg: '#FDF2F8' }
  };
  return m[cat] || { main: '#3B82F6', bg: '#EFF6FF' };
}

function vsSkeletonCardHTML() {
  return `<div class="vendor-skeleton-card">
    <div class="vendor-skeleton-img"></div>
    <div class="vendor-skeleton-body">
      <div class="vendor-skeleton-line vendor-skeleton-line-sm"></div>
      <div class="vendor-skeleton-line vendor-skeleton-line-md"></div>
      <div class="vendor-skeleton-line vendor-skeleton-line-lg"></div>
      <div class="vendor-skeleton-line vendor-skeleton-line-xs"></div>
    </div>
  </div>`;
}

function vsProductCardHTML(p) {
  const img = p.images && p.images[0]
    ? `<img class="vendor-product-img" src="${p.images[0]}" alt="${p.name}" loading="lazy">`
    : `<div class="vendor-product-img-placeholder">${vsCatEmoji(p.category)}</div>`;
  const price = vsBuildPriceLabel(p);
  const badge = p.vendor_badge === 'featured'
    ? `<span class="vendor-browse-badge vendor-browse-badge-premium">★ Top Vendor</span>`
    : p.vendor_badge === 'verified'
      ? `<span class="vendor-browse-badge vendor-browse-badge-growth">✓ Verified</span>`
      : '';
  return `
    <div class="vendor-product-card" onclick="sessionStorage.setItem('olr_vs_return','1');window.location.href='/product/${slugify(p.category)}/${slugify(p.city || 'india')}/${p.share_slug}'">
      ${img}
      ${badge}
      <div class="vendor-product-body">
        <div class="vendor-product-cat">${p.category || ''}</div>
        <div class="vendor-product-title">${p.name}</div>
        <div class="vendor-product-bottom">
          <div class="vendor-product-price">${price}</div>
          <div class="vendor-product-loc">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z" stroke="currentColor" stroke-width="2"/></svg>
            ${p.city || ''}
          </div>
        </div>
      </div>
    </div>`;
}

function vsBuildPriceLabel(p) {
  const type = vsActiveFilters.priceType;
  if (type === 'hour' && p.rent_per_hour) return `₹${p.rent_per_hour} <span>/ hour</span>`;
  if (type === 'km' && p.rent_per_km) return `₹${p.rent_per_km} <span>/ km</span>`;
  if (type === 'day' && p.rent_per_day) return `₹${p.rent_per_day} <span>/ day</span>`;
  if (type === 'month' && p.rent_per_month) return `₹${p.rent_per_month} <span>/ month</span>`;
  if (p.rent_per_hour) return `₹${p.rent_per_hour} <span>/ hour</span>`;
  if (p.rent_per_km) return `₹${p.rent_per_km} <span>/ km</span>`;
  if (p.rent_per_day) return `₹${p.rent_per_day} <span>/ day</span>`;
  if (p.rent_per_month) return `₹${p.rent_per_month} <span>/ month</span>`;
  return `<span style="color:var(--c-ink-faint);font-size:12px;">Price not set</span>`;
}

function vsShowSkeletons(count) {
  document.getElementById('vsProductGrid').innerHTML = Array(count).fill(vsSkeletonCardHTML()).join('');
}

async function vsLoadBrowseProducts(reset = true) {
  if (reset) {
    vsCurrentPage = 1;
    vsAllProducts = [];
    vsShowSkeletons(20);
  }
  const params = new URLSearchParams({ page: vsCurrentPage, per_page: 20 });
  if (vsActiveFilters.category) params.set('category', vsActiveFilters.category);
  if (vsActiveFilters.city) params.set('city', vsActiveFilters.city);
  if (vsActiveFilters.priceType) params.set('price_type', vsActiveFilters.priceType);
  if (vsActiveFilters.priceMin > 0) params.set('price_min', vsActiveFilters.priceMin);
  if (vsActiveFilters.priceMax < Infinity) params.set('price_max', vsActiveFilters.priceMax);
  const q = document.getElementById('vsSearchInput').value.trim();
  if (q) params.set('search', q);

  try {
    const res = await apiRequest(`/products/public?${params}`, 'GET');
    if (!res.success) {
      document.getElementById('vsProductGrid').innerHTML =
        `<div class="vendor-grid-empty"><div style="font-size:40px">😕</div><p>Failed to load products.</p></div>`;
      return;
    }
    vsTotalProducts = res.total;
    vsHasMore = res.has_more;
    vsAllProducts = res.products;
    vsFilteredProducts = res.products;
    vsRenderProducts();
    vsAttachSentinel();
    vsUpdateFilterBadge();
  } catch (e) {
    document.getElementById('vsProductGrid').innerHTML =
      `<div class="vendor-grid-empty"><div style="font-size:40px">😕</div><p>Failed to load products.</p></div>`;
  }
}

async function vsAppendNextBatch() {
  if (vsIsLoadingMore || !vsHasMore) return;
  vsIsLoadingMore = true;
  document.getElementById('vsScrollSentinel')?.remove();
  document.querySelector('.vendor-scroll-end-msg')?.remove();

  const grid = document.getElementById('vsHomeProdGrid') || document.getElementById('vsProductGrid');
  const skeletonWrapper = document.createElement('div');
  skeletonWrapper.id = 'vsSkeletonBatch';
  skeletonWrapper.style.cssText = 'display:contents';
  skeletonWrapper.innerHTML = Array(10).fill(vsSkeletonCardHTML()).join('');
  grid.appendChild(skeletonWrapper);

  vsCurrentPage++;
  const params = new URLSearchParams({ page: vsCurrentPage, per_page: 20 });
  if (vsActiveFilters.category) params.set('category', vsActiveFilters.category);
  if (vsActiveFilters.city) params.set('city', vsActiveFilters.city);
  if (vsActiveFilters.priceType) params.set('price_type', vsActiveFilters.priceType);
  if (vsActiveFilters.priceMin > 0) params.set('price_min', vsActiveFilters.priceMin);
  if (vsActiveFilters.priceMax < Infinity) params.set('price_max', vsActiveFilters.priceMax);
  const q = document.getElementById('vsSearchInput').value.trim();
  if (q) params.set('search', q);

  try {
    const res = await apiRequest(`/products/public?${params}`, 'GET');
    skeletonWrapper.remove();
    if (res.success) {
      vsHasMore = res.has_more;
      vsTotalProducts = res.total;
      res.products.forEach(p => grid.insertAdjacentHTML('beforeend', vsProductCardHTML(p)));
    }
  } catch (e) {
    skeletonWrapper.remove();
    vsCurrentPage--;
  }
  vsIsLoadingMore = false;
  vsAttachSentinel();
}

function vsAttachSentinel() {
  if (vsScrollObserver) { vsScrollObserver.disconnect(); vsScrollObserver = null; }
  vsSentinel?.remove();
  const grid = document.getElementById('vsHomeProdGrid') || document.getElementById('vsProductGrid');
  if (!vsHasMore) {
    if (vsTotalProducts > 20) {
      grid.insertAdjacentHTML('beforeend',
        `<div class="vendor-scroll-end-msg">✓ All ${vsTotalProducts} products loaded</div>`);
    }
    return;
  }
  grid.insertAdjacentHTML('beforeend', `<div id="vsScrollSentinel" style="grid-column:1/-1;height:40px;"></div>`);
  vsSentinel = document.getElementById('vsScrollSentinel');
  vsScrollObserver = new IntersectionObserver(
    (entries) => { if (entries[0].isIntersecting) vsAppendNextBatch(); },
    { rootMargin: '200px' }
  );
  vsScrollObserver.observe(vsSentinel);
}

function vsRenderProducts() {
  const grid = document.getElementById('vsProductGrid');
  const countEl = document.getElementById('vsProductsCount');
  if (vsFilteredProducts.length === 0) {
    countEl.textContent = '';
    grid.innerHTML = `
      <div class="vendor-grid-empty">
        <div style="font-size:44px;margin-bottom:10px;">🔍</div>
        <h3>No products found</h3>
        <p>Try different filters or search terms.</p>
        <button onclick="vsClearAllFilters()" style="margin-top:12px;padding:9px 22px;border-radius:var(--r-md);background:var(--grad-brand);color:#fff;border:none;font-weight:600;cursor:pointer;font-family:var(--font-display);">Clear filters</button>
      </div>`;
    return;
  }
  countEl.textContent = `${vsTotalProducts} product${vsTotalProducts !== 1 ? 's' : ''}`;
  grid.innerHTML = vsFilteredProducts.map(p => vsProductCardHTML(p)).join('');
}

function vsApplyFilters() {
  const homeSection = document.getElementById('vsBrowseHomeSection');
  if (homeSection) homeSection.style.display = 'none';
  document.getElementById('vsProductGrid').style.display = 'grid';
  if (vsActiveFilters.category) {
    document.getElementById('vsProductsTitle').textContent = vsActiveFilters.category;
  } else {
    const q = document.getElementById('vsSearchInput').value.trim();
    document.getElementById('vsProductsTitle').textContent = q ? 'Search Results' : 'All Products';
  }
  vsLoadBrowseProducts(true);
}

function vsUpdateFilterBadge() {
  let count = 0;
  if (vsActiveFilters.category) count++;
  if (vsActiveFilters.city) count++;
  if (vsActiveFilters.priceMin > 0 || vsActiveFilters.priceMax < Infinity) count++;
  const badge = document.getElementById('vsFilterCountBadge');
  badge.style.display = count ? 'inline-flex' : 'none';
  badge.textContent = count;
  document.getElementById('vsFilterBtn').classList.toggle('has-filters', count > 0);
}

function vsRenderActiveFilterChips() {
  const el = document.getElementById('vsActiveFilters');
  const chips = [];
  if (vsActiveFilters.category) chips.push({ label: vsActiveFilters.category, key: 'category' });
  if (vsActiveFilters.city) chips.push({ label: `📍 ${vsActiveFilters.city}`, key: 'city' });
  if (vsActiveFilters.priceMin > 0 || vsActiveFilters.priceMax < Infinity) {
    const label = `₹${vsActiveFilters.priceMin}–${vsActiveFilters.priceMax === Infinity ? '∞' : vsActiveFilters.priceMax} / ${vsActiveFilters.priceType}`;
    chips.push({ label, key: 'price' });
  }
  el.innerHTML = chips.map(c =>
    `<button class="vendor-active-chip" onclick="vsRemoveFilter('${c.key}')">${c.label} ✕</button>`
  ).join('');
}

function vsRemoveFilter(key) {
  if (key === 'category') { vsActiveFilters.category = ''; document.getElementById('vsFilterCategory').value = ''; }
  if (key === 'city') { vsActiveFilters.city = ''; document.getElementById('vsFilterCity').value = ''; }
  if (key === 'price') { vsActiveFilters.priceMin = 0; vsActiveFilters.priceMax = Infinity; document.getElementById('vsFilterPriceMin').value = ''; document.getElementById('vsFilterPriceMax').value = ''; }
  vsRenderActiveFilterChips();
  vsUpdateFilterBadge();
  const hasAny = vsActiveFilters.category || vsActiveFilters.city || vsActiveFilters.priceMin > 0 || vsActiveFilters.priceMax < Infinity || document.getElementById('vsSearchInput').value.trim();
  if (!hasAny) { vsLoadBrowseHomepage(); } else { vsApplyFilters(); }
}

function vsClearAllFilters() {
  vsActiveFilters = { category: '', city: '', priceType: 'day', priceMin: 0, priceMax: Infinity };
  document.getElementById('vsSearchInput').value = '';
  document.getElementById('vsFilterCategory').value = '';
  document.getElementById('vsFilterCity').value = '';
  document.getElementById('vsFilterPriceMin').value = '';
  document.getElementById('vsFilterPriceMax').value = '';
  document.querySelectorAll('.vendor-price-type-btn').forEach((b, i) => b.classList.toggle('active', i === 2));
  vsRenderActiveFilterChips();
  vsUpdateFilterBadge();
  vsLoadBrowseHomepage();
}

function vsOpenFilterSheet() {
  document.getElementById('vsFilterSheet').classList.add('open');
  document.getElementById('vsFilterOverlay').classList.add('open');
}

function vsCloseFilterSheet() {
  document.getElementById('vsFilterSheet').classList.remove('open');
  document.getElementById('vsFilterOverlay').classList.remove('open');
}

function vsEnterBrowseCategory(cat) {
  vsActiveFilters.category = cat;
  document.getElementById('vsFilterCategory').value = cat;
  document.getElementById('vsProductsCount').textContent = '';
  const homeSection = document.getElementById('vsBrowseHomeSection');
  if (homeSection) homeSection.style.display = 'none';
  document.getElementById('vsProductGrid').style.display = 'grid';
  vsRenderActiveFilterChips();
  vsUpdateFilterBadge();
  vsLoadBrowseProducts(true);
}

async function vsLoadBrowseHomepage() {
  const grid = document.getElementById('vsProductGrid');
  const countEl = document.getElementById('vsProductsCount');
  countEl.textContent = '';
  document.getElementById('vsProductsTitle').textContent = 'All products';
  grid.style.display = 'none';

  let homeSection = document.getElementById('vsBrowseHomeSection');
  if (!homeSection) {
    homeSection = document.createElement('div');
    homeSection.id = 'vsBrowseHomeSection';
    grid.parentNode.insertBefore(homeSection, grid);
  }
  homeSection.style.display = 'block';
  homeSection.innerHTML = `
    <div id="vsCatCardGrid" class="vendor-cat-card-grid">
      ${VS_CATEGORIES.map(cat => {
    const color = vsCatColor(cat);
    return `<div class="vendor-cat-card" style="--cat-color:${color.main};--cat-bg:${color.bg};">
          <div class="vendor-skeleton-img" style="height:100%;aspect-ratio:4/3;"></div>
        </div>`;
  }).join('')}
    </div>
    <div id="vsHomeProdSection">
      <div class="vendor-home-prod-title">Featured Products</div>
      <div class="vendor-product-grid" id="vsHomeProdGrid">
        ${Array(8).fill(vsSkeletonCardHTML()).join('')}
      </div>
    </div>`;

  const [catResults, prodData] = await Promise.all([
    Promise.allSettled(
      VS_CATEGORIES.map(cat =>
        apiRequest(`/products/public?page=1&per_page=1&category=${encodeURIComponent(cat)}`, 'GET')
      )
    ),
    apiRequest('/products/public?page=1&per_page=20', 'GET').catch(() => null)
  ]);
  vsHasMore = prodData?.has_more ?? false;
  vsTotalProducts = prodData?.total ?? 0;
  const catGrid = document.getElementById('vsCatCardGrid');
  if (catGrid) {
    const catCards = VS_CATEGORIES.map((cat, i) => {
      const res = catResults[i];
      const hasProducts = res.status === 'fulfilled' && res.value.success && res.value.total > 0;
      if (!hasProducts) return '';
      const color = vsCatColor(cat);
      const img = vsCatImg(cat);
      return `
        <div class="vendor-cat-card" style="--cat-color:${color.main};--cat-bg:${color.bg};" onclick="vsEnterBrowseCategory('${cat.replace(/'/g, "\\'")}')">
          ${img ? `<img class="vendor-cat-card-img" src="${img}" alt="${cat}">` : ''}
          <div class="vendor-cat-card-name">${cat}</div>
        </div>`;
    }).join('');
    catGrid.innerHTML = catCards.trim()
      ? catCards
      : `<div style="grid-column:1/-1;text-align:center;padding:36px 20px;">
          <div style="font-size:48px;margin-bottom:12px;">🏪</div>
          <h3>No categories live yet</h3>
        </div>`;
  }

  const homeProdGrid = document.getElementById('vsHomeProdGrid');
  if (homeProdGrid) {
    if (prodData?.success && prodData.products.length > 0) {
      homeProdGrid.innerHTML = prodData.products.map(p => vsProductCardHTML(p)).join('');
    } else {
      homeProdGrid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:36px 20px;">
          <div style="font-size:48px;margin-bottom:12px;">📦</div>
          <h3>No products listed yet</h3>
        </div>`;
    }
  }
  vsAttachSentinel();
}

// ── View Site filter event listeners ─────────────────────────
document.getElementById('vsFilterBtn')?.addEventListener('click', vsOpenFilterSheet);

document.querySelectorAll('.vendor-price-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.vendor-price-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.getElementById('vsFilterApplyBtn')?.addEventListener('click', () => {
  const selectedType = document.querySelector('.vendor-price-type-btn.active')?.dataset.type || '';
  const priceMin = parseFloat(document.getElementById('vsFilterPriceMin').value) || 0;
  const priceMax = parseFloat(document.getElementById('vsFilterPriceMax').value) || Infinity;
  const hint = document.getElementById('vsFilterPriceHint');

  if (selectedType && priceMin === 0 && priceMax === Infinity) {
    hint.textContent = 'Please enter a min or max price.';
    hint.classList.add('error');
    return;
  }
  hint.textContent = 'Enter a min or max to filter by price.';
  hint.classList.remove('error');

  vsActiveFilters.category = document.getElementById('vsFilterCategory').value;
  vsActiveFilters.city = document.getElementById('vsFilterCity').value.trim().toLowerCase();
  vsActiveFilters.priceType = selectedType || 'day';
  vsActiveFilters.priceMin = priceMin;
  vsActiveFilters.priceMax = priceMax;
  vsCloseFilterSheet();
  vsApplyFilters();
  vsRenderActiveFilterChips();
});

document.getElementById('vsFilterClearBtn')?.addEventListener('click', () => {
  vsClearAllFilters();
  vsCloseFilterSheet();
});

let vsSearchDebounceTimer = null;
document.getElementById('vsSearchInput')?.addEventListener('input', function () {
  clearTimeout(vsSearchDebounceTimer);
  vsSearchDebounceTimer = setTimeout(() => {
    const homeSection = document.getElementById('vsBrowseHomeSection');
    if (homeSection) homeSection.style.display = 'none';
    document.getElementById('vsProductGrid').style.display = 'grid';
    document.getElementById('vsProductsTitle').textContent = 'Search Results';
    vsApplyFilters();
  }, 400);
});

document.getElementById('vsFilterLocateBtn')?.addEventListener('click', () => {
  if (!navigator.geolocation) { toastError('Your browser does not support location.'); return; }
  const btn = document.getElementById('vsFilterLocateBtn');
  btn.disabled = true; btn.style.opacity = '0.5';
  toastInfo('Looking for your location…');
  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      let city = data.address?.city || data.address?.town || data.address?.village || '';
      if (!city) city = (data.address?.city_district || data.address?.state_district || '').split(' ')[0] || '';
      if (city) { document.getElementById('vsFilterCity').value = city; }
      else { toastError("Couldn't determine your city."); }
    } catch (e) { toastError('Location lookup failed.'); }
    finally { btn.disabled = false; btn.style.opacity = '1'; }
  }, (err) => {
    const messages = { 1: 'Location permission denied.', 2: 'Location unavailable.', 3: 'Location request timed out.' };
    toastError(messages[err.code] || 'Could not get your location.');
    btn.disabled = false; btn.style.opacity = '1';
  });
});
window.addEventListener('resize', () => {
  if (window.innerWidth > 860) {
    document.getElementById('mobileMenu').classList.remove('open');
  }
});
/* ============================================================
   OLR INDIA – VENDOR PRODUCTS JS  v9
   Requires: vendor-nav.js, vendor-upgrade.js
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
let allProducts = [];
let CATEGORIES  = {};
let CONDITIONS  = [];
let editingId   = null;
let currentListingType = 'rent';

// Unified photo slots: index 0–4 → slot 1–5
// Each entry: { file: File|null, preview: string, url: string|null }
const photoSlots = [null, null, null, null, null];
let previewProductId        = null;
let originalProductSnapshot = null;

// ── Suspended banner ──────────────────────────────────────────
function renderSuspendedBanner() {
  if (!vendorProfile) return;
  const banner = document.getElementById('suspendedBanner');
  if (!banner) return;
  if (!vendorProfile.is_active) {
    banner.style.display = 'block';
    document.querySelectorAll('#addProductBtn, #planUsageUpgradeBtn').forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.style.cursor  = 'not-allowed';
    });
  } else {
    banner.style.display = 'none';
  }
}

// ── Plan usage strip ──────────────────────────────────────────
function renderPlanUsageStrip() {
  if (!vendorProfile) return;
  const v     = vendorProfile;
  const strip = document.getElementById('planUsageStrip');
  const badge = document.getElementById('planUsageBadge');
  const text  = document.getElementById('planUsageText');
  const fill  = document.getElementById('planUsageBarFill');
  if (!strip) return;
  strip.style.display = '';
  badge.textContent   = PLAN_LABELS[v.subscription_plan] || v.subscription_plan;
  const used  = v.active_product_count ?? 0;
  const limit = v.max_active_posts;
  if (limit === null || limit === undefined) {
    text.textContent = `${used} active listing${used !== 1 ? 's' : ''} — unlimited on your plan`;
    fill.style.width = '8%';
    fill.classList.remove('danger');
  } else {
    text.textContent = `${used} of ${limit} active listing${limit !== 1 ? 's' : ''} used`;
    const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
    fill.style.width = pct + '%';
    fill.classList.toggle('danger', pct >= 90);
  }
}

document.getElementById('planUsageUpgradeBtn')?.addEventListener('click', () => openUpgradeModal());

// ── Load vendor profile ───────────────────────────────────────
async function loadVendorProfile() {
  const res = await apiRequest('/auth/vendor/profile', 'GET');
  if (!res.success) return;
  vendorProfile = res.vendor;
  renderNavAvatar();
  renderSuspendedBanner();
  renderPlanUsageStrip();
}

// ── Load categories ───────────────────────────────────────────
async function loadCategories() {
  const res = await apiRequest('/auth/vendor/categories', 'GET');
  if (res.success) CATEGORIES = res.categories;
  initCategoryDropdown();
}

function initCategoryDropdown() {
  const dropdown = document.getElementById('modalCategoryDropdown');
  if (!dropdown) return;
  dropdown.innerHTML = '';
  const clearOpt = document.createElement('div');
  clearOpt.className   = 'filter-custom-select-option';
  clearOpt.textContent = 'Select category';
  clearOpt.addEventListener('click', () => setCategoryValue('', 'Select category'));
  dropdown.appendChild(clearOpt);
  Object.keys(CATEGORIES).forEach(cat => {
    const opt = document.createElement('div');
    opt.className   = 'filter-custom-select-option';
    opt.textContent = cat;
    opt.addEventListener('click', () => setCategoryValue(cat, cat));
    dropdown.appendChild(opt);
  });
}

function setCategoryValue(val, label) {
  document.getElementById('modalCategory').value          = val;
  document.getElementById('modalCategoryLabel').textContent = label;
  document.getElementById('modalCategoryDropdown').classList.remove('open');
  // reset subcategory
  setSubcategoryValue('', 'Select subcategory');
  // populate subcategories
  const subDropdown = document.getElementById('modalSubcategoryDropdown');
  if (!subDropdown) return;
  subDropdown.innerHTML = '';
  const subs = (CATEGORIES[val] || {}).subcategories || [];
  if (subs.length) {
    const clearOpt = document.createElement('div');
    clearOpt.className   = 'filter-custom-select-option';
    clearOpt.textContent = 'Select subcategory';
    clearOpt.addEventListener('click', () => setSubcategoryValue('', 'Select subcategory'));
    subDropdown.appendChild(clearOpt);
    subs.forEach(s => {
      const opt = document.createElement('div');
      opt.className   = 'filter-custom-select-option';
      opt.textContent = s;
      opt.addEventListener('click', () => setSubcategoryValue(s, s));
      subDropdown.appendChild(opt);
    });
  }
  updateRentFields();
  clearFieldError('modalCategory', 'err-category');
}

function setSubcategoryValue(val, label) {
  document.getElementById('modalSubcategory').value             = val;
  document.getElementById('modalSubcategoryLabel').textContent  = label;
  document.getElementById('modalSubcategoryDropdown')?.classList.remove('open');
}

// ── Load conditions ───────────────────────────────────────────
async function loadConditions() {
  try {
    const res = await apiRequest('/auth/vendor/conditions', 'GET');
    if (res.success && Array.isArray(res.conditions)) CONDITIONS = res.conditions;
  } catch (_) {
    CONDITIONS = ['Brand New', 'Like New', 'Good', 'Fair', 'For Parts'];
  }
  renderConditionChips();
}

function renderConditionChips(selectedValue = '') {
  const grid = document.getElementById('conditionGrid');
  if (!grid) return;
  grid.innerHTML = CONDITIONS.map(c =>
    `<button type="button" class="condition-chip${c === selectedValue ? ' selected' : ''}"
      onclick="selectCondition('${c}')">${c}</button>`
  ).join('');
  document.getElementById('modalCondition').value = selectedValue;
}

function selectCondition(val) {
  document.querySelectorAll('.condition-chip').forEach(chip => {
    chip.classList.toggle('selected', chip.textContent === val);
  });
  document.getElementById('modalCondition').value = val;
  document.getElementById('err-condition')?.classList.remove('visible');
}

// ── Listing type toggle ───────────────────────────────────────
function setListingType(type) {
  currentListingType = type;
  document.getElementById('toggleRent')?.classList.toggle('active', type === 'rent');
  document.getElementById('toggleSell')?.classList.toggle('active', type === 'sell');
  document.getElementById('rentFieldsSection').style.display = type === 'rent' ? '' : 'none';
  document.getElementById('sellFieldsSection').style.display = type === 'sell' ? '' : 'none';
  if (type === 'sell') {
    ['rent_per_hour','rent_per_km','rent_per_day','rent_per_month','security_deposit'].forEach(n => {
      const el = document.querySelector(`[name="${n}"]`);
      if (el) el.value = '';
    });
    document.getElementById('err-rent-price')?.classList.remove('visible');
  } else {
    const sp = document.getElementById('modalSellingPrice');
    if (sp) sp.value = '';
    renderConditionChips('');
    clearFieldError('modalSellingPrice', 'err-sell-price');
    document.getElementById('err-condition')?.classList.remove('visible');
  }
}

// ── Rent field visibility by category ────────────────────────
const RENT_FIELDS_BY_CATEGORY = {
  "Passenger Vehicles":               ["hour","km","day","month"],
  "Bikes & Scooters":                 ["hour","km","day","month"],
  "Commercial Vehicles":              ["hour","km","day","month"],
  "Cargo & Shipping":                 ["hour","km","day","month"],
  "Construction Equipment":           ["hour","day","month"],
  "Furniture & Home Appliances":      ["day","month"],
  "Photography & Content Creator Gear": ["hour","day"],
  "Events & Weddings":                ["hour","day"],
  "Fashion & Designer Wear":          ["day"],
  "Agricultural Equipment":           ["hour","day","month"],
  "Medical Equipment":                ["hour","day","month"],
  "Baby & Kids Gear":                 ["day","month"],
  "Adventure & Trekking Gear":        ["day","month"],
  "Sports & Fitness Equipment":       ["hour","day","month"],
  "Electrical & Power Tools":         ["hour","day","month"],
  "Tools & Tackles":                  ["hour","day","month"],
  "Properties":                       ["day","month"],
  "Industrial Equipment":             ["hour","day","month"],
  "Warehouse & Storage":              ["day","month"],
  "Machineries":                      ["hour","day","month"],
  "Musical Instruments":              ["day","month"],
  "Office & Business Essentials":     ["day","month"],
};

function updateRentFields() {
  const cat     = document.getElementById('modalCategory').value;
  const allowed = RENT_FIELDS_BY_CATEGORY[cat] || ["day","month"];
  ["hour","km","day","month"].forEach(field => {
    const wrap  = document.getElementById(`rentWrap_${field}`);
    const input = document.querySelector(`[name="rent_per_${field}"]`);
    if (!wrap || !input) return;
    const show = allowed.includes(field);
    wrap.style.display = show ? '' : 'none';
    if (!show) input.value = '';
  });
}

// ── Location helpers ──────────────────────────────────────────
function clearLocationHiddens() {
  document.getElementById('modalLat').value = '';
  document.getElementById('modalLng').value = '';
  const statusEl = document.getElementById('modalPincodeStatus');
  if (statusEl) statusEl.textContent = '';
}

function initDetectLocationBtn() {
  const btn = document.getElementById('detectLocationBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!navigator.geolocation) { toastError('Geolocation not supported by your browser.'); return; }
    btn.classList.add('detecting');
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const { latitude, longitude } = pos.coords;
        document.getElementById('modalLat').value = latitude;
        document.getElementById('modalLng').value = longitude;
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        const addr = data.address || {};
        const pincode = addr.postcode || '';
        const area    = addr.suburb || addr.neighbourhood || addr.village || '';
        const city    = addr.city   || addr.town || addr.county || '';
        const state   = addr.state  || '';
        if (pincode) document.getElementById('modalPincode').value = pincode;
        if (area)    document.getElementById('modalArea').value    = area;
        if (city)    document.getElementById('modalCity').value    = city;
        if (state)   document.getElementById('modalState').value   = state;
        const statusEl = document.getElementById('modalPincodeStatus');
        if (statusEl) statusEl.textContent = '✅ Location detected';
        document.getElementById('err-location')?.classList.remove('visible');
        toastSuccess('Location detected!');
      } catch {
        toastError('Could not detect location. Please enter your pincode manually.');
      }
      btn.classList.remove('detecting');
    }, err => {
      const msgs = { 1: 'Location permission denied.', 2: 'Location unavailable.', 3: 'Request timed out.' };
      toastError((msgs[err.code] || 'Could not get location.') + ' Please enter pincode manually.');
      btn.classList.remove('detecting');
    });
  });
}

function initModalPincodeAutofill() {
  wirePincodeAutofill({
    pincodeInput: document.getElementById('modalPincode'),
    areaInput:    document.getElementById('modalArea'),
    cityInput:    document.getElementById('modalCity'),
    stateInput:   document.getElementById('modalState'),
    statusEl:     document.getElementById('modalPincodeStatus'),
    onSuccess: (lat, lng) => {
      if (lat) document.getElementById('modalLat').value = lat;
      if (lng) document.getElementById('modalLng').value = lng;
      document.getElementById('err-location')?.classList.remove('visible');
    }
  });
  document.getElementById('modalPincode')?.addEventListener('input', () => {
    clearFieldError('modalPincode', 'err-location');
  });
}

// ── Load products ─────────────────────────────────────────────
async function loadProducts() {
  const grid = document.getElementById('productGrid');
  if (grid) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state-icon">📦</div>
      <h3>Loading your products…</h3>
    </div>`;
  }
  const res = await apiRequest('/auth/vendor/products', 'GET');
  if (!res.success) return;
  allProducts = res.products;
  renderProducts();
  updateStats();
  renderExpiryBanner(res.expiry_banner);
  await loadVendorProfile();
}

function updateStats() {
  const totalEl  = document.getElementById('statTotal');
  const activeEl = document.getElementById('statActive');
  const clicksEl = document.getElementById('statClicks');
  if (totalEl)  totalEl.textContent  = allProducts.length;
  if (activeEl) activeEl.textContent = allProducts.filter(p => p.is_active).length;
  if (clicksEl) clicksEl.textContent = allProducts.reduce((s, p) => s + (p.click_count || 0), 0);
}

function priceLine(p) {
  if (p.listing_type === 'sell') {
    return p.selling_price
      ? `₹${Number(p.selling_price).toLocaleString('en-IN')} <span>selling price</span>`
      : `<span style="font-size:12px;color:var(--c-ink-faint);">Price not set</span>`;
  }
  if (p.rent_per_hour)  return `₹${p.rent_per_hour} <span>/ hour</span>`;
  if (p.rent_per_km)    return `₹${p.rent_per_km} <span>/ km</span>`;
  if (p.rent_per_day)   return `₹${p.rent_per_day} <span>/ day</span>`;
  if (p.rent_per_month) return `₹${p.rent_per_month} <span>/ month</span>`;
  return `<span style="font-size:12px;color:var(--c-ink-faint);">Price not set</span>`;
}

function renderExpiryBanner(banner) {
  let el = document.getElementById('expiryBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'expiryBanner';
    const grid = document.getElementById('productGrid');
    grid?.parentNode.insertBefore(el, grid);
  }
  if (!banner || !banner.show) { el.style.display = 'none'; return; }
  el.style.cssText = `display:flex;align-items:center;justify-content:space-between;background:#fff7ed;border:1px solid #f97316;color:#9a3412;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:13.5px;gap:12px;flex-wrap:wrap;`;
  el.innerHTML = `<span>⚠️ ${banner.message}</span><button class="btn btn-primary" style="width:auto;padding:8px 16px;flex-shrink:0;font-size:13px;" onclick="openUpgradeModal()">Renew Now</button>`;
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  if (allProducts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">📦</div>
        <h3>No products listed yet</h3>
        <p>Add your first product to start getting enquiries.</p>
        <button class="btn btn-primary" onclick="openAddModal()" style="width:auto;padding:10px 24px;display:inline-flex;margin-top:8px;">Add first product</button>
      </div>`;
    return;
  }

  grid.innerHTML = allProducts.map(p => {
    const img = p.images && p.images[0]
      ? `<img class="product-img" src="${p.images[0]}" alt="${p.name}" loading="lazy">`
      : `<div class="product-img-placeholder">📦</div>`;

    const interestText = (p.click_count || 0) > 0
      ? `${p.click_count} ${p.click_count === 1 ? 'person' : 'people'} viewed this`
      : 'Not viewed yet';

    const isAdminFlagged = p.deactivated_by === 'admin';
    const daysLeft       = p.edit_days_remaining ?? 0;
    const isSell         = p.listing_type === 'sell';

    const typeBadge = `<span class="product-type-badge ${isSell ? 'sell' : 'rent'}">${isSell ? 'For Sale' : 'For Rent'}</span>`;

    const conditionBadge = isSell && p.condition
      ? `<span style="font-size:11px;background:#f0fdf4;color:#15803d;border-radius:20px;padding:2px 8px;font-weight:600;">${p.condition}</span>`
      : '';

    const strikeBanner = isAdminFlagged ? `
      <div style="background:#fff7ed;border:1px solid #f97316;color:#9a3412;padding:10px 12px;border-radius:6px;margin:8px 0;font-size:13px;">
        <strong>Removed by Admin</strong><br>
        Reason: ${p.strike_reason || 'Policy violation'}<br>
        Edit this product to bring it back live.
        <strong style="display:block;margin-top:4px;">${daysLeft} day${daysLeft === 1 ? '' : 's'} left before permanent deletion.</strong>
      </div>` : '';

    const expiredBanner = p.deactivated_by === 'plan_expired' ? `
      <div style="background:#fff7ed;border:1px solid #f97316;color:#9a3412;padding:10px 12px;border-radius:6px;margin:8px 0;font-size:13px;">
        <strong>Hidden — Plan Expired</strong><br>
        Renew your plan to bring this listing back live.
        <button onclick="event.stopPropagation();openUpgradeModal()" style="margin-top:6px;display:block;background:#f97316;color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;">Renew Plan</button>
      </div>` : '';

    return `
      <div class="product-card" onclick="handleCardClick(event,${p.id})">
        ${img}
        <span class="product-status-badge ${p.is_active ? '' : 'inactive'}">${p.is_active ? 'Live' : 'Inactive'}</span>
        <button class="product-share-btn" onclick="event.stopPropagation();openShareModal(${p.id})" title="Share">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="18" cy="5" r="3" stroke="currentColor" stroke-width="1.8"/>
            <circle cx="6" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>
            <circle cx="18" cy="19" r="3" stroke="currentColor" stroke-width="1.8"/>
            <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" stroke="currentColor" stroke-width="1.8"/>
          </svg>
        </button>
        <div class="product-body">
          ${strikeBanner}${expiredBanner}
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
            <div class="product-cat">${p.category || ''}</div>
            ${typeBadge}
            ${conditionBadge}
          </div>
          <div class="product-title">${p.name}</div>
          <div class="product-desc">${p.description || 'No description.'}</div>
          <div class="product-meta">
            <div class="product-price">${priceLine(p)}</div>
            <div class="product-interest">${interestText}</div>
          </div>
        </div>
      </div>`;
  }).join('');
}

function handleCardClick(evt, productId) {
  if (evt.target.closest('.product-action-btn') || evt.target.closest('.product-share-btn')) return;
  openPreviewModal(productId);
}

// ── Toggle status ─────────────────────────────────────────────
async function toggleProductStatus(productId, newStatus) {
  if (vendorProfile && !vendorProfile.is_active) {
    toastError('Your account is suspended. Contact support to regain access.'); return;
  }
  const res = await apiRequest(`/auth/vendor/products/${productId}/status`, 'PUT', { is_active: newStatus });
  if (res.success) {
    toastSuccess(newStatus ? 'Product reactivated.' : 'Marked as inactive.');
    await loadProducts();
    if (previewProductId === productId) renderPreviewModal(productId);
  } else {
    if (res.message?.toLowerCase().includes('limit')) openUpgradeModal(res.message);
    else toastError(res.message || 'Failed to update status.');
  }
}

// ── Preview modal ─────────────────────────────────────────────
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
  const p    = allProducts.find(x => x.id === productId);
  const body = document.getElementById('previewModalBody');
  const foot = document.getElementById('previewModalFoot');
  if (!p || !body || !foot) return;

  const images = Array.isArray(p.images) ? p.images : [];
  const isSell = p.listing_type === 'sell';

  let imagesHtml = '';
  if (images.length) {
    const mainImg = `<img src="${images[0]}" alt="${p.name}"
      style="width:100%;height:240px;object-fit:cover;border-radius:8px;display:block;border:1px solid var(--c-border-soft);">`;
    const extraImgs = images.length > 1
      ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
          ${images.slice(1).map(url =>
            `<img src="${url}" alt="${p.name}"
              style="width:76px;height:76px;object-fit:cover;border-radius:6px;border:1px solid var(--c-border-soft);">`
          ).join('')}
         </div>`
      : '';
    imagesHtml = `<div style="margin:16px 0 12px;">${mainImg}${extraImgs}</div>`;
  } else {
    imagesHtml = `<div style="width:100%;height:180px;background:var(--c-bg);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:40px;margin:16px 0 12px;border:1px solid var(--c-border-soft);">📦</div>`;
  }

  const typeBadgeHtml   = `<span class="product-type-badge ${isSell ? 'sell' : 'rent'}" style="position:static;">${isSell ? 'For Sale' : 'For Rent'}</span>`;
  const statusBadgeHtml = `<span class="product-status-badge ${p.is_active ? '' : 'inactive'}" style="position:static;">${p.is_active ? 'Live' : 'Inactive'}</span>`;

  let priceHtml = '';
  if (isSell) {
    priceHtml = p.selling_price
      ? `<div style="font-size:16px;font-weight:700;color:#15803d;margin:10px 0 4px;">₹${Number(p.selling_price).toLocaleString('en-IN')} <span style="font-size:13px;font-weight:500;color:var(--c-ink-soft);">selling price</span></div>`
      : '<div style="font-size:13px;color:var(--c-ink-faint);margin:10px 0 4px;">Price not set</div>';
    if (p.condition)
      priceHtml += `<div style="font-size:13px;margin-bottom:8px;">Condition: <span style="font-weight:600;color:#15803d;">${p.condition}</span></div>`;
  } else {
    const rows = [
      p.rent_per_hour  ? `₹${p.rent_per_hour} / hour`   : null,
      p.rent_per_km    ? `₹${p.rent_per_km} / km`       : null,
      p.rent_per_day   ? `₹${p.rent_per_day} / day`     : null,
      p.rent_per_month ? `₹${p.rent_per_month} / month` : null,
    ].filter(Boolean).join('  •  ');
    priceHtml = `<div style="font-size:16px;font-weight:700;color:var(--c-blue-deep);margin:10px 0 4px;">${rows || 'Price not set'}</div>`;
    if (p.security_deposit)
      priceHtml += `<div style="font-size:13px;color:var(--c-ink-faint);margin-bottom:8px;">Security deposit: ₹${Number(p.security_deposit).toLocaleString('en-IN')}</div>`;
  }

  const locationStr = [p.area, p.city, p.state, p.pincode].filter(Boolean).join(', ');

  const adminBanner = p.deactivated_by === 'admin' ? `
    <div style="background:#fff7ed;border:1px solid #f97316;color:#9a3412;padding:12px 14px;border-radius:6px;margin:14px 0 0;font-size:13px;">
      <strong>Removed by Admin</strong><br>
      Reason: ${p.strike_reason || 'Policy violation'}<br>
      <strong>${p.edit_days_remaining ?? 0} day(s) left</strong> — edit to bring it back live, or it will be permanently deleted.
    </div>` : '';

  body.innerHTML = `
    ${adminBanner}
    ${imagesHtml}
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
      ${statusBadgeHtml}
      ${typeBadgeHtml}
      <span class="product-cat" style="margin:0;font-size:12px;">${p.category || ''}${p.subcategory ? ' · ' + p.subcategory : ''}</span>
    </div>
    <h3 style="margin:0 0 6px;font-size:17px;font-weight:700;color:var(--c-ink);">${p.name}</h3>
    <p style="font-size:13.5px;color:var(--c-ink-soft);line-height:1.55;margin:0 0 4px;">${p.description || 'No description.'}</p>
    ${priceHtml}
    ${locationStr ? `<div style="font-size:12.5px;color:var(--c-ink-faint);margin-bottom:6px;">${locationStr}</div>` : ''}
    <div style="font-size:12.5px;color:#B5790A;font-weight:600;margin-bottom:4px;">
      ${(p.click_count || 0) > 0 ? `${p.click_count} ${p.click_count === 1 ? 'person' : 'people'} viewed this` : 'Not viewed yet'}
    </div>`;

  const deactivateLabel = isSell ? 'Mark as Sold' : 'Deactivate';
  const reactivateLabel = isSell ? 'Relist'       : 'Reactivate';
  const canToggle = p.deactivated_by !== 'admin' && p.deactivated_by !== 'plan_expired';

  foot.innerHTML = `
    <button class="btn btn-secondary" onclick="openShareModal(${p.id})">Share</button>
    ${canToggle ? `<button class="btn btn-secondary" onclick="toggleProductStatus(${p.id},${!p.is_active})">${p.is_active ? deactivateLabel : reactivateLabel}</button>` : ''}
    <button class="btn btn-secondary" onclick="closePreviewModal();openEditModal(${p.id})">${p.deactivated_by === 'admin' ? 'Edit to go live' : 'Edit'}</button>
    <button class="btn btn-primary" style="background:var(--c-error);" onclick="closePreviewModal();confirmDelete(${p.id})">Delete</button>`;
}

// ── Share ─────────────────────────────────────────────────────
function openShareModal(productId) {
  const p = allProducts.find(x => x.id === productId);
  if (!p || !p.share_slug) { toastError('Share link not available yet.'); return; }
  const url = `https://olrindia.com/product/${slugify(p.category)}/${slugify(p.city || 'india')}/${p.share_slug}`;
  if (navigator.share) { navigator.share({ title: p.name, text: p.name, url }).catch(() => {}); return; }
  document.getElementById('shareLinkInput').value = url;
  const waBtn = document.getElementById('shareWhatsappBtn');
  if (waBtn) waBtn.href = `https://wa.me/?text=${encodeURIComponent(p.name + ' - ' + url)}`;
  document.getElementById('shareNativeBtn').style.display = 'none';
  document.getElementById('shareModalOverlay').classList.add('open');
}

document.getElementById('shareModalClose')?.addEventListener('click', () =>
  document.getElementById('shareModalOverlay').classList.remove('open')
);

document.getElementById('shareLinkCopyBtn')?.addEventListener('click', async () => {
  const val = document.getElementById('shareLinkInput').value;
  try { await navigator.clipboard.writeText(val); } catch {
    document.getElementById('shareLinkInput').select();
    document.execCommand('copy');
  }
  toastSuccess('Link copied!');
});

// ══════════════════════════════════════════════════════════════
//  PHOTO UPLOAD – unified zone with thumbnail strip
//  Touch reorder: tap one thumb then tap another to swap.
//  Desktop: mouse drag to reorder.
// ══════════════════════════════════════════════════════════════

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function compressImage(file, maxWidthPx = 1920, qualityJpeg = 0.82) {
  return new Promise(resolve => {
    if (file.size < 500 * 1024) { resolve(file); return; }
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxWidthPx) { h = Math.round(h * maxWidthPx / w); w = maxWidthPx; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', qualityJpeg);
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

function usedSlotCount()  { return photoSlots.filter(s => s !== null).length; }
function firstEmptySlot() { return photoSlots.indexOf(null); }

let touchSelectedIdx = null;
let dragSrcIdx       = null;

function renderPhotoThumbs() {
  const thumbsEl    = document.getElementById('photoThumbs');
  const uploadInner = document.getElementById('photoUploadInner');
  const zone        = document.getElementById('photoUploadZone');
  const errEl       = document.querySelector('.photo-upload-err');
  if (!thumbsEl) return;

  const used = usedSlotCount();

  if (used === 0) {
    thumbsEl.style.display    = 'none';
    uploadInner.style.display = '';
    zone?.classList.remove('has-photos');
    touchSelectedIdx = null;
    return;
  }

  uploadInner.style.display = 'none';
  thumbsEl.style.display    = '';
  zone?.classList.add('has-photos');
  thumbsEl.innerHTML = '';

  photoSlots.forEach((slot, idx) => {
    if (!slot) return;

    const thumb       = document.createElement('div');
    thumb.className   = 'photo-thumb' + (idx === 0 ? ' photo-thumb-main' : '');
    thumb.dataset.idx = idx;

    // Desktop drag
    thumb.draggable = true;
    thumb.addEventListener('dragstart', e => {
      dragSrcIdx = idx;
      thumb.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    thumb.addEventListener('dragend', () => {
      thumb.classList.remove('dragging');
      thumbsEl.querySelectorAll('.photo-thumb').forEach(t => t.classList.remove('drag-over'));
      dragSrcIdx = null;
    });
    thumb.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      thumbsEl.querySelectorAll('.photo-thumb').forEach(t => t.classList.remove('drag-over'));
      thumb.classList.add('drag-over');
    });
    thumb.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrcIdx === null || dragSrcIdx === idx) return;
      swapSlots(dragSrcIdx, idx);
      dragSrcIdx = null;
    });

    // Touch tap-to-reorder
    thumb.addEventListener('click', e => {
      if (e.target.closest('.photo-thumb-del')) return;
      if (touchSelectedIdx === null) {
        touchSelectedIdx = idx;
        thumb.classList.add('touch-selected');
      } else if (touchSelectedIdx === idx) {
        touchSelectedIdx = null;
        thumb.classList.remove('touch-selected');
      } else {
        swapSlots(touchSelectedIdx, idx);
        touchSelectedIdx = null;
      }
    });

    const imgEl = document.createElement('img');
    imgEl.src   = slot.preview || slot.url || '';
    imgEl.alt   = `Photo ${idx + 1}`;
    thumb.appendChild(imgEl);

    const delBtn     = document.createElement('button');
    delBtn.type      = 'button';
    delBtn.className = 'photo-thumb-del';
    delBtn.title     = 'Remove photo';
    delBtn.innerHTML = '✕';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      removePhotoSlot(idx);
    });
    thumb.appendChild(delBtn);

    if (touchSelectedIdx === idx) thumb.classList.add('touch-selected');
    thumbsEl.appendChild(thumb);
  });

  if (used < 5) {
    const addBtn     = document.createElement('button');
    addBtn.type      = 'button';
    addBtn.className = 'photo-add-btn';
    addBtn.title     = 'Add more photos';
    addBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Add</span>`;
    addBtn.addEventListener('click', () => document.getElementById('bulkImageInput').click());
    thumbsEl.appendChild(addBtn);
  }

  if (errEl) errEl.classList.remove('visible');
}

function swapSlots(a, b) {
  const tmp     = photoSlots[a];
  photoSlots[a] = photoSlots[b];
  photoSlots[b] = tmp;
  renderPhotoThumbs();
}

function removePhotoSlot(idx) {
  const slot = photoSlots[idx];
  if (!slot) return;
  if (editingId && slot.url && !slot.file) {
    apiRequest(`/auth/vendor/products/${editingId}/image/${idx + 1}`, 'DELETE').catch(() => {});
  }
  photoSlots[idx] = null;
  compactPhotoSlots();
  touchSelectedIdx = null;
  renderPhotoThumbs();
}

function compactPhotoSlots() {
  const filled = photoSlots.filter(s => s !== null);
  for (let i = 0; i < 5; i++) photoSlots[i] = filled[i] || null;
}

async function addPhotos(files) {
  const toAdd = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!toAdd.length) return;
  const available = 5 - usedSlotCount();
  if (available <= 0) { toastError('You already have 5 photos. Remove one to add more.'); return; }
  const batch = toAdd.slice(0, available);
  if (toAdd.length > available)
    toastError(`Only ${available} slot${available > 1 ? 's' : ''} remaining — extra photos skipped.`);
  for (const file of batch) {
    const slotIdx = firstEmptySlot();
    if (slotIdx === -1) break;
    try {
      const preview       = await readFileAsDataUrl(file);
      photoSlots[slotIdx] = { file, preview, url: null };
    } catch {
      toastError('Could not read one of the images.');
    }
  }
  renderPhotoThumbs();
}

function clearAllPhotos() {
  for (let i = 0; i < 5; i++) photoSlots[i] = null;
  touchSelectedIdx = null;
  renderPhotoThumbs();
  const uploadInner = document.getElementById('photoUploadInner');
  if (uploadInner) uploadInner.style.display = '';
}

function loadExistingImages(images) {
  clearAllPhotos();
  (images || []).slice(0, 5).forEach((url, i) => {
    if (url) photoSlots[i] = { file: null, preview: url, url };
  });
  renderPhotoThumbs();
}

function initPhotoUpload() {
  if (window.__photoUploadReady) return;
  window.__photoUploadReady = true;

  const bulkInput = document.getElementById('bulkImageInput');
  const zone      = document.getElementById('photoUploadZone');

  bulkInput?.addEventListener('change', async function () {
    if (!this.files?.length) return;
    await addPhotos(this.files);
    this.value = '';
  });

  zone?.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone?.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone?.addEventListener('drop', async e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer?.files?.length) await addPhotos(e.dataTransfer.files);
  });
}

// ── Field error helpers ───────────────────────────────────────
function setFieldError(inputId, errorId) {
  document.getElementById(inputId)?.closest('.field')?.classList.add('has-error');
  document.getElementById(errorId)?.classList.add('visible');
}

function clearFieldError(inputId, errorId) {
  document.getElementById(inputId)?.closest('.field')?.classList.remove('has-error');
  document.getElementById(errorId)?.classList.remove('visible');
}

function clearAllFieldErrors() {
  document.querySelectorAll('.field.has-error').forEach(f => f.classList.remove('has-error'));
  document.querySelectorAll('.field-error.visible, .field-error-block.visible').forEach(e => e.classList.remove('visible'));
}

// ── Validate form ─────────────────────────────────────────────
function validateProductForm(form, isAdd) {
  clearAllFieldErrors();
  let valid   = true;
  const lt    = currentListingType;
  const name  = form.querySelector('[name="name"]').value.trim();
  const cat   = document.getElementById('modalCategory').value;
  const pincode = form.querySelector('[name="pincode"]').value.trim();
  const lat   = document.getElementById('modalLat').value;

  if (!name) { setFieldError('modalName',     'err-name');     valid = false; }
  if (!cat)  { setFieldError('modalCategory', 'err-category'); valid = false; }

  if (isAdd && usedSlotCount() === 0) {
    document.querySelector('.photo-upload-err')?.classList.add('visible');
    valid = false;
  }

  if (!pincode && !lat) {
    document.getElementById('err-location')?.classList.add('visible');
    valid = false;
  }

  if (lt === 'rent') {
    const rh = form.querySelector('[name="rent_per_hour"]').value.trim();
    const rk = form.querySelector('[name="rent_per_km"]').value.trim();
    const rd = form.querySelector('[name="rent_per_day"]').value.trim();
    const rm = form.querySelector('[name="rent_per_month"]').value.trim();
    if (!(rh || rk || rd || rm)) {
      document.getElementById('err-rent-price')?.classList.add('visible');
      valid = false;
    }
  } else {
    const sp   = document.getElementById('modalSellingPrice').value.trim();
    const cond = document.getElementById('modalCondition').value;
    if (!sp)   { setFieldError('modalSellingPrice', 'err-sell-price'); valid = false; }
    if (!cond) { document.getElementById('err-condition')?.classList.add('visible'); valid = false; }
  }

  if (!valid) {
    const firstErr = document.querySelector(
      '.field.has-error, .field-error-block.visible, .photo-upload-err.visible'
    );
    firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return valid;
}

// ── Open ADD modal ────────────────────────────────────────────
function openAddModal() {
  if (vendorProfile && !vendorProfile.is_active) {
    toastError('Your account is suspended. Contact support.'); return;
  }
  if (vendorProfile && vendorProfile.max_active_posts !== null
      && vendorProfile.active_product_count >= vendorProfile.max_active_posts) {
    openUpgradeModal(`You've reached your plan limit of ${vendorProfile.max_active_posts} active posts. Upgrade to list more.`);
    return;
  }

  editingId = null;
  document.getElementById('modalTitle').textContent    = 'Add new product';
  document.getElementById('modalSubtitle').textContent = 'Fill in the details below to list your item.';
  document.getElementById('productForm').reset();
  document.getElementById('listingTypeToggle').style.display = '';
  document.getElementById('listingTypeLocked').style.display = 'none';
  clearAllFieldErrors();
  clearAllPhotos();
  setListingType('rent');
  renderConditionChips('');
  clearLocationHiddens();
  setCategoryValue('', 'Select category');

  const account = getSessionAccount('vendor');
  if (account) {
    const f = document.getElementById('productForm');
    f.querySelector('[name="pincode"]').value = account.pincode || '';
    f.querySelector('[name="area"]').value    = account.area    || '';
    f.querySelector('[name="city"]').value    = account.city    || '';
    f.querySelector('[name="state"]').value   = account.state   || '';
  }

  document.getElementById('productModalOverlay').classList.add('open');
}

// ── Open EDIT modal ───────────────────────────────────────────
async function openEditModal(productId) {
  editingId = productId;
  const p = allProducts.find(x => x.id === productId);
  if (!p) return;

  document.getElementById('modalTitle').textContent    = 'Edit product';
  document.getElementById('modalSubtitle').textContent = 'Listing type (Rent / Sell) cannot be changed.';
  const form = document.getElementById('productForm');
  form.reset();
  clearLocationHiddens();
  clearAllFieldErrors();

  const lt = p.listing_type || 'rent';

  document.getElementById('listingTypeToggle').style.display = 'none';
  document.getElementById('listingTypeLocked').style.display = '';
  const pill = document.getElementById('listingTypeLockedPill');
  if (pill) {
    pill.textContent = lt === 'sell' ? 'For Sale' : 'For Rent';
    pill.className   = 'lt-locked-pill' + (lt === 'sell' ? ' sell' : '');
  }

  currentListingType = lt;
  document.getElementById('rentFieldsSection').style.display = lt === 'rent' ? '' : 'none';
  document.getElementById('sellFieldsSection').style.display = lt === 'sell' ? '' : 'none';

  form.querySelector('[name="name"]').value        = p.name        || '';
  form.querySelector('[name="description"]').value = p.description || '';
  form.querySelector('[name="pincode"]').value     = p.pincode     || '';
  form.querySelector('[name="area"]').value        = p.area        || '';
  form.querySelector('[name="city"]').value        = p.city        || '';
  form.querySelector('[name="state"]').value       = p.state       || '';
  document.getElementById('modalLat').value        = p.latitude    || '';
  document.getElementById('modalLng').value        = p.longitude   || '';

  if (lt === 'rent') {
    form.querySelector('[name="rent_per_hour"]').value    = p.rent_per_hour    || '';
    form.querySelector('[name="rent_per_km"]').value      = p.rent_per_km      || '';
    form.querySelector('[name="rent_per_day"]').value     = p.rent_per_day     || '';
    form.querySelector('[name="rent_per_month"]').value   = p.rent_per_month   || '';
    form.querySelector('[name="security_deposit"]').value = p.security_deposit || '';
  } else {
    document.getElementById('modalSellingPrice').value = p.selling_price || '';
    renderConditionChips(p.condition || '');
  }

  originalProductSnapshot = {
    name: p.name || '', description: p.description || '',
    listing_type: lt,
    rent_per_hour:    String(p.rent_per_hour    || ''),
    rent_per_km:      String(p.rent_per_km      || ''),
    rent_per_day:     String(p.rent_per_day     || ''),
    rent_per_month:   String(p.rent_per_month   || ''),
    security_deposit: String(p.security_deposit || ''),
    selling_price:    String(p.selling_price    || ''),
    condition:   p.condition   || '',
    category:    p.category    || '',
    subcategory: p.subcategory || '',
    pincode: p.pincode || '', area: p.area   || '',
    city:    p.city    || '', state: p.state  || '',
    latitude:  String(p.latitude  || ''),
    longitude: String(p.longitude || ''),
  };

  // Set category and subcategory via custom dropdowns
  setCategoryValue(p.category || '', p.category || 'Select category');
  setTimeout(() => setSubcategoryValue(p.subcategory || '', p.subcategory || 'Select subcategory'), 50);

  loadExistingImages(p.images);
  document.getElementById('productModalOverlay').classList.add('open');
}

function closeProductModal() {
  document.getElementById('productModalOverlay').classList.remove('open');
  editingId = null;
  clearAllFieldErrors();
}

// ── Save product ──────────────────────────────────────────────
document.getElementById('productForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const form    = e.target;
  const saveBtn = document.getElementById('modalSaveBtn');

  if (!validateProductForm(form, editingId === null)) return;

  const lt      = currentListingType;
  const name    = form.querySelector('[name="name"]').value.trim();
  const cat     = document.getElementById('modalCategory').value;
  const pincode = form.querySelector('[name="pincode"]').value.trim();
  const lat     = document.getElementById('modalLat').value;
  const lng     = document.getElementById('modalLng').value;

  if (editingId === null) {
    // ══ ADD ══
    const fd = new FormData();
    fd.append('name',         name);
    fd.append('description',  form.querySelector('[name="description"]').value.trim());
    fd.append('category',     cat);
    fd.append('subcategory',  document.getElementById('modalSubcategory').value);
    fd.append('listing_type', lt);
    fd.append('pincode',      pincode);
    fd.append('area',         form.querySelector('[name="area"]').value.trim());
    fd.append('city',         form.querySelector('[name="city"]').value.trim());
    fd.append('state',        form.querySelector('[name="state"]').value.trim());
    fd.append('latitude',     lat || '');
    fd.append('longitude',    lng || '');

    if (lt === 'rent') {
      fd.append('rent_per_hour',    form.querySelector('[name="rent_per_hour"]').value.trim());
      fd.append('rent_per_km',      form.querySelector('[name="rent_per_km"]').value.trim());
      fd.append('rent_per_day',     form.querySelector('[name="rent_per_day"]').value.trim());
      fd.append('rent_per_month',   form.querySelector('[name="rent_per_month"]').value.trim());
      fd.append('security_deposit', form.querySelector('[name="security_deposit"]').value.trim());
    } else {
      fd.append('selling_price', document.getElementById('modalSellingPrice').value.trim());
      fd.append('condition',     document.getElementById('modalCondition').value);
    }

    for (let i = 0; i < 5; i++) {
      const slot = photoSlots[i];
      if (slot?.file) {
        const compressed = await compressImage(slot.file);
        fd.append(`image${i + 1}`, compressed);
      }
    }

    setButtonLoading(saveBtn, true);
    let res;
    try {
      const resp = await fetch(API_BASE + '/auth/vendor/products', {
        method: 'POST', body: fd, credentials: 'include'
      });
      res = await resp.json();
    } catch {
      toastError('Upload failed. Please try again.');
      setButtonLoading(saveBtn, false);
      return;
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
    // ══ EDIT ══
    const snap  = originalProductSnapshot;
    const desc  = form.querySelector('[name="description"]').value.trim();
    const sub   = document.getElementById('modalSubcategory').value;
    const area  = form.querySelector('[name="area"]').value.trim();
    const city  = form.querySelector('[name="city"]').value.trim();
    const state = form.querySelector('[name="state"]').value.trim();

    const data = {
      listing_type: lt,
      name:        name     || undefined,
      category:    cat      || undefined,
      description: desc     === '' ? null : desc,
      subcategory: sub      === '' ? null : sub,
      pincode:     pincode  === '' ? null : pincode,
      area:        area     === '' ? null : area,
      city:        city     === '' ? null : city,
      state:       state    === '' ? null : state,
      latitude:    lat      || null,
      longitude:   lng      || null,
    };

    if (lt === 'rent') {
      const rh = form.querySelector('[name="rent_per_hour"]').value.trim();
      const rk = form.querySelector('[name="rent_per_km"]').value.trim();
      const rd = form.querySelector('[name="rent_per_day"]').value.trim();
      const rm = form.querySelector('[name="rent_per_month"]').value.trim();
      const sd = form.querySelector('[name="security_deposit"]').value.trim();
      data.rent_per_hour    = rh === '' ? null : rh;
      data.rent_per_km      = rk === '' ? null : rk;
      data.rent_per_day     = rd === '' ? null : rd;
      data.rent_per_month   = rm === '' ? null : rm;
      data.security_deposit = sd === '' ? null : sd;
    } else {
      const sp   = document.getElementById('modalSellingPrice').value.trim();
      const cond = document.getElementById('modalCondition').value;
      data.selling_price = sp   === '' ? null : sp;
      data.condition     = cond === '' ? null : cond;
    }

    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    const hasNewPhotos   = photoSlots.some(s => s?.file);
    let   hasFieldChange =
      name    !== snap.name        || desc    !== snap.description ||
      cat     !== snap.category    || sub     !== snap.subcategory ||
      pincode !== snap.pincode     || area    !== snap.area        ||
      city    !== snap.city        || state   !== snap.state       ||
      lat     !== snap.latitude    || lng     !== snap.longitude;

    if (lt === 'rent') {
      const rh = form.querySelector('[name="rent_per_hour"]').value.trim();
      const rk = form.querySelector('[name="rent_per_km"]').value.trim();
      const rd = form.querySelector('[name="rent_per_day"]').value.trim();
      const rm = form.querySelector('[name="rent_per_month"]').value.trim();
      const sd = form.querySelector('[name="security_deposit"]').value.trim();
      hasFieldChange = hasFieldChange ||
        rh !== snap.rent_per_hour || rk !== snap.rent_per_km ||
        rd !== snap.rent_per_day  || rm !== snap.rent_per_month || sd !== snap.security_deposit;
    } else {
      const sp   = document.getElementById('modalSellingPrice').value.trim();
      const cond = document.getElementById('modalCondition').value;
      hasFieldChange = hasFieldChange || sp !== snap.selling_price || cond !== snap.condition;
    }

    if (!hasFieldChange && !hasNewPhotos) {
      toastError('No changes detected.');
      return;
    }

    setButtonLoading(saveBtn, true);

    const res = await apiRequest(`/auth/vendor/products/${editingId}`, 'PUT', data);

    for (let i = 0; i < 5; i++) {
      const slot = photoSlots[i];
      if (slot?.file) {
        const fd = new FormData();
        fd.append('image', await compressImage(slot.file));
        await fetch(`${API_BASE}/auth/vendor/products/${editingId}/image/${i + 1}`, {
          method: 'PUT', body: fd, credentials: 'include'
        });
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

// ── Delete product ────────────────────────────────────────────
async function confirmDelete(productId) {
  const p = allProducts.find(x => x.id === productId);
  const confirmed = await showConfirm({
    title:        'Delete product?',
    text:         `"${p?.name}" and all its images will be permanently deleted.`,
    confirmLabel: 'Delete',
    cancelLabel:  'Cancel',
  });
  if (!confirmed) return;
  const res = await apiRequest(`/auth/vendor/products/${productId}`, 'DELETE');
  if (res.success) { toastSuccess('Product deleted.'); await loadProducts(); }
  else toastError(res.message || 'Delete failed.');
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('addProductBtn')?.addEventListener('click', openAddModal);
  initPhotoUpload();
  initModalPincodeAutofill();
  initDetectLocationBtn();
  loadCategories();
  loadConditions();
  loadProducts();

  // Real-time error clearing
  ['modalName','modalSellingPrice'].forEach(id => {
    const errMap = { modalName: 'err-name', modalSellingPrice: 'err-sell-price' };
    document.getElementById(id)?.addEventListener('input', () => clearFieldError(id, errMap[id]));
  });

  // Custom dropdown toggle — category & subcategory
  document.addEventListener('click', e => {
    const catBtn = document.getElementById('modalCategoryBtn');
    const catDD  = document.getElementById('modalCategoryDropdown');
    const subBtn = document.getElementById('modalSubcategoryBtn');
    const subDD  = document.getElementById('modalSubcategoryDropdown');
    if (catBtn?.contains(e.target)) {
      catDD.classList.toggle('open');
      subDD?.classList.remove('open');
    } else if (subBtn?.contains(e.target)) {
      subDD.classList.toggle('open');
      catDD?.classList.remove('open');
    } else {
      catDD?.classList.remove('open');
      subDD?.classList.remove('open');
    }
  });
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('productModalOverlay')?.classList.contains('open'))  closeProductModal();
  if (document.getElementById('previewModalOverlay')?.classList.contains('open'))  closePreviewModal();
  document.getElementById('shareModalOverlay')?.classList.remove('open');
  document.getElementById('upgradeModalOverlay')?.classList.remove('open');
});
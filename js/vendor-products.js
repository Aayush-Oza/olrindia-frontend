/* ============================================================
   OLR INDIA – VENDOR PRODUCTS JS  (my-products.html)
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

function slugify(text) {
  return (text || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const PLAN_LABELS = { free: 'Free', starter: 'Starter', growth: 'Growth', premium: 'Premium' };

// ── Nav avatar / name ─────────────────────────────────────────
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

// ── Suspended banner ──────────────────────────────────────────
function renderSuspendedBanner() {
  if (!vendorProfile) return;
  const banner = document.getElementById('suspendedBanner');
  if (!banner) return;
  if (!vendorProfile.is_active) {
    banner.style.display = 'block';
    document.querySelectorAll('#addProductBtn, #planUsageUpgradeBtn').forEach(btn => {
      btn.disabled = true; btn.style.opacity = '0.4'; btn.style.cursor = 'not-allowed';
    });
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
  const sel = document.getElementById('modalCategory');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select category</option>';
  Object.keys(CATEGORIES).forEach(cat => {
    const o = document.createElement('option');
    o.value = cat; o.textContent = cat;
    sel.appendChild(o);
  });
}

document.getElementById('modalCategory')?.addEventListener('change', function () {
  const subSel = document.getElementById('modalSubcategory');
  subSel.innerHTML = '<option value="">Select subcategory (optional)</option>';
  (CATEGORIES[this.value] || []).forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    subSel.appendChild(o);
  });
  updateRentFields();
});

// ── Rent field visibility ─────────────────────────────────────
const RENT_FIELDS_BY_CATEGORY = {
  "Passenger Vehicles": ["hour","km","day","month"], "Bikes & Scooters": ["hour","km","day","month"],
  "Commercial Vehicles": ["hour","km","day","month"], "Cargo & Shipping": ["hour","km","day","month"],
  "Construction Equipment": ["hour","day","month"], "Furniture & Home Appliances": ["day","month"],
  "Photography & Content Creator Gear": ["hour","day"], "Events & Weddings": ["hour","day"],
  "Fashion & Designer Wear": ["day"], "Agricultural Equipment": ["hour","day","month"],
  "Medical Equipment": ["hour","day","month"], "Baby & Kids Gear": ["day","month"],
  "Adventure & Trekking Gear": ["day","month"], "Sports & Fitness Equipment": ["hour","day","month"],
  "Electrical & Power Tools": ["hour","day","month"], "Tools & Tackles": ["hour","day","month"],
  "Properties": ["day","month"], "Industrial Equipment": ["hour","day","month"],
  "Warehouse & Storage": ["day","month"], "Machineries": ["hour","day","month"],
  "Musical Instruments": ["day","month"], "Office & Business Essentials": ["day","month"],
};

function updateRentFields() {
  const cat = document.getElementById('modalCategory').value;
  const allowed = RENT_FIELDS_BY_CATEGORY[cat] || ["day","month"];
  ["hour","km","day","month"].forEach(field => {
    const wrap = document.getElementById(`rentWrap_${field}`);
    const input = document.querySelector(`[name="rent_per_${field}"]`);
    if (!wrap || !input) return;
    const show = allowed.includes(field);
    wrap.style.display = show ? '' : 'none';
    if (!show) input.value = '';
  });
}

// ── Pincode autofill ──────────────────────────────────────────
function initModalPincodeAutofill() {
  wirePincodeAutofill({
    pincodeInput: document.getElementById('modalPincode'),
    areaInput: document.getElementById('modalArea'),
    cityInput: document.getElementById('modalCity'),
    stateInput: document.getElementById('modalState'),
    statusEl: document.getElementById('modalPincodeStatus'),
  });
}

// ── Load products ─────────────────────────────────────────────
async function loadProducts() {
  const res = await apiRequest('/auth/vendor/products', 'GET');
  if (!res.success) return;
  allProducts = res.products;
  renderProducts();
  updateStats();
  renderExpiryBanner(res.expiry_banner);
  await loadVendorProfile();
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
  if (p.rent_per_km)   return `₹${p.rent_per_km} <span>/ km</span>`;
  if (p.rent_per_day)  return `₹${p.rent_per_day} <span>/ day</span>`;
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
        <p>Add your first product to start getting rental enquiries.</p>
        <button class="btn btn-primary" onclick="openAddModal()" style="width:auto;padding:10px 24px;display:inline-flex;margin-top:8px;">Add first product</button>
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
        <button onclick="event.stopPropagation();openUpgradeModal()" style="margin-top:6px;display:block;background:#f97316;color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;">Renew Plan</button>
      </div>` : '';
    return `
      <div class="product-card" onclick="handleCardClick(event,${p.id})">
        ${img}
        <span class="product-status-badge ${p.is_active ? '' : 'inactive'}">${p.is_active ? 'Live' : 'Inactive'}</span>
        <button class="product-share-btn" onclick="event.stopPropagation();openShareModal(${p.id})" title="Share">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="3" stroke="currentColor" stroke-width="1.8"/><circle cx="6" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="19" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" stroke="currentColor" stroke-width="1.8"/></svg>
        </button>
        <div class="product-body">
          ${strikeBanner}${expiredBanner}
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
    toastSuccess(newStatus ? 'Product reactivated.' : 'Marked as rented.');
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
  const p = allProducts.find(x => x.id === productId);
  const body = document.getElementById('previewModalBody');
  const foot = document.getElementById('previewModalFoot');
  if (!p || !body || !foot) return;
  const images = p.images && p.images.length ? p.images : [];
  const imagesHtml = images.length
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;margin-bottom:16px;">
        ${images.map(url => `<img src="${url}" alt="${p.name}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--r-md);border:1px solid var(--c-border-soft);">`).join('')}
       </div>`
    : `<div class="product-img-placeholder" style="border-radius:var(--r-md);margin-bottom:16px;">📦</div>`;
  const priceRows = [
    p.rent_per_hour  ? `₹${p.rent_per_hour} / hour`  : null,
    p.rent_per_km    ? `₹${p.rent_per_km} / km`      : null,
    p.rent_per_day   ? `₹${p.rent_per_day} / day`    : null,
    p.rent_per_month ? `₹${p.rent_per_month} / month` : null,
  ].filter(Boolean).join(' &nbsp;•&nbsp; ');
  body.innerHTML = `
    ${p.deactivated_by === 'admin' ? `
    <div style="background:#fff7ed;border:1px solid #f97316;color:#9a3412;padding:12px 14px;border-radius:6px;margin-bottom:12px;font-size:13px;">
      ⚠️ <strong>Removed by Admin</strong><br>
      Reason: ${p.strike_reason || 'Policy violation'}<br>
      <strong>${p.edit_days_remaining ?? 0} day(s) left</strong> - edit to bring it back live, or it will be permanently deleted.
    </div>` : ''}
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span class="product-status-badge ${p.is_active ? '' : 'inactive'}" style="position:static;">${p.is_active ? 'Live' : 'Inactive'}</span>
      <span class="product-cat" style="margin:0;">${p.category || ''}${p.subcategory ? ' · ' + p.subcategory : ''}</span>
    </div>
    ${imagesHtml}
    <h3 style="margin:0 0 6px;font-size:18px;">${p.name}</h3>
    <p style="font-size:13.5px;color:var(--c-ink-soft);line-height:1.5;margin-bottom:12px;">${p.description || 'No description.'}</p>
    <div style="font-size:15px;font-weight:700;color:var(--c-blue-deep);margin-bottom:6px;">${priceRows || 'Price not set'}</div>
    ${p.security_deposit ? `<div style="font-size:13px;color:var(--c-ink-faint);margin-bottom:6px;">Security deposit: ₹${p.security_deposit}</div>` : ''}
    <div style="font-size:13px;color:var(--c-ink-faint);margin-bottom:6px;">${[p.area,p.city,p.state,p.pincode].filter(Boolean).join(', ')}</div>
    <div style="font-size:13px;color:#B5790A;font-weight:600;">
      ${(p.click_count || 0) > 0 ? `🔥 ${p.click_count} ${p.click_count === 1 ? 'person has' : 'people have'} viewed this` : 'Not viewed yet'}
    </div>`;
  foot.innerHTML = `
    <button class="btn btn-secondary" style="width:auto;padding:10px 16px;" onclick="openShareModal(${p.id})">Share</button>
    ${p.deactivated_by !== 'admin' && p.deactivated_by !== 'plan_expired' ? `
      <button class="btn btn-secondary" style="width:auto;padding:10px 16px;" onclick="toggleProductStatus(${p.id},${!p.is_active})">
        ${p.is_active ? 'Deactivate' : 'Reactivate'}
      </button>` : ''}
    ${p.deactivated_by === 'plan_expired' ? `
      <button class="btn btn-primary" style="width:auto;padding:10px 16px;" onclick="closePreviewModal();openUpgradeModal('Renew your plan to reactivate this product.')">
        🔄 Renew to Reactivate
      </button>` : ''}
    <button class="btn btn-secondary" style="width:auto;padding:10px 16px;" onclick="closePreviewModal();openEditModal(${p.id})">
      ${p.deactivated_by === 'admin' ? '✏️ Edit to go live' : 'Edit'}
    </button>
    <button class="btn btn-primary" style="width:auto;padding:10px 16px;background:var(--c-error);" onclick="closePreviewModal();confirmDelete(${p.id})">Delete</button>`;
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
document.getElementById('shareModalClose')?.addEventListener('click', () => document.getElementById('shareModalOverlay').classList.remove('open'));
document.getElementById('shareLinkCopyBtn')?.addEventListener('click', async () => {
  const val = document.getElementById('shareLinkInput').value;
  try { await navigator.clipboard.writeText(val); } catch { document.getElementById('shareLinkInput').select(); document.execCommand('copy'); }
  toastSuccess('Link copied!');
});

// ── Upgrade modal ─────────────────────────────────────────────
const PLAN_PRICES = { starter: 249, growth: 449, premium: 999 };

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
        await verifyAndActivatePlan({ razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature });
      },
      modal: { ondismiss: () => setButtonLoading(btn, false) },
    };
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', r => { toastError(`Payment failed: ${r.error.description || 'Try again.'}`); setButtonLoading(btn, false); });
    rzp.open();
  } catch (err) {
    toastError('Something went wrong.'); if (btn) setButtonLoading(btn, false);
  }
}

async function verifyAndActivatePlan({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  try {
    const res = await apiRequest('/auth/vendor/payment/verify', 'POST', { razorpay_order_id, razorpay_payment_id, razorpay_signature });
    if (res.success) { toastSuccess(`🎉 ${res.message}`); await loadVendorProfile(); await loadProducts(); }
    else toastError(res.message || 'Payment verification failed. Contact support.');
  } catch (err) { showPaymentRetryBanner({ razorpay_order_id, razorpay_payment_id, razorpay_signature }); }
}

function showPaymentRetryBanner({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  let el = document.getElementById('paymentRetryBanner');
  if (!el) { el = document.createElement('div'); el.id = 'paymentRetryBanner'; document.getElementById('panel-products')?.insertBefore(el, document.getElementById('panel-products').firstChild); }
  el.style.cssText = `display:flex;align-items:center;justify-content:space-between;background:#fff7ed;border:1px solid #f97316;color:#9a3412;padding:14px 16px;border-radius:8px;margin-bottom:16px;font-size:13.5px;gap:12px;flex-wrap:wrap;`;
  el.innerHTML = `<span>⚠️ Payment was deducted but your plan is being activated. Click Retry or contact <a href="mailto:support@olrindia.com" style="color:#9a3412;font-weight:600;">support@olrindia.com</a> with payment ID: <strong>${razorpay_payment_id}</strong></span>
    <button class="btn btn-primary" style="width:auto;padding:8px 16px;flex-shrink:0;font-size:13px;" id="paymentRetryBtn">Retry Activation</button>`;
  document.getElementById('paymentRetryBtn').addEventListener('click', async () => {
    el.innerHTML = `<span>⏳ Retrying...</span>`;
    await verifyAndActivatePlan({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
    el.remove();
  });
}

// ── Image slots ───────────────────────────────────────────────
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

function initImageSlots() {
  if (window.__slotsReady) return;
  window.__slotsReady = true;
  for (let i = 1; i <= 5; i++) {
    const slot = document.getElementById(`slot${i}`);
    if (!slot) continue;
    slot.addEventListener('click', () => { if (!slot.classList.contains('has-image')) slot.querySelector('input[type="file"]').click(); });
    slot.querySelector('input[type="file"]').addEventListener('change', async function () {
      if (!this.files[0]) return;
      slotFiles[i] = this.files[0];
      try { setSlotImage(i, await readFileAsDataUrl(this.files[0])); }
      catch { toastError('Could not read that image.'); delete slotFiles[i]; }
    });
    slot.querySelector('.img-slot-del')?.addEventListener('click', e => {
      e.stopPropagation();
      if (editingId && slotUrls[i]) deleteImageSlot(editingId, i); else clearSlotImage(i);
    });
  }
  const bulkInput = document.getElementById('bulkImageInput');
  if (bulkInput) {
    bulkInput.addEventListener('change', async function () {
      const files = Array.from(this.files || []);
      if (!files.length) return;
      const empty = [];
      for (let i = 1; i <= 5; i++) { if (!document.getElementById(`slot${i}`)?.classList.contains('has-image')) empty.push(i); }
      const targets = empty.length ? empty : [1,2,3,4,5];
      const toAdd = files.slice(0, targets.length);
      if (files.length > targets.length) toastError(`Only ${targets.length} slot(s) free - extra photos skipped.`);
      for (let idx = 0; idx < toAdd.length; idx++) {
        const file = toAdd[idx], slotNum = targets[idx];
        if (!file.type.startsWith('image/')) continue;
        slotFiles[slotNum] = file;
        try { setSlotImage(slotNum, await readFileAsDataUrl(file)); } catch { delete slotFiles[slotNum]; }
      }
      this.value = '';
      toastSuccess(`${toAdd.length} photo(s) added.`);
    });
  }
}

// ── Open ADD modal ────────────────────────────────────────────
function openAddModal() {
  if (vendorProfile && !vendorProfile.is_active) { toastError('Your account is suspended. Contact support.'); return; }
  if (vendorProfile && vendorProfile.max_active_posts !== null && vendorProfile.active_product_count >= vendorProfile.max_active_posts) {
    openUpgradeModal(`You've reached your plan's limit of ${vendorProfile.max_active_posts} active posts. Upgrade to list more.`); return;
  }
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add new product';
  document.getElementById('productForm').reset();
  const account = getSessionAccount('vendor');
  if (account) {
    const f = document.getElementById('productForm');
    f.querySelector('[name="pincode"]').value = account.pincode || '';
    f.querySelector('[name="area"]').value = account.area || '';
    f.querySelector('[name="city"]').value = account.city || '';
    f.querySelector('[name="state"]').value = account.state || '';
  }
  for (let i = 1; i <= 5; i++) clearSlotImage(i);
  document.getElementById('modalSubcategory').innerHTML = '<option value="">Select subcategory (optional)</option>';
  document.getElementById('productModalOverlay').classList.add('open');
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
  form.querySelector('[name="security_deposit"]').value = p.security_deposit || '';
  form.querySelector('[name="pincode"]').value = p.pincode || '';
  form.querySelector('[name="area"]').value = p.area || '';
  form.querySelector('[name="city"]').value = p.city || '';
  form.querySelector('[name="state"]').value = p.state || '';
  originalProductSnapshot = {
    name: p.name || '', description: p.description || '',
    rent_per_hour: String(p.rent_per_hour || ''), rent_per_km: String(p.rent_per_km || ''),
    rent_per_day: String(p.rent_per_day || ''), rent_per_month: String(p.rent_per_month || ''),
    security_deposit: String(p.security_deposit || ''), category: p.category || '',
    subcategory: p.subcategory || '', pincode: p.pincode || '', area: p.area || '',
    city: p.city || '', state: p.state || '',
  };
  const catSel = document.getElementById('modalCategory');
  catSel.value = p.category || '';
  catSel.dispatchEvent(new Event('change'));
  setTimeout(() => { document.getElementById('modalSubcategory').value = p.subcategory || ''; }, 50);
  for (let i = 1; i <= 5; i++) {
    delete slotFiles[i];
    const url = p.images && p.images[i - 1] ? p.images[i - 1] : null;
    slotUrls[i] = url;
    if (url) setSlotImage(i, url); else clearSlotImage(i);
  }
  document.getElementById('productModalOverlay').classList.add('open');
}

function closeProductModal() {
  document.getElementById('productModalOverlay').classList.remove('open');
  editingId = null;
}

// ── Save product ──────────────────────────────────────────────
document.getElementById('productForm')?.addEventListener('submit', async e => {
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
    if (!name) { toastError('Please enter a product name.'); return; }
    if (!category) { toastError('Please select a category.'); return; }
    if (!(rentHour || rentKm || rentDay || rentMonth)) { toastError('Please enter at least one rent price.'); return; }
    if (Object.keys(slotFiles).length === 0) { toastError('Please upload at least one photo.'); return; }
    const fd = new FormData();
    fd.append('name', name);
    fd.append('description', form.querySelector('[name="description"]').value.trim());
    fd.append('rent_per_hour', rentHour); fd.append('rent_per_km', rentKm);
    fd.append('rent_per_day', rentDay); fd.append('rent_per_month', rentMonth);
    fd.append('security_deposit', form.querySelector('[name="security_deposit"]').value.trim());
    fd.append('category', category);
    fd.append('subcategory', document.getElementById('modalSubcategory').value);
    fd.append('pincode', form.querySelector('[name="pincode"]').value.trim());
    fd.append('area', form.querySelector('[name="area"]').value.trim());
    fd.append('city', form.querySelector('[name="city"]').value.trim());
    fd.append('state', form.querySelector('[name="state"]').value.trim());
    for (let i = 1; i <= 5; i++) {
      if (slotFiles[i]) { const c = await compressImage(slotFiles[i]); fd.append(`image${i}`, c); }
    }
    setButtonLoading(saveBtn, true);
    const resp = await fetch(API_BASE + '/auth/vendor/products', { method: 'POST', body: fd, credentials: 'include' });
    let res;
    try { res = await resp.json(); } catch { toastError(`Upload failed (${resp.status}).`); setButtonLoading(saveBtn, false); return; }
    setButtonLoading(saveBtn, false);
    if (res.success) { toastSuccess('Product listed!'); closeProductModal(); await loadProducts(); }
    else if (res.message?.toLowerCase().includes('limit')) { closeProductModal(); openUpgradeModal(res.message); }
    else toastError(res.message || 'Failed to add product.');
  } else {
    const n = name, rh = rentHour, rk = rentKm, rd = rentDay, rm = rentMonth;
    const sd = form.querySelector('[name="security_deposit"]').value.trim();
    const cat = category, sub = document.getElementById('modalSubcategory').value;
    const desc = form.querySelector('[name="description"]').value.trim();
    const pincode = form.querySelector('[name="pincode"]').value.trim();
    const area = form.querySelector('[name="area"]').value.trim();
    const city = form.querySelector('[name="city"]').value.trim();
    const state = form.querySelector('[name="state"]').value.trim();
    const data = {
      name: n || undefined, category: cat || undefined,
      description: desc === '' ? null : desc,
      rent_per_hour: rh === '' ? null : rh, rent_per_km: rk === '' ? null : rk,
      rent_per_day: rd === '' ? null : rd, rent_per_month: rm === '' ? null : rm,
      security_deposit: sd === '' ? null : sd, subcategory: sub === '' ? null : sub,
      pincode: pincode === '' ? null : pincode, area: area === '' ? null : area,
      city: city === '' ? null : city, state: state === '' ? null : state,
    };
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
    const snap = originalProductSnapshot;
    const hasImageChange = Object.keys(slotFiles).length > 0;
    const hasFieldChange = n !== snap.name || desc !== snap.description || rd !== snap.rent_per_day ||
      rh !== snap.rent_per_hour || rk !== snap.rent_per_km || rm !== snap.rent_per_month ||
      sd !== snap.security_deposit || cat !== snap.category || sub !== snap.subcategory ||
      pincode !== snap.pincode || area !== snap.area || city !== snap.city || state !== snap.state;
    if (!hasFieldChange && !hasImageChange) { toastError('No changes detected.'); setButtonLoading(saveBtn, false); return; }
    setButtonLoading(saveBtn, true);
    const res = await apiRequest(`/auth/vendor/products/${editingId}`, 'PUT', data);
    for (let i = 1; i <= 5; i++) {
      if (slotFiles[i]) {
        const fd = new FormData();
        fd.append('image', await compressImage(slotFiles[i]));
        await fetch(`${API_BASE}/auth/vendor/products/${editingId}/image/${i}`, { method: 'PUT', body: fd, credentials: 'include' });
      }
    }
    setButtonLoading(saveBtn, false);
    if (res.success) { toastSuccess('Product updated!'); closeProductModal(); await loadProducts(); }
    else toastError(res.message || 'Update failed.');
  }
});

// ── Delete image slot ─────────────────────────────────────────
async function deleteImageSlot(productId, slot) {
  const confirmed = await showConfirm({ title: 'Delete image?', text: 'This image will be permanently removed.', confirmLabel: 'Delete', cancelLabel: 'Cancel' });
  if (!confirmed) return;
  const res = await apiRequest(`/auth/vendor/products/${productId}/image/${slot}`, 'DELETE');
  if (res.success) { toastSuccess('Image deleted.'); slotUrls[slot] = null; clearSlotImage(slot); }
  else toastError(res.message || 'Failed to delete image.');
}

// ── Delete product ────────────────────────────────────────────
async function confirmDelete(productId) {
  const p = allProducts.find(x => x.id === productId);
  const confirmed = await showConfirm({ title: 'Delete product?', text: `"${p?.name}" and all its images will be permanently deleted.`, confirmLabel: 'Delete', cancelLabel: 'Cancel' });
  if (!confirmed) return;
  const res = await apiRequest(`/auth/vendor/products/${productId}`, 'DELETE');
  if (res.success) { toastSuccess('Product deleted.'); await loadProducts(); }
  else toastError(res.message || 'Delete failed.');
}

// ── Hamburger ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
    document.getElementById('mobileMenu').classList.toggle('open');
  });
  document.getElementById('addProductBtn')?.addEventListener('click', openAddModal);
  initImageSlots();
  initModalPincodeAutofill();
  loadCategories();
  loadProducts();
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('productModalOverlay')?.classList.contains('open')) closeProductModal();
  if (document.getElementById('previewModalOverlay')?.classList.contains('open')) closePreviewModal();
  document.getElementById('shareModalOverlay')?.classList.remove('open');
  document.getElementById('upgradeModalOverlay')?.classList.remove('open');
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 860) document.getElementById('mobileMenu')?.classList.remove('open');
});
/* ── Helpers ─────────────────────────────────────────────── */
function isLoggedIn() {
  return !!(sessionStorage.getItem('olr_user') || sessionStorage.getItem('olr_vendor'));
}
function getSlug() {
  const parts = window.location.pathname.split('/');
  const pIdx = parts.indexOf('p');
  if (pIdx !== -1 && parts[pIdx + 1]) return parts[pIdx + 1];
  return new URLSearchParams(window.location.search).get('slug') || '';
}

/* ── Gallery ─────────────────────────────────────────────── */
let images = [];
let current = 0;

function showImage(idx) {
  if (!images.length) return;
  idx = Math.max(0, Math.min(images.length - 1, idx));
  current = idx;

  const main = document.getElementById('galleryMain');
  let img = main.querySelector('img');
  if (!img) {
    img = document.createElement('img');
    document.getElementById('galleryPlaceholder').style.display = 'none';
    main.insertBefore(img, main.firstChild);
  }
  img.src = images[idx];

  // Arrows
  document.getElementById('gPrev').classList.toggle('hidden', idx === 0);
  document.getElementById('gNext').classList.toggle('hidden', idx === images.length - 1);

  // Dots
  document.querySelectorAll('.g-dot').forEach((d, i) => d.classList.toggle('active', i === idx));

  // Thumbs
  document.querySelectorAll('.g-thumb').forEach((t, i) => t.classList.toggle('active', i === idx));
}

function buildGallery(imgs) {
  images = imgs;
  if (!imgs.length) return;

  // Dots
  const dotsEl = document.getElementById('galleryDots');
  if (imgs.length > 1) {
    dotsEl.innerHTML = imgs.map((_, i) =>
      `<div class="g-dot${i === 0 ? ' active' : ''}" onclick="showImage(${i})"></div>`
    ).join('');
  }

  // Thumbs (only if >1 image)
  const thumbsEl = document.getElementById('galleryThumbs');
  if (imgs.length > 1) {
    thumbsEl.innerHTML = imgs.map((url, i) => `
      <div class="g-thumb${i === 0 ? ' active' : ''}" onclick="showImage(${i})">
        <img src="${url}" alt="Photo ${i + 1}" loading="lazy">
      </div>`).join('');
  }

  document.getElementById('gPrev').addEventListener('click', () => showImage(current - 1));
  document.getElementById('gNext').addEventListener('click', () => showImage(current + 1));

  showImage(0);
}

/* ── CTA ─────────────────────────────────────────────────── */
function renderCTA(loggedIn) {
  const chatBtn = loggedIn
    ? `<button class="btn btn-primary" onclick="startChat()" style="width:100%;padding:13px;font-size:15px;">💬 Chat with vendor</button>`
    : `<div class="cta-locked">
        <div class="cta-locked-icon">🔒</div>
        <p>Log in to chat with the vendor about this product.</p>
        <div class="cta-locked-btns">
          <a href="#" onclick="goToLoginWithReturn('login');return false;" class="btn btn-primary">Log in</a>
        </div>
      </div>`;
  document.getElementById('ctaSection').innerHTML = chatBtn;

}

let currentProduct = null;
let currentVendor = null;
/* ── Wishlist (p.html) ───────────────────────────────────── */
let isWished = false;

function toggleProductWish() {
  if (!isLoggedIn()) { window.location.href = 'user/login.html'; return; }

  const isVendorAcct = !!sessionStorage.getItem('olr_vendor');
  if (isVendorAcct) {
    toastError("Vendors can't use wishlist. Log in with a user account.");
    return;
  }
  if (!currentProduct) return;
  doToggleWish();
}

function goToLoginWithReturn(page) {
  sessionStorage.setItem('olr_return_after_login', window.location.href);
  window.location.href = `user/${page}.html`;
}

async function doToggleWish() {
  const btn = document.getElementById('pWishBtn');
  const icon = document.getElementById('pWishIcon');
  if (isWished) {
    const res = await apiRequest(`/auth/user/wishlist/${currentProduct.id}`, 'DELETE');
    toastInfo(res.success ? 'Removed from wishlist.' : 'Removed from wishlist.');
    isWished = false;
    btn.classList.remove('active');
    icon.setAttribute('fill', 'none');
  } else {
    const res = await apiRequest('/auth/user/wishlist', 'POST', { product_id: currentProduct.id });
    toastSuccess(res.success ? 'Added to wishlist!' : 'Added to wishlist!');
    isWished = true;
    btn.classList.add('active');
    icon.setAttribute('fill', '#e53935');
  }
}

async function loadWishStatus() {
  if (!isLoggedIn() || sessionStorage.getItem('olr_vendor')) return;
  const res = await apiRequest('/auth/user/wishlist', 'GET');
  if (res.success && res.wishlist.some(w => w.product_id === currentProduct.id)) {
    isWished = true;
    document.getElementById('pWishBtn').classList.add('active');
    document.getElementById('pWishIcon').setAttribute('fill', '#e53935');
  }
}
async function startChat() {
  chatContext = 'product';
  if (!isLoggedIn()) { openLoginPopup(); return; }

  const isVendorAcct = !!sessionStorage.getItem('olr_vendor');
  if (isVendorAcct) {
    toastError("Vendors can't chat as a buyer. Log in with a user account.");
    return;
  }

  // Check profile complete before allowing chat
  const profileRes = await apiRequest('/auth/user/profile', 'GET');
  if (profileRes.success && !profileRes.user.profile_complete) {
    openProfileCompleteModal(() => startChat());
    return;
  }

  const account = getSessionAccount('user');
  if (!account || !currentProduct || !currentVendor) {
    toastError('Something went wrong. Please refresh and try again.');
    return;
  }

  toastInfo('Setting up chat…');

  const ok = await initChatAuth('user');
  if (!ok) return;

  const convId = await getOrCreateConversation({
    userId: account.id,
    vendorId: currentVendor.id,
    productId: currentProduct.id,
    userName: account.name,
    userPhoto: account.profile_photo || null,
    vendorName: currentVendor.name,
    vendorPhoto: currentVendor.profile_photo || null,
    productName: currentProduct.name,
  });

  if (window.innerWidth >= 768) {
    window.location.href = `user/dashboard.html#chat=${convId}`;
    return;
  }
  openChatOverlay();
  openThread(convId);
}

function openLoginPopup(intent) {
  const title = document.getElementById('loginPopupTitle');
  const text = document.getElementById('loginPopupText');
  if (intent === 'wishlist') {
    title.textContent = 'Login to save to wishlist';
    text.textContent = 'Create a free account or log in to save this product and find it later.';
  } else {
    title.textContent = 'Login to chat with vendor';
    text.textContent = 'Create a free account or log in to contact this vendor and enquire about the product.';
  }
  document.getElementById('loginOverlay').classList.add('open');
}
function closeLoginPopup() { document.getElementById('loginOverlay').classList.remove('open'); }
document.getElementById('loginOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeLoginPopup();
});

/* ── Share ───────────────────────────────────────────────── */
function shareProduct() {
  const slug = getSlug();
  const url = `${window.location.origin}/products/share/${slug}`;
  const title = document.getElementById('infoName').textContent || 'Check this on OLR India';
  if (navigator.share) {
    navigator.share({ title, text: title, url }).catch(() => { });
    return;
  }
  navigator.clipboard.writeText(url).then(() => toastSuccess('Link copied!')).catch(() => {
    const inp = document.createElement('input');
    inp.value = url; document.body.appendChild(inp);
    inp.select(); document.execCommand('copy');
    document.body.removeChild(inp);
    toastSuccess('Link copied!');
  });
}

/* ── Load product ────────────────────────────────────────── */
async function loadProduct() {
  const slug = getSlug();
  if (!slug) { showError('Invalid product link.'); return; }
  try {
    isAdminView = await checkAdminView();

    const res = isAdminView
      ? await apiRequest(`/auth/admin/products/slug/${slug}`, 'GET')
      : await apiRequest(`/products/public/${slug}`, 'GET');

    if (!res.success) { showError(res.message || 'Product not found.'); return; }
    const p = res.product;
    const v = res.vendor;
    currentProduct = p;
    currentVendor = v;
    document.title = `${p.name} – OLR India`;
    buildGallery(p.images || []);

    document.getElementById('infoCat').textContent =
      p.category + (p.subcategory ? ' · ' + p.subcategory : '');
    document.getElementById('infoName').textContent = p.name;

    if (p.description) {
      document.getElementById('infoDesc').textContent = p.description;
    } else {
      document.getElementById('infoDescSection').style.display = 'none';
    }

    // Pricing
    let ph = '';
    if (p.rent_per_hour) ph += priceRow('Per hour', `₹${p.rent_per_hour}`);
    if (p.rent_per_km) ph += priceRow('Per km', `₹${p.rent_per_km}`);
    if (p.rent_per_day) ph += priceRow('Per day', `₹${p.rent_per_day}`);
    if (p.rent_per_month) ph += priceRow('Per month', `₹${p.rent_per_month}`);
    if (p.security_deposit) ph += priceRow('Security deposit', `₹${p.security_deposit}`, true);
    document.getElementById('priceRows').innerHTML = ph;

    document.getElementById('infoLocation').textContent =
      [p.area, p.city, p.state, p.pincode].filter(Boolean).join(', ');

    // Vendor
    const av = document.getElementById('vendorAvatar');
    if (v.profile_photo) {
      av.innerHTML = `<img src="${v.profile_photo}" alt="${v.name}">`;
    } else {
      av.textContent = getInitials(v.name);
    }
    const vendorBadgeHtml = v.badge === 'featured'
      ? `<span style="display:inline-flex;align-items:center;gap:3px;background:#FFF8E1;color:#F59E0B;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;margin-left:6px;">★ Top Vendor</span>`
      : v.badge === 'verified'
        ? `<span style="display:inline-flex;align-items:center;gap:3px;background:#e6f4ea;color:#1a7f37;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;margin-left:6px;">✓ Verified</span>`
        : '';
    document.getElementById('vendorName').innerHTML = (v.name) + vendorBadgeHtml;
    document.getElementById('vendorSub').textContent = v.city ? `Based in ${v.city}` : 'OLR India Vendor';
    function getInitials(name) {
      if (!name) return 'V';
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    document.getElementById('infoViews').textContent =
      (p.click_count || 0) > 0
        ? `${p.click_count} ${p.click_count === 1 ? 'person has' : 'people have'} viewed this listing`
        : 'Be the first to view this listing';
    if (isAdminView && res.admin_meta) {
      renderAdminDetails(res.admin_meta);
    }
    if (isAdminView) {
      renderAdminCTA();
      hideAdminChrome();
    } else {
      const loggedIn = isLoggedIn();
      renderCTA(loggedIn);
      loadWishStatus();
    }
    apiRequest(`/auth/vendor/products/${p.id}/click`, 'POST').catch(() => { });

    document.getElementById('pageLoader').style.display = 'none';
    document.getElementById('pageContent').style.display = 'block';
  } catch (err) {
    showError('Failed to load product. Please try again.');
  }
}

function priceRow(label, val, isDeposit = false) {
  return `<div class="price-row">
    <span class="price-row-label">${label}</span>
    <span class="price-row-val${isDeposit ? ' deposit' : ''}">${val}</span>
  </div>`;
}

function showError(msg) {
  document.getElementById('pageLoader').innerHTML = `
    <div style="font-size:40px;margin-bottom:12px;">😕</div>
    <h3 style="color:var(--c-ink);margin-bottom:6px;">Something went wrong</h3>
    <p>${msg}</p>
    <a href="index.html" style="margin-top:16px;display:inline-flex;padding:10px 22px;
      background:var(--grad-brand);color:#fff;border-radius:var(--r-md);
      font-weight:600;text-decoration:none;font-family:var(--font-display);">
      Back to home
    </a>`;
}

function openProfileCompleteModal(onSuccess) {
  // Remove any existing modal first
  document.getElementById('profileCompleteModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'profileCompleteModal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.5);
    z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;
  `;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px 24px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <div style="font-size:32px;text-align:center;margin-bottom:12px;">👤</div>
      <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;text-align:center;font-family:'Poppins',sans-serif;">Complete your profile</h3>
      <p style="margin:0 0 20px;font-size:13.5px;color:#6b7280;text-align:center;line-height:1.5;">
        Add your mobile and city so vendors can reach you back.
      </p>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
        <input id="pcMobile" type="tel" maxlength="10" placeholder="Mobile number (10 digits)"
          style="padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;font-family:'Inter',sans-serif;">
        <input id="pcPincode" type="text" maxlength="6" placeholder="Pincode (optional - auto fills city)"
          style="padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;font-family:'Inter',sans-serif;">
        <input id="pcCity" type="text" placeholder="City"
          style="padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;font-family:'Inter',sans-serif;">
      </div>
      <button id="pcSaveBtn" style="width:100%;padding:13px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;font-family:'Poppins',sans-serif;margin-bottom:10px;">
        Save &amp; continue to chat
      </button>
      <button onclick="document.getElementById('profileCompleteModal').remove()"
        style="width:100%;padding:10px;background:none;border:none;color:#9ca3af;font-size:13px;cursor:pointer;">
        Maybe later
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  // Pincode autofill
  document.getElementById('pcPincode').addEventListener('input', async function () {
    if (this.value.length !== 6) return;
    try {
      const r = await fetch(`https://api.postalpincode.in/pincode/${this.value}`);
      const d = await r.json();
      if (d[0].Status === 'Success') {
        const po = d[0].PostOffice[0];
        document.getElementById('pcCity').value = po.District || po.Block || '';
      }
    } catch { }
  });

  document.getElementById('pcSaveBtn').addEventListener('click', async () => {
    const mobile = document.getElementById('pcMobile').value.trim();
    const city = document.getElementById('pcCity').value.trim();
    const pincode = document.getElementById('pcPincode').value.trim();

    if (!mobile || !city) {
      toastError('Please fill in mobile and city.');
      return;
    }
    if (mobile.length !== 10) {
      toastError('Mobile must be 10 digits.');
      return;
    }

    const res = await apiRequest('/auth/user/profile', 'PUT', { mobile, city, pincode });
    if (res.success) {
      document.getElementById('profileCompleteModal').remove();
      toastSuccess('Profile saved!');
      if (onSuccess) onSuccess();
    } else {
      toastError(res.message || 'Failed to save. Please try again.');
    }
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function hideAdminChrome() {
  // No login/signup buttons for an admin viewer
  document.getElementById('navRight').innerHTML =
    `<span class="p-nav-btn p-nav-btn-outline" style="cursor:default;">Admin view</span>`;

  // No wishlist button either - admin isn't a buyer
  const wishBtn = document.getElementById('pWishBtn');
  if (wishBtn) wishBtn.style.display = 'none';
}

/* ── Back navigation ─────────────────────────────────────── */
function goBack() {
  if (isAdminView) {
    window.location.href = 'admin/dashboard.html#products';
    return;
  }
  const cameFromSameSite = document.referrer && document.referrer.startsWith(window.location.origin);
  if (cameFromSameSite && history.length > 1) {
    history.back();
  } else {
    window.location.href = 'index.html';
  }
}

window.addEventListener('pageshow', (event) => {
  if (event.persisted && currentProduct) {
    loadWishStatus();
  }
});

/* ============================================================
   ADD TO p.js
   Detects ?admin=1 in URL, verifies real admin session via
   /auth/admin/profile, and if valid shows a Remove button
   instead of the normal chat/login CTA.
   ============================================================ */

let isAdminView = false;

async function checkAdminView() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') !== '1') return false;

  // Verify this is really a logged-in admin, not just a guessed URL param.
  // /auth/admin/profile only succeeds if the admin's httponly cookie is
  // valid (cookie path already scoped to /auth/admin/ so this works
  // regardless of which page the request is made from).
  const res = await apiRequest('/auth/admin/profile', 'GET');
  return !!res.success;
}

function renderAdminCTA() {
  document.getElementById('ctaSection').innerHTML = `
    <button class="btn btn-primary" id="adminRemoveBtn" style="width:100%;padding:13px;font-size:15px;background:var(--c-error);">
      Remove this listing
    </button>
  `;
  document.getElementById('adminRemoveBtn').addEventListener('click', openAdminRemoveModal);
}

function openAdminRemoveModal() {
  document.getElementById('adminRemoveReasonInput').value = '';
  document.getElementById('adminRemoveModal').classList.add('is-open');
}
function closeAdminRemoveModal() {
  document.getElementById('adminRemoveModal').classList.remove('is-open');
}
/* ============================================================
   ADD TO p.js - new function, plus one small change to loadProduct().
   ============================================================ */

function renderAdminDetails(adminMeta) {
  document.getElementById('adminDetailsSection').style.display = 'block';

  document.getElementById('adminStatusBadge').innerHTML = adminMeta.active
    ? `<span class="admin-badge admin-badge-live">Live</span>`
    : `<span class="admin-badge admin-badge-inactive">Inactive</span>`;

  document.getElementById('adminReviewedBadge').innerHTML = adminMeta.reviewed
    ? `<span class="admin-badge admin-badge-live">Viewed</span>`
    : `<span class="admin-badge admin-badge-flag">Unviewed</span>`;

  document.getElementById('adminClicksValue').textContent = adminMeta.clicks;
  document.getElementById('adminCreatedValue').textContent = adminMeta.created_at;

  document.getElementById('adminVendorPlanValue').textContent =
    adminMeta.vendor_plan.charAt(0).toUpperCase() + adminMeta.vendor_plan.slice(1);

  document.getElementById('adminVendorStatusBadge').innerHTML = adminMeta.vendor_active
    ? `<span class="admin-badge admin-badge-live">Active</span>`
    : `<span class="admin-badge admin-badge-suspended">Suspended</span>`;

  document.getElementById('adminVendorStrikesValue').textContent =
    adminMeta.vendor_strike_count > 0 ? `${adminMeta.vendor_strike_count} / 3` : 'None';

  document.getElementById('adminVendorEmailValue').textContent = adminMeta.vendor_email;
  document.getElementById('adminVendorMobileValue').textContent = adminMeta.vendor_mobile;
}


/* ============================================================
   IN loadProduct(), right after this existing line:

      const res = isAdminView
        ? await apiRequest(`/auth/admin/products/slug/${slug}`, 'GET')
        : await apiRequest(`/products/public/${slug}`, 'GET');

      if(!res.success){showError(res.message||'Product not found.');return;}

   ADD (still inside the same function, after the success check,
   anywhere before the closing of loadProduct - a good spot is
   right where you already call renderAdminCTA()):
   ============================================================ */

if (isAdminView && res.admin_meta) {
  renderAdminDetails(res.admin_meta);
}
document.getElementById('adminRemoveCancel')?.addEventListener('click', closeAdminRemoveModal);

document.getElementById('adminRemoveConfirm')?.addEventListener('click', async () => {
  const reason = document.getElementById('adminRemoveReasonInput').value.trim();
  if (!reason) {
    toastError('Please explain why this listing is being removed.');
    return;
  }
  if (!currentProduct) return;

  const res = await apiRequest(`/auth/admin/products/${currentProduct.id}/remove`, 'POST', { reason });
  closeAdminRemoveModal();

  if (res.success) {
    toastSuccess(
      res.auto_suspended
        ? 'Product removed. Vendor reached 3 strikes and was auto-suspended.'
        : `Product removed. Vendor now has ${res.strike_count} strike(s).`
    );
    setTimeout(() => {
      window.location.href = 'admin/dashboard.html#products';
    }, 1600);
  } else {
    toastError(res.message || 'Failed to remove product.');
  }
});

/* ── Swipe ───────────────────────────────────────────────── */
let touchStartX = 0;
document.getElementById('galleryMain').addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });
document.getElementById('galleryMain').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 40) dx < 0 ? showImage(current + 1) : showImage(current - 1);
}, { passive: true });

/* ── Keyboard ────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') showImage(current - 1);
  if (e.key === 'ArrowRight') showImage(current + 1);
  if (e.key === 'Escape') closeLoginPopup();
});

loadProduct();
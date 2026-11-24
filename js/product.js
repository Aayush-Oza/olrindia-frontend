/* ── Helpers ─────────────────────────────────────────────── */
function isLoggedIn() {
  return !!(sessionStorage.getItem('olr_user') || sessionStorage.getItem('olr_vendor'));
}
function getSlug() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'product' && parts.length === 4) return parts[3];
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

  document.getElementById('gPrev').classList.toggle('hidden', idx === 0);
  document.getElementById('gNext').classList.toggle('hidden', idx === images.length - 1);

  document.querySelectorAll('.g-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
  document.querySelectorAll('.g-thumb').forEach((t, i) => t.classList.toggle('active', i === idx));
}

function buildGallery(imgs) {
  images = imgs;
  if (!imgs.length) return;

  const dotsEl = document.getElementById('galleryDots');
  if (imgs.length > 1) {
    dotsEl.innerHTML = imgs.map((_, i) =>
      `<div class="g-dot${i === 0 ? ' active' : ''}" onclick="showImage(${i})"></div>`
    ).join('');
  }

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
let isWished = false;

function toggleProductWish() {
  if (!isLoggedIn()) { window.location.href = '/user/login'; return; }
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
  window.location.href = `/user/${page}`;
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
    window.location.href = `/user/chat?conv=${convId}`;
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
  const url = `${window.location.origin}/product/${slugify(currentProduct?.category || '')}/${slugify(currentProduct?.city || 'india')}/${slug}`;
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

/* ── Render listing type chip ────────────────────────────── */
function renderListingChip(listingType) {
  const isRent = listingType !== 'sell';
  const chip = document.getElementById('listingTypeChip');
  if (!chip) return;
  chip.style.cssText = '';
  chip.innerHTML = isRent
    ? `<span style="
        display:inline-flex;align-items:center;
        background:#EAF3FF;color:#1d4ed8;
        border:1.5px solid #bfdbfe;
        font-size:12.5px;font-weight:700;
        padding:5px 14px;border-radius:999px;
        font-family:var(--font-display);letter-spacing:.03em;
        text-transform:uppercase;
      ">For Rent</span>`
    : `<span style="
        display:inline-flex;align-items:center;
        background:#f0fdf4;color:#15803d;
        border:1.5px solid #bbf7d0;
        font-size:12.5px;font-weight:700;
        padding:5px 14px;border-radius:999px;
        font-family:var(--font-display);letter-spacing:.03em;
        text-transform:uppercase;
      ">For Sale</span>`;
}

/* ── Render pricing rows ─────────────────────────────────── */
function renderPricing(p) {
  let ph = '';
  if (p.listing_type === 'sell') {
    if (p.selling_price) ph += priceRow('Selling price', `₹${p.selling_price}`);
    if (p.condition)     ph += priceRow('Condition', p.condition);
  } else {
    if (p.rent_per_hour)    ph += priceRow('Per hour',         `₹${p.rent_per_hour}`);
    if (p.rent_per_km)      ph += priceRow('Per km',           `₹${p.rent_per_km}`);
    if (p.rent_per_day)     ph += priceRow('Per day',          `₹${p.rent_per_day}`);
    if (p.rent_per_month)   ph += priceRow('Per month',        `₹${p.rent_per_month}`);
    if (p.security_deposit) ph += priceRow('Security deposit', `₹${p.security_deposit}`, true);
  }
  document.getElementById('priceRows').innerHTML = ph;
}

/* ── Render vendor store button ──────────────────────────── */
function renderVendorStoreBtn(vendorId, vendorName, storeSlug) {
  const el = document.getElementById('vendorStoreBtn');
  if (!el) return;
  if (!storeSlug) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <a
      href="/vendor/${storeSlug}"
      style="
        display:inline-flex;align-items:center;gap:7px;
        margin-top:10px;
        padding:9px 18px;
        border-radius:999px;
        border:1.5px solid var(--c-border);
        background:transparent;
        font-size:13px;font-weight:600;
        font-family:var(--font-display);
        color:var(--c-ink-soft);
        cursor:pointer;
        text-decoration:none;
        transition:all .15s ease;
      "
      onmouseover="this.style.borderColor='var(--c-blue)';this.style.color='var(--c-blue)';"
      onmouseout="this.style.borderColor='var(--c-border)';this.style.color='var(--c-ink-soft)';"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
      Visit ${vendorName ? vendorName.split(' ')[0] : 'Vendor'}'s Store
    </a>
  `;
}

/* ── Related products ────────────────────────────────────── */
async function loadRelatedProducts(category, listingType, excludeId) {
  const section = document.getElementById('relatedProductsSection');
  if (!section) return;

  try {
    const res = await apiRequest(
      `/products/public?category=${encodeURIComponent(category)}&listing_type=${listingType}&per_page=5`,
      'GET'
    );
    if (!res.success || !res.products || !res.products.length) {
      section.style.display = 'none';
      return;
    }

    const related = res.products.filter(p => p.id !== excludeId).slice(0, 4);
    if (!related.length) {
      section.style.display = 'none';
      return;
    }

    const typeLabel = listingType === 'sell' ? 'For Sale' : 'For Rent';
    section.innerHTML = `
      <div style="max-width:1180px;margin:0 auto;padding:32px 20px 48px;">
        <h2 style="font-size:17px;font-weight:700;color:var(--c-ink);font-family:var(--font-display);margin:0 0 16px;">
          Related ${typeLabel} Listings
        </h2>
        <div class="product-grid" id="relatedGrid">
          ${related.map(p => buildRelatedCard(p, listingType)).join('')}
        </div>
      </div>
    `;
  } catch (e) {
    section.style.display = 'none';
  }
}

function buildRelatedCard(p, listingType) {
  const imgHtml = (p.images && p.images[0])
    ? `<img class="product-img" src="${p.images[0]}" alt="${p.name}" loading="lazy">`
    : `<div class="product-img-placeholder">📦</div>`;

  const badgeHtml = p.vendor_badge === 'featured'
    ? `<span class="vendor-badge badge-premium">★ Top Vendor</span>`
    : p.vendor_badge === 'verified'
      ? `<span class="vendor-badge badge-growth">✓ Verified</span>`
      : '';

  let priceHtml = '';
  if (listingType === 'sell') {
    priceHtml = p.selling_price
      ? `<div class="product-price">₹${p.selling_price}</div>`
      : '';
  } else {
    const rentVal = p.rent_per_day || p.rent_per_hour || p.rent_per_month || p.rent_per_km;
    const rentLabel = p.rent_per_day ? '/day'
      : p.rent_per_hour ? '/hr'
      : p.rent_per_month ? '/mo'
      : p.rent_per_km ? '/km' : '';
    priceHtml = rentVal
      ? `<div class="product-price">₹${rentVal}<span>${rentLabel}</span></div>`
      : '';
  }

  const locHtml = (p.city || p.vendor_city)
    ? `<div class="product-loc">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z" stroke="currentColor" stroke-width="1.8"/>
          <circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="1.8"/>
        </svg>
        ${p.city || p.vendor_city}
      </div>`
    : '';

  const url = `/product/${slugify(p.category)}/${slugify(p.city || 'india')}/${p.share_slug}`;

  return `
    <div class="product-card" onclick="window.location.href='${url}'">
      <div style="position:relative;">
        ${imgHtml}
        ${badgeHtml}
      </div>
      <div class="product-body">
        <div class="product-cat">${p.category || ''}</div>
        <div class="product-title">${p.name}</div>
        <div class="product-bottom">
          ${priceHtml}
          ${locHtml}
        </div>
      </div>
    </div>
  `;
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

    const listingType = p.listing_type || 'rent';

    // ── Dynamic SEO ──
    const productUrl = `https://olrindia.com/product/${slugify(p.category)}/${slugify(p.city || 'india')}/${p.share_slug}`;
    const cityText = p.city || 'India';
    const categoryText = p.category || 'Product';
    const typeWord = listingType === 'sell' ? 'Sale' : 'Rent';
    const productTitle = `${p.name} for ${typeWord} in ${cityText} – OLR India`;
    const productDesc = p.description
      ? `${p.description.slice(0, 130)}… ${listingType === 'sell' ? 'Buy' : 'Rent'} ${p.name} in ${cityText} from a trusted local vendor on OLR India. No middleman.`
      : `${listingType === 'sell' ? 'Buy' : 'Rent'} ${p.name} in ${cityText} from a trusted local vendor on OLR India. ${categoryText} available - no middleman, direct chat.`;
    const productImg = (p.images && p.images[0]) ? p.images[0] : 'https://olrindia.com/assets/og-banner.jpg';
    const productKeywords = `${p.name} ${listingType === 'sell' ? 'for sale' : 'on rent'}, ${p.name} in ${cityText}, ${categoryText} ${cityText}, OLR India`;

    document.title = productTitle;
    document.getElementById('metaDesc').setAttribute('content', productDesc);
    document.getElementById('metaKeywords').setAttribute('content', productKeywords);
    document.getElementById('metaCanonical').setAttribute('href', productUrl);
    document.getElementById('ogTitle').setAttribute('content', productTitle);
    document.getElementById('ogDesc').setAttribute('content', productDesc);
    document.getElementById('ogImage').setAttribute('content', productImg);
    document.getElementById('ogImageAlt').setAttribute('content', `${p.name} for ${typeWord} in ${cityText} – OLR India`);
    document.getElementById('ogUrl').setAttribute('content', productUrl);
    document.getElementById('twTitle').setAttribute('content', productTitle);
    document.getElementById('twDesc').setAttribute('content', productDesc);
    document.getElementById('twImage').setAttribute('content', productImg);
    document.getElementById('twImageAlt').setAttribute('content', `${p.name} for ${typeWord} – OLR India`);

    // ── Schema ──
    const schemaOffers = listingType === 'sell'
      ? {
          "@type": "Offer",
          "priceCurrency": "INR",
          "price": p.selling_price || 0,
          "availability": "https://schema.org/InStock",
          "itemCondition": p.condition === 'New'
            ? "https://schema.org/NewCondition"
            : "https://schema.org/UsedCondition",
          "areaServed": { "@type": "City", "name": cityText },
          "seller": {
            "@type": "Organization",
            "name": p.vendor_name || "OLR India Vendor",
            "member": { "@id": "https://olrindia.com/#organization" }
          }
        }
      : {
          "@type": "Offer",
          "priceCurrency": "INR",
          "price": p.rent_per_day || p.rent_per_hour || p.rent_per_month || 0,
          "priceSpecification": [
            p.rent_per_hour  && { "@type": "UnitPriceSpecification", "price": p.rent_per_hour,  "priceCurrency": "INR", "unitText": "per hour" },
            p.rent_per_day   && { "@type": "UnitPriceSpecification", "price": p.rent_per_day,   "priceCurrency": "INR", "unitText": "per day" },
            p.rent_per_month && { "@type": "UnitPriceSpecification", "price": p.rent_per_month, "priceCurrency": "INR", "unitText": "per month" }
          ].filter(Boolean),
          "availability": "https://schema.org/InStock",
          "areaServed": { "@type": "City", "name": cityText },
          "seller": {
            "@type": "Organization",
            "name": p.vendor_name || "OLR India Vendor",
            "member": { "@id": "https://olrindia.com/#organization" }
          }
        };

    document.getElementById('productSchema').textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": p.name,
      "description": p.description || `${p.name} available for ${listingType === 'sell' ? 'sale' : 'rent'} in ${cityText} on OLR India`,
      "image": p.images || [],
      "url": productUrl,
      "category": p.category || "Product",
      "brand": { "@type": "Brand", "name": "OLR India" },
      "offers": schemaOffers
    });

    // ── Gallery ──
    buildGallery(p.images || []);

    // ── Listing type chip (below gallery) ──
    renderListingChip(listingType);

    // ── Info ──
    document.getElementById('infoCat').textContent =
      p.category + (p.subcategory ? ' · ' + p.subcategory : '');
    document.getElementById('infoName').textContent = p.name;

    if (p.description) {
      document.getElementById('infoDesc').textContent = p.description;
    } else {
      document.getElementById('infoDescSection').style.display = 'none';
    }

    // ── Pricing (rent or sell) ──
    renderPricing(p);

    // ── Location ──
    document.getElementById('infoLocation').textContent =
      [p.area, p.city, p.state, p.pincode].filter(Boolean).join(', ');

    // ── Vendor ──
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

    // ── Vendor store button ──
    renderVendorStoreBtn(v.id, v.name, v.store_slug);

    // ── Views ──
    document.getElementById('infoViews').textContent =
      (p.click_count || 0) > 0
        ? `${p.click_count} ${p.click_count === 1 ? 'person has' : 'people have'} viewed this listing`
        : 'Be the first to view this listing';

    // ── Admin details ──
    if (isAdminView && res.admin_meta) {
      renderAdminDetails(res.admin_meta);
    }

    // ── CTA ──
    if (isAdminView) {
      renderAdminCTA();
      hideAdminChrome();
    } else if (sessionStorage.getItem('olr_vendor')) {
      hideVendorChrome();
    } else {
      renderCTA(isLoggedIn());
      loadWishStatus();
    }

    apiRequest(`/auth/vendor/products/${p.id}/click`, 'POST').catch(() => { });

    document.getElementById('pageLoader').style.display = 'none';
    document.getElementById('pageContent').style.display = 'block';

    // ── Related products (after content shown) ──
    if (!isAdminView) {
      loadRelatedProducts(p.category, listingType, p.id);
    }

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
    <a href="/" style="margin-top:16px;display:inline-flex;padding:10px 22px;
      background:var(--grad-brand);color:#fff;border-radius:var(--r-md);
      font-weight:600;text-decoration:none;font-family:var(--font-display);">
      Back to home
    </a>`;
}

function openProfileCompleteModal(onSuccess) {
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

    if (!mobile || !city) { toastError('Please fill in mobile and city.'); return; }
    if (mobile.length !== 10) { toastError('Mobile must be 10 digits.'); return; }

    const res = await apiRequest('/auth/user/profile', 'PUT', { mobile, city, pincode });
    if (res.success) {
      document.getElementById('profileCompleteModal').remove();
      toastSuccess('Profile saved!');
      if (onSuccess) onSuccess();
    } else {
      toastError(res.message || 'Failed to save. Please try again.');
    }
  });

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function hideAdminChrome() {
  const wishBtn = document.getElementById('pWishBtn');
  if (wishBtn) wishBtn.style.display = 'none';
}

function hideVendorChrome() {
  const wishBtn = document.getElementById('pWishBtn');
  if (wishBtn) wishBtn.style.display = 'none';
  document.getElementById('ctaSection').innerHTML = `
    <div class="cta-locked">
      <div class="cta-locked-icon">🏪</div>
      <p>You're viewing this as a vendor account. Log in with a user account to chat or save this listing.</p>
    </div>`;
}

window.addEventListener('pageshow', (event) => {
  if (event.persisted && currentProduct) loadWishStatus();
});

/* ── Admin ───────────────────────────────────────────────── */
let isAdminView = false;

async function checkAdminView() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') !== '1') return false;
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

document.getElementById('adminRemoveCancel')?.addEventListener('click', closeAdminRemoveModal);

document.getElementById('adminRemoveConfirm')?.addEventListener('click', async () => {
  const reason = document.getElementById('adminRemoveReasonInput').value.trim();
  if (!reason) { toastError('Please explain why this listing is being removed.'); return; }
  if (!currentProduct) return;

  const res = await apiRequest(`/auth/admin/products/${currentProduct.id}/remove`, 'POST', { reason });
  closeAdminRemoveModal();

  if (res.success) {
    toastSuccess(
      res.auto_suspended
        ? 'Product removed. Vendor reached 3 strikes and was auto-suspended.'
        : `Product removed. Vendor now has ${res.strike_count} strike(s).`
    );
    setTimeout(() => { window.location.href = '/admin/products'; }, 1600);
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
/* ── Helpers ─────────────────────────────────────────────── */
function getStoreSlug() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'vendor' && parts[1]) return parts[1];
  return '';
}

/* ── State ───────────────────────────────────────────────── */
let currentVendor = null;
let currentType   = 'all';
let currentPage   = 1;
let hasMore       = false;
let isLoading     = false;
let isAdminView   = false;

/* ── Admin check (same pattern as product.js) ────────────── */
async function checkAdminView() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') !== '1') return false;
  const res = await apiRequest('/auth/admin/profile', 'GET');
  return !!res.success;
}

/* ── Tab switching ───────────────────────────────────────── */
function switchTab(type) {
  currentType = type;
  currentPage = 1;
  hasMore     = false;

  document.querySelectorAll('.listing-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.type === type);
  });

  document.getElementById('vsGrid').innerHTML = '';
  document.getElementById('vsLoadMore').style.display = 'none';
  document.getElementById('vsListingsCount').textContent = '';
  fetchListings(true);
}

/* ── Load more ───────────────────────────────────────────── */
function loadMore() {
  if (isLoading || !hasMore) return;
  currentPage++;
  fetchListings(false);
}

/* ── Fetch listings ──────────────────────────────────────── */
async function fetchListings(reset = false) {
  if (isLoading) return;
  isLoading = true;

  const slug = getStoreSlug();

  try {
    const res = await apiRequest(
      `/products/vendor/${slug}?page=${currentPage}&per_page=20${currentType !== 'all' ? '&listing_type=' + currentType : ''}`,
      'GET'
    );

    if (!res.success) {
      showError(res.message || 'Failed to load listings.');
      return;
    }

    hasMore = res.has_more;
    const grid = document.getElementById('vsGrid');

    if (reset) grid.innerHTML = '';

    if (!res.products.length && reset) {
      grid.innerHTML = `
        <div class="vs-empty" style="grid-column:1/-1;">
          <div class="vs-empty-icon">📦</div>
          <h3>No listings here yet</h3>
          <p>${currentType === 'all' ? 'This vendor has no active listings.' : `No ${currentType === 'rent' ? 'rental' : 'sale'} listings right now.`}</p>
        </div>`;
      document.getElementById('vsListingsCount').textContent = '';
    } else {
      res.products.forEach(p => {
        grid.insertAdjacentHTML('beforeend', buildCard(p));
      });
      document.getElementById('vsListingsCount').textContent =
        `${res.total} ${res.total === 1 ? 'listing' : 'listings'}`;
    }

    document.getElementById('vsLoadMore').style.display = hasMore ? 'flex' : 'none';

  } catch (e) {
    showError('Failed to load listings. Please try again.');
  } finally {
    isLoading = false;
  }
}

/* ── Build product card ──────────────────────────────────── */
function buildCard(p) {
  const img = p.images && p.images[0]
    ? `<img class="product-img" src="${p.images[0]}" alt="${p.name}" loading="lazy">`
    : `<div class="product-img-placeholder"></div>`;

  const badge = p.vendor_badge === 'featured'
    ? `<span class="vendor-badge badge-premium">★ Top Vendor</span>`
    : p.vendor_badge === 'verified'
      ? `<span class="vendor-badge badge-growth">✓ Verified</span>`
      : '';

  const rentVal   = p.rent_per_day || p.rent_per_hour || p.rent_per_month || p.rent_per_km;
  const rentLabel = p.rent_per_day ? '/day'
    : p.rent_per_hour ? '/hr'
    : p.rent_per_month ? '/mo'
    : p.rent_per_km ? '/km' : '';

  const price = p.listing_type === 'sell'
    ? (p.selling_price ? `₹${p.selling_price}` : `<span style="color:var(--c-ink-faint);font-size:12px;">Price not set</span>`)
    : (rentVal ? `₹${rentVal} <span>${rentLabel}</span>` : `<span style="color:var(--c-ink-faint);font-size:12px;">Price not available</span>`);

  const url = `/product/${slugify(p.category || '')}/${slugify(p.city || 'india')}/${p.share_slug}${isAdminView ? '?admin=1' : ''}`;

  return `
    <div class="product-card" onclick="window.location.href='${url}'">
      <div style="position:relative;">
        ${img}${badge}
      </div>
      <div class="product-body">
        <div class="product-cat">${p.category || ''}</div>
        <div class="product-title">${p.name}</div>
        <div class="product-bottom">
          <div class="product-price">${price}</div>
          <div class="product-loc">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z" stroke="currentColor" stroke-width="2"/>
            </svg>
            ${p.city || ''}
          </div>
        </div>
        <div class="listing-type-chip ${p.listing_type === 'sell' ? 'chip-sell' : 'chip-rent'}">
          ${p.listing_type === 'sell' ? 'FOR SALE' : 'FOR RENT'}
        </div>
      </div>
    </div>`;
}

/* ── Render vendor hero ──────────────────────────────────── */
function renderVendorHero(v) {
  const av = document.getElementById('vsAvatar');
  if (v.profile_photo) {
    av.innerHTML = `<img src="${v.profile_photo}" alt="${v.name}">`;
  } else {
    av.textContent = getInitials(v.name);
  }

  document.getElementById('vsVendorName').textContent = v.name || 'OLR India Vendor';

  const badgeHtml = v.badge === 'featured'
    ? `<span style="display:inline-flex;align-items:center;gap:3px;background:#FFF8E1;color:#F59E0B;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">★ Top Vendor</span>`
    : v.badge === 'verified'
      ? `<span style="display:inline-flex;align-items:center;gap:3px;background:#e6f4ea;color:#1a7f37;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">✓ Verified</span>`
      : '';

  const locationText = [v.city, v.state].filter(Boolean).join(', ');
  document.getElementById('vsVendorMeta').innerHTML = `
    ${locationText ? `<span class="vs-meta-item">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z" stroke="currentColor" stroke-width="1.8"/>
        <circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="1.8"/>
      </svg>
      ${locationText}
    </span>` : ''}
    ${v.member_since ? `<span class="vs-meta-item">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/>
        <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      Member since ${v.member_since}
    </span>` : ''}
    ${badgeHtml}
  `;

  document.getElementById('vsStats').innerHTML = `
    <div class="vs-stat">
      <div class="vs-stat-val">${v.total_listings || 0}</div>
      <div class="vs-stat-label">Active Listings</div>
    </div>
  `;
}

/* ── Admin: render vendor info card ──────────────────────── */
function renderAdminVendorInfo(v) {
  const verified = v.is_verified
    ? `<span class="admin-badge admin-badge-live">Verified</span>`
    : `<span class="admin-badge admin-badge-inactive">Unverified</span>`;

  const status = v.is_active
    ? `<span class="admin-badge admin-badge-live">Active</span>`
    : `<span class="admin-badge admin-badge-suspended">Suspended</span>`;

  const strikeBadge = v.strike_count > 0
    ? `<span class="admin-badge admin-badge-flag">${v.strike_count} Strike${v.strike_count > 1 ? 's' : ''}</span>`
    : '-';

  const planBadge = v.badge
    ? `<span class="admin-badge admin-badge-live">${v.badge}</span>`
    : '-';

  const subActive = v.is_subscription_active
    ? `<span class="admin-badge admin-badge-live">Paid Active</span>`
    : v.is_trial_active
      ? `<span class="admin-badge admin-badge-flag">Trial Active</span>`
      : `<span class="admin-badge admin-badge-inactive">Expired</span>`;

  document.getElementById('adminVendorInfoCard').innerHTML = `
    <div class="admin-vendor-fields">
      <div><label>Email</label><span>${v.email}</span></div>
      <div><label>Mobile</label><span>${v.mobile}</span></div>
      <div><label>GST Number</label><span>${v.gst_number || '-'}</span></div>
      <div><label>Pincode</label><span>${v.pincode || '-'}</span></div>
      <div><label>City</label><span>${v.city || '-'}</span></div>
      <div><label>Area</label><span>${v.area || '-'}</span></div>
      <div><label>State</label><span>${v.state || '-'}</span></div>
      <div><label>Coordinates</label><span>${v.latitude ?? '-'}, ${v.longitude ?? '-'}</span></div>
      <div><label>Verified</label><span>${verified}</span></div>
      <div><label>Status</label><span>${status}</span></div>
      <div><label>Strikes</label><span>${strikeBadge}</span></div>
      <div><label>Suspended At</label><span>${v.suspended_at || '-'}</span></div>
      <div><label>Suspended Reason</label><span>${v.suspended_reason || '-'}</span></div>
      <div><label>Plan</label><span>${v.subscription_plan ? v.subscription_plan.charAt(0).toUpperCase() + v.subscription_plan.slice(1) : '-'}</span></div>
      <div><label>Effective Plan</label><span>${v.effective_plan || '-'}</span></div>
      <div><label>Plan Badge</label><span>${planBadge}</span></div>
      <div><label>Subscription</label><span>${subActive}</span></div>
      <div><label>Expires On</label><span>${v.subscription_expires_at || '-'}</span></div>
      <div><label>Max Active Posts</label><span>${v.max_active_posts === null ? 'Unlimited' : v.max_active_posts}</span></div>
      <div><label>Active Posts Now</label><span>${v.active_product_count}</span></div>
      <div><label>Google Linked</label><span>${v.google_linked ? 'Yes' : 'No'}</span></div>
      <div><label>Facebook Linked</label><span>${v.facebook_linked ? 'Yes' : 'No'}</span></div>
      <div><label>Joined</label><span>${v.created_at}</span></div>
      <div><label>Last Updated</label><span>${v.updated_at}</span></div>
    </div>
    <div class="admin-vendor-actions" style="margin-top:16px;">
      ${!v.is_active
        ? `<button id="unflagVendorBtn" class="admin-action-btn">Unflag &amp; Reactivate</button>`
        : `<button id="suspendVendorBtn" class="admin-action-btn danger">Suspend Vendor</button>`}
    </div>
  `;

  document.getElementById('unflagVendorBtn')?.addEventListener('click', async () => {
    const slug = getStoreSlug();
    const res = await apiRequest(`/auth/admin/vendors/${slug}/unflag`, 'POST');
    if (res.success) { showToast('Vendor unflagged.', 'success'); loadStore(); }
    else showToast(res.message || 'Failed to unflag vendor.', 'error');
  });

  document.getElementById('suspendVendorBtn')?.addEventListener('click', () => {
    document.getElementById('suspendReasonInput').value = '';
    document.getElementById('suspendModal').classList.add('is-open');
  });
}

/* ── Admin: render strikes ───────────────────────────────── */
function renderAdminStrikes(strikes) {
  const list = document.getElementById('adminStrikesList');
  if (!strikes || strikes.length === 0) {
    list.innerHTML = `<div class="admin-empty">No strikes on record.</div>`;
    return;
  }
  list.innerHTML = strikes.map(s => `
    <div class="admin-strike-row">
      <span class="admin-badge admin-badge-flag">Strike ${s.strike_number}</span>
      <div>
        <strong>${s.product_name || 'Unknown product'}${s.product_deleted ? ' <span style="color:#9ca3af;font-weight:400;font-size:12px;">(deleted)</span>' : ''}</strong>
        <p>${s.reason}</p>
        <small>${s.created_at}</small>
      </div>
    </div>`).join('');
}

/* ── Suspend modal wiring ────────────────────────────────── */
document.getElementById('suspendCancel')?.addEventListener('click', () => {
  document.getElementById('suspendModal').classList.remove('is-open');
});

document.getElementById('suspendConfirm')?.addEventListener('click', async () => {
  const reason = document.getElementById('suspendReasonInput').value.trim();
  if (!reason) { showToast('Please enter a reason.', 'error'); return; }
  document.getElementById('suspendModal').classList.remove('is-open');
  const slug = getStoreSlug();
  const res = await apiRequest(`/auth/admin/vendors/${slug}/suspend`, 'POST', { reason });
  if (res.success) { showToast('Vendor suspended and notified.', 'success'); loadStore(); }
  else showToast(res.message || 'Failed to suspend.', 'error');
});

/* ── SEO ─────────────────────────────────────────────────── */
function updateSEO(v) {
  const storeUrl   = `https://olrindia.com/vendor/${v.store_slug}`;
  const title      = `${v.name}'s Store – OLR India`;
  const cityText   = v.city || 'India';
  const total      = v.total_listings || 0;
  const desc       = `Browse ${total} active listing${total !== 1 ? 's' : ''} from ${v.name} in ${cityText} on OLR India. No middleman. Direct chat.`;
  const img        = v.profile_photo || 'https://olrindia.com/assets/og-banner.jpg';
  const keywords   = `${v.name} rentals, rent in ${cityText}, OLR India vendor, ${cityText} rentals`;

  document.title = title;
  document.getElementById('pageTitle').textContent    = title;
  document.getElementById('metaDesc').setAttribute('content', desc);
  document.getElementById('metaKeywords').setAttribute('content', keywords);
  document.getElementById('metaCanonical').setAttribute('href', storeUrl);
  document.getElementById('ogTitle').setAttribute('content', title);
  document.getElementById('ogDesc').setAttribute('content', desc);
  document.getElementById('ogImage').setAttribute('content', img);
  document.getElementById('ogImageAlt').setAttribute('content', `${v.name}'s Store – OLR India`);
  document.getElementById('ogUrl').setAttribute('content', storeUrl);
  document.getElementById('twTitle').setAttribute('content', title);
  document.getElementById('twDesc').setAttribute('content', desc);
  document.getElementById('twImage').setAttribute('content', img);
  document.getElementById('twImageAlt').setAttribute('content', `${v.name}'s Store – OLR India`);

  document.getElementById('vendorSchema').textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type":    "LocalBusiness",
    "@id":      storeUrl,
    "name":     v.name,
    "description": desc,
    "url":      storeUrl,
    "image":    img,
    "address": {
      "@type":           "PostalAddress",
      "addressLocality": v.city  || '',
      "addressRegion":   v.state || '',
      "addressCountry":  "IN"
    },
    "memberOf": {
      "@id": "https://olrindia.com/#organization"
    }
  });
}

/* ── Error state ─────────────────────────────────────────── */
function showError(msg) {
  document.getElementById('vsLoader').innerHTML = `
    <div style="font-size:40px;margin-bottom:12px;">😕</div>
    <h3 style="color:var(--c-ink);margin-bottom:6px;">Something went wrong</h3>
    <p>${msg}</p>
    <a href="${isAdminView ? '/admin/vendors' : '/'}" style="margin-top:16px;display:inline-flex;padding:10px 22px;
      background:var(--grad-brand);color:#fff;border-radius:var(--r-md);
      font-weight:600;text-decoration:none;font-family:var(--font-display);">
      ${isAdminView ? 'Back to Vendors' : 'Back to home'}
    </a>`;
}

/* ── Back navigation ─────────────────────────────────────── */
function goBack() {
  if (isAdminView) { window.location.href = '/admin/vendors'; return; }
  const cameFromSameSite = document.referrer && document.referrer.startsWith(window.location.origin);
  if (cameFromSameSite && history.length > 1) { history.back(); }
  else { window.location.href = '/'; }
}

/* ── Init ────────────────────────────────────────────────── */
async function loadStore() {
  const slug = getStoreSlug();
  if (!slug) { showError('Invalid store link.'); return; }

  try {
    isAdminView = await checkAdminView();

    // Admin hits auth endpoint, public hits public endpoint
    const res = isAdminView
      ? await await apiRequest(`/auth/admin/vendors/slug/${slug}`, 'GET')
      : await apiRequest(`/products/vendor/${slug}?page=1&per_page=20`, 'GET');

    if (!res.success) { showError(res.message || 'Store not found.'); return; }

    currentVendor = res.vendor;
    hasMore       = res.has_more;

    renderVendorHero(res.vendor);

    if (!isAdminView) {
      updateSEO(res.vendor);
    }

    // ── Admin mode ────────────────────────────────────────
    if (isAdminView) {
      document.getElementById('adminSections').style.display = 'block';
      document.getElementById('vsFilters').style.display = 'none';
      renderAdminVendorInfo(res.vendor);
      renderAdminStrikes(res.strikes || []);

      // Fetch public listings separately for the grid
      const listRes = await apiRequest(`/products/vendor/${slug}?page=1&per_page=20`, 'GET');
      if (listRes.success && listRes.products.length) {
        const grid = document.getElementById('vsGrid');
        listRes.products.forEach(p => grid.insertAdjacentHTML('beforeend', buildCard(p)));
        document.getElementById('vsListingsCount').textContent =
          `${listRes.total} ${listRes.total === 1 ? 'listing' : 'listings'}`;
        hasMore = listRes.has_more;
        document.getElementById('vsLoadMore').style.display = hasMore ? 'flex' : 'none';
      }

    // ── Public mode ───────────────────────────────────────
    } else {
      const grid = document.getElementById('vsGrid');
      if (!res.products.length) {
        grid.innerHTML = `
          <div class="vs-empty" style="grid-column:1/-1;">
            <div class="vs-empty-icon">📦</div>
            <h3>No listings yet</h3>
            <p>This vendor hasn't added any listings.</p>
          </div>`;
        document.getElementById('vsListingsCount').textContent = '';
      } else {
        res.products.forEach(p => grid.insertAdjacentHTML('beforeend', buildCard(p)));
        document.getElementById('vsListingsCount').textContent =
          `${res.total} ${res.total === 1 ? 'listing' : 'listings'}`;
      }
      document.getElementById('vsLoadMore').style.display = hasMore ? 'flex' : 'none';
    }

    document.getElementById('vsLoader').style.display   = 'none';
    document.getElementById('vsContent').style.display  = 'block';

  } catch (e) {
    console.error('VENDOR STORE ERROR:', e);
    showError('Failed to load store. Please try again.');
  }
}

document.addEventListener('DOMContentLoaded', loadStore);
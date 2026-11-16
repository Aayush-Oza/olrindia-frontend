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

/* ── Tab switching ───────────────────────────────────────── */
function switchTab(type) {
  currentType = type;
  currentPage = 1;
  hasMore     = false;

  document.querySelectorAll('.vs-tab').forEach(t => {
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
  const imgHtml = (p.images && p.images[0])
    ? `<img class="product-img" src="${p.images[0]}" alt="${p.name}" loading="lazy">`
    : `<div class="product-img-placeholder">📦</div>`;

  const typeChip = p.listing_type === 'sell'
    ? `<span style="position:absolute;top:8px;left:8px;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;font-family:var(--font-display);">For Sale</span>`
    : `<span style="position:absolute;top:8px;left:8px;background:#EAF3FF;color:#1d4ed8;border:1px solid #bfdbfe;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;font-family:var(--font-display);">For Rent</span>`;

  let priceHtml = '';
  if (p.listing_type === 'sell') {
    priceHtml = p.selling_price
      ? `<div class="product-price">₹${p.selling_price}</div>`
      : '';
  } else {
    const rentVal   = p.rent_per_day || p.rent_per_hour || p.rent_per_month || p.rent_per_km;
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
        ${typeChip}
      </div>
      <div class="product-body">
        <div class="product-cat">${p.category || ''}</div>
        <div class="product-title">${p.name}</div>
        <div class="product-bottom">
          ${priceHtml}
          ${locHtml}
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

/* ── SEO ─────────────────────────────────────────────────── */
function updateSEO(v) {
  const storeUrl = `https://olrindia.com/vendor/${v.store_slug}`;
  const title    = `${v.name}'s Store – OLR India`;
  const desc     = `Browse ${v.total_listings} active listing${v.total_listings !== 1 ? 's' : ''} from ${v.name} on OLR India. Based in ${v.city || 'India'}.`;
  const img      = v.profile_photo || 'https://olrindia.com/assets/og-banner.jpg';

  document.title = title;
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('metaDesc').setAttribute('content', desc);
  document.getElementById('metaCanonical').setAttribute('href', storeUrl);
  document.getElementById('ogTitle').setAttribute('content', title);
  document.getElementById('ogDesc').setAttribute('content', desc);
  document.getElementById('ogImage').setAttribute('content', img);
  document.getElementById('ogUrl').setAttribute('content', storeUrl);
  document.getElementById('twTitle').setAttribute('content', title);
  document.getElementById('twDesc').setAttribute('content', desc);
  document.getElementById('twImage').setAttribute('content', img);

  document.getElementById('vendorSchema').textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type":    "LocalBusiness",
    "name":     v.name,
    "url":      storeUrl,
    "image":    img,
    "address": {
      "@type":           "PostalAddress",
      "addressLocality": v.city  || '',
      "addressRegion":   v.state || '',
      "addressCountry":  "IN"
    }
  });
}

/* ── Error state ─────────────────────────────────────────── */
function showError(msg) {
  document.getElementById('vsLoader').innerHTML = `
    <div style="font-size:40px;margin-bottom:12px;">😕</div>
    <h3 style="color:var(--c-ink);margin-bottom:6px;">Something went wrong</h3>
    <p>${msg}</p>
    <a href="/" style="margin-top:16px;display:inline-flex;padding:10px 22px;
      background:var(--grad-brand);color:#fff;border-radius:var(--r-md);
      font-weight:600;text-decoration:none;font-family:var(--font-display);">
      Back to home
    </a>`;
}

/* ── Back navigation ─────────────────────────────────────── */
function goBack() {
  const cameFromSameSite = document.referrer && document.referrer.startsWith(window.location.origin);
  if (cameFromSameSite && history.length > 1) { history.back(); }
  else { window.location.href = '/'; }
}

/* ── Init ────────────────────────────────────────────────── */
async function loadStore() {
  const slug = getStoreSlug();
  if (!slug) { showError('Invalid store link.'); return; }

  try {
    const res = await apiRequest(`/products/vendor/${slug}?page=1&per_page=20`, 'GET');

    if (!res.success) { showError(res.message || 'Store not found.'); return; }

    currentVendor = res.vendor;
    hasMore       = res.has_more;

    renderVendorHero(res.vendor);
    updateSEO(res.vendor);

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
    document.getElementById('vsLoader').style.display   = 'none';
    document.getElementById('vsContent').style.display  = 'block';

  } catch (e) {
    showError('Failed to load store. Please try again.');
  }
}

loadStore();
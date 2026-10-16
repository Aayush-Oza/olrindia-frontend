/* ============================================================
   OLR INDIA - BROWSE JS
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
let allProducts = [];
let filteredProducts = [];
let displayedCount = 0;
let isLoadingMore = false;
let currentPage = 1;
let totalProducts = 0;
let hasMore = false;
let sentinel = null;
let scrollObserver = null;
const wishedIds = new Set();
const wishedSlugs = new Map();
let activeFilters = {
  category: '',
  city: '',
  priceType: '',
  priceMin: 0,
  priceMax: Infinity,
};

function populateCategoryDropdown(categories) {
  const sel = document.getElementById('filterCategory');
  if (!sel) return;
  sel.innerHTML = '<option value="">All categories</option>' +
    categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

// ── Slugify ───────────────────────────────────────────────────
function slugify(text) {
  return (text || '').toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Skeleton ──────────────────────────────────────────────────
function skeletonCardHTML() {
  return `<div class="skeleton-card">
    <div class="skeleton-img"></div>
    <div class="skeleton-body">
      <div class="skeleton-line skeleton-line-sm"></div>
      <div class="skeleton-line skeleton-line-md"></div>
      <div class="skeleton-line skeleton-line-lg"></div>
      <div class="skeleton-line skeleton-line-xs"></div>
    </div>
  </div>`;
}

// ── Hamburger ─────────────────────────────────────────────────
document.getElementById('hamburgerBtn').addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── Filter sheet ──────────────────────────────────────────────
document.getElementById('filterBtn').addEventListener('click', openFilterSheet);

function openFilterSheet() {
  document.getElementById('filterSheet').classList.add('open');
  document.getElementById('filterOverlay').classList.add('open');
}
function closeFilterSheet() {
  document.getElementById('filterSheet').classList.remove('open');
  document.getElementById('filterOverlay').classList.remove('open');
}

// Price type toggle
document.querySelectorAll('.price-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.price-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Locate btn
document.getElementById('filterLocateBtn').addEventListener('click', () => {
  if (!navigator.geolocation) { toastError('Your browser does not support location.'); return; }
  const locateBtn = document.getElementById('filterLocateBtn');
  locateBtn.disabled = true;
  locateBtn.style.opacity = '0.5';
  toastInfo('Looking for your location…');
  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      let city = data.address?.city || data.address?.town || data.address?.village || '';
      if (!city) {
        const fallback = data.address?.city_district || data.address?.state_district || '';
        city = fallback.split(' ')[0] || '';
      }
      if (city) document.getElementById('filterCity').value = city;
      else toastError("Couldn't determine your city.");
    } catch (e) {
      toastError('Location lookup failed.');
    } finally {
      locateBtn.disabled = false;
      locateBtn.style.opacity = '1';
    }
  }, (err) => {
    const messages = { 1: 'Location permission denied.', 2: 'Location unavailable.', 3: 'Request timed out.' };
    toastError(messages[err.code] || 'Could not get your location.');
    locateBtn.disabled = false;
    locateBtn.style.opacity = '1';
  });
});

// Apply filters
document.getElementById('filterApplyBtn').addEventListener('click', () => {
  const selectedType = document.querySelector('.price-type-btn.active')?.dataset.type || '';
  const priceMin = parseFloat(document.getElementById('filterPriceMin').value) || 0;
  const priceMax = parseFloat(document.getElementById('filterPriceMax').value) || Infinity;

  document.getElementById('filterPriceHint').textContent = 'Enter a min or max to filter by price.';
  document.getElementById('filterPriceHint').classList.remove('error');

  activeFilters.category = document.getElementById('filterCategory').value;
  activeFilters.city = document.getElementById('filterCity').value.trim().toLowerCase();
  activeFilters.priceType = selectedType;
  activeFilters.priceMin = priceMin;
  activeFilters.priceMax = priceMax;
  closeFilterSheet();
  applyFilters();
  renderActiveFilterChips();
});

// Clear filters
document.getElementById('filterClearBtn').addEventListener('click', () => {
  document.getElementById('filterCategory').value = '';
  document.getElementById('filterCity').value = '';
  document.getElementById('filterPriceMin').value = '';
  document.getElementById('filterPriceMax').value = '';
  document.getElementById('filterPriceHint').textContent = 'Enter a min or max to filter by price.';
  document.getElementById('filterPriceHint').classList.remove('error');
  document.querySelectorAll('.price-type-btn').forEach(b => b.classList.remove('active'));
  activeFilters = { category: '', city: '', priceType: '', priceMin: 0, priceMax: Infinity };
  closeFilterSheet();
  renderActiveFilterChips();
  updateFilterBadge();
  loadBrowseHomepage();
});

// Search
let searchDebounceTimer = null;
document.getElementById('searchInput').addEventListener('input', function () {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    const homeSection = document.getElementById('browseHomeSection');
    if (homeSection) homeSection.style.display = 'none';
    document.getElementById('productGrid').style.display = 'grid';
    document.getElementById('productsTitle').textContent = 'Search Results';
    applyFilters();
  }, 400);
});

// ── Apply filters ─────────────────────────────────────────────
function applyFilters() {
  const homeSection = document.getElementById('browseHomeSection');
  if (homeSection) homeSection.style.display = 'none';
  document.getElementById('productGrid').style.display = 'grid';
  if (activeFilters.category) {
    document.getElementById('productsTitle').textContent = activeFilters.category;
  } else {
    const q = document.getElementById('searchInput').value.trim();
    document.getElementById('productsTitle').textContent = q ? 'Search Results' : 'All Products';
  }
  loadBrowseProducts(true);
}

// ── Load products ─────────────────────────────────────────────
async function loadBrowseProducts(reset = true) {
  if (reset) {
    currentPage = 1;
    allProducts = [];
    displayedCount = 0;
    document.getElementById('productGrid').innerHTML =
      Array(20).fill(skeletonCardHTML()).join('');
  }

  const params = new URLSearchParams({ page: currentPage, per_page: 20 });
  if (activeFilters.category) params.set('category', activeFilters.category);
  if (activeFilters.city) params.set('city', activeFilters.city);
  if (activeFilters.priceType) params.set('price_type', activeFilters.priceType);
  if (activeFilters.priceMin > 0) params.set('price_min', activeFilters.priceMin);
  if (activeFilters.priceMax < Infinity) params.set('price_max', activeFilters.priceMax);
  const q = document.getElementById('searchInput').value.trim();
  if (q) params.set('search', q);

  try {
    const res = await apiRequest(`/products/public?${params}`, 'GET');
    if (!res.success) {
      document.getElementById('productGrid').innerHTML =
        `<div class="grid-empty"><div style="font-size:40px">😕</div><p>Failed to load products.</p></div>`;
      return;
    }
    totalProducts = res.total;
    hasMore = res.has_more;
    allProducts = res.products;
    filteredProducts = res.products;
    displayedCount = res.products.length;
    renderProducts();
    attachSentinel();
    updateFilterBadge();
  } catch (e) {
    document.getElementById('productGrid').innerHTML =
      `<div class="grid-empty"><div style="font-size:40px">😕</div><p>Failed to load products. Please refresh.</p></div>`;
  }
}

// ── Append next batch ─────────────────────────────────────────
async function appendNextBatch() {
  if (isLoadingMore || !hasMore) return;
  isLoadingMore = true;
  document.getElementById('scrollSentinel')?.remove();
  document.querySelector('.scroll-end-msg')?.remove();

  const grid = document.getElementById('homeProdGrid') || document.getElementById('productGrid');
  const skeletonWrapper = document.createElement('div');
  skeletonWrapper.id = 'skeletonBatch';
  skeletonWrapper.style.cssText = 'display:contents';
  skeletonWrapper.innerHTML = Array(10).fill(skeletonCardHTML()).join('');
  grid.appendChild(skeletonWrapper);

  currentPage++;
  const params = new URLSearchParams({ page: currentPage, per_page: 20 });
  if (activeFilters.category) params.set('category', activeFilters.category);
  if (activeFilters.city) params.set('city', activeFilters.city);
  if (activeFilters.priceType) params.set('price_type', activeFilters.priceType);
  if (activeFilters.priceMin > 0) params.set('price_min', activeFilters.priceMin);
  if (activeFilters.priceMax < Infinity) params.set('price_max', activeFilters.priceMax);
  const q = document.getElementById('searchInput').value.trim();
  if (q) params.set('search', q);

  try {
    const res = await apiRequest(`/products/public?${params}`, 'GET');
    skeletonWrapper.remove();
    if (res.success) {
      hasMore = res.has_more;
      totalProducts = res.total;
      res.products.forEach(p => grid.insertAdjacentHTML('beforeend', productCardHTML(p)));
      displayedCount += res.products.length;
    }
  } catch (e) {
    skeletonWrapper.remove();
    toastError('Failed to load more products.');
    currentPage--;
  }
  isLoadingMore = false;
  attachSentinel();
}

// ── Sentinel ──────────────────────────────────────────────────
function attachSentinel() {
  if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
  sentinel?.remove();
  const grid = document.getElementById('homeProdGrid') || document.getElementById('productGrid');
  if (!hasMore) {
    if (totalProducts > 20) {
      grid.insertAdjacentHTML('beforeend',
        `<div class="scroll-end-msg" style="grid-column:1/-1;text-align:center;padding:18px;font-size:13px;color:var(--c-ink-faint);">✓ All ${totalProducts} products loaded</div>`);
    }
    return;
  }
  grid.insertAdjacentHTML('beforeend', `<div id="scrollSentinel" style="grid-column:1/-1;height:40px;"></div>`);
  sentinel = document.getElementById('scrollSentinel');
  scrollObserver = new IntersectionObserver(
    (entries) => { if (entries[0].isIntersecting) appendNextBatch(); },
    { rootMargin: '200px' }
  );
  scrollObserver.observe(sentinel);
}

// ── Render products ───────────────────────────────────────────
function renderProducts() {
  const grid = document.getElementById('productGrid');
  const countEl = document.getElementById('productsCount');

  if (filteredProducts.length === 0) {
    countEl.textContent = '';
    grid.innerHTML = `
      <div class="grid-empty">
        <div style="font-size:44px;margin-bottom:10px;">🔍</div>
        <h3>No products found</h3>
        <p>Try different filters or search terms.</p>
        <button onclick="clearAllFilters()" style="margin-top:12px;padding:9px 22px;border-radius:var(--r-md);background:var(--grad-brand);color:#fff;border:none;font-weight:600;cursor:pointer;font-family:var(--font-display);">Clear filters</button>
      </div>`;
    return;
  }
  countEl.textContent = `${totalProducts} product${totalProducts !== 1 ? 's' : ''}`;
  grid.innerHTML = filteredProducts.map(p => productCardHTML(p)).join('');
}

// ── Product card ──────────────────────────────────────────────
function productCardHTML(p) {
  if (p.id && p.share_slug) wishedSlugs.set(p.id, p.share_slug);
  const img = p.images && p.images[0]
    ? `<img class="product-img" src="${p.images[0]}" alt="${p.name}" loading="lazy">`
    : `<div class="product-img-placeholder">📦</div>`;

  const price = buildPriceLabel(p);
  const wished = wishedIds.has(p.id);
  const badge = p.vendor_badge === 'featured'
    ? `<span class="vendor-badge badge-premium">★ Top Vendor</span>`
    : p.vendor_badge === 'verified'
      ? `<span class="vendor-badge badge-growth">✓ Verified</span>`
      : '';

  return `
    <div class="product-card" onclick="openProduct('${p.share_slug}','${p.category || ''}','${p.city || ''}')">
      ${img}
      ${badge}
      <button class="product-wish-btn ${wished ? 'active' : ''}" onclick="event.stopPropagation();toggleWish(this,${p.id})" title="Save to wishlist">${wished ? '♥' : '♡'}</button>
      <div class="product-body">
        <div class="product-cat">${p.category || ''}</div>
        <div class="product-title">${p.name}</div>
        <div class="product-bottom">
          <div class="product-price">${price}</div>
          <div class="product-loc">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z" stroke="currentColor" stroke-width="2"/></svg>
            ${p.city || ''}
          </div>
        </div>
      </div>
    </div>`;
}

// ── Price label ───────────────────────────────────────────────
function buildPriceLabel(p) {
  const type = activeFilters.priceType;
  if (type === 'hour' && p.rent_per_hour) return `₹${p.rent_per_hour} <span>/ hour</span>`;
  if (type === 'km'    && p.rent_per_km)   return `₹${p.rent_per_km} <span>/ km</span>`;
  if (type === 'day'   && p.rent_per_day)  return `₹${p.rent_per_day} <span>/ day</span>`;
  if (type === 'month' && p.rent_per_month)return `₹${p.rent_per_month} <span>/ month</span>`;
  if (p.rent_per_day)   return `₹${p.rent_per_day} <span>/ day</span>`;
  if (p.rent_per_hour)  return `₹${p.rent_per_hour} <span>/ hour</span>`;
  if (p.rent_per_month) return `₹${p.rent_per_month} <span>/ month</span>`;
  if (p.rent_per_km)    return `₹${p.rent_per_km} <span>/ km</span>`;
  return `<span style="color:var(--c-ink-faint);font-size:12px;">Price not set</span>`;
}

// ── Open product ──────────────────────────────────────────────
function openProduct(slug, category, city) {
  if (!slug) return;
  window.location.href = `/product/${slugify(category || '')}/${slugify(city || 'india')}/${slug}`;
}

// ── Clear all filters ─────────────────────────────────────────
function clearAllFilters() {
  activeFilters = { category: '', city: '', priceType: '', priceMin: 0, priceMax: Infinity };
  document.getElementById('searchInput').value = '';
  document.getElementById('filterCategory').value = '';
  document.getElementById('filterCity').value = '';
  document.getElementById('filterPriceMin').value = '';
  document.getElementById('filterPriceMax').value = '';
  document.querySelectorAll('.price-type-btn').forEach(b => b.classList.remove('active'));
  renderActiveFilterChips();
  updateFilterBadge();
  loadBrowseHomepage();
}

// ── Filter badge + chips ──────────────────────────────────────
function updateFilterBadge() {
  let count = 0;
  if (activeFilters.category) count++;
  if (activeFilters.city) count++;
  if (activeFilters.priceType) count++;
  if (activeFilters.priceMin > 0 || activeFilters.priceMax < Infinity) count++;
  const badge = document.getElementById('filterCountBadge');
  badge.style.display = count ? 'inline-flex' : 'none';
  badge.textContent = count;
  document.getElementById('filterBtn').classList.toggle('has-filters', count > 0);
}

function renderActiveFilterChips() {
  const el = document.getElementById('activeFilters');
  const chips = [];
  if (activeFilters.category) chips.push({ label: activeFilters.category, key: 'category' });
  if (activeFilters.city) chips.push({ label: `📍 ${activeFilters.city}`, key: 'city' });
  if (activeFilters.priceType) chips.push({ label: `⏱ ${activeFilters.priceType}`, key: 'priceType' });
  if (activeFilters.priceMin > 0 || activeFilters.priceMax < Infinity) {
    const label = `₹${activeFilters.priceMin}–${activeFilters.priceMax === Infinity ? '∞' : activeFilters.priceMax}`;
    chips.push({ label, key: 'price' });
  }
  el.innerHTML = chips.map(c =>
    `<button class="active-chip" onclick="removeFilter('${c.key}')">${c.label} ✕</button>`
  ).join('');
}

function removeFilter(key) {
  if (key === 'category') { activeFilters.category = ''; document.getElementById('filterCategory').value = ''; }
  if (key === 'city') { activeFilters.city = ''; document.getElementById('filterCity').value = ''; }
  if (key === 'priceType') { activeFilters.priceType = ''; document.querySelectorAll('.price-type-btn').forEach(b => b.classList.remove('active')); }
  if (key === 'price') {
    activeFilters.priceMin = 0; activeFilters.priceMax = Infinity;
    document.getElementById('filterPriceMin').value = '';
    document.getElementById('filterPriceMax').value = '';
  }
  renderActiveFilterChips();
  updateFilterBadge();
  const hasAny = activeFilters.category || activeFilters.city || activeFilters.priceType || activeFilters.priceMin > 0 || activeFilters.priceMax < Infinity || document.getElementById('searchInput').value.trim();
  if (!hasAny) loadBrowseHomepage(); else applyFilters();
}

// ── Homepage ──────────────────────────────────────────────────
async function loadBrowseHomepage() {
  const grid = document.getElementById('productGrid');
  const countEl = document.getElementById('productsCount');
  countEl.textContent = '';
  grid.style.display = 'none';

  let homeSection = document.getElementById('browseHomeSection');
  if (!homeSection) {
    homeSection = document.createElement('div');
    homeSection.id = 'browseHomeSection';
    grid.parentNode.insertBefore(homeSection, grid);
  }
  homeSection.style.display = 'block';
  homeSection.innerHTML = `
    <div id="catCardGrid" class="cat-card-grid">
      ${Array(8).fill(`
        <div class="cat-card skeleton-cat-card">
          <div class="skeleton-img" style="height:100%;width:100%;border-radius:var(--r-md);"></div>
        </div>`).join('')}
    </div>
    <div id="homeProdSection">
      <div class="home-prod-title">Featured Products</div>
      <div class="product-grid" id="homeProdGrid">
        ${Array(8).fill(skeletonCardHTML()).join('')}
      </div>
    </div>`;

  const [catData, prodData] = await Promise.all([
    apiRequest('/products/categories', 'GET').catch(() => null),
    apiRequest('/products/public?page=1&per_page=20', 'GET').catch(() => null)
  ]);

  hasMore = prodData?.has_more ?? false;
  totalProducts = prodData?.total ?? 0;

  const catGrid = document.getElementById('catCardGrid');
  if (catGrid) {
    if (catData?.success && catData.categories.length > 0) {
      populateCategoryDropdown(catData.categories);
      catGrid.innerHTML = catData.categories.map(cat => `
        <div class="cat-card" onclick="enterBrowseCategory('${cat.name.replace(/'/g, "\\'")}')">
          <img class="cat-card-img" src="${cat.image_url}" alt="${cat.name}" loading="lazy">
          <div class="cat-card-name">${cat.name}</div>
        </div>`).join('');
    } else {
      catGrid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:36px 20px;">
          <div style="font-size:48px;margin-bottom:12px;">🏪</div>
          <h3 style="margin:0 0 8px;font-family:var(--font-display);color:var(--text-main);">No categories live yet</h3>
          <p style="margin:0;color:var(--text-muted);font-size:14px;">Vendors are setting up - products will appear here soon.</p>
        </div>`;
    }
  }

  const homeProdGrid = document.getElementById('homeProdGrid');
  if (homeProdGrid) {
    if (prodData?.success && prodData.products.length > 0) {
      homeProdGrid.innerHTML = prodData.products.map(p => productCardHTML(p)).join('');
      if (hasMore) attachSentinel();
    } else {
      homeProdGrid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:36px 20px;">
          <div style="font-size:48px;margin-bottom:12px;">📦</div>
          <h3 style="margin:0 0 8px;font-family:var(--font-display);color:var(--text-main);">No products listed yet</h3>
          <p style="margin:0;color:var(--text-muted);font-size:14px;">Be the first! <a href="../vendor/signup.html" style="color:var(--brand);font-weight:600;text-decoration:none;">List your item →</a></p>
        </div>`;
    }
  }
}

// ── Enter category ────────────────────────────────────────────
function enterBrowseCategory(cat) {
  activeFilters.category = cat;
  document.getElementById('filterCategory').value = cat;
  document.getElementById('productsCount').textContent = '';
  const homeSection = document.getElementById('browseHomeSection');
  if (homeSection) homeSection.style.display = 'none';
  document.getElementById('productGrid').style.display = 'grid';
  document.getElementById('productsTitle').textContent = cat;
  renderActiveFilterChips();
  updateFilterBadge();
  loadBrowseProducts(true);
}

// ── Wishlist toggle (used on product cards) ───────────────────
async function toggleWish(btn, productId) {
  const isWished = wishedIds.has(productId);
  if (isWished) { wishedIds.delete(productId); toastSuccess('Removed from wishlist'); }
  else { wishedIds.add(productId); toastSuccess('Added to wishlist'); }

  document.querySelectorAll('.product-wish-btn').forEach(b => {
    const match = b.getAttribute('onclick')?.match(/toggleWish\(this,(\d+)\)/);
    if (match && parseInt(match[1]) === productId) {
      b.classList.toggle('active', !isWished);
      b.textContent = isWished ? '♡' : '♥';
    }
  });
  updateWishlistBadge();

  try {
    if (isWished) await apiRequest(`/auth/user/wishlist/${productId}`, 'DELETE');
    else await apiRequest('/auth/user/wishlist', 'POST', { product_id: productId });
  } catch (e) {
    if (isWished) wishedIds.add(productId); else wishedIds.delete(productId);
    document.querySelectorAll('.product-wish-btn').forEach(b => {
      const match = b.getAttribute('onclick')?.match(/toggleWish\(this,(\d+)\)/);
      if (match && parseInt(match[1]) === productId) {
        b.classList.toggle('active', isWished);
        b.textContent = isWished ? '♥' : '♡';
      }
    });
    updateWishlistBadge();
    toastError('Failed to update wishlist.');
  }
}

function updateWishlistBadge() {
  ['wishlistCount', 'wishlistCountMobile'].forEach(id => {
    const badge = document.getElementById(id);
    if (!badge) return;
    badge.style.display = wishedIds.size > 0 ? 'inline' : 'none';
    badge.textContent = wishedIds.size;
  });
}

async function loadWishlist() {
  const res = await apiRequest('/auth/user/wishlist', 'GET');
  if (!res.success) return;
  wishedIds.clear(); wishedSlugs.clear();
  res.wishlist.forEach(i => { wishedIds.add(i.product_id); if (i.share_slug) wishedSlugs.set(i.product_id, i.share_slug); });
  updateWishlistBadge();
}

// ── Logout ────────────────────────────────────────────────────
['logoutBtn', 'logoutBtnMobile'].forEach(id => {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const confirmed = await showConfirm({
      title: 'Log out?',
      text: "You'll need to sign in again to access your account.",
      confirmLabel: 'Log out', cancelLabel: 'Stay logged in',
    });
    if (!confirmed) return;
    await apiRequest('/auth/user/logout', 'POST');
    clearSessionAccount('user');
    window.location.href = '/user/login';
  });
});

// ── Nav avatar ────────────────────────────────────────────────
async function loadNavUser() {
  const res = await apiRequest('/auth/user/profile', 'GET');
  if (!res.success) return;
  const u = res.user;
  const html = u.profile_photo
    ? `<img class="avatar-img-sm" src="${u.profile_photo}" alt="${u.name || ''}">`
    : `<span>${getInitials(u.name)}</span>`;
  document.getElementById('navUserAvatar').innerHTML = html;
  document.getElementById('navUserAvatarMobile').innerHTML = html;
  document.getElementById('navUserName').textContent = u.name || '';
  document.getElementById('navUserNameMobile').textContent = u.name || '';
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadNavUser();
  loadBrowseHomepage();
  loadWishlist().catch(err => console.error('Wishlist load failed:', err));

  // Check for category param in URL e.g. /user/browse?category=Machineries
  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get('category');
  if (catParam) enterBrowseCategory(catParam);

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      const res = await apiRequest('/auth/user/profile', 'GET');
      if (!res.success && res.httpStatus === 401) {
        clearSessionAccount('user');
        window.location.href = '/user/login';
      }
    }
  });
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    loadBrowseHomepage();
    loadWishlist().catch(err => console.error('Wishlist load failed:', err));
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 860) document.getElementById('mobileMenu').classList.remove('open');
});
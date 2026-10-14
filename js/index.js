/* ============================================================
   OLR INDIA - INDEX PAGE JS
   Infinite scroll: 20 initial, +10 on scroll, skeleton cards
   ============================================================ */

const PAGE_INITIAL = 20;
const PAGE_MORE = 10;

let allProducts = [];
let filteredProducts = [];
let displayedCount = 0;
let isLoadingMore = false;
let currentPage = 1;
let totalProducts = 0;
let hasMore = false;
let activeFilters = {
  category: '',
  city: '',
  priceType: '',
  priceMin: 0,
  priceMax: Infinity,
};
let currentMode = 'home';

// ── Skeleton helpers ──────────────────────────────────────────
function skeletonCardHTML() {
  return `
    <div class="skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton-line skeleton-line-sm"></div>
        <div class="skeleton-line skeleton-line-md"></div>
        <div class="skeleton-line skeleton-line-lg"></div>
        <div class="skeleton-line skeleton-line-xs"></div>
      </div>
    </div>`;
}

function showSkeletons(count = PAGE_INITIAL) {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = Array(count).fill(skeletonCardHTML()).join('');
}

// ── Fetch products ────────────────────────────────────────────
async function loadProducts(reset = true) {
  document.getElementById('productGrid').style.display = 'grid';
  if (reset) {
    currentPage = 1;
    allProducts = [];
    displayedCount = 0;
    showSkeletons(PAGE_INITIAL);
  }

  const params = new URLSearchParams({ page: currentPage, per_page: PAGE_INITIAL });
  if (activeFilters.category) params.set('category', activeFilters.category);
  if (activeFilters.city) params.set('city', activeFilters.city);
  if (activeFilters.priceType) params.set('price_type', activeFilters.priceType);
  if (activeFilters.priceMin > 0) params.set('price_min', activeFilters.priceMin);
  if (activeFilters.priceMax < Infinity) params.set('price_max', activeFilters.priceMax);
  const q = document.getElementById('searchInput').value.trim();
  if (q) params.set('search', q);

  try {
    const data = await apiRequest(`/products/public?${params}`, 'GET');
    if (data.success) {
      totalProducts = data.total;
      hasMore = data.has_more;
      allProducts = data.products;
      filteredProducts = data.products;
      displayedCount = data.products.length;
      renderInitialBatch();
      updateFilterBadge();
    }
  } catch (e) {
    document.getElementById('productGrid').innerHTML =
      `<div class="grid-empty"><div style="font-size:40px">😕</div><p>Failed to load products. Please refresh.</p></div>`;
  }
}

// ── Filter sheet ──────────────────────────────────────────────
document.getElementById('filterBtn').addEventListener('click', openFilterSheet);

function openFilterSheet() {
  document.getElementById('filterSheet').classList.add('open');
  document.getElementById('filterOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeFilterSheet() {
  document.getElementById('filterSheet').classList.remove('open');
  document.getElementById('filterOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.querySelectorAll('.price-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.price-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

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
  enterFilteredView();
  renderActiveFilterChips();
});

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
  loadHomepage();
});

let searchDebounceTimer = null;
document.getElementById('searchInput').addEventListener('input', function () {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => applyFilters(), 400);
});

// ── Render first batch ────────────────────────────────────────
function renderInitialBatch() {
  const grid = document.getElementById('productGrid');
  const countEl = document.getElementById('productsCount');

  if (filteredProducts.length === 0) {
    countEl.textContent = '';
    grid.innerHTML = `
      <div class="grid-empty" style="grid-column:1/-1">
        <div style="font-size:44px;margin-bottom:10px;">🔍</div>
        <h3>No products found</h3>
        <p>Try different filters or search terms.</p>
        <button onclick="clearAllFilters()" style="margin-top:12px;padding:9px 22px;border-radius:var(--r-md);background:var(--grad-brand);color:#fff;border:none;font-weight:600;cursor:pointer;font-family:var(--font-display);">Clear filters</button>
      </div>`;
    return;
  }

  countEl.textContent = `${totalProducts} product${totalProducts !== 1 ? 's' : ''}`;
  grid.innerHTML = filteredProducts.map(productCardHTML).join('');
  attachSentinel();
  setTimeout(() => window.retranslateDynamic?.(), 600);
}

// ── Append next batch ─────────────────────────────────────────
async function appendNextBatch() {
  if (isLoadingMore || !hasMore) return;

  isLoadingMore = true;
  document.getElementById('scrollSentinel')?.remove();
  document.querySelector('.scroll-end-msg')?.remove();

  const grid = document.getElementById('productGrid');
  const skeletonWrapper = document.createElement('div');
  skeletonWrapper.id = 'skeletonBatch';
  skeletonWrapper.style.cssText = 'display:contents';
  skeletonWrapper.innerHTML = Array(PAGE_MORE).fill(skeletonCardHTML()).join('');
  grid.appendChild(skeletonWrapper);

  currentPage++;
  const params = new URLSearchParams({ page: currentPage, per_page: PAGE_MORE });
  if (activeFilters.category) params.set('category', activeFilters.category);
  if (activeFilters.city) params.set('city', activeFilters.city);
  if (activeFilters.priceType) params.set('price_type', activeFilters.priceType);
  if (activeFilters.priceMin > 0) params.set('price_min', activeFilters.priceMin);
  if (activeFilters.priceMax < Infinity) params.set('price_max', activeFilters.priceMax);
  const q = document.getElementById('searchInput').value.trim();
  if (q) params.set('search', q);

  try {
    const data = await apiRequest(`/products/public?${params}`, 'GET');
    skeletonWrapper.remove();
    if (data.success) {
      hasMore = data.has_more;
      totalProducts = data.total;
      data.products.forEach(p => {
        grid.insertAdjacentHTML('beforeend', productCardHTML(p));
      });
      displayedCount += data.products.length;
      setTimeout(() => window.retranslateDynamic?.(), 600);
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
let sentinel = null;
let scrollObserver = null;

function attachSentinel() {
  if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
  sentinel?.remove();

  const grid = document.getElementById('productGrid');
  if (!hasMore) {
    if (totalProducts > PAGE_INITIAL) {
      grid.insertAdjacentHTML('beforeend',
        `<div class="scroll-end-msg">✓ All ${totalProducts} products loaded</div>`);
    }
    return;
  }

  grid.insertAdjacentHTML('beforeend', `<div id="scrollSentinel"></div>`);
  sentinel = document.getElementById('scrollSentinel');
  scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) appendNextBatch();
  }, { rootMargin: '200px' });
  scrollObserver.observe(sentinel);
}

// ── Slugify ───────────────────────────────────────────────────
function slugify(text) {
  return (text || '').toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Product card HTML ─────────────────────────────────────────
function productCardHTML(p) {
  const img = p.images && p.images[0]
    ? `<img class="product-img" src="${p.images[0]}" alt="${p.name}" loading="lazy">`
    : `<div class="product-img-placeholder"></div>`;

  const price = buildPriceLabel(p);

  const badge = p.vendor_badge === 'featured'
    ? `<span class="vendor-badge badge-premium">★ Top Vendor</span>`
    : p.vendor_badge === 'verified'
      ? `<span class="vendor-badge badge-growth">✓ Verified</span>`
      : '';

  return `
    <div class="product-card" onclick="openProduct('${p.share_slug}','${p.category}','${p.city}')">
      ${img}
      ${badge}
      <button class="product-wish-btn" onclick="event.stopPropagation();handleWish(this,${p.id})" title="Save to wishlist">♡</button>
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
      </div>
    </div>`;
}

// ── Price label ───────────────────────────────────────────────
function buildPriceLabel(p) {
  const type = activeFilters.priceType;
  if (type === 'hour' && p.rent_per_hour) return `₹${p.rent_per_hour} <span>/ hour</span>`;
  if (type === 'km'   && p.rent_per_km)   return `₹${p.rent_per_km} <span>/ km</span>`;
  if (type === 'day'  && p.rent_per_day)  return `₹${p.rent_per_day} <span>/ day</span>`;
  if (type === 'month'&& p.rent_per_month)return `₹${p.rent_per_month} <span>/ month</span>`;
  if (p.rent_per_day)   return `₹${p.rent_per_day} <span>/ day</span>`;
  if (p.rent_per_hour)  return `₹${p.rent_per_hour} <span>/ hour</span>`;
  if (p.rent_per_month) return `₹${p.rent_per_month} <span>/ month</span>`;
  if (p.rent_per_km)    return `₹${p.rent_per_km} <span>/ km</span>`;
  return 'Price not available';
}

// ── Open product ──────────────────────────────────────────────
function openProduct(slug, category, city) {
  if (!slug) return;
  const cat = slugify(category || '');
  const ct = slugify(city || 'india');
  window.location.href = `/product/${cat}/${ct}/${slug}`;
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
  loadHomepage();
}

// ── Filter badge + chips ──────────────────────────────────────
function updateFilterBadge() {
  let count = 0;
  if (activeFilters.category) count++;
  if (activeFilters.city) count++;
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
  if (activeFilters.priceMin > 0 || activeFilters.priceMax < Infinity) {
    const label = `₹${activeFilters.priceMin}–${activeFilters.priceMax === Infinity ? '∞' : activeFilters.priceMax} / ${activeFilters.priceType}`;
    chips.push({ label, key: 'price' });
  }
  el.innerHTML = chips.map(c =>
    `<button class="active-chip" onclick="removeFilter('${c.key}')">${c.label} ✕</button>`
  ).join('');
}

function removeFilter(key) {
  if (key === 'category') { activeFilters.category = ''; document.getElementById('filterCategory').value = ''; }
  if (key === 'city') { activeFilters.city = ''; document.getElementById('filterCity').value = ''; }
  if (key === 'price') {
    activeFilters.priceMin = 0; activeFilters.priceMax = Infinity;
    document.getElementById('filterPriceMin').value = '';
    document.getElementById('filterPriceMax').value = '';
  }
  renderActiveFilterChips();
  updateFilterBadge();
  const hasAny = activeFilters.category || activeFilters.city || activeFilters.priceMin > 0 || activeFilters.priceMax < Infinity || document.getElementById('searchInput').value.trim();
  if (!hasAny) loadHomepage(); else loadProducts(true);
}

// ── Wishlist ──────────────────────────────────────────────────
function handleWish(btn, productId) {
  if (!sessionStorage.getItem('olr_user')) { openAuthModal('login'); return; }
  btn.classList.toggle('active');
  btn.textContent = btn.classList.contains('active') ? '♥' : '♡';
}

document.getElementById('navWishBtn').addEventListener('click', () => {
  if (!sessionStorage.getItem('olr_user')) { window.location.href = '/user/login'; return; }
  window.location.href = '/user/dashboard';
});

// ── Auth modal ────────────────────────────────────────────────
function openAuthModal() {
  document.getElementById('authOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeAuthModal() {
  document.getElementById('authOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeAuthModal(); closeFilterSheet(); }
});

// ── Homepage: fetch categories + products from API ────────────
async function loadHomepage() {
  currentMode = 'home';
  document.getElementById('productsTitle').textContent = 'Browse & Rent';
  document.getElementById('productsCount').textContent = '';
  document.getElementById('productGrid').style.display = 'block';

  const grid = document.getElementById('productGrid');

  // Show skeletons
  grid.innerHTML = `
    <div id="catCardGrid" class="cat-card-grid">
      ${Array(8).fill(`
        <div class="cat-card skeleton-cat-card">
          <div class="skeleton-img" style="height:100%;width:100%;border-radius:var(--r-md);"></div>
        </div>`).join('')}
    </div>
    <div id="homeProdSection">
      <div class="home-prod-title">Featured Products</div>
      <div class="product-grid">
        ${Array(6).fill(skeletonCardHTML()).join('')}
      </div>
    </div>`;

  // Fetch categories + featured products in parallel
  const [catData, prodData] = await Promise.all([
    apiRequest('/products/categories', 'GET').catch(() => null),
    apiRequest('/products/public?page=1&per_page=51', 'GET').catch(() => null)
  ]);

  // ── Render category cards from API ──
  const catGrid = document.getElementById('catCardGrid');
  if (catGrid) {
    if (catData?.success && catData.categories.length > 0) {
      catGrid.innerHTML = catData.categories.map(cat => `
        <div class="cat-card" onclick="enterCategoryView('${cat.name.replace(/'/g, "\\'")}')">
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

  // ── Render featured products from API ──
  const homeProdGrid = document.querySelector('#homeProdSection .product-grid');
  if (homeProdGrid) {
    if (prodData?.success && prodData.products.length > 0) {
      homeProdGrid.innerHTML = prodData.products.map(productCardHTML).join('');
      setTimeout(() => window.retranslateDynamic?.(), 600);
    } else {
      homeProdGrid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:36px 20px;">
          <div style="font-size:48px;margin-bottom:12px;">📦</div>
          <h3 style="margin:0 0 8px;font-family:var(--font-display);color:var(--text-main);">No products listed yet</h3>
          <p style="margin:0;color:var(--text-muted);font-size:14px;">Be the first! <a href="/vendor/signup" style="color:var(--brand);font-weight:600;text-decoration:none;">List your item →</a></p>
        </div>`;
    }
  }
}

// ── Enter category view ───────────────────────────────────────
function enterCategoryView(cat) {
  currentMode = 'filtered';
  activeFilters.category = cat;
  document.getElementById('filterCategory').value = cat;
  document.getElementById('productsTitle').textContent = cat;
  document.getElementById('productGrid').style.display = 'grid';
  renderActiveFilterChips();
  updateFilterBadge();
  loadProducts(true);
}

// ── Enter filtered view ───────────────────────────────────────
function enterFilteredView() {
  currentMode = 'filtered';
  document.getElementById('productGrid').style.display = 'grid';
  document.getElementById('productsTitle').textContent = activeFilters.category || 'Search Results';
  loadProducts(true);
}

function applyFilters() {
  enterFilteredView();
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadHomepage();
});
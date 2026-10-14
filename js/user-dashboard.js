/* ============================================================
   OLR INDIA - USER DASHBOARD JS
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
let currentUserProfile = null;
let activeFilters = {
  category: '',
  city: '',
  priceType: '',
  priceMin: 0,
  priceMax: Infinity,
};

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

// ── Tab switching ─────────────────────────────────────────────
function switchTab(name) {
  const navHighlight = (name === 'privacy' || name === 'terms') ? 'profile' : name;
  document.querySelectorAll('.nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.tab === navHighlight));
  document.querySelectorAll('.mobile-nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.tab === navHighlight));
  document.querySelectorAll('.dash-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'panel-' + name));
  document.getElementById('mobileMenu').classList.remove('open');
  history.replaceState(null, '', '#' + name);
}

document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(btn => {
  if (!btn.dataset.tab) return;
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Hamburger ─────────────────────────────────────────────────
document.getElementById('hamburgerBtn').addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── Chat tab ──────────────────────────────────────────────────
document.querySelectorAll('[data-tab="chat"]').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (currentUserProfile && !currentUserProfile.profile_complete) {
      openUserProfileCompleteModal();
      return;
    }
    switchTab('chat');
    document.getElementById('chatListBody').innerHTML = `
      <div class="chat-empty-state"><div class="icon">💬</div><h3>Loading…</h3></div>`;
    const ok = await initChatAuth('user');
    if (!ok) return;
    renderChatList();
  });
});

// ── Wishlist tab ──────────────────────────────────────────────
document.querySelectorAll('[data-tab="wishlist"]').forEach(btn => {
  btn.addEventListener('click', () => renderWishlistPanel());
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

// ── Homepage: fetch from API ──────────────────────────────────
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

  // Render categories from API
  const catGrid = document.getElementById('catCardGrid');
  if (catGrid) {
    if (catData?.success && catData.categories.length > 0) {
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

  // Render featured products from API
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

// ── Wishlist ──────────────────────────────────────────────────
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

  if (isWished) {
    const wishlistCard = document.querySelector(`#wishlistContent [onclick*="toggleWish(this,${productId})"]`)?.closest('.product-card');
    if (wishlistCard) {
      wishlistCard.style.transition = 'opacity 0.2s, transform 0.2s';
      wishlistCard.style.opacity = '0';
      wishlistCard.style.transform = 'scale(0.95)';
      setTimeout(() => {
        wishlistCard.remove();
        const remaining = document.querySelectorAll('#wishlistContent .product-card');
        if (remaining.length === 0) renderWishlistPanel();
      }, 200);
    }
  }

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

async function renderWishlistPanel() {
  const el = document.getElementById('wishlistContent');
  if (!el) return;
  el.innerHTML = `<div class="product-grid">${Array(3).fill(skeletonCardHTML()).join('')}</div>`;
  try {
    const res = await apiRequest('/auth/user/wishlist/products', 'GET');
    if (!res.success) throw new Error('Failed');
    const products = res.products ?? [];
    wishedIds.clear();
    products.forEach(p => { wishedIds.add(p.id); if (p.share_slug) wishedSlugs.set(p.id, p.share_slug); });
    updateWishlistBadge();
    if (products.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🤍</div>
          <h3>Your wishlist is empty</h3>
          <p>Tap ♡ on any product to save it here.</p>
          <button class="btn btn-primary" onclick="switchTab('browse')" style="width:auto;padding:10px 24px;display:inline-flex;margin-top:8px;">Browse products</button>
        </div>`;
      return;
    }
    el.innerHTML = `<div class="product-grid">${products.map(p => productCardHTML(p)).join('')}</div>`;
  } catch (e) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">😕</div>
        <h3>Failed to load wishlist</h3>
        <button class="btn btn-primary" onclick="renderWishlistPanel()" style="width:auto;padding:10px 24px;display:inline-flex;margin-top:8px;">Retry</button>
      </div>`;
  }
}

async function loadWishlist() {
  const res = await apiRequest('/auth/user/wishlist', 'GET');
  if (!res.success) return;
  wishedIds.clear(); wishedSlugs.clear();
  res.wishlist.forEach(i => { wishedIds.add(i.product_id); if (i.share_slug) wishedSlugs.set(i.product_id, i.share_slug); });
  updateWishlistBadge();
  document.querySelectorAll('.product-wish-btn').forEach(btn => {
    const match = btn.getAttribute('onclick')?.match(/toggleWish\(this,(\d+)\)/);
    if (!match) return;
    const id = parseInt(match[1]);
    btn.classList.toggle('active', wishedIds.has(id));
    btn.textContent = wishedIds.has(id) ? '♥' : '♡';
  });
}

// ── Profile ───────────────────────────────────────────────────
function renderAvatarHTML(name, photoUrl, size) {
  const cls = size === 'big' ? 'avatar-img-big' : 'avatar-img-sm';
  return photoUrl
    ? `<img class="${cls}" src="${photoUrl}" alt="${name || ''}">`
    : `<span>${getInitials(name)}</span>`;
}

async function loadUserProfile() {
  const res = await apiRequest('/auth/user/profile', 'GET');
  if (!res.success) { toastError(res.message || 'Failed to load profile.'); return; }
  currentUserProfile = res.user;
  const u = res.user;

  const avatarImg = document.getElementById('profileAvatarImg');
  const avatarBig = document.getElementById('profileAvatar');
  const removeBtn = document.getElementById('profileAvatarRemoveBtn');

  if (u.profile_photo) {
    avatarImg.src = u.profile_photo;
    avatarImg.style.display = 'block';
    avatarBig.style.display = 'none';
    removeBtn.style.display = 'inline-block';
  } else {
    avatarImg.style.display = 'none';
    avatarBig.style.display = 'flex';
    avatarBig.textContent = getInitials(u.name);
    removeBtn.style.display = 'none';
  }

  document.getElementById('navUserAvatar').innerHTML = renderAvatarHTML(u.name, u.profile_photo, 'sm');
  document.getElementById('navUserAvatarMobile').innerHTML = renderAvatarHTML(u.name, u.profile_photo, 'sm');
  document.getElementById('navUserName').textContent = u.name || '';
  document.getElementById('navUserNameMobile').textContent = u.name || '';
  document.getElementById('profileName').textContent = u.name || '';
  document.getElementById('profileEmail').textContent = u.email || '';
  document.getElementById('infoEmail').textContent = u.email || '';
  document.getElementById('editName').value = u.name || '';
  document.getElementById('editMobile').value = u.mobile || '';
  document.getElementById('editPincode').value = u.pincode || '';
  document.getElementById('editArea').value = u.area || '';
  document.getElementById('editCity').value = u.city || '';
  document.getElementById('editState').value = u.state || '';
}

document.getElementById('profileAvatarEditBtn')?.addEventListener('click', () => {
  document.getElementById('profilePhotoInput').click();
});

document.getElementById('profileAvatarRemoveBtn')?.addEventListener('click', async () => {
  const confirmed = await showConfirm({
    title: 'Remove profile photo?',
    text: 'Your profile will show your initials instead.',
    confirmLabel: 'Remove', cancelLabel: 'Cancel',
  });
  if (!confirmed) return;
  const res = await apiRequest('/auth/user/profile/photo', 'DELETE');
  if (res.success) { toastSuccess('Profile photo removed.'); await loadUserProfile(); }
  else toastError(res.message || 'Failed to remove photo.');
});

document.getElementById('profilePhotoInput')?.addEventListener('change', async function () {
  const file = this.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('photo', file);
  const resp = await fetch(API_BASE + '/auth/user/profile/photo', { method: 'PUT', body: fd, credentials: 'include' });
  const res = await resp.json();
  if (res.success) { toastSuccess('Profile photo updated!'); await loadUserProfile(); }
  else toastError(res.message || 'Failed to update photo.');
  this.value = '';
});

document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.classList.add('loading');
  const payload = {
    name: document.getElementById('editName').value.trim(),
    mobile: document.getElementById('editMobile').value.trim(),
    pincode: document.getElementById('editPincode').value.trim(),
    area: document.getElementById('editArea').value.trim(),
    city: document.getElementById('editCity').value.trim(),
    state: document.getElementById('editState').value.trim(),
  };
  const res = await apiRequest('/auth/user/profile', 'PUT', payload);
  btn.classList.remove('loading');
  if (res.success) { toastSuccess('Profile updated!'); await loadUserProfile(); }
  else toastError(res.message || 'Failed to update profile.');
});

// ── Pincode autofill ──────────────────────────────────────────
const profileFormEl = document.getElementById('profileForm');
if (profileFormEl) {
  wirePincodeAutofill({
    pincodeInput: profileFormEl.pincode,
    stateInput: profileFormEl.state,
    cityInput: profileFormEl.city,
    areaInput: profileFormEl.area,
    statusEl: profileFormEl.querySelector('.pincode-status'),
  });
}

// ── Profile complete modal ────────────────────────────────────
function openUserProfileCompleteModal() {
  const existing = document.getElementById('userProfileCompleteModal');
  if (existing) { existing.style.display = 'flex'; return; }

  const modal = document.createElement('div');
  modal.id = 'userProfileCompleteModal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;`;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px 24px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <div style="font-size:32px;text-align:center;margin-bottom:12px;">👤</div>
      <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;text-align:center;font-family:'Poppins',sans-serif;">Complete your profile first</h3>
      <p style="margin:0 0 20px;font-size:13.5px;color:#6b7280;text-align:center;line-height:1.5;">Add your mobile and city so vendors can reach you back.</p>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
        <input id="upcMobile" type="tel" maxlength="10" placeholder="Mobile number (10 digits)" style="padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;">
        <input id="upcPincode" type="text" maxlength="6" placeholder="Pincode (optional)" style="padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;">
        <input id="upcCity" type="text" placeholder="City" style="padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;">
      </div>
      <button id="upcSaveBtn" style="width:100%;padding:13px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;margin-bottom:10px;">Save &amp; open chat</button>
      <button onclick="document.getElementById('userProfileCompleteModal').style.display='none'" style="width:100%;padding:10px;background:none;border:none;color:#9ca3af;font-size:13px;cursor:pointer;">Maybe later</button>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('upcPincode').addEventListener('input', async function () {
    if (this.value.length !== 6) return;
    try {
      const r = await fetch(`https://api.postalpincode.in/pincode/${this.value}`);
      const d = await r.json();
      if (d[0].Status === 'Success') {
        const po = d[0].PostOffice[0];
        document.getElementById('upcCity').value = po.District || po.Block || '';
      }
    } catch { }
  });

  document.getElementById('upcSaveBtn').addEventListener('click', async () => {
    const mobile = document.getElementById('upcMobile').value.trim();
    const city = document.getElementById('upcCity').value.trim();
    const pincode = document.getElementById('upcPincode').value.trim();
    if (!mobile || !city) { toastError('Please fill in mobile and city.'); return; }
    if (mobile.length !== 10) { toastError('Mobile must be 10 digits.'); return; }
    const res = await apiRequest('/auth/user/profile', 'PUT', { mobile, city, pincode });
    if (res.success) {
      toastSuccess('Profile saved!');
      modal.style.display = 'none';
      if (currentUserProfile) { currentUserProfile.profile_complete = true; currentUserProfile.mobile = mobile; currentUserProfile.city = city; }
      document.getElementById('editMobile').value = mobile;
      document.getElementById('editCity').value = city;
      if (pincode) document.getElementById('editPincode').value = pincode;
      openChatOverlay();
      document.getElementById('chatListBody').innerHTML = `<div class="chat-empty-state"><div class="icon">💬</div><h3>Loading…</h3></div>`;
      const ok = await initChatAuth('user');
      if (!ok) return;
      renderChatList();
    } else {
      toastError(res.message || 'Failed to save. Please try again.');
    }
  });

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
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

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadBrowseHomepage();
  loadWishlist().catch(err => console.error('Wishlist load failed:', err));
  initChatAuth('user').then(ok => { if (ok) listenToUnreadBadge(); });
  loadUserProfile().then(() => {
    if (!currentUserProfile) return;
    const savedUserId = currentUserProfile.id;
    localStorage.setItem('olr_user_session', savedUserId);
    window.addEventListener('storage', (e) => {
      if (e.key === 'olr_user_session' && e.newValue !== String(savedUserId)) {
        clearSessionAccount('user');
        window.location.href = '/user/login';
      }
    });
  });
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      const res = await apiRequest('/auth/user/profile', 'GET');
      if (!res.success && res.httpStatus === 401) {
        clearSessionAccount('user');
        window.location.href = '/user/login';
      }
    }
  });
  const hashRaw = location.hash.replace('#', '');
  const savedTab = hashRaw.split('=')[0];
  const validTabs = ['browse', 'wishlist', 'chat', 'profile', 'privacy', 'terms'];
  if (validTabs.includes(savedTab)) switchTab(savedTab);
  if (savedTab === 'chat') {
    (async () => {
      const ok = await initChatAuth('user');
      if (!ok) return;
      openChatOverlay();
      const convIdFromHash = hashRaw.split('=')[1];
      if (convIdFromHash) openThread(convIdFromHash);
      else renderChatList();
    })();
  }
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    loadBrowseProducts(true);
    loadWishlist().catch(err => console.error('Wishlist load failed:', err));
  }
  const wishlistPanel = document.getElementById('panel-wishlist');
  if (wishlistPanel?.classList.contains('active')) renderWishlistPanel();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 860) document.getElementById('mobileMenu').classList.remove('open');
});
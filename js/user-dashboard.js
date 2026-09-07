/* ============================================================
   OLR INDIA - USER DASHBOARD JS
   Browse/filter logic mirrors index.js. Wishlist is backend-synced
   (logged-in users). Chat tab is a placeholder until chat ships.
   ============================================================ */
// ── Chat tab entry point ────────────────────────────────────────
document.querySelectorAll('[data-tab="chat"]').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (currentUserProfile && !currentUserProfile.profile_complete) {
      openUserProfileCompleteModal();
      return;
    }
    switchTab('chat');  // just switch tab, no openChatOverlay()
    document.getElementById('chatListBody').innerHTML = `
      <div class="chat-empty-state"><div class="icon">💬</div><h3>Loading…</h3></div>`;
    const ok = await initChatAuth('user');
    if (!ok) return;
    renderChatList();
  });
});
function slugify(text) {
  return (text || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
document.querySelectorAll('[data-tab="wishlist"]').forEach(btn => {
  btn.addEventListener('click', () => renderWishlistPanel());
});
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
document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(btn => {
  if (!btn.dataset.tab) return;
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Hamburger ─────────────────────────────────────────────────
document.getElementById('hamburgerBtn').addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.toggle('open');
});

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
  priceType: 'day',
  priceMin: 0,
  priceMax: Infinity,
};

// ── Filter sheet open/close ─────────────────────────────────────
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
  if (!navigator.geolocation) {
    toastError('Your browser does not support location.');
    return;
  }
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
      if (city) {
        document.getElementById('filterCity').value = city;
      } else {
        toastError("Couldn't determine your city from that location.");
      }
    } catch (e) {
      toastError('Location lookup failed. Please try again.');
    } finally {
      locateBtn.disabled = false;
      locateBtn.style.opacity = '1';
    }
  }, (err) => {
    console.error('Geolocation error:', err.code, err.message);
    const messages = {
      1: 'Location permission denied. Enable it in browser settings.',
      2: 'Location unavailable right now. Try again.',
      3: 'Location request timed out. Try again.',
    };
    toastError(messages[err.code] || 'Could not get your location.');
    locateBtn.disabled = false;
    locateBtn.style.opacity = '1';
  });
});

// Apply
document.getElementById('filterApplyBtn').addEventListener('click', () => {
  const selectedType = document.querySelector('.price-type-btn.active')?.dataset.type || '';
  const priceMin = parseFloat(document.getElementById('filterPriceMin').value) || 0;
  const priceMax = parseFloat(document.getElementById('filterPriceMax').value) || Infinity;
  const hint = document.getElementById('filterPriceHint');

  if (selectedType && priceMin === 0 && priceMax === Infinity) {
    hint.textContent = 'Please enter a min or max price.';
    hint.classList.add('error');
    document.getElementById('filterPriceMin').classList.add('error');
    document.getElementById('filterPriceMax').classList.add('error');
    return;
  }

  if (!selectedType && (priceMin > 0 || priceMax < Infinity)) {
    hint.textContent = 'Please select Hour / Km / Day / Month first.';
    hint.classList.add('error');
    return;
  }

  hint.textContent = 'Enter a min or max to filter by price.';
  hint.classList.remove('error');
  document.getElementById('filterPriceMin').classList.remove('error');
  document.getElementById('filterPriceMax').classList.remove('error');

  activeFilters.category = document.getElementById('filterCategory').value;
  activeFilters.city = document.getElementById('filterCity').value.trim().toLowerCase();
  activeFilters.priceType = selectedType || 'day';
  activeFilters.priceMin = priceMin;
  activeFilters.priceMax = priceMax;
  closeFilterSheet();
  applyFilters();
  renderActiveFilterChips();
});

// Clear
document.getElementById('filterClearBtn').addEventListener('click', () => {
  document.getElementById('filterCategory').value = '';
  document.getElementById('filterCity').value = '';
  document.getElementById('filterPriceMin').value = '';
  document.getElementById('filterPriceMax').value = '';
  document.querySelectorAll('.price-type-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  activeFilters = { category: '', city: '', priceType: 'day', priceMin: 0, priceMax: Infinity };
  closeFilterSheet();
  loadBrowseHomepage();
  renderActiveFilterChips();
});

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

// ── Load products ────────────────────────────────────────────
function showSkeletons(count) {
  const card = `
    <div class="skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton-line skeleton-line-sm"></div>
        <div class="skeleton-line skeleton-line-md"></div>
        <div class="skeleton-line skeleton-line-lg"></div>
        <div class="skeleton-line skeleton-line-xs"></div>
      </div>
    </div>`;
  document.getElementById('productGrid').innerHTML = Array(count).fill(card).join('');
}

async function loadBrowseProducts(reset = true) {
  if (reset) {
    currentPage = 1;
    allProducts = [];
    displayedCount = 0;
    showSkeletons(20);
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

async function appendNextBatch() {
  if (isLoadingMore || !hasMore) return;
  isLoadingMore = true;
  document.getElementById('scrollSentinel')?.remove();
  document.querySelector('.scroll-end-msg')?.remove();

  const grid = document.getElementById('productGrid');
  const skeletonWrapper = document.createElement('div');
  skeletonWrapper.id = 'skeletonBatch';
  skeletonWrapper.style.cssText = 'display:contents';
  skeletonWrapper.innerHTML = Array(10).fill(`
    <div class="skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton-line skeleton-line-sm"></div>
        <div class="skeleton-line skeleton-line-md"></div>
        <div class="skeleton-line skeleton-line-lg"></div>
        <div class="skeleton-line skeleton-line-xs"></div>
      </div>
    </div>`).join('');
  grid.appendChild(skeletonWrapper);

  currentPage++;
  const params = new URLSearchParams({ page: currentPage, per_page: 10 });
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

function attachSentinel() {
  if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
  sentinel?.remove();
  const grid = document.getElementById('productGrid');
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

// ── Filters ───────────────────────────────────────────────────
// REPLACE applyFilters entirely:
function applyFilters() {
  // Hide homepage section, show product grid
  const homeSection = document.getElementById('browseHomeSection');
  if (homeSection) homeSection.style.display = 'none';
  document.getElementById('productGrid').style.display = 'grid';

  // Update title
  if (activeFilters.category) {
    document.getElementById('productsTitle').textContent = activeFilters.category;
  } else {
    const q = document.getElementById('searchInput').value.trim();
    document.getElementById('productsTitle').textContent = q ? 'Search Results' : 'All Products';
  }

  loadBrowseProducts(true);
}

function getPriceForType(p, type) {
  if (type === 'hour') return parseFloat(p.rent_per_hour);
  if (type === 'km') return parseFloat(p.rent_per_km);
  if (type === 'day') return parseFloat(p.rent_per_day);
  if (type === 'month') return parseFloat(p.rent_per_month);
  return null;
}

function planRank(plan) {
  return { premium: 0, growth: 1, starter: 2, free: 3, trial: 3 }[plan] ?? 3;
}

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
  if (key === 'price') { activeFilters.priceMin = 0; activeFilters.priceMax = Infinity; document.getElementById('filterPriceMin').value = ''; document.getElementById('filterPriceMax').value = ''; }
  renderActiveFilterChips();
  updateFilterBadge();
  const hasAny = activeFilters.category || activeFilters.city || activeFilters.priceMin > 0 || activeFilters.priceMax < Infinity || document.getElementById('searchInput').value.trim();
  if (!hasAny) { loadBrowseHomepage(); } else { applyFilters(); }
}

// ── Render grid ───────────────────────────────────────────────
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

function productCardHTML(p) {
  if (p.id && p.share_slug) wishedSlugs.set(p.id, p.share_slug);
  const img = p.images && p.images[0]
    ? `<img class="product-img" src="${p.images[0]}" alt="${p.name}" loading="lazy">`
    : `<div class="product-img-placeholder">${catEmoji(p.category)}</div>`;

  const price = buildPriceLabel(p);
  const wished = wishedIds.has(p.id);

  const badge = p.vendor_badge === 'featured'
    ? `<span class="vendor-badge badge-premium">★ Top Vendor</span>`
    : p.vendor_badge === 'verified'
      ? `<span class="vendor-badge badge-growth">✓ Verified</span>`
      : '';

  return `
    <div class="product-card" onclick="openProduct('${p.share_slug}')">
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

function buildPriceLabel(p) {
  const type = activeFilters.priceType;
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

function catEmoji(cat) {
  const m = {
    'Construction Equipment': '🏗️', 'Furniture & Home Appliances': '🪑', 'Party & Celebration Decor': '🎈', 'Photography & Content Creator Gear': '📸',
    'Events & Weddings': '🎉', 'Fashion & Designer Wear': '👗', 'Agricultural Equipment': '🌾', 'Passenger Vehicles': '🚗',
    'Bikes & Scooters': '🏍️', 'Medical Equipment': '🩺', 'Baby & Kids Gear': '👶', 'Adventure & Trekking Gear': '🏕️',
    'Sports & Fitness Equipment': '🏋️', 'Electrical & Power Tools': '⚡', 'Commercial Vehicles': '🚛', 'Tools & Tackles': '🛠️',
    'Properties': '🏢', 'Industrial Equipment': '⚙️', 'Warehouse & Storage': '🏭', 'Cargo & Shipping': '📦',
    'Machineries': '🔧', 'Residential Properties': '🏠', 'Musical Instruments': '🎵'
  };
  return m[cat] || '📦';
}

function openProduct(slug) {
  if (!slug) return;
  // find product from allProducts to get category and city
  const p = allProducts.find(x => x.share_slug === slug) || filteredProducts.find(x => x.share_slug === slug);
  const cat = slugify(p?.category || '');
  const city = slugify(p?.city || 'india');
  window.location.href = `/product/${cat}/${city}/${slug}`;
}

function clearAllFilters() {
  activeFilters = { category: '', city: '', priceType: 'day', priceMin: 0, priceMax: Infinity };
  document.getElementById('searchInput').value = '';
  document.getElementById('filterCategory').value = '';
  document.getElementById('filterCity').value = '';
  document.getElementById('filterPriceMin').value = '';
  document.getElementById('filterPriceMax').value = '';
  document.querySelectorAll('.price-type-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  renderActiveFilterChips();
  updateFilterBadge();
  loadBrowseHomepage();
}

// ── Wishlist (backend-synced) ───────────────────────────────────
async function toggleWish(btn, productId) {
  const isWished = wishedIds.has(productId);

  // 1. Update wishedIds SET immediately (this was missing!)
  if (isWished) {
    wishedIds.delete(productId);
    toastSuccess('Removed from wishlist');
  } else {
    wishedIds.add(productId);
    toastSuccess('Added to wishlist');
  }

  // 2. Sync ALL heart buttons for this product immediately
  document.querySelectorAll('.product-wish-btn').forEach(b => {
    const match = b.getAttribute('onclick')?.match(/toggleWish\(this,(\d+)\)/);
    if (match && parseInt(match[1]) === productId) {
      b.classList.toggle('active', !isWished);
      b.textContent = isWished ? '♡' : '♥';
    }
  });
  updateWishlistBadge();

  // 3. If we're on wishlist panel, remove the card immediately (no re-fetch)
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
    } else {
      const wishlistPanel = document.getElementById('panel-wishlist');
      if (wishlistPanel?.classList.contains('active')) renderWishlistPanel();
    }
  }

  // 4. Sync to backend (fire and forget, UI already updated)
  try {
    if (isWished) {
      await apiRequest(`/auth/user/wishlist/${productId}`, 'DELETE');
    } else {
      await apiRequest('/auth/user/wishlist', 'POST', { product_id: productId });
    }
  } catch (e) {
    // Rollback on failure
    if (isWished) {
      wishedIds.add(productId);
    } else {
      wishedIds.delete(productId);
    }
    // Re-sync UI back
    document.querySelectorAll('.product-wish-btn').forEach(b => {
      const match = b.getAttribute('onclick')?.match(/toggleWish\(this,(\d+)\)/);
      if (match && parseInt(match[1]) === productId) {
        b.classList.toggle('active', isWished);
        b.textContent = isWished ? '♥' : '♡';
      }
    });
    updateWishlistBadge();
    toastError('Failed to update wishlist. Please try again.');
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

    // Sync wishedIds from fresh data
    wishedIds.clear();
    products.forEach(p => {
      wishedIds.add(p.id);
      if (p.share_slug) wishedSlugs.set(p.id, p.share_slug);
    });
    updateWishlistBadge();

    if (products.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🤍</div>
          <h3>Your wishlist is empty</h3>
          <p>Tap ♡ on any product to save it here.</p>
          <button class="btn btn-primary" onclick="switchTab('browse')"
            style="width:auto;padding:10px 24px;display:inline-flex;margin-top:8px;">
            Browse products
          </button>
        </div>`;
      return;
    }

    el.innerHTML = `<div class="product-grid">${products.map(p => productCardHTML(p)).join('')}</div>`;

  } catch (e) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">😕</div>
        <h3>Failed to load wishlist</h3>
        <p>Please try again.</p>
        <button class="btn btn-primary" onclick="renderWishlistPanel()"
          style="width:auto;padding:10px 24px;display:inline-flex;margin-top:8px;">
          Retry
        </button>
      </div>`;
  }
}

async function loadWishlist() {
  const res = await apiRequest('/auth/user/wishlist', 'GET'); // lightweight
  if (!res.success) return;

  wishedIds.clear();
  wishedSlugs.clear();
  res.wishlist.forEach(i => {
    wishedIds.add(i.product_id);
    if (i.share_slug) wishedSlugs.set(i.product_id, i.share_slug);
  });
  updateWishlistBadge();

  document.querySelectorAll('.product-wish-btn').forEach(btn => {
    const match = btn.getAttribute('onclick')?.match(/toggleWish\(this,(\d+)\)/);
    if (!match) return;
    const id = parseInt(match[1]);
    btn.classList.toggle('active', wishedIds.has(id));
    btn.textContent = wishedIds.has(id) ? '♥' : '♡';
  });
}

function renderAvatarHTML(name, photoUrl, size) {
  const cls = size === 'big' ? 'avatar-img-big' : 'avatar-img-sm';
  return photoUrl
    ? `<img class="${cls}" src="${photoUrl}" alt="${name || ''}">`
    : `<span>${getInitials(name)}</span>`;
}

function openUserProfileCompleteModal() {
  const existing = document.getElementById('userProfileCompleteModal');
  if (existing) { existing.style.display = 'flex'; return; }

  const modal = document.createElement('div');
  modal.id = 'userProfileCompleteModal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.5);
    z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;
  `;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px 24px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <div style="font-size:32px;text-align:center;margin-bottom:12px;">👤</div>
      <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;text-align:center;font-family:'Poppins',sans-serif;">Complete your profile first</h3>
      <p style="margin:0 0 20px;font-size:13.5px;color:#6b7280;text-align:center;line-height:1.5;">
        Add your mobile and city so vendors can reach you back.
      </p>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
        <input id="upcMobile" type="tel" maxlength="10" placeholder="Mobile number (10 digits)"
          style="padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;font-family:'Inter',sans-serif;">
        <input id="upcPincode" type="text" maxlength="6" placeholder="Pincode (optional - auto fills city)"
          style="padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;font-family:'Inter',sans-serif;">
        <input id="upcCity" type="text" placeholder="City"
          style="padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;font-family:'Inter',sans-serif;">
      </div>
      <button id="upcSaveBtn" style="width:100%;padding:13px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;font-family:'Poppins',sans-serif;margin-bottom:10px;">
        Save &amp; open chat
      </button>
      <button onclick="document.getElementById('userProfileCompleteModal').style.display='none'"
        style="width:100%;padding:10px;background:none;border:none;color:#9ca3af;font-size:13px;cursor:pointer;">
        Maybe later
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  // Pincode autofill
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
      toastSuccess('Profile saved!');
      modal.style.display = 'none';
      // Update local profile so modal never shows again this session
      if (currentUserProfile) {
        currentUserProfile.profile_complete = true;
        currentUserProfile.mobile = mobile;
        currentUserProfile.city = city;
      }
      // Also update profile form fields
      document.getElementById('editMobile').value = mobile;
      document.getElementById('editCity').value = city;
      if (pincode) document.getElementById('editPincode').value = pincode;
      // Now open chat
      openChatOverlay();
      document.getElementById('chatListBody').innerHTML = `
        <div class="chat-empty-state"><div class="icon">💬</div><h3>Loading…</h3></div>`;
      const ok = await initChatAuth('user');
      if (!ok) return;
      renderChatList();
    } else {
      toastError(res.message || 'Failed to save. Please try again.');
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });
}

// ── Pincode autofill on profile form ────────────────────────────
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

let currentUserProfile = null;

async function loadUserProfile() {
  const res = await apiRequest('/auth/user/profile', 'GET');
  if (!res.success) {
    toastError(res.message || 'Failed to load profile.');
    return;
  }
  currentUserProfile = res.user;
  const u = res.user;
  const initials = getInitials(u.name);

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
    avatarBig.textContent = initials;
    removeBtn.style.display = 'none';
  }

  // Nav avatar/name
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
    confirmLabel: 'Remove',
    cancelLabel: 'Cancel',
  });
  if (!confirmed) return;
  const res = await apiRequest('/auth/user/profile/photo', 'DELETE');
  if (res.success) {
    toastSuccess('Profile photo removed.');
    await loadUserProfile();
  } else {
    toastError(res.message || 'Failed to remove photo.');
  }
});

document.getElementById('profilePhotoInput')?.addEventListener('change', async function () {
  const file = this.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('photo', file);
  const resp = await fetch(API_BASE + '/auth/user/profile/photo', {
    method: 'PUT', body: fd, credentials: 'include'
  });
  const res = await resp.json();
  if (res.success) {
    toastSuccess('Profile photo updated!');
    await loadUserProfile();
  } else {
    toastError(res.message || 'Failed to update photo.');
  }
  this.value = '';
});

// Save profile form
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

  if (res.success) {
    toastSuccess('Profile updated!');
    await loadUserProfile();
  } else {
    toastError(res.message || 'Failed to update profile.');
  }
});
// ── Logout ────────────────────────────────────────────────────
["logoutBtn", "logoutBtnMobile"].forEach(id => {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const confirmed = await showConfirm({
      title: "Log out?",
      text: "You'll need to sign in again to access your account.",
      confirmLabel: "Log out",
      cancelLabel: "Stay logged in",
    });
    if (!confirmed) return;
    await apiRequest("/auth/user/logout", "POST");
    clearSessionAccount("user");
    window.location.href = "/user/login";
  });
});
// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Independent calls - one failing must never block the other.
  loadBrowseHomepage();
  loadWishlist().catch(err => console.error('Wishlist load failed:', err));
  initChatAuth('user').then(ok => { if (ok) listenToUnreadBadge(); });
  loadUserProfile().then(() => {
    if (!currentUserProfile) return;
    const savedUserId = currentUserProfile.id;
    localStorage.setItem('olr_user_session', savedUserId);
    window.addEventListener("storage", (e) => {
      if (e.key === "olr_user_session" && e.newValue !== String(savedUserId)) {
        clearSessionAccount("user");
        window.location.href = "/user/login";
      }
    });
  });
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible") {
      const res = await apiRequest("/auth/user/profile", "GET");
      if (!res.success && res.httpStatus === 401) {
        clearSessionAccount("user");
        window.location.href = "/user/login";
      }
    }
  });
  // ── Restore tab (and open chat thread) from URL hash on refresh ──
  const hashRaw = location.hash.replace('#', '');
  const savedTab = hashRaw.split('=')[0];
  const validTabs = ['browse', 'wishlist', 'chat', 'profile', 'privacy', 'terms'];

  if (validTabs.includes(savedTab)) {
    switchTab(savedTab);
  }

  if (savedTab === 'chat') {
    (async () => {
      const ok = await initChatAuth('user');
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
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    loadBrowseProducts(true);
    loadWishlist().catch(err => console.error('Wishlist load failed:', err));
  }
  // Always re-render wishlist if it's the active tab (handles back from p.html)
  const wishlistPanel = document.getElementById('panel-wishlist');
  if (wishlistPanel?.classList.contains('active')) {
    renderWishlistPanel();
  }
});
window.addEventListener('resize', () => {
  if (window.innerWidth > 860) {
    document.getElementById('mobileMenu').classList.remove('open');
  }
});
function catImg(cat) {
  const m = {
    'Construction Equipment': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80',
    'Furniture & Home Appliances': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80',
    'Party & Celebration Decor': '../assets/categories/PartyCelebrationDecor.png',
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
    'Residential Properties': '../assets/categories/Residential Properties.png',
    'Musical Instruments': '../assets/categories/Musical Instruments.png',
  };
  return m[cat] || '';
}

function catColor(cat) {
  const m = {
    'Construction Equipment': { main: '#F59E0B', bg: '#FFFBEB' },
    'Furniture & Home Appliances': { main: '#8B5CF6', bg: '#F5F3FF' },
    'Party & Celebration Decor': { main: '#F97316', bg: '#FFF7ED' },
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
    'Residential Properties': { main: '#6366F1', bg: '#EEF2FF' },
    'Musical Instruments': { main: '#EC4899', bg: '#FDF2F8' },
  };
  return m[cat] || { main: '#3B82F6', bg: '#EFF6FF' };
}

const CATEGORIES = [
  'Construction Equipment', 'Furniture & Home Appliances', 'Party & Celebration Decor', 'Photography & Content Creator Gear',
  'Events & Weddings', 'Fashion & Designer Wear', 'Agricultural Equipment', 'Passenger Vehicles', 'Bikes & Scooters',
  'Medical Equipment', 'Baby & Kids Gear', 'Adventure & Trekking Gear', 'Sports & Fitness Equipment', 'Electrical & Power Tools',
  'Commercial Vehicles', 'Tools & Tackles', 'Properties', 'Industrial Equipment', 'Warehouse & Storage', 'Cargo & Shipping',
  'Machineries', 'Residential Properties', 'Musical Instruments'
];

async function loadBrowseHomepage() {
  const grid = document.getElementById('productGrid');
  const countEl = document.getElementById('productsCount');
  countEl.textContent = '';
  document.getElementById('browseBackBtn')?.remove();
  grid.style.display = 'none';
  const browsePanel = document.querySelector('#panel-browse');
  let homeSection = document.getElementById('browseHomeSection');
  if (!homeSection) {
    homeSection = document.createElement('div');
    homeSection.id = 'browseHomeSection';
    grid.parentNode.insertBefore(homeSection, grid);
  }
  homeSection.style.display = 'block';
  homeSection.innerHTML = `
    <div id="catCardGrid" class="cat-card-grid">
      ${CATEGORIES.map(cat => {
    const color = catColor(cat);
    return `<div class="cat-card" style="--cat-color:${color.main};--cat-bg:${color.bg};">
          <div class="skeleton-img" style="height:100%;aspect-ratio:4/3;"></div>
        </div>`;
  }).join('')}
    </div>
    <div id="homeProdSection">
      <div class="home-prod-title">Featured Products</div>
      <div class="product-grid" id="homeProdGrid">
        ${Array(8).fill(skeletonCardHTML()).join('')}
      </div>
    </div>`;

  const [catResults, prodData] = await Promise.all([
    Promise.allSettled(
      CATEGORIES.map(cat =>
        apiRequest(`/products/public?page=1&per_page=1&category=${encodeURIComponent(cat)}`, 'GET')
      )
    ),
    apiRequest('/products/public?page=1&per_page=20', 'GET').catch(() => null)
  ]);

  const catGrid = document.getElementById('catCardGrid');
  if (catGrid) {
    const catCards = CATEGORIES.map((cat, i) => {
      const res = catResults[i];
      const hasProducts = res.status === 'fulfilled' && res.value.success && res.value.total > 0;
      if (!hasProducts) return '';
      const color = catColor(cat);
      const img = catImg(cat);
      return `
        <div class="cat-card" style="--cat-color:${color.main};--cat-bg:${color.bg};" onclick="enterBrowseCategory('${cat.replace(/'/g, "\\'")}')">
          ${img ? `<img class="cat-card-img" src="${img}" alt="${cat}">` : ''}
          <div class="cat-card-name">${cat}</div>
        </div>`;
    }).join('');

    catGrid.innerHTML = catCards.trim()
      ? catCards
      : `<div style="grid-column:1/-1;text-align:center;padding:36px 20px;">
          <div style="font-size:48px;margin-bottom:12px;">🏪</div>
          <h3 style="margin:0 0 8px;font-family:var(--font-display);color:var(--text-main);">No categories live yet</h3>
          <p style="margin:0;color:var(--text-muted);font-size:14px;">Vendors are setting up -products will appear here soon.</p>
        </div>`;
  }

  const homeProdGrid = document.getElementById('homeProdGrid');
  if (homeProdGrid) {
    if (prodData?.success && prodData.products.length > 0) {
      homeProdGrid.innerHTML = prodData.products.map(p => productCardHTML(p)).join('');
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

function enterBrowseCategory(cat) {
  activeFilters.category = cat;
  document.getElementById('filterCategory').value = cat;
  document.getElementById('productsCount') && (document.getElementById('productsCount').textContent = '');
  const homeSection = document.getElementById('browseHomeSection');
  if (homeSection) homeSection.style.display = 'none';
  document.getElementById('productGrid').style.display = 'grid';
  renderActiveFilterChips();
  updateFilterBadge();
  loadBrowseProducts(true);
}

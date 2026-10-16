/* ============================================================
   OLR INDIA – VENDOR BROWSE JS  (browse.html)
   ============================================================ */

let vendorProfile = null;

// ── State ─────────────────────────────────────────────────────
let vsAllProducts = [];
let vsFilteredProducts = [];
let vsCurrentPage = 1;
let vsTotalProducts = 0;
let vsHasMore = false;
let vsIsLoadingMore = false;
let vsSentinel = null;
let vsScrollObserver = null;
let vsActiveFilters = { category:'', city:'', priceType:'', priceMin:0, priceMax:Infinity };

function vsPopulateCategoryDropdown(categories) {
  const sel = document.getElementById('vsFilterCategory');
  if (!sel) return;
  sel.innerHTML = '<option value="">All categories</option>' +
    categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function slugify(text) {
  return (text || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Nav avatar ────────────────────────────────────────────────
function renderNavAvatar() {
  if (!vendorProfile) return;
  const initial = getInitials(vendorProfile.name || 'V');
  ['navUserAvatar', 'navUserAvatarMobile'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = vendorProfile.profile_photo ? `<img src="${vendorProfile.profile_photo}" alt="">` : initial;
  });
  const nameEl = document.getElementById('navUserName');
  const nameElM = document.getElementById('navUserNameMobile');
  if (nameEl) nameEl.textContent = vendorProfile.name || '';
  if (nameElM) nameElM.textContent = vendorProfile.name || '';
}

async function loadVendorProfile() {
  const res = await apiRequest('/auth/vendor/profile', 'GET');
  if (!res.success) return;
  vendorProfile = res.vendor;
  renderNavAvatar();
}

// ── Skeleton ──────────────────────────────────────────────────
function vsSkeletonCardHTML() {
  return `<div class="vendor-skeleton-card">
    <div class="vendor-skeleton-img"></div>
    <div class="vendor-skeleton-body">
      <div class="vendor-skeleton-line vendor-skeleton-line-sm"></div>
      <div class="vendor-skeleton-line vendor-skeleton-line-md"></div>
      <div class="vendor-skeleton-line vendor-skeleton-line-lg"></div>
      <div class="vendor-skeleton-line vendor-skeleton-line-xs"></div>
    </div>
  </div>`;
}

// ── Product card ──────────────────────────────────────────────
function vsProductCardHTML(p) {
  const img = p.images && p.images[0]
    ? `<img class="vendor-product-img" src="${p.images[0]}" alt="${p.name}" loading="lazy">`
    : `<div class="vendor-product-img-placeholder">📦</div>`;
  const price = vsBuildPriceLabel(p);
  const badge = p.vendor_badge === 'featured'
    ? `<span class="vendor-browse-badge vendor-browse-badge-premium">★ Top Vendor</span>`
    : p.vendor_badge === 'verified'
      ? `<span class="vendor-browse-badge vendor-browse-badge-growth">✓ Verified</span>`
      : '';
  return `
    <div class="vendor-product-card" onclick="window.location.href='/product/${slugify(p.category)}/${slugify(p.city || 'india')}/${p.share_slug}'">
      ${img}${badge}
      <div class="vendor-product-body">
        <div class="vendor-product-cat">${p.category || ''}</div>
        <div class="vendor-product-title">${p.name}</div>
        <div class="vendor-product-bottom">
          <div class="vendor-product-price">${price}</div>
          <div class="vendor-product-loc">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z" stroke="currentColor" stroke-width="2"/></svg>
            ${p.city || ''}
          </div>
        </div>
      </div>
    </div>`;
}

function vsBuildPriceLabel(p) {
  const type = vsActiveFilters.priceType;
  if (type === 'hour'  && p.rent_per_hour)  return `₹${p.rent_per_hour} <span>/ hour</span>`;
  if (type === 'km'    && p.rent_per_km)    return `₹${p.rent_per_km} <span>/ km</span>`;
  if (type === 'day'   && p.rent_per_day)   return `₹${p.rent_per_day} <span>/ day</span>`;
  if (type === 'month' && p.rent_per_month) return `₹${p.rent_per_month} <span>/ month</span>`;
  if (p.rent_per_day)   return `₹${p.rent_per_day} <span>/ day</span>`;
  if (p.rent_per_hour)  return `₹${p.rent_per_hour} <span>/ hour</span>`;
  if (p.rent_per_month) return `₹${p.rent_per_month} <span>/ month</span>`;
  if (p.rent_per_km)    return `₹${p.rent_per_km} <span>/ km</span>`;
  return `<span style="color:var(--c-ink-faint);font-size:12px;">Price not set</span>`;
}

// ── Load products ─────────────────────────────────────────────
async function vsLoadBrowseProducts(reset = true) {
  if (reset) { vsCurrentPage = 1; vsAllProducts = []; document.getElementById('vsProductGrid').innerHTML = Array(20).fill(vsSkeletonCardHTML()).join(''); }
  const params = new URLSearchParams({ page: vsCurrentPage, per_page: 20 });
  if (vsActiveFilters.category) params.set('category', vsActiveFilters.category);
  if (vsActiveFilters.city)     params.set('city', vsActiveFilters.city);
  if (vsActiveFilters.priceType) params.set('price_type', vsActiveFilters.priceType);
  if (vsActiveFilters.priceMin > 0)          params.set('price_min', vsActiveFilters.priceMin);
  if (vsActiveFilters.priceMax < Infinity)   params.set('price_max', vsActiveFilters.priceMax);
  const q = document.getElementById('vsSearchInput').value.trim();
  if (q) params.set('search', q);
  try {
    const res = await apiRequest(`/products/public?${params}`, 'GET');
    if (!res.success) { document.getElementById('vsProductGrid').innerHTML = `<div class="vendor-grid-empty"><div style="font-size:40px">😕</div><p>Failed to load products.</p></div>`; return; }
    vsTotalProducts = res.total; vsHasMore = res.has_more; vsAllProducts = res.products; vsFilteredProducts = res.products;
    vsRenderProducts(); vsAttachSentinel(); vsUpdateFilterBadge();
  } catch (e) { document.getElementById('vsProductGrid').innerHTML = `<div class="vendor-grid-empty"><div style="font-size:40px">😕</div><p>Failed to load products.</p></div>`; }
}

// ── Append next batch ─────────────────────────────────────────
async function vsAppendNextBatch() {
  if (vsIsLoadingMore || !vsHasMore) return;
  vsIsLoadingMore = true;
  document.getElementById('vsScrollSentinel')?.remove();
  document.querySelector('.vendor-scroll-end-msg')?.remove();
  const grid = document.getElementById('vsHomeProdGrid') || document.getElementById('vsProductGrid');
  const skeletonWrapper = document.createElement('div');
  skeletonWrapper.id = 'vsSkeletonBatch';
  skeletonWrapper.style.cssText = 'display:contents';
  skeletonWrapper.innerHTML = Array(10).fill(vsSkeletonCardHTML()).join('');
  grid.appendChild(skeletonWrapper);
  vsCurrentPage++;
  const params = new URLSearchParams({ page: vsCurrentPage, per_page: 20 });
  if (vsActiveFilters.category) params.set('category', vsActiveFilters.category);
  if (vsActiveFilters.city)     params.set('city', vsActiveFilters.city);
  if (vsActiveFilters.priceType) params.set('price_type', vsActiveFilters.priceType);
  if (vsActiveFilters.priceMin > 0)        params.set('price_min', vsActiveFilters.priceMin);
  if (vsActiveFilters.priceMax < Infinity) params.set('price_max', vsActiveFilters.priceMax);
  const q = document.getElementById('vsSearchInput').value.trim();
  if (q) params.set('search', q);
  try {
    const res = await apiRequest(`/products/public?${params}`, 'GET');
    skeletonWrapper.remove();
    if (res.success) { vsHasMore = res.has_more; vsTotalProducts = res.total; res.products.forEach(p => grid.insertAdjacentHTML('beforeend', vsProductCardHTML(p))); }
  } catch (e) { skeletonWrapper.remove(); vsCurrentPage--; }
  vsIsLoadingMore = false;
  vsAttachSentinel();
}

// ── Sentinel ──────────────────────────────────────────────────
function vsAttachSentinel() {
  if (vsScrollObserver) { vsScrollObserver.disconnect(); vsScrollObserver = null; }
  vsSentinel?.remove();
  const grid = document.getElementById('vsHomeProdGrid') || document.getElementById('vsProductGrid');
  if (!vsHasMore) {
    if (vsTotalProducts > 20) grid.insertAdjacentHTML('beforeend', `<div class="vendor-scroll-end-msg">✓ All ${vsTotalProducts} products loaded</div>`);
    return;
  }
  grid.insertAdjacentHTML('beforeend', `<div id="vsScrollSentinel" style="grid-column:1/-1;height:40px;"></div>`);
  vsSentinel = document.getElementById('vsScrollSentinel');
  vsScrollObserver = new IntersectionObserver(entries => { if (entries[0].isIntersecting) vsAppendNextBatch(); }, { rootMargin: '200px' });
  vsScrollObserver.observe(vsSentinel);
}

// ── Render ────────────────────────────────────────────────────
function vsRenderProducts() {
  const grid = document.getElementById('vsProductGrid');
  const countEl = document.getElementById('vsProductsCount');
  if (vsFilteredProducts.length === 0) {
    countEl.textContent = '';
    grid.innerHTML = `<div class="vendor-grid-empty"><div style="font-size:44px;margin-bottom:10px;">🔍</div><h3>No products found</h3><p>Try different filters or search terms.</p><button onclick="vsClearAllFilters()" style="margin-top:12px;padding:9px 22px;border-radius:var(--r-md);background:var(--grad-brand);color:#fff;border:none;font-weight:600;cursor:pointer;">Clear filters</button></div>`;
    return;
  }
  countEl.textContent = `${vsTotalProducts} product${vsTotalProducts !== 1 ? 's' : ''}`;
  grid.innerHTML = vsFilteredProducts.map(p => vsProductCardHTML(p)).join('');
}

// ── Apply filters ─────────────────────────────────────────────
function vsApplyFilters() {
  const homeSection = document.getElementById('vsBrowseHomeSection');
  if (homeSection) homeSection.style.display = 'none';
  document.getElementById('vsProductGrid').style.display = 'grid';
  document.getElementById('vsProductsTitle').textContent =
    vsActiveFilters.category || (document.getElementById('vsSearchInput').value.trim() ? 'Search Results' : 'All Products');
  vsLoadBrowseProducts(true);
}

// ── Filter badge ──────────────────────────────────────────────
function vsUpdateFilterBadge() {
  let count = 0;
  if (vsActiveFilters.category) count++;
  if (vsActiveFilters.city) count++;
  if (vsActiveFilters.priceType) count++;
  if (vsActiveFilters.priceMin > 0 || vsActiveFilters.priceMax < Infinity) count++;
  const badge = document.getElementById('vsFilterCountBadge');
  badge.style.display = count ? 'inline-flex' : 'none';
  badge.textContent = count;
  document.getElementById('vsFilterBtn').classList.toggle('has-filters', count > 0);
}

// ── Filter chips ──────────────────────────────────────────────
function vsRenderActiveFilterChips() {
  const el = document.getElementById('vsActiveFilters');
  const chips = [];
  if (vsActiveFilters.category) chips.push({ label: vsActiveFilters.category, key: 'category' });
  if (vsActiveFilters.city) chips.push({ label: `📍 ${vsActiveFilters.city}`, key: 'city' });
  if (vsActiveFilters.priceType) chips.push({ label: `⏱ ${vsActiveFilters.priceType}`, key: 'priceType' });
  if (vsActiveFilters.priceMin > 0 || vsActiveFilters.priceMax < Infinity) {
    chips.push({ label: `₹${vsActiveFilters.priceMin}–${vsActiveFilters.priceMax === Infinity ? '∞' : vsActiveFilters.priceMax}`, key: 'price' });
  }
  el.innerHTML = chips.map(c => `<button class="vendor-active-chip" onclick="vsRemoveFilter('${c.key}')">${c.label} ✕</button>`).join('');
}

// ── Remove filter ─────────────────────────────────────────────
function vsRemoveFilter(key) {
  if (key === 'category') { vsActiveFilters.category = ''; document.getElementById('vsFilterCategory').value = ''; }
  if (key === 'city') { vsActiveFilters.city = ''; document.getElementById('vsFilterCity').value = ''; }
  if (key === 'priceType') { vsActiveFilters.priceType = ''; document.querySelectorAll('.vendor-price-type-btn').forEach(b => b.classList.remove('active')); }
  if (key === 'price') { vsActiveFilters.priceMin = 0; vsActiveFilters.priceMax = Infinity; document.getElementById('vsFilterPriceMin').value = ''; document.getElementById('vsFilterPriceMax').value = ''; }
  vsRenderActiveFilterChips(); vsUpdateFilterBadge();
  const hasAny = vsActiveFilters.category || vsActiveFilters.city || vsActiveFilters.priceType || vsActiveFilters.priceMin > 0 || vsActiveFilters.priceMax < Infinity || document.getElementById('vsSearchInput').value.trim();
  if (!hasAny) vsLoadBrowseHomepage(); else vsApplyFilters();
}

// ── Clear all ─────────────────────────────────────────────────
function vsClearAllFilters() {
  vsActiveFilters = { category:'', city:'', priceType:'', priceMin:0, priceMax:Infinity };
  document.getElementById('vsSearchInput').value = '';
  document.getElementById('vsFilterCategory').value = '';
  document.getElementById('vsFilterCity').value = '';
  document.getElementById('vsFilterPriceMin').value = '';
  document.getElementById('vsFilterPriceMax').value = '';
  document.querySelectorAll('.vendor-price-type-btn').forEach(b => b.classList.remove('active'));
  vsRenderActiveFilterChips(); vsUpdateFilterBadge(); vsLoadBrowseHomepage();
}

// ── Filter sheet ──────────────────────────────────────────────
function vsOpenFilterSheet() { document.getElementById('vsFilterSheet').classList.add('open'); document.getElementById('vsFilterOverlay').classList.add('open'); }
function vsCloseFilterSheet() { document.getElementById('vsFilterSheet').classList.remove('open'); document.getElementById('vsFilterOverlay').classList.remove('open'); }

// ── Enter category ────────────────────────────────────────────
function vsEnterBrowseCategory(cat) {
  vsActiveFilters.category = cat;
  document.getElementById('vsFilterCategory').value = cat;
  document.getElementById('vsProductsCount').textContent = '';
  const homeSection = document.getElementById('vsBrowseHomeSection');
  if (homeSection) homeSection.style.display = 'none';
  document.getElementById('vsProductGrid').style.display = 'grid';
  document.getElementById('vsProductsTitle').textContent = cat;
  vsRenderActiveFilterChips(); vsUpdateFilterBadge(); vsLoadBrowseProducts(true);
}

// ── Homepage ──────────────────────────────────────────────────
async function vsLoadBrowseHomepage() {
  const grid = document.getElementById('vsProductGrid');
  const countEl = document.getElementById('vsProductsCount');
  countEl.textContent = '';
  document.getElementById('vsProductsTitle').textContent = 'All products';
  grid.style.display = 'none';
  let homeSection = document.getElementById('vsBrowseHomeSection');
  if (!homeSection) {
    homeSection = document.createElement('div');
    homeSection.id = 'vsBrowseHomeSection';
    grid.parentNode.insertBefore(homeSection, grid);
  }
  homeSection.style.display = 'block';
  homeSection.innerHTML = `
    <div id="vsCatCardGrid" class="vendor-cat-card-grid">
      ${Array(8).fill(`<div class="vendor-cat-card"><div class="vendor-skeleton-img" style="height:100%;width:100%;border-radius:var(--r-md);"></div></div>`).join('')}
    </div>
    <div id="vsHomeProdSection">
      <div class="vendor-home-prod-title">Featured Products</div>
      <div class="vendor-product-grid" id="vsHomeProdGrid">
        ${Array(8).fill(vsSkeletonCardHTML()).join('')}
      </div>
    </div>`;
  const [catData, prodData] = await Promise.all([
    apiRequest('/products/categories', 'GET').catch(() => null),
    apiRequest('/products/public?page=1&per_page=20', 'GET').catch(() => null)
  ]);
  vsHasMore = prodData?.has_more ?? false;
  vsTotalProducts = prodData?.total ?? 0;
  const catGrid = document.getElementById('vsCatCardGrid');
  if (catGrid) {
    if (catData?.success && catData.categories.length > 0) {
      vsPopulateCategoryDropdown(catData.categories);
      catGrid.innerHTML = catData.categories.map(cat => `
        <div class="vendor-cat-card" onclick="vsEnterBrowseCategory('${cat.name.replace(/'/g, "\\'")}')">
          <img class="vendor-cat-card-img" src="${cat.image_url}" alt="${cat.name}" loading="lazy">
          <div class="vendor-cat-card-name">${cat.name}</div>
        </div>`).join('');
    } else {
      catGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:36px 20px;"><div style="font-size:48px;margin-bottom:12px;">🏪</div><h3>No categories live yet</h3></div>`;
    }
  }
  const homeProdGrid = document.getElementById('vsHomeProdGrid');
  if (homeProdGrid) {
    if (prodData?.success && prodData.products.length > 0) {
      homeProdGrid.innerHTML = prodData.products.map(p => vsProductCardHTML(p)).join('');
      if (vsHasMore) vsAttachSentinel();
    } else {
      homeProdGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:36px 20px;"><div style="font-size:48px;margin-bottom:12px;">📦</div><h3>No products listed yet</h3></div>`;
    }
  }
}

// ── Filter event listeners ────────────────────────────────────
document.getElementById('vsFilterBtn')?.addEventListener('click', vsOpenFilterSheet);

document.querySelectorAll('.vendor-price-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.vendor-price-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.getElementById('vsFilterApplyBtn')?.addEventListener('click', () => {
  const selectedType = document.querySelector('.vendor-price-type-btn.active')?.dataset.type || '';
  vsActiveFilters.category = document.getElementById('vsFilterCategory').value;
  vsActiveFilters.city = document.getElementById('vsFilterCity').value.trim().toLowerCase();
  vsActiveFilters.priceType = selectedType;
  vsActiveFilters.priceMin = parseFloat(document.getElementById('vsFilterPriceMin').value) || 0;
  vsActiveFilters.priceMax = parseFloat(document.getElementById('vsFilterPriceMax').value) || Infinity;
  vsCloseFilterSheet(); vsApplyFilters(); vsRenderActiveFilterChips();
});

document.getElementById('vsFilterClearBtn')?.addEventListener('click', () => { vsClearAllFilters(); vsCloseFilterSheet(); });

let vsSearchDebounceTimer = null;
document.getElementById('vsSearchInput')?.addEventListener('input', function () {
  clearTimeout(vsSearchDebounceTimer);
  vsSearchDebounceTimer = setTimeout(() => {
    const homeSection = document.getElementById('vsBrowseHomeSection');
    if (homeSection) homeSection.style.display = 'none';
    document.getElementById('vsProductGrid').style.display = 'grid';
    document.getElementById('vsProductsTitle').textContent = 'Search Results';
    vsApplyFilters();
  }, 400);
});

document.getElementById('vsFilterLocateBtn')?.addEventListener('click', () => {
  if (!navigator.geolocation) { toastError('Your browser does not support location.'); return; }
  const btn = document.getElementById('vsFilterLocateBtn');
  btn.disabled = true; btn.style.opacity = '0.5';
  toastInfo('Looking for your location…');
  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      let city = data.address?.city || data.address?.town || data.address?.village || '';
      if (!city) city = (data.address?.city_district || data.address?.state_district || '').split(' ')[0] || '';
      if (city) document.getElementById('vsFilterCity').value = city;
      else toastError("Couldn't determine your city.");
    } catch (e) { toastError('Location lookup failed.'); }
    finally { btn.disabled = false; btn.style.opacity = '1'; }
  }, err => {
    const messages = { 1:'Location permission denied.', 2:'Location unavailable.', 3:'Location request timed out.' };
    toastError(messages[err.code] || 'Could not get your location.');
    btn.disabled = false; btn.style.opacity = '1';
  });
});

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('hamburgerBtn')?.addEventListener('click', () => document.getElementById('mobileMenu').classList.toggle('open'));
  await loadVendorProfile();
  vsLoadBrowseHomepage();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 860) document.getElementById('mobileMenu')?.classList.remove('open');
});
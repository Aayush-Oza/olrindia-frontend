/* ============================================================
   OLR INDIA – BROWSE SHARED JS
============================================================ */

// ── Shared state ───────────────────────────────────────────────
let bsActiveTab = 'rent';

let bsActiveFilters = {
  category:  '',
  city:      '',
  priceType: '',
  condition: '',
  priceMin:  0,
  priceMax:  Infinity,
};

let bsCurrentPage   = 1;
let bsTotalProducts = 0;
let bsHasMore       = false;
let bsIsLoadingMore = false;
let bsSentinel      = null;
let bsScrollObserver = null;

// Set by page-specific file
let cfg = {};

// Callbacks page-specific file must provide
let onLoadHomepage    = null;  // fn()      – reload the homepage view
let onLoadProducts    = null;  // fn(reset) – load filtered product list
let onWishBtn         = null;  // fn(btn, productId) – wishlist action
let onProductCardHTML = null;  // fn(p) → HTML string

// ── Init (called by page-specific file) ───────────────────────
function browseSharedInit(pageCfg, callbacks) {
  cfg = pageCfg;

  onLoadHomepage    = callbacks.loadHomepage;
  onLoadProducts    = callbacks.loadProducts;
  onWishBtn         = callbacks.wishBtn     || null;
  onProductCardHTML = callbacks.productCardHTML;

  _bindFilterEvents();
}

// ── Tab switching ─────────────────────────────────────────────
function bsSwitchTab(tab) {
  if (tab === bsActiveTab) return;
  bsActiveTab = tab;
  document.getElementById(cfg.tabRentId).classList.toggle('active', tab === 'rent');
  document.getElementById(cfg.tabBuyId).classList.toggle('active', tab === 'sell');
  document.getElementById(cfg.filterGroupPriceTypeId).style.display = tab === 'rent' ? '' : 'none';
  document.getElementById(cfg.filterGroupConditionId).style.display = tab === 'sell' ? '' : 'none';
  bsResetFilters(false);
  bsRenderActiveFilterChips();
  bsUpdateFilterBadge();
  onLoadHomepage();
}

// ── Filter reset ──────────────────────────────────────────────
function bsResetFilters(reload = true) {
  bsActiveFilters = { category:'', city:'', priceType:'', condition:'', priceMin:0, priceMax:Infinity };
  document.getElementById(cfg.filterCategoryId).value  = '';
  document.getElementById(cfg.filterCityId).value      = '';
  document.getElementById(cfg.filterConditionId).value = '';
  document.getElementById(cfg.filterPriceMinId).value  = '';
  document.getElementById(cfg.filterPriceMaxId).value  = '';
  document.getElementById(cfg.filterPriceHintId).textContent = 'Enter a min or max to filter by price.';
  document.getElementById(cfg.filterPriceHintId).classList.remove('error');
  document.querySelectorAll(cfg.priceTypeBtnSelector).forEach(b => b.classList.remove('active'));
  if (reload) onLoadHomepage();
}

// ── Category dropdown ─────────────────────────────────────────
function bsPopulateCategoryDropdown(categories) {
  const sel = document.getElementById(cfg.filterCategoryId);
  if (!sel) return;
  sel.innerHTML = '<option value="">All categories</option>' +
    categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

// ── Skeleton card HTML ────────────────────────────────────────
function bsSkeletonCardHTML() {
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

// ── Build API params ──────────────────────────────────────────
function bsBuildParams(page, perPage) {
  const q = document.getElementById(cfg.searchId).value.trim();
  const params = new URLSearchParams({ page, per_page: perPage, listing_type: bsActiveTab });
  if (bsActiveFilters.category) params.set('category', bsActiveFilters.category);
  if (bsActiveFilters.city)     params.set('city',     bsActiveFilters.city);
  if (bsActiveTab === 'rent') {
    if (bsActiveFilters.priceType)           params.set('price_type', bsActiveFilters.priceType);
    if (bsActiveFilters.priceMin > 0)        params.set('price_min',  bsActiveFilters.priceMin);
    if (bsActiveFilters.priceMax < Infinity) params.set('price_max',  bsActiveFilters.priceMax);
  } else {
    if (bsActiveFilters.condition)           params.set('condition',  bsActiveFilters.condition);
    if (bsActiveFilters.priceMin > 0)        params.set('price_min',  bsActiveFilters.priceMin);
    if (bsActiveFilters.priceMax < Infinity) params.set('price_max',  bsActiveFilters.priceMax);
  }
  if (q) params.set('search', q);
  return params;
}

// ── Render products ───────────────────────────────────────────
function bsRenderProducts(products) {
  const grid    = document.getElementById(cfg.productGridId);
  const countEl = document.getElementById(cfg.productsCountId);
  if (products.length === 0) {
    countEl.textContent = '';
    grid.innerHTML = `
      <div class="grid-empty" style="grid-column:1/-1">
        <div style="font-size:44px;margin-bottom:10px;">🔍</div>
        <h3>No products found</h3>
        <p>Try different filters or search terms.</p>
        <button onclick="bsClearAllFilters()" style="margin-top:12px;padding:9px 22px;border-radius:var(--r-md);background:var(--grad-brand);color:#fff;border:none;font-weight:600;cursor:pointer;font-family:var(--font-display);">Clear filters</button>
      </div>`;
    return;
  }
  countEl.textContent = `${bsTotalProducts} product${bsTotalProducts !== 1 ? 's' : ''}`;
  grid.innerHTML = products.map(p => onProductCardHTML(p)).join('');
}

// ── Append next batch (infinite scroll) ───────────────────────
async function bsAppendNextBatch() {
  if (bsIsLoadingMore || !bsHasMore) return;
  bsIsLoadingMore = true;

  document.getElementById('bsScrollSentinel')?.remove();
  document.querySelector('.bs-scroll-end-msg')?.remove();

  const grid = document.getElementById('bsHomeProdGrid') || document.getElementById(cfg.productGridId);
  const skeletonWrapper = document.createElement('div');
  skeletonWrapper.id = 'bsSkeletonBatch';
  skeletonWrapper.style.cssText = 'display:contents';
  skeletonWrapper.innerHTML = Array(10).fill(bsSkeletonCardHTML()).join('');
  grid.appendChild(skeletonWrapper);

  bsCurrentPage++;
  try {
    const res = await apiRequest(`/products/public?${bsBuildParams(bsCurrentPage, 10)}`, 'GET');
    skeletonWrapper.remove();
    if (res.success) {
      bsHasMore       = res.has_more;
      bsTotalProducts = res.total;
      res.products.forEach(p => grid.insertAdjacentHTML('beforeend', onProductCardHTML(p)));
      setTimeout(() => window.retranslateDynamic?.(), 600);
    }
  } catch {
    skeletonWrapper.remove();
    bsCurrentPage--;
    toastError('Failed to load more products.');
  }
  bsIsLoadingMore = false;
  setTimeout(() => bsAttachSentinel(), 300);
}

// ── Sentinel ──────────────────────────────────────────────────
function bsAttachSentinel() {
  if (bsScrollObserver) { bsScrollObserver.disconnect(); bsScrollObserver = null; }
  bsSentinel?.remove();

  const grid = document.getElementById('bsHomeProdGrid') || document.getElementById(cfg.productGridId);
  if (!bsHasMore) {
    if (bsTotalProducts > 20)
      grid.insertAdjacentHTML('beforeend',
        `<div class="bs-scroll-end-msg" style="grid-column:1/-1;text-align:center;padding:18px;font-size:13px;color:var(--c-ink-faint);">✓ All ${bsTotalProducts} products loaded</div>`);
    return;
  }
  grid.insertAdjacentHTML('beforeend', `<div id="bsScrollSentinel" style="grid-column:1/-1;height:40px;"></div>`);
  bsSentinel = document.getElementById('bsScrollSentinel');
  bsScrollObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) bsAppendNextBatch();
  }, { rootMargin: '200px' });
  bsScrollObserver.observe(bsSentinel);
}

// ── Price label ───────────────────────────────────────────────
function bsBuildPriceLabel(p) {
  if (p.listing_type === 'sell')
    return p.selling_price ? `₹${p.selling_price}` : `<span style="color:var(--c-ink-faint);font-size:12px;">Price not set</span>`;
  const type = bsActiveFilters.priceType;
  if (type === 'hour'  && p.rent_per_hour)  return `₹${p.rent_per_hour} <span>/ hour</span>`;
  if (type === 'km'    && p.rent_per_km)    return `₹${p.rent_per_km} <span>/ km</span>`;
  if (type === 'day'   && p.rent_per_day)   return `₹${p.rent_per_day} <span>/ day</span>`;
  if (type === 'month' && p.rent_per_month) return `₹${p.rent_per_month} <span>/ month</span>`;
  if (p.rent_per_day)   return `₹${p.rent_per_day} <span>/ day</span>`;
  if (p.rent_per_hour)  return `₹${p.rent_per_hour} <span>/ hour</span>`;
  if (p.rent_per_month) return `₹${p.rent_per_month} <span>/ month</span>`;
  if (p.rent_per_km)    return `₹${p.rent_per_km} <span>/ km</span>`;
  return `<span style="color:var(--c-ink-faint);font-size:12px;">Price not available</span>`;
}

// ── Open product page ─────────────────────────────────────────
function bsOpenProduct(slug, category, city) {
  if (!slug) return;
  window.location.href = `/product/${slugify(category || '')}/${slugify(city || 'india')}/${slug}`;
}

// ── Condition label ───────────────────────────────────────────
function bsConditionLabel(val) {
  return { new: 'New', like_new: 'Like New', good: 'Good', fair: 'Fair' }[val] || val;
}

// ── Clear all filters ─────────────────────────────────────────
function bsClearAllFilters() {
  document.getElementById(cfg.searchId).value = '';
  bsResetFilters(false);
  bsRenderActiveFilterChips();
  bsUpdateFilterBadge();
  onLoadHomepage();
}

// ── Filter badge ──────────────────────────────────────────────
function bsUpdateFilterBadge() {
  let count = 0;
  if (bsActiveFilters.category)  count++;
  if (bsActiveFilters.city)      count++;
  if (bsActiveFilters.priceType) count++;
  if (bsActiveFilters.condition) count++;
  if (bsActiveFilters.priceMin > 0 || bsActiveFilters.priceMax < Infinity) count++;
  const badge = document.getElementById(cfg.filterCountBadgeId);
  badge.style.display = count ? 'inline-flex' : 'none';
  badge.textContent   = count;
  document.getElementById(cfg.filterBtnId).classList.toggle('has-filters', count > 0);
}

// ── Filter chips ──────────────────────────────────────────────
function bsRenderActiveFilterChips() {
  const el    = document.getElementById(cfg.activeFiltersId);
  const chips = [];
  if (bsActiveFilters.category)  chips.push({ label: bsActiveFilters.category, key: 'category' });
  if (bsActiveFilters.city)      chips.push({ label: `📍 ${bsActiveFilters.city}`, key: 'city' });
  if (bsActiveFilters.priceType) chips.push({ label: `⏱ ${bsActiveFilters.priceType}`, key: 'priceType' });
  if (bsActiveFilters.condition) chips.push({ label: `🏷 ${bsConditionLabel(bsActiveFilters.condition)}`, key: 'condition' });
  if (bsActiveFilters.priceMin > 0 || bsActiveFilters.priceMax < Infinity)
    chips.push({ label: `₹${bsActiveFilters.priceMin}–${bsActiveFilters.priceMax === Infinity ? '∞' : bsActiveFilters.priceMax}`, key: 'price' });
  el.innerHTML = chips.map(c =>
    `<button class="${cfg.activeChipClass}" onclick="bsRemoveFilter('${c.key}')">${c.label} ✕</button>`
  ).join('');
}

function bsRemoveFilter(key) {
  if (key === 'category')  { bsActiveFilters.category  = ''; document.getElementById(cfg.filterCategoryId).value  = ''; }
  if (key === 'city')      { bsActiveFilters.city       = ''; document.getElementById(cfg.filterCityId).value      = ''; }
  if (key === 'priceType') { bsActiveFilters.priceType  = ''; document.querySelectorAll(cfg.priceTypeBtnSelector).forEach(b => b.classList.remove('active')); }
  if (key === 'condition') { bsActiveFilters.condition  = ''; document.getElementById(cfg.filterConditionId).value = ''; }
  if (key === 'price')     { bsActiveFilters.priceMin = 0; bsActiveFilters.priceMax = Infinity; document.getElementById(cfg.filterPriceMinId).value = ''; document.getElementById(cfg.filterPriceMaxId).value = ''; }
  bsRenderActiveFilterChips();
  bsUpdateFilterBadge();
  const hasAny = bsActiveFilters.category || bsActiveFilters.city || bsActiveFilters.priceType ||
    bsActiveFilters.condition || bsActiveFilters.priceMin > 0 || bsActiveFilters.priceMax < Infinity ||
    document.getElementById(cfg.searchId).value.trim();
  if (!hasAny) onLoadHomepage(); else bsApplyFilters();
}

// ── Apply filters (enter filtered view) ───────────────────────
function bsApplyFilters() {
  const homeSection = document.getElementById('bsHomeSection');
  if (homeSection) homeSection.style.display = 'none';
  const grid = document.getElementById(cfg.productGridId);
  grid.style.display = 'grid';
  document.getElementById(cfg.productsTitleId).textContent =
    bsActiveFilters.category ||
    (document.getElementById(cfg.searchId).value.trim() ? 'Search Results' : 'All Products');
  onLoadProducts(true);
}

// ── Enter a category ──────────────────────────────────────────
function bsEnterCategory(cat) {
  bsActiveFilters.category = cat;
  document.getElementById(cfg.filterCategoryId).value = cat;
  document.getElementById(cfg.productsCountId).textContent = '';
  const homeSection = document.getElementById('bsHomeSection');
  if (homeSection) homeSection.style.display = 'none';
  document.getElementById(cfg.productGridId).style.display = 'grid';
  document.getElementById(cfg.productsTitleId).textContent = cat;
  bsRenderActiveFilterChips();
  bsUpdateFilterBadge();
  onLoadProducts(true);
}

// ── Filter sheet open/close ───────────────────────────────────
function bsOpenFilterSheet() {
  document.getElementById(cfg.filterSheetId).classList.add('open');
  document.getElementById(cfg.filterOverlayId).classList.add('open');
}
function bsCloseFilterSheet() {
  document.getElementById(cfg.filterSheetId).classList.remove('open');
  document.getElementById(cfg.filterOverlayId).classList.remove('open');
}

// ── Homepage shell (categories + featured) ────────────────────
//    Returns { homeSection, catGrid, homeProdGrid } after inserting HTML.
//    Page-specific file calls this, populates the grids, then calls bsAttachSentinel().
function bsRenderHomepageShell(skeletonCount = 8) {
  const grid    = document.getElementById(cfg.productGridId);
  const countEl = document.getElementById(cfg.productsCountId);
  countEl.textContent = '';
  document.getElementById(cfg.productsTitleId).textContent =
    bsActiveTab === 'rent' ? 'Browse & Rent' : 'Browse & Buy';
  grid.style.display = 'none';

  let homeSection = document.getElementById('bsHomeSection');
  if (!homeSection) {
    homeSection = document.createElement('div');
    homeSection.id = 'bsHomeSection';
    grid.parentNode.insertBefore(homeSection, grid);
  }
  homeSection.style.display = 'block';
  homeSection.innerHTML = `
    <div id="bsCatCardGrid" class="cat-card-grid">
      ${Array(skeletonCount).fill(`
        <div class="cat-card skeleton-cat-card">
          <div class="skeleton-img" style="height:100%;width:100%;border-radius:var(--r-md);"></div>
        </div>`).join('')}
    </div>
    <div id="bsHomeProdSection">
      <div class="home-prod-title">Featured ${bsActiveTab === 'rent' ? 'Rentals' : 'Items to Buy'}</div>
      <div class="product-grid" id="bsHomeProdGrid">
        ${Array(skeletonCount).fill(bsSkeletonCardHTML()).join('')}
      </div>
    </div>`;

  return {
    homeSection,
    catGrid:     document.getElementById('bsCatCardGrid'),
    homeProdGrid: document.getElementById('bsHomeProdGrid'),
  };
}

// ── Render category grid ──────────────────────────────────────
function bsRenderCatGrid(catGrid, categories, onCatClick) {
  if (categories && categories.length > 0) {
    bsPopulateCategoryDropdown(categories);
    catGrid.innerHTML = categories.map(cat => `
      <div class="cat-card" onclick="${onCatClick}('${cat.name.replace(/'/g, "\\'")}')">
        <img class="cat-card-img" src="${cat.image_url}" alt="${cat.name}" loading="lazy">
        <div class="cat-card-name">${cat.name}</div>
      </div>`).join('');
  } else {
    catGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:36px 20px;">
        <div style="font-size:48px;margin-bottom:12px;">🏪</div>
        <h3 style="margin:0 0 8px;font-family:var(--font-display);color:var(--text-main);">No categories live yet</h3>
        <p style="margin:0;color:var(--text-muted);font-size:14px;">Vendors are setting up — products will appear here soon.</p>
      </div>`;
  }
}

// ── Render homepage product grid ──────────────────────────────
function bsRenderHomeProdGrid(homeProdGrid, products) {
  if (products && products.length > 0) {
    homeProdGrid.innerHTML = products.map(p => onProductCardHTML(p)).join('');
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

// ── Private: bind all filter-related events ───────────────────
function _bindFilterEvents() {
  document.getElementById(cfg.filterBtnId)?.addEventListener('click', bsOpenFilterSheet);
  document.getElementById(cfg.filterOverlayId)?.addEventListener('click', bsCloseFilterSheet);

  document.querySelectorAll(cfg.priceTypeBtnSelector).forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(cfg.priceTypeBtnSelector).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById(cfg.filterLocateBtnId)?.addEventListener('click', () => {
    if (!navigator.geolocation) { toastError('Your browser does not support location.'); return; }
    const btn = document.getElementById(cfg.filterLocateBtnId);
    btn.disabled = true; btn.style.opacity = '0.5';
    toastInfo('Looking for your location…');
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        let city = data.address?.city || data.address?.town || data.address?.village || '';
        if (!city) city = (data.address?.city_district || data.address?.state_district || '').split(' ')[0] || '';
        if (city) document.getElementById(cfg.filterCityId).value = city;
        else toastError("Couldn't determine your city.");
      } catch { toastError('Location lookup failed.'); }
      finally { btn.disabled = false; btn.style.opacity = '1'; }
    }, err => {
      const msgs = { 1: 'Location permission denied.', 2: 'Location unavailable.', 3: 'Request timed out.' };
      toastError(msgs[err.code] || 'Could not get your location.');
      btn.disabled = false; btn.style.opacity = '1';
    });
  });

  document.getElementById(cfg.filterApplyBtnId)?.addEventListener('click', () => {
    const selectedType = document.querySelector(`${cfg.priceTypeBtnSelector}.active`)?.dataset.type || '';
    bsActiveFilters.category = document.getElementById(cfg.filterCategoryId).value;
    bsActiveFilters.city     = document.getElementById(cfg.filterCityId).value.trim().toLowerCase();
    bsActiveFilters.priceMin = parseFloat(document.getElementById(cfg.filterPriceMinId).value) || 0;
    bsActiveFilters.priceMax = parseFloat(document.getElementById(cfg.filterPriceMaxId).value) || Infinity;
    document.getElementById(cfg.filterPriceHintId).textContent = 'Enter a min or max to filter by price.';
    document.getElementById(cfg.filterPriceHintId).classList.remove('error');
    if (bsActiveTab === 'rent') {
      bsActiveFilters.priceType = selectedType;
      bsActiveFilters.condition = '';
    } else {
      bsActiveFilters.condition = document.getElementById(cfg.filterConditionId).value;
      bsActiveFilters.priceType = '';
    }
    bsCloseFilterSheet();
    bsApplyFilters();
    bsRenderActiveFilterChips();
  });

  document.getElementById(cfg.filterClearBtnId)?.addEventListener('click', () => {
    bsResetFilters(false);
    bsCloseFilterSheet();
    bsRenderActiveFilterChips();
    bsUpdateFilterBadge();
    onLoadHomepage();
  });

  let searchDebounceTimer = null;
  document.getElementById(cfg.searchId)?.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      const homeSection = document.getElementById('bsHomeSection');
      if (homeSection) homeSection.style.display = 'none';
      document.getElementById(cfg.productGridId).style.display = 'grid';
      document.getElementById(cfg.productsTitleId).textContent = 'Search Results';
      bsApplyFilters();
    }, 400);
  });
}
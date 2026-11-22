/* ============================================================
   OLR INDIA – BROWSE SHARED JS
   Fixes in this version:
   · Nominatim wildcard search (* suffix) → partial match works
     e.g. "borival" now returns "Borivali East" etc.
   · Deduplication of results by formatted label
   · Better label formatting: suburb → city → state, skips blanks
   · Coordinates cleared only when truly appropriate
   · Minor: abort previous fetch on each new keystroke
============================================================ */

// ── Shared state ───────────────────────────────────────────────
let bsActiveTab = 'all';

let bsActiveFilters = {
  category:  '',
  city:      '',
  priceType: '',
  condition: '',
  priceMin:  0,
  priceMax:  Infinity,
};

let bsCurrentPage    = 1;
let bsTotalProducts  = 0;
let bsHasMore        = false;
let bsIsLoadingMore  = false;
let bsSentinel       = null;
let bsScrollObserver = null;

// ── User location (GPS or picked from autocomplete) ────────────
let bsUserLat = null;
let bsUserLng = null;

// Set by page-specific file
let cfg = {};

// Callbacks page-specific file must provide
let onLoadHomepage    = null;
let onLoadProducts    = null;
let onWishBtn         = null;
let onProductCardHTML = null;

// ── Init ──────────────────────────────────────────────────────
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
  document.getElementById(cfg.tabAllId).classList.toggle('active', tab === 'all');
  document.getElementById(cfg.tabRentId).classList.toggle('active', tab === 'rent');
  document.getElementById(cfg.tabBuyId).classList.toggle('active', tab === 'sell');
  document.getElementById(cfg.filterGroupPriceTypeId).style.display = tab === 'rent' ? '' : 'none';
  document.getElementById(cfg.filterGroupConditionId).style.display  = tab === 'sell' ? '' : 'none';
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
  bsUserLat = null;
  bsUserLng = null;
  if (reload) onLoadHomepage();
}

// ── Category dropdown ─────────────────────────────────────────
function bsPopulateCategoryDropdown(categories) {
  // keep hidden select in sync for JS compatibility
  const sel = document.getElementById(cfg.filterCategoryId);
  if (sel) {
    sel.innerHTML = '<option value="">All categories</option>' +
      categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  }

  // populate custom dropdown
  const dropdown = document.getElementById('filterCategoryDropdown');
  const btn = document.getElementById('filterCategoryBtn');
  const label = document.getElementById('filterCategoryLabel');
  if (!dropdown) return;

  dropdown.innerHTML = `<div class="filter-custom-select-option active" data-value="">All categories</div>` +
    categories.map(c => `<div class="filter-custom-select-option" data-value="${c.name}">${c.name}</div>`).join('');

  // toggle dropdown
  document.getElementById('filterCategoryBtn').onclick = () => {
    dropdown.classList.toggle('open');
  };

  // option click
  dropdown.querySelectorAll('.filter-custom-select-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const val = opt.dataset.value;
      label.textContent = opt.textContent;
      sel.value = val;
      dropdown.querySelectorAll('.filter-custom-select-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      dropdown.classList.remove('open');
    });
  });

  // close on outside click
  document.addEventListener('click', e => {
    if (!document.getElementById('filterCategoryWrap')?.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });
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
  const params = new URLSearchParams({ page, per_page: perPage });
  if (bsActiveTab !== 'all') params.set('listing_type', bsActiveTab);
  if (bsActiveFilters.category) params.set('category', bsActiveFilters.category);
  if (bsActiveFilters.city)     params.set('city',     bsActiveFilters.city);
  if (bsActiveTab === 'rent') {
    if (bsActiveFilters.priceType)           params.set('price_type', bsActiveFilters.priceType);
    if (bsActiveFilters.priceMin > 0)        params.set('price_min',  bsActiveFilters.priceMin);
    if (bsActiveFilters.priceMax < Infinity) params.set('price_max',  bsActiveFilters.priceMax);
  } else if (bsActiveTab === 'sell') {
    if (bsActiveFilters.condition)           params.set('condition',  bsActiveFilters.condition);
    if (bsActiveFilters.priceMin > 0)        params.set('price_min',  bsActiveFilters.priceMin);
    if (bsActiveFilters.priceMax < Infinity) params.set('price_max',  bsActiveFilters.priceMax);
  } else {
    if (bsActiveFilters.priceMin > 0)        params.set('price_min',  bsActiveFilters.priceMin);
    if (bsActiveFilters.priceMax < Infinity) params.set('price_max',  bsActiveFilters.priceMax);
  }
  if (q) params.set('search', q);
  if (bsUserLat !== null && bsUserLng !== null) {
    params.set('user_lat', bsUserLat);
    params.set('user_lng', bsUserLng);
  }
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
    const res = await apiRequest(`/products/public?${bsBuildParams(bsCurrentPage, 20)}`, 'GET');
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
  if (key === 'city')      {
    bsActiveFilters.city = '';
    document.getElementById(cfg.filterCityId).value = '';
    bsUserLat = null;
    bsUserLng = null;
  }
  if (key === 'priceType') { bsActiveFilters.priceType = ''; document.querySelectorAll(cfg.priceTypeBtnSelector).forEach(b => b.classList.remove('active')); }
  if (key === 'condition') { bsActiveFilters.condition = ''; document.getElementById(cfg.filterConditionId).value = ''; }
  if (key === 'price')     { bsActiveFilters.priceMin = 0; bsActiveFilters.priceMax = Infinity; document.getElementById(cfg.filterPriceMinId).value = ''; document.getElementById(cfg.filterPriceMaxId).value = ''; }
  bsRenderActiveFilterChips();
  bsUpdateFilterBadge();
  const hasAny = bsActiveFilters.category || bsActiveFilters.city || bsActiveFilters.priceType ||
    bsActiveFilters.condition || bsActiveFilters.priceMin > 0 || bsActiveFilters.priceMax < Infinity ||
    document.getElementById(cfg.searchId).value.trim();
  if (!hasAny) onLoadHomepage(); else bsApplyFilters();
}

// ── Apply filters ─────────────────────────────────────────────
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
  document.getElementById('fabListBtn').classList.remove('visible'); // ← fix
}

function bsCloseFilterSheet() {
  document.getElementById(cfg.filterSheetId).classList.remove('open');
  document.getElementById(cfg.filterOverlayId).classList.remove('open');
  document.getElementById('fabListBtn').classList.add('visible'); // ← fix
  _destroyCityAutocomplete();
}

// ── Homepage shell ────────────────────────────────────────────
function bsRenderHomepageShell(skeletonCount = 8) {
  const grid    = document.getElementById(cfg.productGridId);
  const countEl = document.getElementById(cfg.productsCountId);
  countEl.textContent = '';
  document.getElementById(cfg.productsTitleId).textContent =
    bsActiveTab === 'rent' ? 'Browse & Rent' :
    bsActiveTab === 'sell' ? 'Browse & Buy'  : 'All Products';
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
    catGrid:      document.getElementById('bsCatCardGrid'),
    homeProdGrid: document.getElementById('bsHomeProdGrid'),
  };
}

// ── Render category grid ──────────────────────────────────────
function bsRenderCatGrid(catGrid, categories, onCatClick) {
  if (!categories || categories.length === 0) {
    catGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:36px 20px;">
        <div style="font-size:48px;margin-bottom:12px;">🏪</div>
        <h3 style="margin:0 0 8px;font-family:var(--font-display);color:var(--text-main);">No categories live yet</h3>
        <p style="margin:0;color:var(--text-muted);font-size:14px;">Vendors are setting up - products will appear here soon.</p>
      </div>`;
    return;
  }

  bsPopulateCategoryDropdown(categories);

  const DESKTOP_VISIBLE = 16;
  const MOBILE_VISIBLE  = 8;
  const isMobile = window.innerWidth < 768;
  const visibleCount = isMobile ? MOBILE_VISIBLE : DESKTOP_VISIBLE;

  const visible = categories.slice(0, visibleCount);
  const hidden  = categories.slice(visibleCount);

  function catCardHTML(cat) {
    const iconUrl = `https://api.iconify.design/${cat.icon.replace(':', '/')}.svg?height=56`;
    return `
      <div class="cat-card" onclick="${onCatClick}('${cat.name.replace(/'/g, "\\'")}')">
        <div class="cat-card-icon-wrap">
          <img src="${iconUrl}" alt="${cat.name}" width="56" height="56" loading="lazy">
        </div>
        <div class="cat-card-name">${cat.name}</div>
      </div>`;
  }

  catGrid.innerHTML = visible.map(catCardHTML).join('');

  if (hidden.length > 0) {
    const showMoreBtn = document.createElement('div');
    showMoreBtn.style.cssText = 'grid-column:1/-1;display:flex;justify-content:center;margin-top:12px;';
    showMoreBtn.innerHTML = `
      <button id="bsCatShowMore" style="
        padding:7px 20px;
        border:1.5px solid #333333;
        border-radius:20px;
        background:transparent;
        color:#333333;
        font-weight:500;
        font-size:13px;
        cursor:pointer;
        font-family:var(--font-display);
        transition:background 0.15s,color 0.15s;
      ">Show more ▾</button>`;
    catGrid.appendChild(showMoreBtn);

    let expanded = false;
    const hiddenHTML = hidden.map(catCardHTML).join('');
    let hiddenNodes = [];

    document.getElementById('bsCatShowMore').addEventListener('click', function() {
      if (!expanded) {
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'display:contents';
        tempDiv.innerHTML = hiddenHTML;
        hiddenNodes = [...tempDiv.children];
        hiddenNodes.forEach(n => catGrid.insertBefore(n, showMoreBtn));
        this.textContent = 'Show less ▴';
        expanded = true;
      } else {
        hiddenNodes.forEach(n => n.remove());
        hiddenNodes = [];
        this.textContent = 'Show more categories ▾';
        expanded = false;
      }
    });
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

// ══════════════════════════════════════════════════════════════
//  CITY AUTOCOMPLETE  (Nominatim – area-level, India only)
//
//  KEY FIXES vs previous version:
//  1. Wildcard suffix (*) appended to every query so partial input
//     like "borival" matches "Borivali East", "Borivali West" etc.
//  2. Results deduplicated by formatted label — no more duplicate
//     "R/C Ward, Maharashtra" entries.
//  3. Label builder is more defensive — skips blank parts and
//     avoids repeating the same segment twice in a row.
//  4. Abort controller is reset properly on every new keystroke
//     so stale responses never overwrite fresh ones.
// ══════════════════════════════════════════════════════════════

let _acDebounceTimer        = null;
let _acDropdown             = null;
let _acAbortCtrl            = null;
let _acSelectedFromDropdown = false;

const _NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Format a Nominatim result into a readable area label.
 * Priority: suburb/neighbourhood → city/town/village → state.
 * Skips blank segments and avoids consecutive duplicates.
 */
function _formatNominatimLabel(item) {
  const a = item.address || {};

  const area  = a.suburb || a.neighbourhood || a.quarter || a.residential || a.hamlet || '';
  const city  = a.city   || a.town  || a.village || a.county || '';
  const state = a.state  || '';

  // Build parts, skipping blanks and consecutive duplicates
  const raw = [area, city, state];
  const parts = [];
  for (const seg of raw) {
    if (!seg) continue;
    if (parts.length && parts[parts.length - 1] === seg) continue;
    parts.push(seg);
  }

  return parts.length
    ? parts.join(', ')
    : item.display_name.split(',').slice(0, 3).join(',').trim();
}

/** Inject dropdown styles once. */
function _ensureAcStyles() {
  if (document.getElementById('bs-ac-styles')) return;
  const style = document.createElement('style');
  style.id = 'bs-ac-styles';
  style.textContent = `
    .bs-ac-wrap { position: relative; }
    .bs-ac-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0; right: 0;
      background: var(--c-surface, #fff);
      border: 1.5px solid var(--c-border, #e0e0e0);
      border-radius: var(--r-md, 10px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      z-index: 9999;
      overflow: hidden;
      max-height: 260px;
      overflow-y: auto;
    }
    .bs-ac-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 14px;
      cursor: pointer;
      font-size: 13.5px;
      color: var(--c-ink, #222);
      border-bottom: 1px solid var(--c-border-faint, #f0f0f0);
      transition: background 0.1s;
    }
    .bs-ac-item:last-child { border-bottom: none; }
    .bs-ac-item:hover, .bs-ac-item.focused {
      background: var(--c-surface-raised, #f5f5f5);
    }
    .bs-ac-item svg { flex-shrink: 0; opacity: 0.45; }
    .bs-ac-loading, .bs-ac-empty {
      padding: 12px 14px;
      font-size: 13px;
      color: var(--c-ink-faint, #999);
      text-align: center;
    }
  `;
  document.head.appendChild(style);
}

/** Wrap the city input in a relative-position container. */
function _ensureAcWrap() {
  const input = document.getElementById(cfg.filterCityId);
  if (!input) return null;
  if (input.parentElement.classList.contains('bs-ac-wrap')) return input;
  const wrap = document.createElement('div');
  wrap.className = 'bs-ac-wrap';
  wrap.style.cssText = 'position:relative;flex:1;display:flex;align-items:center;';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  // Move locate button inside wrap too
  const locateBtn = document.getElementById(cfg.filterLocateBtnId);
  if (locateBtn) wrap.appendChild(locateBtn);
  return input;
}

/** Remove dropdown from DOM and cancel any in-flight request. */
function _destroyCityAutocomplete() {
  _acDropdown?.remove();
  _acDropdown = null;
  _acAbortCtrl?.abort();
  _acAbortCtrl = null;
}

function _acShowLoading() {
  if (!_acDropdown) return;
  _acDropdown.innerHTML = `<div class="bs-ac-loading">Searching…</div>`;
}

/** Render deduplicated suggestion list. */
function _acRenderItems(items, input) {
  if (!_acDropdown) return;
  if (items.length === 0) {
    _acDropdown.innerHTML = `<div class="bs-ac-empty">No areas found. Try a different name.</div>`;
    return;
  }

  const pinIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;

  _acDropdown.innerHTML = items.map((item, i) => {
    const label = _formatNominatimLabel(item);
    return `<div class="bs-ac-item" data-idx="${i}" data-lat="${item.lat}" data-lng="${item.lon}" data-label="${label.replace(/"/g, '&quot;')}">
      ${pinIcon}
      <span>${label}</span>
    </div>`;
  }).join('');

  _acDropdown.querySelectorAll('.bs-ac-item').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      const lat   = parseFloat(el.dataset.lat);
      const lng   = parseFloat(el.dataset.lng);
      const label = el.dataset.label;

      _acSelectedFromDropdown = true;
      input.value = label;
      bsUserLat = lat;
      bsUserLng = lng;

      _destroyCityAutocomplete();
    });
  });
}

/**
 * Fetch suggestions from Nominatim.
 *
 * FIX: Append '*' wildcard so partial input (e.g. "borival") matches
 * "Borivali", "Borivali East", "Borivali West", etc.
 * Nominatim supports wildcard search via the structured search endpoint
 * when the query ends with '*'.
 *
 * FIX: Deduplicate results by formatted label before rendering so the
 * user never sees two identical entries like "R/C Ward, Maharashtra".
 */
async function _acFetch(query, input) {
  // Cancel any previous in-flight request
  _acAbortCtrl?.abort();
  _acAbortCtrl = new AbortController();

  _acShowLoading();

  try {
    // Append wildcard for partial/prefix matching
    const wildcardQuery = query.trim().endsWith('*') ? query.trim() : `${query.trim()}*`;

    const url = `${_NOMINATIM_URL}?q=${encodeURIComponent(wildcardQuery)}&countrycodes=in&addressdetails=1&limit=8&format=json&accept-language=en`;
    const res  = await fetch(url, {
      signal: _acAbortCtrl.signal,
      headers: { 'Accept-Language': 'en' },
    });
    const data = await res.json();

    // Deduplicate by formatted label
    const seen    = new Set();
    const deduped = data.filter(item => {
      const label = _formatNominatimLabel(item);
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });

    _acRenderItems(deduped, input);
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (_acDropdown) _acDropdown.innerHTML = `<div class="bs-ac-empty">Could not fetch suggestions.</div>`;
  }
}

/** Attach autocomplete to the city input. */
function _initCityAutocomplete() {
  _ensureAcStyles();
  const input = _ensureAcWrap();
  if (!input) return;

  input.setAttribute('autocomplete', 'off');

  input.addEventListener('input', () => {
    if (_acSelectedFromDropdown) {
      _acSelectedFromDropdown = false;
      return;
    }
    clearTimeout(_acDebounceTimer);
    const q = input.value.trim();
    if (q.length < 2) { _destroyCityAutocomplete(); return; }

    if (!_acDropdown) {
      _acDropdown = document.createElement('div');
      _acDropdown.className = 'bs-ac-dropdown';
      input.parentElement.appendChild(_acDropdown);
    }

    // 350 ms debounce — fires _acFetch which appends the wildcard
    _acDebounceTimer = setTimeout(() => _acFetch(q, input), 350);
  });

  input.addEventListener('blur', () => {
    setTimeout(_destroyCityAutocomplete, 180);
  });

  input.addEventListener('keydown', e => {
    if (!_acDropdown) return;
    const items   = _acDropdown.querySelectorAll('.bs-ac-item');
    const focused = _acDropdown.querySelector('.bs-ac-item.focused');
    let idx = focused ? parseInt(focused.dataset.idx) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focused?.classList.remove('focused');
      idx = Math.min(idx + 1, items.length - 1);
      items[idx]?.classList.add('focused');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focused?.classList.remove('focused');
      idx = Math.max(idx - 1, 0);
      items[idx]?.classList.add('focused');
    } else if (e.key === 'Enter' && focused) {
      e.preventDefault();
      const lat   = parseFloat(focused.dataset.lat);
      const lng   = parseFloat(focused.dataset.lng);
      const label = focused.dataset.label;
      _acSelectedFromDropdown = true;
      input.value = label;
      bsUserLat = lat;
      bsUserLng = lng;
      _destroyCityAutocomplete();
    } else if (e.key === 'Escape') {
      _destroyCityAutocomplete();
    }
  });
}

// ── Bind all filter-related events ────────────────────────────
function _bindFilterEvents() {
  document.getElementById(cfg.filterBtnId)?.addEventListener('click', () => {
    bsOpenFilterSheet();
    _initCityAutocomplete();
  });

  document.getElementById(cfg.filterOverlayId)?.addEventListener('click', bsCloseFilterSheet);

  document.querySelectorAll(cfg.priceTypeBtnSelector).forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(cfg.priceTypeBtnSelector).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ── GPS detect ───────────────────────────────────────────────
  document.getElementById(cfg.filterLocateBtnId)?.addEventListener('click', () => {
    if (!navigator.geolocation) { toastError('Your browser does not support location.'); return; }
    const btn = document.getElementById(cfg.filterLocateBtnId);
    btn.disabled = true; btn.style.opacity = '0.5';
    toastInfo('Looking for your location…');

    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      bsUserLat = latitude;
      bsUserLng = longitude;

      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&accept-language=en`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        const a    = data.address || {};

        const area  = a.suburb || a.neighbourhood || a.quarter || a.residential || '';
        const city  = a.city   || a.town  || a.village || '';
        const state = a.state  || '';

        const raw   = [area, city, state];
        const parts = [];
        for (const seg of raw) {
          if (!seg) continue;
          if (parts.length && parts[parts.length - 1] === seg) continue;
          parts.push(seg);
        }

        const label = parts.join(', ');
        if (label) {
          document.getElementById(cfg.filterCityId).value = label;
        } else {
          toastError("Couldn't determine your area.");
        }
      } catch {
        toastError('Location lookup failed.');
        // Coordinates are still saved — backend can use them for distance sorting.
      } finally {
        btn.disabled = false; btn.style.opacity = '1';
      }
    }, err => {
      const msgs = { 1: 'Location permission denied.', 2: 'Location unavailable.', 3: 'Request timed out.' };
      toastError(msgs[err.code] || 'Could not get your location.');
      btn.disabled = false; btn.style.opacity = '1';
    });
  });

  // ── Apply filters ─────────────────────────────────────────────
  document.getElementById(cfg.filterApplyBtnId)?.addEventListener('click', () => {
    const selectedType = document.querySelector(`${cfg.priceTypeBtnSelector}.active`)?.dataset.type || '';
    bsActiveFilters.category = document.getElementById(cfg.filterCategoryId).value;
    bsActiveFilters.city     = document.getElementById(cfg.filterCityId).value.trim();

    // Clear coords if city was cleared manually
    if (!bsActiveFilters.city) {
      bsUserLat = null;
      bsUserLng = null;
    }

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

  // ── Clear filters ─────────────────────────────────────────────
  document.getElementById(cfg.filterClearBtnId)?.addEventListener('click', () => {
    bsResetFilters(false);
    bsCloseFilterSheet();
    bsRenderActiveFilterChips();
    bsUpdateFilterBadge();
    onLoadHomepage();
  });

  // ── Search debounce ───────────────────────────────────────────
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
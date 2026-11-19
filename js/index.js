/* ============================================================
   OLR INDIA - INDEX PAGE JS  (v4)
   Page-specific only. Shared browse logic → js/shared/browse.js
   ============================================================ */

const PAGE_INITIAL = 20;
const PAGE_MORE    = 20;

// ── Product card HTML ─────────────────────────────────────────
function productCardHTML(p) {
  const img = p.images && p.images[0]
    ? `<img class="product-img" src="${p.images[0]}" alt="${p.name}" loading="lazy">`
    : `<div class="product-img-placeholder"></div>`;

  const price = bsBuildPriceLabel(p);

  const badge = p.vendor_badge === 'featured'
    ? `<span class="vendor-badge badge-premium">★ Top Vendor</span>`
    : p.vendor_badge === 'verified'
      ? `<span class="vendor-badge badge-growth">✓ Verified</span>`
      : '';

  return `
  <div class="product-card" onclick="bsOpenProduct('${p.share_slug}','${p.category || ''}','${p.city || ''}')">
    ${img}${badge}
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
      ${bsActiveTab === 'all'
        ? `<div class="listing-type-chip ${p.listing_type === 'sell' ? 'chip-sell' : 'chip-rent'}">
             ${p.listing_type === 'sell' ? 'FOR SALE' : 'FOR RENT'}
           </div>`
        : ''}
    </div>
  </div>`;
}

// ── Load products (passed to browseSharedInit) ────────────────
async function loadProducts(reset = true) {
  const grid = document.getElementById('productGrid');
  grid.style.display = 'grid';
  if (reset) {
    bsCurrentPage = 1;
    grid.innerHTML = Array(PAGE_INITIAL).fill(bsSkeletonCardHTML()).join('');
  }
  try {
    const data = await apiRequest(`/products/public?${bsBuildParams(bsCurrentPage, PAGE_INITIAL)}`, 'GET');
    if (data.success) {
      bsTotalProducts = data.total;
      bsHasMore       = data.has_more;
      bsRenderProducts(data.products);
      bsUpdateFilterBadge();
      bsAttachSentinel();
    }
  } catch {
    grid.innerHTML = `<div class="grid-empty"><div style="font-size:40px">😕</div><p>Failed to load products. Please refresh.</p></div>`;
  }
}

// ── Load homepage (passed to browseSharedInit) ────────────────
async function loadHomepage() {
  const { catGrid, homeProdGrid } = bsRenderHomepageShell();

  const [catData, prodData] = await Promise.all([
    apiRequest(`/products/categories?listing_type=${bsActiveTab}`, 'GET').catch(() => null),
    apiRequest(`/products/public?page=1&per_page=${PAGE_INITIAL}&listing_type=${bsActiveTab}`, 'GET').catch(() => null),
  ]);

  bsHasMore       = prodData?.has_more ?? false;
  bsTotalProducts = prodData?.total    ?? 0;
  bsCurrentPage   = 1;
  bsRenderCatGrid(catGrid, catData?.categories, 'bsEnterCategory');
  bsRenderHomeProdGrid(homeProdGrid, prodData?.products);
  if (bsHasMore) bsAttachSentinel();
  setTimeout(() => window.retranslateDynamic?.(), 600);
}

// ── Wishlist (public: prompt login) ───────────────────────────
function handleWish(btn, productId) {
  if (!sessionStorage.getItem('olr_user')) { openAuthModal(); return; }
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
  if (e.key === 'Escape') { closeAuthModal(); bsCloseFilterSheet(); }
});

// ── Tab switching (public page wrapper) ───────────────────────
function switchTab(tab) { bsSwitchTab(tab); }

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  browseSharedInit({
    tabAllId:  'tabAll', 
    tabRentId:               'tabRent',
    tabBuyId:                'tabSell',
    filterGroupPriceTypeId:  'filterGroupPriceType',
    filterGroupConditionId:  'filterGroupCondition',
    filterCategoryId:        'filterCategory',
    filterCityId:            'filterCity',
    filterConditionId:       'filterCondition',
    filterPriceMinId:        'filterPriceMin',
    filterPriceMaxId:        'filterPriceMax',
    filterPriceHintId:       'filterPriceHint',
    filterBtnId:             'filterBtn',
    filterOverlayId:         'filterOverlay',
    filterSheetId:           'filterSheet',
    filterApplyBtnId:        'filterApplyBtn',
    filterClearBtnId:        'filterClearBtn',
    filterLocateBtnId:       'filterLocateBtn',
    filterCountBadgeId:      'filterCountBadge',
    activeFiltersId:         'activeFilters',
    activeChipClass:         'active-chip',
    priceTypeBtnSelector:    '.price-type-btn',
    searchId:                'searchInput',
    productGridId:           'productGrid',
    productsCountId:         'productsCount',
    productsTitleId:         'productsTitle',
  }, {
    loadHomepage:    loadHomepage,
    loadProducts:    loadProducts,
    productCardHTML: productCardHTML,
  });
  // ── List Item Button visibility ───────────────────────────────
(function initListBtn() {
  const hasSess = sessionStorage.getItem('olr_user') || sessionStorage.getItem('olr_vendor');
  if (hasSess) return; // session exists → show nothing

  // show both, CSS handles which one is visible per screen
  document.getElementById('fabListBtn')?.classList.add('visible');
  document.getElementById('navListBtn')?.classList.add('visible');
})();
  loadHomepage();
});
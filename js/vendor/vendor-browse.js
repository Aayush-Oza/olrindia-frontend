/* ============================================================
   OLR INDIA – VENDOR BROWSE JS  (v4)
   Requires: browse.js, vendor-nav.js
   ============================================================ */

// ── Vendor product card ───────────────────────────────────────
function vsProductCardHTML(p) {
  const img = p.images && p.images[0]
    ? `<img class="product-img" src="${p.images[0]}" alt="${p.name}" loading="lazy">`
    : `<div class="product-img-placeholder">📦</div>`;

  const badge = p.vendor_badge === 'featured'
    ? `<span class="vendor-badge badge-premium">★ Top Vendor</span>`
    : p.vendor_badge === 'verified'
      ? `<span class="vendor-badge badge-growth">✓ Verified</span>`
      : '';

  return `
    <div class="product-card" onclick="bsOpenProduct('${p.share_slug}', '${p.category}', '${p.city || ''}')">
      ${img}${badge}
      <div class="product-body">
        <div class="product-cat">${p.category || ''}</div>
        <div class="product-title">${p.name}</div>
        <div class="product-bottom">
          <div class="product-price">${bsBuildPriceLabel(p)}</div>
          <div class="product-loc">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z" stroke="currentColor" stroke-width="2"/></svg>
            ${p.city || ''}
          </div>
        </div>
      </div>
    </div>`;
}

// ── Load products (passed as callback) ────────────────────────
async function vsLoadProducts(reset = true) {
  if (reset) {
    bsCurrentPage = 1;
    document.getElementById('vsProductGrid').innerHTML =
      Array(20).fill(bsSkeletonCardHTML()).join('');
  }
  try {
    const res = await apiRequest(`/products/public?${bsBuildParams(bsCurrentPage, 20)}`, 'GET');
    if (!res.success) {
      document.getElementById('vsProductGrid').innerHTML =
        `<div class="grid-empty"><div style="font-size:40px">😕</div><p>Failed to load products.</p></div>`;
      return;
    }
    bsTotalProducts = res.total;
    bsHasMore       = res.has_more;
    bsRenderProducts(res.products);
    bsAttachSentinel();
    bsUpdateFilterBadge();
  } catch {
    document.getElementById('vsProductGrid').innerHTML =
      `<div class="grid-empty"><div style="font-size:40px">😕</div><p>Failed to load products.</p></div>`;
  }
}

// ── Load homepage (passed as callback) ────────────────────────
async function vsLoadHomepage() {
  const { catGrid, homeProdGrid } = bsRenderHomepageShell(8);

  const [catData, prodData] = await Promise.all([
    apiRequest(`/products/categories?listing_type=${bsActiveTab}`, 'GET').catch(() => null),
    apiRequest(`/products/public?page=1&per_page=20&listing_type=${bsActiveTab}`, 'GET').catch(() => null),
  ]);

  bsHasMore       = prodData?.has_more ?? false;
  bsTotalProducts = prodData?.total    ?? 0;
  bsCurrentPage   = 1;
  bsRenderCatGrid(catGrid, catData?.categories, 'bsEnterCategory');
  bsRenderHomeProdGrid(homeProdGrid, prodData?.products);

  if (bsHasMore) bsAttachSentinel();
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadVendorProfile();

  browseSharedInit(
    {
      // tabs
      tabRentId:               'tabRent',
      tabBuyId:                'tabBuy',
      // filter sheet
      filterSheetId:           'vsFilterSheet',
      filterOverlayId:         'vsFilterOverlay',
      filterBtnId:             'vsFilterBtn',
      filterApplyBtnId:        'vsFilterApplyBtn',
      filterClearBtnId:        'vsFilterClearBtn',
      filterCountBadgeId:      'vsFilterCountBadge',
      filterGroupPriceTypeId:  'vsFilterGroupPriceType',
      filterGroupConditionId:  'vsFilterGroupCondition',
      // filter inputs
      filterCategoryId:        'vsFilterCategory',
      filterCityId:            'vsFilterCity',
      filterConditionId:       'vsFilterCondition',
      filterPriceMinId:        'vsFilterPriceMin',
      filterPriceMaxId:        'vsFilterPriceMax',
      filterPriceHintId:       'vsFilterPriceHint',
      filterLocateBtnId:       'vsFilterLocateBtn',
      priceTypeBtnSelector:    '.price-type-btn',
      // active chips
      activeFiltersId:         'vsActiveFilters',
      activeChipClass:         'active-chip',
      // product grid
      productGridId:           'vsProductGrid',
      productsCountId:         'vsProductsCount',
      productsTitleId:         'vsProductsTitle',
      // search
      searchId:                'vsSearchInput',
    },
    {
      loadHomepage:    vsLoadHomepage,
      loadProducts:    vsLoadProducts,
      productCardHTML: vsProductCardHTML,
    }
  );

  vsLoadHomepage();
});
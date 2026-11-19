/* ============================================================
   OLR INDIA - USER BROWSE JS  (v4)
   Page-specific only. Shared browse logic → js/shared/browse.js
   ============================================================ */

const wishedIds = new Set();
const wishedSlugs = new Map();

// ── Product card HTML ─────────────────────────────────────────
function productCardHTML(p) {
  if (p.id && p.share_slug) wishedSlugs.set(p.id, p.share_slug);
  const img = p.images && p.images[0]
    ? `<img class="product-img" src="${p.images[0]}" alt="${p.name}" loading="lazy">`
    : `<div class="product-img-placeholder">📦</div>`;
  const price = bsBuildPriceLabel(p);
  const wished = wishedIds.has(p.id);
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
    grid.innerHTML = Array(20).fill(bsSkeletonCardHTML()).join('');
  }
  try {
    const res = await apiRequest(`/products/public?${bsBuildParams(bsCurrentPage, 20)}`, 'GET');
    if (!res.success) { grid.innerHTML = `<div class="grid-empty"><div style="font-size:40px">😕</div><p>Failed to load products.</p></div>`; return; }
    bsTotalProducts = res.total;
    bsHasMore = res.has_more;
    bsRenderProducts(res.products);
    bsUpdateFilterBadge();
    bsAttachSentinel();
  } catch {
    grid.innerHTML = `<div class="grid-empty"><div style="font-size:40px">😕</div><p>Failed to load products. Please refresh.</p></div>`;
  }
}

// ── Load homepage (passed to browseSharedInit) ────────────────
async function loadHomepage() {
  const { catGrid, homeProdGrid } = bsRenderHomepageShell();

  const [catData, prodData] = await Promise.all([
    apiRequest(`/products/categories?listing_type=${bsActiveTab}`, 'GET').catch(() => null),
    apiRequest(`/products/public?page=1&per_page=20&listing_type=${bsActiveTab}`, 'GET').catch(() => null),
  ]);

  bsHasMore = prodData?.has_more ?? false;
  bsTotalProducts = prodData?.total ?? 0;
  bsCurrentPage = 1;
  bsRenderCatGrid(catGrid, catData?.categories, 'bsEnterCategory');
  bsRenderHomeProdGrid(homeProdGrid, prodData?.products);
  if (bsHasMore) bsAttachSentinel();
}

// ── Wishlist ──────────────────────────────────────────────────
async function toggleWish(btn, productId) {
  const isWished = wishedIds.has(productId);
  if (isWished) { wishedIds.delete(productId); toastSuccess('Removed from wishlist'); }
  else { wishedIds.add(productId); toastSuccess('Added to wishlist'); }
  document.querySelectorAll('.product-wish-btn').forEach(b => {
    const match = b.getAttribute('onclick')?.match(/toggleWish\(this,(\d+)\)/);
    if (match && parseInt(match[1]) === productId) { b.classList.toggle('active', !isWished); b.textContent = isWished ? '♡' : '♥'; }
  });
  updateWishlistBadge();
  try {
    if (isWished) await apiRequest(`/auth/user/wishlist/${productId}`, 'DELETE');
    else await apiRequest('/auth/user/wishlist', 'POST', { product_id: productId });
  } catch {
    if (isWished) wishedIds.add(productId); else wishedIds.delete(productId);
    document.querySelectorAll('.product-wish-btn').forEach(b => {
      const match = b.getAttribute('onclick')?.match(/toggleWish\(this,(\d+)\)/);
      if (match && parseInt(match[1]) === productId) { b.classList.toggle('active', isWished); b.textContent = isWished ? '♥' : '♡'; }
    });
    updateWishlistBadge(); toastError('Failed to update wishlist.');
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

// ── Tab switching (HTML onclick wrapper) ──────────────────────
function switchTab(tab) { bsSwitchTab(tab); }

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  browseSharedInit({
    tabAllId: 'tabAll',
    tabRentId: 'tabRent',
    tabBuyId: 'tabSell',
    filterGroupPriceTypeId: 'filterGroupPriceType',
    filterGroupConditionId: 'filterGroupCondition',
    filterCategoryId: 'filterCategory',
    filterCityId: 'filterCity',
    filterConditionId: 'filterCondition',
    filterPriceMinId: 'filterPriceMin',
    filterPriceMaxId: 'filterPriceMax',
    filterPriceHintId: 'filterPriceHint',
    filterBtnId: 'filterBtn',
    filterOverlayId: 'filterOverlay',
    filterSheetId: 'filterSheet',
    filterApplyBtnId: 'filterApplyBtn',
    filterClearBtnId: 'filterClearBtn',
    filterLocateBtnId: 'filterLocateBtn',
    filterCountBadgeId: 'filterCountBadge',
    activeFiltersId: 'activeFilters',
    activeChipClass: 'active-chip',
    priceTypeBtnSelector: '.price-type-btn',
    searchId: 'searchInput',
    productGridId: 'productGrid',
    productsCountId: 'productsCount',
    productsTitleId: 'productsTitle',
  }, {
    loadHomepage: loadHomepage,
    loadProducts: loadProducts,
    productCardHTML: productCardHTML,
  });

  loadNavUser();
  loadHomepage();
  loadWishlist().catch(err => console.error('Wishlist load failed:', err));

  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get('category');
  if (catParam) bsEnterCategory(catParam);
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) { loadHomepage(); loadWishlist().catch(() => { }); }
});
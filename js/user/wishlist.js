/* ============================================================
   OLR INDIA - WISHLIST JS
   Requires: user-nav.js (loaded before this)
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
const wishedIds  = new Set();
const wishedSlugs = new Map();

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

// ── Product card ──────────────────────────────────────────────
function productCardHTML(p) {
  if (p.id && p.share_slug) wishedSlugs.set(p.id, p.share_slug);
  const img = p.images && p.images[0]
    ? `<img class="product-img" src="${p.images[0]}" alt="${p.name}" loading="lazy">`
    : `<div class="product-img-placeholder">📦</div>`;
  const price  = buildPriceLabel(p, '');
  const wished = wishedIds.has(p.id);
  const badge  = p.vendor_badge === 'featured'
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

// ── Wishlist badge ────────────────────────────────────────────
function updateWishlistBadge() {
  ['wishlistCount', 'wishlistCountMobile'].forEach(id => {
    const badge = document.getElementById(id);
    if (!badge) return;
    badge.style.display = wishedIds.size > 0 ? 'inline' : 'none';
    badge.textContent   = wishedIds.size;
  });
}

// ── Toggle wish ───────────────────────────────────────────────
async function toggleWish(btn, productId) {
  const isWished = wishedIds.has(productId);
  if (isWished) { wishedIds.delete(productId); toastSuccess('Removed from wishlist'); }
  else          { wishedIds.add(productId);    toastSuccess('Added to wishlist'); }

  document.querySelectorAll('.product-wish-btn').forEach(b => {
    const match = b.getAttribute('onclick')?.match(/toggleWish\(this,(\d+)\)/);
    if (match && parseInt(match[1]) === productId) {
      b.classList.toggle('active', !isWished);
      b.textContent = isWished ? '♡' : '♥';
    }
  });
  updateWishlistBadge();

  if (isWished) {
    const card = document.querySelector(`#wishlistContent [onclick*="toggleWish(this,${productId})"]`)?.closest('.product-card');
    if (card) {
      card.style.transition = 'opacity 0.2s, transform 0.2s';
      card.style.opacity    = '0';
      card.style.transform  = 'scale(0.95)';
      setTimeout(() => {
        card.remove();
        if (document.querySelectorAll('#wishlistContent .product-card').length === 0) renderWishlistPanel();
      }, 200);
    }
  }

  try {
    if (isWished) await apiRequest(`/auth/user/wishlist/${productId}`, 'DELETE');
    else          await apiRequest('/auth/user/wishlist', 'POST', { product_id: productId });
  } catch {
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

// ── Render wishlist panel ─────────────────────────────────────
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
          <a class="btn btn-primary" href="/user/browse" style="width:auto;padding:10px 24px;display:inline-flex;margin-top:8px;">Browse products</a>
        </div>`;
      return;
    }
    el.innerHTML = `<div class="product-grid">${products.map(p => productCardHTML(p)).join('')}</div>`;
  } catch {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">😕</div>
        <h3>Failed to load wishlist</h3>
        <button class="btn btn-primary" onclick="renderWishlistPanel()" style="width:auto;padding:10px 24px;display:inline-flex;margin-top:8px;">Retry</button>
      </div>`;
  }
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadNavUser();
  renderWishlistPanel();
});
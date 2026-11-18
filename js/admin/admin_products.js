/* ============================================================
   OLR INDIA - ADMIN PRODUCTS PAGE JS
   Requires: admin-nav.js
   ============================================================ */

const state = { page: 1, hasMore: true, loading: false };
let pendingProductId = null;

// ── Load ──────────────────────────────────────────────────────
async function loadProducts(reset = true) {
  if (reset) { state.page = 1; state.hasMore = true; }
  if (state.loading || !state.hasMore) return;
  state.loading = true;

  const params = new URLSearchParams();
  const search   = document.getElementById('productSearch')?.value.trim() || '';
  const status   = document.getElementById('productStatusFilter')?.value || '';
  const reviewed = document.getElementById('productReviewedFilter')?.value || '';
  if (search)   params.set('search',   search);
  if (status)   params.set('status',   status);
  if (reviewed) params.set('reviewed', reviewed);
  params.set('page', state.page);

  const res = await apiRequest(`/auth/admin/products?${params}`, 'GET');
  state.loading = false;
  if (!res.success) return;

  state.hasMore = res.has_more;
  renderProducts(res.products, reset);
  renderActiveFilters();
  renderLoadMore('product', loadProducts, state.hasMore);
  state.page = reset ? 2 : state.page + 1;
}

// ── Render ────────────────────────────────────────────────────
function renderProducts(products, reset = true) {
  const body = document.getElementById('productListBody');
  if (reset && (!products || products.length === 0)) {
    body.innerHTML = `<div class="admin-empty">No products found.</div>`; return;
  }
  const rows = products.map(p => {
    const url = `/product?slug=${p.slug}&admin=1`;
    const img = p.image ? `<img src="${p.image}" class="admin-thumb" alt="${p.name}">` : `<div class="admin-thumb"></div>`;
    return `<tr>
      <td><a href="${url}">${img}</a></td>
      <td><a href="${url}" style="text-decoration:none;color:inherit;"><strong>${p.name}</strong><br><small>${p.category}</small></a></td>
      <td>${p.vendor_name}</td>
      <td><button class="admin-action-btn danger" data-action="remove-product" data-id="${p.id}" data-slug="${p.slug}">Remove</button></td>
    </tr>`;
  }).join('');
  const cards = products.map(p => {
    const url = `/product?slug=${p.slug}&admin=1`;
    const img = p.image ? `<img src="${p.image}" class="admin-thumb" alt="${p.name}">` : `<div class="admin-thumb"></div>`;
    return `<div class="admin-row-card">
      <div class="admin-row-card-top"><a href="${url}">${img}</a><a href="${url}"><strong>${p.name}</strong><small>${p.category}</small></a></div>
      <div class="admin-row-card-meta"><label>Vendor</label><span>${p.vendor_name}</span></div>
      <div class="admin-row-card-actions"><button class="admin-action-btn danger" data-action="remove-product" data-id="${p.id}" data-slug="${p.slug}">Remove</button></div>
    </div>`;
  }).join('');

  if (reset) {
    body.innerHTML = `
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Image</th><th>Product</th><th>Vendor</th><th>Action</th></tr></thead>
        <tbody id="productTableBody">${rows}</tbody>
      </table></div>
      <div class="admin-row-cards" id="productCardsList">${cards}</div>`;
  } else {
    document.getElementById('productTableBody')?.insertAdjacentHTML('beforeend', rows);
    document.getElementById('productCardsList')?.insertAdjacentHTML('beforeend', cards);
  }
}

// ── Active filter chips ───────────────────────────────────────
const LABELS = {
  status:   { active: 'Live only', inactive: 'Inactive only' },
  reviewed: { viewed: 'Viewed only', unviewed: 'Unviewed only' },
};
function renderActiveFilters() {
  const container = document.getElementById('productActiveFilters');
  if (!container) return;
  const status   = document.getElementById('productStatusFilter')?.value || '';
  const reviewed = document.getElementById('productReviewedFilter')?.value || '';
  const chips = [];
  if (status)   chips.push({ key: 'status',   label: LABELS.status[status] });
  if (reviewed) chips.push({ key: 'reviewed', label: LABELS.reviewed[reviewed] });
  if (!chips.length) { container.innerHTML = ''; return; }
  container.innerHTML = chips.map(c => `
    <button class="active-chip" data-clear="${c.key}">${c.label}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
    </button>`).join('');
  container.querySelectorAll('[data-clear]').forEach(chip => {
    chip.addEventListener('click', () => {
      if (chip.dataset.clear === 'status')   document.getElementById('productStatusFilter').value = '';
      if (chip.dataset.clear === 'reviewed') document.getElementById('productReviewedFilter').value = '';
      window.filterBadgeUpdaters?.product?.();
      loadProducts();
    });
  });
}

// ── Remove product modal ──────────────────────────────────────
const removeModal   = document.getElementById('removeProductModal');
const removeReason  = document.getElementById('removeReasonInput');

document.getElementById('productListBody')?.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action="remove-product"]');
  if (!btn) return;
  pendingProductId = btn.dataset.id;
  removeReason.value = '';
  removeModal.classList.add('is-open');
});

document.getElementById('removeProductCancel')?.addEventListener('click', () => removeModal.classList.remove('is-open'));

document.getElementById('removeProductConfirm')?.addEventListener('click', async () => {
  const reason = removeReason.value.trim();
  if (!reason) { showToast('Please explain why this listing is being removed.', 'error'); return; }
  const res = await apiRequest(`/auth/admin/products/${pendingProductId}/remove`, 'POST', { reason });
  removeModal.classList.remove('is-open');
  if (res.success) {
    showToast(res.auto_suspended
      ? 'Product removed. Vendor reached 3 strikes and was auto-suspended.'
      : `Product removed. Vendor now has ${res.strike_count} strike(s).`, 'success');
    loadProducts();
  } else {
    showToast(res.message || 'Failed to remove product.', 'error');
  }
});

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAdminProfile();
  setupFilterSheet('product', ['productStatusFilter', 'productReviewedFilter']);
  document.getElementById('productSearch')?.addEventListener('input', debounce(loadProducts, 400));
  document.getElementById('productStatusFilter')?.addEventListener('change', loadProducts);
  document.getElementById('productReviewedFilter')?.addEventListener('change', loadProducts);
  document.getElementById('productFilterApply')?.addEventListener('click', loadProducts);
  loadProducts();
});
/* ============================================================
   OLR INDIA - ADMIN VENDORS PAGE JS
   Requires: admin-nav.js
   ============================================================ */

const state = { page: 1, hasMore: true, loading: false };

// ── Load ──────────────────────────────────────────────────────
async function loadVendors(reset = true) {
  if (reset) { state.page = 1; state.hasMore = true; }
  if (state.loading || !state.hasMore) return;
  state.loading = true;

  const params = new URLSearchParams();
  const search = document.getElementById('vendorSearch')?.value.trim() || '';
  const city   = document.getElementById('vendorCityFilter')?.value.trim() || '';
  const area   = document.getElementById('vendorAreaFilter')?.value.trim() || '';
  const st     = document.getElementById('vendorStateFilter')?.value.trim() || '';
  const plan   = document.getElementById('vendorPlanFilter')?.value || '';
  const flag   = document.getElementById('vendorFlagFilter')?.value || '';
  if (search) params.set('search', search);
  if (city)   params.set('city',   city);
  if (area)   params.set('area',   area);
  if (st)     params.set('state',  st);
  if (plan)   params.set('plan',   plan);
  if (flag)   params.set('flag',   flag);
  params.set('page', state.page);

  const res = await apiRequest(`/auth/admin/vendors?${params}`, 'GET');
  state.loading = false;
  if (!res.success) return;

  state.hasMore = res.has_more;
  renderVendors(res.vendors, reset);
  renderActiveFilters();
  renderLoadMore('vendor', loadVendors, state.hasMore);
  state.page = reset ? 2 : state.page + 1;
}

// ── Render ────────────────────────────────────────────────────
function renderVendors(vendors, reset = true) {
  const body = document.getElementById('vendorListBody');
  if (reset && (!vendors || vendors.length === 0)) {
    body.innerHTML = `<div class="admin-empty">No vendors found.</div>`; return;
  }
  const rows = vendors.map(v => `
    <tr class="admin-row-clickable" data-id="${v.id}">
      <td><strong>${v.name}</strong></td>
      <td>${v.email}</td>
      <td>${v.mobile}</td>
    </tr>`).join('');
  const cards = vendors.map(v => `
    <div class="admin-row-card admin-row-clickable" data-id="${v.id}">
      <div class="admin-row-card-top"><div><strong>${v.name}</strong></div></div>
      <div class="admin-row-card-fields">
        <div><label>Email</label><span>${v.email}</span></div>
        <div><label>Mobile</label><span>${v.mobile}</span></div>
      </div>
    </div>`).join('');

  if (reset) {
    body.innerHTML = `
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Vendor</th><th>Email</th><th>Mobile</th></tr></thead>
        <tbody id="vendorTableBody">${rows}</tbody>
      </table></div>
      <div class="admin-row-cards" id="vendorCardsList">${cards}</div>`;
  } else {
    document.getElementById('vendorTableBody')?.insertAdjacentHTML('beforeend', rows);
    document.getElementById('vendorCardsList')?.insertAdjacentHTML('beforeend', cards);
  }

  body.querySelectorAll('.admin-row-clickable').forEach(el => {
    el.addEventListener('click', () => { window.location.href = `/admin/vendor-detail?id=${el.dataset.id}`; });
  });
}

// ── Active filter chips ───────────────────────────────────────
const FLAG_LABELS = { flagged: 'Has strikes', suspended: 'Suspended only', active: 'Active only' };
function renderActiveFilters() {
  const container = document.getElementById('vendorActiveFilters');
  if (!container) return;
  const city  = document.getElementById('vendorCityFilter')?.value.trim() || '';
  const area  = document.getElementById('vendorAreaFilter')?.value.trim() || '';
  const st    = document.getElementById('vendorStateFilter')?.value.trim() || '';
  const plan  = document.getElementById('vendorPlanFilter')?.value || '';
  const flag  = document.getElementById('vendorFlagFilter')?.value || '';
  const chips = [];
  if (city)  chips.push({ key: 'city',  label: `City: ${city}` });
  if (area)  chips.push({ key: 'area',  label: `Area: ${area}` });
  if (st)    chips.push({ key: 'state', label: `State: ${st}` });
  if (plan)  chips.push({ key: 'plan',  label: `Plan: ${plan.charAt(0).toUpperCase() + plan.slice(1)}` });
  if (flag)  chips.push({ key: 'flag',  label: FLAG_LABELS[flag] });
  if (!chips.length) { container.innerHTML = ''; return; }
  container.innerHTML = chips.map(c => `
    <button class="active-chip" data-clear="${c.key}">${c.label}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
    </button>`).join('');
  container.querySelectorAll('[data-clear]').forEach(chip => {
    chip.addEventListener('click', () => {
      const k = chip.dataset.clear;
      if (k === 'city')  document.getElementById('vendorCityFilter').value = '';
      if (k === 'area')  document.getElementById('vendorAreaFilter').value = '';
      if (k === 'state') document.getElementById('vendorStateFilter').value = '';
      if (k === 'plan')  document.getElementById('vendorPlanFilter').value = '';
      if (k === 'flag')  document.getElementById('vendorFlagFilter').value = '';
      window.filterBadgeUpdaters?.vendor?.();
      loadVendors();
    });
  });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAdminProfile();
  setupFilterSheet('vendor', ['vendorCityFilter', 'vendorAreaFilter', 'vendorStateFilter', 'vendorPlanFilter', 'vendorFlagFilter']);
  document.getElementById('vendorSearch')?.addEventListener('input', debounce(loadVendors, 400));
  document.getElementById('vendorFilterApplyBtn')?.addEventListener('click', loadVendors);
  loadVendors();
});
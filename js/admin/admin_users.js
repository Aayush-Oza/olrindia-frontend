/* ============================================================
   OLR INDIA - ADMIN USERS PAGE JS
   Requires: admin-nav.js
   ============================================================ */

const state = { page: 1, hasMore: true, loading: false };

// ── Load ──────────────────────────────────────────────────────
async function loadUsers(reset = true) {
  if (reset) { state.page = 1; state.hasMore = true; }
  if (state.loading || !state.hasMore) return;
  state.loading = true;

  const params = new URLSearchParams();
  const search = document.getElementById('userSearch')?.value.trim() || '';
  const city   = document.getElementById('userCityFilter')?.value.trim() || '';
  const area   = document.getElementById('userAreaFilter')?.value.trim() || '';
  const st     = document.getElementById('userStateFilter')?.value.trim() || '';
  if (search) params.set('search', search);
  if (city)   params.set('city',   city);
  if (area)   params.set('area',   area);
  if (st)     params.set('state',  st);
  params.set('page', state.page);

  const res = await apiRequest(`/auth/admin/users?${params}`, 'GET');
  state.loading = false;
  if (!res.success) return;

  state.hasMore = res.has_more;
  renderUsers(res.users, reset);
  renderActiveFilters();
  renderLoadMore('user', loadUsers, state.hasMore);
  state.page = reset ? 2 : state.page + 1;
}

// ── Render ────────────────────────────────────────────────────
function renderUsers(users, reset = true) {
  const body = document.getElementById('userListBody');
  if (reset && (!users || users.length === 0)) {
    body.innerHTML = `<div class="admin-empty">No users found.</div>`; return;
  }
  const rows = users.map(u => `<tr>
    <td><strong>${u.name}</strong></td>
    <td>${u.email}</td>
    <td>${u.mobile || '-'}</td>
    <td>${u.city || '-'}</td>
    <td>${u.area || '-'}</td>
    <td>${u.state || '-'}</td>
  </tr>`).join('');
  const cards = users.map(u => `<div class="admin-row-card">
    <div class="admin-row-card-top"><div><strong>${u.name}</strong><small>${u.email}</small></div></div>
    <div class="admin-row-card-fields">
      <div><label>Mobile</label><span>${u.mobile || '-'}</span></div>
      <div><label>City</label><span>${u.city || '-'}</span></div>
      <div><label>Area</label><span>${u.area || '-'}</span></div>
      <div><label>State</label><span>${u.state || '-'}</span></div>
    </div>
  </div>`).join('');

  if (reset) {
    body.innerHTML = `
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>City</th><th>Area</th><th>State</th></tr></thead>
        <tbody id="userTableBody">${rows}</tbody>
      </table></div>
      <div class="admin-row-cards" id="userCardsList">${cards}</div>`;
  } else {
    document.getElementById('userTableBody')?.insertAdjacentHTML('beforeend', rows);
    document.getElementById('userCardsList')?.insertAdjacentHTML('beforeend', cards);
  }
}

// ── Active filter chips ───────────────────────────────────────
function renderActiveFilters() {
  const container = document.getElementById('userActiveFilters');
  if (!container) return;
  const city  = document.getElementById('userCityFilter')?.value.trim() || '';
  const area  = document.getElementById('userAreaFilter')?.value.trim() || '';
  const state = document.getElementById('userStateFilter')?.value.trim() || '';
  const chips = [];
  if (city)  chips.push({ key: 'city',  label: `City: ${city}` });
  if (area)  chips.push({ key: 'area',  label: `Area: ${area}` });
  if (state) chips.push({ key: 'state', label: `State: ${state}` });
  if (!chips.length) { container.innerHTML = ''; return; }
  container.innerHTML = chips.map(c => `
    <button class="active-chip" data-clear="${c.key}">${c.label}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
    </button>`).join('');
  container.querySelectorAll('[data-clear]').forEach(chip => {
    chip.addEventListener('click', () => {
      if (chip.dataset.clear === 'city')  document.getElementById('userCityFilter').value = '';
      if (chip.dataset.clear === 'area')  document.getElementById('userAreaFilter').value = '';
      if (chip.dataset.clear === 'state') document.getElementById('userStateFilter').value = '';
      window.filterBadgeUpdaters?.user?.();
      loadUsers();
    });
  });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAdminProfile();
  setupFilterSheet('user', ['userCityFilter', 'userAreaFilter', 'userStateFilter']);
  document.getElementById('userSearch')?.addEventListener('input', debounce(loadUsers, 400));
  document.getElementById('userFilterApplyBtn')?.addEventListener('click', loadUsers);
  loadUsers();
});
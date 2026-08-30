/* ============================================================
   OLR INDIA - ADMIN DASHBOARD JS
   ============================================================ */

// ── Tab switching ─────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.tab === name));
  document.querySelectorAll('.mobile-nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.tab === name));
  document.querySelectorAll('.dash-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'panel-' + name));
  document.getElementById('mobileMenu').classList.remove('open');
  history.replaceState(null, '', '#' + name);

  if (!loadedTabs.has(name)) {
    loadedTabs.add(name);
    if (name === 'products') loadProducts();
    if (name === 'users') loadUsers();
    if (name === 'vendors') loadVendors();
  }
}
document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(btn => {
  if (!btn.dataset.tab) return;
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── Auth guard + profile ──────────────────────────────────────
let adminProfile = null;

const tabState = {
  products: { page: 1, hasMore: true, loading: false },
  users: { page: 1, hasMore: true, loading: false },
  vendors: { page: 1, hasMore: true, loading: false },
};
const loadedTabs = new Set();

async function loadAdminProfile() {
  const res = await apiRequest('/auth/admin/profile', 'GET');
  if (!res.success) {
    window.location.href = 'login.html';
    return;
  }
  adminProfile = res.admin;
  const initials = getInitials(adminProfile.name);
  document.getElementById('navAdminAvatar').textContent = initials;
  document.getElementById('navAdminName').textContent = adminProfile.name;
}

// ── Overview stats ────────────────────────────────────────────
async function loadStats() {
  const res = await apiRequest('/auth/admin/stats', 'GET');
  if (!res.success) return;
  const s = res.stats;
  document.getElementById('statUsers').textContent = s.total_users;
  document.getElementById('statVendors').textContent = s.total_vendors;
  document.getElementById('statProducts').textContent = s.total_products;
  document.getElementById('statActiveProducts').textContent = s.active_products;
  document.getElementById('statFlagged').textContent = s.flagged_vendors;
  document.getElementById('statSuspended').textContent = s.suspended_vendors;
}

/* ============================================================
   REPLACE loadProducts / loadUsers / loadVendors in
   admin-dashboard.js with these versions, and add the
   event-wiring block at the bottom to admin-dashboard.js
   (inside or after your existing DOMContentLoaded handler).
   ============================================================ */

// ── Products ─────────────────────────────────────────────────
async function loadProducts(reset = true) {
  const state = tabState.products;
  if (reset) { state.page = 1; state.hasMore = true; }
  if (state.loading || !state.hasMore) return;
  state.loading = true;

  const search = document.getElementById('productSearch')?.value.trim() || '';
  const status = document.getElementById('productStatusFilter')?.value || '';
  const reviewed = document.getElementById('productReviewedFilter')?.value || '';
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (reviewed) params.set('reviewed', reviewed);
  params.set('page', state.page);

  const res = await apiRequest(`/auth/admin/products?${params.toString()}`, 'GET');
  state.loading = false;
  if (!res.success) return;

  state.hasMore = res.has_more;
  renderProducts(res.products, reset);
  renderProductActiveFilters();
  renderLoadMore('product', 'loadProducts', state.hasMore);
  state.page = reset ? 2 : state.page + 1;
}

// ── Users ────────────────────────────────────────────────────
async function loadUsers(reset = true) {
  const state = tabState.users;
  if (reset) { state.page = 1; state.hasMore = true; }
  if (state.loading || !state.hasMore) return;
  state.loading = true;

  const search = document.getElementById('userSearch')?.value.trim() || '';
  const city = document.getElementById('userCityFilter')?.value.trim() || '';
  const area = document.getElementById('userAreaFilter')?.value.trim() || '';
  const stateVal = document.getElementById('userStateFilter')?.value.trim() || '';

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (city) params.set('city', city);
  if (area) params.set('area', area);
  if (stateVal) params.set('state', stateVal);
  params.set('page', state.page);

  const res = await apiRequest(`/auth/admin/users?${params.toString()}`, 'GET');
  state.loading = false;
  if (!res.success) return;

  state.hasMore = res.has_more;
  renderUsers(res.users, reset);
  renderUserActiveFilters();
  renderLoadMore('user', 'loadUsers', state.hasMore);
  state.page = reset ? 2 : state.page + 1;
}

// ── Vendors ──────────────────────────────────────────────────
async function loadVendors(reset = true) {
  const st = tabState.vendors;
  if (reset) { st.page = 1; st.hasMore = true; }
  if (st.loading || !st.hasMore) return;
  st.loading = true;

  const search = document.getElementById('vendorSearch')?.value.trim() || '';
  const city = document.getElementById('vendorCityFilter')?.value.trim() || '';
  const area = document.getElementById('vendorAreaFilter')?.value.trim() || '';
  const state = document.getElementById('vendorStateFilter')?.value.trim() || '';
  const plan = document.getElementById('vendorPlanFilter')?.value || '';
  const flag = document.getElementById('vendorFlagFilter')?.value || '';

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (city) params.set('city', city);
  if (area) params.set('area', area);
  if (state) params.set('state', state);
  if (plan) params.set('plan', plan);
  if (flag) params.set('flag', flag);
  params.set('page', st.page);

  const res = await apiRequest(`/auth/admin/vendors?${params.toString()}`, 'GET');
  st.loading = false;
  if (!res.success) return;

  st.hasMore = res.has_more;
  renderVendors(res.vendors, reset);
  renderVendorActiveFilters();
  renderLoadMore('vendor', 'loadVendors', st.hasMore);
  st.page = reset ? 2 : st.page + 1;
}

/* ============================================================
   ADD THIS: wires search boxes + Apply buttons to actually
   trigger the loadX() calls above with the new filter values.
   Put this inside your existing DOMContentLoaded handler,
   or as its own DOMContentLoaded block.
   ============================================================ */

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  // Search boxes: refetch as you type (debounced)
  document.getElementById('productSearch')
    ?.addEventListener('input', debounce(loadProducts, 400));
  document.getElementById('userSearch')
    ?.addEventListener('input', debounce(loadUsers, 400));
  document.getElementById('vendorSearch')
    ?.addEventListener('input', debounce(loadVendors, 400));
  // Product status dropdown lives directly in the filter sheet -
  // refetch immediately when changed
  document.getElementById('productStatusFilter')
    ?.addEventListener('change', loadProducts);
  document.getElementById('productReviewedFilter')
    ?.addEventListener('change', loadProducts);
  // Apply buttons inside filter sheets
  document.getElementById('productFilterApply')
    ?.addEventListener('click', loadProducts);
  document.getElementById('userFilterApplyBtn')
    ?.addEventListener('click', loadUsers);
  document.getElementById('vendorFilterApplyBtn')
    ?.addEventListener('click', loadVendors);
});

// ── 2. Modal open/close helpers ─────────────────────────────────────────
function openModal(el) { el.classList.add('is-open'); }
function closeModal(el) { el.classList.remove('is-open'); }

let pendingProductId = null;

const removeProductModal = document.getElementById('removeProductModal');
const removeReasonInput = document.getElementById('removeReasonInput');
const removeProductCancel = document.getElementById('removeProductCancel');
const removeProductConfirm = document.getElementById('removeProductConfirm');

// ── 3. Event delegation on the three table containers ───────────────────
document.getElementById('productListBody')?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.dataset.action === 'remove-product') {
    pendingProductId = id;
    removeReasonInput.value = '';
    openModal(removeProductModal);
  }
  if (btn.dataset.action === 'view-product') {
    // Hook up your product detail view here if you have one
  }
});

// ── 4. Remove product modal actions ─────────────────────────────────────
removeProductCancel?.addEventListener('click', () => closeModal(removeProductModal));

removeProductConfirm?.addEventListener('click', async () => {
  const reason = removeReasonInput.value.trim();
  if (!reason) {
    showToast('Please explain why this listing is being removed.', 'error');
    return;
  }
  const res = await apiRequest(`/auth/admin/products/${pendingProductId}/remove`, 'POST', { reason });
  closeModal(removeProductModal);

  if (res.success) {
    showToast(
      res.auto_suspended
        ? 'Product removed. Vendor reached 3 strikes and was auto-suspended.'
        : `Product removed. Vendor now has ${res.strike_count} strike(s).`,
      'success'
    );
    loadProducts();
    loadVendors();
    loadStats();
  } else {
    showToast(res.message || 'Failed to remove product.', 'error');
  }
});

// ── Logout ────────────────────────────────────────────────────
["logoutBtn", "logoutBtnMobile"].forEach(id => {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const confirmed = await showConfirm({
      title: "Log out?",
      text: "You'll need to sign in again to access the admin panel.",
      confirmLabel: "Log out",
      cancelLabel: "Stay logged in",
    });
    if (!confirmed) return;
    await apiRequest("/auth/admin/logout", "POST");
    clearSessionAccount("admin");
    window.location.href = "login.html";
  });
});

function renderProducts(products, reset = true) {

  const body = document.getElementById("productListBody");

  if (reset && (!products || products.length === 0)) {
    body.innerHTML = `<div class="admin-empty">No products found.</div>`;
    return;
  }

  // Desktop table rows (unchanged)
  const rows = products.map(product => {
    const viewUrl = `../p.html?slug=${product.slug}&admin=1`;
    const image = product.image
      ? `<img src="${product.image}" class="admin-thumb" alt="${product.name}">`
      : `<div class="admin-thumb"></div>`;

    return `
            <tr>
                <td><a href="${viewUrl}" title="View listing">${image}</a></td>
                <td>
                    <a href="${viewUrl}" style="text-decoration:none;color:inherit;">
                        <strong>${product.name}</strong><br>
                        <small>${product.category}</small>
                    </a>
                </td>
                <td>${product.vendor_name}</td>
                <td>
                    <button class="admin-action-btn danger" data-action="remove-product" data-id="${product.id}" data-slug="${product.slug}">Remove</button>
                </td>
            </tr>
        `;
  }).join("");

  // Mobile cards (new, purpose-built - not a fake table)
  const cards = products.map(product => {
    const viewUrl = `../p.html?slug=${product.slug}&admin=1`;
    const image = product.image
      ? `<img src="${product.image}" class="admin-thumb" alt="${product.name}">`
      : `<div class="admin-thumb"></div>`;

    return `
            <div class="admin-row-card">
                <div class="admin-row-card-top">
                    <a href="${viewUrl}">${image}</a>
                    <a href="${viewUrl}">
                        <strong>${product.name}</strong>
                        <small>${product.category}</small>
                    </a>
                </div>
                <div class="admin-row-card-meta">
                    <label>Vendor</label>
                    <span>${product.vendor_name}</span>
                </div>
                <div class="admin-row-card-actions">
                    <button class="admin-action-btn danger" data-action="remove-product" data-id="${product.id}" data-slug="${product.slug}">Remove</button>
                </div>
            </div>
        `;
  }).join("");

  if (reset) {
    body.innerHTML = `
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Product</th>
                            <th>Vendor</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="productTableBody">${rows}</tbody>
                </table>
            </div>
            <div class="admin-row-cards" id="productCardsList">${cards}</div>
        `;
  } else {
    document.getElementById('productTableBody')?.insertAdjacentHTML('beforeend', rows);
    document.getElementById('productCardsList')?.insertAdjacentHTML('beforeend', cards);
  }
}

function renderUsers(users, reset = true) {

  const body = document.getElementById("userListBody");

  if (reset && (!users || users.length === 0)) {
    body.innerHTML = `<div class="admin-empty">No users found.</div>`;
    return;
  }

  // Desktop table rows
  const rows = users.map(user => `
    <tr>
        <td><strong>${user.name}</strong></td>
        <td>${user.email}</td>
        <td>${user.mobile || "-"}</td>
        <td>${user.city || "-"}</td>
        <td>${user.area || "-"}</td>
        <td>${user.state || "-"}</td>
    </tr>
`).join("");

  // Mobile cards
  const cards = users.map(user => {
    return `
            <div class="admin-row-card">
                <div class="admin-row-card-top">
                    <div>
                        <strong>${user.name}</strong>
                        <small>${user.email}</small>
                    </div>
                </div>
                <div class="admin-row-card-fields">
                    <div><label>Mobile</label><span>${user.mobile || "-"}</span></div>
                    <div><label>City</label><span>${user.city || "-"}</span></div>
                    <div><label>Area</label><span>${user.area || "-"}</span></div>
                    <div><label>State</label><span>${user.state || "-"}</span></div>
                </div>
            </div>
        `;
  }).join("");

  if (reset) {
    body.innerHTML = `
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Mobile</th>
                            <th>City</th>
                            <th>Area</th>
                            <th>State</th>
                        </tr>
                    </thead>
                    <tbody id="userTableBody">${rows}</tbody>
                </table>
            </div>
            <div class="admin-row-cards" id="userCardsList">${cards}</div>
        `;
  } else {
    document.getElementById('userTableBody')?.insertAdjacentHTML('beforeend', rows);
    document.getElementById('userCardsList')?.insertAdjacentHTML('beforeend', cards);
  }
}

function renderVendors(vendors, reset = true) {

  const body = document.getElementById("vendorListBody");

  if (reset && (!vendors || vendors.length === 0)) {
    body.innerHTML = `<div class="admin-empty">No vendors found.</div>`;
    return;
  }

  // Desktop table rows (clicking a row goes to vendor-detail.html)
  const rows = vendors.map(vendor => `
        <tr class="admin-row-clickable" data-id="${vendor.id}">
            <td>
                <strong>${vendor.name}</strong><br>
            </td>
            <td>${vendor.email}</td>
            <td>${vendor.mobile}</td>
        </tr>
    `).join("");

  // Mobile cards (also clickable → vendor-detail.html)
  const cards = vendors.map(vendor => `
        <div class="admin-row-card admin-row-clickable" data-id="${vendor.id}">
            <div class="admin-row-card-top">
                <div>
                    <strong>${vendor.name}</strong>
                </div>
            </div>
            <div class="admin-row-card-fields">
                <div><label>Email</label><span>${vendor.email}</span></div>
                <div><label>Mobile</label><span>${vendor.mobile}</span></div>
            </div>
        </div>
    `).join("");

  if (reset) {
    body.innerHTML = `
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Vendor</th>
                            <th>Email</th>
                            <th>Mobile</th>
                        </tr>
                    </thead>
                    <tbody id="vendorTableBody">${rows}</tbody>
                </table>
            </div>
            <div class="admin-row-cards" id="vendorCardsList">${cards}</div>
        `;
  } else {
    document.getElementById('vendorTableBody')?.insertAdjacentHTML('beforeend', rows);
    document.getElementById('vendorCardsList')?.insertAdjacentHTML('beforeend', cards);
  }

  // Row/card click → vendor detail page (runs every time, so newly
  // appended "load more" rows/cards get the click handler too)
  body.querySelectorAll('.admin-row-clickable').forEach(el => {
    el.addEventListener('click', () => {
      window.location.href = `vendor-detail.html?id=${el.dataset.id}`;
    });
  });
}

function setupFilterSheet(prefix, filterFieldIds) {
  const btn = document.getElementById(prefix + 'FilterBtn');
  const overlay = document.getElementById(prefix + 'FilterOverlay');
  const sheet = document.getElementById(prefix + 'FilterSheet');
  const closeBtn = document.getElementById(prefix + 'FilterClose');
  const clearBtn = document.getElementById(prefix + 'FilterClear');
  const countEl = document.getElementById(prefix + 'FilterCount');
  if (!btn || !overlay || !sheet) return;

  function openSheet() {
    overlay.classList.add('open');
    sheet.classList.add('open');
    document.body.classList.add('sheet-open');
  }
  function closeSheet() {
    overlay.classList.remove('open');
    sheet.classList.remove('open');
    document.body.classList.remove('sheet-open');
  }
  function updateBadge() {
    const filled = filterFieldIds
      .map(id => document.getElementById(id))
      .filter(el => el && el.value && el.value.trim() !== '').length;

    if (filled > 0) {
      btn.classList.add('has-filters');
      countEl.textContent = filled;
      countEl.style.display = 'inline-flex';
    } else {
      btn.classList.remove('has-filters');
      countEl.style.display = 'none';
    }
  }
  window.filterBadgeUpdaters = window.filterBadgeUpdaters || {};
  window.filterBadgeUpdaters[prefix] = updateBadge;
  btn.addEventListener('click', openSheet);
  overlay.addEventListener('click', closeSheet);
  closeBtn?.addEventListener('click', closeSheet);

  clearBtn?.addEventListener('click', () => {
    filterFieldIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    updateBadge();
    // Trigger existing Apply button so results refresh with cleared filters
    document.getElementById(prefix + 'FilterApplyBtn')?.click();
    document.getElementById(prefix + 'FilterApply')?.click();
    closeSheet();
  });

  // Update badge whenever Apply is clicked (existing button, existing logic untouched)
  document.getElementById(prefix + 'FilterApplyBtn')?.addEventListener('click', () => {
    updateBadge();
    closeSheet();
  });
  document.getElementById(prefix + 'FilterApply')?.addEventListener('click', () => {
    updateBadge();
    closeSheet();
  });
}

const PRODUCT_FILTER_LABELS = {
  status: { active: 'Live only', inactive: 'Inactive only' },
  reviewed: { viewed: 'Viewed only', unviewed: 'Unviewed only' }
};

function renderProductActiveFilters() {
  const container = document.getElementById('productActiveFilters');
  if (!container) return;

  const status = document.getElementById('productStatusFilter')?.value || '';
  const reviewed = document.getElementById('productReviewedFilter')?.value || '';

  const chips = [];

  if (status) {
    chips.push({ key: 'status', label: PRODUCT_FILTER_LABELS.status[status] });
  }
  if (reviewed) {
    chips.push({ key: 'reviewed', label: PRODUCT_FILTER_LABELS.reviewed[reviewed] });
  }

  if (chips.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = chips.map(chip => `
    <button class="active-chip" data-clear="${chip.key}">
      ${chip.label}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
    </button>
  `).join('');

  // Clicking a chip clears that one filter and refetches
  container.querySelectorAll('[data-clear]').forEach(chip => {
    chip.addEventListener('click', () => {
      const key = chip.dataset.clear;
      if (key === 'status') document.getElementById('productStatusFilter').value = '';
      if (key === 'reviewed') document.getElementById('productReviewedFilter').value = '';
      window.filterBadgeUpdaters?.product?.();
      loadProducts();
    });
  });
}

const USER_FILTER_LABELS = {
  city: (v) => `City: ${v}`,
  area: (v) => `Area: ${v}`,
  state: (v) => `State: ${v}`
};

function renderUserActiveFilters() {
  const container = document.getElementById('userActiveFilters');
  if (!container) return;

  const city = document.getElementById('userCityFilter')?.value.trim() || '';
  const area = document.getElementById('userAreaFilter')?.value.trim() || '';
  const state = document.getElementById('userStateFilter')?.value.trim() || '';

  const chips = [];
  if (city) chips.push({ key: 'city', label: USER_FILTER_LABELS.city(city) });
  if (area) chips.push({ key: 'area', label: USER_FILTER_LABELS.area(area) });
  if (state) chips.push({ key: 'state', label: USER_FILTER_LABELS.state(state) });

  if (chips.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = chips.map(chip => `
    <button class="active-chip" data-clear="${chip.key}">
      ${chip.label}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
    </button>
  `).join('');

  container.querySelectorAll('[data-clear]').forEach(chip => {
    chip.addEventListener('click', () => {
      const key = chip.dataset.clear;
      if (key === 'city') document.getElementById('userCityFilter').value = '';
      if (key === 'area') document.getElementById('userAreaFilter').value = '';
      if (key === 'state') document.getElementById('userStateFilter').value = '';
      window.filterBadgeUpdaters?.user?.();
      loadUsers();
    });
  });
}

const VENDOR_FILTER_LABELS = {
  city: (v) => `City: ${v}`,
  area: (v) => `Area: ${v}`,
  state: (v) => `State: ${v}`,
  plan: (v) => `Plan: ${v.charAt(0).toUpperCase() + v.slice(1)}`,
  flag: { flagged: 'Has strikes', suspended: 'Suspended only', active: 'Active only' }
};

function renderVendorActiveFilters() {
  const container = document.getElementById('vendorActiveFilters');
  if (!container) return;

  const city = document.getElementById('vendorCityFilter')?.value.trim() || '';
  const area = document.getElementById('vendorAreaFilter')?.value.trim() || '';
  const state = document.getElementById('vendorStateFilter')?.value.trim() || '';
  const plan = document.getElementById('vendorPlanFilter')?.value || '';
  const flag = document.getElementById('vendorFlagFilter')?.value || '';

  const chips = [];
  if (city) chips.push({ key: 'city', label: VENDOR_FILTER_LABELS.city(city) });
  if (area) chips.push({ key: 'area', label: VENDOR_FILTER_LABELS.area(area) });
  if (state) chips.push({ key: 'state', label: VENDOR_FILTER_LABELS.state(state) });
  if (plan) chips.push({ key: 'plan', label: VENDOR_FILTER_LABELS.plan(plan) });
  if (flag) chips.push({ key: 'flag', label: VENDOR_FILTER_LABELS.flag[flag] });

  if (chips.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = chips.map(chip => `
    <button class="active-chip" data-clear="${chip.key}">
      ${chip.label}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
    </button>
  `).join('');

  container.querySelectorAll('[data-clear]').forEach(chip => {
    chip.addEventListener('click', () => {
      const key = chip.dataset.clear;
      if (key === 'city') document.getElementById('vendorCityFilter').value = '';
      if (key === 'area') document.getElementById('vendorAreaFilter').value = '';
      if (key === 'state') document.getElementById('vendorStateFilter').value = '';
      if (key === 'plan') document.getElementById('vendorPlanFilter').value = '';
      if (key === 'flag') document.getElementById('vendorFlagFilter').value = '';
      window.filterBadgeUpdaters?.vendor?.();
      loadVendors();
    });
  });
}

function renderLoadMore(prefix, loadFnName, hasMore) {
  const wrapId = prefix + 'LoadMoreWrap';
  let wrap = document.getElementById(wrapId);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = wrapId;
    wrap.className = 'admin-load-more-wrap';
    document.getElementById(prefix + 'ListBody').after(wrap);
  }
  wrap.innerHTML = hasMore
    ? `<button class="admin-action-btn" id="${prefix}LoadMoreBtn">Load more</button>`
    : '';

  document.getElementById(`${prefix}LoadMoreBtn`)?.addEventListener('click', () => {
    window[loadFnName](false);
  });
}
// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAdminProfile();
  loadStats();
  setupFilterSheet('product', ['productStatusFilter', 'productReviewedFilter']);
  setupFilterSheet('user', ['userCityFilter', 'userAreaFilter', 'userStateFilter']);
  setupFilterSheet('vendor', ['vendorCityFilter', 'vendorAreaFilter', 'vendorStateFilter', 'vendorPlanFilter', 'vendorFlagFilter']);

  const hashRaw = location.hash.replace('#', '');
  const validTabs = ['overview', 'products', 'users', 'vendors'];
  const startTab = validTabs.includes(hashRaw) ? hashRaw : 'overview';
  loadedTabs.add('overview');
  switchTab(startTab);
});
/* ============================================================
   OLR INDIA - ADMIN OVERVIEW PAGE JS
   Requires: admin-nav.js
   ============================================================ */

async function loadStats() {
  const res = await apiRequest('/auth/admin/stats', 'GET');
  if (!res.success) return;
  const s = res.stats;
  document.getElementById('statUsers').textContent         = s.total_users;
  document.getElementById('statVendors').textContent       = s.total_vendors;
  document.getElementById('statProducts').textContent      = s.total_products;
  document.getElementById('statActiveProducts').textContent = s.active_products;
  document.getElementById('statFlagged').textContent       = s.flagged_vendors;
  document.getElementById('statSuspended').textContent     = s.suspended_vendors;
}

document.addEventListener('DOMContentLoaded', () => {
  loadAdminProfile();
  loadStats();
});
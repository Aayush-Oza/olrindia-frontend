/* ============================================================
   OLR INDIA - ADMIN NAV  (shared across all admin pages)
   Handles: loadAdminProfile, hamburger, logout, resize,
            auth-guard, debounce, setupFilterSheet, renderLoadMore
   Load BEFORE any page-specific JS.
   ============================================================ */

// ── Nav profile ───────────────────────────────────────────────
async function loadAdminProfile() {
  const res = await apiRequest('/auth/admin/profile', 'GET');
  if (!res.success) { window.location.href = '/admin/login'; return; }
  const a = res.admin;
  document.getElementById('navAdminAvatar').textContent = getInitials(a.name);
  document.getElementById('navAdminName').textContent = a.name;
  return a;
}

// ── Hamburger ─────────────────────────────────────────────────
document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── Logout ────────────────────────────────────────────────────
['logoutBtn', 'logoutBtnMobile'].forEach(id => {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const confirmed = await showConfirm({
      title: 'Log out?',
      text: "You'll need to sign in again to access the admin panel.",
      confirmLabel: 'Log out', cancelLabel: 'Stay logged in',
    });
    if (!confirmed) return;
    await apiRequest('/auth/admin/logout', 'POST');
    clearSessionAccount('admin');
    window.location.href = '/admin/login';
  });
});

// ── Resize ────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  if (window.innerWidth > 860) document.getElementById('mobileMenu')?.classList.remove('open');
});

// ── Debounce ──────────────────────────────────────────────────
function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// ── Filter sheet setup ────────────────────────────────────────
function setupFilterSheet(prefix, filterFieldIds) {
  const btn     = document.getElementById(prefix + 'FilterBtn');
  const overlay = document.getElementById(prefix + 'FilterOverlay');
  const sheet   = document.getElementById(prefix + 'FilterSheet');
  const closeBtn = document.getElementById(prefix + 'FilterClose');
  const clearBtn = document.getElementById(prefix + 'FilterClear');
  const countEl  = document.getElementById(prefix + 'FilterCount');
  if (!btn || !overlay || !sheet) return;

  const open  = () => { overlay.classList.add('open'); sheet.classList.add('open'); document.body.classList.add('sheet-open'); };
  const close = () => { overlay.classList.remove('open'); sheet.classList.remove('open'); document.body.classList.remove('sheet-open'); };

  function updateBadge() {
    const filled = filterFieldIds.map(id => document.getElementById(id))
      .filter(el => el && el.value && el.value.trim() !== '').length;
    btn.classList.toggle('has-filters', filled > 0);
    countEl.style.display = filled > 0 ? 'inline-flex' : 'none';
    if (filled > 0) countEl.textContent = filled;
  }
  window.filterBadgeUpdaters = window.filterBadgeUpdaters || {};
  window.filterBadgeUpdaters[prefix] = updateBadge;

  btn.addEventListener('click', open);
  overlay.addEventListener('click', close);
  closeBtn?.addEventListener('click', close);

  clearBtn?.addEventListener('click', () => {
    filterFieldIds.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    updateBadge();
    document.getElementById(prefix + 'FilterApplyBtn')?.click();
    document.getElementById(prefix + 'FilterApply')?.click();
    close();
  });

  ['FilterApplyBtn', 'FilterApply'].forEach(suffix => {
    document.getElementById(prefix + suffix)?.addEventListener('click', () => { updateBadge(); close(); });
  });
}

// ── Load more button ──────────────────────────────────────────
function renderLoadMore(prefix, loadFn, hasMore) {
  const wrapId = prefix + 'LoadMoreWrap';
  let wrap = document.getElementById(wrapId);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = wrapId;
    wrap.className = 'admin-load-more-wrap';
    document.getElementById(prefix + 'ListBody')?.after(wrap);
  }
  wrap.innerHTML = hasMore ? `<button class="admin-action-btn" id="${prefix}LoadMoreBtn">Load more</button>` : '';
  document.getElementById(`${prefix}LoadMoreBtn`)?.addEventListener('click', () => loadFn(false));
}
/* ============================================================
   OLR INDIA - USER NAV  (shared across all user dashboard pages)
   Handles: loadNavUser, hamburger, logout, resize, auth-guard
   Load this BEFORE any page-specific JS.
   ============================================================ */

// ── Nav avatar + name ─────────────────────────────────────────
async function loadNavUser() {
  const res = await apiRequest('/auth/user/profile', 'GET');
  if (!res.success) return null;
  const u = res.user;
  const html = u.profile_photo
    ? `<img class="avatar-img-sm" src="${u.profile_photo}" alt="${u.name || ''}">`
    : `<span>${getInitials(u.name)}</span>`;
  document.getElementById('navUserAvatar').innerHTML = html;
  document.getElementById('navUserAvatarMobile').innerHTML = html;
  document.getElementById('navUserName').textContent = u.name || '';
  document.getElementById('navUserNameMobile').textContent = u.name || '';
  return u;
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
      text: "You'll need to sign in again to access your account.",
      confirmLabel: 'Log out',
      cancelLabel: 'Stay logged in',
    });
    if (!confirmed) return;
    await apiRequest('/auth/user/logout', 'POST');
    clearSessionAccount('user');
    window.location.href = '/user/login';
  });
});

// ── Auth guard: redirect on 401 when tab regains focus ────────
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    const res = await apiRequest('/auth/user/profile', 'GET');
    if (!res.success && res.httpStatus === 401) {
      clearSessionAccount('user');
      window.location.href = '/user/login';
    }
  }
});

// ── Close mobile menu on wide viewport ────────────────────────
window.addEventListener('resize', () => {
  if (window.innerWidth > 860) {
    document.getElementById('mobileMenu')?.classList.remove('open');
  }
});
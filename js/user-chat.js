/* ============================================================
   OLR INDIA - CHAT PAGE JS
   ============================================================ */

// ── Hamburger ─────────────────────────────────────────────────
document.getElementById('hamburgerBtn').addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── Nav avatar + name ─────────────────────────────────────────
async function loadNavUser() {
  const res = await apiRequest('/auth/user/profile', 'GET');
  if (!res.success) return;
  const u = res.user;
  const html = u.profile_photo
    ? `<img class="avatar-img-sm" src="${u.profile_photo}" alt="${u.name || ''}">`
    : `<span>${getInitials(u.name)}</span>`;
  document.getElementById('navUserAvatar').innerHTML = html;
  document.getElementById('navUserAvatarMobile').innerHTML = html;
  document.getElementById('navUserName').textContent = u.name || '';
  document.getElementById('navUserNameMobile').textContent = u.name || '';
  return res.user;
}

// ── Logout ────────────────────────────────────────────────────
['logoutBtn', 'logoutBtnMobile'].forEach(id => {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const confirmed = await showConfirm({
      title: 'Log out?',
      text: "You'll need to sign in again to access your account.",
      confirmLabel: 'Log out', cancelLabel: 'Stay logged in',
    });
    if (!confirmed) return;
    await apiRequest('/auth/user/logout', 'POST');
    clearSessionAccount('user');
    window.location.href = '/user/login';
  });
});

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const user = await loadNavUser();

  // Auth guard
  if (!user) {
    window.location.href = '/user/login';
    return;
  }

  // Profile complete check before allowing chat
  if (!user.profile_complete) {
    document.getElementById('chatListBody').innerHTML = `
      <div class="chat-empty-state">
        <div class="icon">👤</div>
        <h3>Complete your profile first</h3>
        <p>Add your mobile and city so vendors can reach you back.</p>
        <a class="btn btn-primary" href="/user/profile" style="margin-top:12px;display:inline-flex;padding:10px 24px;">Go to Profile</a>
      </div>`;
    return;
  }

  // Init chat
  document.getElementById('chatListBody').innerHTML = `
    <div class="chat-empty-state"><div class="icon">💬</div><h3>Loading…</h3></div>`;

  const ok = await initChatAuth('user');
  if (!ok) return;

  // Check for deep-link conversation id in URL: /user/chat?conv=<id>
  const params = new URLSearchParams(location.search);
  const convId = params.get('conv');

  listenToUnreadBadge();
  renderChatList();

  if (convId) openThread(convId);

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      const res = await apiRequest('/auth/user/profile', 'GET');
      if (!res.success && res.httpStatus === 401) {
        clearSessionAccount('user');
        window.location.href = '/user/login';
      }
    }
  });
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 860) document.getElementById('mobileMenu').classList.remove('open');
});
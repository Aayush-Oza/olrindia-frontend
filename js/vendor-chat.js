/* ============================================================
   OLR INDIA – VENDOR CHAT JS  (chat.html)
   ============================================================ */

let vendorProfile = null;

function renderNavAvatar() {
  if (!vendorProfile) return;
  const initial = getInitials(vendorProfile.name || 'V');
  ['navUserAvatar', 'navUserAvatarMobile'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = vendorProfile.profile_photo ? `<img src="${vendorProfile.profile_photo}" alt="">` : initial;
  });
  const nameEl = document.getElementById('navUserName');
  const nameElM = document.getElementById('navUserNameMobile');
  if (nameEl) nameEl.textContent = vendorProfile.name || '';
  if (nameElM) nameElM.textContent = vendorProfile.name || '';
}

function renderSuspendedBanner() {
  if (!vendorProfile) return;
  const banner = document.getElementById('suspendedBanner');
  if (!banner) return;
  banner.style.display = vendorProfile.is_active ? 'none' : 'block';
}

async function loadVendorProfile() {
  const res = await apiRequest('/auth/vendor/profile', 'GET');
  if (!res.success) return;
  vendorProfile = res.vendor;
  renderNavAvatar();
  renderSuspendedBanner();
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
    document.getElementById('mobileMenu').classList.toggle('open');
  });

  await loadVendorProfile();

  if (vendorProfile && !vendorProfile.is_active) {
    document.getElementById('chatListBody').innerHTML = `
      <div class="chat-empty-state">
        <div class="icon">🚫</div>
        <h3>Account Suspended</h3>
        <p>Contact support to regain access.</p>
      </div>`;
    return;
  }

  // Init chat
  const ok = await initChatAuth('vendor');
  if (!ok) return;

  // Check for a conversation id in the URL hash e.g. /vendor/chat#conv=abc123
  const hash = location.hash.replace('#', '');
  const convId = hash.startsWith('conv=') ? hash.split('=')[1] : null;

  openChatOverlay();
  if (convId) openThread(convId);
  else renderChatList();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 860) document.getElementById('mobileMenu')?.classList.remove('open');
});
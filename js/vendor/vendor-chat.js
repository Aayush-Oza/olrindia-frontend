/* ============================================================
   OLR INDIA – VENDOR CHAT JS  (chat.html)
   ============================================================ */

let vendorProfile = null;

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
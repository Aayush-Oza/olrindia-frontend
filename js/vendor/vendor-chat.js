/* ============================================================
   OLR INDIA – VENDOR CHAT JS  (chat.html)
   Requires: vendor-nav.js
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
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

  const ok = await initChatAuth('vendor');
  if (!ok) return;

  const hash = location.hash.replace('#', '');
  const convId = hash.startsWith('conv=') ? hash.split('=')[1] : null;

  openChatOverlay();
  if (convId) openThread(convId);
  else renderChatList();
});
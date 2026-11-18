/* ============================================================
   OLR INDIA - CHAT PAGE JS
   Requires: user-nav.js (loaded before this)
   ============================================================ */

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
});
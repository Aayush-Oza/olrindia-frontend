/* ============================================================
   OLR INDIA - USER NAV (shared across all user pages)
   Provides: loadNavUser
   ============================================================ */

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
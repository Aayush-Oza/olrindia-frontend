/* ============================================================
   OLR INDIA - USER PROFILE PAGE JS
   Requires: user-nav.js (loaded before this)
   ============================================================ */

// ── Avatar helper ─────────────────────────────────────────────
function renderAvatarHTML(name, photoUrl, size) {
  const cls = size === 'big' ? 'avatar-img-big' : 'avatar-img-sm';
  return photoUrl
    ? `<img class="${cls}" src="${photoUrl}" alt="${name || ''}">`
    : `<span>${getInitials(name)}</span>`;
}

// ── Load profile ──────────────────────────────────────────────
async function loadUserProfile() {
  const res = await apiRequest('/auth/user/profile', 'GET');
  if (!res.success) { toastError(res.message || 'Failed to load profile.'); return; }
  const u = res.user;

  // Store Google flag globally for delete account use
  window._userIsGoogle = u.is_google_user;

  const avatarImg = document.getElementById('profileAvatarImg');
  const avatarBig = document.getElementById('profileAvatar');
  const removeBtn = document.getElementById('profileAvatarRemoveBtn');

  if (u.profile_photo) {
    avatarImg.src = u.profile_photo;
    avatarImg.style.display = 'block';
    avatarBig.style.display = 'none';
    removeBtn.style.display = 'inline-block';
  } else {
    avatarImg.style.display = 'none';
    avatarBig.style.display = 'flex';
    avatarBig.textContent = getInitials(u.name);
    removeBtn.style.display = 'none';
  }

  document.getElementById('navUserAvatar').innerHTML = renderAvatarHTML(u.name, u.profile_photo, 'sm');
  document.getElementById('navUserAvatarMobile').innerHTML = renderAvatarHTML(u.name, u.profile_photo, 'sm');
  document.getElementById('navUserName').textContent = u.name || '';
  document.getElementById('navUserNameMobile').textContent = u.name || '';

  document.getElementById('profileName').textContent = u.name || '';
  document.getElementById('profileEmail').textContent = u.email || '';
  document.getElementById('infoEmail').textContent = u.email || '';
  document.getElementById('editName').value = u.name || '';
  document.getElementById('editMobile').value = u.mobile || '';
  document.getElementById('editPincode').value = u.pincode || '';
  document.getElementById('editArea').value = u.area || '';
  document.getElementById('editCity').value = u.city || '';
  document.getElementById('editState').value = u.state || '';
}

// ── Avatar edit / remove ──────────────────────────────────────
document.getElementById('profileAvatarEditBtn')?.addEventListener('click', () => {
  document.getElementById('profilePhotoInput').click();
});

document.getElementById('profileAvatarRemoveBtn')?.addEventListener('click', async () => {
  const confirmed = await showConfirm({
    title: 'Remove profile photo?',
    text: 'Your profile will show your initials instead.',
    confirmLabel: 'Remove',
    cancelLabel: 'Cancel',
  });
  if (!confirmed) return;
  const res = await apiRequest('/auth/user/profile/photo', 'DELETE');
  if (res.success) { toastSuccess('Profile photo removed.'); await loadUserProfile(); }
  else toastError(res.message || 'Failed to remove photo.');
});

document.getElementById('profilePhotoInput')?.addEventListener('change', async function () {
  const file = this.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('photo', file);
  const resp = await fetch(API_BASE + '/auth/user/profile/photo', { method: 'PUT', body: fd, credentials: 'include' });
  const res = await resp.json();
  if (res.success) { toastSuccess('Profile photo updated!'); await loadUserProfile(); }
  else toastError(res.message || 'Failed to update photo.');
  this.value = '';
});

// ── Profile form submit ───────────────────────────────────────
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.classList.add('loading');
  const payload = {
    name:    document.getElementById('editName').value.trim(),
    mobile:  document.getElementById('editMobile').value.trim(),
    pincode: document.getElementById('editPincode').value.trim(),
    area:    document.getElementById('editArea').value.trim(),
    city:    document.getElementById('editCity').value.trim(),
    state:   document.getElementById('editState').value.trim(),
  };
  const res = await apiRequest('/auth/user/profile', 'PUT', payload);
  btn.classList.remove('loading');
  if (res.success) { toastSuccess('Profile updated!'); await loadUserProfile(); }
  else toastError(res.message || 'Failed to update profile.');
});

// ── Pincode autofill ──────────────────────────────────────────
const profileFormEl = document.getElementById('profileForm');
if (profileFormEl) {
  wirePincodeAutofill({
    pincodeInput: profileFormEl.pincode,
    stateInput:   profileFormEl.state,
    cityInput:    profileFormEl.city,
    areaInput:    profileFormEl.area,
    statusEl:     profileFormEl.querySelector('.pincode-status'),
  });
}

// ── Delete account ────────────────────────────────────────────
document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
  const isGoogle = window._userIsGoogle;

  if (isGoogle) {
    // Google user - just confirm, no password needed
    const confirmed = await showConfirm({
      title: 'Delete your account?',
      text: 'This will permanently delete your account, wishlist, chats and all data. This cannot be undone.',
      confirmLabel: 'Delete account',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    const btn = document.getElementById('deleteAccountBtn');
    setButtonLoading(btn, true);
    const res = await apiRequest('/auth/user/delete-account', 'POST', {});
    setButtonLoading(btn, false);

    if (res.success) {
      toastSuccess('Account deleted successfully.');
      setTimeout(() => window.location.href = '/', 1500);
    } else {
      toastError(res.message || 'Failed to delete account.');
    }

  } else {
    // Password user - confirm then ask for password
    const confirmed = await showConfirm({
      title: 'Delete your account?',
      text: 'This will permanently delete your account, wishlist, chats and all data. This cannot be undone.',
      confirmLabel: 'Continue',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    const password = await showConfirmWithPassword({
      title: 'Confirm deletion',
      text: 'Enter your password to permanently delete your account.',
      confirmLabel: 'Delete account',
      cancelLabel: 'Cancel',
    });
    if (!password) return;

    const btn = document.getElementById('deleteAccountBtn');
    setButtonLoading(btn, true);
    const res = await apiRequest('/auth/user/delete-account', 'POST', { password });
    setButtonLoading(btn, false);

    if (res.success) {
      toastSuccess('Account deleted successfully.');
      setTimeout(() => window.location.href = '/', 1500);
    } else {
      toastError(res.message || 'Failed to delete account.');
    }
  }
});

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadUserProfile();
});
/* ============================================================
   OLR INDIA - PROFILE PAGE JS
   ============================================================ */

// ── Hamburger ─────────────────────────────────────────────────
document.getElementById('hamburgerBtn').addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── Nav avatar + name ─────────────────────────────────────────
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
    confirmLabel: 'Remove', cancelLabel: 'Cancel',
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
    name: document.getElementById('editName').value.trim(),
    mobile: document.getElementById('editMobile').value.trim(),
    pincode: document.getElementById('editPincode').value.trim(),
    area: document.getElementById('editArea').value.trim(),
    city: document.getElementById('editCity').value.trim(),
    state: document.getElementById('editState').value.trim(),
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
    stateInput: profileFormEl.state,
    cityInput: profileFormEl.city,
    areaInput: profileFormEl.area,
    statusEl: profileFormEl.querySelector('.pincode-status'),
  });
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
document.addEventListener('DOMContentLoaded', () => {
  loadUserProfile();

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
const params = new URLSearchParams(window.location.search);
const vendorId = params.get('id');

async function loadVendorDetail() {
  if (!vendorId) {
    window.location.href = 'dashboard.html#vendors';
    return;
  }
  const res = await apiRequest(`/auth/admin/vendors/${vendorId}`, 'GET');
  if (!res.success) {
    showToast(res.message || 'Vendor not found.', 'error');
    return;
  }
  renderVendorInfo(res.vendor);
  renderVendorStrikes(res.strikes);
  renderVendorProducts(res.products);
}

function renderVendorInfo(v) {
  const verified = v.is_verified
    ? `<span class="admin-badge admin-badge-live">Verified</span>`
    : `<span class="admin-badge admin-badge-inactive">Unverified</span>`;

  const status = v.is_active
    ? `<span class="admin-badge admin-badge-live">Active</span>`
    : `<span class="admin-badge admin-badge-suspended">Suspended</span>`;

  const strikeBadge = v.strike_count > 0
    ? `<span class="admin-badge admin-badge-flag">${v.strike_count} Strike${v.strike_count > 1 ? "s" : ""}</span>`
    : "-";

  const planBadge = v.badge
    ? `<span class="admin-badge admin-badge-live">${v.badge}</span>`
    : "-";

  const subActive = v.is_subscription_active
    ? `<span class="admin-badge admin-badge-live">Paid Active</span>`
    : v.is_trial_active
      ? `<span class="admin-badge admin-badge-flag">Trial Active</span>`
      : `<span class="admin-badge admin-badge-inactive">Expired</span>`;

  const photo = v.profile_photo
    ? `<img src="${v.profile_photo}" class="admin-vendor-photo" alt="${v.name}">`
    : `<div class="admin-vendor-photo-placeholder">${v.name.charAt(0)}</div>`;

  document.getElementById('vendorInfoCard').innerHTML = `
    <div class="admin-vendor-header">
      ${photo}
      <div>
        <h1>${v.name}</h1>
      </div>
    </div>

    <div class="admin-vendor-fields">
      <div><label>Email</label><span>${v.email}</span></div>
      <div><label>Mobile</label><span>${v.mobile}</span></div>
      <div><label>GST Number</label><span>${v.gst_number || "-"}</span></div>
      <div><label>Pincode</label><span>${v.pincode}</span></div>
      <div><label>City</label><span>${v.city}</span></div>
      <div><label>Area</label><span>${v.area || "-"}</span></div>
      <div><label>State</label><span>${v.state}</span></div>
      <div><label>Coordinates</label><span>${v.latitude ?? "-"}, ${v.longitude ?? "-"}</span></div>

      <div><label>Verified</label><span>${verified}</span></div>
      <div><label>Status</label><span>${status}</span></div>
      <div><label>Strikes</label><span>${strikeBadge}</span></div>
      <div><label>Suspended At</label><span>${v.suspended_at || "-"}</span></div>
      <div><label>Suspended Reason</label><span>${v.suspended_reason || "-"}</span></div>

      <div><label>Plan</label><span>${v.subscription_plan.charAt(0).toUpperCase() + v.subscription_plan.slice(1)}</span></div>
      <div><label>Effective Plan</label><span>${v.effective_plan}</span></div>
      <div><label>Plan Badge</label><span>${planBadge}</span></div>
      <div><label>Subscription</label><span>${subActive}</span></div>
      <div><label>Expires On</label><span>${v.subscription_expires_at || "-"}</span></div>
      <div><label>Max Active Posts</label><span>${v.max_active_posts === null ? "Unlimited" : v.max_active_posts}</span></div>
      <div><label>Active Posts Now</label><span>${v.active_product_count}</span></div>

      <div><label>Google Linked</label><span>${v.google_linked ? "Yes" : "No"}</span></div>
      <div><label>Facebook Linked</label><span>${v.facebook_linked ? "Yes" : "No"}</span></div>
      <div><label>Joined</label><span>${v.created_at}</span></div>
      <div><label>Last Updated</label><span>${v.updated_at}</span></div>
    </div>

    <div class="admin-vendor-actions">
      ${!v.is_active
      ? `<button id="unflagVendorBtn" class="admin-action-btn">Unflag &amp; Reactivate</button>`
      : `<button id="suspendVendorBtn" class="admin-action-btn danger">Suspend</button>`}
    </div>
  `;

  document.getElementById('unflagVendorBtn')?.addEventListener('click', async () => {
    const res = await apiRequest(`/auth/admin/vendors/${vendorId}/unflag`, 'POST');
    if (res.success) {
      showToast('Vendor unflagged.', 'success');
      loadVendorDetail();
    } else {
      showToast(res.message || 'Failed to unflag vendor.', 'error');
    }
  });

  document.getElementById('suspendVendorBtn')?.addEventListener('click', () => {
    document.getElementById('suspendReasonInput').value = '';
    document.getElementById('suspendModal').classList.add('is-open');
  });
}

document.getElementById('suspendCancel')?.addEventListener('click', () => {
  document.getElementById('suspendModal').classList.remove('is-open');
});

document.getElementById('suspendConfirm')?.addEventListener('click', async () => {
  const reason = document.getElementById('suspendReasonInput').value.trim();
  if (!reason) {
    showToast('Please enter a reason.', 'error');
    return;
  }
  document.getElementById('suspendModal').classList.remove('is-open');
  const res = await apiRequest(`/auth/admin/vendors/${vendorId}/suspend`, 'POST', { reason });
  if (res.success) {
    showToast('Vendor suspended and notified.', 'success');
    loadVendorDetail();
  } else {
    showToast(res.message || 'Failed to suspend.', 'error');
  }
});

function renderVendorStrikes(strikes) {
  const list = document.getElementById('vendorStrikesList');
  if (!strikes || strikes.length === 0) {
    list.innerHTML = `<div class="admin-empty">No strikes on record.</div>`;
    return;
  }
  list.innerHTML = strikes.map(s => `
    <div class="admin-strike-row">
      <span class="admin-badge admin-badge-flag">Strike ${s.strike_number}</span>
      <div>
        <strong>${s.product_name || "Unknown product"}${s.product_deleted ? ' <span style="color:#9ca3af;font-weight:400;font-size:12px;">(deleted)</span>' : ''}</strong>
        <p>${s.reason}</p>
        <small>${s.created_at}</small>
      </div>
    </div>
  `).join('');
}

function renderVendorProducts(products) {
  const grid = document.getElementById('vendorProductsGrid');
  if (!products || products.length === 0) {
    grid.innerHTML = `<div class="admin-empty">No live products for this vendor.</div>`;
    return;
  }
  grid.innerHTML = products.map(product => `
    <a class="admin-product-card" href="../p.html?slug=${product.slug}&admin=1">
      ${product.image
      ? `<img src="${product.image}" alt="${product.name}">`
      : `<div class="admin-product-card-noimg"></div>`}
      <div class="admin-product-card-body">
        <strong>${product.name}</strong>
        <small>${product.category}</small>
      </div>
    </a>
  `).join('');
}

document.addEventListener('DOMContentLoaded', loadVendorDetail);
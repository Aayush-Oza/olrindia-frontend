/* ============================================================
   OLR INDIA – VENDOR UPGRADE  (shared: my-products + profile)
   Requires: vendorProfile from vendor-nav.js
   Load AFTER vendor-nav.js, BEFORE page-specific JS.
   ============================================================ */

const PLAN_LABELS = {
  free: 'Free',
  starter: 'Starter', starter_yearly: 'Starter Yearly',
  growth: 'Growth',   growth_yearly: 'Growth Yearly',
  premium: 'Premium', premium_yearly: 'Premium Yearly',
};

const PLAN_PRICES = {
  starter: 249, growth: 449, premium: 999,
  starter_yearly: 2499, growth_yearly: 4499, premium_yearly: 9999,
};

const PLAN_YEARLY_DISCOUNT = {
  starter_yearly: { original: 2988,  saving: 489,  percent: 16 },
  growth_yearly:  { original: 5388,  saving: 889,  percent: 17 },
  premium_yearly: { original: 11988, saving: 1989, percent: 17 },
};

function openUpgradeModal(message) {
  const sub = document.getElementById('upgradeModalText');
  if (sub) sub.textContent = message || 'Upgrade your plan to list more products and get better visibility.';
  renderPlanCards();
  document.getElementById('upgradeModalOverlay').classList.add('open');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('upgradeModalCancel')?.addEventListener('click', () =>
    document.getElementById('upgradeModalOverlay').classList.remove('open')
  );
  document.getElementById('upgradeModalOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('upgradeModalOverlay'))
      document.getElementById('upgradeModalOverlay').classList.remove('open');
  });
});

function renderPlanCards() {
  if (!vendorProfile) return;
  const current = vendorProfile.subscription_plan || 'free';
  const expires = vendorProfile.subscription_expires_at;

  const bar = document.getElementById('plansCurrentBar');
  if (bar) {
    let expiryText = '';
    if (expires && current !== 'free') {
      const d = new Date(expires);
      expiryText = ` · renews ${d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`;
    }
    bar.innerHTML = `You're on <strong>${PLAN_LABELS[current] || current}</strong>${expiryText}`;
  }

  const rankMap = { free:0, starter:1, starter_yearly:1, growth:2, growth_yearly:2, premium:3, premium_yearly:3 };
  const currentRank = rankMap[current] ?? 0;

  const monthlyPlans = [
    { key:'free',    label:'Free',    price:'₹0',   sub:'Forever free', badge:'',
      features:[{text:'5 active listings',yes:true},{text:'Basic visibility',yes:true},{text:'No badge',yes:false},{text:'No priority listing',yes:false}] },
    { key:'starter', label:'Starter', price:'₹249', sub:'per month', badge:'',
      features:[{text:'10 active listings',yes:true},{text:'Priority over free vendors',yes:true},{text:'No badge',yes:false},{text:'Email support',yes:true}] },
    { key:'growth',  label:'Growth',  price:'₹449', sub:'per month', badge:'✓ Verified',
      features:[{text:'20 active listings',yes:true},{text:'Higher priority ranking',yes:true},{text:'Verified badge ✓',yes:true},{text:'Priority support',yes:true}] },
    { key:'premium', label:'Premium', price:'₹999', sub:'per month', badge:'★ Featured',
      features:[{text:'Unlimited listings',yes:true},{text:'Highest priority ranking',yes:true},{text:'Featured badge ★',yes:true},{text:'Dedicated support',yes:true}] },
  ];

  const yearlyPlans = [
    { key:'starter_yearly', label:'Starter', price:'₹2,499', sub:'per year', badge:'',
      features:[{text:'10 active listings',yes:true},{text:'Priority over free vendors',yes:true},{text:'No badge',yes:false},{text:'Email support',yes:true}] },
    { key:'growth_yearly',  label:'Growth',  price:'₹4,499', sub:'per year', badge:'✓ Verified',
      features:[{text:'20 active listings',yes:true},{text:'Higher priority ranking',yes:true},{text:'Verified badge ✓',yes:true},{text:'Priority support',yes:true}] },
    { key:'premium_yearly', label:'Premium', price:'₹9,999', sub:'per year', badge:'★ Featured',
      features:[{text:'Unlimited listings',yes:true},{text:'Highest priority ranking',yes:true},{text:'Featured badge ★',yes:true},{text:'Dedicated support',yes:true}] },
  ];

  function planCardHtml(plan, isYearly) {
    const isCurrent = plan.key === current;
    const rank = rankMap[plan.key] ?? 0;
    const isLower = rank < currentRank;
    const isPopular = plan.key === 'growth' || plan.key === 'growth_yearly';
    const discount = isYearly ? PLAN_YEARLY_DISCOUNT[plan.key] : null;
    let btnLabel = `Get ${plan.label}`, btnDisabled = '', btnOpacity = '';
    if (isCurrent) { btnLabel = 'Current Plan'; btnDisabled = 'disabled'; }
    else if (isLower) { btnLabel = 'Downgrade'; btnDisabled = 'disabled'; btnOpacity = 'style="opacity:0.35;"'; }

    const discountHtml = discount ? `
      <div class="plan-yearly-discount">
        <span class="plan-original-price">₹${discount.original.toLocaleString('en-IN')}/yr</span>
        <span class="plan-save-badge">Save ${discount.percent}%</span>
      </div>
      <div class="plan-saving-amount">You save ₹${discount.saving.toLocaleString('en-IN')}</div>` : '';

    return `
      <div class="plan-card ${isCurrent ? 'plan-card-current' : ''} ${isPopular ? 'plan-card-popular' : ''}">
        ${isPopular ? '<div class="plan-popular-tag">Most Popular</div>' : ''}
        ${isCurrent ? '<div class="plan-current-tag">Current</div>' : ''}
        <div class="plan-card-top">
          <div class="plan-label">
            ${plan.label}
            ${plan.badge ? `<span class="plan-badge">${plan.badge}</span>` : ''}
          </div>
          <div style="display:flex;align-items:baseline;gap:4px;">
            <div class="plan-price">${plan.price}</div>
            <div class="plan-sub">${plan.sub}</div>
          </div>
          ${discountHtml}
        </div>
        <ul class="plan-features" style="margin:8px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px;flex:1;">
          ${plan.features.map(f => `
            <li style="font-size:12px;color:${f.yes ? 'var(--c-ink-soft)' : 'var(--c-ink-faint)'};">
              ${f.yes ? '✓' : '✗'} ${f.text}
            </li>`).join('')}
        </ul>
        <button class="btn btn-primary plan-select-btn"
          style="width:100%;margin-top:12px;padding:11px 10px;font-size:13px;"
          ${btnDisabled} ${btnOpacity}
          onclick="handlePlanSelect('${plan.key}')" id="planBtn-${plan.key}">
          <span class="btn-label">${btnLabel}</span><span class="spinner"></span>
        </button>
      </div>`;
  }

  // Render tabs into sticky container
  const tabsContainer = document.getElementById('planTabsContainer');
  if (tabsContainer) {
    tabsContainer.innerHTML = `
      <div style="display:flex;gap:8px;">
        <button id="planTabMonthly" onclick="switchPlanTab('monthly')"
          style="flex:1;padding:11px 10px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;border:2px solid #2563eb;background:#2563eb;color:#fff;transition:all 0.15s;">
          Monthly
        </button>
        <button id="planTabYearly" onclick="switchPlanTab('yearly')"
          style="flex:1;padding:11px 10px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;border:2px solid #e5e7eb;background:#fff;color:#6b7280;transition:all 0.15s;position:relative;">
          Yearly
          <span style="position:absolute;top:-11px;right:10px;background:#16a34a;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap;">Save 17%</span>
        </button>
      </div>`;
  }

  const monthlyRow1 = monthlyPlans.slice(0, 3);
  const monthlyRow2 = monthlyPlans.slice(3);

  const container = document.getElementById('plansContainer');
  if (!container) return;

  container.innerHTML = `
    <div id="planListMonthly">
      <div class="plans-grid-3">
        ${monthlyRow1.map(p => planCardHtml(p, false)).join('')}
      </div>
      <div class="plans-grid-3" style="margin-top:14px;">
        ${monthlyRow2.map(p => planCardHtml(p, false)).join('')}
      </div>
    </div>
    <div id="planListYearly" style="display:none;">
      <div class="plans-grid-3">
        ${yearlyPlans.map(p => planCardHtml(p, true)).join('')}
      </div>
    </div>`;
}

function switchPlanTab(tab) {
  const isMonthly = tab === 'monthly';
  document.getElementById('planListMonthly').style.display = isMonthly ? 'block' : 'none';
  document.getElementById('planListYearly').style.display  = isMonthly ? 'none'  : 'block';
  const monthlyBtn = document.getElementById('planTabMonthly');
  const yearlyBtn  = document.getElementById('planTabYearly');
  monthlyBtn.style.background  = isMonthly ? '#2563eb' : '#fff';
  monthlyBtn.style.color       = isMonthly ? '#fff'    : '#6b7280';
  monthlyBtn.style.borderColor = isMonthly ? '#2563eb' : '#e5e7eb';
  yearlyBtn.style.background   = isMonthly ? '#fff'    : '#2563eb';
  yearlyBtn.style.color        = isMonthly ? '#6b7280' : '#fff';
  yearlyBtn.style.borderColor  = isMonthly ? '#e5e7eb' : '#2563eb';
}

async function handlePlanSelect(planKey) {
  const btn = document.getElementById(`planBtn-${planKey}`);
  try {
    setButtonLoading(btn, true);
    const isYearly = planKey.endsWith('_yearly');
    const basePlan = planKey.replace('_yearly', '');
    const res = await apiRequest('/auth/vendor/subscribe', 'POST', { plan: basePlan, billing_cycle: isYearly ? 'yearly' : 'monthly' });
    if (!res.success) { toastError(res.message || 'Could not start payment.'); setButtonLoading(btn, false); return; }
    setButtonLoading(btn, false);
    const options = {
      key: res.key_id, amount: res.amount, currency: res.currency,
      name: 'OLR India', description: `${res.plan_label} Plan · ${isYearly ? '365 days' : '30 days'}`, order_id: res.order_id,
      prefill: { name: res.vendor?.name || '', email: res.vendor?.email || '' },
      theme: { color: '#2563eb' },
      handler: async function (response) {
        document.getElementById('upgradeModalOverlay').classList.remove('open');
        await verifyAndActivatePlan(response);
      },
      modal: { ondismiss: () => setButtonLoading(btn, false) },
    };
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', r => { toastError(`Payment failed: ${r.error.description || 'Try again.'}`); setButtonLoading(btn, false); });
    rzp.open();
  } catch { toastError('Something went wrong.'); if (btn) setButtonLoading(btn, false); }
}

async function verifyAndActivatePlan({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  try {
    const res = await apiRequest('/auth/vendor/payment/verify', 'POST', { razorpay_order_id, razorpay_payment_id, razorpay_signature });
    if (res.success) {
      toastSuccess(`🎉 ${res.message}`);
      await loadVendorProfile();
      if (typeof loadProducts === 'function') await loadProducts();
    } else toastError(res.message || 'Payment verification failed. Contact support.');
  } catch { showPaymentRetryBanner({ razorpay_order_id, razorpay_payment_id, razorpay_signature }); }
}

function showPaymentRetryBanner({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  let el = document.getElementById('paymentRetryBanner');
  if (!el) {
    el = document.createElement('div'); el.id = 'paymentRetryBanner';
    document.getElementById('panel-products')?.insertBefore(el, document.getElementById('panel-products').firstChild);
  }
  el.style.cssText = `display:flex;align-items:center;justify-content:space-between;background:#fff7ed;border:1px solid #f97316;color:#9a3412;padding:14px 16px;border-radius:8px;margin-bottom:16px;font-size:13.5px;gap:12px;flex-wrap:wrap;`;
  el.innerHTML = `<span>⚠️ Payment deducted but plan activating. Contact <a href="mailto:support@olrindia.com" style="color:#9a3412;font-weight:600;">support@olrindia.com</a> with ID: <strong>${razorpay_payment_id}</strong></span>
    <button class="btn btn-primary" style="width:auto;padding:8px 16px;flex-shrink:0;font-size:13px;" id="paymentRetryBtn">Retry Activation</button>`;
  document.getElementById('paymentRetryBtn').addEventListener('click', async () => {
    el.innerHTML = `<span>⏳ Retrying...</span>`;
    await verifyAndActivatePlan({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
    el.remove();
  });
}
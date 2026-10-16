/* ============================================================
   OLR INDIA - VENDOR AUTH LOGIC
   Shared across all /vendor/*.html pages.
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initVendorLoginForm();
  initVendorSignupForm();
  initVendorForgotForm();
  initVendorResetForm();
  initVendorVerifyEmail();
  initVendorDashboard();
});

// ── GOOGLE SIGN-IN (login + signup pages) ──────────────────────
async function handleVendorGoogleSignIn(btn) {
  setButtonLoading(btn, true);
  if (!await waitForFirebase()) { setButtonLoading(btn, false); return; }
  const idToken = await window.signInWithGoogle();
  if (!idToken) { setButtonLoading(btn, false); return; }

  const res = await apiRequest("/auth/vendor/google", "POST", { id_token: idToken });
  setButtonLoading(btn, false);

  if (!res.success) {
    toastError(res.message || "Google sign-in failed. Please try again.");
    return;
  }

  if (res.is_new_vendor) {
    // New vendor - store prefill data and redirect to signup form
    sessionStorage.setItem("olr_vendor_google_prefill", JSON.stringify(res.google_prefill));
    toastInfo("Almost there! Complete your vendor details to continue.");
    setTimeout(() => { window.location.href = "signup.html?via=google"; }, 700);
  } else {
    // Existing vendor - log in directly
    clearSessionAccount("vendor");
    saveSessionAccount("vendor", res.vendor);
    localStorage.setItem('olr_vendor_session', res.vendor.id);
    toastSuccess("Signed in with Google! Redirecting…");
    setTimeout(() => { window.location.href = "/vendor/my-products"; }, 700);
  }
}

// ── LOGIN ──────────────────────────────────────────────────────
function initVendorLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');
  const googleBtn = document.getElementById("googleSignInBtn");

  if (googleBtn) {
    googleBtn.addEventListener("click", () => handleVendorGoogleSignIn(googleBtn));
  }
  form.querySelectorAll(".pw-toggle").forEach((btn) => {
    wirePasswordToggle(
      btn,
      btn.closest(".input-wrap").querySelector("input")
    );
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldErrors(form);

    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;

    let hasError = false;
    if (!validateEmailFormat(email)) {
      setFieldError(form.querySelector('[data-field="email"]'), "Enter a valid email address.");
      hasError = true;
    }
    if (!password) {
      setFieldError(form.querySelector('[data-field="password"]'), "Password is required.");
      hasError = true;
    }
    if (hasError) return;

    setButtonLoading(submitBtn, true);
    const res = await apiRequest("/auth/vendor/login", "POST", { email, password });
    setButtonLoading(submitBtn, false);

    if (res.success) {
      clearSessionAccount("vendor");
      saveSessionAccount("vendor", res.vendor);
      localStorage.setItem('olr_vendor_session', res.vendor.id);
      toastSuccess("Welcome back! Redirecting…");
      setTimeout(() => { window.location.href = "/vendor/my-products"; }, 700);
    } else {
      if (res.resend_verification) {
        toastError(res.message + " Check your inbox, or contact support to resend it.");
      } else {
        routeServerError(res.message, form);
      }
    }
  });
}

// ── SIGNUP ─────────────────────────────────────────────────────
function initVendorSignupForm() {
  const form = document.getElementById("signupForm");
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  const googleBtn = document.getElementById("googleSignInBtn");

  // Check if arriving via Google - pre-fill name & email, lock them
  const googlePrefillRaw = sessionStorage.getItem("olr_vendor_google_prefill");
  const googlePrefill = googlePrefillRaw ? JSON.parse(googlePrefillRaw) : null;

  if (googlePrefill) {
    const banner = document.getElementById("googlePrefillBanner");
    if (banner) banner.style.display = "flex";

    // Hide Google button - already signed in via Google
    const gBtn = document.getElementById("googleSignInBtn");
    if (gBtn) gBtn.closest(".btn-google") && (gBtn.style.display = "none");
    const orDivider = document.querySelector(".auth-or");
    if (orDivider) orDivider.style.display = "none";

    if (form.name) { form.name.value = googlePrefill.name; }
    if (form.email) { form.email.value = googlePrefill.email; form.email.readOnly = true; }

    const pwSection = document.getElementById("passwordSection");
    if (pwSection) pwSection.style.display = "none";
  }

  if (googleBtn) {
    googleBtn.addEventListener("click", () => handleVendorGoogleSignIn(googleBtn));
  }

  const pwInput = form.querySelector('[name="password"]');
  const meterEl = form.querySelector(".pw-strength");
  const meterLabel = form.querySelector(".pw-strength-label");
  if (pwInput && meterEl && meterLabel) wirePasswordStrengthMeter(pwInput, meterEl, meterLabel);

  form.querySelectorAll(".pw-toggle").forEach((btn) => {
    wirePasswordToggle(btn, btn.closest(".input-wrap").querySelector("input"));
  });

  wirePincodeAutofill({
    pincodeInput: form.pincode,
    stateInput: form.state,
    cityInput: form.city,
    areaInput: form.area,
    statusEl: form.querySelector(".pincode-status"),
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldErrors(form);

    const isGoogleSignup = !!googlePrefill;
    console.log("isGoogleSignup:", isGoogleSignup, "prefill:", googlePrefill);

    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim().toLowerCase(),
      mobile: form.mobile.value.trim(),
      password: isGoogleSignup ? "__google__" : form.password.value,
      confirm_password: isGoogleSignup ? "__google__" : form.confirm_password.value,
      gst_number: form.gst_number.value.trim(),
      pincode: form.pincode.value.trim(),
      city: form.city.value.trim(),
      state: form.state.value.trim(),
      area: form.area.value.trim(),
    };
    if (googlePrefill) data.google_id = googlePrefill.google_id;

    let hasError = false;
    if (data.name.length < 2) {
      setFieldError(form.querySelector('[data-field="name"]'), "Enter your full name.");
      hasError = true;
    }
    if (!validateEmailFormat(data.email)) {
      setFieldError(form.querySelector('[data-field="email"]'), "Enter a valid email address.");
      hasError = true;
    }
    if (!validateMobileFormat(data.mobile)) {
      setFieldError(form.querySelector('[data-field="mobile"]'), "Enter a valid 10-digit mobile number.");
      hasError = true;
    }
    if (!isGoogleSignup) {
      const pwErrors = validatePasswordRules(data.password);
      if (pwErrors.length) {
        setFieldError(form.querySelector('[data-field="password"]'), "Needs " + pwErrors.join(", ") + ".");
        hasError = true;
      }
      if (data.password !== data.confirm_password) {
        setFieldError(form.querySelector('[data-field="confirm_password"]'), "Passwords do not match.");
        hasError = true;
      }
    }
    if (!data.pincode || !/^\d{6}$/.test(data.pincode)) {
      setFieldError(form.querySelector('[data-field="pincode"]'), "Enter a valid 6-digit pincode.");
      hasError = true;
    }
    if (!data.city) {
      setFieldError(form.querySelector('[data-field="city"]'), "City is required.");
      hasError = true;
    }
    if (!data.state) {
      setFieldError(form.querySelector('[data-field="state"]'), "State is required.");
      hasError = true;
    }
    if (!form.terms.checked) {
      toastError("Please accept the Terms & Privacy Policy to continue.");
      hasError = true;
    }
    if (hasError) return;

    setButtonLoading(submitBtn, true);
    const res = await apiRequest("/auth/vendor/register", "POST", data);
    setButtonLoading(submitBtn, false);

    if (res.success) {
      sessionStorage.removeItem("olr_vendor_google_prefill");
      showPostSignupMessage(form, res.message);
    } else {
      routeServerError(res.message, form);
    }
  });
}

function showPostSignupMessage(form, message) {
  form.closest(".auth-card").innerHTML = `
    <div class="status-icon is-success">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.8"/></svg>
    </div>
    <h1 style="text-align:center;">Check your inbox</h1>
    <p style="text-align:center;">${message}</p>
    <a href="/vendor/login" class="btn btn-primary" style="margin-top:24px;">Go to login</a>
  `;
}

// ── FORGOT PASSWORD ────────────────────────────────────────────
function initVendorForgotForm() {
  const form = document.getElementById("forgotForm");
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const email = form.email.value.trim().toLowerCase();

    if (!validateEmailFormat(email)) {
      setFieldError(form.querySelector('[data-field="email"]'), "Enter a valid email address.");
      return;
    }

    setButtonLoading(submitBtn, true);
    const res = await apiRequest("/auth/vendor/forgot-password", "POST", { email });
    setButtonLoading(submitBtn, false);

    if (res.success) {
      form.closest(".auth-card").innerHTML = `
        <div class="status-icon is-success">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.8"/></svg>
        </div>
        <h1 style="text-align:center;">Check your inbox</h1>
        <p style="text-align:center;">${res.message}</p>
        <a href="/vendor/login" class="btn btn-primary" style="margin-top:24px;">Back to login</a>
      `;
    } else {
      toastError(res.message);
    }
  });
}

// ── RESET PASSWORD ─────────────────────────────────────────────
function initVendorResetForm() {
  const form = document.getElementById("resetForm");
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');

  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) {
    form.closest(".auth-card").innerHTML = `
      <div class="status-icon is-error">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.8"/></svg>
      </div>
      <h1 style="text-align:center;">Invalid link</h1>
      <p style="text-align:center;">This reset link is missing its token. Please request a new one.</p>
      <a href="/vendor/forgot-password" class="btn btn-primary" style="margin-top:24px;">Request new link</a>
    `;
    return;
  }

  form.querySelectorAll(".pw-toggle").forEach((btn) => {
    wirePasswordToggle(btn, btn.closest(".input-wrap").querySelector("input"));
  });
  const pwInput = form.querySelector('[name="new_password"]');
  const meterEl = form.querySelector(".pw-strength");
  const meterLabel = form.querySelector(".pw-strength-label");
  if (pwInput && meterEl && meterLabel) wirePasswordStrengthMeter(pwInput, meterEl, meterLabel);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldErrors(form);

    const new_password = form.new_password.value;
    const confirm_password = form.confirm_password.value;

    let hasError = false;
    const pwErrors = validatePasswordRules(new_password);
    if (pwErrors.length) {
      setFieldError(form.querySelector('[data-field="new_password"]'), "Needs " + pwErrors.join(", ") + ".");
      hasError = true;
    }
    if (new_password !== confirm_password) {
      setFieldError(form.querySelector('[data-field="confirm_password"]'), "Passwords do not match.");
      hasError = true;
    }
    if (hasError) return;

    setButtonLoading(submitBtn, true);
    const res = await apiRequest("/auth/vendor/reset-password", "POST", { token, new_password, confirm_password });
    setButtonLoading(submitBtn, false);

    if (res.success) {
      toastSuccess(res.message);
      setTimeout(() => { window.location.href = "/vendor/login"; }, 1200);
    } else {
      toastError(res.message);
    }
  });
}

// ── VERIFY EMAIL ───────────────────────────────────────────────
async function initVendorVerifyEmail() {
  const el = document.getElementById("verifyStatus");
  if (!el) return;

  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) {
    renderVerifyResult(el, false, "Verification token is missing from the link.");
    return;
  }

  const res = await apiRequest(`/auth/vendor/verify-email?token=${encodeURIComponent(token)}`, "GET");
  renderVerifyResult(el, res.success, res.message);
}

function renderVerifyResult(el, success, message) {
  el.innerHTML = `
    <div class="status-icon ${success ? "is-success" : "is-error"}">
      ${success
      ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.8"/></svg>'
      : '<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.8"/></svg>'}
    </div>
    <h1 style="text-align:center;">${success ? "Email verified!" : "Verification failed"}</h1>
    <p style="text-align:center;">${message}</p>
    <a href="/vendor/login" class="btn btn-primary" style="margin-top:24px;">Go to login</a>
  `;
}

// ── Wait for Firebase to be ready before calling signInWithGoogle ──
async function waitForFirebase() {
  for (let i = 0; i < 20; i++) {
    if (typeof window.signInWithGoogle === "function") return true;
    await new Promise(r => setTimeout(r, 150));
  }
  toastError("Google Sign-In failed to load. Please refresh the page.");
  return false;
}

// ── APPEND THIS TO THE BOTTOM OF vendor-auth.js ──────────────
// Replaces the old initVendorDashboard() function entirely.
// Delete the old initVendorDashboard block and paste this instead.

function initVendorDashboard() {
  const root = document.getElementById("dashRoot");
  if (!root) return;

  (async () => {
    const res = await apiRequest("/auth/vendor/profile", "GET");
    if (!res.success) {
      const account = getSessionAccount("vendor");
      if (!account) { window.location.href = "/vendor/login"; return; }
      populateVendorDashboard(account);
    } else {
      saveSessionAccount("vendor", res.vendor);
      populateVendorDashboard(res.vendor);
      const savedVendorId = res.vendor.id;
      localStorage.setItem('olr_vendor_session', savedVendorId);
      window.addEventListener("storage", (e) => {
        if (e.key === "olr_vendor_session" && e.newValue !== String(savedVendorId)) {
          clearSessionAccount("vendor");
          window.location.href = "/vendor/login";
        }
      });
    }
    if (typeof listenToUnreadBadge === 'function') {
  ensureFirebaseChatAuth('vendor').then(ok => { if (ok) listenToUnreadBadge(); });
}
    // Load categories and products after profile
    if (typeof loadCategories === "function") await loadCategories();
    if (typeof loadProducts === "function") await loadProducts();
    if (typeof initImageSlots === "function") initImageSlots();
    const savedVendorId = res.vendor.id;
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible") {
        const res = await apiRequest("/auth/vendor/profile", "GET");
        if (!res.success && res.httpStatus === 401) {
          clearSessionAccount("vendor");
          window.location.href = "/vendor/login";
        }
      }
    });
  })();
}

function populateVendorDashboard(account) {
  const initials = getInitials(account.name);

  // Navbar
  const navAvatar = document.getElementById("navUserAvatar");
  const navName = document.getElementById("navUserName");
  const navAvatarM = document.getElementById("navUserAvatarMobile");
  const navNameM = document.getElementById("navUserNameMobile");
  if (navAvatar) navAvatar.textContent = initials;
  if (navName) navName.textContent = account.name;
  if (navAvatarM) navAvatarM.textContent = initials;
  if (navNameM) navNameM.textContent = account.name;

  // Welcome
  const welcome = document.getElementById("dashWelcomeName");
  if (welcome) welcome.textContent = account.name.split(" ")[0];

  // Profile panel
  const profAvatar = document.getElementById("profileAvatar");
  if (profAvatar) profAvatar.textContent = initials;
  const profName = document.getElementById("profileName");
  if (profName) profName.textContent = account.name;
  const profEmail = document.getElementById("profileEmail");
  if (profEmail) profEmail.textContent = account.email;

  // Locked fields
  const infoEmail = document.getElementById("infoEmail");
  if (infoEmail) infoEmail.textContent = account.email;

  // Editable fields
  const fields = ["name", "mobile", "gst_number", "pincode", "area", "city", "state"];
  fields.forEach(f => {
    const el = document.getElementById("edit_" + f);
    if (el) el.value = account[f] || "";
  });

  // Wire pincode autofill on profile form
  const profileForm = document.getElementById("profileForm");
  if (profileForm) {
    wirePincodeAutofill({
      pincodeInput: profileForm.pincode,
      stateInput: profileForm.state,
      cityInput: profileForm.city,
      areaInput: profileForm.area,
      statusEl: profileForm.querySelector(".pincode-status"),
    });

    const saveBtn = profileForm.querySelector('button[type="submit"]');
    profileForm.onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        name: profileForm.name.value.trim(),
        mobile: profileForm.mobile.value.trim(),
        gst_number: profileForm.gst_number.value.trim(),
        pincode: profileForm.pincode.value.trim(),
        area: profileForm.area.value.trim(),
        city: profileForm.city.value.trim(),
        state: profileForm.state.value.trim(),
      };
      if (data.name.length < 2) { toastError("Name must be at least 2 characters."); return; }
      setButtonLoading(saveBtn, true);
      const res = await apiRequest("/auth/vendor/profile", "PUT", data);
      setButtonLoading(saveBtn, false);
      if (res.success) {
        saveSessionAccount("vendor", { ...account, ...data });
        populateVendorDashboard({ ...account, ...data });
        toastSuccess("Profile updated!");
        await loadVendorProfile();
      } else {
        toastError(res.message || "Update failed.");
      }
    };
  }

  // Logout
  ["logoutBtn", "logoutBtnMobile"].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const confirmed = await showConfirm({
        title: "Log out?",
        text: "You'll need to sign in again to access your vendor account.",
        confirmLabel: "Log out",
        cancelLabel: "Stay logged in",
      });
      if (!confirmed) return;
      await apiRequest("/auth/vendor/logout", "POST");
      clearSessionAccount("vendor");
      window.location.href = "/vendor/login";
    });
  });
}
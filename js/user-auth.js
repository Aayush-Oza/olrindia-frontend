/* ============================================================
   OLR INDIA - USER AUTH LOGIC
   Shared across all /user/*.html pages.
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initUserLoginForm();
  initUserSignupForm();
  initUserForgotForm();
  initUserResetForm();
  initUserVerifyEmail();
});

// ── GOOGLE SIGN-IN (shared handler for login + signup pages) ───
async function handleUserGoogleSignIn(btn) {
  setButtonLoading(btn, true);
  if (!await waitForFirebase()) { setButtonLoading(btn, false); return; }
  const idToken = await window.signInWithGoogle();
  if (!idToken) {
    setButtonLoading(btn, false);
    return; // user closed popup - no toast needed
  }

  const res = await apiRequest("/auth/user/google", "POST", { id_token: idToken });
  setButtonLoading(btn, false);

  if (res.success) {
    clearSessionAccount("user");
    saveSessionAccount("user", res.user);
    localStorage.setItem('olr_user_session', res.user.id);
    toastSuccess(res.message);
    const returnUrl = sessionStorage.getItem('olr_return_after_login');
    sessionStorage.removeItem('olr_return_after_login');
    setTimeout(() => {
      window.location.href = returnUrl || "dashboard.html";
    }, 700);
  } else {
    toastError(res.message || "Google sign-in failed. Please try again.");
  }
}

// ── LOGIN ──────────────────────────────────────────────────────
function initUserLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  const googleBtn = document.getElementById("googleSignInBtn");

  if (googleBtn) {
    googleBtn.addEventListener("click", () => handleUserGoogleSignIn(googleBtn));
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
    const res = await apiRequest("/auth/user/login", "POST", { email, password });
    setButtonLoading(submitBtn, false);

    if (res.success) {
      clearSessionAccount("user");
      saveSessionAccount("user", res.user);
      localStorage.setItem('olr_user_session', res.user.id);
      toastSuccess("Welcome back! Redirecting…");
      const returnUrl = sessionStorage.getItem('olr_return_after_login');
      sessionStorage.removeItem('olr_return_after_login');
      setTimeout(() => { window.location.href = returnUrl || "dashboard.html"; }, 700);
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
function initUserSignupForm() {
  const form = document.getElementById("signupForm");
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  const googleBtn = document.getElementById("googleSignInBtn");

  if (googleBtn) {
    googleBtn.addEventListener("click", () => handleUserGoogleSignIn(googleBtn));
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

  const useLocationBtn = form.querySelector(".use-location-btn");
  if (useLocationBtn) {
    useLocationBtn.addEventListener("click", async () => {
      useLocationBtn.textContent = "Locating…";
      const loc = await getBrowserLocation();
      if (loc) {
        form.latitude.value = loc.latitude;
        form.longitude.value = loc.longitude;
        useLocationBtn.textContent = "Location added ✓";
        toastSuccess("Current location added.");
      } else {
        useLocationBtn.textContent = "Use my current location";
        toastError("Couldn't access your location. You can skip this - it's optional.");
      }
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldErrors(form);

    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim().toLowerCase(),
      password: form.password.value,
      confirm_password: form.confirm_password.value,
      mobile: form.mobile.value.trim(),
      pincode: form.pincode.value.trim(),
      state: form.state.value.trim(),
      city: form.city.value.trim(),
      area: form.area.value.trim(),
      latitude: form.latitude.value || null,
      longitude: form.longitude.value || null,
    };

    let hasError = false;
    if (data.name.length < 2) {
      setFieldError(form.querySelector('[data-field="name"]'), "Enter your full name.");
      hasError = true;
    }
    if (!validateEmailFormat(data.email)) {
      setFieldError(form.querySelector('[data-field="email"]'), "Enter a valid email address.");
      hasError = true;
    }
    if (data.mobile && !validateMobileFormat(data.mobile)) {
      setFieldError(form.querySelector('[data-field="mobile"]'), "Enter a valid 10-digit mobile number.");
      hasError = true;
    }
    const pwErrors = validatePasswordRules(data.password);
    if (pwErrors.length) {
      setFieldError(form.querySelector('[data-field="password"]'), "Needs " + pwErrors.join(", ") + ".");
      hasError = true;
    }
    if (data.password !== data.confirm_password) {
      setFieldError(form.querySelector('[data-field="confirm_password"]'), "Passwords do not match.");
      hasError = true;
    }
    if (!form.terms.checked) {
      toastError("Please accept the Terms & Privacy Policy to continue.");
      hasError = true;
    }
    if (hasError) return;

    setButtonLoading(submitBtn, true);
    const res = await apiRequest("/auth/user/register", "POST", data);
    setButtonLoading(submitBtn, false);

    if (res.success) {
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
    <a href="login.html" class="btn btn-primary" style="margin-top:24px;">Go to login</a>
  `;
}

// ── FORGOT PASSWORD ────────────────────────────────────────────
function initUserForgotForm() {
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
    const res = await apiRequest("/auth/user/forgot-password", "POST", { email });
    setButtonLoading(submitBtn, false);

    if (res.success) {
      form.closest(".auth-card").innerHTML = `
        <div class="status-icon is-success">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.8"/></svg>
        </div>
        <h1 style="text-align:center;">Check your inbox</h1>
        <p style="text-align:center;">${res.message}</p>
        <a href="login.html" class="btn btn-primary" style="margin-top:24px;">Back to login</a>
      `;
    } else {
      toastError(res.message);
    }
  });
}

// ── RESET PASSWORD ─────────────────────────────────────────────
function initUserResetForm() {
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
      <a href="forgot-password.html" class="btn btn-primary" style="margin-top:24px;">Request new link</a>
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
    const res = await apiRequest("/auth/user/reset-password", "POST", { token, new_password, confirm_password });
    setButtonLoading(submitBtn, false);

    if (res.success) {
      toastSuccess(res.message);
      setTimeout(() => { window.location.href = "login.html"; }, 1200);
    } else {
      toastError(res.message);
    }
  });
}

// ── VERIFY EMAIL ───────────────────────────────────────────────
async function initUserVerifyEmail() {
  const el = document.getElementById("verifyStatus");
  if (!el) return;

  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) {
    renderVerifyResult(el, false, "Verification token is missing from the link.");
    return;
  }

  const res = await apiRequest(`/auth/user/verify-email?token=${encodeURIComponent(token)}`, "GET");
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
    <a href="login.html" class="btn btn-primary" style="margin-top:24px;">Go to login</a>
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
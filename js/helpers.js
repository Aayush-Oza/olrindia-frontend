/* ============================================================
   OLR INDIA - HELPERS
   Validators mirror backend rules exactly (config.py / *_auth.py)
   so the user sees errors instantly, before hitting the server.
   Pincode autofill uses the free api.postalpincode.in API.
   ============================================================ */

// ── Validators (mirrors validate_password / validate_aadhar / validate_pan in backend) ──

function validateEmailFormat(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validateMobileFormat(mobile) {
  // Indian mobile numbers: 10 digits, starting 6-9
  return /^[6-9]\d{9}$/.test(mobile);
}

function validatePasswordRules(password) {
  const errors = [];
  if (password.length < 8) errors.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("one uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("one lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("one number");
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push("one special character");
  return errors;
}

function getPasswordStrength(password) {
  const rulesPassed = 5 - validatePasswordRules(password).length;
  if (!password) return { score: 0, label: "" };
  if (rulesPassed <= 2) return { score: 1, label: "Weak" };
  if (rulesPassed <= 4) return { score: 2, label: "Medium" };
  return { score: 3, label: "Strong" };
}

function validateAadharFormat(aadhar) {
  const clean = aadhar.replace(/[\s-]/g, "");
  return /^\d{12}$/.test(clean) ? clean : null;
}

function validatePanFormat(pan) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase());
}

// ── Password strength meter UI wiring ─────────────────────────────
function wirePasswordStrengthMeter(inputEl, meterEl, labelEl) {
  inputEl.addEventListener("input", () => {
    const { score, label } = getPasswordStrength(inputEl.value);
    const bars = meterEl.querySelectorAll(".pw-strength-bar");
    bars.forEach((bar, i) => {
      bar.style.background =
        i < score
          ? score === 1 ? "var(--c-error)" : score === 2 ? "var(--c-orange)" : "var(--c-success)"
          : "var(--c-border)";
    });
    labelEl.textContent = label;
    labelEl.style.color =
      score === 1 ? "var(--c-error)" : score === 2 ? "var(--c-orange-deep)" : score === 3 ? "var(--c-success)" : "var(--c-ink-faint)";
  });
}

// ── Show/hide password toggle ─────────────────────────────────────
function wirePasswordToggle(toggleBtn, inputEl) {
  toggleBtn.addEventListener("click", () => {
    const isHidden = inputEl.type === "password";
    inputEl.type = isHidden ? "text" : "password";
    toggleBtn.innerHTML = isHidden ? EYE_OFF_ICON : EYE_ICON;
  });
}

const EYE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/></svg>`;
const EYE_OFF_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.5A11 11 0 0 1 12 5c7 0 11 7 11 7a13.6 13.6 0 0 1-3.4 4.1M6.5 6.6A13.6 13.6 0 0 0 1 12s4 7 11 7a10.7 10.7 0 0 0 4.2-.85" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;

// ── Pincode autofill (api.postalpincode.in - free, no key) ────────
/**
 * Looks up state/city/area for a 6-digit Indian pincode.
 * @param {string} pincode
 * @returns {Promise<{state:string, city:string, area:string}|null>}
 */
async function fetchPincodeDetails(pincode) {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await res.json();
    if (!data || !data[0] || data[0].Status !== "Success" || !data[0].PostOffice?.length) {
      return null;
    }
    const po = data[0].PostOffice[0];
    return {
      state: po.State,
      city: po.District,
      area: po.Name,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Wires a pincode input to auto-fill state/city/area fields.
 */
function wirePincodeAutofill({ pincodeInput, stateInput, cityInput, areaInput, statusEl }) {
  let pincodeTimer = null;
  pincodeInput.addEventListener("input", () => {
    const val = pincodeInput.value.trim();
    if (val.length !== 6 || !/^\d{6}$/.test(val)) {
      if (statusEl) statusEl.textContent = "";
      clearTimeout(pincodeTimer);
      return;
    }
    if (statusEl) statusEl.textContent = "Looking up…";
    clearTimeout(pincodeTimer);
    pincodeTimer = setTimeout(async () => {
      const details = await fetchPincodeDetails(val);
      if (details) {
        stateInput.value = details.state;
        cityInput.value = details.city;
        if (areaInput) areaInput.value = details.area;
        if (statusEl) { statusEl.textContent = "Location found"; statusEl.style.color = "var(--c-success)"; }
      } else {
        if (statusEl) { statusEl.textContent = "Couldn't find this pincode - enter manually"; statusEl.style.color = "var(--c-ink-faint)"; }
      }
    }, 600);
  });
}

// ── Browser geolocation (optional, used for lat/long) ─────────────
function getBrowserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 6000 }
    );
  });
}

// ── sessionStorage helpers for logged-in account snapshot ─────────
function saveSessionAccount(role, account) {
  sessionStorage.setItem(`olr_${role}`, JSON.stringify(account));
}
function getSessionAccount(role) {
  try {
    return JSON.parse(sessionStorage.getItem(`olr_${role}`));
  } catch (e) {
    return null;
  }
}
function clearSessionAccount(role) {
  sessionStorage.removeItem(`olr_${role}`);
}

function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

// ── Routes a backend error message to the right field, or a toast ─
// Used so duplicate-email / duplicate-mobile errors land under the
// right input instead of a generic toast, matching the backend's
// own wording (see user_auth.py / vendor_auth.py 409 responses).
function routeServerError(message, formEl) {
  const lower = (message || "").toLowerCase();
  if (lower.includes("email") && (lower.includes("exists") || lower.includes("required") || lower.includes("invalid"))) {
    const field = formEl.querySelector('[data-field="email"]');
    if (field) { setFieldError(field, message); return; }
  }
  if (lower.includes("mobile") && (lower.includes("exists") || lower.includes("required"))) {
    const field = formEl.querySelector('[data-field="mobile"]');
    if (field) { setFieldError(field, message); return; }
  }
  toastError(message || "Something went wrong. Please try again.");
}

function validateAadharFormat(aadhar) {
  // 12 digits, no spaces
  return /^\d{12}$/.test(aadhar.replace(/\s/g, ""));
}

function validatePANFormat(pan) {
  // Standard Indian PAN: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase());
}

function daysUntilExpiry(isoString) {
  if (!isoString) return null;
  const normalized = isoString.trim().replace(' ', 'T').replace(/Z?$/, 'Z');
  return Math.ceil((new Date(normalized).getTime() - Date.now()) / 86400000);
}

function parseExpiryDate(isoString) {
  if (!isoString) return null;
  const normalized = isoString.trim().replace(' ', 'T').replace(/Z?$/, 'Z');
  return new Date(normalized);
}
/* ============================================================
   OLR INDIA - UI PRIMITIVES
   Custom toast + confirm dialog.
   No window.alert / window.confirm anywhere in this site.
   ============================================================ */

// ── Toasts ─────────────────────────────────────────────────────
function ensureToastContainer() {
  let el = document.getElementById("toast-container");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast-container";
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  return el;
}

const TOAST_ICONS = {
  success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.6"/></svg>`,
  error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.6"/></svg>`,
  info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 11v5M12 8h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.6"/></svg>`,
};

function showToast(message, type = "info", duration = 4500) {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
    <span class="toast-body"></span>
    <button class="toast-close" aria-label="Dismiss">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
  `;
  toast.querySelector(".toast-body").textContent = message;
  const remove = () => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 250);
  };
  toast.querySelector(".toast-close").addEventListener("click", remove);
  container.appendChild(toast);
  if (duration > 0) setTimeout(remove, duration);
}

const toastSuccess = (msg) => showToast(msg, "success");
const toastError   = (msg) => showToast(msg, "error");
const toastInfo    = (msg) => showToast(msg, "info");

// ── Modal root ───────────────────────────────────────────────────
function ensureModalRoot() {
  let el = document.getElementById("modal-root");
  if (!el) {
    el = document.createElement("div");
    el.id = "modal-root";
    document.body.appendChild(el);
  }
  return el;
}

// ── Confirm modal ────────────────────────────────────────────────
function showConfirm({ title = "Are you sure?", text = "", confirmLabel = "Confirm", cancelLabel = "Cancel" } = {}) {
  return new Promise((resolve) => {
    const root = ensureModalRoot();
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <h3 class="modal-title"></h3>
        <p class="modal-text"></p>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-action="cancel"><span class="btn-label"></span></button>
          <button class="btn btn-primary" data-action="confirm"><span class="btn-label"></span></button>
        </div>
      </div>
    `;
    overlay.querySelector(".modal-title").textContent = title;
    overlay.querySelector(".modal-text").textContent = text;
    overlay.querySelector('[data-action="cancel"] .btn-label').textContent = cancelLabel;
    overlay.querySelector('[data-action="confirm"] .btn-label').textContent = confirmLabel;

    root.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-open"));

    const close = (result) => {
      overlay.classList.remove("is-open");
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    overlay.querySelector('[data-action="cancel"]').addEventListener("click", () => close(false));
    overlay.querySelector('[data-action="confirm"]').addEventListener("click", () => close(true));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(false); });
    document.addEventListener("keydown", function escHandler(e) {
      if (e.key === "Escape") { close(false); document.removeEventListener("keydown", escHandler); }
    });
  });
}

// ── Confirm with password modal (for account deletion) ───────────
function showConfirmWithPassword({ title = "Delete account?", text = "", confirmLabel = "Delete account", cancelLabel = "Cancel" } = {}) {
  return new Promise((resolve) => {
    const root = ensureModalRoot();
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <h3 class="modal-title"></h3>
        <p class="modal-text"></p>
        <div class="modal-field" style="margin-top:16px;">
          <label class="label" style="display:block;margin-bottom:6px;font-size:13px;font-weight:600;color:#374151;">Enter your password to confirm</label>
          <div style="position:relative;">
            <input
              class="input modal-password-input"
              type="password"
              placeholder="Your password"
              autocomplete="current-password"
              style="width:100%;padding-right:44px;box-sizing:border-box;"
            >
            <button type="button" class="modal-pw-toggle" aria-label="Show password"
              style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#9ca3af;padding:0;display:flex;align-items:center;">
              <svg class="eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" stroke="currentColor" stroke-width="1.8"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>
              </svg>
            </button>
          </div>
          <p class="modal-pw-error" style="display:none;color:#ef4444;font-size:12px;margin-top:6px;"></p>
        </div>
        <div class="modal-actions" style="margin-top:20px;">
          <button class="btn btn-secondary" data-action="cancel"><span class="btn-label"></span></button>
          <button class="btn btn-danger" data-action="confirm"><span class="btn-label"></span></button>
        </div>
      </div>
    `;

    overlay.querySelector(".modal-title").textContent = title;
    overlay.querySelector(".modal-text").textContent = text;
    overlay.querySelector('[data-action="cancel"] .btn-label').textContent = cancelLabel;
    overlay.querySelector('[data-action="confirm"] .btn-label').textContent = confirmLabel;

    root.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-open"));

    const input     = overlay.querySelector(".modal-password-input");
    const toggle    = overlay.querySelector(".modal-pw-toggle");
    const errorEl   = overlay.querySelector(".modal-pw-error");
    const confirmBtn = overlay.querySelector('[data-action="confirm"]');

    // Show/hide password toggle
    toggle.addEventListener("click", () => {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      toggle.innerHTML = isPassword
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M1 1l22 22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
           </svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" stroke="currentColor" stroke-width="1.8"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>
           </svg>`;
    });

    // Clear error on type
    input.addEventListener("input", () => {
      errorEl.style.display = "none";
      errorEl.textContent = "";
    });

    const close = (result) => {
      overlay.classList.remove("is-open");
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    overlay.querySelector('[data-action="cancel"]').addEventListener("click", () => close(null));

    confirmBtn.addEventListener("click", () => {
      const val = input.value.trim();
      if (!val) {
        errorEl.textContent = "Please enter your password.";
        errorEl.style.display = "block";
        input.focus();
        return;
      }
      close(val);
    });

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });
    document.addEventListener("keydown", function escHandler(e) {
      if (e.key === "Escape") { close(null); document.removeEventListener("keydown", escHandler); }
    });

    setTimeout(() => input.focus(), 150);
  });
}

// ── Button loading state ─────────────────────────────────────────
function setButtonLoading(btn, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.classList.toggle("is-loading", isLoading);
}

// ── Field error helpers ──────────────────────────────────────────
function setFieldError(fieldEl, message) {
  if (!fieldEl) return;
  const errorEl = fieldEl.querySelector(".field-error");
  if (message) {
    fieldEl.classList.add("has-error");
    if (errorEl) errorEl.textContent = message;
  } else {
    fieldEl.classList.remove("has-error");
    if (errorEl) errorEl.textContent = "";
  }
}

function clearFieldErrors(formEl) {
  formEl.querySelectorAll(".field.has-error").forEach((f) => setFieldError(f, null));
}
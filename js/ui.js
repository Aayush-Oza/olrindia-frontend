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

/**
 * Shows a custom toast notification.
 * @param {string} message
 * @param {"success"|"error"|"info"} type
 * @param {number} duration ms before auto-dismiss
 */
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
  // Set text via textContent to avoid any HTML injection from API messages
  toast.querySelector(".toast-body").textContent = message;

  const remove = () => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 250);
  };

  toast.querySelector(".toast-close").addEventListener("click", remove);
  container.appendChild(toast);

  if (duration > 0) setTimeout(remove, duration);
}

// Convenience wrappers
const toastSuccess = (msg) => showToast(msg, "success");
const toastError = (msg) => showToast(msg, "error");
const toastInfo = (msg) => showToast(msg, "info");

// ── Confirm modal (replaces window.confirm) ──────────────────────
function ensureModalRoot() {
  let el = document.getElementById("modal-root");
  if (!el) {
    el = document.createElement("div");
    el.id = "modal-root";
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Shows a custom confirm dialog.
 * @param {object} opts { title, text, confirmLabel, cancelLabel }
 * @returns {Promise<boolean>} resolves true if confirmed
 */
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

// ── Button loading state helper ──────────────────────────────────
function setButtonLoading(btn, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.classList.toggle("is-loading", isLoading);
}

// ── Field error helper (shows inline error under an input) ───────
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

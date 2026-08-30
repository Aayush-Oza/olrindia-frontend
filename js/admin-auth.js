/* ============================================================
   OLR INDIA - ADMIN AUTH LOGIC
   Shared across all /admin/*.html pages.
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initAdminLoginForm();
});

// ── LOGIN ──────────────────────────────────────────────────────
function initAdminLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"]');

  form.querySelectorAll(".pw-toggle").forEach((btn) => {
    wirePasswordToggle(btn, btn.closest(".input-wrap").querySelector("input"));
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
    const res = await apiRequest("/auth/admin/login", "POST", { email, password });
    setButtonLoading(submitBtn, false);

    if (res.success) {
      saveSessionAccount("admin", res.admin);
      toastSuccess("Welcome back! Redirecting…");
      setTimeout(() => { window.location.href = "dashboard.html"; }, 700);
    } else {
      toastError(res.message || "Invalid email or password.");
    }
  });
}
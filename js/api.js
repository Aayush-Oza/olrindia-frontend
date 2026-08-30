/* ============================================================
  OLR INDIA - API LAYER
  Every network call in the site goes through apiRequest().
  Backend sends { success, message } on every response (incl.
  errors from its own try/catch blocks) - we surface that
  "message" consistently everywhere instead of generic errors.
  ============================================================ */

const API_BASE = "https://olrindia.com/api";
/**
* Makes a request to the backend.
* Always sends credentials so the HttpOnly JWT cookies are included.
*
* @param {string} path   e.g. "/auth/user/login"
* @param {string} method GET | POST
* @param {object|null} body
* @returns {Promise<object>} parsed JSON response, always has `.success`
*/
async function apiRequest(path, method = "GET", body = null) {
  try {
    const res = await fetch(API_BASE + path, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      // Backend returned something that wasn't JSON (e.g. server crashed before jsonify)
      return {
        success: false,
        message: "Server sent an unexpected response. Please try again.",
        httpStatus: res.status,
      };
    }

    data.httpStatus = res.status;
    // ── Session expired / unauthorized ───────────────────────────
    if (res.status === 401) {
      const authPages = [
        'login.html', 'signup.html', 'forgot-password.html',
        'reset-password.html', 'verify-email.html', 'index.html', 'p.html'
      ];
      const currentPage = window.location.pathname.split('/').pop();
      const isAuthPage = authPages.some(p => currentPage === p || currentPage === '');

      if (!isAuthPage && !path.includes('/refresh') && !path.includes('/login')) {
        // Try silently refreshing the access token first
        const isAdmin = window.location.pathname.includes('/admin/');
        const isVendor = window.location.pathname.includes('/vendor/');
        const role = isAdmin ? 'admin' : (isVendor ? 'vendor' : 'user');

        const refreshRes = await fetch(API_BASE + `/auth/${role}/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (refreshRes.ok) {
          // Refresh worked - retry the original request once
          return apiRequest(path, method, body);
        }

        // Refresh also failed - genuinely expired, now actually log out
        sessionStorage.removeItem('olr_user');
        sessionStorage.removeItem('olr_vendor');
        sessionStorage.removeItem('olr_admin_account');

        const loginUrl = isAdmin ? '../admin/login.html' : (isVendor ? '../vendor/login.html' : '../user/login.html');
        const msg = 'Your session has expired. Please log in again.';
        if (typeof toastError === 'function') toastError(msg); else alert(msg);
        setTimeout(() => { window.location.href = loginUrl; }, 1800);
      }
    }
    return data;

  } catch (networkErr) {
    // Server unreachable - backend not running, CORS block, no internet, etc.
    return {
      success: false,
      message: "Can't reach the server. Check your connection and try again.",
      httpStatus: 0,
      isNetworkError: true,
    };
  }
}

/**
 * SOLITX Auth Redirection Helper
 * Preserves the exact user destination across login/register & OAuth flows,
 * ensuring seamless return to the exact same spot after authentication.
 */

/**
 * Returns a sanitized redirect path (defaults to '/' if invalid or already on /auth)
 */
export const getSafeRedirectPath = (customPath) => {
  if (customPath && typeof customPath === 'string' && customPath.startsWith('/') && !customPath.startsWith('/auth')) {
    return customPath;
  }
  if (typeof window !== 'undefined') {
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (current && current !== '/auth' && !current.startsWith('/auth?') && current !== '') {
      return current;
    }
  }
  return '/';
};

/**
 * Saves the intended return destination in sessionStorage and redirects to /auth
 */
export const redirectToAuth = (navigate, customRedirect) => {
  const safePath = getSafeRedirectPath(customRedirect);
  try {
    sessionStorage.setItem('auth_redirect', safePath);
  } catch {}

  const targetUrl = `/auth?redirect=${encodeURIComponent(safePath)}`;
  if (navigate && typeof navigate === 'function') {
    navigate(targetUrl, { state: { from: safePath } });
  } else if (typeof window !== 'undefined') {
    window.location.assign(targetUrl);
  }
};

/**
 * Checks if the current client has a valid session
 */
export const isUserAuthenticated = () => {
  try {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return Boolean(token && (user?.username || user?.id));
  } catch {
    return false;
  }
};

/**
 * Checks authentication: if logged in, executes callback; if not, redirects to /auth
 */
export const requireAuthOrRedirect = (navigate, callback, customRedirect) => {
  if (isUserAuthenticated()) {
    if (callback && typeof callback === 'function') {
      callback();
    }
    return true;
  }
  redirectToAuth(navigate, customRedirect);
  return false;
};


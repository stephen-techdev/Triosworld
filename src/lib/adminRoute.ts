/**
 * The operator dashboard entrance.
 *
 * The sign-in page is reachable at /admin/login from the storefront footer's
 * "Admin access" link, and at this private path for a bookmark. The dashboard
 * itself stays on this unlisted route; the password and the server-issued
 * token remain the real protection.
 *
 * Bookmark: https://www.triosworld.in/trios-ops-9x4k/login
 */
export const ADMIN_BASE = '/trios-ops-9x4k';
export const ADMIN_LOGIN_PATH = `${ADMIN_BASE}/login`;

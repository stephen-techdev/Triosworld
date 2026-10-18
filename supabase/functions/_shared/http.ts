/**
 * Edge-function request routing.
 *
 * The Supabase gateway does NOT hand the function the path it was called with.
 * Observed on project clvwowrplnkwkiotriiu:
 *
 *   called  https://<ref>.supabase.co/functions/v1/trios-admin/login
 *   arrives url.pathname === "/trios-admin/login"
 *
 * i.e. the `/functions/v1` segment is gone and the function's own slug is
 * still attached. Stripping only `/functions/v1/<slug>` therefore matches
 * nothing, `path` keeps the slug prefix, and every route comparison fails — the
 * request falls through to the authenticated handler and answers "session has
 * expired" even for /login.
 *
 * Strip both shapes, plus any trailing slash, then lowercase.
 */
export function routePath(pathname: string, slug: string): string {
  let p = pathname.replace(/^\/functions\/v1/, "");
  p = p.replace(new RegExp(`^/${slug}(?=/|$)`), "");
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p.toLowerCase() || "/";
}
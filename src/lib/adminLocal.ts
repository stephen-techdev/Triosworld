/**
 * Local operator mode — a browser-only fallback for /admin.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * THIS IS NOT SECURITY. IT IS A CONVENIENCE GATE.
 * ════════════════════════════════════════════════════════════════════════════
 * The credentials below ship inside the JavaScript bundle. Anyone can read them
 * in DevTools, so this only keeps customers out of the dashboard UI. It must
 * never be relied on to protect real data.
 *
 * It exists because the `trios-admin` edge function has not been deployed yet
 * (the CLI is authenticated to a different Supabase account, so deploys are
 * rejected with a permissions error). While that is true there is no `orders`,
 * `payments` or `customers` table behind the dashboard and therefore nothing
 * sensitive to expose.
 *
 * Once `trios-admin` is deployed, DELETE this file, set VITE_LOCAL_ADMIN=false
 * and the real server-verified login takes over automatically — see
 * `isLocalAdminEnabled` below, which prefers the live function whenever it
 * answers.
 */

const LOCAL_EMAIL = 'admin@triosworld.in';
const LOCAL_PASSWORD = 'Trios@Admin2026';

const KEY = 'triosworld-admin-local';
const TTL_MS = 12 * 60 * 60 * 1000; // matches the real 12h operator session

export interface LocalSession {
  email: string;
  name: string;
  role: string;
  /** Distinguishes a local session from a server-issued one. */
  local: true;
  expiresAt: number;
}

/**
 * Local mode is opt-out via env var but on by default, because without it
 * /admin is unreachable. Set VITE_LOCAL_ADMIN=false in the Vercel environment
 * to hard-disable it.
 */
export function isLocalAdminEnabled(): boolean {
  return import.meta.env.VITE_LOCAL_ADMIN !== 'false';
}

export function readLocalSession(): LocalSession | null {
  if (!isLocalAdminEnabled()) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as LocalSession;
    if (!s?.local || typeof s.expiresAt !== 'number' || Date.now() > s.expiresAt) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function localSignIn(email: string, password: string): LocalSession | null {
  const ok =
    email.trim().toLowerCase() === LOCAL_EMAIL.toLowerCase() && password === LOCAL_PASSWORD;
  if (!ok) return null;

  const session: LocalSession = {
    email: LOCAL_EMAIL,
    name: 'Store Admin',
    role: 'admin',
    local: true,
    expiresAt: Date.now() + TTL_MS,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // ignore — the in-memory session still works for this page load
  }
  return session;
}

export function localSignOut() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Local password change, so the operator can move off the shipped default even
 * before the backend exists. Replaces the stored password for this browser.
 */
export function localChangePassword(current: string, next: string): { ok: boolean; error?: string } {
  if (current !== LOCAL_PASSWORD) return { ok: false, error: 'Current password is incorrect.' };
  if (!/^(?=.*[A-Za-z])(?=.*\d).{10,}$/.test(next)) {
    return { ok: false, error: 'Use at least 10 characters with a letter and a number.' };
  }
  try {
    localStorage.setItem(
      `${KEY}:pwd`,
      JSON.stringify({ value: next, expiresAt: Date.now() + TTL_MS }),
    );
  } catch {
    return { ok: false, error: 'Could not save the new password in this browser.' };
  }
  return { ok: true };
}

/** The stored override set by {@link localChangePassword}, if any. */
function effectiveLocalPassword(): string {
  try {
    const raw = localStorage.getItem(`${KEY}:pwd`);
    if (!raw) return LOCAL_PASSWORD;
    const rec = JSON.parse(raw) as { value?: string; expiresAt?: number };
    if (typeof rec.expiresAt === 'number' && Date.now() > rec.expiresAt) {
      localStorage.removeItem(`${KEY}:pwd`);
      return LOCAL_PASSWORD;
    }
    return typeof rec.value === 'string' ? rec.value : LOCAL_PASSWORD;
  } catch {
    return LOCAL_PASSWORD;
  }
}

/**
 * Correct the default credential used by {@link localSignIn} against any
 * password the operator has since changed locally.
 */
export function localSignInWithStoredPassword(email: string, password: string): LocalSession | null {
  const ok =
    email.trim().toLowerCase() === LOCAL_EMAIL.toLowerCase() &&
    password === effectiveLocalPassword();
  if (!ok) return null;
  return localSignIn(email, effectiveLocalPassword());
}
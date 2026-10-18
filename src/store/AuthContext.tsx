import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createClient, type Session, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * "Remember me" is implemented with a storage adapter: when the customer leaves
 * the box unchecked we keep the Supabase session in memory only (it survives
 * navigation but not a page reload). When checked (the default) the session is
 * persisted to localStorage as usual.
 */
const REMEMBER_KEY = 'triosworld-remember';
const memoryStore = new Map<string, string>();

function prefersPersistedSession(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== '0';
  } catch {
    return true;
  }
}

function purgePersistedAuthKeys() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-'))
      .forEach(k => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

const authStorage = {
  getItem: (key: string): string | null => {
    if (prefersPersistedSession()) return localStorage.getItem(key);
    return memoryStore.get(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    if (prefersPersistedSession()) {
      localStorage.setItem(key, value);
      memoryStore.delete(key);
    } else {
      memoryStore.set(key, value);
    }
  },
  removeItem: (key: string): void => {
    memoryStore.delete(key);
    localStorage.removeItem(key);
  },
};

function setRememberMe(remember: boolean) {
  try {
    if (remember) {
      localStorage.removeItem(REMEMBER_KEY);
    } else {
      localStorage.setItem(REMEMBER_KEY, '0');
      // Drop any session persisted by an earlier "remember me" login.
      purgePersistedAuthKeys();
    }
  } catch {
    /* ignore */
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const AUTH_FN_URL = `${supabaseUrl}/functions/v1/trios-auth`;

/** Extracts the server's error message. A 5xx genuinely means the
 *  authentication service is unreachable/broken (e.g. the function failing to
 *  boot), so we say so instead of showing a misleading credential error. */
function errorFrom(status: number, data: unknown, fallback: string): string {
  const message = (data as { error?: unknown } | null)?.error;
  if (typeof message === 'string') return message;
  if (status >= 500) {
    return 'The authentication service is unavailable right now. Please try again shortly.';
  }
  return fallback;
}

/** Supabase OAuth sign-in blindly redirects the browser to the auth server; if
 *  the provider is switched off the customer just sees a raw JSON error page.
 *  Check the project's public auth settings first so we can fail in-app. */
async function isProviderEnabled(provider: 'google'): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
    });
    if (!res.ok) return true; // never block sign-in because of a settings hiccup
    const data = (await res.json()) as { external?: Record<string, boolean> };
    return data?.external?.[provider] === true;
  } catch {
    return true;
  }
}

export interface TriosUser {
  id: string;
  mobile: string | null;
  full_name: string;
  gender?: string | null;
  avatar_url?: string | null;
}

interface AuthContextValue {
  user: TriosUser | null;
  session: Session | null;
  loading: boolean;
  /** Error returned by the OAuth provider callback (Google etc.), if any. */
  oauthError: string | null;
  clearOauthError: () => void;
  signInWithMobile: (mobile: string, password: string, remember?: boolean) => Promise<{ error: string | null }>;
  signUp: (data: { full_name: string; mobile: string; password: string; gender?: string }, remember?: boolean) => Promise<{ error: string | null }>;
  signInWithGoogle: (remember?: boolean) => Promise<{ error: string | null }>;
  completeProfile: (data: { mobile: string; full_name: string; gender?: string }) => Promise<{ error: string | null }>;
  requestPasswordReset: (mobile: string) => Promise<{ error: string | null; demoToken?: string }>;
  confirmPasswordReset: (mobile: string, token: string, newPassword: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Fallback profile built from the Auth session, used for OAuth users whose
 *  profile row is still being created (and for transient profile fetch errors). */
function fallbackUser(u: User): TriosUser {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const metaMobile = typeof meta.mobile === 'string' ? meta.mobile : null;
  return {
    id: u.id,
    mobile: metaMobile ?? (u.phone ? u.phone.replace(/^\+91/, '') : null),
    full_name:
      (typeof meta.full_name === 'string' && meta.full_name) ||
      (typeof meta.name === 'string' && meta.name) ||
      'TriosWorld Customer',
    gender: typeof meta.gender === 'string' ? meta.gender : null,
    avatar_url: typeof meta.avatar_url === 'string' ? meta.avatar_url : null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TriosUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const fetchProfile = async (uid: string): Promise<TriosUser | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, mobile, full_name, gender, avatar_url')
      .eq('id', uid)
      .maybeSingle();
    if (error || !data) return null;
    return data as TriosUser;
  };

  useEffect(() => {
    let mounted = true;

    // Google (or any OAuth) can bounce back with an error instead of a session,
    // e.g. the customer denied consent or the redirect URL isn't allow-listed.
    // Surface that on the login page rather than failing silently.
    try {
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const description = search.get('error_description') ?? hash.get('error_description');
      const code = search.get('error') ?? hash.get('error');
      if (description || code) {
        setOauthError((description ?? code ?? 'Sign-in was cancelled').replace(/\+/g, ' '));
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch {
      /* ignore */
    }

    const init = async () => {
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (existingSession) {
        setSession(existingSession);
        const profile = await fetchProfile(existingSession.user.id);
        if (mounted) {
          setUser(profile ?? fallbackUser(existingSession.user));
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession) {
        (async () => {
          const profile = await fetchProfile(newSession.user.id);
          if (mounted) setUser(profile ?? fallbackUser(newSession.user));
        })();
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithMobile = async (
    mobile: string,
    password: string,
    remember = true,
  ): Promise<{ error: string | null }> => {
    try {
      setRememberMe(remember);
      const res = await fetch(`${AUTH_FN_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return { error: errorFrom(res.status, data, 'Login failed') };
      if (!data?.session) return { error: 'Could not create session' };

      const { error: setErr } = await supabase.auth.setSession(data.session);
      if (setErr) return { error: 'Could not establish session' };

      setUser(data.user ?? null);
      setSession(data.session);
      return { error: null };
    } catch {
      return { error: 'Network error. Please try again.' };
    }
  };

  const signUp = async (
    data: { full_name: string; mobile: string; password: string; gender?: string },
    remember = true,
  ): Promise<{ error: string | null }> => {
    try {
      setRememberMe(remember);
      const res = await fetch(`${AUTH_FN_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return { error: errorFrom(res.status, json, 'Registration failed') };
      if (json?.session) {
        const { error: setErr } = await supabase.auth.setSession(json.session);
        if (setErr) return { error: 'Account created but could not sign in automatically' };
        setUser(json.user ?? null);
        setSession(json.session);
      }
      return { error: null };
    } catch {
      return { error: 'Network error. Please try again.' };
    }
  };

  const signInWithGoogle = async (remember = true): Promise<{ error: string | null }> => {
    try {
      if (!(await isProviderEnabled('google'))) {
        return {
          error:
            "Google sign-in isn't enabled for this store yet. Please check back soon or contact us on WhatsApp.",
        };
      }
      setRememberMe(remember);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/account`,
        },
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch {
      return { error: 'Could not start Google sign-in' };
    }
  };

  const completeProfile = async (data: { mobile: string; full_name: string; gender?: string }): Promise<{ error: string | null }> => {
    try {
      if (!session) return { error: 'Not authenticated' };
      const res = await fetch(`${AUTH_FN_URL}/complete-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return { error: errorFrom(res.status, json, 'Could not update profile') };
      await refreshProfile();
      return { error: null };
    } catch {
      return { error: 'Network error' };
    }
  };

  const requestPasswordReset = async (mobile: string): Promise<{ error: string | null; demoToken?: string }> => {
    try {
      const res = await fetch(`${AUTH_FN_URL}/reset-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return { error: errorFrom(res.status, data, 'Could not send reset code') };
      return { error: null, demoToken: data?.demo_token };
    } catch {
      return { error: 'Network error' };
    }
  };

  const confirmPasswordReset = async (mobile: string, token: string, newPassword: string): Promise<{ error: string | null }> => {
    try {
      const res = await fetch(`${AUTH_FN_URL}/reset-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, token, new_password: newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return { error: errorFrom(res.status, data, 'Could not reset password') };
      return { error: null };
    } catch {
      return { error: 'Network error' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const refreshProfile = async () => {
    if (!session) return;
    const profile = await fetchProfile(session.user.id);
    setUser(profile ?? fallbackUser(session.user));
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading,
      oauthError,
      clearOauthError: () => setOauthError(null),
      signInWithMobile, signUp, signInWithGoogle, completeProfile,
      requestPasswordReset, confirmPasswordReset, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

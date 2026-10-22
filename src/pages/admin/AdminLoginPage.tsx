import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Lock, ShieldAlert } from 'lucide-react';
import SEO from '@/components/SEO';
import { EASE } from '@/components/Motion';
import { AdminAuthError, AdminServiceUnavailableError, adminLogin, readSession } from '@/lib/admin';

/**
 * Standalone operator sign-in at `/admin/login`.
 *
 * Separate from the customer login on purpose: no storefront header, footer or
 * floating buttons, and it is `noindex` so operator credentials can never be
 * surfaced in search results. Entering an operator email on the customer
 * `/login` page still works, but this is the canonical entry point.
 *
 * The credentials are verified by the `trios-admin` edge function against the
 * bcrypt hash in the `admins` table — this form holds no password of its own and
 * grants nothing on its own; the server issues the session token.
 */
export default function AdminLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already signed in? Skip the form.
  useEffect(() => {
    if (readSession()) navigate('/admin', { replace: true });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await adminLogin(email.trim(), password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(
        err instanceof AdminAuthError
          ? 'Invalid email or password'
          : err instanceof AdminServiceUnavailableError
            ? 'The admin service is not reachable right now.'
            : err instanceof Error
              ? err.message
              : 'Could not sign in',
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink px-4 py-12">
      <SEO title="Admin sign in" noindex />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <p className="flex justify-center">
            <img src="/logo-ivory.png" alt="TriosWorld" className="h-12 w-auto" />
          </p>
          <p className="text-[11px] uppercase tracking-[0.2em] text-ivory/60 mt-2">Operator access</p>
        </div>

        <form onSubmit={submit} className="bg-ivory rounded-2xl p-6 md:p-7 shadow-2xl space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Lock size={16} /> Sign in to dashboard
          </div>

          {error && (
            <div
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex gap-2"
              role="alert"
            >
              <ShieldAlert size={15} className="shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}

          <label className="block" htmlFor="admin-email">
            <span className="text-xs font-medium text-ink/60">Email</span>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); }}
              placeholder="admin@triosworld.com"
              autoComplete="username"
              required
              autoFocus
              className="mt-1.5 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:border-ink"
            />
          </label>

          {/* The toggle must not sit inside the <label>: a nested interactive
              control breaks the label/control association, so assistive tech
              could not reach the password field or this button. */}
          <div>
            <label className="block" htmlFor="admin-password">
              <span className="text-xs font-medium text-ink/60">Password</span>
            </label>
            <div className="mt-1.5 relative">
              <input
                id="admin-password"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(null); }}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                aria-label="Password"
                className="w-full rounded-lg border border-ink/15 px-3 py-2.5 pr-16 text-sm focus:outline-none focus:border-ink"
              />
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
                aria-pressed={showPwd}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-ink/65 hover:text-ink"
              >
                {showPwd ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-full bg-ink text-ivory text-sm font-semibold hover:bg-ink/80 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={17} className="animate-spin" /> : 'Sign in'}
          </button>

          <p className="text-[11px] text-ink/65 text-center">
            Not an operator?{' '}
            <Link to="/login" className="underline hover:text-ink/70">Customer sign in</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
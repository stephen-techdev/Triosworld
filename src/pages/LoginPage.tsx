import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import SEO from '@/components/SEO';
import { useAuth } from '@/store/AuthContext';
import { mobileError, normaliseMobile } from '@/lib/mobile';

const HERO_IMG = 'https://images.pexels.com/photos/19259008/pexels-photo-19259008.jpeg?auto=compress&cs=tinysrgb&w=900';

/**
 * Customer sign-in.
 *
 * This page is for customers only. Operators sign in on their own page at
 * /admin/login (linked discreetly from the footer), where the credentials are
 * verified server-side by the trios-admin function. The field here accepts a
 * 10-digit mobile number and nothing else.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { signInWithMobile, oauthError, clearOauthError } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    clearOauthError();

    const problem = mobileError(identifier);
    if (problem) {
      setError(problem);
      return;
    }

    const mobile = normaliseMobile(identifier);
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    const { error: err } = // Send the bare ten digits. The "+91" prefix is added by the server, which
// needs the national number to look up the profile.
await signInWithMobile(mobile, password, remember);
    setLoading(false);
    if (err) setError(err);
    else navigate('/account');
  };

  return (
    <div className="min-h-screen flex">
      <SEO title="Sign In" noindex />
      {/* Left: form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="font-display font-bold text-xl tracking-tightest inline-block mb-12">
            TRIO<span className="text-lime">S</span>WORLD
          </Link>

          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            WELCOME BACK.
          </h1>
          <p className="text-ink/50 text-sm mb-8">
            Sign in to your TriosWorld account
          </p>

          {(error ?? oauthError) && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700" role="alert">
              {error ?? oauthError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="identifier" className="text-xs font-medium text-ink/60">
                Mobile Number
              </label>
              <div className="mt-1.5 flex items-center rounded-lg border border-ink/15 focus-within:border-ink overflow-hidden">
                <span className="px-3 py-3 text-sm text-ink/50 border-r border-ink/10 bg-stone/20 select-none">+91</span>
                <input
                  id="identifier"
                  type="tel"
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); setError(null); }}
                  placeholder="9876543210"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={20}
                  className="flex-1 px-3 py-3 text-sm bg-transparent outline-none"
                  aria-required="true"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="text-xs font-medium text-ink/60">Password</label>
              <div className="mt-1.5 relative">
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  placeholder="Your password"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-ink/15 px-3 py-3 pr-11 text-sm outline-none focus:border-ink"
                  aria-required="true"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink/40 hover:text-ink"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-ink/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="w-4 h-4 accent-ink rounded"
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-sm text-ink/60 hover:text-ink underline">
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-ink text-ivory font-semibold text-sm hover:bg-ink/80 transition disabled:opacity-50 flex items-center justify-center gap-2 min-h-11"
            >
              {loading
                ? <Loader2 size={18} className="animate-spin" />
                : <>SIGN IN <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-ink/50">
            New to TriosWorld?{' '}
            <Link to="/register" className="text-ink font-medium hover:text-ink/70 underline">
              Create Account
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right: image (desktop only) */}
      <div className="hidden lg:block w-[45%] xl:w-[50%] relative overflow-hidden bg-ink">
        <img
          src={HERO_IMG}
          alt="TriosWorld men's fashion campaign"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-90"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/10 to-ink/20" />
        <div className="absolute bottom-0 left-0 right-0 p-12">
          <p className="text-ivory/60 text-xs tracking-widest uppercase mb-3">Three Vibes. One World.</p>
          <h2 className="font-display text-4xl xl:text-5xl font-bold text-ivory leading-[0.95]">
            YOUR WORLD.<br />YOUR STYLE.
          </h2>
        </div>
      </div>
    </div>
  );
}
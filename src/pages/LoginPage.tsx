import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import SEO from '@/components/SEO';
import { useAuth } from '@/store/AuthContext';

const HERO_IMG = 'https://images.pexels.com/photos/19259008/pexels-photo-19259008.jpeg?auto=compress&cs=tinysrgb&w=900';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signInWithMobile, signInWithGoogle, oauthError, clearOauthError } = useAuth();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    clearOauthError();
    if (!/^[6-9]\d{9}$/.test(mobile.replace(/\D/g, '').slice(-10))) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    setLoading(true);
    const { error: err } = await signInWithMobile(`+91${mobile}`, password, remember);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      navigate('/account');
    }
  };

  const handleGoogle = async () => {
    setError(null);
    clearOauthError();
    setGoogleLoading(true);
    const { error: err } = await signInWithGoogle(remember);
    if (err) {
      setGoogleLoading(false);
      setError(err);
    }
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

          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">WELCOME BACK.</h1>
          <p className="text-ink/50 text-sm mb-8">Sign in to your TriosWorld account</p>

          {(error ?? oauthError) && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700" role="alert">
              {error ?? oauthError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="mobile" className="text-xs font-medium text-ink/60">Mobile Number</label>
              <div className="mt-1.5 flex items-center rounded-lg border border-ink/15 focus-within:border-ink overflow-hidden">
                <span className="px-3 py-3 text-sm text-ink/50 border-r border-ink/10 bg-stone/20 select-none">+91</span>
                <input
                  id="mobile"
                  type="tel"
                  value={mobile}
                  onChange={e => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(null); }}
                  placeholder="9876543210"
                  inputMode="numeric"
                  autoComplete="tel"
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
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>SIGN IN <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-ink/10" />
            <span className="text-xs text-ink/40 uppercase tracking-widest">OR</span>
            <div className="flex-1 h-px bg-ink/10" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full py-3.5 rounded-full border border-ink/15 font-medium text-sm hover:bg-stone/30 transition flex items-center justify-center gap-3 min-h-11 disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continue with Google
          </button>

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

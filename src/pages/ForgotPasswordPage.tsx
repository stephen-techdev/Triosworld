import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Check, KeyRound } from 'lucide-react';
import SEO from '@/components/SEO';
import { useAuth } from '@/store/AuthContext';

const HERO_IMG = 'https://images.pexels.com/photos/23570089/pexels-photo-23570089.jpeg?auto=compress&cs=tinysrgb&w=900';

type Step = 'request' | 'confirm' | 'done';

export default function ForgotPasswordPage() {
  const { requestPasswordReset, confirmPasswordReset } = useAuth();
  const [step, setStep] = useState<Step>('request');
  const [mobile, setMobile] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoToken, setDemoToken] = useState<string | null>(null);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[6-9]\d{9}$/.test(mobile.replace(/\D/g, '').slice(-10))) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    const { error: err, demoToken: dt } = await requestPasswordReset(mobile.replace(/\D/g, '').slice(-10));
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setDemoToken(dt ?? null);
      setStep('confirm');
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token.trim()) { setError('Enter the reset code'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!/[A-Za-z]/.test(newPassword)) { setError('Password must contain at least one letter'); return; }
    if (!/\d/.test(newPassword)) { setError('Password must contain at least one number'); return; }
    setLoading(true);
    const { error: err } = await confirmPasswordReset(
      mobile.replace(/\D/g, '').slice(-10),
      token.trim(),
      newPassword,
    );
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setStep('done');
    }
  };

  return (
    <div className="min-h-screen flex">
      <SEO title="Forgot Password" noindex />
      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="font-display font-bold text-xl tracking-tightest inline-block mb-8">
            TRIO<span className="text-lime">S</span>WORLD
          </Link>

          {step === 'done' ? (
            <>
              <div className="w-14 h-14 rounded-full bg-lime mx-auto flex items-center justify-center mb-6">
                <Check size={28} className="text-ink" />
              </div>
              <h1 className="font-display text-2xl font-bold mb-3 text-center">Password Reset</h1>
              <p className="text-ink/60 text-sm text-center mb-8">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <Link to="/login" className="block w-full text-center py-3.5 rounded-full bg-ink text-ivory font-semibold text-sm hover:bg-ink/80 transition">
                Back to Sign In
              </Link>
            </>
          ) : step === 'request' ? (
            <>
              <div className="w-12 h-12 rounded-full bg-stone/40 flex items-center justify-center mb-6">
                <KeyRound size={22} className="text-ink/60" />
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-bold mb-2">Forgot Password?</h1>
              <p className="text-ink/65 text-sm mb-8">Enter your mobile number and we'll send you a reset code.</p>

              {error && (
                <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleRequest} className="space-y-5">
                <div>
                  <label htmlFor="resetMobile" className="text-xs font-medium text-ink/60">Mobile Number</label>
                  <div className="mt-1.5 flex items-center rounded-lg border border-ink/15 focus-within:border-ink overflow-hidden">
                    <span className="px-3 py-3 text-sm text-ink/65 border-r border-ink/10 bg-stone/20 select-none">+91</span>
                    <input
                      id="resetMobile"
                      type="tel"
                      value={mobile}
                      onChange={e => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(null); }}
                      placeholder="9876543210"
                      inputMode="numeric"
                      autoComplete="tel"
                      className="flex-1 px-3 py-3 text-sm bg-transparent outline-none"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-full bg-ink text-ivory font-semibold text-sm hover:bg-ink/80 transition disabled:opacity-50 flex items-center justify-center gap-2 min-h-11">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <>Send Reset Code <ArrowRight size={16} /></>}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-ink/65">
                <Link to="/login" className="text-ink font-medium hover:text-ink/70 underline">Back to Sign In</Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl md:text-3xl font-bold mb-2">Enter Reset Code</h1>
              {demoToken ? (
                <div className="mb-8 text-sm text-ink/65">
                  <p>
                    SMS delivery isn't configured for this project yet, so we can't text you a code.
                    Use this demo code to finish resetting your password:
                  </p>
                  <p className="mt-2 text-ink text-lg font-semibold tracking-[0.3em]">{demoToken}</p>
                </div>
              ) : (
                <p className="text-ink/65 text-sm mb-8">We sent a 6-digit code to +91 {mobile.replace(/\D/g, '').slice(-10)}.</p>
              )}

              {error && (
                <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleConfirm} className="space-y-5">
                <div>
                  <label htmlFor="resetCode" className="text-xs font-medium text-ink/60">Reset Code</label>
                  <input
                    id="resetCode"
                    type="text"
                    value={token}
                    onChange={e => { setToken(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                    placeholder="123456"
                    inputMode="numeric"
                    className="mt-1.5 w-full rounded-lg border border-ink/15 px-3 py-3 text-sm outline-none focus:border-ink text-center text-lg tracking-widest"
                  />
                </div>

                <div>
                  <label htmlFor="newPwd" className="text-xs font-medium text-ink/60">New Password</label>
                  <input
                    id="newPwd"
                    type="password"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setError(null); }}
                    placeholder="Min 8 chars, 1 letter, 1 number"
                    autoComplete="new-password"
                    className="mt-1.5 w-full rounded-lg border border-ink/15 px-3 py-3 text-sm outline-none focus:border-ink"
                  />
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-full bg-ink text-ivory font-semibold text-sm hover:bg-ink/80 transition disabled:opacity-50 flex items-center justify-center gap-2 min-h-11">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <>Reset Password <ArrowRight size={16} /></>}
                </button>
              </form>

              <button onClick={() => setStep('request')} className="mt-6 block w-full text-center text-sm text-ink/65 hover:text-ink">
                Use a different mobile number
              </button>
            </>
          )}
        </motion.div>
      </div>

      <div className="hidden lg:block w-[45%] xl:w-[50%] relative overflow-hidden bg-ink">
        <img src={HERO_IMG} alt="TriosWorld men's fashion" className="absolute inset-0 w-full h-full object-cover object-center opacity-90" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/10 to-ink/20" />
        <div className="absolute bottom-0 left-0 right-0 p-12">
          <p className="text-ivory/60 text-xs tracking-widest uppercase mb-3">Three Vibes. One World.</p>
          <h2 className="font-display text-4xl xl:text-5xl font-bold text-ivory leading-[0.95]">YOUR WORLD.<br />YOUR STYLE.</h2>
        </div>
      </div>
    </div>
  );
}

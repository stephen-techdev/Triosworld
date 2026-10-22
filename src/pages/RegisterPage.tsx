import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Loader2, Check, X } from 'lucide-react';
import SEO from '@/components/SEO';
import { useAuth } from '@/store/AuthContext';
import { mobileError, normaliseMobile } from '@/lib/mobile';

const HERO_IMG = 'https://images.pexels.com/photos/1959036/pexels-photo-1959036.jpeg?auto=compress&cs=tinysrgb&w=900';

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  const colors = ['bg-red-500', 'bg-red-400', 'bg-yellow-500', 'bg-lime', 'bg-green-500', 'bg-green-600'];
  return { score, label: labels[score], color: colors[score] };
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [gender, setGender] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const validate = (): string | null => {
    if (!fullName.trim()) return 'Full name is required';
    if (mobileError(mobile)) return mobileError(mobile)!;
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter';
    if (!/\d/.test(password)) return 'Password must contain at least one number';
    if (password !== confirmPwd) return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) { setError(v); return; }
    setLoading(true);
    const { error: err } = await signUp({
      full_name: fullName.trim(),
      mobile: normaliseMobile(mobile),
      password,
      gender: gender || undefined,
    });
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      navigate('/account');
    }
  };

  return (
    <div className="min-h-screen flex">
      <SEO title="Create Account" noindex />
      {/* Left: image (desktop) */}
      <div className="hidden lg:block w-[45%] xl:w-[50%] relative overflow-hidden bg-ink">
        <img
          src={HERO_IMG}
          alt="TriosWorld men's streetwear"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-90"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/10 to-ink/20" />
        <div className="absolute bottom-0 left-0 right-0 p-12">
          <p className="text-ivory/60 text-xs tracking-widest uppercase mb-3">Join the world</p>
          <h2 className="font-display text-4xl xl:text-5xl font-bold text-ivory leading-[0.95]">
            THREE VIBES.<br />ONE WORLD.
          </h2>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-8 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="font-display font-bold text-xl tracking-tightest inline-block mb-8">
            TRIO<span className="text-lime">S</span>WORLD
          </Link>

          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">JOIN TRIOSWORLD.</h1>
          <p className="text-ink/65 text-sm mb-8">Create your account in seconds</p>

          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="fullName" className="text-xs font-medium text-ink/60">Full Name <span className="text-burgundy">*</span></label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={e => { setFullName(e.target.value); setError(null); }}
                placeholder="Arjun Sharma"
                autoComplete="name"
                aria-required="true"
                className="mt-1.5 w-full rounded-lg border border-ink/15 px-3 py-3 text-sm outline-none focus:border-ink"
              />
            </div>

            <div>
              <label htmlFor="regMobile" className="text-xs font-medium text-ink/60">Mobile Number <span className="text-burgundy">*</span></label>
              <div className="mt-1.5 flex items-center rounded-lg border border-ink/15 focus-within:border-ink overflow-hidden">
                <span className="px-3 py-3 text-sm text-ink/65 border-r border-ink/10 bg-stone/20 select-none">+91</span>
                <input
                  id="regMobile"
                  type="tel"
                  value={mobile}
                  onChange={e => { setMobile(e.target.value); setError(null); }}
                  placeholder="9876543210"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={20}
                  aria-required="true"
                  className="flex-1 px-3 py-3 text-sm bg-transparent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink/60">Gender <span className="text-ink/30">(optional)</span></label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {GENDERS.map(g => (
                  <button
                    key={g.value}
                    type="button"
                    aria-pressed={gender === g.value}
                    onClick={() => setGender(gender === g.value ? '' : g.value)}
                    className={`px-4 py-2 rounded-full text-sm border transition ${gender === g.value ? 'bg-ink text-ivory border-ink' : 'border-ink/15 hover:border-ink'}`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="regPassword" className="text-xs font-medium text-ink/60">Password <span className="text-burgundy">*</span></label>
              <div className="mt-1.5 relative">
                <input
                  id="regPassword"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  placeholder="Min 8 chars, 1 letter, 1 number"
                  autoComplete="new-password"
                  aria-required="true"
                  className="w-full rounded-lg border border-ink/15 px-3 py-3 pr-11 text-sm outline-none focus:border-ink"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink/65 hover:text-ink"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition ${i <= strength.score ? strength.color : 'bg-ink/10'}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-ink/65 mt-1">{strength.label}</p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPwd" className="text-xs font-medium text-ink/60">Confirm Password <span className="text-burgundy">*</span></label>
              <div className="mt-1.5 relative">
                <input
                  id="confirmPwd"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPwd}
                  onChange={e => { setConfirmPwd(e.target.value); setError(null); }}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  aria-required="true"
                  className={`w-full rounded-lg border px-3 py-3 pr-11 text-sm outline-none focus:border-ink ${confirmPwd && password !== confirmPwd ? 'border-red-400' : 'border-ink/15'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink/65 hover:text-ink"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPwd && password === confirmPwd && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><Check size={12} /> Passwords match</p>
              )}
              {confirmPwd && password !== confirmPwd && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><X size={12} /> Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-ink text-ivory font-semibold text-sm hover:bg-ink/80 transition disabled:opacity-50 flex items-center justify-center gap-2 min-h-11"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>CREATE ACCOUNT <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-ink/65">
            Already have an account?{' '}
            <Link to="/login" className="text-ink font-medium hover:text-ink/70 underline">
              Sign In
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

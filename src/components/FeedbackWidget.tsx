import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquarePlus, Star, X, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase, useAuth } from '@/store/AuthContext';
import { EASE } from '@/components/Motion';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'product', label: 'Product quality' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'payment', label: 'Payment' },
  { value: 'website', label: 'Website / app' },
];

/**
 * Floating "Send feedback" button.
 *
 * Submissions go straight into the `feedback` table. That table has RLS enabled
 * with an INSERT-only policy, so anyone (including guests) can write feedback
 * but nobody can read it back from the browser — only the admin dashboard,
 * through the service role.
 */
export default function FeedbackWidget() {
  const { user, session } = useAuth();
  const location = useLocation();
  const lift = location.pathname.startsWith('/product/');
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Prefill from the signed-in profile when the panel opens.
  useEffect(() => {
    if (!open) return;
    if (user) {
      setName(prev => prev || user.full_name || '');
      setMobile(prev => prev || (user.mobile ?? '').replace(/\D/g, '').slice(-10));
    }
  }, [open, user]);

  // Escape to close + lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const close = () => setOpen(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (message.trim().length < 4) {
      setError('Please tell us a little more.');
      return;
    }
    if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
      setError('That mobile number does not look right.');
      return;
    }

    setSending(true);
    const { error: dbError } = await supabase.from('feedback').insert({
      name: name.trim() || null,
      mobile: mobile || null,
      email: session?.user?.email ?? null,
      rating: rating || null,
      category,
      message: message.trim(),
      page: window.location.pathname,
      order_number: new URLSearchParams(window.location.search).get('order'),
    });
    setSending(false);

    if (dbError) {
      setError('Could not send your feedback right now. Please try again.');
      return;
    }

    setSent(true);
    setRating(0);
    setCategory('general');
    setMessage('');
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => { setOpen(true); setSent(false); setError(null); }}
        aria-label="Send feedback"
        className="fb-fab"
        data-lift={lift || undefined}
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.75 }}
        whileHover={{ y: -2, scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
      >
        <MessageSquarePlus size={22} aria-hidden="true" />
        <span className="fb-fab__label">Feedback</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <div
              className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
              onClick={close}
              aria-hidden="true"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="feedback-title"
              initial={{ opacity: 0, y: 32, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.32, ease: EASE }}
              className="relative w-full sm:max-w-lg bg-ivory border border-ink/10 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-ink/10">
                <div>
                  <h2 id="feedback-title" className="font-display text-xl font-bold">
                    {sent ? 'Thank you.' : 'Tell us what you think'}
                  </h2>
                  <p className="text-xs text-ink/65 mt-1">
                    {sent
                      ? 'Your feedback goes straight to the TriosWorld team.'
                      : 'Takes 20 seconds. Your feedback lands in our dashboard.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close feedback"
                  className="p-2 -m-1 text-ink/65 hover:text-ink rounded-full hover:bg-stone/40"
                >
                  <X size={18} />
                </button>
              </div>

              {sent ? (
                <div className="p-8 text-center">
                  <div className="w-14 h-14 rounded-full bg-lime mx-auto flex items-center justify-center mb-4">
                    <CheckCircle2 size={28} />
                  </div>
                  <p className="text-sm text-ink/60 mb-6">
                    We read every message. If you left your number, we may reach out.
                  </p>
                  <button
                    type="button"
                    onClick={close}
                    className="px-6 py-3 rounded-full bg-ink text-ivory text-sm font-semibold hover:bg-ink/80 transition"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} className="p-5 sm:p-6 space-y-5">
                  <div>
                    <span className="text-xs font-medium text-ink/60">How was your experience?</span>
                    <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Rating">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={rating === n}
                          aria-label={`${n} star${n > 1 ? 's' : ''}`}
                          onClick={() => setRating(n)}
                          onMouseEnter={() => setHoverRating(n)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 transition-transform hover:scale-110"
                        >
                          <Star
                            size={26}
                            className={(hoverRating || rating) >= n ? 'fill-lime text-ink' : 'text-ink/25'}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="fb-category" className="text-xs font-medium text-ink/60">Topic</label>
                    <select
                      id="fb-category"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-ink"
                    >
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="fb-message" className="text-xs font-medium text-ink/60">
                      Your feedback <span className="text-burgundy">*</span>
                    </label>
                    <textarea
                      id="fb-message"
                      value={message}
                      onChange={e => { setMessage(e.target.value); setError(null); }}
                      rows={4}
                      maxLength={4000}
                      required
                      placeholder="What did you love? What should we fix?"
                      className="mt-1.5 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:border-ink resize-y"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="fb-name" className="text-xs font-medium text-ink/60">Name (optional)</label>
                      <input
                        id="fb-name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Arjun Sharma"
                        className="mt-1.5 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:border-ink"
                      />
                    </div>
                    <div>
                      <label htmlFor="fb-mobile" className="text-xs font-medium text-ink/60">Mobile (optional)</label>
                      <input
                        id="fb-mobile"
                        type="tel"
                        inputMode="numeric"
                        value={mobile}
                        onChange={e => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(null); }}
                        placeholder="9876543210"
                        className="mt-1.5 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:border-ink"
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-sm text-red-600" role="alert">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full py-3.5 rounded-full bg-ink text-ivory font-semibold text-sm hover:bg-ink/80 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : 'Send feedback'}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

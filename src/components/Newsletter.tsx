import { useState } from 'react';
import { Mail, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSiteContent } from '@/lib/siteContent';

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'error' | 'done'>('idle');
  // Heading, blurb and the fine print are copy the operator owns.
  const { content } = useSiteContent();
  const copy = content.newsletter;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!valid) { setStatus('error'); return; }
    setStatus('done');
    setEmail('');
  };

  return (
    <div className="border-b border-ivory/10 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-2xl md:text-3xl font-semibold mb-2">{copy.heading}</h2>
        <p className="text-ivory/60 text-sm mb-6">{copy.sub}</p>
        <AnimatePresence mode="wait">
          {status === 'done' ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 bg-lime text-ink px-5 py-3 rounded-full font-medium">
              <Check size={18} /> You're in. Welcome to the world.
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={submit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <div className="relative flex-1">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ivory/60" />
                <input type="email" value={email} onChange={e => { setEmail(e.target.value); setStatus('idle'); }}
                  placeholder="Your email address"
                  aria-label="Email address for newsletter"
                  className="w-full bg-ivory/10 border border-ivory/20 rounded-full pl-11 pr-4 py-3 text-sm text-ivory placeholder:text-ivory/60 focus:outline-none focus:border-lime" />
              </div>
              <button type="submit" className="bg-lime text-ink font-semibold px-6 py-3 rounded-full hover:bg-lime/90 transition">
                Subscribe
              </button>
            </motion.form>
          )}
        </AnimatePresence>
        {status === 'error' && <p className="text-xs text-red-300 mt-3">Please enter a valid email address.</p>}
        <p className="text-[11px] text-ivory/60 mt-3">{copy.disclaimer}</p>
      </div>
    </div>
  );
}

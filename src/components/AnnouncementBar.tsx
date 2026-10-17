import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE } from '@/components/Motion';

const messages = [
  'Free shipping on orders over ₹1499 — across India.',
  'New drops every week. Three vibes, one world.',
  'Use code TRIO10 for 10% off your first order.',
];

export default function AnnouncementBar() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI(p => (p + 1) % messages.length), 5200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-ink text-ivory border-b border-ivory/5">
      <div className="relative page-container h-9 flex items-center justify-center">
        <div className="relative h-full w-full max-w-2xl overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span
              key={i}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="absolute inset-0 flex items-center justify-center px-6 text-center text-[11px] sm:text-xs tracking-wide"
            >
              {messages[i]}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="absolute right-4 hidden sm:flex items-center gap-1.5">
          {messages.map((m, k) => (
            <button
              key={m}
              onClick={() => setI(k)}
              aria-label={`Show announcement ${k + 1}`}
              aria-current={k === i}
              className={`h-1.5 rounded-full transition-all duration-300 ease-smooth ${k === i ? 'w-4 bg-lime' : 'w-1.5 bg-ivory/30 hover:bg-ivory/60'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

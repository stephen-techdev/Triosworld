import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE } from '@/components/Motion';
import { announcementLine, useStoreSettings } from '@/lib/storeSettings';
import { announcementExtras, useSiteContent } from '@/lib/siteContent';
import { formatINR } from '@/data/catalog';

// Line 1 is the operator's own announcement, falling back to the free-shipping
// line derived from their threshold — so a saved announcement actually shows,
// and raising the threshold updates this bar without editing copy. Every line
// after it is copy the operator keeps in Admin → Content (the two brand lines
// and the promo code used to be literals here).
export default function AnnouncementBar() {
  const [i, setI] = useState(0);
  const { settings } = useStoreSettings();
  const { content } = useSiteContent();

  const messages = [
    announcementLine(settings, formatINR),
    ...announcementExtras(content),
  ].filter(Boolean);

  useEffect(() => {
    const id = setInterval(() => setI(p => (p + 1) % messages.length), 5200);
    return () => clearInterval(id);
  }, [messages.length]);

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

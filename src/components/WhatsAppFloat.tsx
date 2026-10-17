import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { EASE } from '@/components/Motion';
import { whatsappLink } from '@/components/WhatsApp';

/**
 * Floating WhatsApp action button — a fixed green pill labelled "WhatsApp",
 * matching the feedback button that sits on the opposite corner. z-index 45
 * puts it above page content but below the header (50), cart drawer (55) and
 * search overlay (60). The number is intentionally not shown; the button itself
 * is the tap target that opens the chat.
 */
export default function WhatsAppFloat({ hidden = false }: { hidden?: boolean }) {
  const { pathname } = useLocation();
  // On product pages the mobile sticky add-to-cart bar owns the bottom edge,
  // so lift the button clear of it (same trick as the reference site).
  const lift = pathname.startsWith('/product/');

  if (hidden) return null;

  return (
    <motion.a
      href={whatsappLink('Hi TriosWorld, I would like to place an order.')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      data-lift={lift || undefined}
      className="wa-fab"
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.6 }}
      whileHover={{ y: -2, scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M16.04 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.59 4.46 1.72 6.41L3.2 28.8l6.55-1.72a12.79 12.79 0 0 0 6.29 1.6h.01c7.06 0 12.8-5.74 12.8-12.8S23.1 3.2 16.04 3.2Zm0 23.53c-2.02 0-4-.53-5.7-1.53l-.41-.24-4.22 1.11 1.13-4.11-.27-.42a10.53 10.53 0 0 1-1.62-5.6c0-5.83 4.75-10.58 10.59-10.58 2.83 0 5.49 1.1 7.49 3.11a10.52 10.52 0 0 1 3.1 7.48c0 5.84-4.75 10.58-10.59 10.58Zm5.83-7.92c-.32-.16-1.88-.93-2.17-1.03-.29-.11-.5-.16-.71.16-.21.32-.82 1.03-1 1.24-.19.21-.37.24-.69.08-.32-.16-1.34-.5-2.56-1.58a9.4 9.4 0 0 1-1.76-2.21c-.18-.32-.02-.49.14-.65.15-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.72-.98-2.35-.26-.62-.53-.54-.72-.55h-.62c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.66 0 1.56 1.14 3.07 1.3 3.28.16.21 2.24 3.42 5.42 4.8.75.32 1.34.52 1.8.66.76.24 1.45.21 2 .13.61-.09 1.88-.77 2.14-1.51.27-.74.27-1.38.19-1.51-.08-.14-.29-.21-.61-.37Z" />
      </svg>
      <span className="wa-fab__label">WhatsApp</span>
    </motion.a>
  );
}

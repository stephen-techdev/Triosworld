import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import AnnouncementBar from '@/components/AnnouncementBar';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import SearchOverlay from '@/components/SearchOverlay';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import FeedbackWidget from '@/components/FeedbackWidget';
import { ADMIN_BASE } from '@/lib/adminRoute';
import { armIntentPrefetch } from '@/lib/routePrefetch';

const AUTH_PAGES = ['/login', '/register', '/forgot-password'];

export default function Layout() {
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  const isAuthPage = AUTH_PAGES.includes(location.pathname);
  const isAdminPage = location.pathname.startsWith(ADMIN_BASE);

  useEffect(() => {
    // Route changes must land at the top INSTANTLY. The global
    // `scroll-behavior: smooth` made this glide back up (a visible ~0.4s on
    // a phone), which read as the new page being slow to respond.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  // Warm the destination page's JS chunk the moment a pointer/finger reaches
  // an internal link, so a tap never waits on a chunk download.
  useEffect(() => armIntentPrefetch(), []);

  return (
    <div className="min-h-screen flex flex-col">
      {!isAuthPage && !isAdminPage && <AnnouncementBar />}
      {!isAuthPage && !isAdminPage && <Header onOpenCart={() => setCartOpen(true)} onOpenSearch={() => setSearchOpen(true)} />}
      {/* No AnimatePresence here on purpose: the old exit animation
          (mode="wait", 0.4s) held the NEW page back until the old one had
          finished fading out — every navigation felt half a second late.
          The new page now swaps in the same frame and fades in 0.16s. */}
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0.01 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="flex-1"
      >
        <Outlet />
      </motion.main>
      {!isAuthPage && !isAdminPage && <Footer />}
      {!isAuthPage && !isAdminPage && <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />}
      {!isAuthPage && !isAdminPage && <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />}
      {!isAuthPage && !isAdminPage && <WhatsAppFloat />}
      {!isAuthPage && !isAdminPage && <FeedbackWidget />}
    </div>
  );
}

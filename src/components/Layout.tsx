import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AnnouncementBar from '@/components/AnnouncementBar';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import SearchOverlay from '@/components/SearchOverlay';
import { EASE } from '@/components/Motion';

const AUTH_PAGES = ['/login', '/register', '/forgot-password'];

export default function Layout() {
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  const isAuthPage = AUTH_PAGES.includes(location.pathname);

  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      {!isAuthPage && <AnnouncementBar />}
      {!isAuthPage && <Header onOpenCart={() => setCartOpen(true)} onOpenSearch={() => setSearchOpen(true)} />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="flex-1"
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
      {!isAuthPage && <Footer />}
      {!isAuthPage && <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />}
      {!isAuthPage && <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

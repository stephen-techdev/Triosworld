import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, User, Heart, ShoppingBag, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wordmark } from '@/components/Brand';
import { useStore } from '@/store/StoreContext';
import { useAuth } from '@/store/AuthContext';
import { EASE, fadeUp, staggerParent } from '@/components/Motion';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Shop All', to: '/shop/shop-all' },
  { label: "Men's Tees", to: '/shop/men' },
  { label: 'New Arrivals', to: '/shop/new-arrivals' },
  { label: 'Oversized', to: '/shop/oversized' },
  { label: 'Graphic Tees', to: '/shop/graphics' },
  { label: 'Essentials', to: '/shop/essentials' },
  { label: 'Streetwear', to: '/shop/streetwear' },
  { label: 'Collections', to: '/collections', mega: true },
];

const megaGroups = [
  { title: 'Shop', links: [
    { label: 'Shop All', to: '/shop/shop-all' },
    { label: "Men's Tees", to: '/shop/men' },
    { label: 'Oversized', to: '/shop/oversized' },
    { label: 'Graphic Tees', to: '/shop/graphics' },
  ]},
  { title: 'Collections', links: [
    { label: 'Oversized T-Shirts', to: '/shop/oversized' },
    { label: 'Graphic T-Shirts', to: '/shop/graphics' },
    { label: 'Minimal Essentials', to: '/shop/essentials' },
    { label: 'Streetwear', to: '/shop/streetwear' },
  ]},
  { title: 'Discover', links: [
    { label: 'New Arrivals', to: '/shop/new-arrivals' },
    { label: 'Bestsellers', to: '/shop/bestsellers' },
    { label: 'Regular Fit', to: '/shop/regular' },
  ]},
];

interface Props {
  onOpenCart: () => void;
  onOpenSearch: () => void;
}

const iconBtn =
  'relative p-2 min-w-9 min-h-9 rounded-full hover:bg-ink/5 active:scale-90 transition-all duration-200 flex items-center justify-center';

export default function Header({ onOpenCart, onOpenSearch }: Props) {
  const { cartCount, wishlist } = useStore();
  const { user, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const megaTimer = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const enterMega = () => {
    if (megaTimer.current) window.clearTimeout(megaTimer.current);
    setMegaOpen(true);
  };
  const leaveMega = () => {
    megaTimer.current = window.setTimeout(() => setMegaOpen(false), 120);
  };

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'glass border-b border-ink/10 shadow-[0_12px_40px_-30px_rgba(23,23,23,0.65)]'
            : 'bg-ivory border-b border-transparent'
        }`}
      >
        <div className="page-container">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center gap-3 flex-1">
              <button className="xl:hidden p-1 -ml-1 rounded-full hover:bg-ink/5 transition-colors" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                <Menu size={22} />
              </button>
              <Link to="/" className="text-xl md:text-2xl transition-opacity hover:opacity-80"><Wordmark /></Link>
            </div>

            <nav className="hidden xl:flex items-center gap-6 xl:gap-8 flex-1 justify-center" onMouseLeave={leaveMega}>
              {navLinks.map(l => (
                <div key={l.to} onMouseEnter={l.mega ? enterMega : leaveMega} className="relative py-2">
                  <Link
                    to={l.to}
                    className="relative text-sm font-medium text-ink/75 hover:text-ink transition-colors whitespace-nowrap after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 after:ease-smooth hover:after:scale-x-100"
                  >
                    {l.label}
                  </Link>
                </div>
              ))}
            </nav>

            <div className="flex items-center gap-1 sm:gap-2 flex-1 justify-end">
              <button onClick={onOpenSearch} aria-label="Search" className={iconBtn}>
                <Search size={20} />
              </button>
              {user ? (
                <Link to="/account" aria-label={`Account: ${user.full_name}`} className="hidden sm:flex items-center gap-2 p-1.5 min-h-9 rounded-full hover:bg-ink/5 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-ink text-ivory flex items-center justify-center text-xs font-semibold shrink-0">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium max-w-20 truncate hidden md:inline">{user.full_name.split(' ')[0]}</span>
                </Link>
              ) : (
                <Link to="/login" aria-label="Sign In" className={`hidden sm:flex ${iconBtn}`}>
                  <User size={20} />
                </Link>
              )}
              <Link to="/wishlist" aria-label="Wishlist" className={iconBtn}>
                <Heart size={20} />
                <AnimatePresence>
                  {wishlist.length > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-0.5 -right-0.5 bg-ink text-ivory text-[10px] font-semibold rounded-full h-4 min-w-4 px-1 flex items-center justify-center"
                    >
                      {wishlist.length}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
              <button onClick={onOpenCart} aria-label="Cart" className={iconBtn}>
                <ShoppingBag size={20} />
                <AnimatePresence>
                  {cartCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-1 -right-1 bg-lime text-ink text-[10px] font-semibold rounded-full h-4 min-w-4 px-1 flex items-center justify-center"
                    >
                      {cartCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {megaOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="absolute left-0 right-0 top-full glass border-t border-ink/10 shadow-lift hidden xl:block"
              onMouseEnter={enterMega} onMouseLeave={leaveMega}
            >
              <div className="page-container py-10 grid grid-cols-4 gap-8">
                {megaGroups.map(g => (
                  <div key={g.title}>
                    <h4 className="text-xs font-semibold tracking-widest text-ink/40 uppercase mb-4">{g.title}</h4>
                    <ul className="space-y-3">
                      {g.links.map(l => (
                        <li key={l.to}>
                          <Link to={l.to} className="link-underline text-sm hover:text-ink/60 transition-colors" onClick={() => setMegaOpen(false)}>
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <Link to="/shop/new-arrivals" onClick={() => setMegaOpen(false)} className="group relative overflow-hidden rounded-2xl shadow-soft">
                  <img src="https://images.pexels.com/photos/37186394/pexels-photo-37186394.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=600" alt="New arrivals" className="w-full h-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent flex items-end p-4">
                    <span className="text-ivory font-display font-semibold text-lg">New Drops →</span>
                  </div>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 xl:hidden" onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 40 }}
              className="fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-ivory z-50 xl:hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-ink/10">
                <span className="text-lg"><Wordmark /></span>
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="-mr-1 p-2 rounded-full hover:bg-ink/5 transition-colors"><X size={22} /></button>
              </div>
              <motion.nav
                variants={staggerParent(0.05, 0.08)}
                initial="hidden"
                animate="show"
                className="flex-1 overflow-y-auto p-4"
              >
                {navLinks.map(l => (
                  <motion.div key={l.to} variants={fadeUp}>
                    <Link to={l.to} onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-between py-3.5 text-base font-medium border-b border-ink/5 hover:text-ink/60 transition-colors">
                      {l.label}
                    </Link>
                  </motion.div>
                ))}
                {user ? (
                  <>
                    <motion.div variants={fadeUp}>
                      <Link to="/account" onClick={() => setMobileOpen(false)} className="flex items-center justify-between py-3.5 text-base font-medium border-b border-ink/5 hover:text-ink/60 transition-colors">My Account</Link>
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <Link to="/wishlist" onClick={() => setMobileOpen(false)} className="flex items-center justify-between py-3.5 text-base font-medium border-b border-ink/5 hover:text-ink/60 transition-colors">Wishlist</Link>
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <button onClick={() => { signOut(); setMobileOpen(false); }} className="flex w-full items-center justify-between py-3.5 text-base font-medium text-red-600 hover:text-red-700 transition-colors">Logout</button>
                    </motion.div>
                  </>
                ) : (
                  <>
                    <motion.div variants={fadeUp}>
                      <Link to="/login" onClick={() => setMobileOpen(false)} className="flex items-center justify-between py-3.5 text-base font-medium border-b border-ink/5 hover:text-ink/60 transition-colors">Sign In</Link>
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <Link to="/register" onClick={() => setMobileOpen(false)} className="flex items-center justify-between py-3.5 text-base font-medium border-b border-ink/5 hover:text-ink/60 transition-colors">Create Account</Link>
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <Link to="/wishlist" onClick={() => setMobileOpen(false)} className="flex items-center justify-between py-3.5 text-base font-medium hover:text-ink/60 transition-colors">Wishlist</Link>
                    </motion.div>
                  </>
                )}
              </motion.nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

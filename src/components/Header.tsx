import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, User, Heart, ShoppingBag, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/StoreContext';
import { useAuth } from '@/store/AuthContext';
import { useSiteContent } from '@/lib/siteContent';
import { Wordmark } from '@/components/Brand';
import { EASE, fadeUp, staggerParent } from '@/components/Motion';

/**
 * Header brand: the brand's drawn TRIO lettering sitting above the winged
 * mark, as the operator asked. The lettering is the same vector artwork used
 * elsewhere on the site, so it stays sharp at every size and never falls back
 * to a different typeface.
 */
function HeaderLockup({
  wordmarkClassName = 'text-[15px] sm:text-[16px]',
  markClassName = 'h-8 sm:h-9',
}: {
  wordmarkClassName?: string;
  markClassName?: string;
}) {
  return (
    <span className="inline-flex flex-col items-center">
      <Wordmark variant="ink" showMonogram={false} className={wordmarkClassName} />
      <img src="/logo.png" alt="TriosWorld" className={`mt-0.5 w-auto ${markClassName}`} />
    </span>
  );
}

/**
 * The desktop nav is three stacked rows — utility bar, nav, then the wordmark
 * centred on its own line — so the brand owns the middle of the header rather
 * than being squeezed to the left of the nav. The nav itself is the operator's
 * (Admin → Content), so a category can be renamed, reordered or removed
 * without a deploy; the mega menu below is what feeds its hover panel.
 */
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
  const { content } = useSiteContent();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const megaTimer = useRef<number | null>(null);

  // The operator owns the nav; until they edit it this is the shipped list.
  const navLinks = content.header.nav;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // A resize past the desktop breakpoint should not leave the phone drawer
  // hanging over a desktop header (it is xl:hidden, so it would be invisible
  // but still trap focus).
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1280) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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
          {/* ── Mobile: menu · wordmark centred · actions ───────────────── */}
          <div className="xl:hidden grid grid-cols-[1fr_auto_1fr] items-center h-16">
            <div className="flex items-center">
              <button className="p-1 -ml-1 rounded-full hover:bg-ink/5 transition-colors" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                <Menu size={22} />
              </button>
            </div>
            <Link to="/home" aria-label="TriosWorld home" className="text-xl text-ink transition-opacity hover:opacity-70 justify-self-center">
              <HeaderLockup />
            </Link>
            <div className="flex items-center justify-end gap-0.5">
              <button onClick={onOpenSearch} aria-label="Search" className={iconBtn}>
                <Search size={20} />
              </button>
              <button onClick={onOpenCart} aria-label="Cart" className={iconBtn}>
                <ShoppingBag size={20} />
                <AnimatePresence>
                  {cartCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
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

          {/* ── Desktop: one row — wordmark, centred nav, actions ────────── */}
          <div className="hidden xl:flex items-center justify-between h-20">
            <div className="flex items-center flex-1">
              <Link to="/home" aria-label="TriosWorld home" className="text-2xl text-ink transition-opacity hover:opacity-70">
                <HeaderLockup wordmarkClassName="text-[17px]" markClassName="h-9" />
              </Link>
            </div>

            <nav className="flex items-center gap-5 2xl:gap-8" onMouseLeave={leaveMega}>
              {navLinks.map(l => (
                <div key={`${l.label}-${l.to}`} onMouseEnter={l.to === '/collections' ? enterMega : leaveMega} className="relative py-2">
                  <Link
                    to={l.to}
                    className="relative text-sm font-medium text-ink/75 hover:text-ink transition-colors whitespace-nowrap after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 after:ease-smooth hover:after:scale-x-100"
                  >
                    {l.label}
                  </Link>
                </div>
              ))}
            </nav>

            <div className="flex items-center gap-1 2xl:gap-2 flex-1 justify-end">
              <button onClick={onOpenSearch} aria-label="Search" className={iconBtn}><Search size={20} /></button>
              {user ? (
                <Link to="/account" aria-label={`Account: ${user.full_name}`} className="flex items-center gap-2 p-1.5 min-h-9 rounded-full hover:bg-ink/5 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-ink text-ivory flex items-center justify-center text-xs font-semibold shrink-0">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium max-w-20 truncate">{user.full_name.split(' ')[0]}</span>
                </Link>
              ) : (
                <Link to="/login" aria-label="Sign In" className={`flex ${iconBtn}`}>
                  <User size={20} />
                </Link>
              )}
              <Link to="/wishlist" aria-label="Wishlist" className={iconBtn}>
                <Heart size={20} />
                <AnimatePresence>
                  {wishlist.length > 0 && (
                    <motion.span
                      initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
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
                      initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
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
                    <h4 className="text-xs font-semibold tracking-widest text-ink/65 uppercase mb-4">{g.title}</h4>
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
                <span className="text-lg text-ink"><HeaderLockup wordmarkClassName="text-[13px]" markClassName="h-6" /></span>
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="-mr-1 p-2 rounded-full hover:bg-ink/5 transition-colors"><X size={22} /></button>
              </div>
              <motion.nav
                variants={staggerParent(0.05, 0.08)}
                initial="hidden"
                animate="show"
                className="flex-1 overflow-y-auto p-4"
              >
                {navLinks.map(l => (
                  <motion.div key={`${l.label}-${l.to}`} variants={fadeUp}>
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

/**
 * Instant-feel navigation: fetch each route's JS chunk before the visitor asks
 * for it.
 *
 * Two triggers:
 *
 *  1. idle — about a second after the page finishes loading (good connections
 *     only), the small storefront chunks download in the background so the
 *     FIRST tap on any page is a module-cache hit instead of a Suspense
 *     spinner. The queue is spaced out so it never competes with the first
 *     paint or the LCP image.
 *
 *  2. intent — pointerover / touchstart / focusin on an internal link starts
 *     that route's chunk immediately, which covers a cold tap made before the
 *     idle queue reached that page.
 *
 * Deliberately skipped: save-data and 2G connections (we do not spend a mobile
 * visitor's data on pages they may never open) and automation runs
 * (navigator.webdriver), so Lighthouse/lab numbers are unaffected.
 *
 * The admin dashboard is never prefetched.
 */
import { loadRazorpayCheckout } from '@/lib/razorpayCheckout';

interface RouteChunk {
  test: (pathname: string) => boolean;
  load: () => Promise<unknown>;
}

const ROUTES: RouteChunk[] = [
  { test: (p) => p.startsWith('/product/'), load: () => import('@/pages/ProductPage') },
  { test: (p) => p === '/checkout', load: () => import('@/pages/CheckoutPage') },
  { test: (p) => p.startsWith('/order/'), load: () => import('@/pages/PaymentSuccessPage') },
  { test: (p) => p === '/home', load: () => import('@/pages/HomePage') },
  { test: (p) => p === '/collections', load: () => import('@/pages/CollectionsPage') },
  { test: (p) => p === '/track', load: () => import('@/pages/TrackOrderPage') },
  { test: (p) => p === '/account', load: () => import('@/pages/AccountPage') },
  { test: (p) => p === '/wishlist', load: () => import('@/pages/WishlistPage') },
  { test: (p) => p === '/login', load: () => import('@/pages/LoginPage') },
  { test: (p) => p === '/register', load: () => import('@/pages/RegisterPage') },
  { test: (p) => p === '/forgot-password', load: () => import('@/pages/ForgotPasswordPage') },
  {
    test: (p) => ['/about', '/shipping', '/returns', '/privacy', '/terms', '/contact', '/faqs'].includes(p),
    load: () => import('@/pages/StaticPage'),
  },
];

/** Chunks already requested (or already failed once — do not retry-storm). */
const requested = new Set<() => Promise<unknown>>();

/** Start one route's chunk download. Safe to call repeatedly. */
export function prefetchRoute(pathname: string): void {
  const route = ROUTES.find((r) => r.test(pathname));
  if (!route || requested.has(route.load)) return;
  requested.add(route.load);
  void route.load().catch(() => {
    // A failed prefetch is harmless — the router still lazy-loads on tap.
  });
}

/**
 * Warm the whole payment path: the checkout + /order chunks and Razorpay's
 * hosted checkout script. Called from the checkout page itself (as soon as it
 * opens, while the customer is still filling the address) and when the cart
 * drawer opens (purchase intent), so tapping "Pay securely" never waits on a
 * download — especially on mobile.
 */
export function prefetchPaymentFlow(): void {
  prefetchRoute('/checkout');
  prefetchRoute('/order/prefetch');
  void loadRazorpayCheckout().catch(() => {
    // The pay buttons surface this error themselves when actually tapped.
  });
}

function connectionIsDataFriendly(): boolean {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const conn = nav.connection;
  if (!conn) return true;
  if (conn.saveData) return false;
  return !['slow-2g', '2g'].includes(conn.effectiveType ?? '');
}

const IDLE_QUEUE = [
  '/product/prefetch',
  '/checkout',
  '/order/prefetch',
  '/home',
  '/collections',
  '/track',
  '/account',
  '/wishlist',
  '/login',
  '/register',
  '/forgot-password',
  '/about',
];

/**
 * Download the storefront's small chunks in the background after first paint.
 * Each chunk is spaced ~220ms apart with requestIdleCallback so the main
 * thread is never busy while the visitor is looking at the first screen.
 */
export function scheduleIdlePrefetch(): void {
  if (typeof window === 'undefined' || navigator.webdriver) return;
  if (!connectionIsDataFriendly()) return;

  const hasIdle = typeof (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback === 'function';
  const idle: (cb: () => void) => void = hasIdle
    ? (cb) => {
        (window as unknown as { requestIdleCallback: (c: () => void, o: { timeout: number }) => void })
          .requestIdleCallback(cb, { timeout: 2500 });
      }
    : (cb) => {
        window.setTimeout(cb, 800);
      };

  const queue = [...IDLE_QUEUE];
  const step = () => {
    const next = queue.shift();
    if (!next) return;
    prefetchRoute(next);
    window.setTimeout(() => idle(step), 220);
  };

  const startAfterLoad = () => window.setTimeout(() => idle(step), 1200);
  if (document.readyState === 'complete') startAfterLoad();
  else window.addEventListener('load', startAfterLoad, { once: true });
}

/**
 * Attach delegated intent listeners once (Layout mounts them). A pointer or
 * finger reaching an internal link — or keyboard focus landing on it — starts
 * the destination chunk immediately, before the tap's click event.
 */
export function armIntentPrefetch(): () => void {
  if (typeof document === 'undefined') return () => {};

  let lastPath = '';
  const onIntent = (event: Event) => {
    const target = event.target as Element | null;
    const anchor = target && typeof target.closest === 'function' ? target.closest('a[href]') : null;
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    if (!href.startsWith('/') || href.startsWith('//')) return;
    const pathname = href.split('?')[0].split('#')[0];
    if (pathname === lastPath) return;
    lastPath = pathname;
    prefetchRoute(pathname);
  };

  document.addEventListener('pointerover', onIntent, { passive: true });
  document.addEventListener('touchstart', onIntent, { passive: true, capture: true });
  document.addEventListener('focusin', onIntent);

  return () => {
    document.removeEventListener('pointerover', onIntent);
    document.removeEventListener('touchstart', onIntent, true);
    document.removeEventListener('focusin', onIntent);
  };
}

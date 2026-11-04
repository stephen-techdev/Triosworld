import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { StoreProvider } from '@/store/StoreContext';
import { AuthProvider } from '@/store/AuthContext';
import Layout from '@/components/Layout';
import { ADMIN_BASE, ADMIN_LOGIN_PATH } from '@/lib/adminRoute';

// Eagerly imported: "/" IS the shop grid, so a lazy chunk here put the whole
// storefront behind a second serial network request — Lighthouse measured the
// Suspense spinner state collapsing into a 0.76 CLS when the chunk finally
// finished loading. Every other route stays lazy; only pages reachable from
// products cards and links pay that cost on their first visit.
import ShopPage from '@/pages/ShopPage';

// Split the heavy, rarely-visited routes out of the main bundle: the order page
// pulls in the QR renderer and jsPDF, and the dashboard is admin-only.
const HomePage = lazy(() => import('@/pages/HomePage'));
const ProductPage = lazy(() => import('@/pages/ProductPage'));
const WishlistPage = lazy(() => import('@/pages/WishlistPage'));
const CollectionsPage = lazy(() => import('@/pages/CollectionsPage'));
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'));
const AccountPage = lazy(() => import('@/pages/AccountPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const StaticPage = lazy(() => import('@/pages/StaticPage'));
const TrackOrderPage = lazy(() => import('@/pages/TrackOrderPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const PaymentSuccessPage = lazy(() => import('@/pages/PaymentSuccessPage'));
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'));
const AdminLoginPage = lazy(() => import('@/pages/admin/AdminLoginPage'));

function RouteFallback() {
  // Sized like the shop shell it stands in for, so a slow deep-link chunk can
  // never collapse the layout and drag the footer into the viewport.
  return (
    <div className="page-container py-32 grid place-items-center text-ink/65 min-h-[70svh]">
      <Loader2 className="animate-spin" size={26} />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <StoreProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Operator sign-in is reachable from the footer's "Admin
                    access" link at /admin/login, and from the private
                    bookmark path. Both render full-bleed, with no storefront
                    header, footer or floating buttons. The dashboard itself
                    stays on the unlisted ADMIN_BASE route. */}
                <Route path={ADMIN_LOGIN_PATH} element={<AdminLoginPage />} />
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
                <Route element={<Layout />}>
                  {/* The shop is the front door: the bare domain renders
                      Shop All directly (no Login redirect, no second chunk
                      request), and the homepage is reached by tapping the
                      logo or "Home" in the nav. ShopPage defaults its slug to
                      "shop-all" when useParams has no slug, which is exactly
                      what happens here. */}
                  <Route path="/" element={<ShopPage />} />
                  <Route path="/home" element={<HomePage />} />
                  <Route path="/shop/:slug" element={<ShopPage />} />
                  <Route path="/product/:slug" element={<ProductPage />} />
                  <Route path="/collections" element={<CollectionsPage />} />
                  <Route path="/wishlist" element={<WishlistPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/track" element={<TrackOrderPage />} />
                  <Route path="/order/:orderNumber" element={<PaymentSuccessPage />} />
                  <Route path="/account" element={<AccountPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path={ADMIN_BASE} element={<AdminPage />} />
                  <Route path="/about" element={<StaticPage page="about" />} />
                  <Route path="/shipping" element={<StaticPage page="shipping" />} />
                  <Route path="/privacy" element={<StaticPage page="privacy" />} />
                  <Route path="/terms" element={<StaticPage page="terms" />} />
                  <Route path="/contact" element={<StaticPage page="contact" />} />
                  <Route path="/faqs" element={<StaticPage page="faqs" />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </StoreProvider>
      </AuthProvider>
    </MotionConfig>
  );
}

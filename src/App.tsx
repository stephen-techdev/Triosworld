import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { StoreProvider } from '@/store/StoreContext';
import { AuthProvider } from '@/store/AuthContext';
import Layout from '@/components/Layout';
import HomePage from '@/pages/HomePage';
import ShopPage from '@/pages/ShopPage';
import ProductPage from '@/pages/ProductPage';
import WishlistPage from '@/pages/WishlistPage';
import CollectionsPage from '@/pages/CollectionsPage';
import CheckoutPage from '@/pages/CheckoutPage';
import AccountPage from '@/pages/AccountPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import StaticPage from '@/pages/StaticPage';
import NotFoundPage from '@/pages/NotFoundPage';
import { ADMIN_BASE, ADMIN_LOGIN_PATH } from '@/lib/adminRoute';

// Split the heavy, rarely-visited routes out of the main bundle: the order page
// pulls in the QR renderer and jsPDF, and the dashboard is admin-only.
const PaymentSuccessPage = lazy(() => import('@/pages/PaymentSuccessPage'));
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'));
const AdminLoginPage = lazy(() => import('@/pages/admin/AdminLoginPage'));

function RouteFallback() {
  return (
    <div className="page-container py-32 grid place-items-center text-ink/65">
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
                  {/* The shop is the front door: a visitor landing on the bare
                      domain is taken straight to Shop All, and reaches the
                      homepage by tapping the logo or "Home" in the nav. */}
                  <Route path="/" element={<Navigate to="/shop/shop-all" replace />} />
                  <Route path="/home" element={<HomePage />} />
                  <Route path="/shop/:slug" element={<ShopPage />} />
                  <Route path="/product/:slug" element={<ProductPage />} />
                  <Route path="/collections" element={<CollectionsPage />} />
                  <Route path="/wishlist" element={<WishlistPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/order/:orderNumber" element={<PaymentSuccessPage />} />
                  <Route path="/account" element={<AccountPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path={ADMIN_BASE} element={<AdminPage />} />
                  <Route path="/about" element={<StaticPage page="about" />} />
                  <Route path="/shipping" element={<StaticPage page="shipping" />} />
                  <Route path="/returns" element={<StaticPage page="returns" />} />
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

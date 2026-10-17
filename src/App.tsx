import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
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

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <StoreProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/shop/:slug" element={<ShopPage />} />
                <Route path="/product/:slug" element={<ProductPage />} />
                <Route path="/collections" element={<CollectionsPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
          </BrowserRouter>
        </StoreProvider>
      </AuthProvider>
    </MotionConfig>
  );
}

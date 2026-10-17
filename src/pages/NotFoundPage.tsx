import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';

export default function NotFoundPage() {
  return (
    <div className="page-container py-32 text-center">
      <SEO title="Page Not Found" noindex />
      <p className="font-display text-7xl md:text-9xl font-bold text-ink/10">404</p>
      <h1 className="font-display text-2xl md:text-3xl font-semibold -mt-6 mb-3">This page wandered off.</h1>
      <p className="text-ink/60 mb-8">The page you are looking for does not exist or has moved.</p>
      <Link to="/" className="bg-ink text-ivory px-6 py-3 rounded-full text-sm font-medium hover:bg-ink/80">Back to home</Link>
    </div>
  );
}

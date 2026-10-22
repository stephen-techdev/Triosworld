import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import SEO from '@/components/SEO';
import { useStore, resolveProduct } from '@/store/StoreContext';
import { ProductCardMotion } from '@/components/ProductCard';

export default function WishlistPage() {
  const { wishlist } = useStore();
  const products = wishlist.map(id => resolveProduct(id)).filter(Boolean) as NonNullable<ReturnType<typeof resolveProduct>>[];

  return (
    <div className="page-container py-10 md:py-16">
      <SEO title="Wishlist" noindex />
      <h1 className="font-display text-3xl md:text-5xl font-semibold mb-2">Wishlist</h1>
      <p className="text-ink/60 text-sm mb-10">{products.length} {products.length === 1 ? 'item' : 'items'} saved</p>

      {products.length === 0 ? (
        <div className="py-24 text-center">
          <Heart size={40} className="mx-auto text-ink/30 mb-4" />
          <p className="font-display text-xl mb-2">Your wishlist is empty.</p>
          <p className="text-ink/65 text-sm mb-6">Tap the heart on any product to save it here.</p>
          <Link to="/shop/shop-all" className="bg-ink text-ivory px-6 py-3 rounded-full text-sm font-medium hover:bg-ink/80">Browse products</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-5 md:gap-x-4 md:gap-y-6">
          {products.map((p, i) => <ProductCardMotion key={p.id} product={p} index={i} />)}
        </div>
      )}
    </div>
  );
}

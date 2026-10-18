import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Heart, Minus, Plus, Check, Truck, RefreshCw, ShieldCheck, Ruler, Star } from 'lucide-react';
import WhatsAppIcon, { whatsappLink } from '@/components/WhatsApp';
import { formatINR, discountPercent, SIZES } from '@/data/catalog';
import { liveProduct, liveRelated, useLiveCatalog } from '@/lib/storefrontCatalog';
import { freeShippingLabel, useStoreSettings } from '@/lib/storeSettings';
import { useStore } from '@/store/StoreContext';
import { ProductCardMotion } from '@/components/ProductCard';
import SEO, { productJsonLd, breadcrumbJsonLd } from '@/components/SEO';

const sizeGuide = [
  ['Size', 'Chest (in)', 'Length (in)'],
  ['XS', '36', '26'],
  ['S', '38', '27'],
  ['M', '40', '28'],
  ['L', '42', '29'],
  ['XL', '44', '30'],
  ['XXL', '46', '31'],
];

export default function ProductPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  // Products come from the admin dashboard, so the slug cannot be resolved
  // until the catalog fetch lands. `ready` keeps the not-found screen from
  // flashing for a product that does exist.
  const { ready } = useLiveCatalog();
  const product = slug ? liveProduct(slug) : undefined;
  const { settings } = useStoreSettings();
  const { addToCart, toggleWishlist, isWishlisted } = useStore();

  const [colorIdx, setColorIdx] = useState(0);
  const [imageIdx, setImageIdx] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'care' | 'shipping'>('description');

  useEffect(() => {
    setColorIdx(0); setImageIdx(0); setSize(null); setQty(1);
    setAdded(false); setError(null); setActiveTab('description');
  }, [slug]);

  if (!product) {
    // Hold a skeleton until the catalog answers; only then is "not found" true.
    if (!ready) {
      return (
        <div className="page-container py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-8 md:gap-14">
            <div className="aspect-[4/5] rounded-2xl bg-stone/40 animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 w-2/3 rounded bg-stone/40 animate-pulse" />
              <div className="h-4 w-1/3 rounded bg-stone/30 animate-pulse" />
              <div className="h-24 w-full rounded bg-stone/30 animate-pulse" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="page-container py-32 text-center">
        <SEO title="Product not found" noindex />
        <h1 className="font-display text-3xl mb-3">Product not found</h1>
        <Link to="/shop/shop-all" className="text-ink/60 underline">Back to shop</Link>
      </div>
    );
  }

  const variant = product.variants[colorIdx];
  const wished = isWishlisted(product.id);
  const hasDiscount = product.mrp > product.price;
  const related = liveRelated(product);
  const totalStock = variant.sizes.reduce((s, x) => s + x.stock, 0);
  const inStock = totalStock > 0;

  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 4);
  const deliveryStr = deliveryDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  const jsonLd = productJsonLd({
    name: product.name, slug: product.slug, description: product.description,
    price: product.price, mrp: product.mrp, image: variant.images[0],
  });
  const bcJsonLd = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: product.categories[0].replace('-', ' '), path: `/shop/${product.categories[0]}` },
    { name: product.name, path: `/product/${product.slug}` },
  ]);

  const handleAdd = (buyNow = false) => {
    if (!size) { setError('Please select a size first.'); return; }
    setError(null);
    addToCart({ productId: product.id, color: variant.color, size, qty });
    if (buyNow) { navigate('/checkout'); return; }
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  const selectColor = (i: number) => { setColorIdx(i); setImageIdx(0); };

  return (
    <div className="page-container py-6 md:py-10 pb-24 md:pb-10">
      <SEO title={product.name} description={product.description} jsonLd={[jsonLd, bcJsonLd]} />
      <nav className="flex items-center gap-1.5 text-xs text-ink/50 mb-6 flex-wrap">
        <Link to="/" className="hover:text-ink">Home</Link>
        <ChevronRight size={12} />
        <Link to={`/shop/${product.categories[0]}`} className="hover:text-ink capitalize">{product.categories[0].replace('-', ' ')}</Link>
        <ChevronRight size={12} />
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Gallery */}
        <div className="flex flex-col-reverse md:flex-row gap-3 md:gap-4">
          <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-visible no-scrollbar">
            {variant.images.map((img, i) => (
              <button key={i} onClick={() => setImageIdx(i)}
                className={`shrink-0 w-20 h-24 rounded overflow-hidden border-2 ${imageIdx === i ? 'border-ink' : 'border-transparent'}`}>
                <img src={img} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          <div className="flex-1 relative overflow-hidden rounded-xl bg-stone/30 aspect-[3/4]">
            <AnimatePresence mode="wait">
              <motion.img key={`${colorIdx}-${imageIdx}`} src={variant.images[imageIdx]} alt={product.name}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
                className="absolute inset-0 w-full h-full object-cover" />
            </AnimatePresence>
          </div>
        </div>

        {/* Info */}
        <div className="md:py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-semibold tracking-wider uppercase bg-ink text-ivory px-2 py-1 rounded">{product.badge}</span>
            <span className="text-xs text-ink/50 capitalize">{product.fit} fit · {product.fabric}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold leading-tight">{product.name}</h1>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-2xl font-semibold">{formatINR(product.price)}</span>
            {hasDiscount && <><span className="text-ink/40 line-through">{formatINR(product.mrp)}</span><span className="text-sm font-semibold text-lime bg-ink px-2 py-0.5 rounded">{discountPercent(product)}% off</span></>}
          </div>
          <p className="text-xs text-ink/50 mt-1">MRP inclusive of all taxes</p>

          {/* Rating + stock */}
          <div className="mt-3 flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5" aria-label="4.3 out of 5 stars">
                {[1,2,3,4].map(i => <Star key={i} size={14} className="fill-ink text-ink" />)}
                <Star size={14} className="fill-ink/30 text-ink/30" />
              </div>
              <span className="text-xs text-ink/60">4.3 (28 reviews)</span>
            </div>
            {inStock ? (
              <span className="text-xs font-medium text-green-700 flex items-center gap-1"><Check size={14} /> In stock</span>
            ) : (
              <span className="text-xs font-medium text-red-600">Out of stock</span>
            )}
          </div>

          {/* Delivery estimate */}
          <div className="mt-3 flex items-center gap-2 text-xs text-ink/60">
            <Truck size={16} className="text-ink/40" />
            <span>Estimated delivery by <span className="font-medium text-ink">{deliveryStr}</span> — {freeShippingLabel(settings, formatINR)}</span>
          </div>

          {/* Colour */}
          <div className="mt-7">
            <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">Colour: <span className="text-ink/60">{variant.color}</span></span></div>
            <div className="flex gap-2.5">
              {product.variants.map((v, i) => (
                <button key={v.color} onClick={() => selectColor(i)} title={v.color}
                  className={`w-9 h-9 rounded-full border-2 transition ${colorIdx === i ? 'border-ink ring-2 ring-ink/10' : 'border-ink/15'}`}
                  style={{ backgroundColor: v.hex }} aria-label={v.color} />
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="mt-7">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Select size</span>
              <button onClick={() => setShowSizeGuide(true)} className="text-xs text-ink/60 hover:text-ink inline-flex items-center gap-1"><Ruler size={14} /> Size guide</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {SIZES.map(s => {
                const stock = variant.sizes.find(x => x.size === s)?.stock ?? 0;
                const oos = stock === 0;
                return (
                  <button key={s} disabled={oos} onClick={() => { setSize(s); setError(null); }}
                    className={`min-w-12 h-12 px-3 text-sm rounded-lg border transition ${size === s ? 'bg-ink text-ivory border-ink' : oos ? 'border-ink/10 text-ink/30 cursor-not-allowed line-through' : 'border-ink/20 hover:border-ink'}`}>
                    {s}
                  </button>
                );
              })}
            </div>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </div>

          {/* Qty + actions */}
          <div className="mt-7 flex items-center gap-3">
            <div className="flex items-center border border-ink/15 rounded-full">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease" className="w-10 h-10 flex items-center justify-center"><Minus size={16} /></button>
              <span className="w-8 text-center text-sm">{qty}</span>
              <button onClick={() => setQty(q => Math.min(10, q + 1))} aria-label="Increase" className="w-10 h-10 flex items-center justify-center"><Plus size={16} /></button>
            </div>
            <button onClick={() => toggleWishlist(product.id)}
              className={`w-12 h-12 rounded-full border border-ink/15 flex items-center justify-center transition ${wished ? 'text-burgundy border-burgundy' : 'hover:border-ink'}`}
              aria-label="Wishlist">
              <Heart size={20} fill={wished ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <button onClick={() => handleAdd(false)}
              className="flex-1 py-4 rounded-full bg-ink text-ivory font-semibold hover:bg-ink/80 transition relative overflow-hidden">
              {added ? <span className="inline-flex items-center gap-2"><Check size={18} /> Added to bag</span> : 'Add to Cart'}
            </button>
            <button onClick={() => handleAdd(true)}
              className="flex-1 py-4 rounded-full bg-lime text-ink font-semibold hover:bg-lime/90 transition">
              Buy Now
            </button>
          </div>

          {/* Promises */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg border border-ink/8"><Truck size={18} className="mx-auto mb-1" /><p className="text-[11px] text-ink/60">Ships in 24h</p></div>
            <div className="p-3 rounded-lg border border-ink/8"><RefreshCw size={18} className="mx-auto mb-1" /><p className="text-[11px] text-ink/60">7-day returns</p></div>
            <div className="p-3 rounded-lg border border-ink/8"><ShieldCheck size={18} className="mx-auto mb-1" /><p className="text-[11px] text-ink/60">Secure pay</p></div>
          </div>

          {/* WhatsApp enquiry */}
          <a href={whatsappLink(`Hi TriosWorld, I have a question about this product: ${product.name}`)}
            target="_blank" rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-ink/60 hover:text-ink transition">
            <WhatsAppIcon size={16} /> Ask about this product on WhatsApp
          </a>

          {/* Tabs */}
          <div className="mt-8 border-t border-ink/10 pt-6">
            <div className="flex gap-5 mb-4">
              {(['description', 'care', 'shipping'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`text-sm font-medium capitalize border-b-2 pb-1 transition ${activeTab === t ? 'border-ink' : 'border-transparent text-ink/50 hover:text-ink'}`}>
                  {t === 'shipping' ? 'Delivery & Returns' : t === 'care' ? 'Fabric & Care' : 'Description'}
                </button>
              ))}
            </div>
            <div className="text-sm text-ink/70 leading-relaxed space-y-2">
              {activeTab === 'description' && <div><p>{product.description}</p><p className="mt-2"><span className="font-medium text-ink">Fit:</span> {product.fit}</p><p><span className="font-medium text-ink">Fabric:</span> {product.fabric}</p></div>}
              {activeTab === 'care' && <div><p><span className="font-medium text-ink">Fabric:</span> {product.fabric}</p><p><span className="font-medium text-ink">Care:</span> {product.care}</p></div>}
              {activeTab === 'shipping' && <div><p>{freeShippingLabel(settings, formatINR)}. Standard delivery in 3–5 business days across India. A flat fee of {formatINR(settings.shippingFee)} applies below the free-shipping threshold.</p><p>7-day easy returns. Items must be unworn with tags intact.</p></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Customer reviews */}
      <section className="mt-16 border-t border-ink/10 pt-10">
        <h2 className="font-display text-xl md:text-2xl font-semibold mb-6">Customer Reviews</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { name: 'Arjun K.', rating: 5, text: 'Fabric quality is legit for this price. Fit is exactly as described — oversized but not baggy. Will buy again.' },
            { name: 'Rohan M.', rating: 4, text: 'Good tee, print is clean and has not cracked after 3 washes. Delivery took 4 days to Bangalore.' },
            { name: 'Karthik S.', rating: 5, text: 'Heavyweight cotton feels premium. The black hasn\'t faded. Best tee I\'ve bought online this year.' },
          ].map((r, i) => (
            <div key={i} className="p-5 rounded-xl border border-ink/8">
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} size={14} className={j < r.rating ? 'fill-ink text-ink' : 'fill-ink/15 text-ink/15'} />
                ))}
              </div>
              <p className="text-sm text-ink/70 leading-relaxed">{r.text}</p>
              <p className="text-xs text-ink/40 mt-3">{r.name} · Verified purchase</p>
            </div>
          ))}
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display text-xl md:text-2xl md:text-3xl font-semibold mb-8">You may also like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-5 md:gap-x-4 md:gap-y-6">
            {related.map((p, i) => <ProductCardMotion key={p.id} product={p} index={i} />)}
          </div>
        </section>
      )}

      {/* Size guide modal */}
      <AnimatePresence>
        {showSizeGuide && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/40 z-[60] flex items-center justify-center p-4" onClick={() => setShowSizeGuide(false)}>
            <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }}
              className="bg-ivory rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <h3 className="font-display text-xl font-semibold mb-4">Size Guide</h3>
              <table className="w-full text-sm">
                <tbody>
                  {sizeGuide.map((row, i) => (
                    <tr key={i} className={i === 0 ? 'text-ink/50 text-xs uppercase' : 'border-t border-ink/5'}>
                      {row.map((cell, j) => <td key={j} className={j === 0 ? 'font-medium py-2' : 'py-2'}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => setShowSizeGuide(false)} className="mt-5 w-full py-3 rounded-full bg-ink text-ivory text-sm font-medium">Got it</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile sticky add bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-ivory border-t border-ink/10 p-3 flex items-center gap-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-ink/60 truncate">{product.name}</p>
          <p className="text-sm font-semibold">{formatINR(product.price)}</p>
        </div>
        <button onClick={() => handleAdd(false)} className="px-6 py-3.5 rounded-full bg-ink text-ivory text-sm font-semibold min-h-11">
          {added ? 'Added' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}

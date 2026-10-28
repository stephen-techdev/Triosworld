import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Heart, Minus, Plus, Check, Truck, RefreshCw, ShieldCheck, Ruler, Star, X, Maximize2 } from 'lucide-react';
import WhatsAppIcon, { whatsappLink } from '@/components/WhatsApp';
import { formatINR, discountPercent, SIZES } from '@/data/catalog';
import { liveProduct, liveRelated, useLiveCatalog } from '@/lib/storefrontCatalog';
import { freeShippingLabel, useStoreSettings } from '@/lib/storeSettings';
import { useStore } from '@/store/StoreContext';
import { MAX_UNITS_PER_LINE } from '@/lib/stock';
import { useSiteContent } from '@/lib/siteContent';
import { ProductCardMotion } from '@/components/ProductCard';
import SEO, { productJsonLd, breadcrumbJsonLd } from '@/components/SEO';

export default function ProductPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  // Products come from the admin dashboard, so the slug cannot be resolved
  // until the catalog fetch lands. `ready` keeps the not-found screen from
  // flashing for a product that does exist.
  const { ready } = useLiveCatalog();
  const product = slug ? liveProduct(slug) : undefined;
  const { settings, ready: settingsReady } = useStoreSettings();
  // Size guide, reviews, promises and the returns line are operator-owned
  // (Admin → Content). The three reviews this page used to hardcode are gone:
  // a rating is now only shown when the operator has actually published
  // reviews, so no number on this page is invented.
  const { content } = useSiteContent();
  const { addToCart, toggleWishlist, isWishlisted, cart } = useStore();

  const [colorIdx, setColorIdx] = useState(0);
  const [imageIdx, setImageIdx] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'care' | 'shipping'>('description');
  /** The mobile photo strip — the one the customer swipes through. */
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setColorIdx(0); setImageIdx(0); setSize(null); setQty(1);
    setAdded(false); setError(null); setActiveTab('description'); setViewerIdx(null);
  }, [slug]);

  // Keep the stepper inside the operator's stock for the selected colour and
  // size. The cap is that colour+size count minus whatever is already in the
  // bag, so four units of "Black / M" really do stop at four.
  useEffect(() => {
    if (!product || !size) return;
    const active = product.variants[colorIdx];
    const stock = active?.sizes.find((s) => s.size === size)?.stock ?? 0;
    const bagged = cart.find(
      (i) => i.productId === product.id && i.color === active?.color && i.size === size,
    )?.qty ?? 0;
    const left = Math.max(1, Math.min(MAX_UNITS_PER_LINE, stock) - bagged);
    setQty((q) => (q > left ? left : q));
  }, [product, size, colorIdx, cart]);

  /**
   * Full-screen photo viewer.
   *
   * The operator's photos are the product, so tapping the main image has to
   * give the customer a proper look: swipe (or arrow keys) between shots, Esc
   * to close, and a locked body scroll so the page behind cannot drift. It
   * renders the same URLs already on screen, so it opens without a new fetch.
   *
   * The viewer shows EVERY photo of the product, not just the selected
   * colour's. With one photo per colour, opening a single colour's photo and
   * being unable to swipe to the others was the one place the full set was
   * unreachable — so the colour's photo is shown first, the rest follow, and
   * the customer can step through the lot without bouncing back to the swatch.
   */
  const allImages = product?.variants.flatMap(v => v.images) ?? [];
  // A colour with no units left is disabled, and its dedicated photo is left
  // out of the gallery. If every colour is sold out we keep the photos and
  // label them instead, so the page explains what is gone rather than going
  // blank. This is per product/colour, not a one-off for the last order.
  const colorSoldOut = (product?.variants ?? []).map(
    (v) => v.sizes.reduce((sum, entry) => sum + entry.stock, 0) === 0,
  );
  const allColorsSoldOut = colorSoldOut.length > 0 && colorSoldOut.every(Boolean);
  const soldOutColors = (product?.variants ?? []).filter((_, i) => colorSoldOut[i]).map((v) => v.color);
  const photoBelongsToSoldOutColor = (src: string) => {
    const owners = (product?.variants ?? [])
      .map((v, i) => (v.colorImage === src ? i : -1))
      .filter((i) => i >= 0);
    return owners.length > 0 && owners.every((i) => colorSoldOut[i]);
  };
  /**
   * Every photo of the product, in one fixed order.
   *
   * The strip on the left, the swipe strip on a phone and the full-screen
   * viewer on a desktop all show this same gallery, and it never reorders —
   * so the photo on screen only changes when the customer asks for it.
   */
  const viewerImages = allImages
    .filter((src, i) => allImages.indexOf(src) === i)
    .filter((src) => allColorsSoldOut || !photoBelongsToSoldOutColor(src));
  const viewerCount = viewerImages.length;

  /**
   * The photo that belongs to a colour.
   *
   * The operator uploads one photo per colour, so touching a swatch has to
   * swap the t-shirt on screen — that is the whole point of the swatches.
   */
  const photoIndexForColor = (i: number) => {
    const primary = product?.variants[i]?.colorImage;
    const at = primary ? viewerImages.indexOf(primary) : -1;
    return at >= 0 ? at : null;
  };

  /**
   * The colour a photo belongs to, when exactly one variant owns it.
   *
   * A shared gallery belongs to every colour at once, so it cannot move the
   * swatch — only a dedicated per-colour photo can. This is what stops a swipe
   * through an extra group shot from snapping the page back to the first
   * colour.
   */
  const colorForImage = (src?: string) => {
    if (!src) return -1;
    const owners = (product?.variants ?? [])
      .map((v, i) => (v.colorImage === src ? i : -1))
      .filter(i => i >= 0);
    return owners.length === 1 ? owners[0] : -1;
  };

  // Open on a colour that can actually be bought. Without this, a product whose
  // first colour just sold out would load on a disabled colour and a photo
  // that is no longer in the gallery.
  useEffect(() => {
    if (!product || !colorSoldOut[colorIdx]) return;
    const firstAvailable = colorSoldOut.findIndex((soldOut) => !soldOut);
    if (firstAvailable < 0) return;
    setColorIdx(firstAvailable);
    setSize(null);
    setError(null);
    const primary = product.variants[firstAvailable]?.colorImage;
    const at = primary ? viewerImages.indexOf(primary) : -1;
    setImageIdx(at >= 0 ? at : 0);
  }, [product, colorIdx, colorSoldOut, viewerImages]);

  // Stock can remove a photo from the gallery while the page is open (for
  // example, the last unit sells in another tab). Keep both the thumbnail and
  // full-screen indexes inside the shortened gallery.
  useEffect(() => {
    if (!viewerCount) return;
    setImageIdx((i) => Math.min(i, viewerCount - 1));
    setViewerIdx((i) => (i === null ? null : Math.min(i, viewerCount - 1)));
  }, [viewerCount]);

  useEffect(() => {
    if (viewerIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewerIdx(null);
      if (e.key === 'ArrowRight') setViewerIdx(i => (i === null ? i : (i + 1) % viewerCount));
      if (e.key === 'ArrowLeft') setViewerIdx(i => (i === null ? i : (i - 1 + viewerCount) % viewerCount));
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [viewerIdx, viewerCount]);

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
  // The low-stock reminder belongs on the individual product photo, not on
  // every shop card. It follows the selected colour: 1–3 units shows, while
  // 0 and 4+ stay quiet.
  const showLowStock = totalStock > 0 && totalStock <= 3;
  const lowStockLabel = totalStock === 1 ? 'Only 1 left' : `${totalStock} stock left`;
  const lowStockBadge = showLowStock ? (
    <span
      className="pointer-events-none absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-ivory/95 px-2.5 py-1 text-[10px] font-semibold leading-none text-ink shadow-card ring-1 ring-ink/10 backdrop-blur"
      title={`${variant.color}: ${totalStock} ${totalStock === 1 ? 'unit' : 'units'} left`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-burgundy" aria-hidden="true" />
      {lowStockLabel}
    </span>
  ) : null;
  const outOfStockBadge = !inStock ? (
    <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-ink/30">
      <span className="rounded-full bg-ivory/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink shadow-card ring-1 ring-ink/10 backdrop-blur">
        Out of stock
      </span>
    </span>
  ) : null;

  // Units of this exact colour+size that can still go in the bag. Stock is the
  // ceiling; anything already bagged is subtracted so the same four units
  // cannot be added twice.
  const stockForSize = size ? (variant.sizes.find((x) => x.size === size)?.stock ?? 0) : 0;
  const inBag = size
    ? cart.find((i) => i.productId === product.id && i.color === variant.color && i.size === size)?.qty ?? 0
    : 0;
  const maxAddable = size
    ? Math.max(0, Math.min(MAX_UNITS_PER_LINE, stockForSize) - inBag)
    : MAX_UNITS_PER_LINE;

  // Reviews come from the dashboard. With none published, the rating line is
  // hidden entirely rather than showing a number nothing backs it.
  const reviews = content.pdp.reviews;
  const reviewScore = reviews.length
    ? reviews.reduce((s, r) => s + Math.min(5, Math.max(0, Number(r.rating) || 0)), 0) / reviews.length
    : 0;
  const sizeGuide = content.pdp.sizeGuide;

  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 4);
  const deliveryStr = deliveryDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  const jsonLd = productJsonLd({
    name: product.name, slug: product.slug, description: product.description,
    price: product.price, mrp: product.mrp, image: variant.colorImage ?? variant.images[0],
  });
  const bcJsonLd = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: product.categories[0].replace('-', ' '), path: `/shop/${product.categories[0]}` },
    { name: product.name, path: `/product/${product.slug}` },
  ]);

  const handleAdd = (buyNow = false) => {
    if (!inStock) { setError('This product is out of stock.'); return; }
    if (!size) { setError('Please select a size first.'); return; }
    if (maxAddable === 0) {
      setError('All available units for this size are already in your bag.');
      return;
    }
    setError(null);
    addToCart({ productId: product.id, color: variant.color, size, qty: Math.min(qty, maxAddable) });
    if (buyNow) { navigate('/checkout'); return; }
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  /**
   * Move to a colour.
   *
   * Shared by every way a colour gets picked — a swatch, a thumbnail or a
   * swipe of the photo strip — so the swatch, the photo and the size list
   * always land together.
   */
  const applyColor = (i: number) => {
    if (i === colorIdx) return;
    // A sold-out colour cannot be selected, so its photo is never shown.
    if (colorSoldOut[i]) return;
    setColorIdx(i);
    // The size picked for the old colour may be sold out on the new one, in
    // which case it cannot stay selected.
    const sold = product.variants[i]?.sizes.find((s) => s.size === size);
    if (size && (!sold || sold.stock === 0)) { setSize(null); setError(null); }
  };

  /**
   * Pick a photo.
   *
   * The photos sit in the same order as the colours, so a photo IS a colour:
   * picking photo two lights up the black swatch and shows the black sizes,
   * whether the customer got there by swiping the strip, tapping a thumbnail
   * or opening the full-screen viewer. A photo that belongs to no colour
   * (a product with more shots than colours) leaves the swatch where it is.
   *
   * On a phone the photos live in one scrolling strip, so picking a thumbnail
   * scrolls that strip to the photo. There is no full-screen overlay on a
   * phone: the page keeps scrolling the way the customer expects.
   */
  const selectImage = (i: number) => {
    setImageIdx(i);
    const color = colorForImage(viewerImages[i]);
    if (color >= 0) applyColor(color);
    const strip = carouselRef.current;
    if (strip) strip.scrollTo({ left: i * strip.clientWidth, behavior: 'smooth' });
  };

  const selectColor = (i: number) => {
    // A sold-out colour cannot be selected, so its photo is never shown.
    if (colorSoldOut[i]) return;
    // The colour itself must change even when the operator has not given it a
    // dedicated photo. The photo swap is a bonus, not the source of the state.
    applyColor(i);
    const at = photoIndexForColor(i);
    if (at === null) return;
    setImageIdx(at);
    const strip = carouselRef.current;
    if (strip) strip.scrollTo({ left: at * strip.clientWidth, behavior: 'smooth' });
  };

  /**
   * Keep the swatch in step with the strip.
   *
   * The customer swipes the photos the way they read a book, so the swatch
   * has to follow along: swipe to photo two and the swatch that photo belongs
   * to lights up, with its own sizes underneath. Whatever the customer does —
   * tap a swatch, tap a thumbnail or swipe — picture, swatch and sizes agree.
   */
  const onStripScroll = () => {
    const strip = carouselRef.current;
    if (!strip || !viewerCount) return;
    const i = Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
    if (i < 0 || i >= viewerCount || i === imageIdx) return;
    setImageIdx(i);
    const color = colorForImage(viewerImages[i]);
    if (color >= 0) applyColor(color);
  };

  return (
    <div className="page-container py-6 md:py-10 pb-24 md:pb-10">
      <SEO title={product.name} description={product.description} jsonLd={[jsonLd, bcJsonLd]} />
      <nav className="flex items-center gap-1.5 text-xs text-ink/65 mb-6 flex-wrap">
        <Link to="/home" className="hover:text-ink">Home</Link>
        <ChevronRight size={12} />
        <Link to={`/shop/${product.categories[0]}`} className="hover:text-ink capitalize">{product.categories[0].replace('-', ' ')}</Link>
        <ChevronRight size={12} />
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Gallery — min-w-0 all the way down. A grid/flex item defaults to
            `min-width:auto`, so the thumbnail rail's fixed 5 x 80px content
            was forcing this column to 448px. On a 360-390px phone that made
            the whole document 480px wide: everything right of the screen got
            cut off (prices, size buttons, badges) and the page read as
            "zoomed in". Each level now shrinks to the screen and the rail
            scrolls inside its own box. */}
        <div className="flex flex-col-reverse md:flex-row gap-3 md:gap-4 min-w-0">
          {/* Left column: every photo of the product, so the t-shirt can be
              seen from every angle without leaving the page. */}
          <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-visible no-scrollbar min-w-0">
            {viewerImages.map((img, i) => (
              <button key={img + i} onClick={() => selectImage(i)}
                className={`shrink-0 w-20 h-24 rounded overflow-hidden border-2 transition ${imageIdx === i ? 'border-ink' : 'border-transparent hover:border-ink/30'}`}>
                <img src={img} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
              </button>
            ))}
          </div>

          {/* Phone: one strip of photos, swiped in place. The page scrolls
              normally — nothing takes over the screen. */}
          <div className="md:hidden -mx-4">
            <div className="relative">
              <div
                ref={carouselRef}
                onScroll={onStripScroll}
                className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
              >
                {viewerImages.map((img, i) => (
                  <img
                    key={img + i}
                    src={img}
                    alt={`${product.name} ${i + 1}`}
                    className="w-full shrink-0 snap-center aspect-[3/4] object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                ))}
              </div>
              {lowStockBadge}
              {outOfStockBadge}
            </div>
            {viewerCount > 1 && (
              <p className="text-[11px] text-ink/65 text-center mt-2">Swipe for more photos</p>
            )}
          </div>

          {/* Desktop: one photo at a time, tap for the full-screen viewer. */}
          <div className="hidden md:block flex-1 relative overflow-hidden rounded-xl bg-stone/30 aspect-[3/4]">
            <AnimatePresence mode="wait">
              <motion.img
                key={`${colorIdx}-${imageIdx}`}
                src={viewerImages[imageIdx] ?? variant.images[0]}
                alt={product.name}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
                className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
                onClick={() => setViewerIdx(imageIdx)}
                role="button"
                tabIndex={0}
                title="Tap to view full screen"
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewerIdx(imageIdx); } }}
              />
            </AnimatePresence>
            {lowStockBadge}
            {outOfStockBadge}
            {/* Affordance so a tap-to-zoom is discoverable rather than secret.
                When the product has more photos than the selected colour shows,
                the count is spelled out so the customer knows the rest of the
                gallery is one tap away. */}
            {viewerCount > 0 && (
              <button
                type="button"
                onClick={() => setViewerIdx(imageIdx)}
                aria-label="View photos full screen"
                className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-ivory/90 backdrop-blur px-3 py-2 text-[11px] font-medium text-ink shadow-sm hover:bg-ivory transition"
              >
                <Maximize2 size={13} />
                Full screen
                {viewerCount > 1 && (
                  <span className="text-ink/65">
                    {viewerCount} photos
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="md:py-4">
          <div className="flex items-center gap-2 mb-3">
            {product.badge && (
              <span className="text-[10px] font-semibold tracking-wider uppercase bg-ink text-ivory px-2 py-1 rounded">{product.badge}</span>
            )}
            {/* Fit and fabric are operator-supplied, so an unset field is hidden
                rather than rendering an empty "Fit ·" line. */}
            {(product.fit || product.fabric) && (
              <span className="text-xs text-ink/65 capitalize">
                {[product.fit ? `${product.fit} fit` : null, product.fabric].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold leading-tight">{product.name}</h1>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-2xl font-semibold">{formatINR(product.price)}</span>
            {hasDiscount && <><span className="text-ink/65 line-through">{formatINR(product.mrp)}</span><span className="text-sm font-semibold text-lime bg-ink px-2 py-0.5 rounded">{discountPercent(product)}% off</span></>}
          </div>
          <p className="text-xs text-ink/65 mt-1">MRP inclusive of all taxes</p>

          {/* Rating + stock — the score is the average of the operator's own
              published reviews; with none, only stock state shows. */}
          <div className="mt-3 flex items-center gap-4">
            {reviews.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-0.5" role="img" aria-label={`${reviewScore.toFixed(1)} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={14} className={i <= Math.round(reviewScore) ? 'fill-ink text-ink' : 'fill-ink/20 text-ink/20'} />
                  ))}
                </div>
                <span className="text-xs text-ink/60">
                  {reviewScore.toFixed(1)} ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                </span>
              </div>
            )}
            {inStock ? (
              <span className="text-xs font-medium text-green-700 flex items-center gap-1"><Check size={14} /> In stock</span>
            ) : (
              <span className="text-xs font-medium text-red-600">Out of stock</span>
            )}
          </div>

          {/* Delivery estimate */}
          <div className="mt-3 flex items-center gap-2 text-xs text-ink/60">
            <Truck size={16} className="text-ink/65" />
            <span>Estimated delivery by <span className="font-medium text-ink">{deliveryStr}</span> — {settingsReady ? freeShippingLabel(settings, formatINR) : 'shipping calculated at checkout'}</span>
          </div>

          {/* Colour */}
          <div className="mt-7">
            <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">Colour: <span className="text-ink/60">{variant.color}</span></span></div>
            <div className="flex gap-2">
              {product.variants.map((v, i) => {
                const soldOut = colorSoldOut[i];
                return (
                  <button key={v.color} onClick={() => selectColor(i)} title={soldOut ? `${v.color} — sold out` : v.color}
                    disabled={soldOut}
                    className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 transition ${colorIdx === i ? 'border-ink ring-2 ring-ink/10' : 'border-ink/15'} ${soldOut ? 'opacity-40 cursor-not-allowed' : ''}`}
                    style={{ backgroundColor: v.hex }} aria-label={soldOut ? `${v.color} sold out` : v.color}>
                    {/* Strike-through marks the sold-out colour without relying
                        on the faded swatch alone, so it reads at a glance. */}
                    {soldOut && (
                      <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                        <span className="block w-full h-[2px] bg-ink/70 rotate-45 rounded-full" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {soldOutColors.length > 0 && (
              <p className="mt-2 text-[11px] text-ink/55">
                Out of stock: <span className="text-ink/70">{soldOutColors.join(', ')}</span>
              </p>
            )}
          </div>

          {/* Size */}
          <div className="mt-7">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Select size</span>
              {sizeGuide.length > 1 && (
                <button onClick={() => setShowSizeGuide(true)} className="text-xs text-ink/60 hover:text-ink inline-flex items-center gap-1"><Ruler size={14} /> Size guide</button>
              )}
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
          <div className="mt-7">
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-ink/15 rounded-full">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  disabled={!size}
                  aria-label="Decrease quantity"
                  className="w-10 h-10 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                ><Minus size={16} /></button>
                <span className="w-8 text-center text-sm">{qty}</span>
                <button
                  onClick={() => setQty(q => Math.min(Math.max(1, maxAddable), q + 1))}
                  disabled={!size || qty >= maxAddable}
                  aria-label="Increase quantity"
                  className="w-10 h-10 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                ><Plus size={16} /></button>
              </div>
              <button onClick={() => toggleWishlist(product.id)}
                className={`w-12 h-12 rounded-full border flex items-center justify-center transition ${wished ? 'border-red-600 bg-red-50 text-red-600' : 'border-ink/15 text-red-600 hover:border-red-600'}`}
                aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}>
                <Heart size={20} fill={wished ? 'currentColor' : 'none'} />
              </button>
            </div>
            {!size && (
              <p className="mt-2 text-[11px] text-ink/50">Select a size to choose quantity.</p>
            )}
            {size && maxAddable <= 5 && (
              <p className={`mt-2 text-[11px] ${maxAddable === 0 ? 'text-burgundy' : 'text-ink/60'}`}>
                {maxAddable === 0
                  ? 'All available units for this size are already in your bag.'
                  : qty >= maxAddable
                    ? inBag > 0
                      ? `Maximum available for this size: ${maxAddable} more (${inBag} already in your bag).`
                      : `Maximum available for this size: ${maxAddable}.`
                    : `Only ${maxAddable} available in this size.`}
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            {inStock ? (
              <>
                <button onClick={() => handleAdd(false)}
                  className="flex-1 py-4 rounded-full bg-ink text-ivory font-semibold hover:bg-ink/80 transition relative overflow-hidden">
                  {added ? <span className="inline-flex items-center gap-2"><Check size={18} /> Added to bag</span> : 'Add to Cart'}
                </button>
                <button onClick={() => handleAdd(true)}
                  className="flex-1 py-4 rounded-full bg-lime text-ink font-semibold hover:bg-lime/90 transition">
                  Buy Now
                </button>
              </>
            ) : (
              <button type="button" disabled
                className="flex-1 py-4 rounded-full bg-ink/40 text-ivory font-semibold cursor-not-allowed">
                Out of stock
              </button>
            )}
          </div>

          {/* Promises — copy typed in Admin → Content; the glyph set is code */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {content.pdp.promises.slice(0, 3).map((promise, i) => {
              const Icon = [Truck, RefreshCw, ShieldCheck][i % 3];
              return (
                <div key={`${promise}-${i}`} className="p-3 rounded-lg border border-ink/8">
                  <Icon size={18} className="mx-auto mb-1" />
                  <p className="text-[11px] text-ink/60">{promise}</p>
                </div>
              );
            })}
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
                  className={`text-sm font-medium capitalize border-b-2 pb-1 transition ${activeTab === t ? 'border-ink' : 'border-transparent text-ink/65 hover:text-ink'}`}>
                  {t === 'shipping' ? 'Delivery & Returns' : t === 'care' ? 'Fabric & Care' : 'Description'}
                </button>
              ))}
            </div>
            <div className="text-sm text-ink/70 leading-relaxed space-y-2">
              {activeTab === 'description' && (
                <div>
                  {product.description && <p>{product.description}</p>}
                  {/* Operator fields: an unset one is omitted, not shown blank. */}
                  {product.fit && <p className="mt-2"><span className="font-medium text-ink">Fit:</span> {product.fit}</p>}
                  {product.fabric && <p><span className="font-medium text-ink">Fabric:</span> {product.fabric}</p>}
                </div>
              )}
              {activeTab === 'care' && (
                <div>
                  {product.fabric && <p><span className="font-medium text-ink">Fabric:</span> {product.fabric}</p>}
                  {product.care
                    ? <p><span className="font-medium text-ink">Care:</span> {product.care}</p>
                    : <p className="text-ink/65">Care instructions have not been added for this piece yet.</p>}
                </div>
              )}
              {activeTab === 'shipping' && (
                <div>
                  <p>
                    {settingsReady
                      ? `${freeShippingLabel(settings, formatINR)}. Standard delivery in 3–5 business days across India.${settings.freeShippingThreshold > 0 && settings.shippingFee > 0
                        ? ` A flat fee of ${formatINR(settings.shippingFee)} applies below the free-shipping threshold.`
                        : ''}`
                      : 'Shipping is calculated at checkout. Standard delivery in 3–5 business days across India.'}
                  </p>
                  <p>{content.pdp.returnsLine}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer reviews — the operator's own; the section is hidden until
          at least one has been published from the dashboard. */}
      {reviews.length > 0 && (
        <section className="mt-16 border-t border-ink/10 pt-10">
          <div className="flex items-baseline gap-3 mb-6">
            <h2 className="font-display text-xl md:text-2xl font-semibold">Customer Reviews</h2>
            <span className="text-sm text-ink/65">{reviewScore.toFixed(1)} / 5 · {reviews.length}</span>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {reviews.map((r, i) => (
              <div key={`${r.name}-${i}`} className="p-5 rounded-xl border border-ink/8">
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} size={14} className={j < Math.min(5, Math.max(0, Number(r.rating) || 0)) ? 'fill-ink text-ink' : 'fill-ink/15 text-ink/15'} />
                  ))}
                </div>
                <p className="text-sm text-ink/70 leading-relaxed">{r.text}</p>
                <p className="text-xs text-ink/65 mt-3">{r.name} · Verified purchase</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display text-xl md:text-2xl md:text-3xl font-semibold mb-8">You may also like</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-5 lg:gap-x-8 lg:gap-y-12">
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
                    <tr key={i} className={i === 0 ? 'text-ink/65 text-xs uppercase' : 'border-t border-ink/5'}>
                      {row.map((cell, j) => <td key={j} className={j === 0 ? 'font-medium py-2' : 'py-2'}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>              <button onClick={() => setShowSizeGuide(false)} className="mt-5 w-full py-3 rounded-full bg-ink text-ivory text-sm font-medium">Got it</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen photo viewer — opened by tapping the main image */}
      <AnimatePresence>
        {viewerIdx !== null && viewerCount > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] bg-ink flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={`${product.name} photos`}
          >
            <div className="flex items-center justify-between px-4 py-3 text-ivory shrink-0">
              <span className="text-xs text-ivory/70">
                {viewerIdx + 1} / {viewerCount}
              </span>
              <button
                type="button"
                onClick={() => setViewerIdx(null)}
                aria-label="Close full screen"
                className="w-10 h-10 rounded-full bg-ivory/10 hover:bg-ivory/20 grid place-items-center transition"
              >
                <X size={20} />
              </button>
            </div>

            <motion.div
              key={viewerIdx}
              className="flex-1 relative overflow-hidden"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) setViewerIdx(i => (i === null ? i : (i + 1) % viewerCount));
                if (info.offset.x > 60) setViewerIdx(i => (i === null ? i : (i - 1 + viewerCount) % viewerCount));
              }}
            >
              <img
                src={viewerImages[viewerIdx]}
                alt={`${product.name} photo ${viewerIdx + 1}`}
                // Full-size, top priority: this is the image the customer asked
                // to study, so it must not wait behind anything else.
                fetchPriority="high"
                className="w-full h-full object-contain select-none"
                draggable={false}
              />
            </motion.div>

            {/* Tappable arrows — swipe works, but an explicit control is what
                makes "there are more photos" obvious on a phone. */}
            {viewerCount > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setViewerIdx(i => (i === null ? i : (i - 1 + viewerCount) % viewerCount))}
                  aria-label="Previous photo"
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-ivory/15 hover:bg-ivory/30 backdrop-blur grid place-items-center text-ivory transition"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewerIdx(i => (i === null ? i : (i + 1) % viewerCount))}
                  aria-label="Next photo"
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-ivory/15 hover:bg-ivory/30 backdrop-blur grid place-items-center text-ivory transition"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}

            {viewerCount > 1 && (
              <div className="shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                <div className="flex gap-2 overflow-x-auto no-scrollbar justify-start sm:justify-center">
                  {viewerImages.map((img, i) => (
                    <button
                      key={`${img}-${i}`}
                      type="button"
                      onClick={() => setViewerIdx(i)}
                      aria-label={`Show photo ${i + 1}`}
                      className={`shrink-0 w-12 h-14 rounded overflow-hidden border-2 transition ${i === viewerIdx ? 'border-lime' : 'border-ivory/20'}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>

                {/* Colour switch inside the viewer, so a customer comparing two
                    colourways never has to close it and hunt for the swatch. */}
                {product.variants.length > 1 && (
                  <div className="flex items-center justify-center gap-2.5 mt-3">
                    {product.variants.map((v, i) => {
                      const soldOut = colorSoldOut[i];
                      return (
                        <button
                          key={v.color}
                          type="button"
                          disabled={soldOut}
                          onClick={() => {
                            selectColor(i);
                            setViewerIdx(photoIndexForColor(i) ?? 0);
                          }}
                          aria-label={soldOut ? `${v.color} sold out` : `Show ${v.color}`}
                          title={soldOut ? `${v.color} — sold out` : v.color}
                          className={`relative w-7 h-7 rounded-full border-2 transition ${colorIdx === i ? 'border-lime' : 'border-ivory/25'} ${soldOut ? 'opacity-40 cursor-not-allowed' : ''}`}
                          style={{ backgroundColor: v.hex }}
                        >
                          {soldOut && (
                            <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                              <span className="block w-full h-[2px] bg-ivory/80 rotate-45 rounded-full" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="hidden sm:flex items-center justify-center gap-6 mt-3 text-ivory/50 text-[11px]">
                  <span className="inline-flex items-center gap-1"><ChevronLeft size={13} /> Swipe or press ← →</span>
                  <span>Esc to close</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile sticky add bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-ivory border-t border-ink/10 p-3 flex items-center gap-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-ink/60 truncate">{product.name}</p>
          <p className="text-sm font-semibold">{formatINR(product.price)}</p>
        </div>
        <button onClick={() => handleAdd(false)} disabled={!inStock}
          className={`px-6 py-3.5 rounded-full text-sm font-semibold min-h-11 ${inStock ? 'bg-ink text-ivory' : 'bg-ink/40 text-ivory cursor-not-allowed'}`}>
          {!inStock ? 'Out of stock' : added ? 'Added' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}

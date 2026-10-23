import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Plus, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type Product, formatINR, SIZES } from '@/data/catalog';
import { useStore } from '@/store/StoreContext';
import { EASE } from '@/components/Motion';

interface Props {
  product: Product;
}

/* Clean, editorial badges — mostly monochrome with a lime accent for "New". */
const badgeStyles: Record<string, string> = {
  Bestseller: 'bg-ink text-ivory',
  New: 'bg-lime text-ink',
  Limited: 'bg-ink text-ivory',
  Essential: 'bg-ivory text-ink',
  Street: 'bg-ivory text-ink',
  Graphic: 'bg-ivory text-ink',
};

export default function ProductCard({ product }: Props) {
  const { toggleWishlist, isWishlisted, addToCart } = useStore();
  const wished = isWishlisted(product.id);
  const [activeColor, setActiveColor] = useState(0);
  const v = product.variants[activeColor] ?? product.variants[0];
  // The selected colour's photo leads, then the rest of the gallery follows.
  const gallery = Array.from(new Set([...(v.colorImage ? [v.colorImage] : []), ...v.images])).slice(0, 5);
  const hasDiscount = product.mrp > product.price;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [addedSize, setAddedSize] = useState<string | null>(null);

  const stockOf = (size: string) => v.sizes.find(x => x.size === size)?.stock ?? 0;

  const handleQuickAdd = (size: string) => {
    addToCart({ productId: product.id, color: v.color, size, qty: 1 });
    setSheetOpen(false);
    setAddedSize(size);
    window.setTimeout(() => setAddedSize(null), 2000);
  };

  return (
    <div className="group">
      {/* Image + overlays share one stacking context so the quick-add stays on the image */}
      <div className="relative">
        <Link
          to={`/product/${product.slug}`}
          className="block relative overflow-hidden bg-stone/50 aspect-[3/4]"
        >
          {gallery.map((img, i) => (
            <img
              key={`${img}-${i}`}
              src={img}
              alt={`${product.name} ${v.color} view ${i + 1}`}
              className={`absolute inset-0 w-full h-full object-cover object-top transition-all duration-[350ms] ease-out group-hover:scale-[1.02] ${i === 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              style={{
                transitionDelay: `${i * 50}ms`,
                objectPosition: 'center top'
              }}
              loading="lazy"
            />
          ))}

          {/* Badge — top left, clean pill. Only rendered when set, so a
              dashboard product without a badge shows no empty pill. */}
          {product.badge && (
            <span
              className={`absolute top-2.5 left-2.5 z-[5] rounded-full px-[11px] py-[5px] text-[9px] font-bold uppercase leading-none tracking-[0.09em] ${badgeStyles[product.badge] ?? 'bg-ivory text-ink'}`}
            >
              {product.badge}
            </span>
          )}
        </Link>

        {/* Quick add — circular "+" (desktop + mobile), expands into the animated size card.
            On phones it sits higher up so it isn't crowded against the card's text below. */}
        <div className="absolute inset-x-2.5 bottom-8 z-10 md:bottom-2.5">
          <AnimatePresence mode="wait" initial={false}>
            {sheetOpen ? (
              <motion.div
                key="size-card"
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="origin-bottom-right rounded-2xl bg-ivory/95 p-2.5 shadow-lift backdrop-blur"
              >
                <div className="mb-2 flex items-start justify-between gap-2 px-0.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-ink">Select size</p>
                    <p className="truncate text-[10px] uppercase tracking-[0.04em] text-ink/65">{v.color} · {product.name}</p>
                  </div>
                  <button
                    onClick={() => setSheetOpen(false)}
                    aria-label="Close size picker"
                    className="shrink-0 text-ink/65 transition-colors hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {SIZES.map((s, i) => {
                    const oos = stockOf(s) === 0;
                    return (
                      <motion.button
                        key={s}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 + i * 0.035, duration: 0.3, ease: EASE }}
                        disabled={oos}
                        onClick={() => handleQuickAdd(s)}
                        aria-label={oos ? `${s} out of stock` : `Add size ${s} to bag`}
                        className={`h-9 rounded-md text-xs font-semibold transition-colors duration-200 ${
                          oos
                            ? 'text-ink/25 cursor-not-allowed line-through'
                            : 'text-ink hover:bg-ink hover:text-ivory active:bg-ink active:text-ivory'
                        }`}
                      >
                        {s}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <div className="flex justify-end">
                <motion.button
                  key="quick-add"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => setSheetOpen(true)}
                  aria-label="Quick add — choose a size"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-ivory/95 text-ink shadow-card backdrop-blur transition-all duration-200 hover:scale-110 hover:bg-ink hover:text-ivory active:scale-95"
                >
                  {addedSize ? <Check size={16} /> : <Plus size={16} />}
                </motion.button>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Wishlist — subtle, top right */}
        <button
          onClick={() => toggleWishlist(product.id)}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute top-2.5 right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ivory/75 backdrop-blur-sm transition-all duration-200 active:scale-90 ${wished ? 'text-burgundy' : 'text-ink/70 hover:text-ink'}`}
        >
          <Heart size={16} fill={wished ? 'currentColor' : 'none'} />
        </button>

        {/* Added confirmation toast */}
        <AnimatePresence>
          {addedSize && (
            <motion.span
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-ink px-3 py-1.5 text-[11px] font-medium text-ivory shadow-card"
            >
              Added · Size {addedSize}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Product info — the anatomy a luxury catalogue uses: a collection
          micro-line, the name in small tracked caps, the price with the offer
          stated plainly, then the swatches the dashboard actually painted. */}
      <div className="pt-3">
        <Link to={`/product/${product.slug}`} className="block group/text">
          {product.categories[0] && (
            <span className="mb-1 block text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-ink/65 transition-colors group-hover/text:text-ink/75">
              {product.categories[0].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </span>
          )}
          <span className="line-clamp-2 block text-[12.5px] font-medium uppercase leading-[1.35] tracking-[0.1em] text-ink transition-colors hover:text-ink/60">
            {product.name}
          </span>
        </Link>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-[13px] font-bold text-ink">{formatINR(product.price)}</span>
          {hasDiscount && (
            <>
              <span className="text-xs text-ink/65 line-through">{formatINR(product.mrp)}</span>
              <span className="text-[10px] font-bold tracking-wide text-ink/65">
                {Math.round(((product.mrp - product.price) / product.mrp) * 100)}% OFF
              </span>
            </>
          )}
        </div>
        {(product.fit || product.fabric) && (
          <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-[0.08em] text-ink/65">
            {[product.fit ? `${product.fit} fit` : null, product.fabric].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-start gap-2" role="group" aria-label="Colours and stock remaining">
          {product.variants.map((variant, i) => {
            const colorStock = variant.sizes.reduce(
              (sum, entry) => sum + Math.max(0, Math.floor(Number(entry.stock) || 0)),
              0,
            );
            const low = colorStock > 0 && colorStock <= 3;
            const stockText =
              colorStock === 0
                ? 'Sold out'
                : colorStock === 1
                  ? 'Only 1'
                  : `${colorStock} left`;
            return (
              <button
                key={variant.color}
                type="button"
                onClick={() => setActiveColor(i)}
                aria-label={`${variant.color}: ${colorStock === 0 ? 'sold out' : `${colorStock} left`}`}
                aria-pressed={activeColor === i}
                title={`${variant.color} — ${colorStock === 0 ? 'sold out' : `${colorStock} left`}`}
                className="flex flex-col items-center gap-1 rounded-md px-0.5 py-0.5 transition-transform hover:-translate-y-0.5 active:scale-95"
              >
                <span
                  className={`block h-2.5 w-2.5 rounded-full transition-shadow ${colorStock === 0 ? 'opacity-35' : ''} ${activeColor === i ? 'ring-2 ring-ink ring-offset-1' : 'ring-1 ring-inset ring-ink/25'}`}
                  style={{ backgroundColor: variant.hex }}
                />
                <span
                  className={`inline-flex min-w-[25px] items-center justify-center whitespace-nowrap rounded-full px-1 py-0.5 text-[8px] font-bold leading-none ${
                    colorStock === 0
                      ? 'bg-ink/5 text-ink/30'
                      : low
                        ? 'bg-burgundy/10 text-burgundy'
                        : 'bg-ink/5 text-ink/55'
                  }`}
                  aria-hidden="true"
                >
                  {stockText}
                </span>
              </button>
            );
          })}
          <span className="ml-0.5 self-center text-[9px] font-semibold uppercase tracking-[0.08em] text-ink/65">
            {v.color}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ProductCardMotion({ product, index = 0 }: Props & { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.05 }}
    >
      <ProductCard product={product} />
    </motion.div>
  );
}

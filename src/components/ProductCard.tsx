import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Plus, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type Product, formatINR, discountPercent, SIZES } from '@/data/catalog';
import { useStore } from '@/store/StoreContext';
import { EASE } from '@/components/Motion';

interface Props {
  product: Product;
}

const badgeStyles: Record<string, string> = {
  Bestseller: 'bg-ink text-ivory',
  New: 'bg-lime text-ink',
  Limited: 'bg-burgundy text-ivory',
  Essential: 'bg-stone text-ink',
  Street: 'bg-ink text-lime',
  Graphic: 'bg-cobalt text-ivory',
};

export default function ProductCard({ product }: Props) {
  const { toggleWishlist, isWishlisted, addToCart } = useStore();
  const wished = isWishlisted(product.id);
  const v = product.variants[0];
  const hasDiscount = product.mrp > product.price;
  const hasSecondImage = v.images.length > 1;

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
      {/* Image + overlays share one stacking context so the quick-add stays on the image
          (previously it was absolute to the whole card and covered the title/price on mobile) */}
      <div className="relative">
        <Link
          to={`/product/${product.slug}`}
          className="block relative overflow-hidden bg-stone/40 rounded-2xl aspect-[3/4] shadow-soft transition-shadow duration-500 ease-smooth group-hover:shadow-lift"
        >
          <img
            src={v.images[0]}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            loading="lazy"
          />
          {hasSecondImage && (
            <img
              src={v.images[1]}
              alt={`${product.name} alternate view`}
              className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out"
              loading="lazy"
              decoding="async"
            />
          )}

          {/* Badge — top left */}
          <span
            className={`absolute top-3 left-3 text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full ${badgeStyles[product.badge] ?? 'bg-ink text-ivory'}`}
          >
            {product.badge}
          </span>

          {/* Discount — top right area, below wishlist */}
          {hasDiscount && (
            <span className="absolute top-14 right-3 bg-lime text-ink text-[10px] font-bold px-2 py-1 rounded-full">
              {discountPercent(product)}% OFF
            </span>
          )}
        </Link>

        {/* Quick add — DESKTOP: inline size tray revealed on hover, chips stagger in */}
        <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-10 hidden md:block">
          <div className="pointer-events-auto invisible grid grid-cols-3 gap-1 rounded-xl bg-ivory/95 p-1.5 opacity-0 shadow-card backdrop-blur translate-y-[140%] transition-all duration-300 ease-smooth group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
            {SIZES.map((s, i) => {
              const oos = stockOf(s) === 0;
              const done = addedSize === s;
              return (
                <span
                  key={s}
                  style={{ transitionDelay: `${i * 25}ms` }}
                  className="translate-y-2 opacity-0 transition-all duration-300 ease-smooth group-hover:translate-y-0 group-hover:opacity-100"
                >
                  <button
                    disabled={oos}
                    onClick={() => handleQuickAdd(s)}
                    aria-label={oos ? `${s} out of stock` : `Add size ${s} to bag`}
                    className={`w-full h-8 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                      done
                        ? 'bg-lime text-ink'
                        : oos
                          ? 'text-ink/25 cursor-not-allowed line-through'
                          : 'text-ink hover:bg-ink hover:text-ivory'
                    }`}
                  >
                    <span className="flex items-center justify-center">{done ? <Check size={14} /> : s}</span>
                  </button>
                </span>
              );
            })}
          </div>
        </div>

        {/* Quick add — MOBILE: the bar expands into a full size card (same 3-col order as desktop) */}
        <div className="absolute inset-x-2.5 bottom-2.5 z-10 md:hidden">
          <AnimatePresence mode="wait" initial={false}>
            {sheetOpen ? (
              <motion.div
                key="size-card"
                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="origin-bottom rounded-2xl bg-ivory/95 p-2.5 shadow-lift backdrop-blur"
              >
                <div className="mb-2 flex items-start justify-between gap-2 px-0.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-ink">Select size</p>
                    <p className="truncate text-[10px] text-ink/45">{product.name} · {v.color}</p>
                  </div>
                  <button
                    onClick={() => setSheetOpen(false)}
                    aria-label="Close size picker"
                    className="shrink-0 text-ink/40 transition-colors hover:text-ink"
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
                        className={`h-9 rounded-lg text-xs font-semibold transition-colors duration-200 ${
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
              <motion.button
                key="quick-add"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setSheetOpen(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-ivory/95 py-2.5 text-xs font-semibold text-ink shadow-soft backdrop-blur transition-transform duration-200 active:scale-[0.98]"
              >
                {addedSize ? <><Check size={14} /> Added — {addedSize}</> : <><Plus size={14} /> Quick Add</>}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Wishlist — always visible, top right */}
        <button
          onClick={() => toggleWishlist(product.id)}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-ivory/90 backdrop-blur flex items-center justify-center hover:bg-ivory active:scale-90 transition-all duration-200 ${wished ? 'text-burgundy' : 'text-ink'}`}
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

      {/* Product info */}
      <div className="mt-2.5">
        <Link
          to={`/product/${product.slug}`}
          className="text-sm font-medium leading-snug hover:text-ink/60 line-clamp-1"
        >
          {product.name}
        </Link>
        <p className="text-[11px] text-ink/45 mt-0.5">{product.fit} fit · {product.fabric}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-semibold">{formatINR(product.price)}</span>
          {hasDiscount && <span className="text-xs text-ink/40 line-through">{formatINR(product.mrp)}</span>}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          {product.variants.slice(0, 4).map(variant => (
            <span
              key={variant.color}
              title={variant.color}
              className="w-3.5 h-3.5 rounded-full border border-ink/15"
              style={{ backgroundColor: variant.hex }}
            />
          ))}
          {product.variants.length > 4 && (
            <span className="text-[10px] text-ink/40 ml-0.5">+{product.variants.length - 4}</span>
          )}
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

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Plus, Check } from 'lucide-react';
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
    <div className="group relative">
      {/* Image container — dominant visual area */}
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

      {/* Quick add — DESKTOP: one-tap inline size tray revealed on hover */}
      <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-10 hidden md:block">
        <div className="pointer-events-auto grid grid-cols-3 gap-1 rounded-xl bg-ivory/95 p-1.5 shadow-card backdrop-blur translate-y-[140%] opacity-0 transition-all duration-300 ease-smooth group-hover:translate-y-0 group-hover:opacity-100">
          {SIZES.map(s => {
            const oos = stockOf(s) === 0;
            const done = addedSize === s;
            return (
              <button
                key={s}
                disabled={oos}
                onClick={() => handleQuickAdd(s)}
                aria-label={oos ? `${s} out of stock` : `Add size ${s} to bag`}
                className={`h-8 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                  done
                    ? 'bg-lime text-ink'
                    : oos
                      ? 'text-ink/25 cursor-not-allowed line-through'
                      : 'text-ink hover:bg-ink hover:text-ivory'
                }`}
              >
                <span className="flex items-center justify-center">{done ? <Check size={14} /> : s}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick add — MOBILE: always-visible action → bottom sheet */}
      <button
        onClick={() => setSheetOpen(true)}
        className="md:hidden absolute inset-x-2.5 bottom-2.5 z-10 flex items-center justify-center gap-1.5 rounded-xl bg-ivory/95 py-2.5 text-xs font-semibold text-ink shadow-soft backdrop-blur transition-transform duration-200 active:scale-[0.98]"
      >
        {addedSize ? <><Check size={14} /> Added — {addedSize}</> : <><Plus size={14} /> Quick Add</>}
      </button>

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

      {/* Mobile size sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm md:hidden"
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-ivory p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:hidden"
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-ink/15" />
              <h3 className="font-display text-lg font-semibold">Select size</h3>
              <p className="mt-1 mb-4 text-xs text-ink/50">{product.name} · {v.color}</p>
              <div className="grid grid-cols-3 gap-2">
                {SIZES.map(s => {
                  const oos = stockOf(s) === 0;
                  return (
                    <button
                      key={s}
                      disabled={oos}
                      onClick={() => handleQuickAdd(s)}
                      className={`h-12 rounded-xl text-sm font-medium border transition duration-200 ${
                        oos
                          ? 'border-ink/10 text-ink/30 cursor-not-allowed line-through'
                          : 'border-ink/20 hover:border-ink hover:bg-ink hover:text-ivory'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setSheetOpen(false)} className="mt-4 w-full py-2 text-sm text-ink/50 hover:text-ink transition-colors">
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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

import { Link } from 'react-router-dom';
import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, resolveProduct } from '@/store/StoreContext';
import { formatINR } from '@/data/catalog';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: Props) {
  const { cart, subtotal, updateQty, removeFromCart, cartCount } = useStore();
  const shipping = subtotal > 1499 || subtotal === 0 ? 0 : 79;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/40 z-[55]" onClick={onClose} />
          <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed top-0 right-0 bottom-0 w-[420px] max-w-[100vw] sm:max-w-[92vw] bg-ivory z-[55] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-ink/10">
              <h3 className="font-display text-lg font-semibold">Your Bag ({cartCount})</h3>
              <button onClick={onClose} aria-label="Close cart"><X size={22} /></button>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <ShoppingBag size={40} className="text-ink/30" />
                <p className="text-ink/60">Your bag is empty.</p>
                <Link to="/shop/shop-all" onClick={onClose}
                  className="bg-ink text-ivory px-6 py-3 rounded-full text-sm font-medium hover:bg-ink/80">
                  Start Shopping
                </Link>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {cart.map(item => {
                    const p = resolveProduct(item.productId);
                    if (!p) return null;
                    const v = p.variants.find(x => x.color === item.color);
                    return (
                      <div key={`${item.productId}-${item.color}-${item.size}`} className="flex gap-4">
                        <Link to={`/product/${p.slug}`} onClick={onClose} className="shrink-0">
                          <img src={v?.images[0]} alt={p.name} className="w-20 h-24 object-cover rounded" />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link to={`/product/${p.slug}`} onClick={onClose} className="text-sm font-medium hover:text-ink/60">{p.name}</Link>
                          <p className="text-xs text-ink/50 mt-0.5">{item.color} · {item.size}</p>
                          <p className="text-sm font-semibold mt-1">{formatINR(p.price)}</p>
                          <div className="mt-2 flex items-center gap-3">
                            <div className="flex items-center border border-ink/15 rounded-full">
                              <button onClick={() => updateQty(item.productId, item.color, item.size, item.qty - 1)} aria-label="Decrease" className="w-9 h-9 flex items-center justify-center"><Minus size={16} /></button>
                              <span className="w-8 text-center text-sm">{item.qty}</span>
                              <button onClick={() => updateQty(item.productId, item.color, item.size, item.qty + 1)} aria-label="Increase" className="w-9 h-9 flex items-center justify-center"><Plus size={16} /></button>
                            </div>
                            <button onClick={() => removeFromCart(item.productId, item.color, item.size)} aria-label="Remove" className="text-ink/40 hover:text-burgundy"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-ink/10 p-5 space-y-3">
                  <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-semibold">{formatINR(subtotal)}</span></div>
                  <div className="flex justify-between text-sm text-ink/60">
                    <span>Shipping</span><span>{shipping === 0 ? 'Free' : formatINR(shipping)}</span>
                  </div>
                  {subtotal > 0 && subtotal < 1499 && (
                    <p className="text-xs text-ink/50">Add {formatINR(1499 - subtotal)} more for free shipping.</p>
                  )}
                  <div className="flex justify-between text-base font-semibold pt-2 border-t border-ink/10"><span>Total</span><span>{formatINR(subtotal + shipping)}</span></div>
                  <Link to="/checkout" onClick={onClose}
                    className="block w-full text-center bg-ink text-ivory py-4 rounded-full font-medium hover:bg-ink/80 transition">
                    Checkout
                  </Link>
                  <button onClick={onClose} className="block w-full text-center text-sm text-ink/60 hover:text-ink">Continue Shopping</button>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

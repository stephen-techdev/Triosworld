import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { searchProducts, formatINR } from '@/data/catalog';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ open, onClose }: Props) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQ('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const results = q.trim() ? searchProducts(q).slice(0, 6) : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-sm flex items-start justify-center p-4 pt-20" onClick={onClose}>
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
            className="bg-ivory w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-ink/10">
              <Search size={20} className="text-ink/50" />
              <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search tees, colours, fits…"
                aria-label="Search products"
                className="flex-1 bg-transparent outline-none text-base" />
              <button onClick={onClose} aria-label="Close search"><X size={20} /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {q.trim() === '' ? (
                <div className="p-5 text-sm text-ink/50">Try “oversized”, “black”, “men”, “graphic”…</div>
              ) : results.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-ink/60 mb-1">No results for “{q}”.</p>
                  <p className="text-sm text-ink/40">Try a different keyword or browse our collections.</p>
                </div>
              ) : (
                <ul className="divide-y divide-ink/5">
                  {results.map(p => (
                    <li key={p.id}>
                      <button onClick={() => { navigate(`/product/${p.slug}`); onClose(); }}
                        className="flex items-center gap-4 w-full p-3 hover:bg-stone/40 text-left">
                        <img src={p.variants[0].images[0]} alt={p.name} className="w-14 h-16 object-cover rounded" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-ink/50">{p.gender} · {p.fit}</p>
                        </div>
                        <span className="text-sm font-semibold">{formatINR(p.price)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

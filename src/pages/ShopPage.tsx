import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, ChevronRight, Check } from 'lucide-react';
import SEO, { breadcrumbJsonLd } from '@/components/SEO';
import { COLLECTIONS, SIZES, COLORS, productsForCollection, type Fit, type Fabric } from '@/data/catalog';
import { ProductCardMotion } from '@/components/ProductCard';

const FITS: Fit[] = ['Regular', 'Oversized', 'Relaxed', 'Slim'];
const FABRICS: Fabric[] = ['Cotton', 'Cotton Blend', 'Heavyweight Cotton', 'French Terry'];
const SORTS = ['Featured', 'Newest', 'Bestselling', 'Price: Low to High', 'Price: High to Low'] as const;
type Sort = typeof SORTS[number];

type Filters = {
  sizes: string[];
  colors: string[];
  fits: Fit[];
  fabrics: Fabric[];
  maxPrice: number;
  inStockOnly: boolean;
};

const emptyFilters: Filters = { sizes: [], colors: [], fits: [], fabrics: [], maxPrice: 2000, inStockOnly: false };

export default function ShopPage() {
  const { slug = 'shop-all' } = useParams();
  const collection = COLLECTIONS.find(c => c.slug === slug) ?? COLLECTIONS[0];
  const baseProducts = useMemo(() => productsForCollection(slug), [slug]);

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [sort, setSort] = useState<Sort>('Featured');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => { setFilters(emptyFilters); setSort('Featured'); }, [slug]);

  const filtered = useMemo(() => {
    let list = baseProducts.filter(p => {
      if (filters.sizes.length && !p.variants.some(v => v.sizes.some(s => filters.sizes.includes(s.size) && s.stock > 0))) return false;
      if (filters.colors.length && !p.variants.some(v => filters.colors.includes(v.color))) return false;
      if (filters.fits.length && !filters.fits.includes(p.fit)) return false;
      if (filters.fabrics.length && !filters.fabrics.includes(p.fabric)) return false;
      if (p.price > filters.maxPrice) return false;
      if (filters.inStockOnly && !p.variants.some(v => v.sizes.some(s => s.stock > 0))) return false;
      return true;
    });
    switch (sort) {
      case 'Newest': list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
      case 'Bestselling': list = [...list].sort((a, b) => Number(b.bestseller) - Number(a.bestseller)); break;
      case 'Price: Low to High': list = [...list].sort((a, b) => a.price - b.price); break;
      case 'Price: High to Low': list = [...list].sort((a, b) => b.price - a.price); break;
    }
    return list;
  }, [baseProducts, filters, sort]);

  const activeCount = filters.sizes.length + filters.colors.length + filters.fits.length + filters.fabrics.length + (filters.inStockOnly ? 1 : 0) + (filters.maxPrice < 2000 ? 1 : 0);

  const toggleArr = <T,>(arr: T[], v: T): T[] => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  const FilterPanel = () => (
    <div className="space-y-8">
      <FilterGroup title="Size">
        <div className="flex flex-wrap gap-2">
          {SIZES.map(s => (
            <button key={s} onClick={() => setFilters(f => ({ ...f, sizes: toggleArr(f.sizes, s) }))}
              className={`min-w-10 h-10 px-3 text-sm rounded-full border transition ${filters.sizes.includes(s) ? 'bg-ink text-ivory border-ink' : 'border-ink/15 hover:border-ink'}`}>
              {s}
            </button>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Colour">
        <div className="flex flex-wrap gap-2.5">
          {COLORS.map(c => (
            <button key={c.name} onClick={() => setFilters(f => ({ ...f, colors: toggleArr(f.colors, c.name) }))}
              aria-label={`Filter by ${c.name}`}
              aria-pressed={filters.colors.includes(c.name)}
              className={`flex items-center gap-1.5 text-xs min-w-9 min-h-9 p-1 ${filters.colors.includes(c.name) ? 'font-semibold' : ''}`}>
              <span className={`w-6 h-6 rounded-full border-2 ${filters.colors.includes(c.name) ? 'border-ink' : 'border-ink/15'}`} style={{ backgroundColor: c.hex }} />
            </button>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Fit">
        <div className="space-y-2">
          {FITS.map(fit => (
            <label key={fit} className="flex items-center gap-2.5 text-sm cursor-pointer">
              <span className={`w-5 h-5 rounded border flex items-center justify-center ${filters.fits.includes(fit) ? 'bg-ink border-ink' : 'border-ink/20'}`}>
                {filters.fits.includes(fit) && <Check size={14} className="text-ivory" />}
              </span>
              <input type="checkbox" className="sr-only" checked={filters.fits.includes(fit)} onChange={() => setFilters(f => ({ ...f, fits: toggleArr(f.fits, fit) }))} />
              {fit}
            </label>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Fabric">
        <div className="space-y-2">
          {FABRICS.map(fb => (
            <label key={fb} className="flex items-center gap-2.5 text-sm cursor-pointer">
              <span className={`w-5 h-5 rounded border flex items-center justify-center ${filters.fabrics.includes(fb) ? 'bg-ink border-ink' : 'border-ink/20'}`}>
                {filters.fabrics.includes(fb) && <Check size={14} className="text-ivory" />}
              </span>
              <input type="checkbox" className="sr-only" checked={filters.fabrics.includes(fb)} onChange={() => setFilters(f => ({ ...f, fabrics: toggleArr(f.fabrics, fb) }))} />
              {fb}
            </label>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Price">
        <input type="range" min={499} max={2000} step={100} value={filters.maxPrice}
          onChange={e => setFilters(f => ({ ...f, maxPrice: Number(e.target.value) }))}
          className="w-full accent-ink" />
        <div className="flex justify-between text-xs text-ink/50 mt-1"><span>₹499</span><span>Up to ₹{filters.maxPrice}</span></div>
      </FilterGroup>
      <FilterGroup title="Availability">
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <span className={`w-5 h-5 rounded border flex items-center justify-center ${filters.inStockOnly ? 'bg-ink border-ink' : 'border-ink/20'}`}>
            {filters.inStockOnly && <Check size={14} className="text-ivory" />}
          </span>
          <input type="checkbox" className="sr-only" checked={filters.inStockOnly} onChange={() => setFilters(f => ({ ...f, inStockOnly: !f.inStockOnly }))} />
          In stock only
        </label>
      </FilterGroup>
    </div>
  );

  return (
    <div className="page-container py-8 md:py-12">
      <SEO title={collection.name} description={collection.blurb} jsonLd={breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Collections', path: '/collections' },
        { name: collection.name, path: `/shop/${slug}` },
      ])} />
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-ink/50 mb-6">
        <Link to="/" className="hover:text-ink">Home</Link>
        <ChevronRight size={12} />
        <Link to="/collections" className="hover:text-ink">Collections</Link>
        <ChevronRight size={12} />
        <span className="text-ink">{collection.name}</span>
      </nav>

      <div className="flex items-end justify-between mb-2">
        <h1 className="font-display fluid-h2 font-semibold">{collection.name}</h1>
      </div>
      <p className="text-ink/60 text-sm mb-6">{collection.blurb}</p>

      <div className="flex items-center justify-between mb-8 border-y border-ink/10 py-3">
        <button onClick={() => setMobileFiltersOpen(true)} className="inline-flex items-center gap-2 text-sm font-medium lg:hidden">
          <SlidersHorizontal size={16} /> Filters {activeCount > 0 && <span className="bg-ink text-ivory text-[10px] rounded-full px-1.5">{activeCount}</span>}
        </button>
        <p className="hidden sm:block text-sm text-ink/50">{filtered.length} {filtered.length === 1 ? 'product' : 'products'}</p>
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink/50 hidden sm:block">Sort</label>
          <select value={sort} onChange={e => setSort(e.target.value as Sort)}
            className="text-sm bg-transparent border border-ink/15 rounded-full px-4 py-2 focus:outline-none focus:border-ink">
            {SORTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-10">
        <aside className="hidden lg:block w-60 shrink-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-lg font-semibold">Filters</h3>
            {activeCount > 0 && <button onClick={() => setFilters(emptyFilters)} className="text-xs text-ink/60 hover:text-ink underline">Clear all</button>}
          </div>
          <FilterPanel />
        </aside>

        <div className="flex-1">
          {activeCount > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {filters.sizes.map(s => <Chip key={s} label={s} onRemove={() => setFilters(f => ({ ...f, sizes: f.sizes.filter(x => x !== s) }))} />)}
              {filters.colors.map(c => <Chip key={c} label={c} onRemove={() => setFilters(f => ({ ...f, colors: f.colors.filter(x => x !== c) }))} />)}
              {filters.fits.map(ft => <Chip key={ft} label={ft} onRemove={() => setFilters(f => ({ ...f, fits: f.fits.filter(x => x !== ft) }))} />)}
              {filters.fabrics.map(fb => <Chip key={fb} label={fb} onRemove={() => setFilters(f => ({ ...f, fabrics: f.fabrics.filter(x => x !== fb) }))} />)}
              {filters.inStockOnly && <Chip label="In stock" onRemove={() => setFilters(f => ({ ...f, inStockOnly: false }))} />}
              <button onClick={() => setFilters(emptyFilters)} className="text-xs text-ink/60 hover:text-ink underline px-2">Clear all</button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-display text-2xl mb-2">No products match those filters.</p>
              <p className="text-ink/50 text-sm mb-6">Try removing a filter or widening your price range.</p>
              <button onClick={() => setFilters(emptyFilters)} className="bg-ink text-ivory px-6 py-3 rounded-full text-sm font-medium hover:bg-ink/80">Clear filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-2 gap-y-5 md:gap-x-4 md:gap-y-6">
              {filtered.map((p, i) => <ProductCardMotion key={p.id} product={p} index={i} />)}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      <AnimatePresence>
        {mobileFiltersOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-ink/40 z-[55] lg:hidden" onClick={() => setMobileFiltersOpen(false)} />
            <motion.aside initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-ivory z-[55] lg:hidden rounded-t-2xl flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-ink/10">
                <h3 className="font-display text-lg font-semibold">Filters</h3>
                <button onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters"><X size={22} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5"><FilterPanel /></div>
              <div className="p-5 border-t border-ink/10 flex gap-3">
                <button onClick={() => setFilters(emptyFilters)} className="flex-1 py-3 rounded-full border border-ink/15 text-sm font-medium">Clear all</button>
                <button onClick={() => setMobileFiltersOpen(false)} className="flex-1 py-3 rounded-full bg-ink text-ivory text-sm font-medium">Show {filtered.length}</button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold tracking-widest uppercase text-ink/40 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-stone/50 text-ink text-xs px-3 py-1.5 rounded-full">
      {label}
      <button onClick={onRemove} aria-label={`Remove ${label}`}><X size={12} /></button>
    </span>
  );
}

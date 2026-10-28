import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, ChevronRight, Check } from 'lucide-react';
import SEO, { breadcrumbJsonLd } from '@/components/SEO';
import { COLLECTIONS, SIZES, formatINR } from '@/data/catalog';
import { useLiveCatalog } from '@/lib/storefrontCatalog';
import { useSiteContent } from '@/lib/siteContent';
import { ProductCardMotion } from '@/components/ProductCard';

const SORTS = ['Featured', 'Newest', 'Bestselling', 'Price: Low to High', 'Price: High to Low'] as const;
type Sort = typeof SORTS[number];

type Filters = {
  sizes: string[];
  colors: string[];
  fits: string[];
  fabrics: string[];
  /** null means "no ceiling" — the slider's top end, whatever that is. */
  maxPrice: number | null;
  inStockOnly: boolean;
};

const emptyFilters: Filters = { sizes: [], colors: [], fits: [], fabrics: [], maxPrice: null, inStockOnly: false };

export default function ShopPage() {
  const { slug = 'shop-all' } = useParams();
  const { products: liveAll, ready } = useLiveCatalog();
  const { content } = useSiteContent();

  /**
   * A collection is free text now, so it may not be one of the built-in pages.
   *
   * The operator's own category cards (Admin → Content) are looked up first, so
   * a collection page shows the name and blurb typed in the dashboard. An
   * unknown slug then falls back to titling itself from the slug rather than
   * showing every product at once.
   */
  const known =
    content.categories.find(c => c.slug === slug) ??
    COLLECTIONS.find(c => c.slug === slug);
  const collection = known ?? {
    slug,
    name: slug === 'shop-all' ? 'Shop All' : slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    blurb: 'Everything filed under this collection.',
  };

  const baseProducts = useMemo(
    () => liveAll.filter((p) => {
      if (slug === 'shop-all') return true;
      if (slug === 'bestsellers') return p.bestseller;
      if (slug === 'new-arrivals') return p.newArrival;
      return p.categories.includes(slug);
    }),
    [liveAll, slug],
  );

  /**
   * Fit and fabric chips come from the products actually on this page.
   *
   * They used to be two hardcoded arrays. Now that the operator can type any
   * value, a fixed list would render filters for products that do not exist and
   * silently drop the ones that do — a "Boxy" cut would be unfilterable.
   */
  /**
   * Price slider bounds come from the catalogue.
   *
   * The ceiling was a fixed ₹2000, so a product the operator priced above that
   * could never be shown - it was filtered out by its own price. The floor and
   * ceiling are now the cheapest and dearest product on this page.
   */
  const priceFloor = useMemo(
    () => (baseProducts.length ? Math.floor(Math.min(...baseProducts.map(p => p.price)) / 100) * 100 : 0),
    [baseProducts],
  );
  const priceCeiling = useMemo(
    () => (baseProducts.length ? Math.ceil(Math.max(...baseProducts.map(p => p.price)) / 100) * 100 : 1000),
    [baseProducts],
  );

  const FITS = useMemo(
    () => [...new Set(baseProducts.map(p => p.fit).filter((f): f is string => Boolean(f)))].sort(),
    [baseProducts],
  );
  const FABRICS = useMemo(
    () => [...new Set(baseProducts.map(p => p.fabric).filter((f): f is string => Boolean(f)))].sort(),
    [baseProducts],
  );

  /**
   * The colour filter is built from the colours actually on these cards.
   *
   * It used to be a static list from the catalog file, so an operator-entered
   * colour ("Terracotta") was unreachable here and every chip rendered the same
   * hardcoded hex. Each entry now carries the name the products record and the
   * hex the dashboard colour picker chose — first swatch wins for a name.
   */
  const SHOP_COLORS = useMemo(() => {
    const seen = new Map<string, { name: string; hex: string }>();
    for (const p of baseProducts)
      for (const v of p.variants)
        if (!seen.has(v.color)) seen.set(v.color, { name: v.color, hex: v.hex });
    return [...seen.values()];
  }, [baseProducts]);

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [sort, setSort] = useState<Sort>('Featured');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => { setFilters(emptyFilters); setSort('Featured'); }, [slug]);

  const filtered = useMemo(() => {
    let list = baseProducts.filter(p => {
      if (filters.sizes.length && !p.variants.some(v => v.sizes.some(s => filters.sizes.includes(s.size) && s.stock > 0))) return false;
      if (filters.colors.length && !p.variants.some(v => filters.colors.includes(v.color))) return false;
      if (filters.fits.length && !(p.fit && filters.fits.includes(p.fit))) return false;
      if (filters.fabrics.length && !(p.fabric && filters.fabrics.includes(p.fabric))) return false;
      if (filters.maxPrice !== null && p.price > filters.maxPrice) return false;
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

  const activeCount = filters.sizes.length + filters.colors.length + filters.fits.length + filters.fabrics.length + (filters.inStockOnly ? 1 : 0) + (filters.maxPrice !== null ? 1 : 0);

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
        {SHOP_COLORS.length === 0 ? (
          <p className="text-xs text-ink/65">No colours recorded on this page yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {SHOP_COLORS.map(c => (
              <button key={c.name} onClick={() => setFilters(f => ({ ...f, colors: toggleArr(f.colors, c.name) }))}
                aria-label={`Filter by ${c.name}`}
                aria-pressed={filters.colors.includes(c.name)}
                className={`inline-flex items-center gap-2 h-10 pl-1.5 pr-3.5 text-sm rounded-full border transition ${filters.colors.includes(c.name) ? 'bg-ink text-ivory border-ink' : 'border-ink/15 hover:border-ink'}`}>
                <span className={`w-7 h-7 rounded-full border-2 ${filters.colors.includes(c.name) ? 'border-ivory/30' : 'border-ink/10'}`} style={{ backgroundColor: c.hex }} />
                {c.name}
              </button>
            ))}
          </div>
        )}
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
        <input
          type="range"
          min={priceFloor}
          max={priceCeiling}
          step={100}
          disabled={priceCeiling <= priceFloor}
          value={filters.maxPrice ?? priceCeiling}
          onChange={e => setFilters(f => ({ ...f, maxPrice: Number(e.target.value) }))}
          className="w-full accent-ink disabled:opacity-40"
        />
        <div className="flex justify-between text-xs text-ink/65 mt-1">
          <span>{formatINR(priceFloor)}</span>
          <span>
            {filters.maxPrice === null || filters.maxPrice >= priceCeiling
              ? 'Any price'
              : `Up to ${formatINR(filters.maxPrice)}`}
          </span>
        </div>
        {filters.maxPrice !== null && (
          <button type="button" onClick={() => setFilters(f => ({ ...f, maxPrice: null }))}
            className="text-[11px] text-ink/65 underline hover:text-ink mt-1">
            Clear price filter
          </button>
        )}
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
      <nav className="flex items-center gap-1.5 text-xs text-ink/65 mb-6">
        <Link to="/home" className="hover:text-ink">Home</Link>
        <ChevronRight size={12} />
        <Link to="/collections" className="hover:text-ink">Collections</Link>
        <ChevronRight size={12} />
        <span className="text-ink">{collection.name}</span>
      </nav>

      <div className="flex items-end justify-between mb-2">
        <h1 className="font-display fluid-h2 font-semibold">{collection.name}</h1>
      </div>
      <p className="text-ink/60 text-sm mb-6">{collection.blurb}</p>

      {/*
        One filter control for every breakpoint: an icon button that opens the
        same sheet. The desktop used to carry a fixed sidebar as well, which
        duplicated the controls and squeezed the grid — the sheet is now the
        single filter surface, so mobile and desktop can never disagree.
      */}
      <div className="sticky top-16 md:top-20 z-30 bg-ivory/95 backdrop-blur border-y border-ink/10">
        <div className="flex items-center justify-between gap-3 py-3">
          <button onClick={() => setMobileFiltersOpen(true)}
            className="inline-flex items-center gap-2 text-sm font-medium border border-ink/15 hover:border-ink rounded-full px-4 py-2 transition">
            <SlidersHorizontal size={15} />
            Filters
            {activeCount > 0 && <span className="bg-ink text-ivory text-[10px] rounded-full px-1.5 py-0.5">{activeCount}</span>}
          </button>
          <p className="hidden sm:block text-sm text-ink/65">{ready ? `${filtered.length} ${filtered.length === 1 ? 'product' : 'products'}` : 'Loading products…'}</p>
          <div className="flex items-center gap-2">
            <label htmlFor="shop-sort" className="text-xs text-ink/65 hidden sm:block">Sort</label>
            <select id="shop-sort" aria-label="Sort products" value={sort} onChange={e => setSort(e.target.value as Sort)}
              className="text-sm bg-transparent border border-ink/15 rounded-full px-3 py-2 max-w-[9.5rem] focus:outline-none focus:border-ink">
              {SORTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-6">
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

          {!ready ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-5 lg:gap-x-8 lg:gap-y-12" aria-busy="true" aria-label="Loading products">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[3/4] rounded-xl bg-stone/70" />
                  <div className="mt-3 h-3 w-2/3 rounded bg-stone/70" />
                  <div className="mt-2 h-3 w-1/3 rounded bg-stone/60" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center">
              {baseProducts.length === 0 ? (
                <>
                  <p className="font-display text-2xl mb-2">New arrivals coming soon.</p>
                  <p className="text-ink/65 text-sm">Fresh pieces are added regularly — check back shortly.</p>
                </>
              ) : (
                <>
                  <p className="font-display text-2xl mb-2">No products match those filters.</p>
                  <p className="text-ink/65 text-sm mb-6">Try removing a filter or widening your price range.</p>
                  <button onClick={() => setFilters(emptyFilters)} className="bg-ink text-ivory px-6 py-3 rounded-full text-sm font-medium hover:bg-ink/80">Clear filters</button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-5 lg:gap-x-8 lg:gap-y-12">
              {filtered.map((p, i) => <ProductCardMotion key={p.id} product={p} index={i} />)}
            </div>
          )}
      </div>

      {/* Filter sheet — the one filter surface at every breakpoint */}
      <AnimatePresence>
        {mobileFiltersOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-ink/40 z-[55]" onClick={() => setMobileFiltersOpen(false)} />
            <motion.aside initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-ivory z-[55] rounded-t-2xl flex flex-col">
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
      <h4 className="text-xs font-semibold tracking-widest uppercase text-ink/65 mb-3">{title}</h4>
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

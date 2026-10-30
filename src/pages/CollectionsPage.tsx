import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import SEO from '@/components/SEO';
import { COLLECTIONS } from '@/data/catalog';
import { useSiteContent } from '@/lib/siteContent';
import { sizedImage } from '@/lib/imgUrl';

export default function CollectionsPage() {
  // The operator's own category cards lead; the built-in shop pages follow so
  // Shop All / Men's Tees / Bestsellers stay reachable from this index.
  const { content } = useSiteContent();
  const operatorCats = content.categories;
  // Shop All and any built-in shop page the operator has not given a card
  // follow, so nothing becomes unreachable from this index.
  const builtins = [
    COLLECTIONS.find(c => c.slug === 'shop-all'),
    ...COLLECTIONS.filter(
      c => c.slug !== 'shop-all' && !operatorCats.some(o => o.slug === c.slug),
    ),
  ].filter((c): c is (typeof COLLECTIONS)[number] => Boolean(c));

  return (
    <div className="page-container py-10 md:py-16">
      <SEO title="Collections" description="Browse all TriosWorld collections — oversized tees, graphic tees, essentials, streetwear and more." />
      <p className="text-xs tracking-widest uppercase text-ink/65 mb-3">Browse</p>
      <h1 className="font-display text-4xl md:text-6xl font-semibold mb-4">Collections</h1>
      <p className="text-ink/60 max-w-xl mb-12">From everyday essentials to statement graphics and street-ready fits — find the world that matches your vibe.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {operatorCats.map((c, i) => (
          <motion.div key={c.slug} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: (i % 3) * 0.06 }}>
            <Link to={`/shop/${c.slug}`} className="group relative block overflow-hidden rounded-2xl aspect-[4/5] bg-stone/40 shadow-soft hover:shadow-lift transition-shadow duration-500">
              <img src={sizedImage(c.image, 800) ?? c.image} alt={c.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" decoding="async" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-transparent to-transparent" />
              <div className="absolute bottom-0 p-5 md:p-6">
                <h3 className="font-display font-semibold text-ivory text-xl">{c.name}</h3>
                <p className="text-ivory/70 text-sm mt-1">{c.blurb}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-ivory text-xs font-medium opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">Explore <ArrowRight size={14} /></span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Shop-page shortcuts — plain cards without their own artwork */}
      {builtins.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {builtins.map(c => (
            <Link key={c.slug} to={`/shop/${c.slug}`} className="group rounded-2xl border border-ink/10 p-5 hover:border-ink/30 hover:shadow-soft transition-all duration-300">
              <h3 className="font-display font-semibold">{c.name}</h3>
              <p className="text-ink/65 text-xs mt-1 line-clamp-2">{c.blurb}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ink/60 group-hover:text-ink transition-colors">Shop <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

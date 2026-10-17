import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import SEO from '@/components/SEO';
import { CATEGORIES, COLLECTIONS } from '@/data/catalog';

export default function CollectionsPage() {
  return (
    <div className="page-container py-10 md:py-16">
      <SEO title="Collections" description="Browse all TriosWorld collections — oversized tees, graphic tees, essentials, streetwear and more." />
      <p className="text-xs tracking-widest uppercase text-ink/40 mb-3">Browse</p>
      <h1 className="font-display text-4xl md:text-6xl font-semibold mb-4">Collections</h1>
      <p className="text-ink/60 max-w-xl mb-12">From everyday essentials to statement graphics and street-ready fits — find the world that matches your vibe.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {CATEGORIES.map((c, i) => (
          <motion.div key={c.slug} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.06 }}>
            <Link to={`/shop/${c.slug}`} className="group block relative overflow-hidden rounded-lg aspect-[4/5]">
              <img src={c.image} alt={c.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
              <div className="absolute bottom-0 p-6">
                <h3 className="font-display text-xl font-semibold text-ivory">{c.name}</h3>
                <p className="text-ivory/70 text-sm mt-1">{c.blurb}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-ivory text-sm font-medium">Shop now <ArrowRight size={14} /></span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="mt-16">
        <h2 className="font-display text-2xl font-semibold mb-6">All collections</h2>
        <div className="flex flex-wrap gap-3">
          {COLLECTIONS.map(c => (
            <Link key={c.slug} to={`/shop/${c.slug}`} className="px-5 py-2.5 rounded-full border border-ink/15 text-sm hover:bg-ink hover:text-ivory transition">
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

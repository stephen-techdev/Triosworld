import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, ShieldCheck, BadgeCheck, Truck, Headphones } from 'lucide-react';
import SEO, { organizationJsonLd } from '@/components/SEO';
import { CATEGORIES, productsForCollection } from '@/data/catalog';
import ProductCard, { ProductCardMotion } from '@/components/ProductCard';
import { fadeUp, staggerParent, Reveal, Stagger, StaggerItem } from '@/components/Motion';

const benefits = [
  { icon: ShieldCheck, title: 'Secure Checkout', text: 'Encrypted payments you can trust.' },
  { icon: BadgeCheck, title: 'Product Quality', text: 'Premium fabrics, built to last.' },
  { icon: Truck, title: 'Order Tracking', text: 'Track every order, end to end.' },
  { icon: Headphones, title: 'Customer Support', text: 'Real humans, here to help.' },
];

const ticker = [
  'Free shipping over ₹1499',
  'New drops weekly',
  'Designed in India',
  '7-day easy returns',
  'Premium heavyweight cotton',
];

export default function HomePage() {
  const bestsellers = productsForCollection('bestsellers').slice(0, 8);
  const orgJsonLd = organizationJsonLd();
  const newArrivals = productsForCollection('new-arrivals');
  const railRef = useRef<HTMLDivElement>(null);

  const scrollRail = (dir: number) => {
    railRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  return (
    <div>
      <SEO jsonLd={orgJsonLd} />
      {/* HERO */}
      <section className="relative min-h-[100svh] w-full overflow-hidden bg-ink flex items-end">
        <motion.img
          src="https://images.pexels.com/photos/25312245/pexels-photo-25312245.jpeg?auto=compress&cs=tinysrgb&w=1920"
          alt="TriosWorld men's fashion campaign"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 8, ease: 'easeOut' }}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-ink/40" />
        <motion.div
          variants={staggerParent(0.12, 0.15)}
          initial="hidden"
          animate="show"
          className="relative w-full page-container flex flex-col justify-end pb-14 sm:pb-16 md:pb-24 pt-24"
        >
          <motion.p variants={fadeUp} className="text-ivory/70 text-xs sm:text-sm tracking-widest uppercase mb-3 sm:mb-4">Three Vibes. One World.</motion.p>
          <motion.h1 variants={fadeUp} className="text-ivory font-display font-bold fluid-h1 tracking-tightest">
            YOUR WORLD.<br />YOUR STYLE.
          </motion.h1>
          <motion.p variants={fadeUp} className="text-ivory/80 mt-5 sm:mt-6 max-w-md fluid-hero-sub">
            Discover men's everyday essentials, oversized fits and statement streetwear.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
            <Link to="/shop/shop-all" className="group inline-flex items-center gap-2 bg-ivory text-ink px-6 sm:px-7 py-3.5 sm:py-4 rounded-full font-semibold text-sm sm:text-base hover:bg-lime transition-colors duration-300 ease-smooth active:scale-[0.98]">
              SHOP NOW <ArrowRight size={18} className="transition-transform duration-300 ease-smooth group-hover:translate-x-1" />
            </Link>
            <Link to="/shop/new-arrivals" className="inline-flex items-center gap-2 border border-ivory/40 text-ivory px-6 sm:px-7 py-3.5 sm:py-4 rounded-full font-semibold text-sm sm:text-base hover:bg-ivory hover:text-ink transition-colors duration-300 ease-smooth active:scale-[0.98]">
              NEW ARRIVALS
            </Link>
          </motion.div>
          <motion.div variants={fadeUp} className="mt-10 hidden sm:flex items-center gap-3 text-ivory/50 text-[11px] tracking-widest uppercase">
            <span className="h-8 w-px bg-ivory/30 animate-float" /> Scroll
          </motion.div>
        </motion.div>
      </section>

      {/* TICKER */}
      <div className="border-y border-ink/10 bg-ivory overflow-hidden py-4">
        <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
          {[0, 1].map(k => (
            <div key={k} className="flex items-center" aria-hidden={k === 1}>
              {ticker.map(t => (
                <span key={t} className="flex items-center gap-8 pr-8 text-xs sm:text-sm font-medium tracking-widest uppercase text-ink/70 whitespace-nowrap">
                  {t}
                  <span className="text-lime text-base leading-none">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* SHOP BY CATEGORY */}
      <section className="page-container py-16 md:py-24">
        <Reveal className="flex items-end justify-between mb-10">
          <div>
            <h2 className="font-display fluid-h2 font-semibold">Shop by Category</h2>
            <p className="text-ink/50 text-sm mt-2">Find your fit. Six ways in.</p>
          </div>
          <Link to="/shop/shop-all" className="link-underline text-sm font-medium text-ink/70 hover:text-ink hidden sm:inline-flex items-center gap-1">View all <ArrowRight size={16} /></Link>
        </Reveal>
        <Stagger className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5" stagger={0.06}>
          {CATEGORIES.map(c => (
            <StaggerItem key={c.slug}>
              <Link to={`/shop/${c.slug}`} className="group relative block overflow-hidden rounded-2xl aspect-[4/5] bg-stone/40 shadow-soft transition-shadow duration-500 ease-smooth hover:shadow-lift">
                <img src={c.image} alt={c.name} className="w-full h-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                  <h3 className="font-display font-semibold text-ivory text-lg md:text-xl">{c.name}</h3>
                  <p className="text-ivory/70 text-xs md:text-sm mt-1 hidden sm:block">{c.blurb}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-ivory text-xs font-medium opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-smooth">Shop now <ArrowRight size={14} /></span>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* BESTSELLERS */}
      <section className="page-container py-16 md:py-20">
        <Reveal className="flex items-end justify-between mb-10">
          <h2 className="font-display fluid-h2 font-semibold">Bestsellers</h2>
          <Link to="/shop/bestsellers" className="link-underline text-sm font-medium text-ink/70 hover:text-ink inline-flex items-center gap-1">Shop all <ArrowRight size={16} /></Link>
        </Reveal>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-8 md:gap-x-5">
          {bestsellers.map((p, i) => <ProductCardMotion key={p.id} product={p} index={i} />)}
        </div>
      </section>

      {/* EDITORIAL SPLIT */}
      <section className="page-container py-16 md:py-24">
        <Reveal className="grid md:grid-cols-2 gap-1 md:gap-0 rounded-3xl overflow-hidden bg-ink shadow-lift">
          <div className="relative min-h-[320px] md:min-h-[560px] overflow-hidden">
            <img src="https://images.pexels.com/photos/37043496/pexels-photo-37043496.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=1200" alt="Men's editorial campaign" className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-smooth hover:scale-105" />
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-8 md:p-16 text-ivory">
            <p className="text-xs tracking-widest uppercase text-lime mb-4">Editorial Drop 03</p>
            <h2 className="font-display text-3xl sm:text-4xl md:text-6xl font-bold leading-[0.95]">NOT JUST<br />A TEE.<br />A STATEMENT.</h2>
            <p className="text-ivory/70 mt-6 max-w-md">Every TriosWorld piece is designed in-house and built from premium fabrics — made for the way you move through the world.</p>
            <Link to="/shop/graphics" className="group mt-8 self-start bg-lime text-ink px-6 py-3 rounded-full font-semibold hover:bg-lime/90 transition-colors duration-300 ease-smooth active:scale-[0.98] inline-flex items-center gap-2">Explore Collection <ArrowRight size={16} className="transition-transform duration-300 ease-smooth group-hover:translate-x-1" /></Link>
          </div>
        </Reveal>
      </section>

      {/* NEW DROPS RAIL */}
      <section className="py-16 md:py-20 overflow-hidden">
        <div className="page-container flex items-end justify-between mb-10">
          <Reveal><h2 className="font-display fluid-h2 font-semibold">New Drops</h2></Reveal>
          <div className="flex items-center gap-2">
            <button onClick={() => scrollRail(-1)} aria-label="Scroll left" className="w-10 h-10 rounded-full border border-ink/15 flex items-center justify-center hover:bg-ink hover:text-ivory hover:border-ink active:scale-90 transition-all duration-300 ease-smooth"><ArrowLeft size={18} /></button>
            <button onClick={() => scrollRail(1)} aria-label="Scroll right" className="w-10 h-10 rounded-full border border-ink/15 flex items-center justify-center hover:bg-ink hover:text-ivory hover:border-ink active:scale-90 transition-all duration-300 ease-smooth"><ArrowRight size={18} /></button>
          </div>
        </div>
        <div ref={railRef} className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar snap-x px-4 sm:px-6 lg:px-8 xl:px-[max(2rem,calc((100vw-1440px)/2+2rem))] 2xl:px-[max(2rem,calc((100vw-1600px)/2+2rem))] 3xl:px-[max(2rem,calc((100vw-1760px)/2+2rem))]">
          {newArrivals.map(p => (
            <div key={p.id} className="snap-start shrink-0 w-[240px] xs:w-[260px] md:w-[300px]"><ProductCard product={p} /></div>
          ))}
          <div className="shrink-0 w-4" />
        </div>
      </section>

      {/* BRAND STORY */}
      <section className="page-container py-16 md:py-24">
        <div className="grid sm:grid-cols-2 gap-8 md:gap-16 items-center">
          <Reveal y={30} className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-card">
            <img src="https://images.pexels.com/photos/15760950/pexels-photo-15760950.jpeg?auto=compress&cs=tinysrgb&fit=crop&crop=entropy&w=900&h=1125" alt="TriosWorld men's community" className="w-full h-full object-cover" loading="lazy" />
          </Reveal>
          <Reveal y={30} delay={0.1}>
            <p className="text-xs tracking-widest uppercase text-ink/40 mb-3">Our Story</p>
            <h2 className="font-display fluid-h2 font-semibold leading-tight">WELCOME TO<br />TRIOSWORLD.</h2>
            <div className="mt-6 space-y-4 text-ink/70 leading-relaxed">
              <p>TriosWorld was born from a simple idea: that everyday men's style is not one thing. It shifts with your mood, your plans, your world. So we built a label around three expressions — essentials, graphics and streetwear — each made to stand alone or mix together.</p>
              <p>Three vibes, one world. Yours. Every piece is designed in India, cut from premium fabrics, and made to be worn hard and often.</p>
            </div>
            <Link to="/about" className="group mt-8 inline-flex items-center gap-2 font-medium hover:text-ink/60 transition-colors">Read our story <ArrowRight size={16} className="transition-transform duration-300 ease-smooth group-hover:translate-x-1" /></Link>
          </Reveal>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="page-container py-12 md:py-16">
        <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6" stagger={0.07}>
          {benefits.map(b => (
            <StaggerItem key={b.title}>
              <div className="group flex flex-col items-center text-center p-6 rounded-2xl border border-ink/10 bg-ivory shadow-soft transition-all duration-500 ease-smooth hover:-translate-y-1 hover:shadow-card h-full">
                <b.icon size={26} className="text-ink mb-3 transition-transform duration-500 ease-smooth group-hover:-translate-y-0.5" />
                <h3 className="font-medium text-sm">{b.title}</h3>
                <p className="text-xs text-ink/50 mt-1">{b.text}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </div>
  );
}

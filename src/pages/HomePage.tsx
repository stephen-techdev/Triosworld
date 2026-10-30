import { useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowLeft, ShieldCheck, BadgeCheck, Truck, Headphones,
  RefreshCw, Lock, Star, Globe, Heart, Zap, type LucideIcon,
} from 'lucide-react';
import SEO, { organizationJsonLd } from '@/components/SEO';
import { formatINR } from '@/data/catalog';
import { liveCollection, useLiveCatalog } from '@/lib/storefrontCatalog';
import { freeShippingLabel, useStoreSettings } from '@/lib/storeSettings';
import { useSiteContent, type BenefitIconKey } from '@/lib/siteContent';
import { sizedImage, productThumb, thumbFallback } from '@/lib/imgUrl';
import ProductCard, { ProductCardMotion } from '@/components/ProductCard';
import HeroSlider from '@/components/HeroSlider';
import { Reveal, Stagger, StaggerItem } from '@/components/Motion';

/**
 * The benefit tiles carry an icon chosen in Admin → Content. The icon set is
 * code (glyphs cannot be typed into a text field), so the dashboard offers
 * these keys and this map resolves them — an unknown key falls back to the
 * first one rather than rendering nothing.
 */
const BENEFIT_ICONS: Record<BenefitIconKey, LucideIcon> = {
  shield: ShieldCheck,
  badge: BadgeCheck,
  truck: Truck,
  headphones: Headphones,
  refresh: RefreshCw,
  lock: Lock,
  star: Star,
  globe: Globe,
  heart: Heart,
  zap: Zap,
};

/** Multi-line display headings: each entry becomes its own line. */
const lines = (arr: string[]) =>
  arr.map((l, i) => <span key={i}>{i > 0 && <br />}{l}</span>);

export default function HomePage() {
  // The storefront serves only products created in the admin dashboard.
  useLiveCatalog();
  const { settings } = useStoreSettings();
  // Every headline, blurb and image below is the operator's (Admin → Content);
  // until it is edited there, these are the compiled-in defaults verbatim.
  const { content } = useSiteContent();

  // The ticker's first line can quote the operator's own free-shipping
  // threshold — toggleable, and joined by the lines typed in the dashboard.
  const ticker = [
    ...(content.ticker.showFreeShipping ? [freeShippingLabel(settings, formatINR)] : []),
    ...content.ticker.items,
  ].map(t => t.trim()).filter(Boolean);

  const bestsellers = liveCollection('bestsellers').slice(0, 8);
  const orgJsonLd = organizationJsonLd();
  // A product flagged as both would otherwise show the same card twice on the
  // page — once in Bestsellers and again in New Drops. Keep each card unique.
  const inBestellers = new Set(bestsellers.map(p => p.id));
  const newArrivals = liveCollection('new-arrivals').filter(p => !inBestellers.has(p.id));
  const railRef = useRef<HTMLDivElement>(null);

  const scrollRail = (dir: number) => {
    railRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  return (
    <div>
      <SEO jsonLd={orgJsonLd} />
      {/* HERO — the operator's campaign reel (Admin → Content). */}
      <HeroSlider slides={content.heroSlides} />
      {/* TICKER — first line can be the live free-shipping rule, rest is copy */}
      {ticker.length > 0 && (
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
      )}

      {/* SHOP BY CATEGORY */}
      <section className="page-container py-16 md:py-24">
        <Reveal className="flex items-end justify-between mb-10">
          <div>
            <h2 className="font-display fluid-h2 font-semibold">{content.categoriesHeading.title}</h2>
            <p className="text-ink/65 text-sm mt-2">{content.categoriesHeading.sub}</p>
          </div>
          <Link to="/shop/shop-all" className="link-underline text-sm font-medium text-ink/70 hover:text-ink hidden sm:inline-flex items-center gap-1">View all <ArrowRight size={16} /></Link>
        </Reveal>
        <Stagger className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5" stagger={0.06}>
          {content.categories.map(c => (
            <StaggerItem key={c.slug}>
              <Link to={`/shop/${c.slug}`} className="group relative block overflow-hidden rounded-2xl aspect-[4/5] bg-stone/40 shadow-soft transition-shadow duration-500 ease-smooth hover:shadow-lift">
                <img src={sizedImage(c.image, 640) ?? c.image} alt={c.name} className="w-full h-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-105" loading="lazy" decoding="async" />
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

      {/* BESTSELLERS — skip the whole rail while the operator has no flagged
          products, rather than leaving a heading over empty white space. */}
      {bestsellers.length > 0 && (
        <section className="page-container py-16 md:py-20">
          <Reveal className="flex items-end justify-between mb-10">
            <h2 className="font-display fluid-h2 font-semibold">{content.bestsellersHeading}</h2>
            <Link to="/shop/bestsellers" className="link-underline text-sm font-medium text-ink/70 hover:text-ink inline-flex items-center gap-1">Shop all <ArrowRight size={16} /></Link>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-5 lg:gap-x-8 lg:gap-y-12">
            {bestsellers.map((p, i) => <ProductCardMotion key={p.id} product={p} index={i} />)}
          </div>
        </section>
      )}

      {/* EDITORIAL SPLIT */}
      <section className="page-container py-16 md:py-24">
        <Reveal className="grid md:grid-cols-2 gap-1 md:gap-0 rounded-3xl overflow-hidden bg-ink shadow-lift">
          <div className="relative min-h-[320px] md:min-h-[560px] overflow-hidden">
            {/* The editorial photo may be an uploaded store image (full size in
                storage), so it renders through the thumb variant like cards do
                and falls back to the original if that variant is absent. */}
            <img src={productThumb(sizedImage(content.editorial.image, 1000) ?? content.editorial.image)} data-original-src={content.editorial.image} onError={thumbFallback} alt="Men's editorial campaign" className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-smooth hover:scale-105" loading="lazy" decoding="async" />
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-8 md:p-16 text-ivory">
            <p className="text-xs tracking-widest uppercase text-lime mb-4">{content.editorial.kicker}</p>
            <h2 className="font-display text-3xl sm:text-4xl md:text-6xl font-bold leading-[0.95]">{lines(content.editorial.titleLines)}</h2>
            <p className="text-ivory/70 mt-6 max-w-md">{content.editorial.body}</p>
            <Link to={content.editorial.ctaTo} className="group mt-8 self-start bg-lime text-ink px-6 py-3 rounded-full font-semibold hover:bg-lime/90 transition-colors duration-300 ease-smooth active:scale-[0.98] inline-flex items-center gap-2">{content.editorial.ctaLabel} <ArrowRight size={16} className="transition-transform duration-300 ease-smooth group-hover:translate-x-1" /></Link>
          </div>
        </Reveal>
      </section>

      {/* NEW DROPS RAIL */}
      <section className="py-16 md:py-20 overflow-hidden">
        <div className="page-container flex items-end justify-between mb-10">
          <Reveal><h2 className="font-display fluid-h2 font-semibold">{content.newDropsHeading}</h2></Reveal>
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
            <img src={productThumb(sizedImage(content.story.image, 800) ?? content.story.image)} data-original-src={content.story.image} onError={thumbFallback} alt="TriosWorld men's community" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </Reveal>
          <Reveal y={30} delay={0.1}>
            <p className="text-xs tracking-widest uppercase text-ink/65 mb-3">{content.story.kicker}</p>
            <h2 className="font-display fluid-h2 font-semibold leading-tight">{lines(content.story.titleLines)}</h2>
            <div className="mt-6 space-y-4 text-ink/70 leading-relaxed">
              {content.story.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <Link to={content.story.ctaTo} className="group mt-8 inline-flex items-center gap-2 font-medium hover:text-ink/60 transition-colors">{content.story.ctaLabel} <ArrowRight size={16} className="transition-transform duration-300 ease-smooth group-hover:translate-x-1" /></Link>
          </Reveal>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="page-container py-12 md:py-16">
        <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6" stagger={0.07}>
          {content.benefits.map(b => {
            const Icon = BENEFIT_ICONS[b.icon] ?? ShieldCheck;
            /* Same classes for both shells — the link never changes box size,
               it only adds pointer + keyboard navigation. */
            const cardClasses = 'group flex flex-col items-center text-center p-6 rounded-2xl border border-ink/10 bg-ivory shadow-soft transition-all duration-500 ease-smooth hover:-translate-y-1 hover:shadow-card h-full';
            const inner = (
              <>
                <Icon size={26} className="text-ink mb-3 transition-transform duration-500 ease-smooth group-hover:-translate-y-0.5" />
                <h3 className="font-medium text-sm">{b.title}</h3>
                <p className="text-xs text-ink/65 mt-1">{b.text}</p>
              </>
            );
            return (
              <StaggerItem key={`${b.title}-${b.text}`}>
                {b.to ? (
                  <Link to={b.to} className={cardClasses} aria-label={`${b.title} — learn more`}>{inner}</Link>
                ) : (
                  <div className={cardClasses}>{inner}</div>
                )}
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>
    </div>
  );
}

/**
 * The homepage hero — a full-bleed campaign reel.
 *
 * Each slide is the operator's own eyebrow, headline, blurb, calls to action
 * and photo (Admin → Content). The photo cross-fades with a slow Ken-Burns
 * push, and the copy lifts in on each change, so the landing reads like a look
 * book rather than a static banner.
 *
 * Behaviour that keeps it out of the way:
 *  - one timer drives the rotation, and it is restarted whenever the slide
 *    changes by hand, so a manual step never fights the clock;
 *  - the reel pauses while the tab is hidden, so a backgrounded homepage is
 *    not silently burning through slides;
 *  - `prefers-reduced-motion` turns off the push, the fades and the autoplay,
 *    leaving a still hero with the dots to step through;
 *  - swipe works on touch, and the dots are real buttons with labels.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowRight, ArrowLeft, Pause, Play } from 'lucide-react';
import type { HeroSlide } from '@/lib/siteContent';

/** Multi-line display headings: each entry becomes its own line. */
const lines = (arr: string[]) =>
  arr.map((l, i) => <span key={i}>{i > 0 && <br />}{l}</span>);

const SLIDE_COPY: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export default function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const reduced = useReducedMotion();
  const [idx, setIdx] = useState(0);
  // Autoplay is opt-out: a customer who wants to read a slide can stop the reel.
  const [playing, setPlaying] = useState(true);
  const dragX = useRef<number | null>(null);

  const count = slides.length;
  const current = slides[Math.min(idx, count - 1)];

  const go = (next: number) => setIdx(((next % count) + count) % count);

  // One timer per slide: the duration is the slide's own, so the campaign shot
  // lingers and the supporting angles keep moving.
  useEffect(() => {
    if (reduced || !playing || count < 2 || !current) return;
    const ms = Math.max(3, current.seconds) * 1000;
    const t = window.setTimeout(() => setIdx(i => (i + 1) % count), ms);
    return () => window.clearTimeout(t);
  }, [idx, playing, reduced, count, current]);

  // A backgrounded tab should not advance slides the customer never saw.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (!count || !current) return null;

  return (
    <section
      className="relative min-h-[100svh] md:min-h-0 md:h-[86vh] md:max-h-[860px] w-full overflow-hidden bg-ink flex items-end"
      aria-roledescription="carousel"
      aria-label="Featured collections"
      onTouchStart={(e) => { dragX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (dragX.current === null) return;
        const dx = e.changedTouches[0].clientX - dragX.current;
        if (Math.abs(dx) > 50) go(idx + (dx < 0 ? 1 : -1));
        dragX.current = null;
      }}
    >
      {/* Photo stack. Each slide is absolutely placed and cross-faded, so the
          next image is already decoded when its turn comes and there is never
          a white flash between campaign shots. The active one gets a slow push
          — the Ken-Burns feel — via a CSS animation instead of a JS one, so
          it cannot fight the cross-fade. */}
      {slides.map((s, i) => (
        <motion.img
          key={`${s.image}-${i}`}
          src={s.image}
          alt=""
          aria-hidden={i !== idx}
          loading={i === 0 ? 'eager' : 'lazy'}
          fetchPriority={i === 0 ? 'high' : 'low'}
          initial={false}
          animate={{ opacity: i === idx ? 0.8 : 0 }}
          transition={{ duration: reduced ? 0 : 1.4, ease: 'easeInOut' }}
          className={`absolute inset-0 w-full h-full object-cover object-[50%_32%] md:object-[50%_28%] ${i === idx && !reduced ? 'hero-kenburns' : ''}`}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-ink/40" />
      {/* On wide screens the photo is mostly hidden behind the copy at the
          bottom-left; a left-weighted scrim keeps the headline readable
          without flattening the whole image. */}
      <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-ink/75 via-ink/25 to-transparent" />

      {/* Copy. Keyed on the slide index so each change re-runs the stagger. */}
      <motion.div
        key={idx}
        initial={reduced ? false : 'hidden'}
        animate="show"
        variants={SLIDE_COPY}
        className="relative w-full page-container flex flex-col justify-end pb-14 sm:pb-16 md:pb-24 pt-24"
      >
        <motion.p variants={fadeUp} className="text-ivory/70 text-xs sm:text-sm tracking-widest uppercase mb-3 sm:mb-4">{current.eyebrow}</motion.p>
        <motion.h1 variants={fadeUp} className="text-ivory font-display font-bold fluid-h1 tracking-tightest">
          {lines(current.titleLines)}
        </motion.h1>
        <motion.p variants={fadeUp} className="text-ivory/80 mt-5 sm:mt-6 max-w-md fluid-hero-sub">
          {current.subtitle}
        </motion.p>
        <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
          <Link to={current.ctaPrimaryTo} className="group inline-flex items-center gap-2 bg-ivory text-ink px-6 sm:px-7 py-3.5 sm:py-4 rounded-full font-semibold text-sm sm:text-base hover:bg-lime transition-colors duration-300 ease-smooth active:scale-[0.98]">
            {current.ctaPrimaryLabel} <ArrowRight size={18} className="transition-transform duration-300 ease-smooth group-hover:translate-x-1" />
          </Link>
          <Link to={current.ctaSecondaryTo} className="inline-flex items-center gap-2 border border-ivory/40 text-ivory px-6 sm:px-7 py-3.5 sm:py-4 rounded-full font-semibold text-sm sm:text-base hover:bg-ivory hover:text-ink transition-colors duration-300 ease-smooth active:scale-[0.98]">
            {current.ctaSecondaryLabel}
          </Link>
        </motion.div>
        <motion.div variants={fadeUp} className="mt-10 hidden sm:flex items-center gap-3 text-ivory/50 text-[11px] tracking-widest uppercase">
          <span className="h-8 w-px bg-ivory/30 animate-float" /> Scroll
        </motion.div>
      </motion.div>

      {/* Controls. Dots on every screen; play/pause and arrows are desktop-only
          so the phone keeps its gestures and stays clean. */}
      {count > 1 && (
        <div className="absolute bottom-6 right-4 sm:right-6 md:bottom-10 md:right-10 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying(p => !p)}
            aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
            className="w-9 h-9 rounded-full border border-ivory/30 text-ivory/80 grid place-items-center hover:bg-ivory/15 transition-colors"
          >
            {playing && !reduced ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <button type="button" onClick={() => go(idx - 1)} aria-label="Previous slide" className="w-9 h-9 rounded-full border border-ivory/30 text-ivory/80 grid place-items-center hover:bg-ivory/15 transition-colors"><ArrowLeft size={16} /></button>
            <button type="button" onClick={() => go(idx + 1)} aria-label="Next slide" className="w-9 h-9 rounded-full border border-ivory/30 text-ivory/80 grid place-items-center hover:bg-ivory/15 transition-colors"><ArrowRight size={16} /></button>
          </div>
          <div className="flex items-center gap-2" role="tablist" aria-label="Choose a slide">
            {slides.map((s, i) => (
              <button
                key={`dot-${i}-${s.image}`}
                type="button"
                role="tab"
                aria-selected={i === idx}
                aria-label={`Slide ${i + 1}: ${s.eyebrow}`}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all duration-500 ease-smooth ${i === idx ? 'w-8 bg-lime' : 'w-1.5 bg-ivory/45 hover:bg-ivory/70'}`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

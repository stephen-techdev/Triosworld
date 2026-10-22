/**
 * Every word and image the storefront shows *outside* the products themselves.
 *
 * This used to be literals scattered across HomePage, AnnouncementBar, Product
 * Page, Footer, Newsletter and StaticPage — the hero headline, the ticker, the
 * category cards, each section heading, the editorial and story copy, the size
 * guide, the "customer reviews", the footer contact details, even the promo code
 * in the announcement bar. Changing any of it meant editing code and deploying,
 * and an operator could not fix a phone number without a developer.
 *
 * It now lives in one JSONB document on the `store_settings` singleton
 * (store_settings.content), edited from Admin → Content and fetched here.
 *
 * Two rules keep this safe:
 *
 *  1. The defaults below are the shipped copy verbatim. A database that has
 *     never been edited (content IS NULL) or a failed fetch renders exactly what
 *     the site renders today, so nothing can collapse into an empty page.
 *  2. Everything is merged over those defaults on the way in, so a field the
 *     database predates still resolves to a real string rather than undefined.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/store/AuthContext';
import { setWhatsAppNumber } from '@/components/WhatsApp';

// ────────────────────────────── content shape ──────────────────────────────

export type BenefitIconKey =
  | 'shield' | 'badge' | 'truck' | 'headphones'
  | 'refresh' | 'lock' | 'star' | 'globe' | 'heart' | 'zap';

export interface HeroContent {
  eyebrow: string;
  titleLines: string[];
  subtitle: string;
  ctaPrimaryLabel: string;
  ctaPrimaryTo: string;
  ctaSecondaryLabel: string;
  ctaSecondaryTo: string;
  image: string;
}

/**
 * One slide of the homepage hero.
 *
 * The hero used to be a single headline with a single photo; a menswear
 * storefront wants a campaign reel. Each slide carries its own eyebrow,
 * headline, blurb, calls to action and photo, so the operator can run a drop
 * without a developer. The first slide is the shipped hero verbatim, so an
 * unedited store renders the same headline it did before the slider existed.
 */
export interface HeroSlide {
  eyebrow: string;
  titleLines: string[];
  subtitle: string;
  ctaPrimaryLabel: string;
  ctaPrimaryTo: string;
  ctaSecondaryLabel: string;
  ctaSecondaryTo: string;
  image: string;
  /** Longer on the main campaign shot, shorter on supporting angles. */
  seconds: number;
}

export interface NavLink {
  label: string;
  to: string;
}

export interface HeaderContent {
  /** Words before and after the centred wordmark on mobile, e.g. "TRIOS" / "WORLD". */
  nav: NavLink[];
}

export interface CategoryCard {
  slug: string;
  name: string;
  blurb: string;
  image: string;
}

export interface EditorialContent {
  kicker: string;
  titleLines: string[];
  body: string;
  image: string;
  ctaLabel: string;
  ctaTo: string;
}

export interface StoryContent {
  kicker: string;
  titleLines: string[];
  paragraphs: string[];
  image: string;
  ctaLabel: string;
  ctaTo: string;
}

export interface BenefitContent {
  icon: BenefitIconKey;
  title: string;
  text: string;
}

export interface FooterLink {
  label: string;
  to: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export type SocialIconKey = 'instagram' | 'facebook' | 'whatsapp' | 'mail' | 'youtube';

export interface FooterSocial {
  icon: SocialIconKey;
  label: string;
  href: string;
}

export interface FooterContent {
  blurb: string;
  columns: FooterColumn[];
  address: string;
  /** Displayed phone/WhatsApp line. */
  phone: string;
  /** Digits only, country code included — drives every wa.me link. */
  whatsapp: string;
  email: string;
  socials: FooterSocial[];
  /** The small line beside the copyright. */
  note: string;
}

export interface ReviewContent {
  name: string;
  rating: number;
  text: string;
}

export interface PdpContent {
  /** First row is the header row. */
  sizeGuide: string[][];
  reviews: ReviewContent[];
  /** The three promise tiles under the buy buttons. */
  promises: string[];
  returnsLine: string;
}

export interface PageBlock {
  h?: string;
  p: string;
}

export interface PageContent {
  title: string;
  body: PageBlock[];
}

export interface NewsletterContent {
  heading: string;
  sub: string;
  disclaimer: string;
}

export interface HeaderContent {
  /** The links shown in the site header and mobile drawer. */
  nav: NavLink[];
}

export interface SiteContent {
  /** Extra rotating lines in the announcement bar (line 1 is the operator's). */
  announcement: string[];
  newsletter: NewsletterContent;
  header: HeaderContent;
  hero: HeroContent;
  heroSlides: HeroSlide[];
  ticker: { showFreeShipping: boolean; items: string[] };
  categoriesHeading: { title: string; sub: string };
  categories: CategoryCard[];
  bestsellersHeading: string;
  editorial: EditorialContent;
  newDropsHeading: string;
  story: StoryContent;
  benefits: BenefitContent[];
  footer: FooterContent;
  pdp: PdpContent;
  pages: Record<string, PageContent>;
}

// ─────────────────────────────── defaults ──────────────────────────────────
// Verbatim from the code this replaces, except the six category images, which
// become the luxury editorial set approved for the redesign.

const img = (id: number, w = 800, h = 1000) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=${w}&h=${h}`;

export const DEFAULT_SITE_CONTENT: SiteContent = {
  announcement: [
    'New drops every week. Three vibes, one world.',
    'Free shipping on prepaid orders over ₹1,499.',
  ],

  newsletter: {
    heading: 'GOOD STYLE. STRAIGHT TO YOUR INBOX.',
    sub: 'Get early access to new drops, member-only pricing and the occasional good idea. No spam.',
    disclaimer: 'By subscribing you agree to receive marketing emails from TriosWorld.',
  },

  hero: {
    eyebrow: 'Three Vibes. One World.',
    titleLines: ['YOUR WORLD.', 'YOUR STYLE.'],
    subtitle: "Discover men's everyday essentials, oversized fits and statement streetwear.",
    ctaPrimaryLabel: 'SHOP NOW',
    ctaPrimaryTo: '/shop/shop-all',
    ctaSecondaryLabel: 'NEW ARRIVALS',
    ctaSecondaryTo: '/shop/new-arrivals',
    image: 'https://images.pexels.com/photos/9775889/pexels-photo-9775889.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=2400&h=1350',
  },

  // The opening slide is the shipped hero verbatim, so an operator who never
  // opens Admin → Content sees exactly the homepage they saw before. The
  // remaining slides are the curated luxury campaign set.
  heroSlides: [
    {
      eyebrow: 'Three Vibes. One World.',
      titleLines: ['YOUR WORLD.', 'YOUR STYLE.'],
      subtitle: "Discover men's everyday essentials, oversized fits and statement streetwear.",
      ctaPrimaryLabel: 'SHOP NOW',
      ctaPrimaryTo: '/shop/shop-all',
      ctaSecondaryLabel: 'NEW ARRIVALS',
      ctaSecondaryTo: '/shop/new-arrivals',
      image: 'https://images.pexels.com/photos/9775889/pexels-photo-9775889.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=2400&h=1350',
      seconds: 7,
    },
    {
      eyebrow: 'Editorial Drop 03',
      titleLines: ['NOT JUST', 'A TEE.'],
      subtitle: 'Original graphics, printed in India and made to say something. Wear the statement.',
      ctaPrimaryLabel: 'SHOP GRAPHICS',
      ctaPrimaryTo: '/shop/graphics',
      ctaSecondaryLabel: 'NEW ARRIVALS',
      ctaSecondaryTo: '/shop/new-arrivals',
      image: 'https://images.pexels.com/photos/2451200/pexels-photo-2451200.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=2400&h=1350',
      seconds: 6,
    },
    {
      eyebrow: 'Streetwear',
      titleLines: ['MOVE', 'DIFFERENT.'],
      subtitle: 'Relaxed silhouettes and considered detailing for the way you actually dress.',
      ctaPrimaryLabel: 'SHOP STREETWEAR',
      ctaPrimaryTo: '/shop/streetwear',
      ctaSecondaryLabel: 'SHOP ALL',
      ctaSecondaryTo: '/shop/shop-all',
      image: 'https://images.pexels.com/photos/32969128/pexels-photo-32969128.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=2400&h=1350',
      seconds: 6,
    },
  ],

  header: {
    nav: [
      { label: 'Home', to: '/home' },
      { label: 'Shop All', to: '/shop/shop-all' },
      { label: "Men's Tees", to: '/shop/men' },
      { label: 'New Arrivals', to: '/shop/new-arrivals' },
      { label: 'Oversized', to: '/shop/oversized' },
      { label: 'Graphic Tees', to: '/shop/graphics' },
      { label: 'Streetwear', to: '/shop/streetwear' },
      { label: 'Collections', to: '/collections' },
    ],
  },

  ticker: {
    showFreeShipping: true,
    items: ['New drops weekly', 'Designed in India', '7-day easy returns', 'Premium heavyweight cotton'],
  },

  categoriesHeading: {
    title: 'Shop by Category',
    sub: 'Find your fit. Six ways in.',
  },

  categories: [
    { slug: 'oversized', name: 'Oversized T-Shirts', blurb: 'Relaxed drops, boxy cuts and heavyweight feel.', image: img(18584221) },
    { slug: 'graphics', name: 'Graphic T-Shirts', blurb: 'Original prints that say something.', image: img(12922525) },
    { slug: 'essentials', name: 'Minimal Essentials', blurb: 'The everyday backbone of your rotation.', image: img(6616673) },
    { slug: 'streetwear', name: 'Streetwear', blurb: 'Contemporary relaxed-fit street fashion.', image: img(32206712) },
    { slug: 'regular', name: 'Regular Fit', blurb: 'Clean, classic, never out of place.', image: img(34860506) },
    { slug: 'new-arrivals', name: 'New Arrivals', blurb: 'Fresh in this week.', image: img(32653254) },
  ],

  bestsellersHeading: 'Bestsellers',

  editorial: {
    kicker: 'Editorial Drop 03',
    titleLines: ['NOT JUST', 'A TEE.', 'A STATEMENT.'],
    body: 'Every TriosWorld piece is designed in-house and built from premium fabrics — made for the way you move through the world.',
    image: 'https://images.pexels.com/photos/37043496/pexels-photo-37043496.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=1200',
    ctaLabel: 'Explore Collection',
    ctaTo: '/shop/graphics',
  },

  newDropsHeading: 'New Drops',

  story: {
    kicker: 'Our Story',
    titleLines: ['WELCOME TO', 'TRIOSWORLD.'],
    paragraphs: [
      "TriosWorld was born from a simple idea: that everyday men's style is not one thing. It shifts with your mood, your plans, your world. So we built a label around three expressions — essentials, graphics and streetwear — each made to stand alone or mix together.",
      'Three vibes, one world. Yours. Every piece is designed in India, cut from premium fabrics, and made to be worn hard and often.',
    ],
    image: 'https://images.pexels.com/photos/15760950/pexels-photo-15760950.jpeg?auto=compress&cs=tinysrgb&fit=crop&crop=entropy&w=900&h=1125',
    ctaLabel: 'Read our story',
    ctaTo: '/about',
  },

  benefits: [
    { icon: 'shield', title: 'Secure Checkout', text: 'Encrypted payments you can trust.' },
    { icon: 'badge', title: 'Product Quality', text: 'Premium fabrics, built to last.' },
    { icon: 'truck', title: 'Order Tracking', text: 'Track every order, end to end.' },
    { icon: 'headphones', title: 'Customer Support', text: 'Real humans, here to help.' },
  ],

  footer: {
    blurb: "Three vibes, one world. TriosWorld is a contemporary Indian men's fashion label built around essentials, graphics and streetwear — designed for how you express yourself.",
    columns: [
      { title: 'Shop', links: [
        { label: 'Shop All', to: '/shop/shop-all' },
        { label: "Men's Tees", to: '/shop/men' },
        { label: 'Oversized', to: '/shop/oversized' },
        { label: 'New Arrivals', to: '/shop/new-arrivals' },
      ] },
      { title: 'Help', links: [
        { label: 'Contact Us', to: '/contact' },
        { label: 'Order Tracking', to: '/account' },
        { label: 'Shipping Policy', to: '/shipping' },
        { label: 'Return Policy', to: '/returns' },
        { label: 'FAQs', to: '/faqs' },
      ] },
      { title: 'Company', links: [
        { label: 'Our Story', to: '/about' },
        { label: 'Collections', to: '/collections' },
        { label: 'Privacy Policy', to: '/privacy' },
        { label: 'Terms & Conditions', to: '/terms' },
      ] },
    ],
    address: 'Mumbai, India',
    phone: '+91 63838 83727',
    whatsapp: '916383883727',
    email: 'hello@triosworld.com',
    socials: [
      { icon: 'instagram', label: 'Instagram', href: 'https://instagram.com' },
      { icon: 'whatsapp', label: 'WhatsApp', href: '' },
      { icon: 'mail', label: 'Email', href: 'mailto:hello@triosworld.com' },
    ],
    note: 'Designed in India. Made for the world.',
  },

  pdp: {
    sizeGuide: [
      ['Size', 'Chest (in)', 'Length (in)'],
      ['XS', '36', '26'],
      ['S', '38', '27'],
      ['M', '40', '28'],
      ['L', '42', '29'],
      ['XL', '44', '30'],
      ['XXL', '46', '31'],
    ],
    reviews: [
      { name: 'Arjun K.', rating: 5, text: 'Fabric quality is legit for this price. Fit is exactly as described — oversized but not baggy. Will buy again.' },
      { name: 'Rohan M.', rating: 4, text: 'Good tee, print is clean and has not cracked after 3 washes. Delivery took 4 days to Bangalore.' },
      { name: 'Karthik S.', rating: 5, text: "Heavyweight cotton feels premium. The black hasn't faded. Best tee I've bought online this year." },
    ],
    promises: ['Ships in 24h', '7-day returns', 'Secure pay'],
    returnsLine: '7-day easy returns. Items must be unworn with tags intact.',
  },

  pages: {
    about: {
      title: 'Our Story',
      body: [
        { h: 'Three vibes, one world.', p: "TriosWorld was born from the idea that everyday men's style is not one thing. It shifts with your mood, your plans, your world. So we built a label around three expressions — essentials, graphics and streetwear — each made to stand alone or mix together." },
        { h: 'Designed in India.', p: 'Every piece is designed in-house and cut from premium fabrics. We obsess over fit, fabric weight and finish so every tee feels considered, not mass-produced.' },
        { h: 'Made for how you express yourself.', p: 'Your world. Your style. That is the whole point. We make the canvas; you make the statement.' },
      ],
    },
    shipping: {
      title: 'Shipping Policy',
      body: [
        { p: 'Orders are dispatched within 24 hours of placement, excluding weekends and public holidays.' },
        // Rendered from the operator's live shipping settings while unedited;
        // once saved from the dashboard it becomes plain text like the rest.
        { h: 'Domestic shipping (India)', p: '{{shipping}}' },
        { h: 'Tracking', p: 'Every order ships with a tracking number. You will receive an email and SMS with tracking details once your order is dispatched.' },
      ],
    },
    returns: {
      title: 'Return Policy',
      body: [
        { p: 'We offer 7-day easy returns on all unworn items with original tags intact.' },
        { h: 'How to return', p: 'Log in to your account, open the order and request a return. We will arrange a pickup and process your refund within 5–7 business days of receiving the item.' },
        { h: 'Non-returnable items', p: 'Items worn, washed or damaged by the customer cannot be returned. Innerwear and custom prints are non-returnable.' },
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      body: [
        { p: 'TriosWorld respects your privacy. We collect only the information needed to process orders and improve your experience — name, contact details and address.' },
        { h: 'How we use it', p: 'To fulfil orders, communicate updates, and — only if you opt in — send marketing emails. We never sell your data.' },
        { h: 'Your rights', p: 'You can request access to or deletion of your data at any time by writing to hello@triosworld.com.' },
      ],
    },
    terms: {
      title: 'Terms & Conditions',
      body: [
        { p: 'By using triosworld.com you agree to these terms. Prices are listed in INR and inclusive of all taxes.' },
        { h: 'Orders', p: 'All orders are subject to availability and confirmation. We reserve the right to cancel orders that appear fraudulent.' },
        { h: 'Content', p: 'All product imagery, designs and copy are the property of TriosWorld and may not be reproduced without permission.' },
      ],
    },
    contact: {
      title: 'Contact Us',
      body: [
        { p: 'We are here to help. Reach us any of the ways below — typical response time is under 24 hours on business days.' },
        { h: 'Email', p: 'hello@triosworld.com' },
        { h: 'Phone', p: '+91 63838 83727 (Mon–Sat, 10am–7pm IST)' },
        { h: 'Address', p: 'TriosWorld, Mumbai, India' },
      ],
    },
    faqs: {
      title: 'FAQs',
      body: [
        { h: 'When will my order arrive?', p: 'Standard delivery takes 3–5 business days across India. You will get tracking details by email and SMS.' },
        { h: 'Can I exchange for a different size?', p: 'Yes — within 7 days, as long as the item is unworn with tags. Start a return from your account.' },
        { h: 'Do you ship internationally?', p: 'We currently ship within India only. International shipping is coming soon.' },
        { h: 'How do I track my order?', p: 'Once dispatched, you will receive a tracking link. You can also view order status from your account.' },
      ],
    },
  },
};

// ────────────────────────── normalise what the DB gives us ─────────────────
// The document is written by the admin dashboard, but it travels through JSON,
// a service-role POST and possibly an older schema. Merging it over the
// defaults field-by-field means any missing, null or malformed entry falls back
// to the shipped copy instead of reaching a component as undefined.

const MAX_STR = 4000;
const MAX_ARR = 60;
const MAX_DEPTH = 6;

function sanitize(v: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return undefined;
  if (typeof v === 'string') return v.split('\u0000').join('').slice(0, MAX_STR);
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'boolean') return v;
  if (v === null) return null;
  if (Array.isArray(v)) return v.slice(0, MAX_ARR).map((x) => sanitize(x, depth + 1)).filter((x) => x !== undefined);
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (!/^[A-Za-z0-9_]{1,40}$/.test(k)) continue;
      const s = sanitize(val, depth + 1);
      if (s !== undefined) out[k] = s;
    }
    return out;
  }
  return undefined;
}

function merge<T>(fallback: T, raw: unknown): T {
  if (Array.isArray(fallback)) {
    // A stored array always wins — including an emptied one, so the operator
    // can clear every review or ticker line. `undefined` (field predates this
    // schema) falls back to the shipped list.
    return (Array.isArray(raw) ? raw : fallback) as T;
  }
  if (fallback && typeof fallback === 'object') {
    const rawObj = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, fb] of Object.entries(fallback as Record<string, unknown>)) {
      out[k] = merge(fb, rawObj[k]);
    }
    // Keys the defaults do not know — e.g. a static page the operator created
    // after this file shipped. Already sanitized by normalizeContent().
    for (const [k, v] of Object.entries(rawObj)) {
      if (!(k in (fallback as Record<string, unknown>))) out[k] = v;
    }
    return out as T;
  }
  if (typeof fallback === 'string') {
    const r = raw;
    if (typeof r === 'string') return (r.trim() ? r : fallback) as T;
    if (typeof r === 'number' || typeof r === 'boolean') return String(r) as T;
    return fallback;
  }
  if (typeof fallback === 'number') {
    return (typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback) as T;
  }
  if (typeof fallback === 'boolean') {
    return (typeof raw === 'boolean' ? raw : fallback) as T;
  }
  return (raw === undefined ? fallback : (raw as T));
}

/** Public shape: defaults merged with whatever the database answered. */
export function normalizeContent(raw: unknown): SiteContent {
  const clean = sanitize(raw);
  return merge(DEFAULT_SITE_CONTENT, clean);
}

// ─────────────────────────────── load/store ────────────────────────────────

let cached: SiteContent | null = null;
let inFlight: Promise<SiteContent> | null = null;
const listeners = new Set<(c: SiteContent) => void>();

function emit() {
  for (const fn of listeners) fn(cached ?? DEFAULT_SITE_CONTENT);
}

function load(): Promise<SiteContent> {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const { data, error } = await supabase
      .from('store_settings')
      .select('content')
      .maybeSingle();

    // On error keep the defaults: a storefront with no copy is worse than one
    // showing the last known copy, and the defaults ARE the shipped copy.
    cached = normalizeContent(error ? null : (data as { content?: unknown } | null)?.content ?? null);
    // The wa.me number shown in the footer and used by every chat link.
    setWhatsAppNumber(cached.footer.whatsapp);
    return cached;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Called by Admin → Content after a save, so every open tab updates at once. */
export function setSiteContent(raw: unknown) {
  cached = normalizeContent(raw);
  setWhatsAppNumber(cached.footer.whatsapp);
  emit();
}

/** Test seam: drops the cache so the next read refetches. */
export function resetSiteContent() {
  cached = null;
  inFlight = null;
  emit();
}

/**
 * Synchronous accessor for the last loaded copy — used by surfaces that render
 * outside React (SEO JSON-LD) or that must not suspend (admin suggestions).
 * Returns the defaults until the fetch lands.
 */
export function siteContent(): SiteContent {
  return cached ?? DEFAULT_SITE_CONTENT;
}

export function useSiteContent(): { content: SiteContent; ready: boolean } {
  const [content, setContent] = useState<SiteContent>(cached ?? DEFAULT_SITE_CONTENT);
  const [ready, setReady] = useState(Boolean(cached));

  useEffect(() => {
    let alive = true;
    const onChange = (next: SiteContent) => { if (alive) setContent(next); };
    listeners.add(onChange);

    void load().then((next) => {
      if (!alive) return;
      setContent(next);
      setReady(true);
    });

    return () => {
      alive = false;
      listeners.delete(onChange);
    };
  }, []);

  return { content, ready };
}

/** The rotating announcement-bar lines the operator owns (not the shipping line). */
export function announcementExtras(content: SiteContent): string[] {
  return content.announcement.map((s) => s.trim()).filter(Boolean).slice(0, 6);
}

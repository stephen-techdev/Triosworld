import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { siteContent } from '@/lib/siteContent';

interface SEOProps {
  title?: string;
  description?: string;
  ogImage?: string;
  noindex?: boolean;
  jsonLd?: object;
}

const BASE_TITLE = 'TRIOSWORLD — Three Vibes. One World. | Men\'s Streetwear & Tees';
const BASE_DESC = 'Premium Indian men\'s streetwear, graphic tees and everyday essentials. Shop men\'s t-shirts online in India.';
// Public site origin used for canonical URLs, Open Graph and JSON-LD.
// Override with VITE_SITE_URL (e.g. a staging domain) — see .env.
//
// This used to default to triosworld.com, which is not registered: every
// canonical, og:url and JSON-LD item pointed at a domain that answers NXDOMAIN,
// so search engines were being told the real pages were duplicates of a site
// that does not exist. The live domain is triosworld.in (apex redirects to www).
const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://www.triosworld.in';

// Social crawlers reject relative og:image values and cannot read SVG, so the
// default is a raster file joined to the origin.
const DEFAULT_OG_IMAGE = '/og-image.jpg';

/** Absolute URL for a path on this site. */
function absolute(p: string): string {
  if (/^https?:\/\//i.test(p)) return p;
  return `${SITE_URL}${p.startsWith('/') ? '' : '/'}${p}`;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export default function SEO({ title, description, ogImage, noindex, jsonLd }: SEOProps) {
  const { pathname } = useLocation();

  useEffect(() => {
    const fullTitle = title ? `${title} | TRIOSWORLD` : BASE_TITLE;
    document.title = fullTitle;

    const desc = description || BASE_DESC;
    upsertMeta('name', 'description', desc);

    // Canonical is the PAGE, not the origin. The old code wrote SITE_URL for
    // every route, so the entire catalogue declared itself a duplicate of the
    // homepage.
    const path = pathname.replace(/\/+$/, '');
    const pageUrl = `${SITE_URL}${path || '/'}`;
    const image = absolute(ogImage || DEFAULT_OG_IMAGE);

    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', 'TRIOSWORLD');
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:url', pageUrl);
    upsertMeta('property', 'og:image', image);

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', desc);
    upsertMeta('name', 'twitter:image', image);

    if (noindex) {
      upsertMeta('name', 'robots', 'noindex, nofollow');
    } else {
      const existing = document.head.querySelector('meta[name="robots"]');
      if (existing) existing.remove();
    }

    upsertCanonical(pageUrl);
  }, [title, description, ogImage, noindex, pathname]);

  useEffect(() => {
    const existing = document.getElementById('jsonld-dynamic');
    if (existing) existing.remove();
    if (!jsonLd) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'jsonld-dynamic';
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => {
      const el = document.getElementById('jsonld-dynamic');
      if (el) el.remove();
    };
  }, [jsonLd]);

  return null;
}

export function productJsonLd(product: {
  name: string;
  slug: string;
  description: string;
  price: number;
  mrp: number;
  image: string;
}) {
  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: [product.image],
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: product.price,
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/product/${product.slug}`,
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org/',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function organizationJsonLd() {
  // Contact details follow the dashboard (Admin → Content → Footer); the
  // compiled defaults answer until that content has loaded.
  const footer = siteContent().footer;
  return {
    '@context': 'https://schema.org/',
    '@type': 'Organization',
    name: 'TRIOSWORLD',
    url: SITE_URL,
    logo: `${SITE_URL}/og-image.svg`,
    sameAs: footer.socials
      .map(s => s.href.trim())
      .filter(h => /^https:\/\//i.test(h)),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: footer.email,
      areaServed: 'IN',
    },
  };
}

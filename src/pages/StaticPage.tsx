import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import SEO from '@/components/SEO';
import { formatINR } from '@/data/catalog';
import { freeShippingLabel, useStoreSettings, type StoreSettings } from '@/lib/storeSettings';
import { useSiteContent } from '@/lib/siteContent';

/**
 * About, shipping, returns, privacy, terms, contact and FAQs are operator-owned
 * pages now: the copy lives in the `pages` document under Admin → Content and
 * is edited per slug from the dashboard. Until a page is edited there, the
 * rendered text is the shipped copy merged in by siteContent.ts — which is the
 * same wording this file used to hardcode.
 *
 * One paragraph is special: `{{shipping}}` is replaced with a sentence built
 * from the operator's live shipping settings, so the shipping policy keeps
 * agreeing with the checkout until the operator rewrites that paragraph (after
 * which their words win, exactly as they would on any other page).
 */
type Paragraph = { h?: string; p: string };

const shippingLine = (s: StoreSettings, ready: boolean) => {
  if (!ready) return 'Shipping is calculated at checkout. Standard delivery takes 3–5 business days.';
  const free = freeShippingLabel(s, formatINR);
  const feeNote = s.freeShippingThreshold > 0 && s.shippingFee > 0
    ? ` A flat fee of ${formatINR(s.shippingFee)} applies below that threshold.`
    : '';
  return `Standard delivery takes 3–5 business days. ${free}.${feeNote}`;
};

const renderP = (p: string, s: StoreSettings, ready: boolean): string =>
  p.includes('{{shipping}}') ? p.replace(/\{\{shipping\}\}/g, shippingLine(s, ready)) : p;

export default function StaticPage({ page }: { page: string }) {
  const { settings, ready } = useStoreSettings();
  const { content } = useSiteContent();

  const c = content.pages[page];
  if (!c || !c.body?.length) {
    return (
      <div className="page-container py-32 text-center">
        <h1 className="font-display text-3xl mb-3">Page not found</h1>
        <Link to="/home" className="text-ink/60 underline">Back home</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-20">
      <SEO title={c.title} description={`TriosWorld ${c.title} — learn about our policies and practices.`} />
      <nav className="flex items-center gap-1.5 text-xs text-ink/65 mb-6">
        <Link to="/home" className="hover:text-ink">Home</Link><ChevronRight size={12} /><span className="text-ink">{c.title}</span>
      </nav>
      <h1 className="font-display text-3xl md:text-5xl font-semibold mb-8">{c.title}</h1>
      <div className="space-y-6 leading-relaxed text-ink/70">
        {(c.body as Paragraph[]).map((b, i) => (
          <div key={i}>
            {b.h && <h2 className="font-display text-lg font-semibold text-ink mb-2">{b.h}</h2>}
            <p>{renderP(b.p, settings, ready)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

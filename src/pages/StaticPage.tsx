import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import SEO from '@/components/SEO';
import { formatINR } from '@/data/catalog';
import { freeShippingLabel, useStoreSettings, type StoreSettings } from '@/lib/storeSettings';

/**
 * `p` may be a plain string, or a function of the operator's store settings for
 * the few paragraphs that quote a number (shipping fee, free-shipping
 * threshold). Hardcoding those left the shipping policy contradicting the
 * checkout whenever either value was changed.
 */
type Paragraph = { h?: string; p: string | ((s: StoreSettings) => string) };

const content: Record<string, { title: string; body: Paragraph[] }> = {
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
      { h: 'Domestic shipping (India)', p: s => `Standard delivery takes 3–5 business days. ${freeShippingLabel(s, formatINR)}. A flat fee of ${formatINR(s.shippingFee)} applies below that threshold.` },
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
      { h: 'Phone', p: '+91 88836 26787 (Mon–Sat, 10am–7pm IST)' },
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
};

export default function StaticPage({ page }: { page: string }) {
  const { settings } = useStoreSettings();
  const c = content[page];
  if (!c) {
    return (
      <div className="page-container py-32 text-center">
        <h1 className="font-display text-3xl mb-3">Page not found</h1>
        <Link to="/" className="text-ink/60 underline">Back home</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-20">
      <SEO title={c.title} description={`TriosWorld ${c.title} — learn about our policies and practices.`} />
      <nav className="flex items-center gap-1.5 text-xs text-ink/50 mb-6">
        <Link to="/" className="hover:text-ink">Home</Link><ChevronRight size={12} /><span className="text-ink">{c.title}</span>
      </nav>
      <h1 className="font-display text-3xl md:text-5xl font-semibold mb-8">{c.title}</h1>
      <div className="space-y-6 leading-relaxed text-ink/70">
        {c.body.map((b, i) => (
          <div key={i}>
            {b.h && <h2 className="font-display text-lg font-semibold text-ink mb-2">{b.h}</h2>}
            <p>{typeof b.p === 'function' ? b.p(settings) : b.p}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

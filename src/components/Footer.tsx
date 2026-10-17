import { Link } from 'react-router-dom';
import { Instagram, Mail, Phone, MapPin, MessageCircle } from 'lucide-react';
import { Wordmark, TriosMark } from '@/components/Brand';
import Newsletter from '@/components/Newsletter';
import { Reveal } from '@/components/Motion';

const cols = [
  { title: 'Shop', links: [
    { label: 'Shop All', to: '/shop/shop-all' },
    { label: "Men's Tees", to: '/shop/men' },
    { label: 'Oversized', to: '/shop/oversized' },
    { label: 'New Arrivals', to: '/shop/new-arrivals' },
  ]},
  { title: 'Help', links: [
    { label: 'Contact Us', to: '/contact' },
    { label: 'Order Tracking', to: '/account' },
    { label: 'Shipping Policy', to: '/shipping' },
    { label: 'Return Policy', to: '/returns' },
    { label: 'FAQs', to: '/faqs' },
  ]},
  { title: 'Company', links: [
    { label: 'Our Story', to: '/about' },
    { label: 'Collections', to: '/collections' },
    { label: 'Privacy Policy', to: '/privacy' },
    { label: 'Terms & Conditions', to: '/terms' },
  ]},
];

const socials = [
  { href: 'https://instagram.com', label: 'Instagram', Icon: Instagram },
  { href: 'https://wa.me/9190000000000', label: 'WhatsApp', Icon: MessageCircle },
  { href: 'mailto:hello@triosworld.in', label: 'Email', Icon: Mail },
];

export default function Footer() {
  return (
    <footer className="bg-ink text-ivory mt-24">
      <div className="page-container">
        <Newsletter />
        <Reveal className="py-16 grid grid-cols-2 gap-8 sm:gap-10 md:grid-cols-12 md:gap-12">
          <div className="col-span-2 md:col-span-4 space-y-5">
            <Link to="/" className="inline-block text-2xl transition-opacity hover:opacity-80"><Wordmark className="text-ivory" /></Link>
            <p className="text-sm text-ivory/60 max-w-xs leading-relaxed">
              Three vibes, one world. TriosWorld is a contemporary Indian men's fashion label built around essentials, graphics and streetwear — designed for how you express yourself.
            </p>
            <div className="flex items-center gap-3 pt-1">
              {socials.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="w-10 h-10 rounded-full border border-ivory/15 flex items-center justify-center text-ivory/70 hover:text-ink hover:bg-lime hover:border-lime transition-all duration-300 ease-smooth active:scale-95"
                >
                  <Icon size={18} />
                </a>
              ))}
              <span className="text-lime ml-1"><TriosMark className="w-6 h-6" /></span>
            </div>
          </div>
          {cols.map(col => (
            <div key={col.title} className="col-span-1 md:col-span-2">
              <h4 className="text-xs font-semibold tracking-widest uppercase text-ivory/40 mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l.to}>
                    <Link to={l.to} className="link-underline text-sm text-ivory/80 hover:text-lime transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="col-span-2 md:col-span-2 space-y-3">
            <h4 className="text-xs font-semibold tracking-widest uppercase text-ivory/40 mb-4">Contact</h4>
            <p className="text-sm text-ivory/80 flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0" /> Mumbai, India</p>
            <p className="text-sm text-ivory/80 flex items-center gap-2"><Phone size={16} /> +91 90000 00000</p>
            <p className="text-sm text-ivory/80 flex items-center gap-2"><Mail size={16} /> hello@triosworld.in</p>
          </div>
        </Reveal>
        <div className="border-t border-ivory/10 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-ivory/50">
          <p>© {new Date().getFullYear()} TriosWorld. All rights reserved.</p>
          <p>Designed in India. Made for the world.</p>
        </div>
      </div>
    </footer>
  );
}

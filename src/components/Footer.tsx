import { Link } from 'react-router-dom';
import { Instagram, Facebook, Youtube, Mail, Phone, MapPin, LockKeyhole } from 'lucide-react';
import { TriosMark } from '@/components/Brand';
import WhatsAppIcon, { whatsappLink } from '@/components/WhatsApp';
import Newsletter from '@/components/Newsletter';
import { Reveal } from '@/components/Motion';
import { useSiteContent, type SocialIconKey } from '@/lib/siteContent';

/**
 * Columns, contact details, socials and the closing line are all typed in
 * Admin → Content. Until edited there these are the shipped defaults, so the
 * footer looks exactly as it always has.
 */

const SOCIAL_GLYPHS: Record<SocialIconKey, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  whatsapp: WhatsAppIcon as unknown as typeof Instagram,
  mail: Mail,
  youtube: Youtube,
};

/** A typed-in link must not be able to navigate somewhere unexpected. */
function safeHref(href: string): string {
  const h = href.trim();
  if (!h) return '';
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(h)) return h;
  return `https://${h.replace(/^\/+/, '')}`;
}

export default function Footer() {
  const { content } = useSiteContent();
  const footer = content.footer;

  const socialLinks = footer.socials.map(s => {
    const href = safeHref(s.href)
      // An empty href means "use the live channel": the wa.me number or the
      // contact email, both owned by the same footer settings.
      || (s.icon === 'whatsapp'
        ? whatsappLink('Hi TriosWorld 👋')
        : s.icon === 'mail'
          ? `mailto:${footer.email}`
          : '');
    return { ...s, href };
  }).filter(s => s.href);

  return (
    <footer className="bg-ink text-ivory mt-24">
      <div className="page-container">
        <Newsletter />
        <Reveal className="py-16 grid grid-cols-2 gap-8 sm:gap-10 md:grid-cols-12 md:gap-12">
          <div className="col-span-2 md:col-span-4 space-y-5">
            <Link to="/home" className="inline-block text-2xl transition-opacity hover:opacity-80"><img src="/logo-ivory.png" alt="TriosWorld" className="h-9 w-auto" /></Link>
            <p className="text-sm text-ivory/60 max-w-xs leading-relaxed">
              {footer.blurb}
            </p>
            <div className="flex items-center gap-3 pt-1">
              {socialLinks.map(({ href, label, icon }) => {
                const Icon = SOCIAL_GLYPHS[icon] ?? Instagram;
                return (
                  <a
                    key={`${label}-${href}`}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="w-10 h-10 rounded-full border border-ivory/15 flex items-center justify-center text-ivory/70 hover:text-ink hover:bg-lime hover:border-lime transition-all duration-300 ease-smooth active:scale-95"
                  >
                    <Icon size={18} />
                  </a>
                );
              })}
              <span className="text-lime ml-1"><TriosMark className="w-6 h-6" /></span>
            </div>
          </div>
          {footer.columns.map(col => (
            <div key={col.title} className="col-span-1 md:col-span-2">
              <h3 className="text-xs font-semibold tracking-widest uppercase text-ivory/60 mb-4">{col.title}</h3>
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
            <h3 className="text-xs font-semibold tracking-widest uppercase text-ivory/60 mb-4">Contact</h3>
            {footer.address && (
              <p className="text-sm text-ivory/80 flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0" /> {footer.address}</p>
            )}
            {footer.phone && (
              <p className="text-sm text-ivory/80 flex items-center gap-2"><Phone size={16} /> {footer.phone}</p>
            )}
            {footer.email && (
              <p className="text-sm text-ivory/80 flex items-center gap-2"><Mail size={16} /> {footer.email}</p>
            )}

            {/* WhatsApp CTA — right side of the footer */}
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noreferrer"
              aria-label="Chat with us on WhatsApp"
              className="mt-2 flex items-start gap-2.5 rounded-2xl border border-lime/25 bg-lime/10 p-3.5 transition-all duration-300 ease-smooth hover:bg-lime/20 active:scale-[0.98]"
            >
              <WhatsAppIcon size={22} className="mt-0.5 shrink-0 text-lime" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug text-ivory">
                  Chat with us on WhatsApp
                </span>
              </span>
            </a>
          </div>
        </Reveal>
        <div className="border-t border-ivory/10 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-ivory/50">
          <p>© {new Date().getFullYear()} TriosWorld. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <p>{footer.note}</p>
            {/* Operator entry point. Leads to /admin/login, where the
                credentials are checked server-side by the trios-admin
                function — this link grants nothing on its own. */}
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-1.5 rounded-full border border-ivory/15 px-3 py-1.5 text-ivory/50 transition-colors hover:border-lime/40 hover:text-lime"
            >
              <LockKeyhole size={12} aria-hidden="true" />
              Admin access
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

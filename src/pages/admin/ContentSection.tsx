import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Plus, X, Loader2, Check, Save, Upload, type LucideIcon,
  Megaphone, LayoutTemplate, Image as ImageIcon, Rows3, PackageCheck,
  FileText, PanelBottom, Sparkles,
} from 'lucide-react';
import {
  AdminAuthError, getSettings, saveSettings, uploadProductImage,
} from '@/lib/admin';
import {
  normalizeContent, setSiteContent,
  type SiteContent, type BenefitIconKey, type SocialIconKey,
} from '@/lib/siteContent';

/**
 * Admin → Content: the whole storefront outside the products.
 *
 * Every headline, blurb, image, offer line, review, footer link and static page
 * the customer sees is edited here and saved as one JSONB document on the
 * store_settings singleton (the same row that already owns shipping). The
 * Settings tab never touches `content` and this tab never touches the shipping
 * figures, so one form cannot overwrite the other.
 *
 * The form always opens on the merged document: fields the database has never
 * stored show the shipped defaults, so the operator edits the copy that is
 * actually on screen rather than blanks.
 */

const input =
  'w-full rounded-lg border border-ink/15 px-3 py-2 text-sm bg-ivory focus:outline-none focus:border-ink';
const labelCls = 'block text-[11px] font-medium text-ink/50 mb-1';

const BENEFIT_ICON_KEYS: BenefitIconKey[] = [
  'shield', 'badge', 'truck', 'headphones', 'refresh', 'lock', 'star', 'globe', 'heart', 'zap',
];
const SOCIAL_ICON_KEYS: SocialIconKey[] = ['instagram', 'facebook', 'whatsapp', 'mail', 'youtube'];
const PAGE_SLUGS = ['about', 'shipping', 'returns', 'privacy', 'terms', 'contact', 'faqs'] as const;

// ───────────────────────────── small editors ───────────────────────────────

function Field({ label, value, onChange, placeholder, hint, type = 'text' }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className={input} />
      {hint && <span className="mt-1 block text-[10px] text-ink/40 leading-relaxed">{hint}</span>}
    </label>
  );
}

function Area({ label, value, onChange, rows = 3, hint }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <textarea value={value} rows={rows} onChange={e => onChange(e.target.value)} className={`${input} leading-relaxed`} />
      {hint && <span className="mt-1 block text-[10px] text-ink/40 leading-relaxed">{hint}</span>}
    </label>
  );
}

/** A string[] edited as one line per entry (headings, ticker lines, blurb lists). */
function LinesField({ label, value, onChange, hint, rows = 3 }: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  hint?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <textarea
        value={value.join('\n')}
        rows={rows}
        onChange={e => onChange(e.target.value.split('\n'))}
        className={`${input} leading-relaxed`}
      />
      <span className="mt-1 block text-[10px] text-ink/40 leading-relaxed">{hint}</span>
    </label>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className={input}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** URL field + direct upload through the admin function (no public writes). */
function ImageField({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error('That file is over 4MB — compress it first.');
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('Could not read that file'));
        reader.readAsDataURL(file);
      });
      const res = await uploadProductImage(file.name, file.type, data);
      onChange(res.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="flex items-start gap-2">
        <input value={value} placeholder="https://…" onChange={e => onChange(e.target.value)} className={input} />
        <label className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-ink/20 px-3 py-2 text-[11px] font-medium hover:border-ink cursor-pointer transition">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {busy ? 'Uploading' : 'Upload'}
          <input type="file" accept="image/*" className="sr-only" onChange={e => pick(e.target.files)} />
        </label>
      </div>
      {err && <p className="mt-1 text-[10px] text-red-600">{err}</p>}
      {value && (
        <img src={value} alt="" className="mt-2 h-24 w-20 rounded border border-ink/10 object-cover bg-stone/40" />
      )}
    </div>
  );
}

/** Collapsible group — keeps a very long form scannable on a phone. */
function Group({ icon: Icon, title, hint, defaultOpen = false, children }: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-ink/10 bg-ivory overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 md:px-5 py-4 text-left hover:bg-stone/30 transition"
      >
        <span className="w-8 h-8 rounded-lg bg-ink text-lime grid place-items-center shrink-0"><Icon size={15} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          {hint && <span className="block text-[11px] text-ink/45 truncate">{hint}</span>}
        </span>
        <span className={`text-ink/40 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}><Plus size={16} /></span>
      </button>
      {open && <div className="px-4 md:px-5 pb-5 pt-1 space-y-4 border-t border-ink/8">{children}</div>}
    </section>
  );
}

function ListRow({ onRemove, children }: { onRemove: () => void; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-stone/25 p-3 space-y-2">
      {children}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:underline"
        >
          <X size={12} /> Remove
        </button>
      </div>
    </div>
  );
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink/60 hover:text-ink border border-dashed border-ink/20 hover:border-ink/40 rounded-lg px-3 py-1.5 transition"
    >
      <Plus size={13} /> {label}
    </button>
  );
}

// ───────────────────────────── the section ─────────────────────────────────

export default function ContentSection({ onAuthFail }: { onAuthFail: () => void }) {
  const [content, setContent] = useState<SiteContent | null>(null);
  const baseline = useRef<string>('');
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getSettings();
      const merged = normalizeContent(res.settings.content);
      setContent(merged);
      baseline.current = JSON.stringify(merged);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthFail(); return; }
      setError(e instanceof Error ? e.message : 'Could not load the content document');
    }
  }, [onAuthFail]);

  useEffect(() => { void load(); }, [load]);

  const patch = (p: Partial<SiteContent>) => setContent(c => (c ? { ...c, ...p } : c));

  const dirty = content !== null && JSON.stringify(content) !== baseline.current;

  const save = async () => {
    if (!content) return;
    setState('saving');
    setError(null);
    try {
      const res = await saveSettings({ content });
      const saved = normalizeContent(res.settings.content);
      setContent(saved);
      baseline.current = JSON.stringify(saved);
      // Push the new copy into the live storefront cache immediately, so the
      // open preview tab (and the wa.me number) update without a reload.
      setSiteContent(res.settings.content);
      setLastSaved(new Date().toISOString());
      setState('done');
      setTimeout(() => setState('idle'), 2200);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthFail(); return; }
      setError(e instanceof Error ? e.message : 'Could not save the content');
      setState('idle');
    }
  };

  if (!content) {
    return (
      <div className="py-20 grid place-items-center text-ink/40">
        {error ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={() => void load()} className="text-sm underline">Try again</button>
          </div>
        ) : (
          <Loader2 size={22} className="animate-spin" />
        )}
      </div>
    );
  }

  const c = content;
  const setC = (fn: (prev: SiteContent) => SiteContent) => setContent(prev => (prev ? fn(prev) : prev));

  return (
    <div className="space-y-5">
      {/* Header + save */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Content</h2>
          <p className="text-sm text-ink/55 mt-1">
            Everything the storefront says and shows — hero, offers, categories, reviews, footer, pages.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-[11px] text-ink/40">
              Saved {new Date(lastSaved).toLocaleTimeString('en-IN')}
            </span>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || state === 'saving'}
            className="inline-flex items-center gap-2 rounded-full bg-ink text-ivory px-5 py-2.5 text-sm font-semibold hover:bg-ink/80 transition disabled:opacity-40"
          >
            {state === 'saving'
              ? <Loader2 size={15} className="animate-spin" />
              : state === 'done'
                ? <><Check size={15} /> Saved</>
                : <><Save size={15} /> Save content</>}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

      {/* ── Announcement + newsletter ───────────────────────────── */}
      <Group icon={Megaphone} title="Announcement bar & newsletter"
        hint="Rotating top-bar lines and the footer subscribe block" defaultOpen>
        <LinesField
          label="Extra announcement lines (line 1 stays your shipping/announcement setting)"
          value={c.announcement}
          onChange={v => patch({ announcement: v })}
          rows={2}
          hint="One per line, rotating. Leave all blank to show only the main line."
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Newsletter heading" value={c.newsletter.heading}
            onChange={v => setC(p => ({ ...p, newsletter: { ...p.newsletter, heading: v } }))} />
          <Field label="Newsletter fine print" value={c.newsletter.disclaimer}
            onChange={v => setC(p => ({ ...p, newsletter: { ...p.newsletter, disclaimer: v } }))} />
        </div>
        <Area label="Newsletter subtitle" value={c.newsletter.sub} rows={2}
          onChange={v => setC(p => ({ ...p, newsletter: { ...p.newsletter, sub: v } }))} />
      </Group>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <Group icon={LayoutTemplate} title="Homepage hero" hint="Eyebrow, headline, subtitle and buttons" defaultOpen>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Eyebrow (small line above)" value={c.hero.eyebrow}
            onChange={v => setC(p => ({ ...p, hero: { ...p.hero, eyebrow: v } }))} />
          <ImageField label="Hero image" value={c.hero.image}
            onChange={v => setC(p => ({ ...p, hero: { ...p.hero, image: v } }))} />
        </div>
        <LinesField label="Headline — one line each (big text)" value={c.hero.titleLines}
          onChange={v => setC(p => ({ ...p, hero: { ...p.hero, titleLines: v } }))}
          hint="Each line becomes its own row. Two or three short lines look best." />
        <Area label="Subtitle" value={c.hero.subtitle} rows={2}
          onChange={v => setC(p => ({ ...p, hero: { ...p.hero, subtitle: v } }))} />
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Primary button" value={c.hero.ctaPrimaryLabel}
              onChange={v => setC(p => ({ ...p, hero: { ...p.hero, ctaPrimaryLabel: v } }))} />
            <Field label="Goes to" value={c.hero.ctaPrimaryTo}
              onChange={v => setC(p => ({ ...p, hero: { ...p.hero, ctaPrimaryTo: v } }))} />
            <div />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Secondary button" value={c.hero.ctaSecondaryLabel}
              onChange={v => setC(p => ({ ...p, hero: { ...p.hero, ctaSecondaryLabel: v } }))} />
            <Field label="Goes to" value={c.hero.ctaSecondaryTo}
              onChange={v => setC(p => ({ ...p, hero: { ...p.hero, ctaSecondaryTo: v } }))} />
            <div />
          </div>
        </div>
        <p className="text-[10px] text-ink/40">
          “Goes to” accepts site paths (/shop/new-arrivals) or full URLs (https://…).
        </p>
      </Group>

      {/* ── Ticker ──────────────────────────────────────────────── */}
      <Group icon={Rows3} title="Scrolling ticker" hint="The marquee strip under the hero">
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" checked={c.ticker.showFreeShipping}
            onChange={e => setC(p => ({ ...p, ticker: { ...p.ticker, showFreeShipping: e.target.checked } }))}
            className="w-4 h-4 accent-ink" />
          Show the live free-shipping line first (built from your shipping settings)
        </label>
        <LinesField label="Ticker lines" value={c.ticker.items}
          onChange={v => setC(p => ({ ...p, ticker: { ...p.ticker, items: v } }))}
          rows={4}
          hint="One per line. Leave blank (with the box above off) to hide the ticker." />
      </Group>

      {/* ── Category cards ──────────────────────────────────────── */}
      <Group icon={ImageIcon} title="Category cards" hint={`${c.categories.length} cards — homepage grid and /collections`}
        defaultOpen>
        <div className="space-y-3">
          {c.categories.map((cat, i) => (
            <ListRow key={i} onRemove={() => setC(p => ({ ...p, categories: p.categories.filter((_, k) => k !== i) }))}>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Name" value={cat.name}
                  onChange={v => setC(p => ({ ...p, categories: p.categories.map((x, k) => k === i ? { ...x, name: v } : x) }))} />
                <Field label="URL slug" value={cat.slug} placeholder="oversized"
                  onChange={v => setC(p => ({ ...p, categories: p.categories.map((x, k) => k === i ? { ...x, slug: v.trim().toLowerCase() } : x) }))} />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button"
                    disabled={i === 0}
                    onClick={() => setC(p => {
                      const arr = [...p.categories];
                      [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                      return { ...p, categories: arr };
                    })}
                    className="h-9 rounded-lg border border-ink/15 text-[11px] hover:border-ink disabled:opacity-30">
                    ↑ Earlier
                  </button>
                  <button type="button"
                    disabled={i === c.categories.length - 1}
                    onClick={() => setC(p => {
                      const arr = [...p.categories];
                      [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
                      return { ...p, categories: arr };
                    })}
                    className="h-9 rounded-lg border border-ink/15 text-[11px] hover:border-ink disabled:opacity-30">
                    ↓ Later
                  </button>
                </div>
              </div>
              <Area label="Blurb" value={cat.blurb} rows={1}
                onChange={v => setC(p => ({ ...p, categories: p.categories.map((x, k) => k === i ? { ...x, blurb: v } : x) }))} />
              <ImageField label="Card image" value={cat.image}
                onChange={v => setC(p => ({ ...p, categories: p.categories.map((x, k) => k === i ? { ...x, image: v } : x) }))} />
            </ListRow>
          ))}
        </div>
        <AddRow label="Add category card" onClick={() => setC(p => ({
          ...p,
          categories: [...p.categories, { slug: '', name: '', blurb: '', image: '' }],
        }))} />
      </Group>

      {/* ── Home section headings + editorial/story/benefits ────── */}
      <Group icon={Sparkles} title="Home sections" hint="Headings, editorial split, story block, benefit tiles" defaultOpen>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Categories heading" value={c.categoriesHeading.title}
            onChange={v => setC(p => ({ ...p, categoriesHeading: { ...p.categoriesHeading, title: v } }))} />
          <Field label="Categories subline" value={c.categoriesHeading.sub}
            onChange={v => setC(p => ({ ...p, categoriesHeading: { ...p.categoriesHeading, sub: v } }))} />
          <Field label="Bestsellers heading" value={c.bestsellersHeading}
            onChange={v => patch({ bestsellersHeading: v })} />
          <Field label="New drops heading" value={c.newDropsHeading}
            onChange={v => patch({ newDropsHeading: v })} />
        </div>

        <div className="pt-2 border-t border-ink/8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink/40">Editorial split</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Kicker" value={c.editorial.kicker}
              onChange={v => setC(p => ({ ...p, editorial: { ...p.editorial, kicker: v } }))} />
            <ImageField label="Image" value={c.editorial.image}
              onChange={v => setC(p => ({ ...p, editorial: { ...p.editorial, image: v } }))} />
          </div>
          <LinesField label="Heading — one line each" value={c.editorial.titleLines}
            onChange={v => setC(p => ({ ...p, editorial: { ...p.editorial, titleLines: v } }))} rows={3} />
          <Area label="Body" value={c.editorial.body} rows={3}
            onChange={v => setC(p => ({ ...p, editorial: { ...p.editorial, body: v } }))} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Button label" value={c.editorial.ctaLabel}
              onChange={v => setC(p => ({ ...p, editorial: { ...p.editorial, ctaLabel: v } }))} />
            <Field label="Button link" value={c.editorial.ctaTo}
              onChange={v => setC(p => ({ ...p, editorial: { ...p.editorial, ctaTo: v } }))} />
          </div>
        </div>

        <div className="pt-2 border-t border-ink/8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink/40">Brand story</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Kicker" value={c.story.kicker}
              onChange={v => setC(p => ({ ...p, story: { ...p.story, kicker: v } }))} />
            <ImageField label="Image" value={c.story.image}
              onChange={v => setC(p => ({ ...p, story: { ...p.story, image: v } }))} />
          </div>
          <LinesField label="Heading — one line each" value={c.story.titleLines}
            onChange={v => setC(p => ({ ...p, story: { ...p.story, titleLines: v } }))} rows={2} />
          <LinesField label="Paragraphs (one per line)" value={c.story.paragraphs}
            onChange={v => setC(p => ({ ...p, story: { ...p.story, paragraphs: v } }))}
            rows={4}
            hint="Long paragraphs can be split across lines — each line is its own paragraph." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Link label" value={c.story.ctaLabel}
              onChange={v => setC(p => ({ ...p, story: { ...p.story, ctaLabel: v } }))} />
            <Field label="Link" value={c.story.ctaTo}
              onChange={v => setC(p => ({ ...p, story: { ...p.story, ctaTo: v } }))} />
          </div>
        </div>

        <div className="pt-2 border-t border-ink/8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink/40">Benefit tiles</p>
          <div className="space-y-3">
            {c.benefits.map((b, i) => (
              <ListRow key={i} onRemove={() => setC(p => ({ ...p, benefits: p.benefits.filter((_, k) => k !== i) }))}>
                <div className="grid sm:grid-cols-3 gap-3">
                  <SelectField label="Icon" value={b.icon}
                    options={BENEFIT_ICON_KEYS.map(k => ({ value: k, label: k }))}
                    onChange={v => setC(p => ({ ...p, benefits: p.benefits.map((x, k) => k === i ? { ...x, icon: v as BenefitIconKey } : x) }))} />
                  <Field label="Title" value={b.title}
                    onChange={v => setC(p => ({ ...p, benefits: p.benefits.map((x, k) => k === i ? { ...x, title: v } : x) }))} />
                  <Field label="Line" value={b.text}
                    onChange={v => setC(p => ({ ...p, benefits: p.benefits.map((x, k) => k === i ? { ...x, text: v } : x) }))} />
                </div>
              </ListRow>
            ))}
          </div>
          <AddRow label="Add benefit" onClick={() => setC(p => ({
            ...p, benefits: [...p.benefits, { icon: 'star', title: '', text: '' }],
          }))} />
        </div>
      </Group>

      {/* ── Product page ────────────────────────────────────────── */}
      <Group icon={PackageCheck} title="Product page" hint="Size guide, reviews, promises, returns line">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink/40">Size guide (3 columns)</p>
          <p className="text-[10px] text-ink/40 -mt-2">First row is the header. Delete every row to hide the size guide.</p>
          {c.pdp.sizeGuide.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              {[0, 1, 2].map(j => (
                <input
                  key={j}
                  value={row[j] ?? ''}
                  placeholder={['Size', 'Chest (in)', 'Length (in)'][j]}
                  onChange={e => setC(p => ({
                    ...p,
                    pdp: {
                      ...p.pdp,
                      sizeGuide: p.pdp.sizeGuide.map((r, k) => k === i
                        ? (() => { const next = [...r]; next[j] = e.target.value; return next; })()
                        : r),
                    },
                  }))}
                  className={`${input} ${j === 0 ? 'w-24 shrink-0' : ''}`}
                />
              ))}
              <button type="button" aria-label="Remove row"
                onClick={() => setC(p => ({ ...p, pdp: { ...p.pdp, sizeGuide: p.pdp.sizeGuide.filter((_, k) => k !== i) } }))}
                className="shrink-0 w-8 h-8 rounded-full border border-ink/10 text-ink/40 hover:text-red-600 grid place-items-center">
                <X size={13} />
              </button>
            </div>
          ))}
          <AddRow label="Add row" onClick={() => setC(p => ({ ...p, pdp: { ...p.pdp, sizeGuide: [...p.pdp.sizeGuide, ['', '', '']] } }))} />
        </div>

        <div className="pt-2 border-t border-ink/8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink/40">
            Reviews — the rating on the page is the average of these
          </p>
          <p className="text-[10px] text-ink/40 -mt-2">With no reviews saved, the product page shows no rating at all.</p>
          {c.pdp.reviews.map((r, i) => (
            <ListRow key={i} onRemove={() => setC(p => ({ ...p, pdp: { ...p.pdp, reviews: p.pdp.reviews.filter((_, k) => k !== i) } }))}>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Name" value={r.name}
                  onChange={v => setC(p => ({ ...p, pdp: { ...p.pdp, reviews: p.pdp.reviews.map((x, k) => k === i ? { ...x, name: v } : x) } }))} />
                <SelectField label="Stars" value={String(r.rating)}
                  options={[5, 4, 3, 2, 1].map(n => ({ value: String(n), label: `${n} star${n > 1 ? 's' : ''}` }))}
                  onChange={v => setC(p => ({ ...p, pdp: { ...p.pdp, reviews: p.pdp.reviews.map((x, k) => k === i ? { ...x, rating: Number(v) } : x) } }))} />
                <div />
              </div>
              <Area label="Review text" value={r.text} rows={2}
                onChange={v => setC(p => ({ ...p, pdp: { ...p.pdp, reviews: p.pdp.reviews.map((x, k) => k === i ? { ...x, text: v } : x) } }))} />
            </ListRow>
          ))}
          <AddRow label="Add review" onClick={() => setC(p => ({
            ...p, pdp: { ...p.pdp, reviews: [...p.pdp.reviews, { name: '', rating: 5, text: '' }] },
          }))} />
        </div>

        <div className="pt-2 border-t border-ink/8 grid sm:grid-cols-2 gap-3">
          <LinesField label="Promise tiles (max 3)" value={c.pdp.promises}
            onChange={v => setC(p => ({ ...p, pdp: { ...p.pdp, promises: v } }))}
            rows={3}
            hint="The short line under each tile: shipping, returns, payment." />
          <Area label="Returns line (Delivery & Returns tab)" value={c.pdp.returnsLine} rows={3}
            onChange={v => setC(p => ({ ...p, pdp: { ...p.pdp, returnsLine: v } }))} />
        </div>
      </Group>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <Group icon={PanelBottom} title="Footer" hint="Blurb, link columns, contact details, socials" defaultOpen>
        <Area label="Blurb (under the logo)" value={c.footer.blurb} rows={3}
          onChange={v => setC(p => ({ ...p, footer: { ...p.footer, blurb: v } }))} />
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Address" value={c.footer.address}
            onChange={v => setC(p => ({ ...p, footer: { ...p.footer, address: v } }))} />
          <Field label="Phone (displayed)" value={c.footer.phone}
            onChange={v => setC(p => ({ ...p, footer: { ...p.footer, phone: v } }))} />
          <Field label="Email" value={c.footer.email}
            onChange={v => setC(p => ({ ...p, footer: { ...p.footer, email: v } }))} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="WhatsApp number (country code, digits only)" value={c.footer.whatsapp}
            placeholder="918883626787"
            onChange={v => setC(p => ({ ...p, footer: { ...p.footer, whatsapp: v } }))} />
          <Field label="Closing line (next to ©)" value={c.footer.note}
            onChange={v => setC(p => ({ ...p, footer: { ...p.footer, note: v } }))} />
        </div>

        <div className="pt-2 border-t border-ink/8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink/40">Link columns</p>
          <div className="space-y-3">
            {c.footer.columns.map((col, i) => (
              <ListRow key={i} onRemove={() => setC(p => ({ ...p, footer: { ...p.footer, columns: p.footer.columns.filter((_, k) => k !== i) } }))}>
                <Field label="Column title" value={col.title}
                  onChange={v => setC(p => ({ ...p, footer: { ...p.footer, columns: p.footer.columns.map((x, k) => k === i ? { ...x, title: v } : x) } }))} />
                {col.links.map((l, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <input value={l.label} placeholder="Label"
                      onChange={e => setC(p => ({ ...p, footer: { ...p.footer, columns: p.footer.columns.map((x, k) => k === i ? { ...x, links: x.links.map((y, n) => n === j ? { ...y, label: e.target.value } : y) } : x) } }))} className={input} />
                    <input value={l.to} placeholder="/shop/oversized"
                      onChange={e => setC(p => ({ ...p, footer: { ...p.footer, columns: p.footer.columns.map((x, k) => k === i ? { ...x, links: x.links.map((y, n) => n === j ? { ...y, to: e.target.value } : y) } : x) } }))} className={input} />
                    <button type="button" aria-label="Remove link"
                      onClick={() => setC(p => ({ ...p, footer: { ...p.footer, columns: p.footer.columns.map((x, k) => k === i ? { ...x, links: x.links.filter((_, n) => n !== j) } : x) } }))}
                      className="shrink-0 w-8 h-8 rounded-full border border-ink/10 text-ink/40 hover:text-red-600 grid place-items-center">
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <AddRow label="Add link" onClick={() => setC(p => ({
                  ...p,
                  footer: {
                    ...p.footer,
                    columns: p.footer.columns.map((x, k) => k === i ? { ...x, links: [...x.links, { label: '', to: '' }] } : x),
                  },
                }))} />
              </ListRow>
            ))}
          </div>
          <AddRow label="Add column" onClick={() => setC(p => ({
            ...p, footer: { ...p.footer, columns: [...p.footer.columns, { title: '', links: [] }] },
          }))} />
        </div>

        <div className="pt-2 border-t border-ink/8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink/40">Social icons</p>
          <div className="space-y-3">
            {c.footer.socials.map((s, i) => (
              <ListRow key={i} onRemove={() => setC(p => ({ ...p, footer: { ...p.footer, socials: p.footer.socials.filter((_, k) => k !== i) } }))}>
                <div className="grid sm:grid-cols-3 gap-3">
                  <SelectField label="Icon" value={s.icon}
                    options={SOCIAL_ICON_KEYS.map(k => ({ value: k, label: k }))}
                    onChange={v => setC(p => ({ ...p, footer: { ...p.footer, socials: p.footer.socials.map((x, k) => k === i ? { ...x, icon: v as SocialIconKey } : x) } }))} />
                  <Field label="Label (hover text)" value={s.label}
                    onChange={v => setC(p => ({ ...p, footer: { ...p.footer, socials: p.footer.socials.map((x, k) => k === i ? { ...x, label: v } : x) } }))} />
                  <Field label="Link (blank = live channel)" value={s.href} placeholder="https://instagram.com/…"
                    onChange={v => setC(p => ({ ...p, footer: { ...p.footer, socials: p.footer.socials.map((x, k) => k === i ? { ...x, href: v } : x) } }))} />
                </div>
              </ListRow>
            ))}
          </div>
          <AddRow label="Add social" onClick={() => setC(p => ({
            ...p, footer: { ...p.footer, socials: [...p.footer.socials, { icon: 'instagram', label: '', href: '' }] },
          }))} />
        </div>
      </Group>

      {/* ── Static pages ────────────────────────────────────────── */}
      <StaticPagesEditor content={c} onChange={patch} />

      {/* Bottom save — the form is long, so the action repeats here. */}
      <div className="flex justify-end pb-6">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || state === 'saving'}
          className="inline-flex items-center gap-2 rounded-full bg-ink text-ivory px-6 py-3 text-sm font-semibold hover:bg-ink/80 transition disabled:opacity-40"
        >
          {state === 'saving'
            ? <Loader2 size={15} className="animate-spin" />
            : state === 'done'
              ? <><Check size={15} /> Saved</>
              : <><Save size={15} /> Save content</>}
        </button>
      </div>
    </div>
  );
}

/** About / shipping / returns / privacy / terms / contact / FAQs, per slug. */
function StaticPagesEditor({ content, onChange }: {
  content: SiteContent;
  onChange: (p: Partial<SiteContent>) => void;
}) {
  const pages = content.pages;
  const slugs = [...new Set([...PAGE_SLUGS, ...Object.keys(pages)])];
  const [active, setActive] = useState<string>('about');
  const page = pages[active];

  return (
    <Group icon={FileText} title="Static pages" hint="About, shipping, returns, privacy, terms, contact, FAQs">
      <SelectField
        label="Page"
        value={active}
        options={slugs.map(s => ({
          value: s,
          label: s === active && pages[s] ? `${s} — ${pages[s].title}` : s,
        }))}
        onChange={setActive}
      />
      {page ? (
        <div className="space-y-3">
          <Field label="Page title" value={page.title}
            onChange={v => onChange({ pages: { ...pages, [active]: { ...page, title: v } } })} />
          <p className="text-[10px] text-ink/40">
            Each block is a heading (optional) plus its paragraph. The shipping page may contain
            {' {{shipping}}'} — it renders your live shipping figures until you rewrite it.
          </p>
          {page.body.map((b, i) => (
            <ListRow key={i}
              onRemove={() => onChange({ pages: { ...pages, [active]: { ...page, body: page.body.filter((_, k) => k !== i) } } })}>
              <Field label="Heading (optional)" value={b.h ?? ''}
                onChange={v => onChange({
                  pages: {
                    ...pages,
                    [active]: { ...page, body: page.body.map((x, k) => k === i ? { ...x, h: v || undefined } : x) },
                  },
                })} />
              <Area label="Paragraph" value={b.p} rows={3}
                onChange={v => onChange({
                  pages: {
                    ...pages,
                    [active]: { ...page, body: page.body.map((x, k) => k === i ? { ...x, p: v } : x) },
                  },
                })} />
            </ListRow>
          ))}
          <AddRow label="Add paragraph" onClick={() => onChange({
            pages: { ...pages, [active]: { ...page, body: [...page.body, { p: '' }] } },
          })} />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink/50">This page has no content yet.</p>
          <button
            type="button"
            onClick={() => onChange({ pages: { ...pages, [active]: { title: active, body: [{ p: '' }] } } })}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium border border-dashed border-ink/20 hover:border-ink/40 rounded-lg px-3 py-1.5 transition"
          >
            <Plus size={13} /> Create “{active}”
          </button>
        </div>
      )}
    </Group>
  );
}

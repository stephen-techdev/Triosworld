/**
 * Storefront product source.
 *
 * The storefront serves ONLY products created in the admin dashboard. A card
 * exists if it was created there and has not been deleted.
 *
 * The 12 products that live in src/data/catalog.ts are retired. They are code,
 * not database rows, so they are excluded from the shop and from the admin
 * product list. Only their constants — sizes, colours, categories, the currency
 * formatter — are still used, which is why PRODUCTS itself is no longer read.
 *
 * Because this list arrives from the database, the first paint is empty and the
 * real cards follow. Anything that must not flash a wrong state (the cart
 * total, the product page) reads `ready` from useLiveCatalog() instead.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/store/AuthContext';
import {
  SIZES, COLORS, type Product, type Badge, type Fit, type Fabric, type Gender,
} from '@/data/catalog';
import { hexForColorName } from '@/lib/colors';

interface RuntimeRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  mrp: number | null;
  category: string | null;
  colors: unknown;
  stock: unknown;
  images: unknown;
  is_active: boolean;
  care: string | null;
  fit: string | null;
  fabric: string | null;
  badge: string | null;
  bestseller: boolean;
  new_arrival: boolean;
  created_at: string | null;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

/** Case-insensitive lookup for the brand's known colour names. */function knownHex(name: string): string {
  const k = name.trim().toLowerCase();
  return (
    hexForColorName(k) ??
    COLORS.find((c) => c.name.toLowerCase() === k)?.hex ??
    '#171717'
  );
}

/**
 * Colours are { name, hex } pairs chosen in the dashboard colour picker.
 *
 * Bare-name rows (written before the picker existed) still resolve through the
 * brand colour list, and anything unknown falls back to ink rather than
 * rendering a swatch with no colour at all. This is the fix for swatches that
 * all showed #171717 regardless of what was entered in admin.
 *
 * A colour may also carry its own per-size stock (`sizes`), which is what lets
 * Blue-M be available while Blue-L is sold out.
 */
function asColors(v: unknown): { name: string; hex: string; sizes?: Record<string, number> }[] {
  if (!Array.isArray(v)) return [];
  const out: { name: string; hex: string; sizes?: Record<string, number> }[] = [];
  for (const entry of v) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const name = String((entry as { name?: unknown }).name ?? '').trim();
      if (!name) continue;
      const raw = String((entry as { hex?: unknown }).hex ?? '').trim().toLowerCase();
      const hex = /^#[0-9a-f]{6}$/.test(raw) ? raw : knownHex(name);
      const sizes = asStock((entry as { sizes?: unknown }).sizes);
      out.push(Object.keys(sizes).length ? { name, hex, sizes } : { name, hex });
    } else if (typeof entry === 'string' && entry.trim()) {
      const name = entry.trim();
      out.push({ name, hex: knownHex(name) });
    }
  }
  return out;
}

function asStock(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    const num = Number(n);
    if (Number.isFinite(num)) out[k] = num;
  }
  return out;
}

/**
 * Flatten a runtime row into the same shape as a coded product so every card,
 * size picker and cart line works unchanged.
 *
 * Colour → photo
 *   The operator uploads one photo per colour, in the same order as the
 *   colours, then any extra detail or group shots afterwards. With at least as
 *   many photos as colours, the photo at a colour's index is that colour's
 *   photo: tapping "Blue" shows the blue shirt. Extra photos stay in the full
 *   gallery but are not owned by a colour.
 *
 *   If there are fewer photos than colours, no colour can claim a photo, so
 *   the whole gallery stays shared. Nothing is ever dropped from the gallery.
 */
function colorImageFor(index: number, colors: number, images: string[]): string | undefined {
  if (colors > 1 && images.length >= colors) return images[index];
  return undefined;
}

/**
 * Build one variant's size list.
 *
 * When the colour carries its own per-size stock that wins, so Blue can have M
 * in stock while Blue-L is sold out. When it does not (every product saved
 * before per-colour stock existed) the whole product shares one list, exactly
 * as before. Sizes are ordered the way the storefront renders them, and any
 * size the operator never set shows 0 — out of stock, not dropped.
 */
function sizesForColor(
  color: { sizes?: Record<string, number> },
  shared: Record<string, number>,
): { size: string; stock: number }[] {
  const table = color.sizes && Object.keys(color.sizes).length ? color.sizes : shared;
  const has = Object.keys(table).length > 0;
  const known = SIZES.filter((s) => has && s in table).map((s) => ({ size: s, stock: table[s] }));
  const extra = has
    ? Object.keys(table).filter((s) => !SIZES.includes(s)).sort().map((s) => ({ size: s, stock: table[s] }))
    : [];
  const list = [...known, ...extra];
  return list.length ? list : SIZES.map((size) => ({ size, stock: 0 }));
}

function toProduct(row: RuntimeRow): Product {
  const images = asStringArray(row.images);
  const colors = asColors(row.colors);
  const stock = asStock(row.stock);

  const variants = (colors.length ? colors : [{ name: 'Default', hex: '#171717' }]).map((c, i) => ({
    color: c.name,
    hex: c.hex,
    images,
    colorImage: colorImageFor(i, colors.length || 1, images),
    sizes: sizesForColor(c, stock),
  }));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    gender: 'men' as Gender,
    categories: Array.from(new Set([row.category ?? 'new-arrivals', 'men'])),
    price: Number(row.price) || 0,
    mrp: Number(row.mrp) || Number(row.price) || 0,
    // Operator-supplied. Left undefined rather than invented, so a card never
    // shows a fit or fabric the operator did not set.
    fit: (row.fit ?? undefined) as Fit | undefined,
    fabric: (row.fabric ?? undefined) as Fabric | undefined,
    description: row.description ?? '',
    care: row.care ?? '',
    variants,
    badge: (row.badge ?? undefined) as Badge | undefined,
    createdAt: (row.created_at ?? new Date().toISOString()).slice(0, 10),
    bestseller: row.bestseller ?? false,
    newArrival: row.new_arrival ?? false,
    /** Marks a card that came from the dashboard rather than the code catalog. */
    runtime: true,
  } as Product;
}

// ── module-level cache, shared by every consumer ──────────────────────────
let runtimeProducts: Product[] = [];
let fetched = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function fetchRuntime(): Promise<void> {
  if (fetched) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, slug, name, description, care, fit, fabric, badge, price, mrp, category, colors, stock, images, is_active, bestseller, new_arrival, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        runtimeProducts = (data as RuntimeRow[]).map(toProduct);
      }
    } catch {
      // Leave the list empty rather than blanking the shop mid-error; the
      // storefront shows its own empty state and `ready` still flips to true.
    } finally {
      fetched = true;
      inFlight = null;
      emit();
    }
  })();

  return inFlight;
}

/**
 * The storefront serves ONLY products created in the admin dashboard.
 *
 * The 12 products that live in src/data/catalog.ts are retired: they are code,
 * not database rows, so they are excluded from both the shop and the admin
 * product list. A card exists only if it was created in the dashboard and has
 * not been deleted.
 *
 * To bring the coded catalog back, import PRODUCTS from '@/data/catalog' and
 * return runtimeProducts.length
 *   ? [...PRODUCTS, ...runtimeProducts]
 *   : PRODUCTS;
 */
export function allProducts(): Product[] {
  return runtimeProducts;
}

/**
 * Re-read the catalog after a paid order.
 *
 * The module cache otherwise keeps the pre-purchase stock until a full reload,
 * which means a colour that has just sold out can still look available in an
 * already-open SPA session. Fetching again lets the stock-aware cards and
 * galleries hide that colour immediately.
 */
export function refreshLiveCatalog(): Promise<void> {
  fetched = false;
  return fetchRuntime();
}

/**
 * Look a product up by its row id.
 *
 * The cart, wishlist and checkout all store a bare product id, so they need
 * this. It reads the same module cache the storefront renders from, which means
 * a dashboard product resolves correctly — reading the coded catalog here is
 * what previously made every cart line vanish and the total come out at zero.
 */
export function liveProductById(id: string): Product | undefined {
  return runtimeProducts.find((p) => p.id === id);
}

export function liveProduct(slug: string): Product | undefined {
  return allProducts().find((p) => p.slug === slug);
}

export function liveCollection(slug: string): Product[] {
  const all = allProducts();
  if (slug === 'shop-all') return all;
  if (slug === 'bestsellers') return all.filter((p) => p.bestseller);
  if (slug === 'new-arrivals') return all.filter((p) => p.newArrival);
  return all.filter((p) => p.categories.includes(slug));
}

export function liveRelated(product: Product, n = 4): Product[] {
  return allProducts()
    .filter((x) => x.id !== product.id && x.categories.some((c) => product.categories.includes(c)))
    .slice(0, n);
}

export function liveSearch(q: string): Product[] {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  return allProducts().filter((p) =>
    p.name.toLowerCase().includes(t) ||
    p.categories.some((c) => c.includes(t)) ||
    (p.fit?.toLowerCase().includes(t) ?? false) ||
    (p.fabric?.toLowerCase().includes(t) ?? false) ||
    p.description.toLowerCase().includes(t));
}

/**
 * Re-renders once dashboard products arrive. Returns the merged list so callers
 * never have to call allProducts() themselves.
 */
export function useLiveCatalog(): { products: Product[]; ready: boolean } {
  const [, force] = useState(0);

  useEffect(() => {
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    void fetchRuntime();
    return () => { listeners.delete(listener); };
  }, []);

  return { products: allProducts(), ready: fetched };
}
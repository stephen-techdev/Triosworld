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

/** Case-insensitive lookup for the brand's known colour names. */
function knownHex(name: string): string {
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
 */
function asColors(v: unknown): { name: string; hex: string }[] {
  if (!Array.isArray(v)) return [];
  const out: { name: string; hex: string }[] = [];
  for (const entry of v) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const name = String((entry as { name?: unknown }).name ?? '').trim();
      if (!name) continue;
      const raw = String((entry as { hex?: unknown }).hex ?? '').trim().toLowerCase();
      const hex = /^#[0-9a-f]{6}$/.test(raw) ? raw : knownHex(name);
      out.push({ name, hex });
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
 * Every uploaded photo belongs to the gallery of every colour. The older rule
 * — "as many photos as colours means one photo each" — silently swallowed the
 * rest, so a tee with 2 colours and 2 photos showed one image per colour and
 * the second photo could never be reached, on the card or the product page.
 * There is no per-colour mapping in the dashboard, so guessing is wrong: the
 * operator uploads a gallery, the customer sees the gallery.
 */
function imagesForColor(_index: number, _colors: number, images: string[]): string[] {
  return images;
}

function toProduct(row: RuntimeRow): Product {
  const images = asStringArray(row.images);
  const colors = asColors(row.colors);
  const stock = asStock(row.stock);

  const sizes = Object.keys(stock).length
    ? Object.entries(stock).map(([size, qty]) => ({ size, stock: qty }))
    : SIZES.map((size) => ({ size, stock: 0 }));

  const variants = (colors.length ? colors : [{ name: 'Default', hex: '#171717' }]).map((c, i) => ({
    color: c.name,
    hex: c.hex,
    images: imagesForColor(i, colors.length || 1, images),
    sizes,
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
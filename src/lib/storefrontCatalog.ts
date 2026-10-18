/**
 * Storefront product source.
 *
 * The 12 coded catalog products in src/data/catalog.ts still render
 * immediately — they are the first paint and keep the store working if the
 * database is unreachable. Products created from the admin dashboard live in
 * the public `products` table and are merged in on top once that fetch resolves,
 * so the storefront shows them without a loading flash.
 *
 * A dashboard-deleted product simply never arrives, so it disappears from the
 * storefront on the next load. Catalog products are deliberately NOT affected:
 * they are code, and the dashboard refuses to delete them.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/store/AuthContext';
import {
  PRODUCTS, SIZES, type Product, type Badge, type Fit, type Fabric, type Gender,
} from '@/data/catalog';

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
 * Images are distributed across the colourways:
 *   - one colour             -> it gets the whole gallery, so hover works
 *   - one image per colour   -> each colour gets its own
 *   - fewer images than colours -> every colour gets the whole gallery, because
 *     front/back shots uploaded once apply to all of them, and dropping the
 *     extras is what previously left a product showing a single image.
 */
function imagesForColor(index: number, colors: number, images: string[]): string[] {
  if (!images.length) return [];
  if (colors === 1) return images;
  if (images.length >= colors) return [images[index]];
  return images;
}

function toProduct(row: RuntimeRow): Product {
  const images = asStringArray(row.images);
  const colors = asStringArray(row.colors);
  const stock = asStock(row.stock);

  const sizes = Object.keys(stock).length
    ? Object.entries(stock).map(([size, qty]) => ({ size, stock: qty }))
    : SIZES.map((size) => ({ size, stock: 0 }));

  const colorNames = colors.length ? colors : ['Default'];

  const variants = colorNames.map((color, i) => ({
    color,
    hex: '#171717',
    images: imagesForColor(i, colorNames.length, images),
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
      // Leave the coded catalog as the storefront; never blank the shop on error.
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
 * The 12 products that live in src/data/catalog.ts are retired: they are code, not
 * database rows, so they are excluded from both the shop and the admin product list.
 * A card exists only if it was created in the dashboard and has not been deleted.
 *
 * To bring the coded catalog back, change the return below to:
 *   return runtimeProducts.length
 *     ? [...(PRODUCTS as Product[]), ...runtimeProducts]
 *     : (PRODUCTS as Product[]);
 */
export function allProducts(): Product[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const CATALOG = PRODUCTS;
  return runtimeProducts;
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
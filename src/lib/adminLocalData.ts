/**
 * Offline data for local operator mode.
 *
 * Mirrors the shapes returned by the `trios-admin` edge function so the
 * dashboard renders normally when the function has not been deployed. Nothing
 * here is real store data — orders, customers and feedback are empty because the
 * tables do not exist yet. Products come from the real catalog, and local edits
 * are persisted to localStorage so price/stock changes survive a reload.
 *
 * Delete alongside `adminLocal.ts` once `trios-admin` is deployed.
 */
import { PRODUCTS } from '@/data/catalog';
import type {
  AdminCustomer, AdminFeedback, AdminOrder, AdminProduct, Overview,
} from '@/lib/admin';

const OVERRIDE_KEY = 'triosworld-admin-local:products';

interface ProductOverride {
  price?: number;
  mrp?: number;
  stock?: Record<string, number>;
  is_active?: boolean;
}

type OverrideMap = Record<string, ProductOverride>;

function readOverrides(): OverrideMap {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    return raw ? (JSON.parse(raw) as OverrideMap) : {};
  } catch {
    return {};
  }
}

function writeOverrides(map: OverrideMap) {
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/** Catalog products, with any locally-saved overrides applied. */
export function localProducts(): AdminProduct[] {
  const overrides = readOverrides();

  return PRODUCTS.map((p) => {
    const stock: Record<string, number> = {};
    for (const v of p.variants) {
      for (const s of v.sizes) stock[s.size] = (stock[s.size] ?? 0) + s.stock;
    }

    const ov = overrides[p.id] ?? {};
    const mergedStock = { ...stock, ...(ov.stock ?? {}) };
    const stockTotal = Object.values(mergedStock).reduce((a, b) => a + b, 0);

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      mrp: ov.mrp ?? p.mrp,
      catalog_price: p.price,
      price: ov.price ?? p.price,
      colors: p.variants.map((v) => v.color),
      stock: mergedStock,
      stock_total: stockTotal,
      is_active: ov.is_active ?? true,
      updated_at: null,
      overridden: Object.keys(ov).length > 0,
    };
  });
}

/** Applies a product edit locally. Returns false if the product is unknown. */
export function localUpdateProduct(payload: {
  productId: string;
  price?: number;
  mrp?: number;
  stock?: Record<string, number>;
  is_active?: boolean;
}): boolean {
  if (!PRODUCTS.some((p) => p.id === payload.productId)) return false;

  const overrides = readOverrides();
  const prev = overrides[payload.productId] ?? {};
  const { productId, ...patch } = payload;

  overrides[productId] = {
    ...prev,
    ...(patch.price !== undefined ? { price: patch.price } : {}),
    ...(patch.mrp !== undefined ? { mrp: patch.mrp } : {}),
    ...(patch.stock !== undefined ? { stock: patch.stock } : {}),
    ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}),
  };

  writeOverrides(overrides);
  return true;
}

export function localClearProductOverrides() {
  try {
    localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    // ignore
  }
}

/** No `orders` table yet, so every counter is zero. */
export function localOverview(): Overview {
  return {
    orders_total: 0,
    orders_today: 0,
    orders_paid: 0,
    orders_pending: 0,
    orders_failed: 0,
    orders_expired: 0,
    revenue: 0,
    revenue_today: 0,
    guests: 0,
    registered: 0,
    new_feedback: 0,
  };
}

/** No `orders` table yet. */
export function localOrders(): AdminOrder[] {
  return [];
}

/** No customers table yet — the customer list is served by the function. */
export function localCustomers(): AdminCustomer[] {
  return [];
}

/** Feedback is inserted client-side, so this can work even before deploy. */
export function localFeedback(): AdminFeedback[] {
  return [];
}
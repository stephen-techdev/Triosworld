/**
 * Client for the `trios-admin` edge function.
 *
 * The operator session token is issued and verified by the server (HMAC-signed,
 * 12-hour expiry). Storing it in localStorage grants nothing on its own: every
 * admin request is re-verified server-side against the `admins` table, which has
 * RLS enabled with no policies and is therefore unreachable from the browser.
 */
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
import { hexForColorName } from '@/lib/colors';
const STORAGE_KEY = 'triosworld-admin-session';

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AdminSession {
  token: string;
  admin: AdminAccount;
}

export interface Overview {
  orders_total: number;
  orders_today: number;
  orders_paid: number;
  orders_pending: number;
  orders_failed: number;
  orders_expired: number;
  revenue: number;
  revenue_today: number;
  guests: number;
  registered: number;
  new_feedback: number;
}

export interface AdminOrder {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_mobile: string | null;
  customer_email: string | null;
  items: { name: string; color: string; size: string; qty: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  amount_paid: number | null;
  status: string;
  payment_status: string;
  payment_method: string;
  payment_provider: string | null;
  payment_id: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  created_at: string;
  user_id: string | null;
  shipping_address: {
    fullName?: string;
    mobile?: string;
    email?: string | null;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  } | null;
}

export interface AdminCustomer {
  name: string;
  mobile: string;
  email: string | null;
  type: 'guest' | 'registered';
  orders: number;
  spent: number;
  last_order: string | null;
  address: unknown;
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  mrp: number;
  catalog_price: number;
  price: number;
  /** Picker rows: the colour name plus the hex the operator chose. */
  colors: ProductColor[];
  stock: Record<string, number>;
  stock_total: number;
  is_active: boolean;
  updated_at: string | null;
  overridden: boolean;
  /** "catalog" ships in src/data/catalog.ts; "runtime" was created in the dashboard. */
  source?: 'catalog' | 'runtime';
  /** Retired. Catalog products are soft-deleted so their edits survive. */
  deleted?: boolean;
  deleted_at?: string | null;
  /** Two live cards sharing a slug. */
  duplicate?: boolean;
  category?: string | null;
  image_url?: string | null;
  images?: string[];
  description?: string | null;
  care?: string | null;
  fit?: string | null;
  fabric?: string | null;
  badge?: string | null;
  bestseller?: boolean;
  new_arrival?: boolean;
  created_at?: string | null;
}

/**
 * Store-wide values the operator owns. These used to be literals in the
 * frontend bundle, repeated across six components, which is why the shipping
 * policy could contradict the checkout.
 */
export interface AdminSettings {
  shipping_fee: number;
  free_shipping_threshold: number;
  /** Rotating top-bar line. Null/blank derives it from the threshold. */
  announcement: string | null;
  /** Operator-owned storefront copy (Admin → Content). Null = never edited. */
  content?: unknown;
  updated_at?: string | null;
  updated_by?: string | null;
}

export interface AdminCustomerDetail {
  mobile: string;
  full_name: string;
  email: string | null;
  gender: string | null;
  avatar_url: string | null;
  google_id: string | null;
  is_muted: boolean;
  muted_reason: string | null;
  muted_at: string | null;
  deleted_at: string | null;
  joined_at: string | null;
  last_login_at: string | null;
  has_account: boolean;
  orders: {
    order_number: string;
    status: string;
    payment_status: string;
    total: number;
    created_at: string;
    shipping_address: Record<string, unknown> | null;
  }[];
  addresses: Record<string, unknown>[];
  feedback: {
    id: string;
    rating: number | null;
    category: string;
    message: string;
    status: string;
    created_at: string;
  }[];
  stats: { order_count: number; paid_count: number; total_spent: number; last_order: string | null };
}

export interface AdminFeedback {
  id: string;
  name: string | null;
  mobile: string | null;
  email: string | null;
  rating: number | null;
  category: string;
  message: string;
  order_number: string | null;
  page: string | null;
  status: 'new' | 'read' | 'resolved';
  created_at: string;
}

/** A colour row from the admin picker: display name, exact swatch hex, and an
 *  optional per-size stock map (Blue-M 8, Blue-L 0). */
export interface ProductColor {
  name: string;
  hex: string;
  /** Size → units on hand for THIS colour. Absent means "use the product's
   *  shared stock", which is how every colour behaved before this existed. */
  sizes?: Record<string, number>;
}

/**
 * Colours arrive as { name, hex } pairs, but rows written before the picker
 * existed are bare names. Older saved sessions may also hold either shape, so
 * every surface reads them through here rather than assuming.
 */
export function normalizeProductColors(v: unknown): ProductColor[] {
  if (!Array.isArray(v)) return [];
  const out: ProductColor[] = [];
  for (const entry of v) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const obj = entry as ProductColor;
      const name = String(obj.name ?? '').trim();
      const raw = String(obj.hex ?? '').trim().toLowerCase();
      const resolved = /^#[0-9a-f]{6}$/.test(raw) ? raw : hexForColorName(name);
      if (!name) continue;
      const sizes = normalizeSizeStock(obj.sizes);
      out.push(sizes ? { name, hex: resolved ?? '#171717', sizes } : { name, hex: resolved ?? '#171717' });
    } else if (typeof entry === 'string' && entry.trim()) {
      const name = entry.trim();
      out.push({ name, hex: hexForColorName(name) ?? '#171717' });
    }
  }
  return out;
}

/** Clamp a per-size stock map to real, non-negative counts; drop it if empty. */
function normalizeSizeStock(v: unknown): Record<string, number> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: Record<string, number> = {};
  for (const [size, qty] of Object.entries(v as Record<string, unknown>)) {
    const key = String(size).trim();
    const num = Number(qty);
    if (!key || !Number.isFinite(num)) continue;
    out[key] = Math.max(0, Math.min(100000, Math.round(num)));
  }
  return Object.keys(out).length ? out : undefined;
}

export class AdminAuthError extends Error {}

/**
 * Thrown when the `trios-admin` function cannot be reached at all — usually
 * because it has not been deployed yet. The dashboard shows a plain explanation
 * rather than making it look like a wrong password.
 */
export class AdminServiceUnavailableError extends Error {
  constructor() {
    super('The admin service is not reachable right now.');
    this.name = 'AdminServiceUnavailableError';
  }
}

export function readSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminSession) : null;
  } catch {
    return null;
  }
}

function writeSession(session: AdminSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function adminRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const session = readSession();

  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_URL}/trios-admin${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new AdminServiceUnavailableError();
  }

  if (res.status === 502 || res.status === 503) throw new AdminServiceUnavailableError();

  const text = await res.text().catch(() => '');
  let data: (T & { error?: string }) | null = null;
  try {
    data = text ? (JSON.parse(text) as T & { error?: string }) : null;
  } catch {
    data = null;
  }

  // A 404 with no `error` body means the function is not deployed.
  if (res.status === 404 && !data?.error) throw new AdminServiceUnavailableError();

  // Expired or revoked session: clear it so the dashboard returns to the login.
  if (res.status === 401 && retry) {
    writeSession(null);
    if (path !== '/login') throw new AdminAuthError(data?.error ?? 'Session expired');
  }

  if (!res.ok) throw new Error(data?.error ?? 'Request failed');
  if (!data) throw new AdminServiceUnavailableError();
  return data;
}

export async function adminLogin(email: string, password: string): Promise<AdminAccount> {
  const data = await adminRequest<{ token: string; admin: AdminAccount }>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  writeSession({ token: data.token, admin: data.admin });
  return data.admin;
}

export function adminLogout() {
  writeSession(null);
}

export const getOverview = () => adminRequest<{ overview: Overview }>('/overview').then(r => r.overview);

export const getOrders = (params: { status?: string; q?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.q) qs.set('q', params.q);
  return adminRequest<{ orders: AdminOrder[] }>(`/orders?${qs.toString()}`).then(r => r.orders);
};

export const updateOrder = (id: string, patch: { status?: string; payment_status?: string }) =>
  adminRequest<{ ok: boolean }>('/order', { method: 'POST', body: JSON.stringify({ id, ...patch }) });

export const deleteOrder = (id: string) =>
  adminRequest<{ ok: boolean }>('/order-delete', { method: 'POST', body: JSON.stringify({ id }) });

export const getOrderEvents = (id: string) =>
  adminRequest<{ events: { id: string; event: string; detail: unknown; created_at: string }[] }>(
    `/order-events?id=${encodeURIComponent(id)}`,
  ).then(r => r.events);

export const getCustomers = () =>
  adminRequest<{ customers: AdminCustomer[] }>('/customers').then(r => r.customers);

export const getProducts = () =>
  adminRequest<{ products: AdminProduct[] }>('/products').then(r => r.products);

export const updateProduct = (payload: {
  productId: string;
  name?: string;
  price?: number;
  mrp?: number;
  category?: string;
  stock?: Record<string, number>;
  is_active?: boolean;
  colors?: ProductColor[];
  images?: string[];
  description?: string;
  care?: string;
  fit?: string;
  fabric?: string;
  badge?: string;
  bestseller?: boolean;
  new_arrival?: boolean;
}) => adminRequest<{ ok: boolean }>('/product', { method: 'POST', body: JSON.stringify(payload) });

// ─────────────────────── customer moderation ───────────────────────
export const getCustomer = (mobile: string) =>
  adminRequest<{ customer: AdminCustomerDetail }>(
    `/customer?mobile=${encodeURIComponent(mobile)}`,
  ).then(r => r.customer);

export const muteCustomer = (mobile: string, muted: boolean, reason?: string) =>
  adminRequest<{ ok: boolean; is_muted: boolean }>('/customer-mute', {
    method: 'POST',
    body: JSON.stringify({ mobile, muted, reason }),
  });

export const deleteCustomer = (mobile: string) =>
  adminRequest<{ ok: boolean; orders_preserved: number }>('/customer-delete', {
    method: 'POST',
    body: JSON.stringify({ mobile }),
  });

/**
 * Remove a guest profile by mobile. A guest has no `profiles` row; the admin
 * customer list is derived from orders, so deleting the guest's orders is what
 * removes the profile. This is the per-customer replacement for the old bulk
 * "clear guest history" action.
 */
export const deleteGuest = (mobile: string) =>
  adminRequest<{ ok: boolean; deleted: number }>('/customer-guest-delete', {
    method: 'POST',
    body: JSON.stringify({ mobile }),
  });

// ───────────────────────── product management ──────────────────────
/**
 * Upload a product image. Goes through the admin function rather than Storage
 * directly so the `product-images` bucket never needs a public write policy.
 */
export const uploadProductImage = (filename: string, contentType: string, data: string) =>
  adminRequest<{ ok: true; path: string; url: string }>('/image-upload', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType, data }),
  });

export const createProduct = (payload: {
  name: string;
  slug?: string;
  price: number;
  mrp?: number;
  category?: string;
  colors?: ProductColor[];
  stock?: Record<string, number>;
  images?: string[];
  image_url?: string;
  description?: string;
  care?: string;
  fit?: string;
  fabric?: string;
  badge?: string;
  bestseller?: boolean;
  new_arrival?: boolean;
  is_active?: boolean;
}) => adminRequest<{ ok: true; id: string; slug: string }>('/product-create', {
  method: 'POST',
  body: JSON.stringify(payload),
});

/** Retires a card. Catalog products are soft-deleted; runtime ones are removed. */
export const deleteProduct = (productId: string) =>
  adminRequest<{ ok: true; mode: string; inOrders: boolean }>('/product-delete', {
    method: 'POST',
    body: JSON.stringify({ productId }),
  });

export const restoreProduct = (productId: string) =>
  adminRequest<{ ok: true }>('/product-restore', {
    method: 'POST',
    body: JSON.stringify({ productId }),
  });

export const getFeedback = (status?: string) =>
  adminRequest<{ feedback: AdminFeedback[] }>(`/feedback?status=${status ?? 'all'}`).then(r => r.feedback);

export const setFeedbackStatus = (id: string, status: 'new' | 'read' | 'resolved') =>
  adminRequest<{ ok: boolean }>('/feedback', { method: 'POST', body: JSON.stringify({ id, status }) });

export const clearFeedback = (status?: string) =>
  adminRequest<{ ok: boolean; deleted: number }>('/feedback-clear', { method: 'POST', body: JSON.stringify({ status: status && status !== 'all' ? status : undefined }) });

export const deleteFeedback = (id: string) =>
  adminRequest<{ ok: boolean }>('/feedback-delete', { method: 'POST', body: JSON.stringify({ id }) });

export const changeAdminPassword = (current: string, next: string) =>
  adminRequest<{ ok: boolean }>('/password', { method: 'POST', body: JSON.stringify({ current, next }) });

export const getSettings = () =>
  adminRequest<{ settings: AdminSettings }>('/settings');

/**
 * Partial save: the Settings form sends the shipping figures, the Content tab
 * sends the copy document. The server updates only what is present, so saving
 * one can never overwrite the other with a stale value.
 */
export const saveSettings = (settings: {
  shipping_fee?: number;
  free_shipping_threshold?: number;
  announcement?: string | null;
  content?: unknown;
}) =>
  adminRequest<{ ok: boolean; settings: AdminSettings }>('/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  });

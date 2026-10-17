/**
 * Client for the `trios-admin` edge function.
 *
 * The operator session token is issued and verified by the server (HMAC-signed,
 * 12-hour expiry). Storing it in localStorage grants nothing on its own: every
 * admin request is re-verified server-side against the `admins` table, which has
 * RLS enabled with no policies and is therefore unreachable from the browser.
 */
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
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
  colors: string[];
  stock: Record<string, number>;
  stock_total: number;
  is_active: boolean;
  updated_at: string | null;
  overridden: boolean;
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
  price?: number;
  mrp?: number;
  stock?: Record<string, number>;
  is_active?: boolean;
}) => adminRequest<{ ok: boolean }>('/product', { method: 'POST', body: JSON.stringify(payload) });

export const getFeedback = (status?: string) =>
  adminRequest<{ feedback: AdminFeedback[] }>(`/feedback?status=${status ?? 'all'}`).then(r => r.feedback);

export const setFeedbackStatus = (id: string, status: 'new' | 'read' | 'resolved') =>
  adminRequest<{ ok: boolean }>('/feedback', { method: 'POST', body: JSON.stringify({ id, status }) });

export const changeAdminPassword = (current: string, next: string) =>
  adminRequest<{ ok: boolean }>('/password', { method: 'POST', body: JSON.stringify({ current, next }) });

/**
 * Client for the `trios-pay` edge function.
 *
 * IMPORTANT: nothing in this file may decide that an order is paid. The
 * frontend only ever *asks* the server, which verifies against the gateway (or
 * a signature-verified webhook) before reporting `paid`. There is deliberately
 * no local "mark as paid" helper.
 */
import { supabase } from '@/store/AuthContext';
import type { CartItem } from '@/store/StoreContext';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

export interface CheckoutCustomer {
  name: string;
  mobile: string;
  email?: string;
  pincode: string;
  address: string;
  city: string;
  state: string;
}

export interface CreateOrderResult {
  order_number: string;
  order_id: string;
  receipt_token: string;
  amount: number;
  subtotal: number;
  shipping: number;
  expires_at: string;
  items: { productId: string; name: string; color: string; size: string; qty: number; unitPrice: number; lineTotal: number }[];
  payment: {
    mode: 'live' | 'demo';
    demo: boolean;
    provider: string;
    expires_at: string;
    upi_intent: string | null;
    qr_id?: string;
    qr_image_url?: string;
    razorpay_order_id?: string;
    razorpay_key_id?: string;
  };
}

export interface OrderSummary {
  order_number: string;
  status: string;
  payment_status: PaymentStatus;
  payment_method: string;
  payment_provider: string | null;
  amount_paid: number | null;
  total: number;
  paid_at: string | null;
  created_at: string;
  payment_id: string | null;
  payment_reference: string | null;
}

export interface PaymentInfo {
  mode: 'live' | 'demo';
  demo: boolean;
  provider: string;
  expires_at: string;
  upi_intent: string | null;
  qr_image_url: string | null;
  qr_id: string | null;
  /** Razorpay order for the hosted checkout; null in demo mode. */
  razorpay_order_id: string | null;
  /** Public Razorpay key id used by Checkout. Never the key secret. */
  razorpay_key_id: string | null;
}

export interface StatusResult {
  payment_status: PaymentStatus;
  verified: boolean;
  order: OrderSummary;
  payment: PaymentInfo;
}

export interface ReceiptPayload {
  order_number: string;
  order_date: string;
  paid_at: string | null;
  payment_status: string;
  payment_method: string;
  payment_provider: string | null;
  payment_id: string | null;
  payment_reference: string | null;
  amount_paid: number | null;
  is_demo: boolean;
  customer: {
    fullName?: string;
    mobile?: string;
    email?: string | null;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  items: {
    name: string;
    color: string;
    size: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    gst: { rate: number; tax: number; cgst: number; sgst: number };
  }[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  tax_included: number;
}

/**
 * Thrown when the payment service itself cannot be reached — most commonly
 * because the `trios-pay` edge function has not been deployed yet, or because
 * it booted with an error. Distinguished from ordinary validation errors so the
 * UI can offer a sensible fallback (e.g. ordering on WhatsApp) rather than a
 * generic "try again" that can never succeed.
 */
export class PaymentServiceUnavailableError extends Error {
  constructor() {
    super('Payments are temporarily unavailable.');
    this.name = 'PaymentServiceUnavailableError';
  }
}

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/** Attach the customer's session when signed in, so the order links to their account. */
async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_URL}/trios-pay${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch {
    // DNS failure, offline, CORS preflight rejection — nothing to retry here.
    throw new PaymentServiceUnavailableError();
  }

  // A 502/503 means the function exists but could not run (e.g. a boot error).
  if (res.status === 502 || res.status === 503) throw new PaymentServiceUnavailableError();

  // Read as text first: a missing function is not JSON, and our own 404s are.
  const text = await res.text().catch(() => '');
  let data: (T & { error?: string }) | null = null;
  try {
    data = text ? (JSON.parse(text) as T & { error?: string }) : null;
  } catch {
    data = null;
  }

  // A 404 with no `error` body is Supabase reporting that the function is not
  // deployed; our own "order not found" responses always carry `error`.
  if (res.status === 404 && !data?.error) throw new PaymentServiceUnavailableError();

  if (!res.ok) {
    throw new Error(data?.error ?? 'Something went wrong. Please try again.');
  }
  if (!data) throw new PaymentServiceUnavailableError();

  return data;
}

/** Create the order server-side and get a dynamic UPI QR back. */
export async function createOrder(input: {
  items: CartItem[];
  customer: CheckoutCustomer;
}): Promise<CreateOrderResult> {
  return request<CreateOrderResult>('/create', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      items: input.items.map(i => ({
        productId: i.productId,
        color: i.color,
        size: i.size,
        qty: i.qty,
      })),
      customer: input.customer,
    }),
  });
}

/** Ask the server to verify (it re-queries the gateway). */
export async function getStatus(orderNumber: string, token: string): Promise<StatusResult> {
  const qs = new URLSearchParams({ order: orderNumber, token });
  return request<StatusResult>(`/status?${qs.toString()}`, { method: 'GET' });
}

/** Demo-mode settlement. Only permitted while no gateway is configured. */
export async function demoSettle(orderNumber: string, token: string): Promise<{ ok: boolean; demo: boolean }> {
  return request('/demo-settle', {
    method: 'POST',
    body: JSON.stringify({ order: orderNumber, token }),
  });
}

/** Fetch the full receipt. The server refuses anything that is not paid. */
export async function getReceipt(orderNumber: string, token: string): Promise<ReceiptPayload> {
  const qs = new URLSearchParams({ order: orderNumber, token });
  const data = await request<{ receipt: ReceiptPayload }>(`/receipt?${qs.toString()}`, { method: 'GET' });
  return data.receipt;
}

// ---------------------------------------------------------------------------
// Local order references
//
// The receipt token is the guest's proof of ownership, handed out once at
// order creation. It is kept in localStorage so the customer can come back and
// download the receipt without an account. It is never sent anywhere except
// the payment function, and grants access to nothing else.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'triosworld-orders';
const MAX_REMEMBERED = 20;

export interface StoredOrderRef {
  orderNumber: string;
  token: string;
  total: number;
  createdAt: string;
}

export function rememberOrder(ref: StoredOrderRef) {
  try {
    const existing = readOrders().filter(o => o.orderNumber !== ref.orderNumber);
    const next = [ref, ...existing].slice(0, MAX_REMEMBERED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode) — the receipt link still works.
  }
}

export function readOrders(): StoredOrderRef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredOrderRef[]) : [];
  } catch {
    return [];
  }
}

export function findOrderToken(orderNumber: string): string | null {
  return readOrders().find(o => o.orderNumber === orderNumber)?.token ?? null;
}

// ---------------------------------------------------------------------------
// "Order just placed" marker
//
// Set by checkout before redirecting to the order page. The order page only
// empties the bag once the payment is confirmed paid, so abandoning a payment
// never loses the customer's cart.
// ---------------------------------------------------------------------------

const PENDING_KEY = 'triosworld-pending-order';

export function markPendingOrder(orderNumber: string) {
  try {
    sessionStorage.setItem(PENDING_KEY, orderNumber);
  } catch {
    // ignore
  }
}

/** Returns the pending order number and clears the marker (single use). */
export function takePendingOrder(): string | null {
  try {
    const value = sessionStorage.getItem(PENDING_KEY);
    if (value) sessionStorage.removeItem(PENDING_KEY);
    return value;
  } catch {
    return null;
  }
}

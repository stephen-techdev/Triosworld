/**
 * WhatsApp orders, kept on the customer's own device.
 *
 * A WhatsApp order is a message, not a database row — the store receives it
 * in its WhatsApp inbox and confirms it by hand. The customer still needs an
 * order page, so the order number, the picture of the order and the totals
 * are kept here and the `/order/:orderNumber` page reads them back.
 *
 * Nothing here is sensitive beyond what the customer already typed, and it
 * never leaves the device.
 */

const STORAGE_KEY = 'triosworld-whatsapp-orders';

export interface WhatsAppOrderItem {
  name: string;
  color: string;
  size: string;
  qty: number;
  lineTotal: number;
}

export interface WhatsAppOrder {
  reference: string;
  createdAt: string;
  /** The picture of the order — the same one that was sent on WhatsApp. */
  imageUrl: string | null;
  items: WhatsAppOrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  customer: {
    name: string;
    mobile: string;
    email: string | null;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
}

function readAll(): WhatsAppOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WhatsAppOrder[]) : [];
  } catch {
    return [];
  }
}

export function saveWhatsAppOrder(order: WhatsAppOrder) {
  try {
    const existing = readAll().filter(o => o.reference !== order.reference);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([order, ...existing].slice(0, 10)));
  } catch {
    // Storage unavailable (private mode) — the page still works in memory.
  }
}

/** The picture is uploaded after the order is placed, so it is filled in later. */
export function setWhatsAppOrderImage(reference: string, imageUrl: string) {
  try {
    const next = readAll().map(o => (o.reference === reference ? { ...o, imageUrl } : o));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function readWhatsAppOrder(reference: string): WhatsAppOrder | null {
  return readAll().find(o => o.reference === reference) ?? null;
}

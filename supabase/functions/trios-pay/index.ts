// TriosWorld payments edge function (UPI).
//
// Responsibilities
//   POST /create         create an order + a dynamic UPI QR / gateway order
//   GET  /status         server-verified payment status for polling
//   POST /webhook        signed gateway callback (source of truth)
//   POST /demo-settle    settlement when no gateway is configured (see below)
//   GET  /receipt        full order payload for the PDF receipt (paid orders only)
//
// SECURITY MODEL
//   * Orders are created HERE, with the service role, never by the browser.
//   * Every price is recomputed from ./prices.ts (generated from the catalogue),
//     so a tampered client payload cannot change what the customer owes.
//   * "Paid" is only ever written by this function, either after a signature-
//     verified webhook or after re-querying the gateway. The frontend has no
//     way to mark an order paid.
//   * Receipts are gated on payment_status = 'paid' AND an unguessable
//     per-order receipt_token, so guests can download without an account.
//
// DEMO MODE
//   When RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are absent (or PAYMENT_DEMO_MODE
//   is "true") the store cannot take real money. Rather than pretend, the
//   function says so: responses carry `demo: true`, and settlement happens via
//   /demo-settle — still a SERVER-side state change with a synthetic reference,
//   never a client-side "success" toggle. The success page labels it clearly.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { PRICES } from "../_shared/prices.ts";
import { routePath } from "../_shared/http.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Razorpay-Signature",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
const razorpayWebhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";

// Fallback UPI collect address, used only when the gateway cannot issue a QR.
const upiVpa = Deno.env.get("UPI_VPA") ?? "";
const upiPayeeName = Deno.env.get("UPI_PAYEE_NAME") ?? "TriosWorld";

const razorpayConfigured = Boolean(razorpayKeyId && razorpayKeySecret);
const demoMode = Deno.env.get("PAYMENT_DEMO_MODE") === "true" || !razorpayConfigured;

// Fallbacks only. The real values come from the store_settings table, which
// Admin > Settings edits; these match its seeded row so a failed read shows the
// same numbers the storefront would have used.
const DEFAULT_FREE_SHIPPING_OVER = 1499;
const DEFAULT_FLAT_SHIPPING = 79;

interface ShippingRule {
  freeShippingOver: number;
  flatShipping: number;
}

/**
 * Read the operator's shipping figures.
 *
 * Checkout must agree with the cart exactly, so both sides read the same row.
 * On error the defaults are used rather than failing the order.
 */
async function loadShippingRule(): Promise<ShippingRule> {
  try {
    const { data } = await supabase
      .from("store_settings")
      .select("shipping_fee, free_shipping_threshold")
      .maybeSingle();

    return {
      flatShipping: Number(data?.shipping_fee ?? DEFAULT_FLAT_SHIPPING) || 0,
      freeShippingOver: Number(data?.free_shipping_threshold ?? DEFAULT_FREE_SHIPPING_OVER) || 0,
    };
  } catch {
    return { flatShipping: DEFAULT_FLAT_SHIPPING, freeShippingOver: DEFAULT_FREE_SHIPPING_OVER };
  }
}
const PAYMENT_WINDOW_MINUTES = 15;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface CartLine {
  productId: string;
  color: string;
  size: string;
  qty: number;
}

interface Customer {
  name: string;
  mobile: string;
  email?: string;
  pincode: string;
  address: string;
  city: string;
  state: string;
}

interface PricedLine {
  productId: string;
  name: string;
  color: string;
  size: string;
  qty: number;
  unitPrice: number;
  mrp: number;
  lineTotal: number;
}

interface OrderRecord {
  id: string;
  order_number: string;
  total: number;
  subtotal: number;
  shipping: number;
  status: string;
  created_at: string;
  payment_status: string;
  payment_method: string;
  payment_provider: string | null;
  payment_id: string | null;
  payment_reference: string | null;
  amount_paid: number | null;
  paid_at: string | null;
  items: PricedLine[];
  shipping_address: Record<string, unknown>;
  gateway_meta: { razorpay_order_id?: string; qr_id?: string; qr_image_url?: string } | null;
}

interface GatewayPayment {
  id: string;
  amount: number; // paise
  method?: string;
  order_id?: string;
  status: string;
}

/** Customer-safe validation failure (surfaced as HTTP 400). */
class PayloadError extends Error {}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomHex(bytes = 16): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Human-readable order id, e.g. TW-482913. */
function makeOrderNumber(): string {
  const a = new Uint8Array(3);
  crypto.getRandomValues(a);
  const n = (a[0] << 16) | (a[1] << 8) | a[2];
  return `TW-${(n % 900000) + 100000}`;
}

function cleanMobile(m: unknown): string {
  return String(m ?? "").replace(/\D/g, "").slice(-10);
}

function isBlank(v: unknown): boolean {
  return typeof v !== "string" || v.trim().length === 0;
}

/**
 * Reprice the cart from the authoritative catalogue, applying any admin
 * overrides. Never trusts a price sent by the browser.
 */
/**
 * Price and stock source for one product, from either store.
 *
 * Dashboard products live in the `products` table and know nothing about the
 * static PRICES map, so the map is built from both before pricing. Prices are
 * read server-side on purpose: the browser's numbers are never trusted.
 */
interface Sellable {
  name: string;
  slug: string;
  price: number;
  mrp: number;
  sizes: Record<string, number>;
  colors: string[];
  /** Colour name -> its own per-size stock. Only present for dashboard rows. */
  colorSizes: Record<string, Record<string, number>>;
  active: boolean;
}

function priceCart(
  rawItems: unknown,
  catalog: Record<string, Sellable>,
  priceOverrides: Record<string, number>,
  stockOverrides: Record<string, Record<string, number>>,
): PricedLine[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new PayloadError("Your bag is empty.");
  }
  if (rawItems.length > 50) throw new PayloadError("Too many items in this order.");

  return rawItems.map((raw) => {
    const line = raw as Partial<CartLine>;
    const productId = String(line.productId ?? "");
    const entry = catalog[productId];
    if (!entry) throw new PayloadError("One of the items is no longer available.");

    // Refuse this one product rather than the whole store. The old code threw
    // once for any inactive row anywhere, which took the entire shop offline.
    if (!entry.active) {
      throw new PayloadError(`${entry.name} is not available for purchase right now.`);
    }

    const unitPrice = priceOverrides[productId] ?? entry.price;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new PayloadError(`${entry.name} has an invalid price. Please contact support.`);
    }

    const color = String(line.color ?? "");
    if (entry.colors.length > 0 && !entry.colors.includes(color)) {
      throw new PayloadError(`${entry.name}: that colour is unavailable.`);
    }

    const size = String(line.size ?? "");
    // The selected colour's own stock is authoritative when it has one; the
    // merged product-wide list is only a fallback for shared-stock rows.
    const colorOwn = color && entry.colorSizes[color]?.[size];
    const available = stockOverrides[productId]?.[size] ?? colorOwn ?? entry.sizes[size];
    if (available === undefined) throw new PayloadError(`${entry.name}: that size is unavailable.`);
    if (available <= 0) throw new PayloadError(`${entry.name} in size ${size} is out of stock.`);

    const qty = Math.floor(Number(line.qty));
    if (!Number.isFinite(qty) || qty < 1) throw new PayloadError("Invalid quantity.");
    if (qty > 10) throw new PayloadError("Maximum 10 units per item.");
    if (qty > available) throw new PayloadError(`Only ${available} left of ${entry.name} in size ${size}.`);

    return {
      productId,
      name: entry.name,
      color,
      size,
      qty,
      unitPrice,
      mrp: entry.mrp,
      lineTotal: unitPrice * qty,
    };
  });
}

/**
 * Every product the storefront can sell, keyed by row id.
 *
 * The static catalog is included so a link to a retired page still prices, but
 * a catalog product that was retired (soft-deleted) is marked inactive and
 * refused per-item rather than silently taking the store down.
 */
async function loadSellableCatalog(): Promise<Record<string, Sellable>> {
  const catalog: Record<string, Sellable> = {};

  for (const [id, entry] of Object.entries(PRICES)) {
    catalog[id] = {
      name: entry.name,
      slug: entry.slug,
      price: entry.price,
      mrp: entry.mrp,
      sizes: entry.sizes,
      colors: entry.colors,
      colorSizes: {},
      active: true,
    };
  }

  const { data: overrides } = await supabase
    .from("product_overrides")
    .select("product_id, deleted_at");
  for (const o of overrides ?? []) {
    const id = String(o.product_id ?? "");
    if (!catalog[id]) continue;
    // A retired catalog product is unavailable, not fatal.
    catalog[id].active = !o.deleted_at;
  }

  // Dashboard products are the real storefront now.
  const { data: rows } = await supabase
    .from("products")
    .select("id, name, slug, price, mrp, colors, stock, is_active");
  for (const r of rows ?? []) {
    const id = String(r.id);
    const stock = (r.stock ?? {}) as Record<string, unknown>;
    const sizes: Record<string, number> = {};
    for (const [size, n] of Object.entries(stock)) {
      const v = Number(n);
      if (Number.isFinite(v) && v >= 0) sizes[size] = Math.floor(v);
    }

    // Colours are { name, hex, sizes } objects since per-colour stock landed.
    // A colour may carry its own size map; when it does, that colour's own
    // numbers win at checkout, exactly as the storefront shows them.
    const colorNames: string[] = [];
    const colorSizes: Record<string, Record<string, number>> = {};
    let perColor = false;

    if (Array.isArray(r.colors)) {
      for (const raw of r.colors as unknown[]) {
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          const o = raw as Record<string, unknown>;
          const nm = String(o.name ?? "").trim();
          if (!nm) continue;
          colorNames.push(nm);
          const cs = o.sizes;
          if (cs && typeof cs === "object" && !Array.isArray(cs)) {
            const m: Record<string, number> = {};
            for (const [sz, n] of Object.entries(cs as Record<string, unknown>)) {
              const v = Number(n);
              if (Number.isFinite(v) && v >= 0) m[String(sz)] = Math.floor(v);
            }
            if (Object.keys(m).length) { colorSizes[nm] = m; perColor = true; }
          }
        } else if (typeof raw === "string" && raw.trim()) {
          colorNames.push(raw.trim());
        }
      }
    }

    // When colours carry their own stock, the sellable size list is the union
    // across them; otherwise the product-wide map is the whole truth.
    if (perColor) {
      for (const m of Object.values(colorSizes)) {
        for (const [sz, n] of Object.entries(m)) sizes[sz] = (sizes[sz] ?? 0) + n;
      }
    }

    catalog[id] = {
      name: String(r.name ?? id),
      slug: String(r.slug ?? id),
      price: Number(r.price) || 0,
      mrp: Number(r.mrp) || Number(r.price) || 0,
      // An empty stock map means every size is out of stock, which is the
      // honest reading: the operator has not recorded any units.
      sizes,
      colors: colorNames,
      colorSizes,
      active: r.is_active !== false,
    };
  }

  return catalog;
}

/**
 * GST already included in the listed price.
 *
 * Prices are MRP-inclusive ("Inclusive of all taxes" on the card), so the tax
 * component is extracted rather than added. Slabs: 5% up to ₹1000, 12% above.
 */
function gstForLine(unitPrice: number, lineTotal: number) {
  const rate = unitPrice <= 1000 ? 0.05 : 0.12;
  const tax = Math.round((lineTotal * rate) / (1 + rate));
  const cgst = Math.round(tax / 2);
  return { rate, tax, cgst, sgst: tax - cgst };
}

function totalsFor(lines: PricedLine[], shipping: ShippingRule) {
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  // A threshold of 0 means every order ships free.
  const shippingAmount =
    subtotal <= 0 || shipping.freeShippingOver <= 0 || subtotal >= shipping.freeShippingOver
      ? 0
      : shipping.flatShipping;

  const total = Math.max(0, subtotal + shippingAmount);
  const tax = lines.reduce((s, l) => s + gstForLine(l.unitPrice, l.lineTotal).tax, 0);

  return { subtotal, shipping: shippingAmount, total, tax };
}

/** Basic-auth REST call against Razorpay. Never throws; returns { ok, data }. */
async function rzp(path: string, init: RequestInit = {}) {
  try {
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
      ...init,
      headers: {
        Authorization: "Basic " + btoa(`${razorpayKeyId}:${razorpayKeySecret}`),
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: { error: String(error) } };
  }
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string compare (prevents signature timing leaks). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function recordEvent(orderId: string, event: string, detail: unknown) {
  await supabase.from("order_events").insert({ order_id: orderId, event, detail });
}

/** Look up an order by number + receipt token (the guest credential). */
async function loadOrder(orderNumber: string, token: string): Promise<OrderRecord | null> {
  if (!orderNumber || !token) return null;
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("order_number", orderNumber)
    .eq("receipt_token", token)
    .maybeSingle();
  return (data as OrderRecord | null) ?? null;
}

function normalisePayment(p: Record<string, unknown>): GatewayPayment {
  return {
    id: String(p.id ?? ""),
    amount: Number(p.amount ?? 0),
    method: typeof p.method === "string" ? p.method : undefined,
    order_id: typeof p.order_id === "string" ? p.order_id : undefined,
    status: String(p.status ?? ""),
  };
}

/**
 * Ask the gateway whether this order has a captured payment. Checks both the
 * gateway order and the dynamic QR, so we never rely on the customer's word.
 */
async function findGatewayPayment(order: OrderRecord): Promise<GatewayPayment | null> {
  const meta = order.gateway_meta ?? {};

  if (meta.razorpay_order_id) {
    const res = await rzp(`/orders/${meta.razorpay_order_id}/payments`);
    if (res.ok) {
      const items = (res.data.items ?? []) as Record<string, unknown>[];
      const captured = items.map(normalisePayment).find((p) => p.status === "captured");
      if (captured) return captured;
    }
  }

  if (meta.qr_id) {
    const res = await rzp(`/payments/qr_codes/${meta.qr_id}/payments`);
    if (res.ok) {
      const items = (res.data.items ?? []) as Record<string, unknown>[];
      const captured = items.map(normalisePayment).find((p) => p.status === "captured");
      if (captured) return captured;
    }
  }

  return null;
}

/**
 * Take the sold units out of the operator's per-colour stock.
 *
 * Runs only on the one update that actually moved the order to 'paid' (the
 * caller checks the returned row), so a retried webhook cannot decrement twice.
 * A failure is logged but never fails the payment: the money is already taken,
 * and the operator can correct a count in the dashboard.
 */
async function decrementOrderStock(order: { id: string; items?: PricedLine[] }): Promise<void> {
  const lines = Array.isArray(order.items) ? order.items : [];
  if (lines.length === 0) return;

  for (const line of lines) {
    const qty = Math.max(0, Math.floor(Number(line.qty) || 0));
    if (qty === 0) continue;
    const { error } = await supabase.rpc("decrement_variant_stock", {
      p_product_id: String(line.productId),
      p_color: String(line.color),
      p_size: String(line.size),
      p_qty: qty,
    });
    if (error) {
      await recordEvent(order.id, "stock_decrement_failed", {
        product_id: line.productId,
        color: line.color,
        size: line.size,
        qty,
        error: error.message,
      });
    }
  }

  await recordEvent(order.id, "stock_decremented", {
    lines: lines.map((l) => ({
      product_id: l.productId,
      color: l.color,
      size: l.size,
      qty: l.qty,
    })),
  });
}

/**
 * The single place allowed to move an order to 'paid'. Refuses underpayments
 * and is idempotent so retried webhooks cannot double-process.
 */
async function markPaid(
  order: { id: string; order_number: string; total: number; items?: PricedLine[] },
  opts: {
    provider: string;
    paymentId: string;
    reference: string;
    amountPaid: number;
    event: string;
    detail?: unknown;
  },
): Promise<boolean> {
  if (opts.amountPaid < order.total) {
    await recordEvent(order.id, "amount_mismatch", {
      expected: order.total,
      received: opts.amountPaid,
      payment_id: opts.paymentId,
    });
    await supabase
      .from("orders")
      .update({ payment_status: "failed", updated_at: new Date().toISOString() })
      .eq("id", order.id);
    return false;
  }

  const { data: transitionedRows, error } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      payment_provider: opts.provider,
      payment_id: opts.paymentId,
      payment_reference: opts.reference,
      amount_paid: opts.amountPaid,
      paid_at: new Date().toISOString(),
      status: "placed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .neq("payment_status", "paid") // idempotent: webhooks retry
    .select("id");

  if (error) {
    await recordEvent(order.id, "mark_paid_failed", { error: error.message });
    return false;
  }

  // Only the transition into 'paid' may move stock. A retried webhook updates
  // no row, so the counts stay correct.
  const transitioned = Array.isArray(transitionedRows) && transitionedRows.length > 0;
  if (transitioned) {
    await decrementOrderStock(order);
  }

  await recordEvent(
    order.id,
    opts.event,
    opts.detail ?? { payment_id: opts.paymentId, amount: opts.amountPaid },
  );
  return true;
}

/** Raw UPI intent, used when the gateway cannot issue a hosted QR. */
function upiIntentFor(orderNumber: string, amount: number): string | null {
  if (!upiVpa) return null;
  const params = new URLSearchParams({
    pa: upiVpa,
    pn: upiPayeeName,
    am: amount.toFixed(2),
    cu: "INR",
    tn: `Order ${orderNumber}`,
    tr: orderNumber,
  });
  return `upi://pay?${params.toString()}`;
}

function publicOrder(order: OrderRecord) {
  return {
    order_number: order.order_number,
    status: order.status,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    payment_provider: order.payment_provider,
    amount_paid: order.amount_paid,
    total: order.total,
    paid_at: order.paid_at,
    created_at: order.created_at,
    payment_id: order.payment_id,
    payment_reference: order.payment_reference,
  };
}

/**
 * Payment instructions for an order, regenerated server-side so the order page
 * still works after a refresh (the browser does not have to remember the QR).
 */
function paymentInfo(order: OrderRecord) {
  const meta = order.gateway_meta ?? {};
  const expiresAt = new Date(
    new Date(order.created_at).getTime() + PAYMENT_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();

  return {
    mode: demoMode ? 'demo' : 'live',
    demo: demoMode,
    provider: demoMode ? 'demo' : 'razorpay',
    expires_at: expiresAt,
    upi_intent: upiIntentFor(order.order_number, order.total),
    qr_image_url: meta.qr_image_url ?? null,
    qr_id: meta.qr_id ?? null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const url = new URL(req.url);
  const path = routePath(url.pathname, "trios-pay");

  try {
    // ==================== HEALTH ====================
    if (path === "" || path === "/") {
      return json({
        ok: true,
        demo_mode: demoMode,
        gateway: demoMode ? "none" : "razorpay",
        webhook_configured: Boolean(razorpayWebhookSecret),
        upi_fallback_configured: Boolean(upiVpa),
      });
    }

    // ==================== CREATE ORDER ====================
    if (path === "/create" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const customer = (body.customer ?? {}) as Partial<Customer>;

      // --- requirement: collect name, mobile and delivery address ---
      if (isBlank(customer.name)) return json({ error: "Full name is required" }, 400);
      const mobile = cleanMobile(customer.mobile);
      if (!/^[6-9]\d{9}$/.test(mobile)) return json({ error: "Enter a valid 10-digit mobile number" }, 400);
      const email = typeof customer.email === "string" ? customer.email.trim() : "";
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: "Enter a valid email address" }, 400);
      }
      if (!/^\d{6}$/.test(String(customer.pincode ?? ""))) {
        return json({ error: "Enter a valid 6-digit PIN code" }, 400);
      }
      if (isBlank(customer.address)) return json({ error: "Delivery address is required" }, 400);
      if (isBlank(customer.city)) return json({ error: "City is required" }, 400);
      if (isBlank(customer.state)) return json({ error: "State is required" }, 400);

      // --- admin overrides (price + per-size stock) ---
      // Optional refinements on top of the sellable catalog. A row here no
      // longer decides whether the store trades at all.
      const { data: overrides } = await supabase
        .from("product_overrides")
        .select("product_id, price, stock");
      const priceOverrides: Record<string, number> = {};
      const stockOverrides: Record<string, Record<string, number>> = {};
      for (const o of overrides ?? []) {
        if (typeof o.price === "number") priceOverrides[String(o.product_id)] = o.price;
        if (o.stock) stockOverrides[String(o.product_id)] = o.stock as Record<string, number>;
      }

      // Dashboard products included, so an admin-created item can be ordered.
      const catalog = await loadSellableCatalog();
      const shippingRule = await loadShippingRule();

      let lines: PricedLine[];
      try {
        lines = priceCart(body.items, catalog, priceOverrides, stockOverrides);
      } catch (error) {
        if (error instanceof PayloadError) return json({ error: error.message }, 400);
        throw error;
      }

      const totals = totalsFor(lines, shippingRule);

      // --- link the order to an account when the customer is signed in ---
      let userId: string | null = null;
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
        userId = data.user?.id ?? null;
      }

      const receiptToken = randomHex(16);
      const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000).toISOString();

      // --- insert the order (service role; no client write path exists) ---
      let order: { id: string; order_number: string; total: number; receipt_token: string } | null = null;
      let lastError: string | null = null;

      for (let attempt = 0; attempt < 6 && !order; attempt++) {
        const { data, error } = await supabase
          .from("orders")
          .insert({
            user_id: userId,
            order_number: makeOrderNumber(),
            items: lines,
            subtotal: totals.subtotal,
            shipping: totals.shipping,
            total: totals.total,
            status: "placed",
            payment_method: "upi",
            payment_status: "pending",
            payment_provider: demoMode ? "demo" : "razorpay",
            shipping_address: {
              fullName: customer.name,
              mobile,
              email: email || null,
              pincode: customer.pincode,
              address: customer.address,
              city: customer.city,
              state: customer.state,
            },
            customer_name: customer.name,
            customer_mobile: mobile,
            customer_email: email || null,
            receipt_token: receiptToken,
          })
          .select("id, order_number, total, receipt_token")
          .single();

        if (error) {
          lastError = error.message;
          if (!error.message.toLowerCase().includes("duplicate")) break;
          continue; // order-number collision: retry
        }
        order = data;
      }

      if (!order) {
        return json({ error: "Could not create the order. Please try again.", detail: lastError }, 500);
      }

      await recordEvent(order.id, "created", {
        total: totals.total,
        items: lines.length,
        demo: demoMode,
      });

      // --- create the payment intent ---
      const payment: Record<string, unknown> = {
        mode: demoMode ? "demo" : "live",
        demo: demoMode,
        provider: demoMode ? "demo" : "razorpay",
        expires_at: expiresAt,
        upi_intent: upiIntentFor(order.order_number, totals.total),
      };

      if (!demoMode) {
        const rzpOrder = await rzp("/orders", {
          method: "POST",
          body: JSON.stringify({
            amount: totals.total * 100,
            currency: "INR",
            receipt: order.order_number,
            notes: { order_number: order.order_number, mobile },
          }),
        });

        if (!rzpOrder.ok) {
          await recordEvent(order.id, "gateway_order_failed", rzpOrder.data);
          await supabase.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
          return json({ error: "Payment gateway is unavailable right now. Please try again." }, 502);
        }

        const rzpOrderId = String(rzpOrder.data.id);

        // Dynamic, single-use UPI QR for exactly this amount.
        const qr = await rzp("/payments/qr_codes", {
          method: "POST",
          body: JSON.stringify({
            type: "upi_qr",
            name: upiPayeeName,
            usage: "single_use",
            fixed_amount: true,
            payment_amount: totals.total * 100,
            description: `TriosWorld order ${order.order_number}`,
            close_by: Math.floor(new Date(expiresAt).getTime() / 1000),
            notes: { order_number: order.order_number, razorpay_order_id: rzpOrderId },
          }),
        });

        const gatewayMeta: Record<string, unknown> = { razorpay_order_id: rzpOrderId };
        if (qr.ok) {
          gatewayMeta.qr_id = qr.data.id;
          gatewayMeta.qr_image_url = qr.data.image_url;
          payment.qr_id = qr.data.id;
          payment.qr_image_url = qr.data.image_url;
        } else {
          // QR Codes may not be enabled on the account; the UPI intent still
          // lets the customer pay, and verification stays server-side.
          await recordEvent(order.id, "qr_unavailable", qr.data);
        }

        await supabase.from("orders").update({ gateway_meta: gatewayMeta }).eq("id", order.id);

        payment.razorpay_order_id = rzpOrderId;
        payment.razorpay_key_id = razorpayKeyId;
      }

      return json({
        order_number: order.order_number,
        order_id: order.id,
        receipt_token: receiptToken,
        amount: totals.total,
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        expires_at: expiresAt,
        items: lines,
        payment,
      });
    }

    // ==================== STATUS (server-verified polling) ====================
    if (path === "/status" && req.method === "GET") {
      const order = await loadOrder(
        url.searchParams.get("order") ?? "",
        url.searchParams.get("token") ?? "",
      );
      if (!order) return json({ error: "Order not found" }, 404);

      // Already settled — nothing to re-check.
      if (["paid", "failed", "expired", "refunded"].includes(order.payment_status)) {
        return json({
          payment_status: order.payment_status,
          verified: order.payment_status === "paid",
          order: publicOrder(order),
          payment: paymentInfo(order),
        });
      }

      // Re-query the gateway. This is what makes "paid" trustworthy.
      if (!demoMode) {
        const found = await findGatewayPayment(order);
        if (found) {
          await markPaid(order, {
            provider: "razorpay",
            paymentId: found.id,
            reference: found.order_id ?? found.id,
            amountPaid: Math.round(found.amount / 100),
            event: "status_verified",
            detail: { source: "gateway_poll", method: found.method },
          });
          const { data: fresh } = await supabase.from("orders").select("*").eq("id", order.id).single();
          const updated = (fresh as OrderRecord | null) ?? order;
          return json({
            payment_status: updated.payment_status,
            verified: updated.payment_status === "paid",
            order: publicOrder(updated),
            payment: paymentInfo(updated),
          });
        }
      }

      // Window elapsed with no capture → "expired" (abandoned/delayed), never
      // reported as a hard failure.
      const expiresAt = new Date(order.created_at).getTime() + PAYMENT_WINDOW_MINUTES * 60 * 1000;
      if (Date.now() > expiresAt) {
        await supabase
          .from("orders")
          .update({ payment_status: "expired", updated_at: new Date().toISOString() })
          .eq("id", order.id);
        await recordEvent(order.id, "expired", { waited_minutes: PAYMENT_WINDOW_MINUTES });
        return json({
          payment_status: "expired",
          verified: false,
          order: { ...publicOrder(order), payment_status: "expired" },
          payment: paymentInfo(order),
        });
      }

      return json({
        payment_status: "pending",
        verified: false,
        order: publicOrder(order),
        payment: paymentInfo(order),
      });
    }

    // ==================== WEBHOOK (signature-verified) ====================
    if (path === "/webhook" && req.method === "POST") {
      const raw = await req.text();
      const signature = req.headers.get("x-razorpay-signature") ?? "";

      // Never trust an unsigned callback.
      if (!razorpayWebhookSecret) return json({ error: "Webhook not configured" }, 503);

      const expected = await hmacHex(razorpayWebhookSecret, raw);
      if (!signature || !timingSafeEqual(expected, signature)) {
        return json({ error: "Invalid signature" }, 401);
      }

      let payload: {
        event?: string;
        payload?: Record<string, { entity?: Record<string, unknown> }>;
      };
      try {
        payload = JSON.parse(raw);
      } catch {
        return json({ error: "Invalid payload" }, 400);
      }

      const event = payload.event ?? "";
      const entity =
        payload.payload?.payment?.entity ??
        payload.payload?.qr_code?.entity ??
        payload.payload?.order?.entity ??
        {};

      const notes = entity.notes as Record<string, string> | undefined;
      const orderNumber = notes?.order_number ?? (typeof entity.receipt === "string" ? entity.receipt : undefined);

      if (!orderNumber) return json({ ok: true, ignored: "no order reference" });

      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("order_number", orderNumber)
        .maybeSingle();
      const order = data as OrderRecord | null;
      if (!order) return json({ ok: true, ignored: "unknown order" });

      if (event === "payment.captured" || event === "order.paid" || event === "qr_code.credited") {
        // Different events report the settled amount under different keys, all
        // in paise. Read whichever is present; only fall back to the order total
        // if the gateway sent none at all.
        const paise =
          typeof entity.amount === "number" ? entity.amount
            : typeof entity.amount_paid === "number" ? entity.amount_paid
              : typeof entity.payment_amount === "number" ? entity.payment_amount
                : null;
        const amount = paise != null ? Math.round(paise / 100) : order.total;
        await markPaid(order, {
          provider: "razorpay",
          paymentId: String(entity.id ?? orderNumber),
          reference: String(entity.order_id ?? entity.id ?? orderNumber),
          amountPaid: amount,
          event: "webhook_paid",
          detail: { event, method: entity.method ?? "upi" },
        });
      } else if (event === "payment.failed") {
        await supabase
          .from("orders")
          .update({ payment_status: "failed", updated_at: new Date().toISOString() })
          .eq("id", order.id);
        await recordEvent(order.id, "webhook_failed", {
          event,
          error: entity.error_description ?? null,
        });
      } else {
        await recordEvent(order.id, "webhook_ignored", { event });
      }

      // Always 200 on handled events so the gateway does not retry forever.
      return json({ ok: true });
    }

    // ==================== DEMO SETTLEMENT ====================
    if (path === "/demo-settle" && req.method === "POST") {
      if (!demoMode) return json({ error: "Not available" }, 403);

      const body = await req.json().catch(() => ({}));
      const order = await loadOrder(String(body.order ?? ""), String(body.token ?? ""));
      if (!order) return json({ error: "Order not found" }, 404);
      if (order.payment_status === "paid") return json({ ok: true, already: true, demo: true });

      const paid = await markPaid(order, {
        provider: "demo",
        paymentId: `DEMO-${randomHex(6).toUpperCase()}`,
        reference: `DEMO-${order.order_number}`,
        amountPaid: order.total,
        event: "demo_settled",
        detail: { note: "No gateway configured - settled server-side in demo mode." },
      });

      return json({ ok: paid, demo: true });
    }

    // ==================== RECEIPT (paid orders only) ====================
    if (path === "/receipt" && req.method === "GET") {
      const order = await loadOrder(
        url.searchParams.get("order") ?? "",
        url.searchParams.get("token") ?? "",
      );
      if (!order) return json({ error: "Receipt not found" }, 404);

      // Requirement: receipts exist only for verified, paid orders.
      if (order.payment_status !== "paid") {
        return json({ error: "A receipt is available once the payment is confirmed." }, 403);
      }

      const lines = (order.items ?? []) as PricedLine[];
      const gstLines = lines.map((l) => ({ ...l, gst: gstForLine(l.unitPrice, l.lineTotal) }));
      const taxTotal = gstLines.reduce((s, l) => s + l.gst.tax, 0);

      return json({
        receipt: {
          order_number: order.order_number,
          order_date: order.created_at,
          paid_at: order.paid_at,
          payment_status: order.payment_status,
          payment_method: order.payment_method,
          payment_provider: order.payment_provider,
          payment_id: order.payment_id,
          payment_reference: order.payment_reference,
          amount_paid: order.amount_paid,
          is_demo: order.payment_provider === "demo",
          customer: order.shipping_address,
          items: gstLines,
          subtotal: order.subtotal,
          shipping: order.shipping,
          total: order.total,
          tax_included: taxTotal,
        },
      });
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    // Surfaced to the caller in non-production. A bare "Server error" for a
    // checkout failure is unactionable: it cost a real debugging session where
    // the only symptom was a 500 with no clue which step failed.
    const detail = error instanceof Error ? error.message : String(error);
    console.error("trios-pay error", error);
    const body: Record<string, unknown> = { error: "Server error", detail };
    if (Deno.env.get("PAYMENT_DEBUG") === "true") body.detail = detail;
    return json(body, 500);
  }
});

// TriosWorld admin edge function.
//
// Powers the /admin dashboard: operator login, order + payment management,
// guest/registered customer lists, product overrides and customer feedback.
//
// AUTH
//   Operators are rows in the `admins` table (bcrypt hashes, seeded by the
//   payments/admin migration). Login returns a signed, stateless session token:
//
//       base64url(payload) + "." + HMAC-SHA256(base64url(payload), secret)
//
//   The signing secret is ADMIN_SESSION_SECRET when set, otherwise the service
//   role key — which never leaves the server. Tokens carry an expiry and are
//   re-verified on every request, so the browser holding one is not enough:
//   the server still decides what an operator may read.
//
//   `admins` has RLS enabled with NO policies, so it is unreachable from the
//   browser even for signed-in customers. Only this function (service role) reads it.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@3.0.3";
import { PRICES } from "../_shared/prices.ts";
import { routePath } from "../_shared/http.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sessionSecret = Deno.env.get("ADMIN_SESSION_SECRET") || serviceRoleKey;

const SESSION_HOURS = 12;
const BCRYPT_ROUNDS = 10;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface AdminRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface AdminSession {
  sub: string;
  email: string;
  role: string;
  exp: number;
}

async function issueToken(admin: AdminRow): Promise<string> {
  const session: AdminSession = {
    sub: admin.id,
    email: admin.email,
    role: admin.role,
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  };
  const payload = b64url(JSON.stringify(session));
  const sig = await hmacHex(sessionSecret, payload);
  return `${payload}.${sig}`;
}

async function verifyToken(token: string | null): Promise<AdminSession | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = await hmacHex(sessionSecret, payload);
  if (!timingSafeEqual(expected, sig)) return null;

  try {
    const session = JSON.parse(fromB64url(payload)) as AdminSession;
    if (!session.exp || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/** Returns the session, or a 401 Response when the caller is not an operator. */
async function requireAdmin(req: Request): Promise<AdminSession | Response> {
  const header = req.headers.get("Authorization") ?? "";
  const session = await verifyToken(header.startsWith("Bearer ") ? header.slice(7) : null);
  if (!session) return json({ error: "Your session has expired. Please sign in again." }, 401);

  // Re-check the operator on every request so deactivating an admin takes
  // effect immediately rather than when the token expires.
  const { data } = await supabase
    .from("admins")
    .select("id, is_active")
    .eq("id", session.sub)
    .maybeSingle();
  if (!data || data.is_active === false) return json({ error: "Account disabled" }, 403);

  return session;
}

/** Brute-force protection for operator logins. */
async function loginBlocked(email: string): Promise<boolean> {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("auth_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("mobile", `admin:${email}`)
    .gte("attempted_at", since);
  return (count ?? 0) >= 5;
}

async function recordLoginAttempt(email: string) {
  await supabase.from("auth_rate_limits").insert({ mobile: `admin:${email}` });
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await supabase.from("auth_rate_limits").delete().lt("attempted_at", cutoff);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const url = new URL(req.url);
  const path = routePath(url.pathname, "trios-admin");

  // Unauthenticated liveness probe, used by scripts/check-functions.mjs.
  if (path === "/health") {
    return json({ ok: true, function: "trios-admin", rawPath: url.pathname });
  }
  // Distinct path used to defeat stale edge caching while diagnosing.
  if (path === "/health-canary") {
    return json({ ok: true, function: "trios-admin", rawPath: url.pathname, build: 3 });
  }

  try {
    // ==================== LOGIN (unauthenticated) ====================
    if (path === "/login" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");

      if (!email || !password) return json({ error: "Email and password are required" }, 400);

      if (await loginBlocked(email)) {
        return json({ error: "Too many attempts. Please try again in 15 minutes." }, 429);
      }

      const { data } = await supabase.from("admins").select("*").eq("email", email).maybeSingle();
      const admin = data as AdminRow | null;

      await recordLoginAttempt(email);

      // Always run a comparison so timing does not reveal whether the email exists.
      const stored = admin?.password_hash ?? "$2b$10$HI41p1SFe.W/PpfPksANXuCBUX/BJFYPBwSH.r8ey4gC0ANx64n8u";
      const matches = await bcrypt.compare(password, stored);

      if (!admin || !matches || admin.is_active === false) {
        return json({ error: "Invalid email or password" }, 401);
      }

      await supabase
        .from("admins")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", admin.id);
      await supabase.from("auth_rate_limits").delete().eq("mobile", `admin:${email}`);

      return json({
        token: await issueToken(admin),
        admin: { id: admin.id, email: admin.email, name: admin.full_name, role: admin.role },
      });
    }

    // Everything below requires a valid operator session.
    const session = await requireAdmin(req);
    if (session instanceof Response) return session;

    // ==================== SESSION CHECK ====================
    if (path === "/me" && req.method === "GET") {
      const { data } = await supabase
        .from("admins")
        .select("id, email, full_name, role, last_login_at")
        .eq("id", session.sub)
        .maybeSingle();
      return json({ admin: data });
    }

    // ==================== OVERVIEW ====================
    if (path === "/overview" && req.method === "GET") {
      const { data: orders } = await supabase
        .from("orders")
        .select("total, payment_status, created_at, user_id, amount_paid");

      const rows = orders ?? [];
      const paid = rows.filter((o) => o.payment_status === "paid");
      const { count: newFeedback } = await supabase
        .from("feedback")
        .select("*", { count: "exact", head: true })
        .eq("status", "new");

      const todayIso = new Date().toISOString().slice(0, 10);

      return json({
        overview: {
          orders_total: rows.length,
          orders_today: rows.filter((o) => String(o.created_at).slice(0, 10) === todayIso).length,
          orders_paid: paid.length,
          orders_pending: rows.filter((o) => o.payment_status === "pending").length,
          orders_failed: rows.filter((o) => o.payment_status === "failed").length,
          orders_expired: rows.filter((o) => o.payment_status === "expired").length,
          revenue: paid.reduce((s, o) => s + (o.amount_paid ?? o.total ?? 0), 0),
          revenue_today: paid
            .filter((o) => String(o.created_at).slice(0, 10) === todayIso)
            .reduce((s, o) => s + (o.amount_paid ?? o.total ?? 0), 0),
          guests: rows.filter((o) => !o.user_id).length,
          registered: rows.filter((o) => o.user_id).length,
          new_feedback: newFeedback ?? 0,
        },
      });
    }

    // ==================== ORDERS / PAYMENTS ====================
    if (path === "/orders" && req.method === "GET") {
      const status = url.searchParams.get("status");
      const search = (url.searchParams.get("q") ?? "").trim();
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);

      let query = supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, customer_mobile, customer_email, items, subtotal, shipping, discount, total, amount_paid, status, payment_status, payment_method, payment_provider, payment_id, payment_reference, paid_at, created_at, user_id, shipping_address",
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status && status !== "all") query = query.eq("payment_status", status);
      if (search) {
        query = query.or(
          `order_number.ilike.%${search}%,customer_mobile.ilike.%${search}%,customer_name.ilike.%${search}%`,
        );
      }

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ orders: data ?? [] });
    }

    if (path === "/order" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const id = String(body.id ?? "");
      if (!id) return json({ error: "Order id is required" }, 400);

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.status === "string") patch.status = body.status;
      if (typeof body.payment_status === "string") patch.payment_status = body.payment_status;

      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) return json({ error: error.message }, 500);

      await supabase.from("order_events").insert({
        order_id: id,
        event: "admin_update",
        detail: { by: session.email, ...patch },
      });

      return json({ ok: true });
    }

    if (path === "/order-events" && req.method === "GET") {
      const id = url.searchParams.get("id") ?? "";
      const { data } = await supabase
        .from("order_events")
        .select("id, event, detail, created_at")
        .eq("order_id", id)
        .order("created_at", { ascending: true });
      return json({ events: data ?? [] });
    }

    // ==================== CUSTOMERS (registered + guests) ====================
    if (path === "/customers" && req.method === "GET") {
      const { data: orders } = await supabase
        .from("orders")
        .select("order_number, user_id, customer_name, customer_mobile, customer_email, total, amount_paid, payment_status, created_at, shipping_address")
        .order("created_at", { ascending: false });

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, mobile, gender, created_at")
        .order("created_at", { ascending: false });

      // Group orders by mobile so each customer appears once.
      const byMobile = new Map<string, {
        name: string;
        mobile: string;
        email: string | null;
        type: "guest" | "registered";
        orders: number;
        spent: number;
        last_order: string | null;
        address: unknown;
      }>();

      for (const o of orders ?? []) {
        const mobile = o.customer_mobile ?? "unknown";
        const existing = byMobile.get(mobile);
        const spent = o.payment_status === "paid" ? (o.amount_paid ?? o.total ?? 0) : 0;
        if (existing) {
          existing.orders += 1;
          existing.spent += spent;
        } else {
          byMobile.set(mobile, {
            name: o.customer_name ?? "Guest",
            mobile,
            email: o.customer_email ?? null,
            type: o.user_id ? "registered" : "guest",
            orders: 1,
            spent,
            last_order: o.created_at,
            address: o.shipping_address,
          });
        }
      }

      // Registered accounts with no orders yet still deserve a row.
      for (const p of profiles ?? []) {
        if (!p.mobile || byMobile.has(p.mobile)) continue;
        byMobile.set(p.mobile, {
          name: p.full_name ?? "Customer",
          mobile: p.mobile,
          email: null,
          type: "registered",
          orders: 0,
          spent: 0,
          last_order: null,
          address: null,
        });
      }

      return json({ customers: Array.from(byMobile.values()) });
    }

    // ==================== PRODUCTS ====================
    if (path === "/products" && req.method === "GET") {
      const { data: overrides } = await supabase.from("product_overrides").select("*");
      const byId = new Map((overrides ?? []).map((o) => [o.product_id, o]));

      const products = Object.entries(PRICES).map(([id, entry]) => {
        const o = byId.get(id);
        const stock = (o?.stock as Record<string, number> | undefined) ?? entry.sizes;
        return {
          id,
          name: entry.name,
          slug: entry.slug,
          mrp: entry.mrp,
          catalog_price: entry.price,
          price: o?.price ?? entry.price,
          colors: entry.colors,
          stock,
          stock_total: Object.values(stock).reduce((s, n) => s + (Number(n) || 0), 0),
          is_active: o?.is_active ?? true,
          updated_at: o?.updated_at ?? null,
          overridden: Boolean(o),
        };
      });

      return json({ products });
    }

    if (path === "/product" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const productId = String(body.productId ?? "");
      if (!PRICES[productId]) return json({ error: "Unknown product" }, 404);

      const patch: Record<string, unknown> = {
        product_id: productId,
        updated_at: new Date().toISOString(),
      };

      if (body.price !== undefined && body.price !== null && body.price !== "") {
        const price = Number(body.price);
        if (!Number.isFinite(price) || price < 0) return json({ error: "Price must be a positive number" }, 400);
        patch.price = Math.round(price);
      }
      if (body.mrp !== undefined && body.mrp !== null && body.mrp !== "") {
        const mrp = Number(body.mrp);
        if (!Number.isFinite(mrp) || mrp < 0) return json({ error: "MRP must be a positive number" }, 400);
        patch.mrp = Math.round(mrp);
      }
      if (body.stock && typeof body.stock === "object") {
        const clean: Record<string, number> = {};
        for (const [size, n] of Object.entries(body.stock as Record<string, unknown>)) {
          const value = Number(n);
          if (!Number.isFinite(value) || value < 0) return json({ error: `Invalid stock for ${size}` }, 400);
          clean[size] = Math.floor(value);
        }
        patch.stock = clean;
      }
      if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

      const { error } = await supabase.from("product_overrides").upsert(patch, { onConflict: "product_id" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ==================== FEEDBACK ====================
    if (path === "/feedback" && req.method === "GET") {
      const status = url.searchParams.get("status");
      let query = supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status && status !== "all") query = query.eq("status", status);

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ feedback: data ?? [] });
    }

    if (path === "/feedback" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const id = String(body.id ?? "");
      const status = String(body.status ?? "");
      if (!id || !["new", "read", "resolved"].includes(status)) {
        return json({ error: "Invalid feedback update" }, 400);
      }
      const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ==================== CHANGE OWN PASSWORD ====================
    if (path === "/password" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const current = String(body.current ?? "");
      const next = String(body.next ?? "");

      if (next.length < 10) return json({ error: "Use at least 10 characters" }, 400);
      if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) {
        return json({ error: "Include at least one letter and one number" }, 400);
      }

      const { data } = await supabase.from("admins").select("password_hash").eq("id", session.sub).maybeSingle();
      if (!data || !(await bcrypt.compare(current, data.password_hash))) {
        return json({ error: "Current password is incorrect" }, 401);
      }

      await supabase
        .from("admins")
        .update({ password_hash: await bcrypt.hash(next, BCRYPT_ROUNDS) })
        .eq("id", session.sub);

      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error("trios-admin error", error);
    return json({ error: "Server error" }, 500);
  }
});

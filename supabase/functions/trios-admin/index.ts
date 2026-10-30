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

/** URL slug from a product name, matching the catalog's slug style. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ─────────────────────────── storefront content ────────────────────────────

const CONTENT_MAX_DEPTH = 6;
const CONTENT_MAX_STR = 4000;
const CONTENT_MAX_ARR = 60;
const CONTENT_MAX_BYTES = 400_000;

/**
 * Structured scrub of the operator's content document before it is stored.
 *
 * The document is rendered by React (which escapes every string), so this is
 * about shape and size rather than markup: bounded depth/lengths, plain
 * keys only, no `javascript:` href sneaking through, and no giant payload
 * hitting the row. Returns null when the input is not a JSON object.
 */
function sanitizeContent(raw: unknown): Record<string, unknown> | null {
  const walk = (v: unknown, depth: number): unknown => {
    if (depth > CONTENT_MAX_DEPTH) return undefined;
    if (typeof v === "string") {
      const s = v.split("\u0000").join("").trimStart();
      return (/^\s*javascript:/i.test(s) ? s.replace(/^\s*javascript:/i, "") : s).slice(0, CONTENT_MAX_STR);
    }
    if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
    if (typeof v === "boolean") return v;
    if (v === null) return null;
    if (Array.isArray(v)) {
      return v.slice(0, CONTENT_MAX_ARR).map((x) => walk(x, depth + 1)).filter((x) => x !== undefined);
    }
    if (typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (!/^[A-Za-z0-9_]{1,40}$/.test(k)) continue;
        const w = walk(val, depth + 1);
        if (w !== undefined) out[k] = w;
      }
      return out;
    }
    return undefined;
  };

  const out = walk(raw, 0);
  if (!out || typeof out !== "object" || Array.isArray(out)) return null;
  return out as Record<string, unknown>;
}

// ─────────────────────────── product colours ───────────────────────────────

const KNOWN_COLOR_HEX: Record<string, string> = {
  black: "#171717", white: "#ffffff", ivory: "#f7f5f0", "off-white": "#f7f5f0",
  cream: "#efe9dc", olive: "#5b5f3a", stone: "#ddd8ce", navy: "#1f2a44",
  lime: "#b7ff43", rust: "#9e4a2e", sage: "#9caf88", sand: "#d8c4a0",
  beige: "#d8c4a0", cobalt: "#2b4cb8", blue: "#2b4cb8", burgundy: "#5e1f2a",
  maroon: "#5e1f2a", charcoal: "#2d2d2d", grey: "#9a9a9a", gray: "#9a9a9a",
  red: "#a5281b", green: "#4a6741", yellow: "#e8c33c",
};

/**
 * Colours are stored as { name, hex } pairs so the swatch a customer taps is
 * the colour the operator picked. Accepts the current object shape AND the
 * legacy bare-name strings, resolving well-known names to their hex and
 * falling back to ink for anything unknown — the same neutral the card used
 * before the picker existed.
 *
 * Each colour may also carry its own per-size stock (`sizes`). That is what
 * lets a product hold, say, Blue-M in stock while Blue-L is sold out: the size
 * picker on the product page reads the selected colour's own numbers. A colour
 * with no `sizes` map (every colour written before this existed) simply falls
 * back to the product-wide `stock`, so nothing already saved changes behaviour.
 */
function normalizeColors(raw: unknown): { name: string; hex: string; sizes?: Record<string, number> }[] {
  if (!Array.isArray(raw)) return [];
  const out: { name: string; hex: string; sizes?: Record<string, number> }[] = [];
  for (const entry of raw.slice(0, 12)) {
    let name = "";
    let hex = "";
    let sizes: Record<string, number> | undefined;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const obj = entry as Record<string, unknown>;
      name = String(obj.name ?? "").trim().slice(0, 40);
      hex = String(obj.hex ?? "").trim().toLowerCase();
      // Per-size stock, clamped to a sane count and capped to the sizes we
      // render. An empty map is dropped so it means "use the shared stock".
      if (obj.sizes && typeof obj.sizes === "object" && !Array.isArray(obj.sizes)) {
        const map: Record<string, number> = {};
        for (const [size, qty] of Object.entries(obj.sizes as Record<string, unknown>)) {
          const key = String(size).trim().slice(0, 12);
          const num = Number(qty);
          if (!key || !Number.isFinite(num)) continue;
          map[key] = Math.max(0, Math.min(100000, Math.round(num)));
        }
        if (Object.keys(map).length) sizes = map;
      }
    } else if (typeof entry === "string") {
      name = entry.trim().slice(0, 40);
    }
    if (!name) continue;
    if (!/^#[0-9a-f]{6}$/.test(hex)) hex = KNOWN_COLOR_HEX[name.toLowerCase()] ?? "#171717";
    out.push(sizes ? { name, hex, sizes } : { name, hex });
  }
  return out;
}


/**
 * Append to the moderation trail. Never throws: losing an audit row must not
 * fail the operator's action.
 */
async function audit(
  adminEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  detail: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("admin_actions").insert({
      admin_email: adminEmail,
      action,
      target_type: targetType,
      target_id: targetId,
      detail,
    });
  } catch {
    // intentionally ignored
  }
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
    return json({ ok: true, function: "trios-admin", rawPath: url.pathname, build: 4 });
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

    // ==================== ORDER DELETE (INDIVIDUAL) ====================
    if (path === "/order-delete" && req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        const id = String(body.id ?? "").trim();
        if (!id) return json({ error: "id required" }, 400);
        await supabase.from("order_events").delete().eq("order_id", id);
        const { error } = await supabase.from("orders").delete().eq("id", id);
        if (error) return json({ error: error.message }, 500);
        await audit(session.email, "order.delete", "order", id, {});
        return json({ ok: true });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
      }
    }

    // ==================== ORDER TRASH ====================
    // Move to Trash is the operator's tidy-up for delivered orders: the row
    // disappears from Orders & Payments, waits 48 hours in Trash, and is then
    // deleted automatically (single-row delete — the period purge never touches
    // an order the operator did not trash). Restore pulls it back at any time.
    const TRASH_TTL_MS = 48 * 60 * 60 * 1000;

    /**
     * Permanently delete every order that has been in trash for 48+ hours.
     * Runs lazily whenever an operator lists orders or trash, so the 48-hour
     * promise holds even if the scheduled database job has not fired yet.
     * Never throws — a purge failure must not break the listing.
     */
    async function purgeExpiredTrash(): Promise<void> {
      try {
        const cutoff = new Date(Date.now() - TRASH_TTL_MS).toISOString();
        const { data: doomed } = await supabase
          .from("orders")
          .select("id")
          .lt("trashed_at", cutoff);
        const ids = (doomed ?? []).map((o) => String((o as { id: string }).id));
        if (!ids.length) return;
        await supabase.from("order_events").delete().in("order_id", ids);
        const { error } = await supabase.from("orders").delete().in("id", ids);
        if (!error) {
          for (const id of ids) await audit("system", "order.purge.auto", "order", id, {});
        }
      } catch {
        // intentionally ignored — the cron schedule is the primary purge
      }
    }

    if (path === "/order-trash" && req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        const id = String(body.id ?? "").trim();
        if (!id) return json({ error: "id required" }, 400);

        const { data } = await supabase
          .from("orders")
          .select("id, order_number, status, trashed_at")
          .eq("id", id)
          .maybeSingle();
        const row = data as { order_number: string; status: string; trashed_at: string | null } | null;
        if (!row) return json({ error: "Order not found — it may already be gone." }, 404);
        if (row.trashed_at) return json({ error: "That order is already in Trash." }, 409);
        if (String(row.status ?? "") !== "delivered") {
          return json({ error: "Only delivered orders can be moved to Trash." }, 409);
        }

        const nowIso = new Date().toISOString();
        const autoDeleteAt = new Date(Date.now() + TRASH_TTL_MS).toISOString();
        const { error } = await supabase
          .from("orders")
          .update({ trashed_at: nowIso, updated_at: nowIso })
          .eq("id", id);
        if (error) return json({ error: error.message }, 500);

        await supabase.from("order_events").insert({
          order_id: id,
          event: "order_trash",
          detail: { by: session.email, auto_delete_at: autoDeleteAt },
        });
        await audit(session.email, "order.trash", "order", id, {
          order_number: row.order_number,
          auto_delete_at: autoDeleteAt,
        });
        return json({ ok: true, auto_delete_at: autoDeleteAt });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
      }
    }

    if (path === "/order-restore" && req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        const id = String(body.id ?? "").trim();
        if (!id) return json({ error: "id required" }, 400);

        const { data } = await supabase
          .from("orders")
          .select("id, order_number, trashed_at")
          .eq("id", id)
          .maybeSingle();
        const row = data as { order_number: string; trashed_at: string | null } | null;
        if (!row) return json({ error: "Order not found — it may already be gone." }, 404);
        if (!row.trashed_at) return json({ error: "That order is not in Trash." }, 409);

        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from("orders")
          .update({ trashed_at: null, updated_at: nowIso })
          .eq("id", id);
        if (error) return json({ error: error.message }, 500);

        await supabase.from("order_events").insert({
          order_id: id,
          event: "order_restore",
          detail: { by: session.email },
        });
        await audit(session.email, "order.restore", "order", id, { order_number: row.order_number });
        return json({ ok: true });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
      }
    }

    // ==================== FEEDBACK DELETE (INDIVIDUAL) ====================
    if (path === "/feedback-delete" && req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        const id = String(body.id ?? "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await supabase.from("feedback").delete().eq("id", id);
        if (error) return json({ error: error.message }, 500);
        await audit(session.email, "feedback.delete", "feedback", id, {});
        return json({ ok: true });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
      }
    }

    // ==================== ORDERS / PAYMENTS ====================
    // There is deliberately no bulk-clear endpoint. An operator can delete one
    // order from its row, or one guest's full history from the guest profile.
    // The ONLY automatic deletion is the Trash purge below: an order the
    // operator moved to trash is removed 48 hours later, one by one —
    // nothing outside trash is ever touched by a schedule.
    if (path === "/orders" && req.method === "GET") {
      const status = url.searchParams.get("status");
      const search = (url.searchParams.get("q") ?? "").trim().replace(/[^a-zA-Z0-9 \-]/g, "").slice(0, 40);
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);
      const isTrashView = url.searchParams.get("trash") === "1";

      // The 48-hour promise holds even if the database schedule has not fired.
      await purgeExpiredTrash();

      let query = supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, customer_mobile, customer_email, items, subtotal, shipping, discount, total, amount_paid, status, payment_status, payment_method, payment_provider, payment_id, payment_reference, paid_at, created_at, user_id, shipping_address, trashed_at",
        )
        .order(isTrashView ? "trashed_at" : "created_at", { ascending: false })
        .limit(limit);

      if (status && status !== "all") query = query.eq("payment_status", status);
      if (search) {
        query = query.or(
          `order_number.ilike.%${search}%,customer_mobile.ilike.%${search}%,customer_name.ilike.%${search}%`,
        );
      }

      // A trashed order is live only in Trash. Restore removes the trash mark.
      query = isTrashView ? query.not("trashed_at", "is", null) : query.is("trashed_at", null);

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ orders: data ?? [] });
    }

    if (path === "/order" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const id = String(body.id ?? "");
      if (!id) return json({ error: "Order id is required" }, 400);

      const { data: current, error: readError } = await supabase
        .from("orders")
        .select("id, order_number, total, payment_status, paid_at, amount_paid, items")
        .eq("id", id)
        .maybeSingle();
      if (readError) return json({ error: readError.message }, 500);
      if (!current) return json({ error: "Order not found" }, 404);

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.status === "string") patch.status = body.status;
      if (typeof body.payment_status === "string") patch.payment_status = body.payment_status;
      if (typeof body.payment_reference === "string") {
        patch.payment_reference = body.payment_reference.trim() || null;
      }
      if (typeof body.payment_provider === "string") patch.payment_provider = body.payment_provider;

      // A manual mark-paid (typically a direct UPI transfer the operator has
      // checked in the bank statement) must behave like a gateway capture:
      // record the paid facts and take the sold units out of stock exactly once.
      const markingPaid =
        body.payment_status === "paid" && current.payment_status !== "paid";
      if (markingPaid) {
        patch.paid_at = current.paid_at ?? new Date().toISOString();
        patch.amount_paid = current.amount_paid ?? current.total;
        if (typeof body.payment_reference === "string" && body.payment_reference.trim()) {
          patch.payment_provider = "upi";
        }
      }

      if (markingPaid) {
        // The condition makes the pending -> paid transition single-winner, so
        // a double click (or two admins) cannot decrement stock twice.
        const { data: updated, error } = await supabase
          .from("orders")
          .update(patch)
          .eq("id", id)
          .neq("payment_status", "paid")
          .select("id");
        if (error) return json({ error: error.message }, 500);

        if (Array.isArray(updated) && updated.length > 0) {
          const lines = Array.isArray(current.items) ? current.items : [];
          for (const line of lines) {
            const qty = Math.max(0, Math.floor(Number((line as { qty?: number }).qty) || 0));
            if (qty === 0) continue;
            const { error: stockError } = await supabase.rpc("decrement_variant_stock", {
              p_product_id: String((line as { productId?: string }).productId ?? ""),
              p_color: String((line as { color?: string }).color ?? ""),
              p_size: String((line as { size?: string }).size ?? ""),
              p_qty: qty,
            });
            if (stockError) {
              await supabase.from("order_events").insert({
                order_id: id,
                event: "stock_decrement_failed",
                detail: { source: "admin_mark_paid", line, error: stockError.message },
              });
            }
          }
          await supabase.from("order_events").insert({
            order_id: id,
            event: "stock_decremented",
            detail: {
              source: "admin_mark_paid",
              lines: lines.map((line) => ({
                product_id: (line as { productId?: string }).productId,
                color: (line as { color?: string }).color,
                size: (line as { size?: string }).size,
                qty: (line as { qty?: number }).qty,
              })),
            },
          });
        }
      } else {
        const { error } = await supabase.from("orders").update(patch).eq("id", id);
        if (error) return json({ error: error.message }, 500);
      }

      await supabase.from("order_events").insert({
        order_id: id,
        event: markingPaid ? "admin_mark_paid" : "admin_update",
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
    // Only products created in this dashboard. The 12 coded catalog products
    // are excluded: they live in src/data/catalog.ts, cannot be represented by a
    // database row, and are no longer shown in the shop either.
    if (path === "/products" && req.method === "GET") {
      const { data: runtimeRows, error: runtimeErr } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (runtimeErr) return json({ error: runtimeErr.message }, 500);

      const runtimeProducts = (runtimeRows ?? []).map((r) => {
        // Runtime products carry their own per-size stock; fall back to a flat
        // "all sizes" entry so the edit form always has something to show.
        const saved = (r.stock as Record<string, number> | null) ?? {};
        const stock: Record<string, number> = Object.keys(saved).length
          ? saved
          : { ONE: Math.max(0, Number(r.price) ? 10 : 0) };

        // Once colours carry their own sizes, that map is what the storefront
        // sells from - so the card's "in stock" badge must sum it, not the
        // legacy product-wide map. This is also what makes paid orders visibly
        // reduce the count.
        let colorStockTotal: number | null = null;
        for (const c of Array.isArray(r.colors) ? (r.colors as unknown[]) : []) {
          const sizes = c && typeof c === "object"
            ? (c as { sizes?: unknown }).sizes
            : null;
          if (sizes && typeof sizes === "object") {
            colorStockTotal = (colorStockTotal ?? 0) + Object.values(sizes as Record<string, unknown>)
              .reduce((s, n) => s + Math.max(0, Math.floor(Number(n) || 0)), 0);
          }
        }

        return {
          id: r.id,
          name: r.name,
          slug: r.slug,
          mrp: r.mrp,
          catalog_price: r.price,
          price: r.price,
          colors: (r.colors as string[] | null) ?? [],
          stock,
          stock_total: colorStockTotal
            ?? Object.values(stock).reduce((s, n) => s + (Number(n) || 0), 0),
          is_active: r.is_active,
          updated_at: r.updated_at,
          overridden: false,
          source: "runtime" as const,
          deleted: false,
          deleted_at: null,
          category: r.category,
          image_url: r.image_url,
          images: (r.images as string[] | null) ?? (r.image_url ? [r.image_url] : []),
          description: r.description ?? null,
          care: r.care ?? null,
          fit: r.fit ?? null,
          fabric: r.fabric ?? null,
          badge: r.badge ?? null,
          bestseller: r.bestseller ?? false,
          new_arrival: r.new_arrival ?? false,
          created_at: r.created_at,
        };
      });

      // The coded catalog is retired. Only products created in this dashboard are
      // listed here, and only those are deletable: the 12 products in
      // src/data/catalog.ts are code and cannot be removed from a database row.
      const slugCounts = new Map<string, number>();
      for (const p of runtimeProducts) slugCounts.set(p.slug, (slugCounts.get(p.slug) ?? 0) + 1);
      const withFlags = runtimeProducts.map((p) => ({
        ...p,
        duplicate: (slugCounts.get(p.slug) ?? 0) > 1,
      }));

      return json({ products: withFlags });
    }

    if (path === "/product" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const productId = String(body.productId ?? "");
      if (!productId) return json({ error: "productId is required" }, 400);

      // Dashboard-created products store every card field in the products table.
      if (!PRICES[productId]) {
        const { data: row } = await supabase
          .from("products")
          .select("id")
          .eq("id", productId)
          .maybeSingle();
        if (!row) return json({ error: "Unknown product" }, 404);

        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (body.price !== undefined && body.price !== null && body.price !== "") {
          const v = Number(body.price);
          if (!Number.isFinite(v) || v < 0) return json({ error: "Price must be a positive number" }, 400);
          patch.price = Math.round(v);
        }
        if (body.mrp !== undefined && body.mrp !== null && body.mrp !== "") {
          const v = Number(body.mrp);
          if (!Number.isFinite(v) || v < 0) return json({ error: "MRP must be a positive number" }, 400);
          patch.mrp = Math.round(v);
        }
        if (body.stock && typeof body.stock === "object") {
          const clean: Record<string, number> = {};
          for (const [size, n] of Object.entries(body.stock as Record<string, unknown>)) {
            const v = Number(n);
            if (!Number.isFinite(v) || v < 0) return json({ error: `Invalid stock for ${size}` }, 400);
            clean[size] = Math.floor(v);
          }
          patch.stock = clean;
        }
        if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
        // Colours are the picker's { name, hex } pairs — saved exactly as the
        // swatch on the card and the shop's colour filter will render them.
        if (body.colors !== undefined) patch.colors = normalizeColors(body.colors);
        if (Array.isArray(body.images)) {
          const imgs = (body.images as unknown[]).map(String).filter(Boolean).slice(0, 10);
          patch.images = imgs;
          patch.image_url = imgs[0] ?? null;
        }
        for (const key of ["description", "care"] as const) {
          if (body[key] !== undefined) patch[key] = body[key] ? String(body[key]) : null;
        }
        if (body.name !== undefined) {
          const t = String(body.name ?? "").trim();
          if (!t) return json({ error: "Product name is required" }, 400);
          patch.name = t;
        }
        // Free-text card fields: trimmed and length-capped to match the
        // database constraints, so a long paste is trimmed rather than rejected.
        const caps = { fit: 40, fabric: 40, badge: 24 } as const;
        for (const key of ["fit", "fabric", "badge"] as const) {
          if (body[key] === undefined) continue;
          const t = String(body[key] ?? "").trim().slice(0, caps[key]);
          patch[key] = t === "" ? null : t;
        }
        // The collection is a slug, so it is normalised the same way the slug is.
        if (body.category !== undefined) {
          patch.category = slugify(String(body.category ?? "")) || "new-arrivals";
        }
        if (body.bestseller !== undefined) patch.bestseller = body.bestseller === true;
        if (body.new_arrival !== undefined) patch.new_arrival = body.new_arrival === true;

        const { error: upErr } = await supabase.from("products").update(patch).eq("id", productId);
        if (upErr) return json({ error: upErr.message }, 500);

        await audit(session.email, "product.update", "product", productId, {
          fields: Object.keys(patch).filter(k => k !== "updated_at"),
        });
        return json({ ok: true });
      }

      // Catalog products keep their edits in product_overrides.
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

    // ==================== IMAGE UPLOAD ====================
    // Images go up through this function rather than straight from the browser,
    // so the storage bucket never needs a public write policy — an anon key
    // could otherwise upload to it.
    if (path === "/image-upload" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const filename = String(body.filename ?? "").trim();
      const contentType = String(body.contentType ?? "").trim();
      const dataBase64 = String(body.data ?? "");

      const ALLOWED: Record<string, string> = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/avif": "avif",
      };

      const ext = ALLOWED[contentType];
      if (!ext) return json({ error: "Only PNG, JPEG, WebP or AVIF images are allowed" }, 400);
      if (!filename) return json({ error: "filename is required" }, 400);
      if (!dataBase64) return json({ error: "No image data received" }, 400);

      // base64 inflates by ~4/3, so cap the decoded payload at 4MB.
      const approxBytes = (dataBase64.length * 3) / 4;
      if (approxBytes > 4 * 1024 * 1024) {
        return json({ error: "Image is larger than 4MB — please compress it first" }, 413);
      }

      const bytes = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0));

      const stamp = new Date().toISOString().slice(0, 10);
      const safeBase = slugify(filename.replace(/\.[^.]+$/, "")).slice(0, 40) || "image";
      const key = `${stamp}/${crypto.randomUUID()}-${safeBase}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(key, bytes, { contentType, upsert: false });

      if (upErr) return json({ error: upErr.message }, 500);

      // Storefront card slots are much smaller than a display upload, so the
      // client also encodes a compact WebP thumb; it goes into the sibling
      // `product-images-opt` bucket under the SAME path, which is what
      // `productThumb()` maps a card to at render time. A failed thumb write
      // does not fail the upload — the store falls back to the original.
      let thumbPath: string | null = null;
      const thumbBase64 = String(body.thumbData ?? "");
      if (thumbBase64 && thumbBase64.length * 3 / 4 <= 1024 * 1024) {
        const thumbBytes = Uint8Array.from(atob(thumbBase64), (c) => c.charCodeAt(0));
        const { error: thumbErr } = await supabase.storage
          .from("product-images-opt")
          .upload(`${stamp}/${safeBase}.webp`, thumbBytes, { contentType: "image/webp", upsert: true });
        if (!thumbErr) thumbPath = `${stamp}/${safeBase}.webp`;
      }

      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(key);

      await audit(session.email, "image.upload", "storage", key, {
        filename,
        bytes: bytes.length,
        thumb: thumbPath ?? "original-only",
      });

      return json({ ok: true, path: key, url: pub.publicUrl, thumb: thumbPath });
    }

    // ==================== PRODUCT DELETE IMAGE ====================
    if (path === "/image-delete" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const path_ = String(body.path ?? "");
      // Only ever touch our own bucket, and never accept a traversal.
      if (!path_.startsWith("product-images/") || path_.includes("..")) {
        return json({ error: "Invalid image path" }, 400);
      }
      const key = path_.replace(/^product-images\//, "");
      const { error } = await supabase.storage.from("product-images").remove([key]);
      if (error) return json({ error: error.message }, 500);
      await audit(session.email, "image.delete", "storage", key, {});
      return json({ ok: true });
    }

    // ==================== PRODUCT CREATE ====================
    if (path === "/product-create" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const name = String(body.name ?? "").trim();
      if (!name) return json({ error: "Product name is required" }, 400);

      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0) return json({ error: "Price must be zero or more" }, 400);

      const mrpRaw = Number(body.mrp);
      const mrp = Number.isFinite(mrpRaw) && mrpRaw > 0 ? Math.round(mrpRaw) : Math.round(price);

      // Slug must be unique across the database AND must not collide with the
      // static catalog, otherwise the storefront would show two identical cards.
      const baseSlug = slugify(String(body.slug ?? name));
      if (!baseSlug) return json({ error: "Could not derive a URL slug from that name" }, 400);

      let slug = baseSlug;
      for (let n = 2; ; n++) {
        const inCatalog = Object.values(PRICES).some((e) => e.slug === slug);
        if (!inCatalog) {
          const { data: clash } = await supabase
            .from("products")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();
          if (!clash) break;
        }
        if (n > 50) return json({ error: "Could not find a free slug" }, 409);
        slug = `${baseSlug}-${n}`;
      }

      const id = `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

      // Collection, fit, fabric and badge are free text now, so they only need
      // trimming and a length cap. `category` is different: it is a slug the
      // shop pages filter on, so "Graphic Tees" has to become "graphic-tees" or
      // it would never match a URL.
      const category = slugify(String(body.category ?? "new-arrivals")) || "new-arrivals";
      const attr = (v: unknown, max: number): string | null => {
        const t = String(v ?? "").trim().slice(0, max);
        return t === "" ? null : t;
      };
      const fit = attr(body.fit, 40);
      const fabric = attr(body.fabric, 40);
      const badge = attr(body.badge, 24);

      const stock: Record<string, number> = {};
      for (const [size, n] of Object.entries((body.stock ?? {}) as Record<string, unknown>)) {
        const v = Number(n);
        if (Number.isFinite(v) && v >= 0) stock[size] = Math.floor(v);
      }

      // { name, hex } pairs from the colour picker; bare names from older
      // clients are resolved through the known-name map.
      const colors = normalizeColors(body.colors);

      // Uploaded images come back as public URLs; the first one is also kept in
      // image_url so the single-image surfaces keep working.
      const images = Array.isArray(body.images)
        ? (body.images as unknown[]).map((i) => String(i).trim()).filter(Boolean).slice(0, 10)
        : [];
      const explicitUrl = body.image_url ? String(body.image_url).trim() : "";
      const allImages = explicitUrl ? [explicitUrl, ...images] : images;

      const { error } = await supabase.from("products").insert({
        id,
        slug,
        name,
        description: body.description ? String(body.description) : null,
        care: body.care ? String(body.care) : null,
        fit,
        fabric,
        badge,
        bestseller: body.bestseller === true,
        new_arrival: body.new_arrival === true,
        price: Math.round(price),
        mrp,
        category,
        colors,
        stock,
        images: allImages,
        image_url: allImages[0] ?? null,
        is_active: body.is_active !== false,
      });

      if (error) return json({ error: error.message }, 500);

      await audit(session.email, "product.create", "product", id, { name, slug, price: Math.round(price) });
      return json({ ok: true, id, slug });
    }

    /**
 * Storage key from a public image URL.
 *   .../object/public/product-images/2026-10-18/x.png  ->  2026-10-18/x.png
 * Returns null for anything not in our own bucket, so a malformed URL can never
 * make us delete outside `product-images`.
 */
function storageKeyFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/^\/storage\/v1\/object\/public\/product-images\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ==================== PRODUCT DELETE ====================
    // Permanent removal. Only dashboard-created products can be deleted: the
    // catalog products are code in src/data/catalog.ts, so deleting the row
    // would silently do nothing and leave the card selling. Refusing is honest;
    // pretending to soft-delete and offering "restore" is not what was asked for.
    if (path === "/product-delete" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const productId = String(body.productId ?? "").trim();
      if (!productId) return json({ error: "productId is required" }, 400);

      if (PRICES[productId]) {
        return json({
          error: "This is a catalog product and cannot be deleted. Only products added from this dashboard can be removed.",
          catalog: true,
        }, 409);
      }

      const { data: row } = await supabase
        .from("products")
        .select("id, name, slug, images")
        .eq("id", productId)
        .maybeSingle();

      if (!row) return json({ error: "Product not found — it may already have been deleted" }, 404);

      // Orders snapshot name, colour, size and price into `items`, so removing a
      // product never damages order history or past invoices.
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) return json({ error: error.message }, 500);

      // Tidy up its uploads. Storage refuses direct SQL deletes, so best-effort.
      const images = Array.isArray(row.images) ? (row.images as unknown[]).map(String) : [];
      const keys = Array.from(new Set(images.map(storageKeyFromUrl).filter((k): k is string => !!k)));
      if (keys.length) {
        await supabase.storage.from("product-images").remove(keys).catch(() => undefined);
      }

      await audit(session.email, "product.delete", "product", productId, {
        name: row.name,
        slug: row.slug,
        images_removed: keys.length,
      });

      return json({ ok: true, mode: "deleted", id: productId, slug: row.slug });
    }

    // ==================== PRODUCT RESTORE ====================
    if (path === "/product-restore" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const productId = String(body.productId ?? "");
      if (!productId) return json({ error: "productId is required" }, 400);

      if (PRICES[productId]) {
        const { error } = await supabase.from("product_overrides").upsert({
          product_id: productId,
          deleted_at: null,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "product_id" });
        if (error) return json({ error: error.message }, 500);
      } else {
        const { data: row } = await supabase
          .from("products")
          .select("id")
          .eq("id", productId)
          .maybeSingle();

        // Previously this branch updated zero rows and still reported success.
        if (!row) return json({ error: "Unknown product" }, 404);

        const { error } = await supabase
          .from("products")
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq("id", productId);
        if (error) return json({ error: error.message }, 500);
      }

      await audit(session.email, "product.restore", "product", productId, {});
      return json({ ok: true });
    }

    // ==================== CUSTOMER DETAIL ====================
    if (path === "/customer" && req.method === "GET") {
      const mobile = (url.searchParams.get("mobile") ?? "").replace(/\D/g, "").slice(-10);
      if (!mobile) return json({ error: "mobile is required" }, 400);

      // `profiles` has no last_login_at column — selecting it made PostgREST reject
      // the whole query, so the drawer silently fell back to "Customer".
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, mobile, gender, avatar_url, google_id, is_muted, muted_reason, muted_at, deleted_at, created_at")
        .eq("mobile", mobile)
        .maybeSingle();

      const { data: orders } = await supabase
        .from("orders")
        .select("order_number, status, payment_status, total, created_at, shipping_address")
        .eq("customer_mobile", mobile)
        .order("created_at", { ascending: false })
        .limit(25);

      const { data: addresses } = await supabase
        .from("addresses")
        .select("*")
        .eq("mobile", mobile)
        .order("created_at", { ascending: false });

      const { data: feedback } = await supabase
        .from("feedback")
        .select("id, rating, category, message, status, created_at")
        .eq("mobile", mobile)
        .order("created_at", { ascending: false })
        .limit(10);

      const rows = orders ?? [];
      const paid = rows.filter((o) => o.payment_status === "paid");

      return json({
        customer: {
          mobile,
          full_name: profile?.full_name ?? rows[0]?.shipping_address?.fullName ?? "Customer",
          email: profile?.email ?? rows[0]?.customer_email ?? null,
          gender: profile?.gender ?? null,
          avatar_url: profile?.avatar_url ?? null,
          google_id: profile?.google_id ?? null,
          is_muted: profile?.is_muted ?? false,
          muted_reason: profile?.muted_reason ?? null,
          muted_at: profile?.muted_at ?? null,
          deleted_at: profile?.deleted_at ?? null,
          joined_at: profile?.created_at ?? rows[rows.length - 1]?.created_at ?? null,
          last_login_at: null,
          has_account: Boolean(profile),
          orders: rows,
          addresses: addresses ?? [],
          feedback: feedback ?? [],
          stats: {
            order_count: rows.length,
            paid_count: paid.length,
            total_spent: paid.reduce((s, o) => s + (Number(o.total) || 0), 0),
            last_order: rows[0]?.created_at ?? null,
          },
        },
      });
    }

    // ==================== CUSTOMER MUTE ====================
    if (path === "/customer-mute" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const mobile = String(body.mobile ?? "").replace(/\D/g, "").slice(-10);
      if (!/^[6-9]\d{9}$/.test(mobile)) return json({ error: "Enter a valid 10-digit mobile number" }, 400);

      const muted = body.muted !== false;
      const reason = muted ? String(body.reason ?? "").trim().slice(0, 200) : null;

      const { data, error } = await supabase
        .from("profiles")
        .update({
          is_muted: muted,
          muted_reason: muted ? (reason || "No reason given") : null,
          muted_at: muted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("mobile", mobile)
        .select("id, mobile, is_muted")
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "That customer has no account to mute. They can still place guest orders." }, 404);

      await audit(session.email, muted ? "customer.mute" : "customer.unmute", "profile", data.id, { mobile, reason });
      return json({ ok: true, is_muted: data.is_muted });
    }

    // ==================== GUEST PROFILE DELETE (INDIVIDUAL) ====================
    // A guest has no profiles row — they exist only as orders. Deleting one
    // guest therefore means deleting that mobile's guest orders (and their
    // events); registered profiles are handled by /customer-delete and never
    // reach this branch. No automatic cleanup runs here.
    if (path === "/customer-guest-delete" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const mobile = String(body.mobile ?? "").replace(/\D/g, "").slice(-10);
      if (!/^[6-9]\d{9}$/.test(mobile)) return json({ error: "Enter a valid 10-digit mobile number" }, 400);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("mobile", mobile)
        .maybeSingle();
      if (profile) {
        return json(
          { error: "This mobile has a registered account. Delete the account instead so its orders are preserved." },
          409,
        );
      }

      try {
        const { data: guestOrders } = await supabase
          .from("orders")
          .select("id")
          .eq("customer_mobile", mobile)
          .is("user_id", null);
        const ids = (guestOrders ?? []).map((o) => o.id).filter(Boolean);
        if (!ids.length) return json({ error: "No guest orders found for that mobile" }, 404);

        await supabase.from("order_events").delete().in("order_id", ids);
        const { error } = await supabase.from("orders").delete().in("id", ids);
        if (error) return json({ error: error.message }, 500);

        await audit(session.email, "customer.delete_guest", "orders", null, {
          mobile,
          count: ids.length,
        });
        return json({ ok: true, deleted: ids.length });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "Failed to delete guest" }, 500);
      }
    }

    // ==================== CUSTOMER DELETE ====================
    // Soft delete: the profile is kept so order history and revenue still
    // resolve, the Auth user is signed out of future logins, and any sign-in is
    // refused. Orders are never touched.
    if (path === "/customer-delete" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const mobile = String(body.mobile ?? "").replace(/\D/g, "").slice(-10);
      if (!/^[6-9]\d{9}$/.test(mobile)) return json({ error: "Enter a valid 10-digit mobile number" }, 400);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, mobile")
        .eq("mobile", mobile)
        .maybeSingle();

      if (!profile) return json({ error: "No customer account with that mobile number" }, 404);
      if (profile.id === admin.id) return json({ error: "You cannot delete your own operator account" }, 400);

      const { count: orderCount } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_mobile", mobile);

      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("profiles")
        .update({
          deleted_at: nowIso,
          is_muted: true,
          muted_reason: "Account deleted by operator",
          muted_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", profile.id);

      if (error) return json({ error: error.message }, 500);

      // Sign the Auth user out everywhere by banning them.
      await supabase.auth.admin.updateUserById(profile.id, { ban_duration: "876000h" });

      await audit(session.email, "customer.delete", "profile", profile.id, {
        mobile,
        full_name: profile.full_name,
        orders_preserved: orderCount ?? 0,
      });

      return json({ ok: true, orders_preserved: orderCount ?? 0 });
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

    if (path === "/feedback-clear" && req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        const status = String(body.status ?? "").trim();
        let q = supabase.from("feedback").delete();
        if (status && ["new", "read", "resolved"].includes(status)) q = q.eq("status", status);
        const { error } = await q;
        if (error) return json({ error: error.message }, 500);
        await audit(session.email, "feedback.clear", "feedback", null, { status: status || "all" });
        return json({ ok: true, deleted: 0 });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "Failed to clear feedback" }, 500);
      }
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

    // ==================== STORE SETTINGS ====================
    // Shipping fee and free-shipping threshold used to be literals in the
    // frontend bundle. The operator sets them here and the storefront reads
    // them, so the cart, checkout, banner and policy page cannot disagree.
    if (path === "/settings" && req.method === "GET") {
      const { data, error: settingsErr } = await supabase
        .from("store_settings")
        .select("shipping_fee, free_shipping_threshold, announcement, content, updated_at, updated_by")
        .maybeSingle();

      if (settingsErr) return json({ error: settingsErr.message }, 500);

      // A database with no seeded row still answers with the defaults the
      // storefront falls back to, rather than an empty form.
      return json({
        settings: {
          shipping_fee: data?.shipping_fee ?? 79,
          free_shipping_threshold: data?.free_shipping_threshold ?? 1499,
          announcement: data?.announcement ?? "",
          // null until the operator saves from Admin → Content; the storefront
          // then renders the compiled-in defaults, which are the same copy.
          content: data?.content ?? null,
          updated_at: data?.updated_at ?? null,
          updated_by: data?.updated_by ?? null,
        },
      });
    }

    if (path === "/settings" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const patch: Record<string, unknown> = {};
      const auditDetail: Record<string, unknown> = {};

      // Shipping/announcement block — validated only when sent, so the Content
      // tab can save without re-submitting figures it does not own.
      if ("shipping_fee" in body || "free_shipping_threshold" in body || "announcement" in body) {
        const fee = Number(body.shipping_fee);
        const threshold = Number(body.free_shipping_threshold);

        if (!Number.isFinite(fee) || fee < 0 || !Number.isInteger(fee)) {
          return json({ error: "Shipping fee must be a whole number of rupees, zero or more" }, 400);
        }
        if (!Number.isFinite(threshold) || threshold < 0 || !Number.isInteger(threshold)) {
          return json({ error: "Free-shipping threshold must be a whole number of rupees, zero or more" }, 400);
        }

        // Blank is allowed and means "derive it": the storefront then builds the
        // free-shipping line from the threshold, so the two cannot drift apart.
        const announcement =
          body.announcement == null || String(body.announcement).trim() === ""
            ? null
            : String(body.announcement).trim().slice(0, 200);

        patch.shipping_fee = fee;
        patch.free_shipping_threshold = threshold;
        patch.announcement = announcement;
        auditDetail.shipping_fee = fee;
        auditDetail.free_shipping_threshold = threshold;
        auditDetail.announcement = announcement;
      }

      // Storefront copy — validated as a bounded JSON object.
      if ("content" in body) {
        const clean = sanitizeContent(body.content);
        if (!clean) return json({ error: "Content must be a JSON object" }, 400);
        if (JSON.stringify(clean).length > CONTENT_MAX_BYTES) {
          return json({ error: "Content document is too large — trim images/copy or split it" }, 413);
        }
        patch.content = clean;
        auditDetail.content_keys = Object.keys(clean).length;
      }

      if (Object.keys(patch).length === 0) return json({ error: "Nothing to save" }, 400);
      patch.updated_by = session.email;

      // Upsert against the single-row key so a fresh database works too.
      const { error: saveErr } = await supabase
        .from("store_settings")
        .upsert({ id: true, ...patch }, { onConflict: "id" });

      if (saveErr) return json({ error: saveErr.message }, 500);

      await audit(session.email, "settings_update", "store_settings", "singleton", auditDetail);

      // Read back the whole row so the caller receives the stored document
      // exactly as the database has it (post-sanitisation).
      const { data: saved } = await supabase
        .from("store_settings")
        .select("shipping_fee, free_shipping_threshold, announcement, content, updated_at, updated_by")
        .maybeSingle();

      return json({
        ok: true,
        settings: {
          shipping_fee: saved?.shipping_fee ?? patch.shipping_fee ?? 79,
          free_shipping_threshold: saved?.free_shipping_threshold ?? patch.free_shipping_threshold ?? 1499,
          announcement: (saved?.announcement ?? patch.announcement ?? null) as string | null,
          content: saved?.content ?? patch.content ?? null,
          updated_at: saved?.updated_at ?? new Date().toISOString(),
          updated_by: saved?.updated_by ?? session.email,
        },
      });
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error("trios-admin error", error);
    return json({ error: "Server error" }, 500);
  }
});

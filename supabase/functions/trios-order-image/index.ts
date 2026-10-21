/**
 * trios-order-image — stores the rendered order picture and hands back a
 * public link.
 *
 * The order is drawn on the customer's device (src/lib/orderImage.ts) so the
 * details are fixed before they leave. This function only puts the PNG in
 * public storage so that WhatsApp can show it.
 *
 * Mobile shares the file straight from the browser (no upload needed). This
 * function is what makes the same flow work on a desktop, where the image is
 * sent to WhatsApp as a link that renders inline.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { routePath } from "../_shared/http.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Cleanup-Secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BUCKET = "product-images";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const url = new URL(req.url);
  const path = routePath(url.pathname, "trios-order-image");

  try {
    if (path === "/upload" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const data = String(body.data ?? "");
      const reference = String(body.reference ?? "order")
        .replace(/[^a-zA-Z0-9-_]/g, "")
        .slice(0, 24);

      if (!data) return json({ error: "image data is required" }, 400);

      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      } catch {
        return json({ error: "image data is not valid base64" }, 400);
      }
      if (bytes.length === 0 || bytes.length > 4_000_000) {
        return json({ error: "image is empty or too large" }, 400);
      }

      // The path is the order reference, so the QR code inside the picture can
      // point at this exact URL before the picture is uploaded.
      const filePath = `orders/${reference}.png`;

      const { error } = await supabase.storage.from(BUCKET).upload(filePath, bytes, {
        contentType: "image/png",
        upsert: true,
      });
      if (error) return json({ error: error.message }, 500);

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      return json({ ok: true, url: pub.publicUrl });
    }

    /**
     * Housekeeping: the picture of a WhatsApp order is only kept for 48
     * hours. A scheduled job calls this once an hour; anything older than the
     * window is deleted, so the bucket never fills up with order pictures.
     */
    if (path === "/cleanup" && req.method === "POST") {
      const expected = Deno.env.get("ORDER_CLEANUP_SECRET") ?? "";
      const given = req.headers.get("x-cleanup-secret") ?? "";
      if (!expected || given !== expected) return json({ error: "Not allowed" }, 401);

      const hours = Number(Deno.env.get("ORDER_IMAGE_TTL_HOURS") ?? "48");
      const cutoff = Date.now() - hours * 60 * 60 * 1000;

      const { data: files, error: listError } = await supabase.storage
        .from(BUCKET)
        .list("orders", { limit: 1000 });
      if (listError) return json({ error: listError.message }, 500);

      const expired = (files ?? []).filter((f) => {
        const created = Date.parse(f.created_at ?? f.updated_at ?? "");
        return Number.isFinite(created) && created < cutoff;
      });

      let removed = 0;
      for (const file of expired) {
        const { error } = await supabase.storage.from(BUCKET).remove([`orders/${file.name}`]);
        if (!error) removed += 1;
      }

      return json({ ok: true, checked: (files ?? []).length, removed, ttl_hours: hours });
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

/**
 * trios-notify — sends an order straight into the store's WhatsApp inbox.
 *
 * The customer never leaves the site: the checkout posts the finished order
 * here and this function delivers it to the store's own WhatsApp number.
 *
 * Transports, tried in this order (the first one that is configured wins):
 *
 *  1. WhatsApp Cloud API (Meta) — WHATSAPP_PHONE_NUMBER_ID and
 *     WHATSAPP_ACCESS_TOKEN. If WHATSAPP_TEMPLATE_NAME is set the message is
 *     sent as an approved template (the only reliable way for a business to
 *     message a number that has not written to it first); otherwise it is sent
 *     as a plain text message, which Meta only allows inside a 24-hour
 *     customer-service window.
 *
 *  2. Green API — WHATSAPP_GREEN_API_ID_TOKEN. The store links its own
 *     WhatsApp once by scanning a QR, and every order is then delivered from
 *     that number with no template and no extra signup.
 *
 *  3. A plain API-key provider — WHATSAPP_API_BASE_URL and WHATSAPP_API_KEY.
 *     The body is { api_key, to, text }.
 *
 *  4. A relay webhook (WHATSAPP_RELAY_URL) — the payload is POSTed as JSON to
 *     any automation tool (Make, Zapier, n8n…) that is already connected to
 *     WhatsApp. A 2xx answer means the order went out.
 *
 * Nothing here is stored in the database: the order is a message, and the
 * message is the record.
 */
import { routePath } from "../_shared/http.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v21.0";

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/** WhatsApp needs a country code. "6383883727" is read as +91 63838 83727. */
function withCountryCode(value: string): string {
  const d = digits(value);
  if (d.length >= 11 && d.length <= 15) return d;
  return `91${d}`;
}

/** Send through the Meta WhatsApp Cloud API. */
async function sendViaCloudApi(message: string, params: string[]): Promise<
  { ok: true; mode: "template" | "text"; id: string } | { ok: false; detail: string }
> {
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
  const templateName = Deno.env.get("WHATSAPP_TEMPLATE_NAME") ?? "";
  const language = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") ?? "en_US";
  const to = withCountryCode(
    Deno.env.get("WHATSAPP_ORDER_TO_NUMBER") ?? "919345125667",
  );

  if (!phoneNumberId || !accessToken) {
    return { ok: false, detail: "whatsapp_api_not_configured" };
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
  };

  if (templateName) {
    // Meta rejects a template whose parameter count does not match the approved
    // one, so the expected count can be pinned with WHATSAPP_TEMPLATE_PARAM_COUNT.
    const expected = Number(Deno.env.get("WHATSAPP_TEMPLATE_PARAM_COUNT") ?? "") || 0;
    let body = params.length ? params : [message];
    if (expected > 0) {
      body = Array.from({ length: expected }, (_, i) => body[i] ?? "");
    }
    payload.type = "template";
    payload.template = {
      name: templateName,
      language: { code: language },
      components: [
        {
          type: "body",
          parameters: body.map((p) => ({ type: "text", text: String(p) })),
        },
      ],
    };
  } else {
    payload.type = "text";
    payload.text = { preview_url: false, body: message };
  }

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // keep the raw body
    }
    return { ok: false, detail };
  }

  let id = "";
  let mode: "template" | "text" = templateName ? "template" : "text";
  try {
    const parsed = JSON.parse(text) as { messages?: { id?: string }[] };
    id = parsed.messages?.[0]?.id ?? "";
  } catch {
    // id is optional
  }
  return { ok: true, mode, id };
}

/** Send through Green API — the store's own WhatsApp, linked by a QR scan. */
async function sendViaGreenApi(message: string): Promise<
  { ok: true; mode: "greenapi"; id: string } | { ok: false; detail: string }
> {
  const idToken = Deno.env.get("WHATSAPP_GREEN_API_ID_TOKEN") ?? "";
  if (!idToken) return { ok: false, detail: "greenapi_not_configured" };

  const to = withCountryCode(
    Deno.env.get("WHATSAPP_ORDER_TO_NUMBER") ?? "919345125667",
  );

  const res = await fetch(
    `https://api.green-api.com/whatsapp/SendMessage/${idToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: `${to}@c.us`, message, notify: false }),
    },
  );

  const text = await res.text();
  if (!res.ok) return { ok: false, detail: text.slice(0, 300) };

  let id = "";
  try {
    const parsed = JSON.parse(text) as { idMessage?: string };
    id = parsed.idMessage ?? "";
  } catch {
    // id is optional
  }
  return { ok: true, mode: "greenapi", id };
}

/** Send through a plain API-key provider ({ api_key, to, text }). */
async function sendViaApiKeyProvider(message: string): Promise<
  { ok: true; mode: "api"; id: string } | { ok: false; detail: string }
> {
  const baseUrl = (Deno.env.get("WHATSAPP_API_BASE_URL") ?? "").replace(/\/$/, "");
  const apiKey = Deno.env.get("WHATSAPP_API_KEY") ?? "";
  if (!baseUrl || !apiKey) return { ok: false, detail: "api_not_configured" };

  const to = withCountryCode(
    Deno.env.get("WHATSAPP_ORDER_TO_NUMBER") ?? "919345125667",
  );

  const res = await fetch(`${baseUrl}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, to, text: message, message }),
  });

  const text = await res.text();
  if (!res.ok) return { ok: false, detail: text.slice(0, 300) };

  let id = "";
  try {
    const parsed = JSON.parse(text) as { id?: string; message_id?: string };
    id = parsed.id ?? parsed.message_id ?? "";
  } catch {
    // id is optional
  }
  return { ok: true, mode: "api", id };
}

/** Hand the order to a relay (Make/Zapier/n8n…) that owns the WhatsApp app. */
async function sendViaRelay(message: string, reference: string): Promise<
  { ok: true; mode: "relay"; id: string } | { ok: false; detail: string }
> {
  const url = Deno.env.get("WHATSAPP_RELAY_URL") ?? "";
  if (!url) return { ok: false, detail: "relay_not_configured" };

  const secret = Deno.env.get("WHATSAPP_RELAY_SECRET") ?? "";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({
      to: withCountryCode(Deno.env.get("WHATSAPP_ORDER_TO_NUMBER") ?? "919345125667"),
      message,
      reference,
      source: "triosworld-checkout",
    }),
  });

  if (!res.ok) return { ok: false, detail: `relay_${res.status}` };
  return { ok: true, mode: "relay", id: reference };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const url = new URL(req.url);
  const path = routePath(url.pathname, "trios-notify");

  try {
    if (path === "/" && req.method === "GET") {
      return json({
        ok: true,
        cloud_api: Boolean(
          Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") && Deno.env.get("WHATSAPP_ACCESS_TOKEN"),
        ),
        template: Deno.env.get("WHATSAPP_TEMPLATE_NAME") ?? null,
        green_api: Boolean(Deno.env.get("WHATSAPP_GREEN_API_ID_TOKEN")),
        api_key_provider: Boolean(
          Deno.env.get("WHATSAPP_API_BASE_URL") && Deno.env.get("WHATSAPP_API_KEY"),
        ),
        relay: Boolean(Deno.env.get("WHATSAPP_RELAY_URL")),
        to: withCountryCode(Deno.env.get("WHATSAPP_ORDER_TO_NUMBER") ?? "919345125667"),
      });
    }

    if (path === "/send" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const message = String(body.message ?? "").trim();
      if (!message) return json({ error: "message is required" }, 400);
      if (message.length > 4000) return json({ error: "message is too long" }, 400);

      const params = Array.isArray(body.params) ? body.params.map((p: unknown) => String(p)) : [];
      const reference = String(body.reference ?? `TW-${Date.now().toString().slice(-6)}`);

      const cloud = await sendViaCloudApi(message, params);
      if (cloud.ok) {
        return json({ ok: true, mode: cloud.mode, id: cloud.id, reference });
      }

      const green = await sendViaGreenApi(message);
      if (green.ok) {
        return json({ ok: true, mode: green.mode, id: green.id, reference });
      }

      const apiKeyProvider = await sendViaApiKeyProvider(message);
      if (apiKeyProvider.ok) {
        return json({ ok: true, mode: apiKeyProvider.mode, id: apiKeyProvider.id, reference });
      }

      const relay = await sendViaRelay(message, reference);
      if (relay.ok) {
        return json({ ok: true, mode: relay.mode, id: relay.id, reference });
      }

      // Nothing could deliver it — the caller tells the customer to try again.
      return json(
        { ok: false, error: "whatsapp_not_configured", detail: cloud.detail },
        503,
      );
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

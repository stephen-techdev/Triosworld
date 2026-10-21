/**
 * Client for the `trios-notify` edge function.
 *
 * A WhatsApp order is a *message*, not a database row: the checkout posts the
 * finished order to the server, the server delivers it to the store's own
 * WhatsApp inbox, and the customer stays on the site the whole time.
 *
 * If the server has no way to deliver (no WhatsApp Cloud API credentials and
 * no relay configured) the call comes back as `not_configured` and the
 * checkout falls back to a wa.me link the customer can send themselves.
 */

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export type WhatsAppSendResult =
  | { ok: true; mode: 'template' | 'text' | 'relay'; reference: string }
  | { ok: false; reason: 'not_configured' | 'failed'; detail?: string };

export async function sendWhatsappOrder(
  message: string,
  params: string[] = [],
): Promise<WhatsAppSendResult> {
  try {
    const res = await fetch(`${FUNCTIONS_URL}/trios-notify/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        params,
        reference: `TW-${Date.now().toString().slice(-6)}`,
      }),
    });

    if (res.status === 503) {
      return { ok: false, reason: 'not_configured' };
    }
    if (!res.ok) {
      return { ok: false, reason: 'failed' };
    }

    const data = (await res.json()) as {
      ok?: boolean;
      mode?: 'template' | 'text' | 'relay';
      reference?: string;
    };
    if (!data.ok) return { ok: false, reason: 'failed' };

    return {
      ok: true,
      mode: data.mode ?? 'text',
      reference: data.reference ?? '',
    };
  } catch {
    // Offline, DNS failure, CORS — the customer can still send it themselves.
    return { ok: false, reason: 'failed' };
  }
}

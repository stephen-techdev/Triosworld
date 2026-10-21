/**
 * Uploads the rendered order picture so WhatsApp can show it.
 *
 * On a phone the picture is handed to WhatsApp straight from the browser
 * (Web Share API) and never touches the server. On a desktop WhatsApp only
 * accepts links, so the picture is stored in public storage and the link is
 * sent instead — WhatsApp renders it inline as the picture of the order.
 */
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export async function uploadOrderImage(blob: Blob, reference: string): Promise<string | null> {
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? '');
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : '');
      };
      reader.onerror = () => reject(new Error('Could not read the order image'));
      reader.readAsDataURL(blob);
    });

    if (!base64) return null;

    const res = await fetch(`${FUNCTIONS_URL}/trios-order-image/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: base64, reference }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { ok?: boolean; url?: string };
    return data.ok && data.url ? data.url : null;
  } catch {
    return null;
  }
}

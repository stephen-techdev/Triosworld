/**
 * Browser-side image preparation for product photos.
 *
 * Operators upload photos straight off a phone — 4–12 MP, often 3–8 MB each.
 * Sending those originals means the upload is slow AND every shopper downloads
 * megabytes to see one card, which is what made the storefront feel heavy.
 *
 * So the file is decoded, drawn to a canvas with its longest edge capped, and
 * re-encoded before it ever leaves the browser. A 5 MB phone photo becomes
 * roughly 150–350 KB and still looks sharp at the sizes the storefront renders
 * (cards are ~600px wide, the product page ~1200px).
 *
 * Failure is never fatal: if the browser cannot decode or re-encode the file,
 * the original bytes are returned unchanged and the upload proceeds as before.
 */

/** Longest edge the stored image keeps. Comfortably above the PDP hero size. */
export const MAX_IMAGE_EDGE = 1600;

/** Anything already smaller than this is passed through untouched. */
const SKIP_UNDER_BYTES = 220 * 1024;

export interface PreparedImage {
  /** Base64 payload — no data-URL prefix, which is what the function expects. */
  data: string;
  /** Content type to declare; follows whatever we actually encoded. */
  contentType: string;
  /** Sensible filename for the storage key. */
  filename: string;
  /** Original size in bytes, for the "saved X%" line in the dashboard. */
  originalBytes: number;
  /** Size in bytes after preparation. */
  bytes: number;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });
}

function readAsBytes(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });
}

function bytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64FromDataUrl(dataUrl: string): string {
  return dataUrl.split(',')[1] ?? '';
}

function stripExtension(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, '') || 'product';
}

/** Re-encode through a canvas; resolves to null when the browser cannot. */
async function reencode(
  file: File,
  maxEdge: number,
  preferred: 'image/webp' | 'image/jpeg' | 'image/png',
): Promise<{ dataUrl: string; contentType: string } | null> {
  try {
    const dataUrl = await readAsDataUrl(file);
    const bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode failed'));
      img.src = dataUrl;
    });

    const longest = Math.max(bitmap.naturalWidth, bitmap.naturalHeight);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const width = Math.max(1, Math.round(bitmap.naturalWidth * scale));
    const height = Math.max(1, Math.round(bitmap.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Photographs of garments are mostly flat colour; a white base stops any
    // transparent PNG from turning black under JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Prefer WebP (smallest at this quality); fall back to JPEG when the
    // browser writes WebP under a different type name.
    let outType = preferred;
    let encoded = canvas.toDataURL(outType, 0.82);
    if (!encoded.startsWith(`data:${outType}`)) {
      outType = 'image/jpeg';
      encoded = canvas.toDataURL(outType, 0.86);
    }
    return { dataUrl: encoded, contentType: outType };
  } catch {
    return null;
  }
}

/**
 * Prepare one picked file for upload: resize + compress where possible, and
 * fall back to the untouched original when anything goes wrong.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const originalBytes = file.size;
  const base = stripExtension(file.name);

  // SVG/AFIV/unknown types are not safely re-encodable — send them as they are.
  const reencodable = /^image\/(jpeg|jpg|png|webp)$/i.test(file.type);
  if (reencodable && originalBytes > SKIP_UNDER_BYTES) {
    const preferred = file.type === 'image/png' ? 'image/webp' : 'image/webp';
    const done = await reencode(file, MAX_IMAGE_EDGE, preferred);
    if (done) {
      const data = base64FromDataUrl(done.dataUrl);
      const ext = done.contentType === 'image/jpeg' ? 'jpg' : done.contentType.split('/')[1];
      // Only keep the re-encode when it is genuinely smaller.
      if (data.length * 0.75 < originalBytes) {
        return {
          data,
          contentType: done.contentType,
          filename: `${base}.${ext}`,
          originalBytes,
          bytes: Math.round(data.length * 0.75),
        };
      }
    }
  }

  const buffer = await readAsBytes(file);
  return {
    data: bytesToBase64(buffer),
    contentType: file.type || 'image/jpeg',
    filename: file.name,
    originalBytes,
    bytes: originalBytes,
  };
}

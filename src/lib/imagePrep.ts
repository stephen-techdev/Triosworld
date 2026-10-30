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
 * Two rules shape the implementation:
 *
 *   1. ANY file is accepted. The dashboard used to refuse anything outside
 *      jpeg/png/webp, so a HEIC straight off an iPhone — or a file with no
 *      MIME type at all — died with "file can't be read". Now the type is
 *      never checked up front: whatever the browser can decode gets resized,
 *      and whatever it cannot is sent through untouched. The picker is the
 *      filter, not this function.
 *
 *   2. Failure is never fatal. If decoding or re-encoding throws for any
 *      reason, the original bytes go up unchanged. A slow upload beats a
 *      rejected photo.
 */

/** Longest edge the stored image keeps. Comfortably above the PDP hero size. */
export const MAX_IMAGE_EDGE = 1600;

/** Anything already smaller than this is passed through untouched. */
const SKIP_UNDER_BYTES = 220 * 1024;

/** Quality for the WebP re-encode. 0.82 is invisible on garment photography. */
const QUALITY = 0.82;

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
  /**
   * Optional compact variant (700px WebP) for storefront card slots. Uploaded
   * alongside the display image into `product-images-opt` under the same
   * path; null when the browser could not produce one.
   */
  thumbData: string | null;
}

function readAsBytes(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Could not read that file'));
    // readAsArrayBuffer, not readAsDataURL: the caller wants raw bytes, and
    // routing a 8 MB photo through a base64 string first is what used to make
    // the fallback path crawl and then throw.
    reader.readAsArrayBuffer(file);
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

/**
 * Decode a picked file to a bitmap.
 *
 * createImageBitmap reads the file straight off disk with no base64 detour,
 * so a 12 MP photo is ready in a fraction of the time the old data-URL route
 * took — this is the whole reason the compressor feels instant now. The
 * HTMLImageElement path stays for browsers that cannot hand a File to
 * createImageBitmap (older Safari), and covers types Safari decodes but
 * createImageBitmap refuses.
 */
async function decode(file: File): Promise<{ bitmap: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      /* fall through to the element path — the file may still be decodable */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode failed'));
      el.src = url;
    });
    return {
      bitmap: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/** Re-encode through a canvas; resolves to null when the browser cannot. */
async function reencode(
  file: File,
  maxEdge: number,
  quality: number = QUALITY,
): Promise<{ dataUrl: string; contentType: string } | null> {
  let decoded: Awaited<ReturnType<typeof decode>> | null = null;
  try {
    decoded = await decode(file);
    const { bitmap, width: naturalW, height: naturalH } = decoded;

    // A zero-sized decode means the browser recognised the container but not
    // the picture inside (a HEIC on Chrome, say). Send the original through.
    if (!naturalW || !naturalH) return null;

    const longest = Math.max(naturalW, naturalH);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const width = Math.max(1, Math.round(naturalW * scale));
    const height = Math.max(1, Math.round(naturalH * scale));

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
    let outType = 'image/webp';
    let encoded = canvas.toDataURL(outType, quality);
    if (!encoded.startsWith(`data:${outType}`)) {
      outType = 'image/jpeg';
      encoded = canvas.toDataURL(outType, Math.min(0.9, quality + 0.1));
    }
    return { dataUrl: encoded, contentType: outType };
  } catch {
    return null;
  } finally {
    // Release the decoded pixels before the upload starts; a phone photo held
    // at full size is the difference between a smooth flow and a tab reload.
    decoded?.release();
  }
}

/**
 * Prepare one picked file for upload: resize + compress where possible, and
 * fall back to the untouched original when anything goes wrong.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const originalBytes = file.size;
  const base = stripExtension(file.name);

  // Tiny files are not worth a decode round trip, and neither are empty ones.
  if (originalBytes > SKIP_UNDER_BYTES) {
    const done = await reencode(file, MAX_IMAGE_EDGE);
    if (done) {
      const data = base64FromDataUrl(done.dataUrl);
      const ext = done.contentType === 'image/jpeg' ? 'jpg' : done.contentType.split('/')[1];
      // Only keep the re-encode when it is genuinely smaller.
      if (data.length * 0.75 < originalBytes) {
        const thumb = await thumbEncode(file);
        return {
          data,
          contentType: done.contentType,
          filename: `${base}.${ext}`,
          originalBytes,
          bytes: Math.round(data.length * 0.75),
          thumbData: thumb,
        };
      }
    }
  }

  // Whatever could not be resized — an SVG, a RAW, a file the browser will not
  // decode — still goes up, byte for byte.
  const buffer = await readAsBytes(file);
  return {
    data: bytesToBase64(buffer),
    contentType: file.type || 'image/jpeg',
    filename: file.name || `${base}.jpg`,
    originalBytes,
    bytes: originalBytes,
    thumbData: null,
  };
}

/**
 * Card-size companion for a display upload: 700px WebP, drawn from the same
 * source photo. Pass-through when the browser cannot produce it — the store
 * falls back to the display image in that case.
 */
async function thumbEncode(file: File): Promise<string | null> {
  const thumb = await reencode(file, 700, 0.72);
  if (!thumb || !thumb.dataUrl) return null;
  return base64FromDataUrl(thumb.dataUrl);
}

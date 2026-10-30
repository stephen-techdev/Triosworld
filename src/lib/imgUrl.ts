/**
 * Device-appropriate image URLs.
 *
 * The homepage pulls its campaign shots from Pexels, where every URL can ask
 * for the exact width a slot needs (`?w=`). The dashboard defaults upload
 * 2400px-wide crops for hero use — right for a showcase, far too heavy for the
 * two-up category tiles — so each call site renders a right-sized variant and
 * the CDN can serve a few tens of kilobytes instead of two hundred.
 *
 * Anything that is not a Pexels URL (dashboard uploads on Supabase storage)
 * is returned untouched: the files are already final uploads.
 */
export function sizedImage(url: string | undefined, width: number): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname !== 'images.pexels.com') return url;

    const w = Number(u.searchParams.get('w')) || 0;
    const h = Number(u.searchParams.get('h')) || 0;
    // Keep a crop's aspect when both sides were fixed by the operator.
    const targetH = w > 0 && h > 0 ? Math.max(1, Math.round(h * (width / w))) : null;
    if (targetH) u.searchParams.set('h', String(targetH));
    u.searchParams.set('w', String(Math.round(width)));
    u.searchParams.set('auto', 'compress');
    u.searchParams.set('cs', 'tinysrgb');
    return u.toString();
  } catch {
    return url;
  }
}

/** A srcset of the same image at the widths an art-directed slot can use. */
export function imageSrcSet(url: string | undefined, widths: number[]): string | undefined {
  if (!url) return url;
  const entries = widths
    .map(w => [sizedImage(url, w), w] as const)
    .filter(([src]) => Boolean(src))
    .map(([src, w]) => `${src} ${w}w`);
  return entries.length ? entries.join(', ') : undefined;
}

/**
 * A storefront card thumbnail.
 *
 * The dashboard stores display uploads at 896-1500px. Cards, cart lines and
 * PDP thumbnails render slots far smaller than that, so every product photo
 * also exists as a 700px q70 WebP in the sibling `product-images-opt` bucket
 * under the same path. `productThumb` maps an original URL onto its thumb;
 * callers pair it with an onError fallback to the original so a missing thumb
 * (a photo uploaded before the bucket existed) can never appear broken.
 */
export function productThumb(url: string | undefined): string | undefined {
  if (!url) return url;
  const m = url.match(/^(https?:\/\/[^/]+)\/storage\/v1\/object\/public\/product-images\/(.+)$/);
  if (!m) return url;
  const clean = m[2].split('?')[0].replace(/\.(jpe?g|png|webp)$/i, '');
  return `${m[1]}/storage/v1/object/public/product-images-opt/${clean}.webp`;
}

/** Swap a failed thumb back to its original — attach as the img's onError. */
export function thumbFallback(event: { currentTarget: HTMLImageElement }) {
  const el = event.currentTarget;
  if (el.dataset.thumbFellBack) return;
  el.dataset.thumbFellBack = '1';
  const original = el.dataset.originalSrc;
  if (original) el.src = original;
}

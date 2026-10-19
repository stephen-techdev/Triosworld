/**
 * Colour detection from an uploaded photo.
 *
 * The operator should not have to name a colour they just photographed. When a
 * product photo is added, a small canvas sample of the garment is analysed and
 * matched against the shared colour table, so the colour box fills itself in.
 *
 * The garment is assumed to sit in the middle of the frame (which is how the
 * operator's own photos are shot), so the sample is a centred box rather than
 * the whole image — background wall and floor are what used to make this guess
 * wrong, so they are cropped out first.
 */
import COLOR_HEXES, { hexForColorName } from '@/lib/colors';

/** Compare RGB in a perceptual-ish space so near-greys do not win by accident. */
function distance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  // Weighted Euclidean ("redmean") — closer to how eyes rank colour difference
  // than raw RGB distance, and cheap enough to run over the whole table.
  const rMean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export interface DetectedColor {
  hex: string;
  /** The table's own name for the colour, e.g. "Olive". */
  name: string;
  /** How confident the match is, 0–1. Below ~0.45 the colour is unnamed. */
  confidence: number;
}

/**
 * Read the dominant garment colour from an image URL.
 *
 * Returns null when the image cannot be read (cross-origin without CORS, a
 * decode failure) so the caller can simply leave the colour box alone.
 */
export async function detectColorFromImage(url: string): Promise<DetectedColor | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode failed'));
      el.src = url;
    });

    const canvas = document.createElement('canvas');
    const size = 48;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Sample the centred 60% box — that is where the garment sits.
    const sw = img.naturalWidth * 0.6;
    const sh = img.naturalHeight * 0.6;
    ctx.drawImage(
      img,
      (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh,
      0, 0, size, size,
    );

    const { data } = ctx.getImageData(0, 0, size, size);
    const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 200) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Ignore near-white and near-black pixels: studio backdrops and drop
      // shadows otherwise dominate the average of every photo.
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 245 && max - min < 12) continue;
      if (min < 14 && max < 40) continue;
      // Coarse bucket so a shade variation votes together.
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const cur = buckets.get(key);
      if (cur) { cur.count++; cur.r += r; cur.g += g; cur.b += b; }
      else buckets.set(key, { count: 1, r, g, b });
    }

    if (!buckets.size) return null;

    // The biggest bucket is the dominant garment tone.
    const top = [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 6);
    const mean = {
      r: Math.round(top.reduce((s, x) => s + x.r, 0) / top.reduce((s, x) => s + x.count, 0)),
      g: Math.round(top.reduce((s, x) => s + x.g, 0) / top.reduce((s, x) => s + x.count, 0)),
      b: Math.round(top.reduce((s, x) => s + x.b, 0) / top.reduce((s, x) => s + x.count, 0)),
    };

    let best: { name: string; hex: string; d: number } | null = null;
    for (const [name, hex] of Object.entries(COLOR_HEXES)) {
      const d = distance(mean, parseHex(hex));
      if (!best || d < best.d) best = { name, hex, d };
    }
    if (!best) return null;

    // Turn the distance into a rough confidence. 0 distance = 1, and beyond
    // ~12000 (a fair way apart in redmean space) it is a guess, not a match.
    const confidence = Math.max(0, Math.min(1, 1 - best.d / 12000));
    const hex = `#${[mean.r, mean.g, mean.b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
    return { hex, name: best.name, confidence };
  } catch {
    return null;
  }
}

/** Re-export so callers can resolve a typed name the same way. */
export { hexForColorName };

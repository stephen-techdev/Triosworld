/**
 * Per-colour stock caps for the storefront.
 *
 * The operator sets a stock count for every colour + size in the dashboard.
 * That number is the whole sellable quantity for that variant, so the bag has
 * to stop at it: four units of "Black / M" means four, not the old flat ten.
 *
 * `variantStock` returns 0 for a product that is not in the live catalog yet
 * (the dashboard list arrives asynchronously), which is why callers only run
 * these helpers once a product is on screen.
 */
import { liveProductById } from '@/lib/storefrontCatalog';

/** The per-line ceiling the cart has always used. */
export const MAX_UNITS_PER_LINE = 10;

export interface StockLine {
  productId: string;
  color: string;
  size: string;
  qty: number;
}

/** Units the operator has for this exact colour + size. */
export function variantStock(productId: string, color: string, size: string): number {
  const product = liveProductById(productId);
  if (!product) return 0;
  const variant = product.variants.find((v) => v.color === color);
  const entry = variant?.sizes.find((s) => s.size === size);
  const stock = Math.floor(Number(entry?.stock));
  return Number.isFinite(stock) && stock > 0 ? stock : 0;
}

/**
 * The most units of this variant that may sit in the bag:
 * the operator's stock, never above the flat per-line ceiling.
 */
export function maxUnitsPerLine(productId: string, color: string, size: string): number {
  return Math.min(MAX_UNITS_PER_LINE, variantStock(productId, color, size));
}

/** How many units of this variant are already in the bag. */
export function unitsInCart(
  cart: readonly StockLine[],
  productId: string,
  color: string,
  size: string,
): number {
  return (
    cart.find(
      (i) => i.productId === productId && i.color === color && i.size === size,
    )?.qty ?? 0
  );
}

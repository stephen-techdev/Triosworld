/**
 * Shared gate on the eager boot reads (src/bootFetch.ts).
 *
 * bootFetch listed before main.tsx fires the products + store_settings REST
 * calls while the main bundle is still downloading. Each storefront lib asks
 * this helper for that preloaded payload with a short bounded wait and falls
 * back to its own supabase-js query when the boot gave up or missed the wait —
 * identical queries either way, so data is the same, just earlier.
 */
export interface BootState {
  done: boolean;
  promise: Promise<void> | null;
  ok: boolean;
  products?: unknown;
  storeRow?: unknown;
}

/** The one store_settings row carries content + numeric settings together. */
export interface StoreSettingsBootRow {
  content?: unknown;
  shipping_fee?: number | null;
  free_shipping_threshold?: number | null;
  announcement?: string | null;
}

declare global {
  interface Window {
    __twBoot?: BootState;
  }
}

export function bootState(): BootState | undefined {
  return typeof window === 'undefined' ? undefined : window.__twBoot;
}

/**
 * The one `store_settings` row the boot fetch captured, or null.
 *
 * PostgREST answers a REST select with a JSON *array*, so `storeRow` arrives
 * as `[{ ... }]`. Reading `.content` straight off that array yields undefined,
 * which `?? null` turns into "no row" — and because a non-empty array is
 * truthy the SDK fallback below was skipped too. The caller then merged the
 * shipped defaults over nothing: every Admin → Content edit saved correctly
 * and the storefront never showed it. Normalise here so both shapes work.
 */
export function bootStoreRow(): StoreSettingsBootRow | null {
  const raw = bootState()?.storeRow;
  const row = Array.isArray(raw) ? raw[0] : raw;
  return row && typeof row === 'object' && !Array.isArray(row)
    ? (row as StoreSettingsBootRow)
    : null;
}

export function hasBootState(): boolean {
  return bootState() !== undefined;
}

/**
 * Wait (bounded, default 1.5s) for the boot module's reads to settle.
 * Returns the state when it resolved successfully, else null so callers run
 * their SDK fetch. Consuming this does not block when the boot has already
 * finished — that is the normal second-visit case.
 */
export async function awaitBootData(timeoutMs = 1500): Promise<BootState | null> {
  const boot = bootState();
  if (!boot) return null;

  const deadline = Date.now() + timeoutMs;
  while (!boot.done && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!boot.done) return null;
  return boot.ok ? boot : null;
}

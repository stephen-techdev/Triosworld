/**
 * Store-wide settings the operator controls from Admin → Settings.
 *
 * Shipping used to be a flat ₹79 and a ₹1499 threshold written into six
 * different components, so the numbers could disagree with each other and only
 * changed by a code edit. They now live in the `store_settings` table and are
 * fetched once here.
 *
 * The defaults below match the seeded row, so a first paint (and any failed
 * fetch) shows the same numbers the database would have returned.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/store/AuthContext';
import { awaitBootData, bootStoreRow, type StoreSettingsBootRow } from '@/lib/bootGate';
import { publish, subscribe } from '@/lib/tabSync';

export interface StoreSettings {
  shippingFee: number;
  freeShippingThreshold: number;
  announcement: string;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  // The live store is currently free shipping on every order. A failed
  // settings read must never invent a ₹79 charge that the server would not add.
  shippingFee: 0,
  freeShippingThreshold: 0,
  // Empty means "derive it": the bar then shows the free-shipping line built
  // from the threshold, so the operator never has to retype it after a change.
  announcement: '',
};

let cached: StoreSettings | null = null;
let inFlight: Promise<StoreSettings> | null = null;
const listeners = new Set<(s: StoreSettings) => void>();

function emit() {
  for (const fn of listeners) fn(cached ?? DEFAULT_SETTINGS);
}

function load(): Promise<StoreSettings> {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;

  inFlight = (async () => {
    // Consume the eager boot row first (src/bootFetch.ts: one store_settings
    // read shared with siteContent). If the boot fetch gave up or missed the
    // gate, the SDK query below runs as it always has.
    const boot = await awaitBootData();
    // bootStoreRow() unwraps the PostgREST array; null means "no usable row",
    // which is what makes the SDK query below run instead of the defaults.
    let row: StoreSettingsBootRow | null = boot ? bootStoreRow() : null;

    if (!row) {
      const { data, error } = await supabase
        .from('store_settings')
        .select('shipping_fee, free_shipping_threshold, announcement')
        .maybeSingle();
      row = error
        ? null
        : (data as {
            shipping_fee?: number;
            free_shipping_threshold?: number;
            announcement?: string | null;
          } | null);
    }

    cached = {
      shippingFee: Number(row?.shipping_fee ?? DEFAULT_SETTINGS.shippingFee) || 0,
      freeShippingThreshold:
        Number(row?.free_shipping_threshold ?? DEFAULT_SETTINGS.freeShippingThreshold) || 0,
      announcement: row?.announcement?.trim() ?? '',
    };
    return cached;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Called by the admin dashboard after it saves settings, so the tab updates. */
export function setStoreSettings(next: StoreSettings) {
  cached = next;
  emit();
  // Shipping/announcement are global: every open tab should agree immediately.
  publish('store-settings', next);
}

// A save from another tab: normalise defensively, then re-render consumers.
subscribe('store-settings', (raw) => {
  if (!raw || typeof raw !== 'object') return;
  const s = raw as Partial<StoreSettings>;
  cached = {
    shippingFee: Number(s.shippingFee) || 0,
    freeShippingThreshold: Number(s.freeShippingThreshold) || 0,
    announcement: typeof s.announcement === 'string' ? s.announcement : '',
  };
  emit();
});

/** Test seam: drops the cache so the next read refetches. */
export function resetStoreSettings() {
  cached = null;
  inFlight = null;
  emit();
}

/**
 * Returns the settings and re-renders if they change while the tab is open.
 * `ready` tells callers whether the database has answered yet, so a component
 * that must not flash a wrong number can hold back.
 */
export function useStoreSettings(): { settings: StoreSettings; ready: boolean } {
  const [settings, setSettings] = useState<StoreSettings>(cached ?? DEFAULT_SETTINGS);
  const [ready, setReady] = useState(Boolean(cached));

  useEffect(() => {
    let alive = true;

    const onChange = (next: StoreSettings) => {
      if (alive) setSettings(next);
    };
    listeners.add(onChange);

    void load().then((next) => {
      if (!alive) return;
      setSettings(next);
      setReady(true);
    });

    return () => {
      alive = false;
      listeners.delete(onChange);
    };
  }, []);

  return { settings, ready };
}

/**
 * Start the settings read before any component mounts (main.tsx). Shares the
 * cache/promise with useStoreSettings, so it is a no-op when the hook runs.
 */
export function primeStoreSettings(): void {
  void load();
}

/**
 * Shipping for a subtotal, from the operator's numbers.
 *
 * A threshold of 0 means "always free". An empty cart is 0 shipping rather than
 * the flat fee, so the drawer does not quote a delivery charge on nothing.
 */
export function shippingFor(settings: StoreSettings, subtotal: number): number {
  if (subtotal <= 0) return 0;
  if (settings.freeShippingThreshold <= 0) return 0;
  if (subtotal >= settings.freeShippingThreshold) return 0;
  return settings.shippingFee;
}

/** How much more is needed to earn free shipping, or 0 when it is already earned. */
export function amountToFreeShipping(settings: StoreSettings, subtotal: number): number {
  if (settings.freeShippingThreshold <= 0) return 0;
  return Math.max(0, settings.freeShippingThreshold - subtotal);
}

/**
 * The short "Free shipping over ₹1499" line used in the checkout trust row and
 * on the product page. With a threshold of 0 every order already ships free, so
 * there is no threshold to advertise.
 */
export function freeShippingLabel(settings: StoreSettings, format: (n: number) => string): string {
  if (settings.freeShippingThreshold <= 0) return 'Free shipping on all orders';
  return `Free shipping over ${format(settings.freeShippingThreshold)}`;
}

/**
 * The announcement bar's first line.
 *
 * The operator's own text wins. When they leave it blank the line is derived
 * from the free-shipping threshold, so raising the threshold updates the bar
 * without anyone editing copy. This is what actually renders — an announcement
 * saved from the dashboard but never read here would look saved and change
 * nothing.
 */
export function announcementLine(settings: StoreSettings, format: (n: number) => string): string {
  return settings.announcement.trim() || freeShippingLabel(settings, format);
}

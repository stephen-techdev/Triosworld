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

export interface StoreSettings {
  shippingFee: number;
  freeShippingThreshold: number;
  announcement: string;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  shippingFee: 79,
  freeShippingThreshold: 1499,
  announcement: 'Free shipping on orders over ₹1499 — across India.',
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
    const { data, error } = await supabase
      .from('store_settings')
      .select('shipping_fee, free_shipping_threshold, announcement')
      .maybeSingle();

    // On error keep the defaults rather than blanking the storefront: a cart
    // with no shipping figure is worse than one showing the previous number.
    const row = error ? null : (data as {
      shipping_fee?: number;
      free_shipping_threshold?: number;
      announcement?: string | null;
    } | null);

    cached = {
      shippingFee: Number(row?.shipping_fee ?? DEFAULT_SETTINGS.shippingFee) || 0,
      freeShippingThreshold:
        Number(row?.free_shipping_threshold ?? DEFAULT_SETTINGS.freeShippingThreshold) || 0,
      announcement: row?.announcement?.trim() || DEFAULT_SETTINGS.announcement,
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
}

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

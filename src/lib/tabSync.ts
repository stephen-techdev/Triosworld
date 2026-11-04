/**
 * Cross-tab data-change pings for the surfaces the operator edits in Admin.
 *
 * The storefront caches content, shipping settings and the product catalog in
 * module state. Saving used to update only the tab that saved, so an already
 * open storefront tab kept showing yesterday's copy until a manual reload —
 * which looks exactly like "the save did not stick".
 *
 * `publish()` fans a save out to every open tab on this origin:
 *  - `storage` fires in the OTHER tabs (and only there), carrying the payload.
 *  - a CustomEvent fires in the SAME tab, so an admin preview updates too.
 *
 * Payloads are small (content is ~11 KB); product changes send `null` and the
 * receiver re-reads the catalog, which is the only safe way to pick up stock.
 */
const PREFIX = 'tw:sync:';

export function publish(channel: string, payload: unknown): void {
  if (typeof window === 'undefined') return;
  const key = PREFIX + channel;
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), payload }));
  } catch {
    // Private mode / quota — the same-tab event below still works.
  }
  window.dispatchEvent(new CustomEvent(key, { detail: payload }));
}

export function subscribe(channel: string, fn: (payload: unknown) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const key = PREFIX + channel;

  const onStorage = (e: StorageEvent) => {
    if (e.key !== key || !e.newValue) return;
    try {
      fn((JSON.parse(e.newValue) as { payload?: unknown }).payload);
    } catch {
      // Ignore a malformed payload; the next save wins.
    }
  };
  const onLocal = (e: Event) => fn((e as CustomEvent).detail);

  window.addEventListener('storage', onStorage);
  window.addEventListener(key, onLocal);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(key, onLocal);
  };
}

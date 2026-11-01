/**
 * Warm the payment edge function before the customer needs it.
 *
 * Supabase edge functions boot cold: the first request after an idle period
 * can take a couple of seconds. Order creation cannot start until the customer
 * has filled the address, so there is plenty of time to boot the function in
 * the background — at cart-open and again when checkout mounts. By the time
 * "Pay securely" is tapped the function is already awake and the hand-off is a
 * couple of hundred milliseconds instead of a cold-start wait.
 *
 * `GET /trios-pay/` is the function's read-only health endpoint, so this
 * creates nothing and changes nothing. A 60-second cooldown keeps repeated
 * cart opens from firing requests at the edge.
 */
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

let inFlight: AbortController | null = null;
let startedAt = 0;

export function warmPaymentFunction(): void {
  if (typeof window === 'undefined') return;
  if (inFlight || Date.now() - startedAt < 60_000) return;

  startedAt = Date.now();
  const controller = new AbortController();
  inFlight = controller;
  void fetch(`${FUNCTIONS_URL}/trios-pay/`, {
    method: 'GET',
    mode: 'no-cors',
    signal: controller.signal,
  })
    .catch(() => {
      // Best effort: the real payment request will boot it if this failed.
    })
    .finally(() => {
      if (inFlight === controller) inFlight = null;
    });
}

/**
 * Drop the background warm-up so the real order POST owns the connection.
 * Called when the customer taps "Pay securely"; harmless if the warm-up has
 * already finished. The server-side boot continues regardless.
 */
export function abortPaymentWarmup(): void {
  inFlight?.abort();
  inFlight = null;
  // Let a later checkout visit warm it again.
  startedAt = 0;
}

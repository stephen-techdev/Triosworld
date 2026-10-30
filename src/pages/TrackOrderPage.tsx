/**
 * Public order tracking â€” the storefront's answer to India Post consignment
 * lookup.
 *
 * The customer types the order ID from their confirmation (TW-000000) and the
 * page shows the same stages the operator sets in Admin â†’ Orders: placed â†’
 * dispatched â†’ delivered, with cancellation and refund handled separately.
 *
 * Everything on this page is deliberately status-only. The `/track` endpoint
 * answers the same payload for any visitor who types a number, so no name,
 * address or amount is allowed to travel â€” just timeline stages.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SearchCheck, RefreshCw, PackageCheck, Truck, Home, Ban, Loader2, XCircle,
} from 'lucide-react';
import SEO from '@/components/SEO';
import { trackOrder, canonicalOrderId, type TrackResult } from '@/lib/payments';

/** "Thu, 30 Oct, 6:42 PM" â€” the shop's audience reads India Standard Time. */
function istTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
      hour12: true, timeZone: 'Asia/Kolkata',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const STAGES = [
  { key: 'placed', label: 'Order placed', icon: PackageCheck, hint: 'We have your order' },
  { key: 'paid', label: 'Payment confirmed', icon: PackageCheck, hint: 'Payment received' },
  { key: 'dispatched', label: 'Dispatched', icon: Truck, hint: 'Handed to the courier' },
  { key: 'delivered', label: 'Delivered', icon: Home, hint: 'Reached its new home' },
] as const;

type StageKey = (typeof STAGES)[number]['key'];

export default function TrackOrderPage() {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<TrackResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const trackedId = useRef<string | null>(null);

  /** Fetch (or re-fetch) tracking for the given order id. */
  const load = useCallback(async (id: string, refresh = false) => {
    if (refresh) setRefreshing(true);
    else { setLoading(true); setError(null); }
    try {
      const data = await trackOrder(id);
      setResult(data);
      setError(null);
    } catch (err) {
      if (refresh) setError(null);
      else setResult(null);
      setError(err instanceof Error ? err.message : 'Could not load tracking right now. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = canonicalOrderId(value);
    if (!id) {
      setError('Enter the order ID from your confirmation message, like TW-345678.');
      setResult(null);
      return;
    }
    trackedId.current = id;
    load(id);
  };

  // Keep an open tracking view fresh the way India Post does â€” the status on
  // this page follows whatever Admin â†’ Orders sets, without a reload.
  // A settled state (delivered / cancelled) stops the polling.
  useEffect(() => {
    if (!result || !trackedId.current) return;
    const settled = ['delivered', 'cancelled'].includes(result.track.status);
    if (settled) return;
    const t = window.setInterval(() => {
      if (document.hidden) return;
      load(trackedId.current!, true);
    }, 20_000);
    return () => window.clearInterval(t);
  }, [result, load]);

  const open = Boolean(result);
  const track = result?.track;
  const cancelled = track?.cancelled_at || track?.status === 'cancelled';

  // Which stages are complete. Payment confirmed counts when the operator has
  // been paid; dispatched/delivered come straight from the admin trail.
  const reached: Record<StageKey, boolean> = {
    placed: open,
    paid: track?.payment_status === 'paid',
    dispatched: Boolean(track?.dispatched_at),
    delivered: Boolean(track?.delivered_at),
  };
  const lastComplete = (Object.values(reached) as boolean[]).lastIndexOf(true);

  const eventTimeFor = (key: StageKey): string | null => {
    if (key === 'paid') {
      const entry = result?.events.find(e => e.label === 'Payment confirmed');
      return entry ? entry.at : null;
    }
    if (key === 'dispatched') return track?.dispatched_at ?? null;
    if (key === 'delivered') return track?.delivered_at ?? null;
    return track?.created_at ?? null;
  };

  return (
    <div className="page-container py-10 md:py-16 max-w-2xl">
      <SEO title="Track Order" description="Track your TriosWorld order with your order ID — placed, dispatched and delivered, exactly as the store updates it." />

      <header className="text-center mb-8">
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-ivory border border-ink/10 shadow-card mb-4">
          <SearchCheck size={22} className="text-ink" />
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight">Track your order</h1>
        <p className="text-ink/65 text-sm mt-2">
          Enter the order ID from your confirmation message to see exactly where it stands.
        </p>
      </header>

      <form onSubmit={submit} className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3">
        <input
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          value={value}
          onChange={e => { setValue(e.target.value.toUpperCase()); setError(null); }}
          placeholder="TW-345678"
          aria-label="Order ID"
          className="w-full sm:w-80 h-14 px-5 rounded-lg border border-ink/20 bg-ivory text-base font-semibold tracking-[0.2em] uppercase placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-12 px-7 rounded-lg bg-ink text-ivory text-sm font-semibold hover:bg-ink/85 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <SearchCheck size={16} />}
          Track
        </button>
      </form>
      {error && (
        <p className="mt-3 text-xs text-red-600 flex items-start gap-1.5" role="alert">
          <XCircle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {loading && !open && (
        <div className="mt-10 space-y-3" aria-hidden="true">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-16 rounded-xl bg-stone/50 animate-pulse" />
          ))}
        </div>
      )}

      {open && track && (
        <section className="mt-10" aria-live="polite">
          <div className="rounded-xl border border-ink/10 bg-ivory p-5 sm:p-7 shadow-card">
            {/* Header â€” order id, live status, manual refresh */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-ink/10">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/60">Order</p>
                <p className="font-display text-xl font-bold tracking-wide">{track.order_number}</p>
                <p className="text-[11px] text-ink/60 mt-0.5">Issued {istTime(track.created_at)} IST</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {cancelled ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-700 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] ring-1 ring-red-200">
                    <Ban size={13} /> Cancelled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/15 text-ink px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] ring-1 ring-lime/40">
                    {track.status === 'delivered' ? 'Delivered' : track.status === 'dispatched' ? 'Dispatched' : 'Placed'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => { const id = trackedId.current; if (id) load(id, true); }}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink/60 hover:text-ink transition-colors"
                >
                  <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                  Refresh status
                </button>
              </div>
            </div>

            {/* Timeline â€” India Post style: a rail with stages and the date each
                one happened. The current stage carries the descriptive hint. */}
            {cancelled ? (
              <div className="pt-6 flex items-start gap-3">
                <Ban size={20} className="text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">This order was cancelled</p>
                  {track.cancelled_at && (
                    <p className="text-xs text-ink/60 mt-0.5">{istTime(track.cancelled_at)} IST</p>
                  )}
                  <p className="text-xs text-ink/60 mt-1.5">
                    Questions about this order? Message us on WhatsApp and we will sort it out.
                  </p>
                </div>
              </div>
            ) : (
              <ol className="pt-6">
                {STAGES.map((stage, i) => {
                  const done = reached[stage.key];
                  const isLastComplete = i === lastComplete;
                  const at = eventTimeFor(stage.key);
                  const Icon = stage.icon;
                  return (
                    <li key={stage.key} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span
                          className={`grid place-items-center w-9 h-9 rounded-full shrink-0 transition-colors ${
                            done
                              ? 'bg-ink text-ivory'
                              : 'bg-stone/60 text-ink/40 ring-1 ring-ink/10'
                          }`}
                        >
                          {done ? <Icon size={17} /> : <span className="w-2 h-2 rounded-full bg-ink/30" />}
                        </span>
                        {i < STAGES.length - 1 && (
                          <span
                            className={`w-0.5 flex-1 my-1 rounded-full ${done ? 'bg-ink' : 'bg-ink/15'}`}
                            style={{ minHeight: 26 }}
                          />
                        )}
                      </div>
                      <div className={i < STAGES.length - 1 ? 'pb-7' : ''}>
                        <p className={`text-sm font-semibold ${done ? 'text-ink' : 'text-ink/45'}`}>
                          {stage.label}
                        </p>
                        {done && isLastComplete && track.status !== 'delivered' && (
                          <p className="text-[11px] text-ink/60 mt-0.5">{stage.hint}</p>
                        )}
                        {done && at && (
                          <p className="text-[11px] text-ink/55 mt-0.5">{istTime(at)} IST</p>
                        )}
                        {!done && (
                          <p className="text-[11px] text-ink/40 mt-0.5">Pending</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {/* Footer info â€” supportive, status-only. */}
            <div className="mt-6 pt-5 border-t border-ink/10 flex flex-wrap items-center justify-between gap-3 text-xs text-ink/60">
              <p>Status syncs automatically until the order reaches its final stage.</p>
              <Link to="/contact" className="underline hover:text-ink">Need help? Contact us</Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}


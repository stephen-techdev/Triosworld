import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, ShoppingBag, Users, Package, MessageSquare, Settings, LogOut,
  Loader2, Search, ChevronDown, Check, RefreshCw, Star, AlertTriangle, Save, Lock,
  ArrowLeft, TrendingUp, UserRound, X, Trash2,
} from 'lucide-react';
import SEO from '@/components/SEO';
import { Wordmark } from '@/components/Brand';
import { EASE } from '@/components/Motion';
import { CATEGORIES, PRODUCTS, SIZES, formatINR } from '@/data/catalog';
import {
  AdminAuthError, adminLogout, changeAdminPassword, createProduct, deleteCustomer,
  deleteProduct, getCustomer, getCustomers, getFeedback, getOrderEvents, getOrders, getOverview,
  getProducts, muteCustomer, readSession, setFeedbackStatus, updateOrder, updateProduct,
  uploadProductImage,
  type AdminCustomer, type AdminCustomerDetail, type AdminFeedback, type AdminOrder, type AdminProduct,
  type AdminSession, type Overview,
} from '@/lib/admin';

type Tab = 'overview' | 'orders' | 'customers' | 'products' | 'feedback' | 'settings';

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders & Payments', icon: ShoppingBag },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Admin dashboard at /admin.
 *
 * Reached through the normal sign-in page by entering the operator's email and
 * password instead of a mobile number. Everything it displays comes from the
 * `trios-admin` edge function, which re-verifies the operator session on every
 * request — the browser holding a token is never sufficient on its own.
 */
export default function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(() => readSession());
  const [tab, setTab] = useState<Tab>('overview');

  const signOut = useCallback(() => {
    adminLogout();
    setSession(null);
  }, []);

  // Sign-in lives on its own page at /admin/login; don't duplicate the form here.
  if (!session) return <Navigate to="/admin/login" replace />;

  return (
    <div className="min-h-screen bg-stone/25">
      <SEO title="Admin" noindex />

      <header className="sticky top-0 z-30 bg-ink text-ivory">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="text-lg shrink-0">
              <Wordmark variant="chrome" />
            </Link>
            <span className="hidden sm:inline text-[11px] uppercase tracking-widest text-ivory/40 border border-ivory/20 rounded-full px-2.5 py-1">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:block text-right min-w-0">
              <p className="text-xs font-medium truncate">{session.admin.name}</p>
              <p className="text-[11px] text-ivory/40 truncate">{session.admin.email}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full bg-ivory/10 hover:bg-ivory/20 transition shrink-0"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>

        {/* Mobile / tablet tab strip */}
        <div className="lg:hidden overflow-x-auto border-t border-ivory/10">
          <div className="flex gap-1 px-3 py-2 min-w-max">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  tab === t.id ? 'bg-lime text-ink' : 'text-ivory/60 hover:text-ivory'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-6 flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-24 space-y-1">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                  tab === t.id ? 'bg-ink text-ivory' : 'text-ink/60 hover:bg-stone/50 hover:text-ink'
                }`}
              >
                <t.icon size={17} /> {t.label}
              </button>
            ))}
            <div className="pt-4">
              <Link
                to="/"
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium text-ink/50 hover:bg-stone/50 hover:text-ink transition"
              >
                <ArrowLeft size={17} /> Back to store
              </Link>
            </div>
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              {tab === 'overview' && <OverviewSection />}
              {tab === 'orders' && <OrdersSection onAuthFail={signOut} />}
              {tab === 'customers' && <CustomersSection onAuthFail={signOut} />}
              {tab === 'products' && <ProductsSection onAuthFail={signOut} />}
              {tab === 'feedback' && <FeedbackSection onAuthFail={signOut} />}
              {tab === 'settings' && <SettingsSection />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Shared bits
// ════════════════════════════════════════════════════════════════════════════

function SectionHead({ title, subtitle, onRefresh, loading }: {
  title: string; subtitle?: string; onRefresh?: () => void; loading?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-xs text-ink/50 mt-1">{subtitle}</p>}
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-full border border-ink/15 hover:bg-stone/40 transition disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      )}
    </div>
  );
}

function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
      <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-red-800">{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="text-xs font-semibold text-red-700 underline mt-1">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="py-24 grid place-items-center text-ink/40">{children}</div>;
}

function PaymentChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-lime text-ink',
    pending: 'bg-amber-100 text-amber-800',
    failed: 'bg-red-100 text-red-700',
    expired: 'bg-stone text-ink/60',
    refunded: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${map[status] ?? 'bg-stone text-ink/60'}`}>
      {status}
    </span>
  );
}

/** Loads a section's data from the trios-admin function. */
function useAdminData<T>(loader: () => Promise<T>, onAuthFail: () => void) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (err) {
      if (err instanceof AdminAuthError) { onAuthFail(); return; }
      setError(err instanceof Error ? err.message : 'Could not load data');
    } finally {
      setLoading(false);
    }
  }, [loader, onAuthFail]);

  useEffect(() => { void load(); }, [load]);
  return { data, error, loading, reload: load };
}

// ════════════════════════════════════════════════════════════════════════════
// Overview
// ════════════════════════════════════════════════════════════════════════════

function OverviewSection() {
  const loader = useCallback(() => getOverview(), []);
  const { data, error, loading, reload } = useAdminData<Overview>(loader, () => {});

  const cards = data ? [
    { label: 'Revenue (paid)', value: formatINR(data.revenue), icon: TrendingUp, accent: true },
    { label: 'Revenue today', value: formatINR(data.revenue_today), icon: TrendingUp },
    { label: 'Orders (total)', value: String(data.orders_total), icon: ShoppingBag },
    { label: 'Orders today', value: String(data.orders_today), icon: ShoppingBag },
    { label: 'Paid', value: String(data.orders_paid), icon: Check },
    { label: 'Pending', value: String(data.orders_pending), icon: Loader2 },
    { label: 'Failed', value: String(data.orders_failed), icon: AlertTriangle },
    { label: 'Expired', value: String(data.orders_expired), icon: AlertTriangle },
    { label: 'Guest orders', value: String(data.guests), icon: UserRound },
    { label: 'Registered orders', value: String(data.registered), icon: Users },
    { label: 'New feedback', value: String(data.new_feedback), icon: MessageSquare },
  ] : [];

  return (
    <div>
      <SectionHead title="Overview" subtitle="Live store performance" onRefresh={reload} loading={loading} />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data && <Centered><Loader2 className="animate-spin" /></Centered>}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {cards.map(c => (
            <div key={c.label} className={`rounded-xl border p-4 ${c.accent ? 'bg-ink text-ivory border-ink' : 'bg-ivory border-ink/10'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[11px] uppercase tracking-wide ${c.accent ? 'text-ivory/50' : 'text-ink/45'}`}>
                  {c.label}
                </span>
                <c.icon size={15} className={c.accent ? 'text-lime' : 'text-ink/30'} />
              </div>
              <p className="font-display text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Orders & Payments
// ════════════════════════════════════════════════════════════════════════════

const ORDER_FILTERS = ['all', 'paid', 'pending', 'failed', 'expired'] as const;
const FULFILMENT = ['placed', 'dispatched', 'delivered', 'cancelled'] as const;

function OrdersSection({ onAuthFail }: { onAuthFail: () => void }) {
  const [filter, setFilter] = useState<(typeof ORDER_FILTERS)[number]>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  const loader = useCallback(() => getOrders({ status: filter, q: debounced }), [filter, debounced]);
  const { data, error, loading, reload } = useAdminData<AdminOrder[]>(loader, onAuthFail);

  const [openId, setOpenId] = useState<string | null>(null);

  const setStatus = async (order: AdminOrder, patch: { status?: string; payment_status?: string }) => {
    try {
      await updateOrder(order.id, patch);
      await reload();
    } catch (err) {
      if (err instanceof AdminAuthError) { onAuthFail(); return; }
    }
  };

  return (
    <div>
      <SectionHead title="Orders & Payments" subtitle="Every order, guest and registered" onRefresh={reload} loading={loading} />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {ORDER_FILTERS.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3.5 py-2 rounded-full text-xs font-medium capitalize whitespace-nowrap transition ${
                filter === f ? 'bg-ink text-ivory' : 'bg-ivory border border-ink/10 text-ink/60 hover:text-ink'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search order ID, name or mobile"
            className="w-full text-sm bg-ivory border border-ink/10 rounded-full pl-9 pr-3 py-2.5 focus:outline-none focus:border-ink"
          />
        </div>
      </div>

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data && <Centered><Loader2 className="animate-spin" /></Centered>}

      {data && data.length === 0 && (
        <div className="rounded-xl border border-ink/10 bg-ivory p-12 text-center">
          <ShoppingBag size={26} className="mx-auto text-ink/30 mb-3" />
          <p className="text-sm text-ink/50">No orders match this view yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {data?.map(order => {
          const open = openId === order.id;
          return (
            <div key={order.id} className="rounded-xl border border-ink/10 bg-ivory overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : order.id)}
                className="w-full text-left p-4 flex items-center gap-4 hover:bg-stone/20 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs font-semibold">{order.order_number}</span>
                    <PaymentChip status={order.payment_status} />
                    <span className="text-[11px] text-ink/40 capitalize">{order.status}</span>
                    {!order.user_id && (
                      <span className="text-[10px] uppercase tracking-wide text-ink/40 border border-ink/15 rounded-full px-2 py-0.5">
                        Guest
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">
                    {order.customer_name ?? 'Customer'}
                    {order.customer_mobile && <span className="text-ink/40 font-normal"> · {order.customer_mobile}</span>}
                  </p>
                  <p className="text-[11px] text-ink/40 mt-0.5">{shortDate(order.created_at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">{formatINR(order.amount_paid ?? order.total)}</p>
                  <ChevronDown size={16} className={`ml-auto mt-1 text-ink/30 transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-hidden border-t border-ink/10"
                  >
                    <OrderDetail order={order} onPatch={patch => setStatus(order, patch)} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderDetail({ order, onPatch }: { order: AdminOrder; onPatch: (patch: { status?: string; payment_status?: string }) => void }) {
  const [events, setEvents] = useState<{ id: string; event: string; detail: unknown; created_at: string }[] | null>(null);
  const [showEvents, setShowEvents] = useState(false);

  const loadEvents = async () => {
    if (events) { setShowEvents(s => !s); return; }
    try {
      setEvents(await getOrderEvents(order.id));
      setShowEvents(true);
    } catch {
      setEvents([]);
      setShowEvents(true);
    }
  };

  const addr = order.shipping_address ?? {};

  return (
    <div className="p-4 md:p-5 bg-stone/10 space-y-5">
      <div className="grid md:grid-cols-2 gap-5">
        {/* Items */}
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink/45 mb-2">Items</p>
          <div className="space-y-2">
            {(order.items ?? []).map((item, i) => (
              <div key={i} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-ink/45"> · {item.color} · {item.size} · ×{item.qty}</span>
                </span>
                <span className="font-medium shrink-0">{formatINR(item.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-ink/10 space-y-1 text-xs text-ink/60">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{order.shipping ? formatINR(order.shipping) : 'Free'}</span></div>
            {order.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>−{formatINR(order.discount)}</span></div>}
            <div className="flex justify-between font-semibold text-ink text-sm pt-1"><span>Total</span><span>{formatINR(order.total)}</span></div>
          </div>
        </div>

        {/* Customer + payment */}
        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink/45 mb-2">Delivery</p>
            <p className="text-sm font-medium">{addr.fullName ?? order.customer_name}</p>
            <p className="text-xs text-ink/60 mt-0.5">{addr.mobile ?? order.customer_mobile}</p>
            {(addr.email ?? order.customer_email) && (
              <p className="text-xs text-ink/60">{addr.email ?? order.customer_email}</p>
            )}
            <p className="text-xs text-ink/60 mt-1">
              {addr.address}
              {addr.city && <><br />{addr.city}, {addr.state} {addr.pincode}</>}
            </p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink/45 mb-2">Payment</p>
            <dl className="text-xs space-y-1">
              <div className="flex justify-between gap-3"><dt className="text-ink/50">Method</dt><dd className="font-medium uppercase">{order.payment_method}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink/50">Provider</dt><dd className="font-medium">{order.payment_provider ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink/50">Txn ref</dt><dd className="font-mono break-all text-right">{order.payment_id ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink/50">Paid at</dt><dd className="font-medium">{shortDate(order.paid_at)}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[11px] uppercase tracking-wide text-ink/45 mr-1">Fulfilment</span>
        {FULFILMENT.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => onPatch({ status: s })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition ${
              order.status === s ? 'bg-ink text-ivory' : 'bg-ivory border border-ink/15 text-ink/60 hover:text-ink'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-ink/45 mr-1">Payment</span>
        <button type="button" onClick={() => onPatch({ payment_status: 'paid' })}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-lime text-ink hover:brightness-95 transition">
          Mark paid
        </button>
        <button type="button" onClick={() => onPatch({ payment_status: 'refunded' })}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-ivory border border-ink/15 hover:bg-stone/40 transition">
          Mark refunded
        </button>
        <button type="button" onClick={() => onPatch({ payment_status: 'failed' })}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-ivory border border-ink/15 hover:bg-stone/40 transition">
          Mark failed
        </button>
        <button type="button" onClick={loadEvents}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-ivory border border-ink/15 hover:bg-stone/40 transition ml-auto">
          {showEvents ? 'Hide' : 'Payment'} trail
        </button>
      </div>

      {showEvents && (
        <div className="rounded-lg border border-ink/10 bg-ivory p-3 max-h-56 overflow-y-auto">
          {events && events.length > 0 ? (
            <ul className="space-y-2">
              {events.map(e => (
                <li key={e.id} className="text-xs">
                  <span className="font-mono font-semibold">{e.event}</span>
                  <span className="text-ink/40"> · {shortDate(e.created_at)}</span>
                  {e.detail != null && (
                    <p className="text-[11px] text-ink/45 font-mono break-all mt-0.5">
                      {JSON.stringify(e.detail)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink/45">No events recorded.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Customers
// ════════════════════════════════════════════════════════════════════════════

function CustomersSection({ onAuthFail }: { onAuthFail: () => void }) {
  const loader = useCallback(() => getCustomers(), []);
  const { data, error, loading, reload } = useAdminData<AdminCustomer[]>(loader, onAuthFail);
  const [query, setQuery] = useState('');
  const [openMobile, setOpenMobile] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(c => c.name.toLowerCase().includes(q) || c.mobile.includes(q));
  }, [data, query]);

  return (
    <div>
      <SectionHead title="Customers" subtitle="Registered accounts and guest buyers" onRefresh={reload} loading={loading} />

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or mobile"
          className="w-full text-sm bg-ivory border border-ink/10 rounded-full pl-9 pr-3 py-2.5 focus:outline-none focus:border-ink"
        />
      </div>

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data && <Centered><Loader2 className="animate-spin" /></Centered>}

      {data && filtered.length === 0 && (
        <div className="rounded-xl border border-ink/10 bg-ivory p-12 text-center">
          <Users size={26} className="mx-auto text-ink/30 mb-3" />
          <p className="text-sm text-ink/50">No customers yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(c => (
          <CustomerRow key={`${c.mobile}-${c.type}`} customer={c} onChanged={reload} onView={() => setOpenMobile(c.mobile)} />
        ))}
      </div>

      {openMobile && (
        <CustomerDrawer
          mobile={openMobile}
          onClose={() => setOpenMobile(null)}
          onAuthFail={onAuthFail}
        />
      )}
    </div>
  );
}

// ─────────────────────── customer row + moderation ───────────────────────

function CustomerRow({ customer: c, onChanged, onView }: {
  customer: AdminCustomer; onChanged: () => void; onView: () => void;
}) {
  const [busy, setBusy] = useState<'mute' | 'unmute' | 'delete' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [askingMute, setAskingMute] = useState(false);
  const [askingDelete, setAskingDelete] = useState(false);

  const run = async (kind: 'mute' | 'unmute' | 'delete') => {
    setBusy(kind); setErr(null);
    try {
      if (kind === 'delete') await deleteCustomer(c.mobile);
      else await muteCustomer(c.mobile, kind === 'mute', reason);
      setAskingMute(false); setAskingDelete(false); setReason('');
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not complete that action');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-ink/10 bg-ivory p-4">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-10 h-10 rounded-full bg-stone grid place-items-center shrink-0">
          <UserRound size={17} className="text-ink/50" />
        </div>

        <button onClick={onView} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{c.name}</p>
            <span className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 ${
              c.type === 'guest' ? 'bg-stone text-ink/60' : 'bg-lime text-ink'
            }`}>
              {c.type}
            </span>
          </div>
          <p className="text-xs text-ink/50 mt-0.5 truncate">
            +91 {c.mobile}
            {c.email && <span className="text-ink/40"> · {c.email}</span>}
          </p>
        </button>

        <div className="text-right shrink-0 hidden sm:block">
          <p className="text-sm font-semibold">{formatINR(c.spent)}</p>
          <p className="text-[11px] text-ink/45">
            {c.orders} order{c.orders === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onView}
            className="p-2 rounded-lg text-ink/50 hover:bg-stone/60 hover:text-ink transition"
            aria-label={`View profile for ${c.name}`}
            title="View profile"
          >
            <ChevronDown size={16} className="-rotate-90" />
          </button>

          {c.type === 'registered' ? (
            <>
              <button
                onClick={() => (askingMute ? run('mute') : setAskingMute(v => !v))}
                disabled={busy !== null}
                className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition disabled:opacity-40"
                aria-label={askingMute ? 'Confirm mute' : `Mute ${c.name}`}
                title={askingMute ? 'Confirm mute' : 'Mute'}
              >
                {busy === 'mute' ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
              </button>
              <button
                onClick={() => (askingDelete ? run('delete') : setAskingDelete(v => !v))}
                disabled={busy !== null}
                className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition disabled:opacity-40"
                aria-label={askingDelete ? 'Confirm delete' : `Delete ${c.name}`}
                title={askingDelete ? 'Confirm delete' : 'Delete'}
              >
                {busy === 'delete' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            </>
          ) : (
            <span className="text-[10px] text-ink/35 px-2">guest</span>
          )}
        </div>
      </div>

      {askingMute && (
        <div className="mt-3 pt-3 border-t border-ink/10 flex flex-col sm:flex-row gap-2">
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (optional) — shown to the customer if they try to sign in"
            className="flex-1 text-sm border border-ink/15 rounded-lg px-3 py-2 outline-none focus:border-ink"
          />
          <div className="flex gap-2">
            <button onClick={() => setAskingMute(false)} className="px-3 py-2 text-sm rounded-lg border border-ink/15 hover:bg-stone/50">
              Cancel
            </button>
            <button onClick={() => run('mute')} disabled={busy !== null}
              className="px-3 py-2 text-sm rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50">
              {busy === 'mute' ? 'Muting…' : 'Mute account'}
            </button>
          </div>
        </div>
      )}

      {askingDelete && (
        <div className="mt-3 pt-3 border-t border-ink/10">
          <p className="text-xs text-red-700 mb-2">
            Delete <strong>{c.name}</strong>? Their past orders and invoices are kept so revenue reporting
            stays correct, but they will be signed out permanently and cannot sign in again.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setAskingDelete(false)} className="px-3 py-2 text-sm rounded-lg border border-ink/15 hover:bg-stone/50">
              Cancel
            </button>
            <button onClick={() => run('delete')} disabled={busy !== null}
              className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50">
              {busy === 'delete' ? 'Deleting…' : 'Yes, delete'}
            </button>
          </div>
        </div>
      )}

      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </div>
  );
}

// ───────────────────────── customer detail drawer ──────────────────────────

function CustomerDrawer({ mobile, onClose, onAuthFail }: {
  mobile: string; onClose: () => void; onAuthFail: () => void;
}) {
  const [data, setData] = useState<AdminCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setData(await getCustomer(mobile));
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthFail(); return; }
      setError(e instanceof Error ? e.message : 'Could not load this customer');
    } finally {
      setLoading(false);
    }
  }, [mobile, onAuthFail]);

  useEffect(() => { void load(); }, [load]);

  const toggleMute = async () => {
    if (!data) return;
    setBusy(true); setError(null);
    try {
      if (data.is_muted) await muteCustomer(data.mobile, false);
      else await muteCustomer(data.mobile, true, 'Blocked by operator');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!data) return;
    setBusy(true); setError(null);
    try {
      await deleteCustomer(data.mobile);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside className="relative w-full sm:w-[480px] max-w-full bg-ivory h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-ivory/95 backdrop-blur border-b border-ink/10 px-5 py-4 flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">Customer profile</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-stone/60" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading && <Centered><Loader2 className="animate-spin" /></Centered>}
          {error && <ErrorNote message={error} onRetry={load} />}

          {data && (
            <>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-display text-xl font-semibold">{data.full_name}</p>
                  {data.is_muted && (
                    <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-amber-100 text-amber-800">
                      {data.deleted_at ? 'Deleted' : 'Muted'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink/60">+91 {data.mobile}</p>
                {data.email && <p className="text-sm text-ink/50 break-all">{data.email}</p>}
                {data.gender && <p className="text-sm text-ink/50 capitalize">{data.gender}</p>}
                {data.muted_reason && data.is_muted && (
                  <p className="text-xs text-amber-700 mt-2">Reason: {data.muted_reason}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Orders', value: String(data.stats.order_count) },
                  { label: 'Paid', value: String(data.stats.paid_count) },
                  { label: 'Spent', value: formatINR(data.stats.total_spent) },
                ].map(s => (
                  <div key={s.label} className="rounded-lg border border-ink/10 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-ink/45">{s.label}</p>
                    <p className="font-display text-lg font-bold mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="text-xs text-ink/50 space-y-1">
                <p>Type: {data.has_account ? 'Registered account' : 'Guest (no account)'}</p>
                {data.joined_at && <p>Joined: {shortDate(data.joined_at)}</p>}
                {data.google_id && <p>Linked Google ID: <span className="font-mono text-[10px]">{data.google_id}</span></p>}
              </div>

              {data.has_account && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-ink/10">
                  <button onClick={toggleMute} disabled={busy || Boolean(data.deleted_at)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-full border border-amber-300 text-amber-800 hover:bg-amber-50 disabled:opacity-40">
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
                    {data.is_muted ? 'Unmute account' : 'Mute account'}
                  </button>
                  <button onClick={remove} disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-full border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-40">
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Delete account
                  </button>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/45 mb-2">
                  Orders ({data.orders.length})
                </h4>
                {data.orders.length === 0 ? (
                  <p className="text-xs text-ink/45">No orders yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.orders.map(o => (
                      <div key={o.order_number} className="flex items-center justify-between gap-2 text-xs border border-ink/10 rounded-lg px-3 py-2">
                        <span className="font-medium">{o.order_number}</span>
                        <span className="flex items-center gap-2">
                          <PaymentChip status={o.payment_status} />
                          <span className="text-ink/45">{shortDate(o.created_at)}</span>
                          <span className="font-semibold">{formatINR(o.total)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {data.addresses.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/45 mb-2">
                    Saved addresses ({data.addresses.length})
                  </h4>
                  <div className="space-y-1.5">
                    {data.addresses.map((a, i) => (
                      <div key={i} className="text-xs border border-ink/10 rounded-lg px-3 py-2">
                        {String(a.label ?? 'Address')}
                        <span className="block text-ink/60">
                          {[a.address_line, a.city, a.state, a.pincode].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.feedback.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/45 mb-2">
                    Feedback ({data.feedback.length})
                  </h4>
                  <div className="space-y-1.5">
                    {data.feedback.map(f => (
                      <div key={f.id} className="text-xs border border-ink/10 rounded-lg px-3 py-2">
                        <span className="text-ink/50">{f.category}</span>
                        <span className="block">{f.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Products
// ════════════════════════════════════════════════════════════════════════════

function ProductsSection({ onAuthFail }: { onAuthFail: () => void }) {
  const loader = useCallback(() => getProducts(), []);
  const { data, error, loading, reload } = useAdminData<AdminProduct[]>(loader, onAuthFail);
  const [adding, setAdding] = useState(false);

  const duplicates = (data ?? []).filter(p => p.duplicate && !p.deleted);

  return (
    <div>
      <SectionHead
        title="Products"
        subtitle="Edit price, MRP, stock and visibility — changes go live immediately"
        onRefresh={reload}
        loading={loading}
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data && <Centered><Loader2 className="animate-spin" /></Centered>}

      <div className="mb-4">
        <button
          onClick={() => setAdding(v => !v)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-ink text-ivory text-sm font-semibold hover:bg-ink/80 transition"
        >
          {adding ? <X size={15} /> : <Package size={15} />}
          {adding ? 'Close' : 'Add a product'}
        </button>
      </div>

      {adding && <div className="mb-4"><AddProductForm onCreated={reload} onAuthFail={onAuthFail} /></div>}

      {duplicates.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900 mb-1">
            {duplicates.length} duplicate card{duplicates.length === 1 ? '' : 's'} found
          </p>
          <p className="text-xs text-amber-800">
            Two live products share the same URL slug. Remove the newer one on its card below so only one
            appears on the storefront.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {data?.map(p => <ProductCard key={p.id} product={p} onSaved={reload} onAuthFail={onAuthFail} />)}
      </div>
    </div>
  );
}

function ProductCard({ product, onSaved, onAuthFail }: {
  product: AdminProduct; onSaved: () => void; onAuthFail: () => void;
}) {
  const [price, setPrice] = useState(String(product.price));
  const [mrp, setMrp] = useState(String(product.mrp));
  const [stock, setStock] = useState<Record<string, string>>(
    () => Object.fromEntries(Object.entries(product.stock).map(([k, v]) => [k, String(v)])),
  );
  const [active, setActive] = useState(product.is_active);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const image = product.image_url ?? PRODUCTS.find(c => c.id === product.id)?.variants?.[0]?.images?.[0];
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const remove = async () => {
    setRemoving(true); setErr(null); setNote(null);
    try {
      const res = await deleteProduct(product.id);
      // Products already bought are only hidden, never removed, so past
      // invoices keep resolving.
      setNote(res.inOrders
        ? 'Hidden from the store — it appears in past orders, so it was hidden rather than deleted.'
        : 'Removed from the store.');
      setConfirmRemove(false);
      onSaved();
      setTimeout(() => setNote(null), 4000);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthFail(); return; }
      setErr(e instanceof Error ? e.message : 'Could not remove this product');
    } finally {
      setRemoving(false);
    }
  };


  const dirty =
    price !== String(product.price) ||
    mrp !== String(product.mrp) ||
    active !== product.is_active ||
    Object.entries(stock).some(([k, v]) => v !== String(product.stock[k] ?? ''));

  const save = async () => {
    setSaving(true);
    setErr(null);
    setSaved(false);
    try {
      await updateProduct({
        productId: product.id,
        price: Number(price),
        mrp: Number(mrp),
        stock: Object.fromEntries(Object.entries(stock).map(([k, v]) => [k, Number(v) || 0])),
        is_active: active,
      });
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2200);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthFail(); return; }
      setErr(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rounded-xl border bg-ivory overflow-hidden flex flex-col ${active && !product.deleted ? 'border-ink/10' : 'border-ink/10 opacity-70'}`}>
      {product.deleted && (
        <div className="bg-red-600 text-white text-[11px] font-medium px-3 py-1.5 flex items-center gap-2">
          <Trash2 size={12} /> Removed from the storefront
        </div>
      )}
      <div className="flex gap-3 p-3 border-b border-ink/10">
        <div className="w-16 h-20 rounded-lg bg-stone/40 overflow-hidden shrink-0">
          {image && <img src={image} alt={product.name} className="w-full h-full object-cover object-top" loading="lazy" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{product.name}</p>
          <p className="text-[11px] text-ink/45 mt-1 font-mono truncate">{product.id}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-stone text-ink/60">
              {product.stock_total} in stock
            </span>
            {product.source === 'runtime' && (
              <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-blue-100 text-blue-800">
                added in dashboard
              </span>
            )}
            {product.duplicate && (
              <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-amber-100 text-amber-800">
                duplicate slug
              </span>
            )}
            {product.overridden && (
              <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-ink text-ivory">
                edited
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 space-y-3 flex-1">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] text-ink/50">Price (₹)</span>
            <input
              type="number" min={0} value={price}
              onChange={e => setPrice(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-2.5 py-2 text-sm focus:outline-none focus:border-ink"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-ink/50">MRP (₹)</span>
            <input
              type="number" min={0} value={mrp}
              onChange={e => setMrp(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-2.5 py-2 text-sm focus:outline-none focus:border-ink"
            />
          </label>
        </div>

        <div>
          <span className="text-[11px] text-ink/50">Stock per size</span>
          <div className="grid grid-cols-3 gap-1.5 mt-1">
            {Object.entries(stock).map(([size, value]) => (
              <label key={size} className="block">
                <span className="text-[10px] text-ink/40">{size}</span>
                <input
                  type="number" min={0} value={value}
                  onChange={e => setStock(s => ({ ...s, [size]: e.target.value }))}
                  className="w-full rounded-md border border-ink/15 px-2 py-1.5 text-xs focus:outline-none focus:border-ink"
                />
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 pt-1 cursor-pointer">
          <span className="text-xs text-ink/60">Available for purchase</span>
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="w-4 h-4 accent-ink" />
        </label>

        {err && <p className="text-[11px] text-red-600">{err}</p>}
        {note && <p className="text-[11px] bg-lime text-ink px-2.5 py-1.5 rounded">{note}</p>}

        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty || Boolean(product.deleted)}
          className="w-full py-2.5 rounded-full text-sm font-semibold transition disabled:opacity-40 inline-flex items-center justify-center gap-2 bg-ink text-ivory hover:bg-ink/80"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <><Check size={15} /> Saved</> : <><Save size={15} /> Save changes</>}
        </button>

        {/* Delete — permanent. Catalog products cannot be deleted because they are
            code, so the control is hidden rather than faked with a restore. */}
        <div className="pt-3 border-t border-ink/10">
          {product.source === 'runtime' ? (
            confirmRemove ? (
              <div className="space-y-2">
                <p className="text-[11px] text-red-700">
                  Permanently delete <strong>{product.name}</strong>? This cannot be undone. Its images are
                  removed too. Past orders keep their own copy of the name, size and price, so invoices and
                  revenue reporting are unaffected.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirmRemove(false)}
                    className="px-3 py-1.5 text-[11px] rounded-lg border border-ink/15 hover:bg-stone/50">
                    Cancel
                  </button>
                  <button type="button" onClick={remove} disabled={removing}
                    className="px-3 py-1.5 text-[11px] rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50">
                    {removing ? 'Deleting…' : 'Delete permanently'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                disabled={removing}
                className="w-full py-2 rounded-full text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {removing ? <Loader2 size={13} className="animate-spin" /> : <><Trash2 size={13} /> Delete permanently</>}
              </button>
            )
          ) : (
            <p className="text-[10px] text-ink/40 text-center">
              Catalog product — price, stock and visibility only.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Feedback
// ════════════════════════════════════════════════════════════════════════════

function FeedbackSection({ onAuthFail }: { onAuthFail: () => void }) {
  const [filter, setFilter] = useState<'all' | 'new' | 'read' | 'resolved'>('all');
  const loader = useCallback(() => getFeedback(filter), [filter]);
  const { data, error, loading, reload } = useAdminData<AdminFeedback[]>(loader, onAuthFail);

  const setStatus = async (id: string, status: 'new' | 'read' | 'resolved') => {
    try {
      await setFeedbackStatus(id, status);
      await reload();
    } catch (err) {
      if (err instanceof AdminAuthError) { onAuthFail(); return; }
    }
  };

  return (
    <div>
      <SectionHead title="Customer feedback" subtitle="Everything sent from the store's feedback button" onRefresh={reload} loading={loading} />

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {(['all', 'new', 'read', 'resolved'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3.5 py-2 rounded-full text-xs font-medium capitalize whitespace-nowrap transition ${
              filter === f ? 'bg-ink text-ivory' : 'bg-ivory border border-ink/10 text-ink/60 hover:text-ink'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data && <Centered><Loader2 className="animate-spin" /></Centered>}

      {data && data.length === 0 && (
        <div className="rounded-xl border border-ink/10 bg-ivory p-12 text-center">
          <MessageSquare size={26} className="mx-auto text-ink/30 mb-3" />
          <p className="text-sm text-ink/50">No feedback here yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {data?.map(f => (
          <div key={f.id} className="rounded-xl border border-ink/10 bg-ivory p-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                {f.rating ? (
                  <span className="inline-flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} size={13} className={n <= f.rating! ? 'fill-lime text-ink' : 'text-ink/20'} />
                    ))}
                  </span>
                ) : (
                  <span className="text-[11px] text-ink/40">No rating</span>
                )}
                <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-stone text-ink/60">
                  {f.category}
                </span>
                <span className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 ${
                  f.status === 'new' ? 'bg-lime text-ink' : 'bg-stone text-ink/60'
                }`}>
                  {f.status}
                </span>
              </div>
              <span className="text-[11px] text-ink/40 shrink-0">{shortDate(f.created_at)}</span>
            </div>

            <p className="text-sm text-ink/85 whitespace-pre-wrap">{f.message}</p>

            <div className="flex items-center justify-between gap-4 mt-3 flex-wrap">
              <p className="text-[11px] text-ink/45">
                {f.name ?? 'Anonymous'}
                {f.mobile && <> · +91 {f.mobile}</>}
                {f.email && <> · {f.email}</>}
                {f.page && <> · from {f.page}</>}
                {f.order_number && <> · order {f.order_number}</>}
              </p>
              <div className="flex gap-1.5">
                {(['new', 'read', 'resolved'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(f.id, s)}
                    className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium capitalize transition ${
                      f.status === s ? 'bg-ink text-ivory' : 'bg-ivory border border-ink/15 text-ink/60 hover:text-ink'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Settings
// ════════════════════════════════════════════════════════════════════════════

function SettingsSection() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (next !== confirm) { setError('The new passwords do not match.'); return; }
    if (next.length < 10) { setError('Use at least 10 characters.'); return; }

    setState('saving');
    setError(null);
    try {
      await changeAdminPassword(current, next);
      setState('done');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password.');
      setState('idle');
    }
  };

  return (
    <div>
      <SectionHead title="Settings" subtitle="Your operator account" />
      <div className="max-w-md">
        <form onSubmit={submit} className="rounded-xl border border-ink/10 bg-ivory p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Lock size={16} /> Change password
          </div>

          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          {state === 'done' && (
            <p className="text-xs text-ink bg-lime px-3 py-2 rounded-lg">Password updated.</p>
          )}

          <label className="block">
            <span className="text-xs text-ink/60">Current password</span>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:border-ink" />
          </label>
          <label className="block">
            <span className="text-xs text-ink/60">New password</span>
            <input type="password" value={next} onChange={e => setNext(e.target.value)} required
              autoComplete="new-password" minLength={10}
              className="mt-1.5 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:border-ink" />
            <span className="text-[11px] text-ink/40">At least 10 characters, with a letter and a number.</span>
          </label>
          <label className="block">
            <span className="text-xs text-ink/60">Confirm new password</span>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:border-ink" />
          </label>

          <button type="submit" disabled={state === 'saving'}
            className="w-full py-3 rounded-full bg-ink text-ivory text-sm font-semibold hover:bg-ink/80 transition disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {state === 'saving' ? <Loader2 size={16} className="animate-spin" /> : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Add product
// ════════════════════════════════════════════════════════════════════════════

function AddProductForm({ onCreated, onAuthFail }: { onCreated: () => void; onAuthFail: () => void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [category, setCategory] = useState('new-arrivals');
  const [colors, setColors] = useState('');
  const [fit, setFit] = useState('');
  const [fabric, setFabric] = useState('');
  const [badge, setBadge] = useState('');
  const [description, setDescription] = useState('');
  const [care, setCare] = useState('');
  const [bestseller, setBestseller] = useState(false);
  const [newArrival, setNewArrival] = useState(true);
  const [stock, setStock] = useState<Record<string, string>>(
    () => Object.fromEntries(SIZES.map(s => [s, '10'])),
  );
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Upload through the admin function so the storage bucket never needs a
  // public write policy.
  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadErr(null);
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 8 - images.length)) {
        if (file.size > 4 * 1024 * 1024) {
          setUploadErr(`${file.name} is over 4MB — please compress it`);
          continue;
        }
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
          reader.onerror = () => reject(new Error('Could not read that file'));
          reader.readAsDataURL(file);
        });
        const res = await uploadProductImage(file.name, file.type, data);
        setImages(prev => [...prev, { url: res.url, name: file.name }].slice(0, 8));
      }
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setOk(null); setSaving(true);
    try {
      const res = await createProduct({
        name: name.trim(),
        price: Number(price),
        mrp: mrp ? Number(mrp) : undefined,
        category,
        colors: colors.split(',').map(c => c.trim()).filter(Boolean),
        images: images.map(i => i.url),
        stock: Object.fromEntries(Object.entries(stock).map(([k, v]) => [k, Number(v) || 0])),
        description: description.trim() || undefined,
        care: care.trim() || undefined,
        fit: fit || undefined,
        fabric: fabric || undefined,
        badge: badge || undefined,
        bestseller,
        new_arrival: newArrival,
      });
      setOk(`Created "${name.trim()}" as /product/${res.slug}`);
      setName(''); setPrice(''); setMrp(''); setColors(''); setImages([]);
      setDescription(''); setCare(''); setFit(''); setFabric(''); setBadge('');
      setBestseller(false); setNewArrival(true);
      onCreated();
      setTimeout(() => setOk(null), 5000);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthFail(); return; }
      setErr(e instanceof Error ? e.message : 'Could not create this product');
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:border-ink";

  return (
    <form onSubmit={submit} className="rounded-xl border border-ink/10 bg-ivory p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Package size={16} /> Add a product
      </div>

      <p className="text-xs text-ink/50">
        Everything on the card is set here. Leave a field blank and it stays blank on the
        storefront — nothing is filled in for you.
      </p>

      {err && <p className="text-xs text-red-600">{err}</p>}
      {ok && <p className="text-xs bg-lime text-ink px-3 py-2 rounded-lg">{ok}</p>}

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-[11px] text-ink/50">Product name</span>
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="Midnight Oversized Tee"
            className={`mt-1 ${input}`} />
        </label>

        <label className="block">
          <span className="text-[11px] text-ink/50">Selling price (₹)</span>
          <input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} required
            className={`mt-1 ${input}`} />
        </label>

        <label className="block">
          <span className="text-[11px] text-ink/50">MRP (₹)</span>
          <input type="number" min={0} value={mrp} onChange={e => setMrp(e.target.value)}
            placeholder="Defaults to the selling price" className={`mt-1 ${input}`} />
        </label>

        <label className="block">
          <span className="text-[11px] text-ink/50">Collection</span>
          <select value={category} onChange={e => setCategory(e.target.value)} className={`mt-1 ${input}`}>
            {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-[11px] text-ink/50">Colours (comma separated)</span>
          <input value={colors} onChange={e => setColors(e.target.value)} placeholder="Black, White"
            className={`mt-1 ${input}`} />
        </label>

        <label className="block">
          <span className="text-[11px] text-ink/50">Fit</span>
          <select value={fit} onChange={e => setFit(e.target.value)} className={`mt-1 ${input}`}>
            <option value="">Not set</option>
            {(['Regular', 'Oversized', 'Relaxed', 'Slim'] as const).map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-[11px] text-ink/50">Fabric</span>
          <select value={fabric} onChange={e => setFabric(e.target.value)} className={`mt-1 ${input}`}>
            <option value="">Not set</option>
            {(['Cotton', 'Cotton Blend', 'Heavyweight Cotton', 'French Terry'] as const).map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-[11px] text-ink/50">Badge (corner pill)</span>
          <select value={badge} onChange={e => setBadge(e.target.value)} className={`mt-1 ${input}`}>
            <option value="">None</option>
            {(['Bestseller', 'New', 'Limited', 'Essential', 'Street', 'Graphic'] as const).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>

        <div className="flex gap-4 sm:col-span-2 pt-1">
          <label className="flex items-center gap-2 text-xs text-ink/70">
            <input type="checkbox" checked={bestseller} onChange={e => setBestseller(e.target.checked)} className="w-4 h-4 accent-ink" />
            Show in Bestsellers
          </label>
          <label className="flex items-center gap-2 text-xs text-ink/70">
            <input type="checkbox" checked={newArrival} onChange={e => setNewArrival(e.target.checked)} className="w-4 h-4 accent-ink" />
            Show in New Drops
          </label>
        </div>

        <label className="block sm:col-span-2">
          <span className="text-[11px] text-ink/50">Description</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
            placeholder="What makes this piece worth buying?"
            className={`mt-1 ${input} resize-y`} />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-[11px] text-ink/50">Care instructions</span>
          <input value={care} onChange={e => setCare(e.target.value)}
            placeholder="Machine wash cold, inside out. Do not bleach."
            className={`mt-1 ${input}`} />
        </label>
      </div>

      {/* Images */}
      <div>
        <span className="text-[11px] text-ink/50">
          Images — up to 8. The first is the thumbnail; the second becomes the hover image.
        </span>

        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {images.map((img, i) => (
              <div key={img.url} className="relative">
                <img src={img.url} alt={img.name}
                  className="w-16 h-20 object-cover object-top rounded-lg border border-ink/10 bg-stone/40" />
                {i === 0 && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] uppercase bg-ink text-ivory rounded-full px-1.5 py-0.5">
                    Main
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white grid place-items-center"
                  aria-label={`Remove ${img.name}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="mt-2 flex items-center justify-center gap-2 py-6 px-4 rounded-xl border border-dashed border-ink/20 hover:border-ink/40 cursor-pointer transition">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            multiple
            className="sr-only"
            onChange={e => { void onPick(e.target.files); e.target.value = ''; }}
          />
          {uploading ? (
            <><Loader2 size={16} className="animate-spin" /> Uploading…</>
          ) : (
            <><Package size={16} /> Choose images (PNG, JPEG, WebP · max 4MB each)</>
          )}
        </label>

        {uploadErr && <p className="text-[11px] text-red-600 mt-1.5">{uploadErr}</p>}
      </div>

      <div>
        <span className="text-[11px] text-ink/50">Stock per size</span>
        <div className="grid grid-cols-3 gap-1.5 mt-1">
          {Object.entries(stock).map(([size, value]) => (
            <label key={size} className="block">
              <span className="text-[10px] text-ink/40">{size}</span>
              <input type="number" min={0} value={value}
                onChange={e => setStock(s => ({ ...s, [size]: e.target.value }))}
                className="mt-0.5 w-full rounded-lg border border-ink/15 px-2 py-1.5 text-sm focus:outline-none focus:border-ink" />
            </label>
          ))}
        </div>
      </div>

      <button type="submit" disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ink text-ivory text-sm font-semibold hover:bg-ink/80 transition disabled:opacity-50">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Package size={15} />} Create product
      </button>
    </form>
  );
}

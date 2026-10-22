import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, ShoppingBag, Users, Package, MessageSquare, Settings, LogOut,
  Loader2, Search, ChevronDown, Check, RefreshCw, Star, AlertTriangle, Save, Lock,
  ArrowLeft, TrendingUp, UserRound, X, Trash2, Truck, FileText, Pencil, ImagePlus,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import SEO from '@/components/SEO';
import { EASE } from '@/components/Motion';
import { SIZES, SUGGESTED_BADGES, SUGGESTED_FABRICS, SUGGESTED_FITS, formatINR } from '@/data/catalog';
import ComboField from '@/components/ComboField';
import { setStoreSettings } from '@/lib/storeSettings';
import { useSiteContent } from '@/lib/siteContent';
import { hexForColorName } from '@/lib/colors';
import { detectColorFromImage } from '@/lib/colorDetect';
import { prepareImage } from '@/lib/imagePrep';
import ContentSection from '@/pages/admin/ContentSection';

/**
 * Collections the shop already has pages for — taken from the operator's own
 * category cards (Admin → Content), so a new collection appears as a
 * suggestion the moment it is created there. Free text is still accepted.
 */
const BUILTIN_COLLECTIONS = ['shop-all', 'men', 'bestsellers', 'new-arrivals'];
import {
  AdminAuthError, adminLogout, changeAdminPassword, clearFeedback, clearGuests, clearOrders, createProduct, deleteCustomer,
  deleteFeedback, deleteOrder, deleteProduct, getCustomer, getCustomers, getFeedback, getOrderEvents, getOrders, getOverview,
  getProducts, getSettings, muteCustomer, normalizeProductColors, readSession, saveSettings,
  setFeedbackStatus, updateOrder, updateProduct,
  uploadProductImage,
  type AdminCustomer, type AdminCustomerDetail, type AdminFeedback, type AdminOrder, type AdminProduct,
  type AdminSession, type Overview, type ProductColor,
} from '@/lib/admin';

type Tab = 'overview' | 'orders' | 'customers' | 'products' | 'content' | 'feedback' | 'settings';

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders & Payments', icon: ShoppingBag },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'content', label: 'Content', icon: FileText },
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
              <img src="/logo-ivory.png" alt="TriosWorld" className="h-7 w-auto" />
            </Link>
            <span className="hidden sm:inline text-[11px] uppercase tracking-widest text-ivory/60 border border-ivory/20 rounded-full px-2.5 py-1">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:block text-right min-w-0">
              <p className="text-xs font-medium truncate">{session.admin.name}</p>
              <p className="text-[11px] text-ivory/60 truncate">{session.admin.email}</p>
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
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium text-ink/65 hover:bg-stone/50 hover:text-ink transition"
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
              {tab === 'content' && <ContentSection onAuthFail={signOut} />}
              {tab === 'feedback' && <FeedbackSection onAuthFail={signOut} />}
              {tab === 'settings' && <SettingsSection onAuthFail={signOut} />}
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
        {subtitle && <p className="text-xs text-ink/65 mt-1">{subtitle}</p>}
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
  return <div className="py-24 grid place-items-center text-ink/65">{children}</div>;
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
                <span className={`text-[11px] uppercase tracking-wide ${c.accent ? 'text-ivory/50' : 'text-ink/65'}`}>
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
  const [clearing, setClearing] = useState(false);
  const [clearErr, setClearErr] = useState<string | null>(null);

  const setStatus = async (order: AdminOrder, patch: { status?: string; payment_status?: string }) => {
    try {
      await updateOrder(order.id, patch);
      await reload();
    } catch (err) {
      if (err instanceof AdminAuthError) { onAuthFail(); return; }
    }
  };

  const removeOrder = async (order: AdminOrder) => {
    if (!confirm(`Delete order ${order.order_number}? This cannot be undone.`)) return;
    try {
      await deleteOrder(order.id);
      await reload();
    } catch (err) {
      if (err instanceof AdminAuthError) { onAuthFail(); return; }
      alert(err instanceof Error ? err.message : 'Failed to delete order');
    }
  };

  const doClear = async (scope: 'all' | 'paid' | 'failed' | 'pending' | 'guests') => {
    const label = scope === 'all' ? 'ALL orders' : scope === 'guests' ? 'all GUEST orders' : `all ${scope} orders`;
    if (!confirm(`Clear ${label}? This cannot be undone.`)) return;
    setClearing(true); setClearErr(null);
    try {
      await clearOrders({ scope });
      await reload();
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthFail(); return; }
      setClearErr(e instanceof Error ? e.message : 'Failed to clear');
    } finally {
      setClearing(false);
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
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/65" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search order ID, name or mobile"
            className="w-full text-sm bg-ivory border border-ink/10 rounded-full pl-9 pr-3 py-2.5 focus:outline-none focus:border-ink"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[11px] text-ink/65">Clear:</span>
        <button type="button" disabled={clearing} onClick={() => doClear('guests')} className="px-2.5 py-1 rounded-full text-[11px] border border-ink/15 hover:bg-stone/40 disabled:opacity-40">Guest orders</button>
        <button type="button" disabled={clearing} onClick={() => doClear('pending')} className="px-2.5 py-1 rounded-full text-[11px] border border-ink/15 hover:bg-stone/40 disabled:opacity-40">Pending</button>
        <button type="button" disabled={clearing} onClick={() => doClear('failed')} className="px-2.5 py-1 rounded-full text-[11px] border border-ink/15 hover:bg-stone/40 disabled:opacity-40">Failed</button>
        <button type="button" disabled={clearing} onClick={() => doClear('paid')} className="px-2.5 py-1 rounded-full text-[11px] border border-ink/15 hover:bg-stone/40 disabled:opacity-40">Paid</button>
        <button type="button" disabled={clearing} onClick={() => doClear('all')} className="px-2.5 py-1 rounded-full text-[11px] border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40">Clear all</button>
        {clearErr && <span className="text-[11px] text-red-600">{clearErr}</span>}
      </div>

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data && <Centered><Loader2 className="animate-spin" /></Centered>}

      {data && data.length === 0 && (
        <div className="rounded-xl border border-ink/10 bg-ivory p-12 text-center">
          <ShoppingBag size={26} className="mx-auto text-ink/30 mb-3" />
          <p className="text-sm text-ink/65">No orders match this view yet.</p>
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
                    <span className="text-[11px] text-ink/65 capitalize">{order.status}</span>
                    {!order.user_id && (
                      <span className="text-[10px] uppercase tracking-wide text-ink/65 border border-ink/15 rounded-full px-2 py-0.5">
                        Guest
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">
                    {order.customer_name ?? 'Customer'}
                    {order.customer_mobile && <span className="text-ink/65 font-normal"> · {order.customer_mobile}</span>}
                  </p>
                  <p className="text-[11px] text-ink/65 mt-0.5">{shortDate(order.created_at)}</p>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <p className="font-semibold text-sm">{formatINR(order.amount_paid ?? order.total)}</p>
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeOrder(order); }} className="p-1.5 rounded-full text-ink/65 hover:text-red-600 hover:bg-red-50 transition" title="Delete order">
                    <Trash2 size={14} />
                  </button>
                  <ChevronDown size={16} className={`text-ink/30 transition-transform ${open ? 'rotate-180' : ''}`} />
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
          <p className="text-[11px] uppercase tracking-wide text-ink/65 mb-2">Items</p>
          <div className="space-y-2">
            {(order.items ?? []).map((item, i) => (
              <div key={i} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-ink/65"> · {item.color} · {item.size} · ×{item.qty}</span>
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
            <p className="text-[11px] uppercase tracking-wide text-ink/65 mb-2">Delivery</p>
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
            <p className="text-[11px] uppercase tracking-wide text-ink/65 mb-2">Payment</p>
            <dl className="text-xs space-y-1">
              <div className="flex justify-between gap-3"><dt className="text-ink/65">Method</dt><dd className="font-medium uppercase">{order.payment_method}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink/65">Provider</dt><dd className="font-medium">{order.payment_provider ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink/65">Txn ref</dt><dd className="font-mono break-all text-right">{order.payment_id ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink/65">Paid at</dt><dd className="font-medium">{shortDate(order.paid_at)}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[11px] uppercase tracking-wide text-ink/65 mr-1">Fulfilment</span>
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
        <span className="text-[11px] uppercase tracking-wide text-ink/65 mr-1">Payment</span>
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
                  <span className="text-ink/65"> · {shortDate(e.created_at)}</span>
                  {e.detail != null && (
                    <p className="text-[11px] text-ink/65 font-mono break-all mt-0.5">
                      {JSON.stringify(e.detail)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink/65">No events recorded.</p>
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
  const [clearing, setClearing] = useState(false);
  const [clearErr, setClearErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(c => c.name.toLowerCase().includes(q) || c.mobile.includes(q));
  }, [data, query]);

  const clearGuestHistory = async () => {
    if (!confirm('Clear all guest order history? This cannot be undone.')) return;
    setClearing(true); setClearErr(null);
    try {
      await clearGuests();
      await reload();
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthFail(); return; }
      setClearErr(e instanceof Error ? e.message : 'Failed to clear');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div>
      <SectionHead title="Customers" subtitle="Registered accounts and guest buyers" onRefresh={reload} loading={loading} />

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/65" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or mobile"
          className="w-full text-sm bg-ivory border border-ink/10 rounded-full pl-9 pr-3 py-2.5 focus:outline-none focus:border-ink"
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button type="button" disabled={clearing} onClick={clearGuestHistory} className="px-3 py-1.5 rounded-full text-xs border border-ink/15 hover:bg-stone/40 disabled:opacity-40">Clear guest history</button>
        {clearErr && <span className="text-[11px] text-red-600">{clearErr}</span>}
      </div>

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data && <Centered><Loader2 className="animate-spin" /></Centered>}

      {data && filtered.length === 0 && (
        <div className="rounded-xl border border-ink/10 bg-ivory p-12 text-center">
          <Users size={26} className="mx-auto text-ink/30 mb-3" />
          <p className="text-sm text-ink/65">No customers yet.</p>
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
          <UserRound size={17} className="text-ink/65" />
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
          <p className="text-xs text-ink/65 mt-0.5 truncate">
            +91 {c.mobile}
            {c.email && <span className="text-ink/65"> · {c.email}</span>}
          </p>
        </button>

        <div className="text-right shrink-0 hidden sm:block">
          <p className="text-sm font-semibold">{formatINR(c.spent)}</p>
          <p className="text-[11px] text-ink/65">
            {c.orders} order{c.orders === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onView}
            className="p-2 rounded-lg text-ink/65 hover:bg-stone/60 hover:text-ink transition"
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
                {data.email && <p className="text-sm text-ink/65 break-all">{data.email}</p>}
                {data.gender && <p className="text-sm text-ink/65 capitalize">{data.gender}</p>}
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
                    <p className="text-[10px] uppercase tracking-wide text-ink/65">{s.label}</p>
                    <p className="font-display text-lg font-bold mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="text-xs text-ink/65 space-y-1">
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
                <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/65 mb-2">
                  Orders ({data.orders.length})
                </h4>
                {data.orders.length === 0 ? (
                  <p className="text-xs text-ink/65">No orders yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.orders.map(o => (
                      <div key={o.order_number} className="flex items-center justify-between gap-2 text-xs border border-ink/10 rounded-lg px-3 py-2">
                        <span className="font-medium">{o.order_number}</span>
                        <span className="flex items-center gap-2">
                          <PaymentChip status={o.payment_status} />
                          <span className="text-ink/65">{shortDate(o.created_at)}</span>
                          <span className="font-semibold">{formatINR(o.total)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {data.addresses.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/65 mb-2">
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
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/65 mb-2">
                    Feedback ({data.feedback.length})
                  </h4>
                  <div className="space-y-1.5">
                    {data.feedback.map(f => (
                      <div key={f.id} className="text-xs border border-ink/10 rounded-lg px-3 py-2">
                        <span className="text-ink/65">{f.category}</span>
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
  const [editing, setEditing] = useState<AdminProduct | null>(null);

  const duplicates = (data ?? []).filter(p => p.duplicate && !p.deleted);

  // The editor is keyed by product id so switching cards remounts the form and
  // its fields always start from the product being edited.
  const onSaved = useCallback(() => { reload(); setEditing(null); }, [reload]);

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
        {data?.map(p => (
          <ProductCard
            key={p.id}
            product={p}
            onSaved={reload}
            onAuthFail={onAuthFail}
            onEdit={() => setEditing(p)}
          />
        ))}
      </div>

      <AnimatePresence>
        {editing && (
          <ProductEditor
            key={editing.id}
            product={editing}
            onClose={() => setEditing(null)}
            onSaved={onSaved}
            onAuthFail={onAuthFail}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductCard({ product, onSaved, onAuthFail, onEdit }: {
  product: AdminProduct; onSaved: () => void; onAuthFail: () => void; onEdit: () => void;
}) {
  const [price, setPrice] = useState(String(product.price));
  const [mrp, setMrp] = useState(String(product.mrp));
  // Per-size stock now lives inside each colour (colors[].sizes). The legacy
  // `stock` column is carried through on save unchanged, but there is nothing
  // to edit on this card — the old state object had a setter nobody called.
  const stock = product.stock;
  const [active, setActive] = useState(product.is_active);
  const [colors, setColors] = useState<ProductColor[]>(() => normalizeProductColors(product.colors));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Dashboard products always carry their own image; fall back to the first
  // entry of the gallery so a product uploaded without a primary still renders.
  const image = product.image_url ?? product.images?.[0] ?? null;
  const gallery = (product.images?.length ? product.images : image ? [image] : []).filter(Boolean);
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
    colors.map(c => `${c.name.trim()}|${c.hex}`).join(',') !==
      normalizeProductColors(product.colors).map(c => `${c.name.trim()}|${c.hex}`).join(',');

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
        colors: colors.filter(c => c.name.trim()),
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
      {/* Every uploaded photo is previewed here, not just the thumbnail, so the
          operator can see at a glance that the gallery actually saved. */}
      <div className="flex gap-3 p-3 border-b border-ink/10">
        <div className="relative w-16 h-20 rounded-lg bg-stone/40 overflow-hidden shrink-0">
          {image && <img src={image} alt={product.name} className="w-full h-full object-cover object-top" loading="lazy" />}
          {gallery.length > 1 && (
            <span className="absolute bottom-1 right-1 text-[9px] font-medium bg-ink/85 text-ivory rounded-full px-1.5 py-0.5 leading-none">
              {gallery.length}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-tight min-w-0">{product.name}</p>
            <button
              type="button"
              onClick={onEdit}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-full border border-ink/15 hover:bg-ink hover:text-ivory transition"
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-stone text-ink/60">
              {product.stock_total} in stock
            </span>
            <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-stone text-ink/60">
              sells at {formatINR(product.price)}
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

      {gallery.length > 1 && (
        <div className="px-3 pt-3 flex gap-1.5 overflow-x-auto no-scrollbar">
          {gallery.map((src, i) => (
            <span key={`${src}-${i}`} className="relative shrink-0">
              <img
                src={src}
                alt={`${product.name} photo ${i + 1}`}
                loading="lazy"
                className={`w-10 h-12 rounded object-cover object-top border ${i === 0 ? 'border-ink' : 'border-ink/10'}`}
              />
              {i === 0 && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-wide bg-ink text-ivory rounded-full px-1 leading-tight">
                  main
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="p-3 space-y-3 flex-1">
        {/*
          A live readout of what the card is currently showing, so the operator
          can see the effect of a price edit without leaving the dashboard.
          MRP below the selling price is a common slip, so it is called out
          rather than silently rendering a negative discount.
        */}
        <div className="rounded-lg bg-stone/40 px-3 py-2 text-[11px] text-ink/60 flex items-center justify-between gap-2">
          <span>
            Customer pays <strong className="text-ink">{formatINR(Number(price) || 0)}</strong>
            {Number(mrp) > Number(price) && (
              <>
                {' '}&middot; MRP <span className="line-through">{formatINR(Number(mrp) || 0)}</span>{' '}
                <strong className="text-green-700">
                  {Math.round(((Number(mrp) - Number(price)) / Number(mrp)) * 100)}% off
                </strong>
              </>
            )}
          </span>
          {Number(mrp) > 0 && Number(mrp) < Number(price) && (
            <span className="text-red-600 font-medium">MRP is below the selling price</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] text-ink/65">Selling price (₹)</span>
            <input
              type="number" min={0} value={price}
              onChange={e => setPrice(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-2.5 py-2 text-sm focus:outline-none focus:border-ink"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-ink/65">MRP (₹)</span>
            <input
              type="number" min={0} value={mrp}
              onChange={e => setMrp(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-2.5 py-2 text-sm focus:outline-none focus:border-ink"
            />
          </label>
        </div>


        {product.source === 'runtime' && (
          <div>
            <span className="text-[11px] text-ink/65">Colours — name + swatch</span>
            <div className="mt-1.5">
              <ColorRows rows={colors} onChange={setColors} compact />
            </div>
            <span className="mt-1 block text-[10px] text-ink/65 leading-relaxed">
              These paint the card swatches and the shop's colour filter.
            </span>
          </div>
        )}

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
            <p className="text-[10px] text-ink/65 text-center">
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
  const [clearing, setClearing] = useState(false);
  const [clearErr, setClearErr] = useState<string | null>(null);

  const setStatus = async (id: string, status: 'new' | 'read' | 'resolved') => {
    try {
      await setFeedbackStatus(id, status);
      await reload();
    } catch (err) {
      if (err instanceof AdminAuthError) { onAuthFail(); return; }
    }
  };

  const removeFeedback = async (f: AdminFeedback) => {
    if (!confirm('Delete this feedback? This cannot be undone.')) return;
    try {
      await deleteFeedback(f.id);
      await reload();
    } catch (err) {
      if (err instanceof AdminAuthError) { onAuthFail(); return; }
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const doClear = async () => {
    const label = filter === 'all' ? 'all feedback' : `all ${filter} feedback`;
    if (!confirm(`Clear ${label}? This cannot be undone.`)) return;
    setClearing(true); setClearErr(null);
    try {
      await clearFeedback(filter);
      await reload();
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthFail(); return; }
      setClearErr(e instanceof Error ? e.message : 'Failed to clear');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div>
      <SectionHead title="Customer feedback" subtitle="Everything sent from the store's feedback button" onRefresh={reload} loading={loading} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
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
        <button type="button" disabled={clearing} onClick={doClear} className="px-3 py-1.5 rounded-full text-xs border border-ink/15 hover:bg-stone/40 disabled:opacity-40">Clear {filter === 'all' ? 'all' : filter}</button>
        {clearErr && <span className="text-[11px] text-red-600">{clearErr}</span>}
      </div>

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data && <Centered><Loader2 className="animate-spin" /></Centered>}

      {data && data.length === 0 && (
        <div className="rounded-xl border border-ink/10 bg-ivory p-12 text-center">
          <MessageSquare size={26} className="mx-auto text-ink/30 mb-3" />
          <p className="text-sm text-ink/65">No feedback here yet.</p>
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
                  <span className="text-[11px] text-ink/65">No rating</span>
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
              <button type="button" onClick={() => removeFeedback(f)} className="p-1.5 rounded-full text-ink/65 hover:text-red-600 hover:bg-red-50 transition" title="Delete feedback">
                <Trash2 size={13} />
              </button>
              <button type="button" onClick={() => removeFeedback(f)} className="p-1.5 rounded-full text-ink/65 hover:text-red-600 hover:bg-red-50 transition" title="Delete feedback">
                <Trash2 size={13} />
              </button>
              <span className="text-[11px] text-ink/65 shrink-0">{shortDate(f.created_at)}</span>
            </div>

            <p className="text-sm text-ink/85 whitespace-pre-wrap">{f.message}</p>

            <div className="flex items-center justify-between gap-4 mt-3 flex-wrap">
              <p className="text-[11px] text-ink/65">
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

function SettingsSection({ onAuthFail }: { onAuthFail: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Store settings: shipping figures the storefront reads from the database.
  const [fee, setFee] = useState('');
  const [threshold, setThreshold] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [shopState, setShopState] = useState<'idle' | 'loading' | 'saving' | 'done'>('idle');
  const [shopError, setShopError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setShopState('loading');
    try {
      const { settings } = await getSettings();
      setFee(String(settings.shipping_fee));
      setThreshold(String(settings.free_shipping_threshold));
      setAnnouncement(settings.announcement ?? '');
      setLastSaved(settings.updated_at ?? null);
      setShopError(null);
    } catch (err) {
      // An expired session should drop straight back to the login screen rather
      // than leaving a form that silently fails to save.
      if (err instanceof AdminAuthError) { onAuthFail(); return; }
      setShopError(err instanceof Error ? err.message : 'Could not load store settings.');
    } finally {
      setShopState('idle');
    }
  }, [onAuthFail]);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  const submitSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setShopError(null);

    const feeNum = Number(fee);
    const thresholdNum = Number(threshold);

    if (!Number.isInteger(feeNum) || feeNum < 0) {
      setShopError('Shipping fee must be a whole number of rupees, zero or more.'); return;
    }
    if (!Number.isInteger(thresholdNum) || thresholdNum < 0) {
      setShopError('Free-shipping threshold must be a whole number of rupees, zero or more.'); return;
    }
    // The announcement is optional: blank means the bar derives the
    // free-shipping line from the threshold, so it can never contradict it.

    setShopState('saving');
    try {
      const { settings } = await saveSettings({
        shipping_fee: feeNum,
        free_shipping_threshold: thresholdNum,
        announcement: announcement.trim() || null,
      });
      // Keep the running storefront in step so the admin preview is honest.
      setStoreSettings({
        shippingFee: settings.shipping_fee,
        freeShippingThreshold: settings.free_shipping_threshold,
        announcement: settings.announcement ?? '',
      });
      setLastSaved(settings.updated_at ?? new Date().toISOString());
      setShopState('done');
      setTimeout(() => setShopState('idle'), 2400);
    } catch (err) {
      if (err instanceof AdminAuthError) { onAuthFail(); return; }
      setShopError(err instanceof Error ? err.message : 'Could not save store settings.');
      setShopState('idle');
    }
  };

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
      <SectionHead title="Settings" subtitle="Shipping, announcements and your operator account" />

      <div className="max-w-2xl space-y-6">
        {/* ── Store settings ─────────────────────────────────────────── */}
        <form onSubmit={submitSettings}
          className="rounded-xl border border-ink/10 bg-ivory p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Truck size={16} /> Shipping &amp; announcements
          </div>
          <p className="text-xs text-ink/65">
            These drive the announcement bar, cart, checkout, product page and shipping policy.
            Nothing about shipping is hardcoded, so the storefront cannot quote a
            different figure from the one you set here.
          </p>

          {shopError && <p className="text-xs text-red-600" role="alert">{shopError}</p>}
          {shopState === 'done' && (
            <p className="text-xs text-ink bg-lime px-3 py-2 rounded-lg">Store settings saved.</p>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-ink/60">Flat shipping fee (₹)</span>
              <input type="number" min={0} step={1} inputMode="numeric" value={fee}
                onChange={e => setFee(e.target.value)} disabled={shopState === 'loading'}
                className="mt-1.5 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:border-ink disabled:opacity-50" />
              <span className="text-[11px] text-ink/65">Charged when the order is below the threshold.</span>
            </label>
            <label className="block">
              <span className="text-xs text-ink/60">Free shipping over (₹)</span>
              <input type="number" min={0} step={1} inputMode="numeric" value={threshold}
                onChange={e => setThreshold(e.target.value)} disabled={shopState === 'loading'}
                className="mt-1.5 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:border-ink disabled:opacity-50" />
              <span className="text-[11px] text-ink/65">Set 0 for free shipping on every order.</span>
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-ink/60">Announcement line (optional)</span>
            <input type="text" maxLength={200} value={announcement}
              onChange={e => setAnnouncement(e.target.value)} placeholder="Leave blank to show the free-shipping line"
              className="mt-1.5 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:border-ink" />
            <span className="text-[11px] text-ink/65">
              Rotates in the top bar. Leave it blank and the bar shows
              {' '}<em>Free shipping over {formatINR(Number(threshold) || 0)}</em> automatically, which
              keeps up with the threshold above.
            </span>
          </label>

          <button type="submit" disabled={shopState === 'saving' || shopState === 'loading'}
            className="w-full py-3 rounded-full bg-ink text-ivory text-sm font-semibold hover:bg-ink/80 transition disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {shopState === 'saving' && <Loader2 size={16} className="animate-spin" />}
            Save store settings
          </button>

          {lastSaved && (
            <p className="text-[11px] text-ink/65 text-center">
              Last saved {new Date(lastSaved).toLocaleString('en-IN')}
            </p>
          )}
        </form>

        {/* ── Account ────────────────────────────────────────────────── */}
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
            <span className="text-[11px] text-ink/65">At least 10 characters, with a letter and a number.</span>
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
// Colour picker rows — shared by Add product and the product editor
// ════════════════════════════════════════════════════════════════════════════

/**
 * Name + swatch rows. The hex recorded here is what renders on the card, the
 * product page selector and the shop's colour filter — a comma-separated list
 * of names could not carry it, which is why every swatch used to come out the
 * same colour no matter what was typed.
 */
function ColorRows({ rows, onChange, compact = false }: {
  rows: ProductColor[];
  onChange: (rows: ProductColor[]) => void;
  compact?: boolean;
}) {
  const set = (i: number, patch: Partial<ProductColor>) =>
    onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const setSize = (i: number, size: string, val: string) => {
    const num = val === '' ? '' : Math.max(0, Math.min(100000, Math.round(Number(val) || 0)));
    const current = rows[i].sizes ?? {};
    const next = { ...current, [size]: typeof num === 'number' ? num : 0 };
    if (val === '') {
      const copy = { ...current };
      delete copy[size];
      set(i, { sizes: Object.keys(copy).length ? copy : undefined });
      return;
    }
    set(i, { sizes: next });
  };

  const colorTotal = (r: ProductColor) => {
    if (!r.sizes) return null;
    const sum = SIZES.reduce((acc, s) => acc + Number(r.sizes?.[s] ?? 0), 0);
    const extra = Object.entries(r.sizes).filter(([k]) => !SIZES.includes(k)).reduce((acc, [, v]) => acc + Number(v || 0), 0);
    return sum + extra;
  };

  /**
   * Typing a colour name is enough. The moment the name matches a colour in the
   * shared table, the swatch snaps to that colour — so "Red" paints red on the
   * card, in the shop filter and on the product page without anyone opening the
   * picker. A name the table does not know (a colour the operator invented)
   * keeps whatever they pick, so nothing is silently repainted.
   */
  const onName = (i: number, name: string) => {
    const auto = hexForColorName(name);
    set(i, auto ? { name, hex: auto } : { name });
  };

  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const total = colorTotal(row);
        return (
          <div key={i} className="flex items-center gap-1.5 flex-wrap rounded-lg border border-ink/10 px-2 py-1.5">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(row.hex) ? row.hex : '#171717'}
              onChange={e => set(i, { hex: e.target.value })}
              aria-label={`Colour ${i + 1} swatch`}
              className={`${compact ? 'w-7 h-7' : 'w-8 h-8'} shrink-0 rounded-md border border-ink/15 bg-transparent p-0.5 cursor-pointer`}
            />
            <div className="flex flex-col min-w-[90px] max-w-[110px]">
              <input
                value={row.name}
                onChange={e => onName(i, e.target.value)}
                placeholder="Colour name"
                maxLength={40}
                aria-label={`Colour ${i + 1} name`}
                className="w-full rounded-lg border border-ink/15 px-2 py-1 text-xs focus:outline-none focus:border-ink"
              />
              <span className="font-mono text-[9px] text-ink/65 hidden sm:inline">{row.hex}</span>
            </div>

            {/* Per-colour stock inputs to the right of the colour label */}
            <div className="flex items-center gap-1 flex-wrap ml-2">
              {SIZES.map(s => (
                <label key={s} className="flex items-center gap-0.5">
                  <span className="text-[9px] text-ink/65 uppercase">{s}</span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={row.sizes?.[s] ?? ''}
                    onChange={e => setSize(i, s, e.target.value)}
                    placeholder="0"
                    className="w-9 h-7 rounded border border-ink/10 text-center text-[11px] focus:outline-none focus:border-ink"
                  />
                </label>
              ))}
            </div>

            {total !== null && (
              <span className="text-[10px] text-ink/65 whitespace-nowrap ml-1" title="Total stock for this colour">Count: {total}</span>
            )}

            <button
              type="button"
              onClick={() => onChange(rows.filter((_, k) => k !== i))}
              aria-label={`Remove colour ${row.name || i + 1}`}
              className="shrink-0 w-6 h-6 rounded-full border border-ink/10 text-ink/65 hover:text-red-600 hover:border-red-200 transition grid place-items-center ml-auto"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...rows, { name: '', hex: '#171717' }])}
        className="text-[11px] font-medium text-ink/60 hover:text-ink border border-dashed border-ink/20 hover:border-ink/40 rounded-lg px-3 py-1.5 transition"
      >
        + Add colour
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Image gallery (shared by the add form and the product editor)
// ════════════════════════════════════════════════════════════════════════════

interface GalleryImage { url: string; name: string }

/**
 * Upload + arrange product photos.
 *
 * Photos are compressed in the browser first (imagePrep), so a phone snapshot
 * uploads in about a second and the storefront serves a card-sized file rather
 * than the original. The first thumb is the card image, the second is the hover
 * image — both are labelled, and the order can be changed without re-uploading.
 *
 * When a photo is added the garment's colour is read straight off it and handed
 * to `onDetectedColor`, so the colour box names the colour the operator just
 * photographed — no typing, no picker.
 */
function GalleryField({ images, onChange, max = 10, onDetectedColor }: {
  images: GalleryImage[];
  onChange: (next: GalleryImage[]) => void;
  max?: number;
  onDetectedColor?: (name: string, hex: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [detected, setDetected] = useState<string | null>(null);

  const move = (from: number, delta: number) => {
    const to = from + delta;
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  /**
   * What the operator is told after a batch — every time, never nothing.
   *
   * The old message was gated on `before > after`, so an already-optimised
   * photo, or a format the browser cannot re-encode (a RAW, an SVG — both of
   * which go up byte for byte), finished with no confirmation at all. Silence
   * read exactly like "it did not compress", which is what was reported.
   */
  const describe = (n: number, before: number, after: number) => {
    const kb = (v: number) => `${Math.max(1, Math.round(v / 1024))} KB`;
    const many = n > 1 ? 's' : '';
    if (before > after) {
      const pct = Math.max(1, Math.round(((before - after) / before) * 100));
      return `Compressed ${n} photo${many}: ${kb(before)} → ${kb(after)} (${pct}% smaller). The card now loads much faster.`;
    }
    if (before === after) {
      return `Photo${many} added at ${kb(after)} — already web-ready, so nothing needed shrinking. Formats the browser cannot re-encode are uploaded unchanged.`;
    }
    return `${n} photo${many} added at ${kb(after)}.`;
  };

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null);
    setSaved(null);
    setDetected(null);
    const room = Math.max(0, max - images.length);
    const picked = Array.from(files).slice(0, room);
    if (!picked.length) {
      if (files.length > room) setErr(`Only ${max} photos per product — none were added.`);
      return;
    }
    if (files.length > room) {
      setErr(`Only ${max} photos per product — the first ${room} were taken.`);
    }
    setUploading(true);
    setProgress({ done: 0, total: picked.length, label: 'Compressing' });
    try {
      // Compress EVERY file first, in parallel. Decoding is the slow part and
      // it is all local work, so four photos cost barely more than one — the
      // old code did this one at a time, interleaved with a network round trip
      // per photo, which is what made the picker feel like it never finished.
      const prepared = await Promise.all(picked.map(f => prepareImage(f)));

      // Then upload them together. One slow photo no longer holds the rest up.
      let done = 0;
      setProgress({ done, total: prepared.length, label: 'Uploading' });
      const results = await Promise.all(
        prepared.map(async (p) => {
          const res = await uploadProductImage(p.filename, p.contentType, p.data);
          done += 1;
          setProgress({ done, total: prepared.length, label: 'Uploading' });
          return { p, res };
        }),
      );

      const totalBefore = prepared.reduce((s, p) => s + p.originalBytes, 0);
      const totalAfter = prepared.reduce((s, p) => s + p.bytes, 0);

      onChange(
        [...images, ...results.map(r => ({ url: r.res.url, name: r.p.filename }))].slice(0, max),
      );

      // Say what happened BEFORE anything else can get in the way.
      setSaved(describe(picked.length, totalBefore, totalAfter));

      // Colour sampling re-downloads the photo, so it runs last: it must never
      // delay the confirmation, and only the first photo is ever tried — the
      // old `!detected` check meant a photo that sampled inconclusively was
      // re-fetched and re-sampled for EVERY remaining image in the batch.
      if (onDetectedColor && results[0]) {
        const hit = await detectColorFromImage(results[0].res.url);
        if (hit && hit.confidence >= 0.4) {
          const label = hit.name.charAt(0).toUpperCase() + hit.name.slice(1);
          onDetectedColor(label, hit.hex);
          setDetected(`${label} detected from the photo — adjust it if that is not right.`);
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink/65">
          Photos — up to {max}. Compressed in your browser before upload, so pages stay fast.
        </span>
        <span className="text-[11px] text-ink/65 shrink-0">{images.length}/{max}</span>
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {images.map((img, i) => (
            <div key={`${img.url}-${i}`} className="relative group">
              <img src={img.url} alt={img.name}
                className={`w-20 h-24 object-cover object-top rounded-lg border bg-stone/40 ${i === 0 ? 'border-ink' : 'border-ink/10'}`} />
              <span className="absolute bottom-1 left-1 text-[8px] uppercase tracking-wide bg-ink/85 text-ivory rounded-full px-1.5 py-0.5 leading-none">
                {i === 0 ? 'main' : i === 1 ? 'hover' : `#${i + 1}`}
              </span>
              <button
                type="button"
                onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white grid place-items-center"
                aria-label={`Remove ${img.name}`}
              >
                <X size={12} />
              </button>
              <div className="absolute bottom-1 right-1 flex gap-0.5">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move earlier"
                  className="w-4.5 h-5 px-1 rounded bg-ivory/90 text-ink/70 border border-ink/10 disabled:opacity-30 grid place-items-center"
                >
                  <ArrowUp size={9} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === images.length - 1}
                  aria-label="Move later"
                  className="w-4.5 h-5 px-1 rounded bg-ivory/90 text-ink/70 border border-ink/10 disabled:opacity-30 grid place-items-center"
                >
                  <ArrowDown size={9} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <label className={`mt-2 flex items-center justify-center gap-2 py-6 px-4 rounded-xl border border-dashed cursor-pointer transition ${
        uploading ? 'border-ink/30 bg-stone/30' : 'border-ink/20 hover:border-ink/40'
      }`}>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={uploading || images.length >= max}
          className="sr-only"
          onChange={e => { void onPick(e.target.files); e.target.value = ''; }}
        />
        {uploading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {progress ? `${progress.label} ${progress.done} of ${progress.total}…` : 'Working…'}
          </>
        ) : images.length >= max ? (
          <><Check size={16} /> {max} photos added</>
        ) : (
          <><ImagePlus size={16} /> Add photos — pick several at once, or drag them here</>
        )}
      </label>

      {saved && <p className="text-[11px] text-green-700 mt-1.5">{saved}</p>}
      {detected && <p className="text-[11px] text-ink/60 mt-1.5">{detected}</p>}
      {err && <p className="text-[11px] text-red-600 mt-1.5">{err}</p>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Product editor — opened by the Edit button on any product card
// ════════════════════════════════════════════════════════════════════════════

/**
 * The full card, editable.
 *
 * The quick fields on the card itself stay for the everyday price/stock tweak;
 * this panel is where the rest of the product actually lives — name, photos,
 * collection, description, care, colours and the storefront flags. Nothing here
 * invents a default: an emptied field is saved empty.
 */
function ProductEditor({ product, onClose, onSaved, onAuthFail }: {
  product: AdminProduct;
  onClose: () => void;
  onSaved: () => void;
  onAuthFail: () => void;
}) {
  const { content } = useSiteContent();
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [mrp, setMrp] = useState(String(product.mrp));
  const [category, setCategory] = useState(product.category ?? 'new-arrivals');
  const [colors, setColors] = useState<ProductColor[]>(() => normalizeProductColors(product.colors));
  const [images, setImages] = useState<GalleryImage[]>(() =>
    (product.images ?? []).map((url, i) => ({ url, name: `photo-${i + 1}` })),
  );
  const [fit, setFit] = useState(product.fit ?? '');
  const [fabric, setFabric] = useState(product.fabric ?? '');
  const [badge, setBadge] = useState(product.badge ?? '');
  const [description, setDescription] = useState(product.description ?? '');
  const [care, setCare] = useState(product.care ?? '');
  const [bestseller, setBestseller] = useState(Boolean(product.bestseller));
  const [newArrival, setNewArrival] = useState(Boolean(product.new_arrival));
  const [active, setActive] = useState(product.is_active);
  // Read-only legacy column; real stock is edited per colour below.
  const [stock] = useState<Record<string, string>>(
    () => Object.fromEntries(Object.entries(product.stock).map(([k, v]) => [k, String(v)])),
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const input = 'w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:border-ink';

  // Escape closes the panel — expected of any full-screen editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    setErr(null);
    if (!name.trim()) { setErr('A product needs a name.'); return; }
    setSaving(true);
    try {
      await updateProduct({
        productId: product.id,
        name: name.trim(),
        price: Number(price) || 0,
        mrp: Number(mrp) || Number(price) || 0,
        category: category.trim() || 'new-arrivals',
        colors: colors.filter(c => c.name.trim()),
        images: images.map(i => i.url),
        fit: fit.trim(),
        fabric: fabric.trim(),
        badge: badge.trim(),
        description: description.trim(),
        care: care.trim(),
        bestseller,
        new_arrival: newArrival,
        is_active: active,
        stock: Object.fromEntries(Object.entries(stock).map(([k, v]) => [k, Number(v) || 0])),
      });
      onSaved();
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthFail(); return; }
      setErr(e instanceof Error ? e.message : 'Could not save this product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
        transition={{ duration: 0.25, ease: EASE }}
        onClick={e => e.stopPropagation()}
        className="bg-ivory w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
      >
        <div className="sticky top-0 z-10 bg-ivory/95 backdrop-blur border-b border-ink/10 px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Edit “{product.name}”</p>
            {/* product id hidden per request */}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="shrink-0 w-9 h-9 rounded-full border border-ink/15 grid place-items-center hover:bg-stone/50 transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2">
              <span className="text-[11px] text-ink/65">Product name</span>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={120}
                className={`mt-1 ${input}`} />
            </label>

            <label className="block">
              <span className="text-[11px] text-ink/65">Selling price (₹)</span>
              <input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)}
                className={`mt-1 ${input}`} />
            </label>

            <label className="block">
              <span className="text-[11px] text-ink/65">MRP (₹)</span>
              <input type="number" min={0} value={mrp} onChange={e => setMrp(e.target.value)}
                className={`mt-1 ${input}`} />
            </label>

            <div className="sm:col-span-2">
              <ComboField
                label="Collection"
                value={category}
                onChange={setCategory}
                suggestions={[
                  ...content.categories.map(c => c.slug),
                  ...BUILTIN_COLLECTIONS.filter(s => !content.categories.some(c => c.slug === s)),
                ]}
                placeholder="oversized"
                maxLength={40}
                hint="The shop page this product appears under. Changing it moves the card."
              />
            </div>

            <ComboField
              label="Fit"
              value={fit}
              onChange={setFit}
              suggestions={SUGGESTED_FITS}
              placeholder="Oversized"
              maxLength={40}
              hint="Leave blank and the card shows nothing."
            />

            <ComboField
              label="Fabric"
              value={fabric}
              onChange={setFabric}
              suggestions={SUGGESTED_FABRICS}
              placeholder="Heavyweight Cotton"
              maxLength={40}
              hint="Leave blank and the card shows nothing."
            />

            <ComboField
              label="Badge (corner pill)"
              value={badge}
              onChange={setBadge}
              suggestions={SUGGESTED_BADGES}
              placeholder="Bestseller"
              maxLength={24}
              hint="Leave blank for no pill."
            />

            <label className="block sm:col-span-2">
              <span className="text-[11px] text-ink/65">Description</span>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                className={`mt-1 ${input} resize-y`} />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-[11px] text-ink/65">Care instructions</span>
              <input value={care} onChange={e => setCare(e.target.value)}
                className={`mt-1 ${input}`} />
            </label>
          </div>

          <div className="block">
            <span className="text-[11px] text-ink/65">Colours — name + swatch</span>
            <div className="mt-1.5">
              <ColorRows rows={colors} onChange={setColors} />
            </div>
            <span className="mt-1.5 block text-[10px] text-ink/65 leading-relaxed">
              Type a colour name and its swatch fills in automatically — “Red” turns red on the
              card, the shop filter and the product page.
            </span>
          </div>

          <GalleryField
            images={images}
            onChange={setImages}
            onDetectedColor={(name, hex) => setColors(prev => (prev.some(c => c.name.trim()) ? prev : [{ name, hex }]))}
          />


          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs text-ink/70">
              <input type="checkbox" checked={bestseller} onChange={e => setBestseller(e.target.checked)} className="w-4 h-4 accent-ink" />
              Show in Bestsellers
            </label>
            <label className="flex items-center gap-2 text-xs text-ink/70">
              <input type="checkbox" checked={newArrival} onChange={e => setNewArrival(e.target.checked)} className="w-4 h-4 accent-ink" />
              Show in New Drops
            </label>
            <label className="flex items-center gap-2 text-xs text-ink/70">
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="w-4 h-4 accent-ink" />
              Available for purchase
            </label>
          </div>
        </div>

        <div className="border-t border-ink/10 px-5 py-4 flex items-center gap-3 bg-ivory">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-full text-sm font-medium border border-ink/15 hover:bg-stone/50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-ink text-ivory text-sm font-semibold hover:bg-ink/80 transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Add product
// ════════════════════════════════════════════════════════════════════════════

function AddProductForm({ onCreated, onAuthFail }: { onCreated: () => void; onAuthFail: () => void }) {
  const { content } = useSiteContent();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [category, setCategory] = useState('new-arrivals');
  const [colors, setColors] = useState<ProductColor[]>([]);
  const [fit, setFit] = useState('');
  const [fabric, setFabric] = useState('');
  const [badge, setBadge] = useState('');
  const [description, setDescription] = useState('');
  const [care, setCare] = useState('');
  const [bestseller, setBestseller] = useState(false);
  const [newArrival, setNewArrival] = useState(true);
  const [stock] = useState<Record<string, string>>(
    () => Object.fromEntries(SIZES.map(s => [s, '10'])),
  );
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setOk(null); setSaving(true);
    try {
      const res = await createProduct({
        name: name.trim(),
        price: Number(price),
        mrp: mrp ? Number(mrp) : undefined,
        category,
        colors: colors.filter(c => c.name.trim()),
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
      setName(''); setPrice(''); setMrp(''); setColors([]); setImages([]);
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

      <p className="text-xs text-ink/65">
        Everything on the card is set here. Leave a field blank and it stays blank on the
        storefront — nothing is filled in for you.
      </p>

      {err && <p className="text-xs text-red-600">{err}</p>}
      {ok && <p className="text-xs bg-lime text-ink px-3 py-2 rounded-lg">{ok}</p>}

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-[11px] text-ink/65">Product name</span>
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="Midnight Oversized Tee"
            className={`mt-1 ${input}`} />
        </label>

        <label className="block">
          <span className="text-[11px] text-ink/65">Selling price (₹)</span>
          <input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} required
            className={`mt-1 ${input}`} />
        </label>

        <label className="block">
          <span className="text-[11px] text-ink/65">MRP (₹)</span>
          <input type="number" min={0} value={mrp} onChange={e => setMrp(e.target.value)}
            placeholder="Defaults to the selling price" className={`mt-1 ${input}`} />
        </label>

        {/* What the card will show, before it is saved. */}
        {(() => {
          const p = Number(price) || 0;
          const m = Number(mrp) || p;
          const off = m > p && m > 0 ? Math.round(((m - p) / m) * 100) : 0;
          // Real availability is per colour, per size. This used to sum the
          // legacy `stock` column, which no longer reflects what a customer can
          // buy — the operator saw a number the storefront never used.
          const stockEntries = colors.flatMap(c => Object.entries(c.sizes ?? {}));
          const totalStock = stockEntries.reduce((s, [, v]) => s + (Number(v) || 0), 0);
          const stockedSizes = new Set(stockEntries.filter(([, v]) => Number(v) > 0).map(([k]) => k));
          return (
            <div className="sm:col-span-2 rounded-lg bg-stone/40 px-3 py-2 text-[11px] text-ink/60 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Card will show <strong className="text-ink">{formatINR(p)}</strong></span>
              {off > 0 && (
                <>
                  <span>MRP <span className="line-through">{formatINR(m)}</span></span>
                  <strong className="text-green-700">{off}% off</strong>
                </>
              )}
              <span className="text-ink/65">|</span>
              <span>{totalStock} units in stock across {stockedSizes.size} sizes</span>
              {m > 0 && m < p && (
                <strong className="text-red-600">MRP is below the selling price</strong>
              )}
            </div>
          );
        })()}

        <div className="sm:col-span-2">
          <ComboField
            label="Collection"
            value={category}
            onChange={setCategory}
            suggestions={[
              ...content.categories.map(c => c.slug),
              ...BUILTIN_COLLECTIONS.filter(s => !content.categories.some(c => c.slug === s)),
            ]}
            placeholder="oversized"
            maxLength={40}
            hint="A slug, lower case with dashes. This decides which shop page the product appears under."
          />
        </div>

        <div className="block sm:col-span-2">
          <span className="text-[11px] text-ink/65">
            Colours — name + swatch
          </span>
          <div className="mt-1.5">
            <ColorRows rows={colors} onChange={setColors} />
          </div>
          <span className="mt-1.5 block text-[10px] text-ink/65 leading-relaxed">
            The name shows on the product page; the swatch paints the card, the shop's colour
            filter and the selector on the product page. Leave the list empty and the card
            still renders with a neutral swatch.
          </span>
        </div>

        <ComboField
          label="Fit"
          value={fit}
          onChange={setFit}
          suggestions={SUGGESTED_FITS}
          placeholder="Oversized"
          maxLength={40}
          hint="Leave blank and the card shows nothing."
        />

        <ComboField
          label="Fabric"
          value={fabric}
          onChange={setFabric}
          suggestions={SUGGESTED_FABRICS}
          placeholder="Heavyweight Cotton"
          maxLength={40}
          hint="Leave blank and the card shows nothing."
        />

        <ComboField
          label="Badge (corner pill)"
          value={badge}
          onChange={setBadge}
          suggestions={SUGGESTED_BADGES}
          placeholder="Bestseller"
          maxLength={24}
          hint="Leave blank for no pill."
        />

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
          <span className="text-[11px] text-ink/65">Description</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
            placeholder="What makes this piece worth buying?"
            className={`mt-1 ${input} resize-y`} />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-[11px] text-ink/65">Care instructions</span>
          <input value={care} onChange={e => setCare(e.target.value)}
            placeholder="Machine wash cold, inside out. Do not bleach."
            className={`mt-1 ${input}`} />
        </label>
      </div>

      {/* Images — the first photo also names the colour */}
      <GalleryField
        images={images}
        onChange={setImages}
        onDetectedColor={(name, hex) => setColors(prev => (prev.some(c => c.name.trim()) ? prev : [{ name, hex }]))}
      />


      <button type="submit" disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ink text-ivory text-sm font-semibold hover:bg-ink/80 transition disabled:opacity-50">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Package size={15} />} Create product
      </button>
    </form>
  );
}

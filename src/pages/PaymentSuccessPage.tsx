import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check, X, Loader2, Download, RefreshCw, Clock, ArrowRight, AlertTriangle, ShieldCheck,
  MapPin, PackageCheck,
} from 'lucide-react';
import SEO from '@/components/SEO';
import { EASE } from '@/components/Motion';
import { formatINR } from '@/data/catalog';
import { useStore } from '@/store/StoreContext';
import {
  PaymentServiceUnavailableError, clearOrderReview, demoSettle, findOrderToken, getReceipt,
  getStatus, readOrderReview, takePendingOrder, type OrderItemSummary, type OrderReviewAddress,
  type StatusResult,
} from '@/lib/payments';
import { loadRazorpayCheckout } from '@/lib/razorpayCheckout';
import { downloadReceipt } from '@/lib/receipt';
import { refreshLiveCatalog } from '@/lib/storefrontCatalog';
import { readWhatsAppOrder, confirmWhatsAppOrder } from '@/lib/whatsappOrders';

const POLL_MS = 5000;
const LIVE_ORIGIN = 'https://www.triosworld.in';

/**
 * Razorpay only accepts live payments from the website registered on the
 * account. If the order page is open on a preview/non-approved origin, move
 * the customer to the live site before opening Checkout instead of letting
 * Razorpay reject the payment after the bank step.
 */
function isApprovedPaymentOrigin(): boolean {
  if (window.location.origin === LIVE_ORIGIN) return true;
  return import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Order + payment page (`/order/:orderNumber?token=...`).
 *
 * It opens Razorpay's hosted checkout (or shows a dynamic UPI QR when the
 * account supports one), polls the server for verification, and — once the
 * *server* confirms the payment against the gateway — celebrates and offers the
 * PDF receipt. There is no local path to a "success" state: every render of the
 * paid view is backed by a server response.
 *
 * The receipt token in the URL is the guest's credential, so this page works
 * without an account and survives a refresh.
 */
export default function PaymentSuccessPage() {
  const { orderNumber = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { clearCart } = useStore();

  const token = searchParams.get('token') ?? findOrderToken(orderNumber) ?? '';

  const [result, setResult] = useState<StatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceDown, setServiceDown] = useState(false);
  const [checking, setChecking] = useState(false);
  const [settling, setSettling] = useState(false);
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  /** Bumped when the customer confirms a WhatsApp order, to re-read it. */
  const [confirmedTick, setConfirmedTick] = useState(0);
  /**
   * The order picture only lives for 48 hours. Once the cleanup has taken it,
   * the URL answers 404 — so instead of a broken image the customer gets told
   * what happened and where their order stands.
   */
  const [imageGone, setImageGone] = useState(false);

  const clearedRef = useRef(false);

  const refresh = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!token) {
      setLoading(false);
      setError('We could not find this order. Open the link from your order confirmation, or contact support.');
      return;
    }
    if (!opts.silent) setChecking(true);
    try {
      const next = await getStatus(orderNumber, token);
      setResult(next);
      setError(null);
      setServiceDown(false);
    } catch (err) {
      if (err instanceof PaymentServiceUnavailableError) {
        setServiceDown(true);
      } else if (!opts.silent) {
        setError(err instanceof Error ? err.message : 'Could not check the payment.');
      }
    } finally {
      setChecking(false);
      setLoading(false);
    }
  }, [orderNumber, token]);

  // Initial check + auto-poll while the payment is still pending.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // A new order starts with a fresh picture — the "gone" flag belongs to the
  // previous reference only.
  useEffect(() => {
    setImageGone(false);
  }, [orderNumber]);

  const isPending = result?.payment_status === 'pending';

  useEffect(() => {
    if (!isPending) return;
    const id = setInterval(() => { void refresh({ silent: true }); }, POLL_MS);
    return () => clearInterval(id);
  }, [isPending, refresh]);

  // Countdown to the end of the payment window.
  const expiresAt = result?.payment?.expires_at ?? null;
  useEffect(() => {
    if (!expiresAt || !isPending) return;
    const tick = () => setRemaining(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, isPending]);

  // Empty the bag only once the payment is confirmed paid (never on abandon).
  useEffect(() => {
    if (result?.payment_status !== 'paid' || clearedRef.current) return;
    clearedRef.current = true;
    if (takePendingOrder() === orderNumber) clearCart();
    clearOrderReview(orderNumber);
  }, [result?.payment_status, orderNumber, clearCart]);

  // Stock was decremented server-side when the payment was captured. Refresh
  // the catalogue so an SPA session immediately hides the colour/photo that
  // has just sold out instead of waiting for a hard reload.
  useEffect(() => {
    if (result?.payment_status !== 'paid') return;
    void refreshLiveCatalog();
  }, [result?.payment_status]);

  const handleDemoSettle = async () => {
    if (!token) return;
    setSettling(true);
    try {
      await demoSettle(orderNumber, token);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete the demo payment.');
    } finally {
      setSettling(false);
    }
  };

  const handleCheckout = async () => {
    const livePayment = result?.payment;
    const liveOrder = result?.order;
    if (!livePayment?.razorpay_order_id || !livePayment.razorpay_key_id || !liveOrder) {
      setError('This payment is not ready yet. Refresh the page and try again.');
      return;
    }

    if (livePayment.mode === 'live' && !isApprovedPaymentOrigin()) {
      window.location.assign(`${LIVE_ORIGIN}${window.location.pathname}${window.location.search}`);
      return;
    }

    setOpeningCheckout(true);
    setError(null);
    try {
      await loadRazorpayCheckout();
      if (!window.Razorpay) throw new Error('The secure payment window could not be loaded.');

      const checkout = new window.Razorpay({
        key: livePayment.razorpay_key_id,
        amount: Math.round(liveOrder.total * 100),
        currency: 'INR',
        name: 'TriosWorld',
        description: `Order ${liveOrder.order_number}`,
        order_id: livePayment.razorpay_order_id,
        notes: { order_number: liveOrder.order_number },
        theme: { color: '#171717' },
        handler: () => {
          setOpeningCheckout(false);
          void refresh();
        },
        modal: {
          ondismiss: () => setOpeningCheckout(false),
        },
      });

      checkout.on('payment.failed', response => {
        setOpeningCheckout(false);
        setError(response.error?.description ?? 'The payment did not go through. You can try again.');
      });

      checkout.open();
    } catch (err) {
      setOpeningCheckout(false);
      setError(err instanceof Error ? err.message : 'Could not open the secure payment window.');
    }
  };

  const handleReceipt = async () => {
    if (!token) return;
    setDownloading(true);
    setReceiptError(null);
    try {
      const payload = await getReceipt(orderNumber, token);
      downloadReceipt(payload);
    } catch (err) {
      setReceiptError(err instanceof Error ? err.message : 'Could not generate the receipt.');
    } finally {
      setDownloading(false);
    }
  };

  // -------------------------------------------------------------------------
  // A WhatsApp order: the picture was sent to the store and confirmed here, so
  // there is no server record to poll. The order lives on this device.
  // -------------------------------------------------------------------------
  const localOrder = readWhatsAppOrder(orderNumber);
  if (localOrder) {
    // Re-read the order after the customer confirms it, so the page flips to
    // the confirmed view without a reload.
    const waOrder = confirmedTick ? readWhatsAppOrder(orderNumber) ?? localOrder : localOrder;
    const confirmed = Boolean(waOrder.confirmedAt);
    return (
      <div className="page-container py-12 md:py-16">
        <SEO title={`Order ${waOrder.reference}`} noindex />
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-lime mx-auto flex items-center justify-center mb-5">
              {confirmed ? <Check size={32} strokeWidth={2.5} /> : <ShieldCheck size={30} strokeWidth={2.2} />}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
              {confirmed ? 'Order confirmed' : 'Confirm your order'}
            </h1>
            <p className="text-sm text-ink/60">
              {confirmed ? (
                <>
                  Thank you — your order is confirmed. <strong className="text-ink">Our team will meet you soon</strong>{' '}
                  and message you on WhatsApp with the payment details.
                </>
              ) : (
                <>
                  Please confirm that you have sent the order on WhatsApp. Once you confirm, our team
                  will meet you soon and message you with the payment details.
                </>
              )}
            </p>
            {/* The order picture is kept for 48 hours and then deleted, so the
                customer is told the window up front rather than meeting a dead
                link later. */}
            <p className="mt-3 text-xs text-ink/65">
              For your privacy, the order picture we sent is deleted automatically{' '}
              <strong className="text-ink/60 font-semibold">48 hours</strong> after the order —
              save a copy if you want to keep it.
            </p>
          </div>

          {!confirmed && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => {
                  confirmWhatsAppOrder(waOrder.reference);
                  setConfirmedTick(Date.now());
                }}
                className="w-full py-4 rounded-full bg-[#25d366] text-white font-semibold hover:brightness-95 transition inline-flex items-center justify-center gap-2"
              >
                <Check size={18} /> Yes, I sent the order
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-ink/10 bg-ivory p-6 md:p-7">
            <div className="flex items-center justify-between gap-4 mb-5">
              <h2 className="font-display text-lg font-semibold">Order details</h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-lime text-ink text-[11px] font-bold uppercase tracking-wide">
                <Check size={11} /> Placed
              </span>
            </div>
            <dl className="space-y-3.5 text-sm">
              <Row label="Order ID" value={waOrder.reference} mono />
              <Row label="Order placed" value={formatWhen(waOrder.createdAt)} />
              <Row label="Order method" value="WhatsApp" />
              <Row label="Amount" value={formatINR(waOrder.total)} strong />
            </dl>

            <div className="mt-6 pt-5 border-t border-ink/10">
              <h3 className="text-sm font-semibold mb-3">Items</h3>
              <ul className="space-y-2 text-sm">
                {waOrder.items.map((item, i) => (
                  <li key={`${item.name}-${item.color}-${item.size}-${i}`} className="flex justify-between gap-4">
                    <span className="text-ink/70">
                      {item.name} · {item.color} · {item.size} · Qty {item.qty}
                    </span>
                    <span className="font-medium">{formatINR(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <dl className="space-y-2 text-sm mt-4 pt-4 border-t border-ink/10">
                <Row label="Subtotal" value={formatINR(waOrder.subtotal)} />
                <Row label="Shipping" value={waOrder.shipping === 0 ? 'Free' : formatINR(waOrder.shipping)} />
                <Row label="Total" value={formatINR(waOrder.total)} strong />
              </dl>
            </div>

            {waOrder.imageUrl && (
              <div className="mt-6 pt-5 border-t border-ink/10">
                <h3 className="text-sm font-semibold mb-3">The order we sent you</h3>
                {imageGone ? (
                  /* The 48-hour cleanup has already taken this one. The order
                     details above are kept on this device, so the page still
                     works — only the picture is gone. */
                  <p className="text-xs text-ink/65 bg-stone/30 rounded-xl px-4 py-3">
                    This order picture has passed its 48-hour window and been deleted.
                    Your order details above are safe, and our team already has the order.
                  </p>
                ) : (
                  <>
                    <img
                      src={waOrder.imageUrl}
                      alt={`Order ${waOrder.reference}`}
                      className="w-full max-w-sm rounded-xl border border-ink/10"
                      onError={() => setImageGone(true)}
                    />
                    <a
                      href={waOrder.imageUrl}
                      download={`${waOrder.reference}.png`}
                      className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-ink/60 hover:text-ink transition"
                    >
                      <Download size={14} /> Save the order picture
                    </a>
                  </>
                )}
              </div>
            )}

            <div className="mt-7 pt-6 border-t border-ink/10 flex flex-col sm:flex-row gap-3">
              <Link
                to="/shop/shop-all"
                className="flex-1 text-center px-6 py-3 rounded-full bg-ink text-ivory text-sm font-semibold hover:bg-ink/80 transition"
              >
                Continue shopping
              </Link>
              <Link
                to="/contact"
                className="flex-1 text-center px-6 py-3 rounded-full border border-ink/15 text-sm font-semibold hover:bg-stone/30 transition"
              >
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // The payment service is unreachable — do not imply the order is missing.
  // -------------------------------------------------------------------------
  if (!loading && !result && serviceDown) {
    return (
      <div className="page-container py-20 md:py-28 max-w-lg text-center">
        <SEO title="Order" noindex />
        <div className="w-14 h-14 rounded-full bg-stone mx-auto flex items-center justify-center mb-5">
          <Clock size={26} className="text-ink/65" />
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold mb-3">
          We can’t reach the payment service
        </h1>
        <p className="text-sm text-ink/60 mb-8">
          Your order may still be fine — we just cannot check its status this second. Please try
          again in a moment. Nothing is ever marked paid unless our server confirms it with the bank.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            type="button"
            onClick={() => { setServiceDown(false); void refresh(); }}
            className="px-6 py-3 rounded-full bg-ink text-ivory text-sm font-semibold hover:bg-ink/80 transition inline-flex items-center gap-2"
          >
            <RefreshCw size={16} /> Try again
          </button>
          <Link to="/contact" className="px-6 py-3 rounded-full border border-ink/15 text-sm font-semibold hover:bg-stone/30 transition">
            Contact support
          </Link>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // No token: nothing we can safely show.
  // -------------------------------------------------------------------------
  if (!loading && !result) {
    return (
      <div className="page-container py-20 md:py-28 max-w-lg text-center">
        <SEO title="Order" noindex />
        <div className="w-14 h-14 rounded-full bg-stone mx-auto flex items-center justify-center mb-5">
          <AlertTriangle size={26} className="text-ink/65" />
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold mb-3">We can’t open this order</h1>
        <p className="text-sm text-ink/60 mb-8">{error ?? 'This order link is incomplete.'}</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/shop/shop-all" className="px-6 py-3 rounded-full bg-ink text-ivory text-sm font-semibold hover:bg-ink/80 transition">
            Browse products
          </Link>
          <Link to="/account" className="px-6 py-3 rounded-full border border-ink/15 text-sm font-semibold hover:bg-stone/30 transition">
            My account
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container py-28 text-center">
        <SEO title="Confirming payment" noindex />
        <Loader2 size={32} className="animate-spin mx-auto text-ink/65 mb-4" />
        <p className="text-sm text-ink/65">Confirming your payment with the bank…</p>
      </div>
    );
  }

  const paymentStatus = result!.payment_status;
  const order = result!.order;
  const payment = result!.payment;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  // The server returns the saved lines and address with the order. During a
  // rolling deployment the short-lived checkout snapshot fills any gap.
  const localReview = readOrderReview(order.order_number);
  const reviewItems = (order.items?.length ? order.items : localReview?.items) ?? [];
  const reviewAddress = order.shipping_address ?? localReview?.address ?? null;

  return (
    <div className="page-container py-12 md:py-20">
      <SEO title={paymentStatus === 'paid' ? 'Payment successful' : 'Complete payment'} noindex />

      <div className="max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {/* ==================== PAID ==================== */}
          {paymentStatus === 'paid' && (
            <motion.div
              key="paid"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <div className="text-center mb-10">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
                  className="w-20 h-20 rounded-full bg-lime mx-auto flex items-center justify-center mb-6"
                >
                  <Check size={40} strokeWidth={2.5} />
                </motion.div>
                <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Payment successful</h1>
                <p className="text-sm text-ink/60">
                  Thank you — your order is confirmed and will be dispatched shortly.
                </p>
              </div>

              {payment.demo && (
                <div className="mb-6 p-4 rounded-xl border border-amber-300 bg-amber-50 text-sm text-amber-900">
                  <p className="font-semibold mb-1">Demo payment</p>
                  <p>
                    No payment gateway is configured yet, so this order was settled by the server in
                    demo mode. No money was collected. Add the gateway keys to go live.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-ink/10 bg-ivory p-6 md:p-7">
                <h2 className="font-display text-lg font-semibold mb-5">Order details</h2>
                <dl className="space-y-3.5 text-sm">
                  <Row label="Order ID" value={order.order_number} mono />
                  <Row label="Amount paid" value={formatINR(order.amount_paid ?? order.total)} strong />
                  <Row label="Payment method" value={(order.payment_method || 'UPI').toUpperCase()} />
                  <Row label="Payment date" value={formatWhen(order.paid_at)} />
                  <Row
                    label="Payment status"
                    value={
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-lime text-ink text-[11px] font-bold uppercase tracking-wide">
                        <Check size={11} /> Paid
                      </span>
                    }
                  />
                  {order.payment_id && <Row label="Transaction ref" value={order.payment_id} mono />}
                </dl>

                <div className="mt-7 pt-6 border-t border-ink/10 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleReceipt}
                    disabled={downloading}
                    className="flex-1 py-3.5 rounded-full bg-ink text-ivory text-sm font-semibold hover:bg-ink/80 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {downloading ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
                    Download receipt
                  </button>
                  <Link
                    to="/shop/shop-all"
                    className="flex-1 py-3.5 rounded-full border border-ink/15 text-sm font-semibold hover:bg-stone/30 transition text-center inline-flex items-center justify-center gap-2"
                  >
                    Continue shopping <ArrowRight size={16} />
                  </Link>
                </div>

                {receiptError && (
                  <p className="text-xs text-red-600 mt-3" role="alert">{receiptError}</p>
                )}
                <p className="text-[11px] text-ink/65 mt-4 text-center">
                  A PDF receipt is available right here — no account needed. Keep this page’s link to
                  come back to it later.
                </p>
              </div>
            </motion.div>
          )}

          {/* ==================== PENDING ==================== */}
          {paymentStatus === 'pending' && (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <div className="text-center mb-8">
                <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
                  {payment.mode === 'live' ? 'Complete your payment' : 'Demo payment'}
                </h1>
                <p className="text-sm text-ink/60">
                  Order <span className="font-semibold text-ink">{order.order_number}</span> · Pay{' '}
                  <span className="font-semibold text-ink">{formatINR(order.total)}</span>
                </p>
              </div>

              <OrderReviewPanel items={reviewItems} address={reviewAddress} />

              <div className="rounded-2xl border border-ink/10 bg-ivory p-6 md:p-8">
                <div className="max-w-md mx-auto text-center">
                  <p className="text-xs uppercase tracking-widest text-ink/65 mb-2">Amount to pay</p>
                  <p className="font-display text-4xl font-bold mb-6">{formatINR(order.total)}</p>

                  {payment.mode === 'live' ? (
                    <ul className="text-sm text-ink/60 space-y-2 mb-7 text-left inline-block">
                      <li>1. Tap “Pay securely” below</li>
                      <li>2. Choose UPI or your bank in Razorpay</li>
                      <li>3. This page confirms automatically once the bank responds</li>
                    </ul>
                  ) : (
                    <div className="mb-7 text-left p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <p className="text-xs font-semibold text-amber-900 mb-1">Demo mode</p>
                      <p className="text-xs text-amber-800">
                        No gateway is configured, so no real payment can be taken. Use the button
                        below to settle this order server-side and see the full paid flow.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
                    {payment.mode === 'live' && (
                      <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={openingCheckout}
                        className="px-6 py-3.5 rounded-full bg-ink text-ivory text-sm font-semibold hover:bg-ink/80 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {openingCheckout
                          ? <Loader2 size={16} className="animate-spin" />
                          : <ShieldCheck size={16} />}
                        {openingCheckout ? 'Opening secure payment…' : 'Pay securely'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => refresh()}
                      disabled={checking}
                      className={
                        payment.mode === 'live'
                          ? 'px-5 py-3 rounded-full border border-ink/20 text-sm font-semibold hover:bg-stone/30 transition disabled:opacity-50 inline-flex items-center justify-center gap-2'
                          : 'px-5 py-3 rounded-full bg-ink text-ivory text-sm font-semibold hover:bg-ink/80 transition disabled:opacity-50 inline-flex items-center justify-center gap-2'
                      }
                    >
                      {checking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                      I’ve paid — check now
                    </button>

                    {payment.mode === 'demo' && (
                      <button
                        type="button"
                        onClick={handleDemoSettle}
                        disabled={settling}
                        className="px-5 py-3 rounded-full border border-ink/20 text-sm font-semibold hover:bg-stone/30 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {settling ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                        Complete demo payment
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-ink/10 flex items-center justify-center gap-2 text-xs text-ink/65">
                  <Clock size={14} />
                  {remaining > 0 ? (
                    <span>
                      Payment window closes in{' '}
                      <span className="font-semibold text-ink">{mins}:{String(secs).padStart(2, '0')}</span>
                    </span>
                  ) : (
                    <span>Checking whether the payment window has closed…</span>
                  )}
                </div>

                <p className="text-[11px] text-ink/65 mt-3 text-center">
                  We never mark an order paid from this page. Status is confirmed by our server
                  against the payment gateway (or a signed webhook).
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-600 mt-4 text-center" role="alert">{error}</p>
              )}
            </motion.div>
          )}

          {/* ==================== FAILED / EXPIRED ==================== */}
          {(paymentStatus === 'failed' || paymentStatus === 'expired') && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-full bg-stone mx-auto flex items-center justify-center mb-6">
                {paymentStatus === 'failed'
                  ? <X size={30} className="text-red-500" />
                  : <Clock size={28} className="text-ink/65" />}
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">
                {paymentStatus === 'failed' ? 'Payment didn’t go through' : 'Payment window closed'}
              </h1>
              <p className="text-sm text-ink/60 max-w-md mx-auto mb-2">
                {paymentStatus === 'failed'
                  ? 'We have not captured this payment. If your bank or UPI app shows a debit, Razorpay reverses it automatically within 7 working days.'
                  : 'This order expired before the payment was completed. No money has been taken.'}
              </p>
              {paymentStatus === 'failed' && result?.payment?.failure_reason?.toLowerCase().includes('website') && (
                <p className="text-xs text-ink/65 max-w-md mx-auto mb-2">
                  Razorpay blocked this attempt because it was not started from the approved live site.
                  Open <strong className="text-ink/70">https://www.triosworld.in</strong> and try again.
                </p>
              )}
              <p className="text-xs text-ink/65 mb-8">
                Order {order.order_number} · {formatINR(order.total)}
                {paymentStatus === 'failed' && result?.payment?.failure_payment_id && (
                  <> · Razorpay ref {result.payment.failure_payment_id}</>
                )}
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link
                  to="/checkout"
                  className="px-6 py-3.5 rounded-full bg-ink text-ivory text-sm font-semibold hover:bg-ink/80 transition"
                >
                  Try again
                </Link>
                <Link
                  to="/shop/shop-all"
                  className="px-6 py-3.5 rounded-full border border-ink/15 text-sm font-semibold hover:bg-stone/30 transition"
                >
                  Continue shopping
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function OrderReviewPanel({
  items,
  address,
}: {
  items: OrderItemSummary[];
  address: OrderReviewAddress | null;
}) {
  if (items.length === 0 && !address) return null;

  const cityState = address
    ? [address.city, address.state].filter(Boolean).join(', ')
    : '';

  return (
    <section
      aria-labelledby="order-review-title"
      className="mb-6 rounded-2xl border border-lime/50 bg-lime/10 p-5 md:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-ivory">
          <PackageCheck size={16} />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="order-review-title" className="font-display text-lg font-semibold">
              Please confirm your selection
            </h2>
            <span className="rounded-full border border-ink/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink/60">
              Read-only
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink/65">
            Check the colour, size, quantity and delivery address before paying.
          </p>
        </div>
      </div>

      {items.length > 0 && (
        <ul aria-label="Selected items" className="mt-4 divide-y divide-ink/10 rounded-xl border border-ink/10 bg-ivory">
          {items.map((item, index) => (
            <li key={`${item.productId}-${item.color}-${item.size}-${index}`} className="flex items-start gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="mt-0.5 text-xs text-ink/65">
                  {item.color} · {item.size} · Qty {item.qty}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold">{formatINR(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
      )}

      {address && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-ink/10 bg-ivory p-3.5">
          <MapPin size={16} className="mt-0.5 shrink-0 text-ink/60" />
          <div className="min-w-0 text-sm">
            <p className="text-[10px] uppercase tracking-widest text-ink/50">Delivery address</p>
            <p className="mt-0.5 font-medium">{address.fullName || 'Customer'}</p>
            <address className="mt-1 not-italic text-xs leading-relaxed text-ink/65">
              {address.address && <span className="block">{address.address}</span>}
              {cityState && (
                <span className="block">
                  {cityState}{address.pincode ? ` - ${address.pincode}` : ''}
                </span>
              )}
              {!cityState && address.pincode && <span className="block">{address.pincode}</span>}
              {address.mobile && <span className="mt-1 block">{address.mobile}</span>}
              {address.email && <span className="block break-all">{address.email}</span>}
            </address>
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] text-ink/60">
        If anything is wrong, don&rsquo;t pay yet —{' '}
        <Link to="/contact" className="font-medium underline text-ink hover:text-ink/70">
          contact us on WhatsApp
        </Link>{' '}
        and we&rsquo;ll correct the order.
      </p>
    </section>
  );
}

function Row({ label, value, strong, mono }: { label: string; value: React.ReactNode; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <dt className="text-ink/65 shrink-0">{label}</dt>
      <dd className={`text-right ${strong ? 'font-bold text-base' : 'font-medium'} ${mono ? 'font-mono text-xs break-all' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

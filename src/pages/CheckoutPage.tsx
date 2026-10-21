import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Lock, Tag, Check, ArrowLeft, ShieldCheck, Truck, Smartphone, Loader2, UserRound,
  AlertTriangle,
} from 'lucide-react';
import { useStore, resolveProduct } from '@/store/StoreContext';
import { useAuth } from '@/store/AuthContext';
import { formatINR } from '@/data/catalog';
import { freeShippingLabel, shippingFor, useStoreSettings } from '@/lib/storeSettings';
import SEO from '@/components/SEO';
import { whatsappLink } from '@/components/WhatsApp';
import { renderOrderImage } from '@/lib/orderImage';
import { uploadOrderImage, orderImageUrl } from '@/lib/orderImageUpload';
import { saveWhatsAppOrder, setWhatsAppOrderImage } from '@/lib/whatsappOrders';
import {
  PaymentServiceUnavailableError, createOrder, markPendingOrder, rememberOrder,
} from '@/lib/payments';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Chandigarh', 'Jammu & Kashmir',
];

interface FormState {
  fullName: string;
  email: string;
  mobile: string;
  pincode: string;
  address: string;
  city: string;
  state: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

/**
 * Checkout — UPI only, guest-first.
 *
 * The order is NOT created here. This page validates the delivery details and
 * hands them to the `trios-pay` edge function, which reprices the cart from the
 * server's own catalogue, writes the order with the service role, and returns a
 * dynamic UPI QR. The customer is then sent to /order/:orderNumber, which polls
 * the server until the gateway (or a signed webhook) confirms payment.
 *
 * Signing in is entirely optional: it only links the order to an account.
 */
export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, subtotal } = useStore();
  const { user } = useAuth();
  const { settings } = useStoreSettings();

  const [form, setForm] = useState<FormState>({
    fullName: '', email: '', mobile: '', pincode: '', address: '', city: '', state: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serviceDown, setServiceDown] = useState(false);
  /**
   * WhatsApp ordering. We open WhatsApp with the full order details so the
   * customer only has to press "send". We cannot read their chat, so the
   * moment the link opens we flip the panel to "order confirmed" and tell
   * them our team will take it from there.
   */
  /**
   * WhatsApp ordering:
   *  - "idle"    → the green "Order via WhatsApp" button
   *  - "sending" → the order picture is being prepared
   *  - "waiting" → WhatsApp is open with the picture; the customer still has
   *                to press Send there
   *  - "verify"  → the customer is back; the website asks them to confirm
   *  - "sent"    → confirmed on the website; the team takes it from here
   *  - "error"   → something went wrong; the customer can try again
   */
  const [waStage, setWaStage] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  // Prefill from the signed-in profile — optional, never required.
  useEffect(() => {
    if (!user) return;
    setForm(f => ({
      ...f,
      fullName: f.fullName || user.full_name || '',
      mobile: f.mobile || (user.mobile ?? '').replace(/\D/g, '').slice(-10),
    }));
  }, [user]);

  const shipping = shippingFor(settings, subtotal);
  const total = subtotal + shipping;

  const updateField = (key: keyof FormState, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
    if (serverError) setServerError(null);
  };

  const validate = (): FormErrors => {
    const e: FormErrors = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    // Email is optional: we send no email notifications.
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      e.email = 'Enter a valid email, or leave it blank';
    }
    if (!/^[6-9]\d{9}$/.test(form.mobile)) e.mobile = 'Enter a valid 10-digit mobile';
    if (!/^\d{6}$/.test(form.pincode)) e.pincode = 'Enter a valid 6-digit PIN code';
    if (!form.address.trim()) e.address = 'Address is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.state) e.state = 'Select your state';
    return e;
  };

  /**
   * The greeting that goes with the order.
   *
   * It is the first line of the message the customer sends, and it is printed
   * on the picture too, so the message reads the same whoever opens it.
   */
  const GREETING = 'Hi TriosWorld, I want to place an order.';

  /**
   * The order as a picture.
   *
   * The details are drawn on the customer's own device, so they are fixed at
   * the moment the picture is made. WhatsApp then receives a picture, not
   * editable text — a customer cannot quietly change the size, the quantity
   * or the price before sending it.
   */
  const buildOrderImage = async (reference: string) => {
    const items = cart.map(i => {
      const p = resolveProduct(i.productId);
      return `- ${p?.name || i.productId}  |  ${i.color}  |  Size ${i.size}  |  Qty ${i.qty}  |  ${p ? formatINR(p.price * i.qty) : ''}`;
    });

    const lines = [
      'CUSTOMER',
      `Name: ${form.fullName.trim()}`,
      `Mobile: ${form.mobile}`,
      `Email: ${form.email.trim() || 'N/A'}`,
      `Address: ${form.address.trim()}, ${form.city.trim()}, ${form.state} - ${form.pincode}`,
      '',
      'ITEMS',
      ...items,
      '',
      `Subtotal: ${formatINR(subtotal)}`,
      `Shipping: ${shipping === 0 ? 'Free' : formatINR(shipping)}`,
      `TOTAL: ${formatINR(total)}`,
      '',
      'Payment: UPI / WhatsApp order',
    ];

    return renderOrderImage({
      reference,
      dateLabel: new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }),
      greeting: GREETING,
      lines,
      // The QR in the picture opens the picture of the order itself, so the
      // store can scan it and read the order straight away.
      qrPayload: orderImageUrl(reference),
      footnote: 'This picture is the order exactly as placed on triosworld.com',
    });
  };

  /**
   * Order via WhatsApp.
   *
   * The customer never types the order: the checkout draws it as a picture and
   * hands that picture to WhatsApp. On a phone the picture is attached
   * straight to the WhatsApp chat; on a desktop it is sent as a link that
   * WhatsApp renders inline.
   *
   * The details must be complete before the order is handed over, so an
   * incomplete form blocks the order and points the customer at the missing
   * field.
   *
   * WhatsApp gives the page no way to know whether the customer actually
   * pressed "send", so the confirmation is never shown up front. The order is
   * confirmed only once the customer comes back to this page — that is, after
   * they have sent the message. There is no manual "I've sent it" button: if
   * they never send it, the order is never confirmed.
   */
  const handleWhatsAppOrder = async () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      document.getElementById(Object.keys(errs)[0])?.focus();
      return;
    }

    setWaStage('sending');

    const reference = `TW-${Date.now().toString().slice(-6)}`;

    // Where the picture of the order will live. The path is the order
    // reference, so it is known before the picture is even drawn — which means
    // the chat can be opened straight away, with the order message in it.
    const pictureUrl = orderImageUrl(reference);

    // The chat opens right here, in this click: the greeting plus the order.
    // No share sheet, no empty tab — the customer lands in the chat with the
    // message already written.
    window.open(whatsappLink(`${GREETING}\n${pictureUrl}`), '_blank', 'noopener');

    try {
      const blob = await buildOrderImage(reference);

      // The picture is stored so WhatsApp can show it and the order page can
      // show the very same order.
      const upload = uploadOrderImage(blob, reference).then((url) => {
        if (url) setWhatsAppOrderImage(reference, url);
        return url;
      });

      // Keep the order on the device so /order/:reference can show it.
      saveWhatsAppOrder({
        reference,
        createdAt: new Date().toISOString(),
        imageUrl: null,
        confirmedAt: null,
        items: cart.map(i => {
          const p = resolveProduct(i.productId);
          return {
            name: p?.name || i.productId,
            color: i.color,
            size: i.size,
            qty: i.qty,
            lineTotal: p ? p.price * i.qty : 0,
          };
        }),
        subtotal,
        shipping,
        total,
        customer: {
          name: form.fullName.trim(),
          mobile: form.mobile,
          email: form.email.trim() || null,
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state,
          pincode: form.pincode,
        },
      });

      // Wait for the picture to be stored so WhatsApp can render it the
      // moment the message is sent, and so the order page shows the same
      // picture. The chat is already open while this happens.
      await upload;
    } catch {
      // The picture could not be drawn or stored — the chat is still open with
      // the message, so the order is not lost.
      setWaStage('error');
    }

    // The chat is open with the order message. The customer lands on the
    // order page, where the order number, the picture of the order and the
    // confirmation live.
    navigate(`/order/${reference}`);
  };

  const handlePay = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      document.getElementById(Object.keys(e)[0])?.focus();
      return;
    }

    setSubmitting(true);
    setServerError(null);
    setServiceDown(false);

    try {
      const order = await createOrder({
        items: cart.filter(i => resolveProduct(i.productId)),
        customer: {
          name: form.fullName.trim(),
          mobile: form.mobile,
          email: form.email.trim() || undefined,
          pincode: form.pincode,
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state,
        },
      });

      // Keep the receipt token (the guest's credential) and remember which order
      // the bag belongs to, so the bag is only emptied once payment is confirmed.
      rememberOrder({
        orderNumber: order.order_number,
        token: order.receipt_token,
        total: order.amount,
        createdAt: new Date().toISOString(),
      });
      markPendingOrder(order.order_number);

      navigate(`/order/${order.order_number}?token=${order.receipt_token}`);
    } catch (err) {
      if (err instanceof PaymentServiceUnavailableError) {
        setServiceDown(true);
        setServerError(
          'Online payment is not available at the moment. Your bag is saved — you can order on WhatsApp and we will take it from there.',
        );
      } else {
        setServerError(err instanceof Error ? err.message : 'Could not start the payment. Please try again.');
      }
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="page-container py-24 text-center">
        <SEO title="Empty Bag" noindex />
        <h1 className="font-display text-3xl mb-3">Your bag is empty</h1>
        <p className="text-ink/50 text-sm mb-6">Add some tees before heading to checkout.</p>
        <Link to="/shop/shop-all" className="bg-ink text-ivory px-6 py-3 rounded-full text-sm font-medium hover:bg-ink/80">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container py-10 md:py-16">
      <SEO title="Checkout" noindex />
      <Link to="/shop/shop-all" className="inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink mb-6">
        <ArrowLeft size={16} /> Continue shopping
      </Link>
      <h1 className="font-display text-3xl md:text-4xl font-semibold mb-10">Checkout</h1>

      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-8">
          {/* Trust badges */}
          <div className="flex flex-wrap gap-4 text-xs text-ink/50">
            <span className="flex items-center gap-1.5"><ShieldCheck size={16} /> Secure checkout</span>
            <span className="flex items-center gap-1.5"><Truck size={16} /> {freeShippingLabel(settings, formatINR)}</span>
            <span className="flex items-center gap-1.5"><Lock size={16} /> Your data is encrypted</span>
          </div>

          {/* Optional account — guests check out without one. */}
          {user ? (
            <div className="flex items-center gap-2 text-sm text-ink/60 rounded-xl border border-ink/10 bg-stone/20 px-4 py-3">
              <UserRound size={16} />
              Signed in as <span className="font-medium text-ink">{user.full_name}</span>
            </div>
          ) : (
            <div className="rounded-xl border border-ink/10 bg-stone/20 px-4 py-3.5">
              <p className="text-sm text-ink/70">
                Checking out as a guest — <span className="font-medium text-ink">no account needed</span>.
              </p>
              <p className="text-xs text-ink/50 mt-1.5">
                Already with us?{' '}
                <Link to="/login" className="underline text-ink hover:text-ink/70">Sign in</Link>
                {' '}to save this order to your account, or{' '}
                <Link to="/register" className="underline text-ink hover:text-ink/70">create one</Link>.
                Your bag is kept either way.
              </p>
            </div>
          )}

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">Delivery details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field id="fullName" label="Full name" required value={form.fullName}
                onChange={v => updateField('fullName', v)} error={errors.fullName} placeholder="Arjun Sharma" />
              <Field id="mobile" label="Mobile number" type="tel" required value={form.mobile}
                onChange={v => updateField('mobile', v.replace(/\D/g, '').slice(0, 10))}
                error={errors.mobile} placeholder="9876543210" maxLength={10} />
              <div className="sm:col-span-2">
                <Field id="email" label="Email (optional)" type="email" value={form.email}
                  onChange={v => updateField('email', v)} error={errors.email} placeholder="arjun@email.com" />
              </div>
              <Field id="pincode" label="PIN code" required value={form.pincode}
                onChange={v => updateField('pincode', v.replace(/\D/g, '').slice(0, 6))}
                error={errors.pincode} placeholder="400001" maxLength={6} />
              <Field id="city" label="City" required value={form.city}
                onChange={v => updateField('city', v)} error={errors.city} placeholder="Mumbai" />
              <div className="sm:col-span-2">
                <Field id="address" label="Address (house no, street, area)" required value={form.address}
                  onChange={v => updateField('address', v)} error={errors.address}
                  placeholder="Flat 12B, Sunrise Apartments, Bandra West" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="state" className="text-xs text-ink/60">
                  State<span className="text-burgundy"> *</span>
                </label>
                <select id="state" value={form.state}
                  onChange={e => updateField('state', e.target.value)}
                  className={`mt-1 w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:border-ink ${errors.state ? 'border-red-500' : 'border-ink/15'}`}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
              </div>
            </div>
          </section>

          {/* Payment — online only, via UPI. */}
          <section className="p-5 md:p-6 rounded-xl border border-ink/10 bg-stone/20">
            <div className="flex items-center gap-2 mb-4">
              <Lock size={18} />
              <h2 className="font-display text-lg font-semibold">Payment</h2>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg border border-ink bg-ivory">
              <input type="radio" checked readOnly className="accent-ink mt-1" aria-label="UPI" />
              <Smartphone size={20} className="text-ink/60 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">UPI · Online payment</p>
                <p className="text-xs text-ink/50 mt-0.5">
                  Pay by scanning a secure QR with Google Pay, PhonePe, Paytm, BHIM or any UPI app.
                  We confirm your payment with the bank before your order is placed.
                </p>
              </div>
            </div>

            {serverError && (
              <div className="mt-4" role="alert">
                <p className="text-sm text-red-600">{serverError}</p>
              </div>
            )}

            <motion.button
              type="button"
              onClick={handlePay}
              disabled={submitting}
              whileTap={{ scale: 0.99 }}
              className="mt-5 w-full py-4 rounded-full bg-ink text-ivory font-semibold hover:bg-ink/80 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {submitting
                ? <><Loader2 size={18} className="animate-spin" /> Starting secure payment…</>
                : <>Pay securely · {formatINR(total)}</>}
            </motion.button>

            {waStage === 'sent' ? (
              <div className="mt-3 rounded-xl border border-lime/40 bg-lime/10 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Check size={16} className="text-lime" /> Order confirmed
                </p>
                <p className="text-xs text-ink/60 mt-1.5 leading-relaxed">
                  Thank you — your order is confirmed. <strong>Our team will meet you soon</strong> and
                  message you on WhatsApp with the payment details.
                </p>
              </div>
            ) : waStage === 'error' ? (
              <div className="mt-3 rounded-xl border border-ink/15 bg-ivory p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <AlertTriangle size={16} className="text-burgundy" /> We couldn&rsquo;t send it
                </p>
                <p className="text-xs text-ink/60 mt-1.5 leading-relaxed">
                  Something went wrong while sending your order. Please try again, or reach us on
                  WhatsApp at <span className="font-semibold text-ink">+91 93451 25667</span>.
                </p>
                <button
                  type="button"
                  onClick={handleWhatsAppOrder}
                  className="mt-3 w-full py-3 rounded-full bg-[#25d366] text-white text-sm font-semibold hover:brightness-95 transition"
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleWhatsAppOrder}
                  disabled={waStage === 'sending'}
                  className="mt-3 w-full py-4 rounded-full bg-[#25d366] text-white font-semibold hover:brightness-95 transition disabled:opacity-70 inline-flex items-center justify-center gap-2"
                >
                  {waStage === 'sending'
                    ? <><Loader2 size={18} className="animate-spin" /> Preparing your order…</>
                    : <><svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor"><path d="M16.04 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.59 4.46 1.72 6.41L3.2 28.8l6.55-1.72a12.79 12.79 0 0 0 6.29 1.6h.01c7.06 0 12.8-5.74 12.8-12.8S23.1 3.2 16.04 3.2Zm0 23.53c-2.02 0-4-.53-5.7-1.53l-.41-.24-4.22 1.11 1.13-4.11-.27-.42a10.53 10.53 0 0 1-1.62-5.6c0-5.83 4.75-10.58 10.59-10.58 2.83 0 5.49 1.1 7.49 3.11a10.52 10.52 0 0 1 3.1 7.48c0 5.84-4.75 10.58-10.59 10.58Zm5.83-7.92c-.32-.16-1.88-.93-2.17-1.03-.29-.11-.5-.16-.71.16-.21.32-.82 1.03-1 1.24-.19.21-.37.24-.69.08-.32-.16-1.34-.5-2.56-1.58a9.4 9.4 0 0 1-1.76-2.21c-.18-.32-.02-.49.14-.65.15-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.72-.98-2.35-.26-.62-.53-.54-.72-.55h-.62c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.66 0 1.56 1.14 3.07 1.3 3.28.16.21 2.24 3.42 5.42 4.8.75.32 1.34.52 1.8.66.76.24 1.45.21 2 .13.61-.09 1.88-.77 2.14-1.51.27-.74.27-1.38.19-1.51-.08-.14-.29-.21-.61-.37Z" /></svg>
                    Order via WhatsApp</>}
                </button>
                <p className="text-[11px] text-ink/40 mt-3 text-center">
                  Your order goes to our WhatsApp as a picture — nothing to type, nothing to change.
                </p>
                <p className="text-[11px] text-ink/40 mt-1 text-center">
                  You’ll get a UPI QR on the next screen. Nothing is charged until you confirm the payment
                  in your UPI app.
                </p>
              </>
            )}
          </section>
        </div>

        <aside className="lg:col-span-5">
          <div className="p-6 rounded-xl border border-ink/10 bg-ivory lg:sticky lg:top-24">
            <h2 className="font-display text-lg font-semibold mb-4">Order summary</h2>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
              {cart.map(item => {
                const p = resolveProduct(item.productId);
                if (!p) return null;
                const v = p.variants.find(x => x.color === item.color);
                return (
                  <div key={`${item.productId}-${item.color}-${item.size}`} className="flex gap-3">
                    <img src={v?.images[0]} alt={p.name} className="w-14 h-16 object-cover rounded" loading="lazy" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-ink/50">{item.color} · {item.size} · Qty {item.qty}</p>
                    </div>
                    <span className="text-sm font-semibold">{formatINR(p.price * item.qty)}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-5 border-t border-ink/10">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-ink/60">Subtotal</span><span>{formatINR(subtotal)}</span></div>
                <div className="flex justify-between">
                  <span className="text-ink/60">Shipping</span>
                  <span>{shipping === 0 ? 'Free' : formatINR(shipping)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base pt-2 border-t border-ink/10">
                  <span>Total</span><span>{formatINR(total)}</span>
                </div>
                <p className="text-[11px] text-ink/40 pt-1">Inclusive of all taxes</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  maxLength?: number;
}

function Field({ id, label, type = 'text', required, value, onChange, error, placeholder, maxLength }: FieldProps) {
  return (
    <label className="block" htmlFor={id}>
      <span className="text-xs text-ink/60">{label}{required && <span className="text-burgundy"> *</span>}</span>
      <input id={id} type={type} required={required} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength}
        className={`mt-1 w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:border-ink ${error ? 'border-red-500' : 'border-ink/15'}`} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </label>
  );
}

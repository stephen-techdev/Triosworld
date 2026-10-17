import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Lock, Tag, Check, ArrowLeft, ShieldCheck, Truck, Smartphone, Loader2, UserRound,
} from 'lucide-react';
import { useStore, resolveProduct } from '@/store/StoreContext';
import { useAuth } from '@/store/AuthContext';
import { formatINR } from '@/data/catalog';
import SEO from '@/components/SEO';
import { createOrder, markPendingOrder, rememberOrder } from '@/lib/payments';

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

  const [coupon, setCoupon] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    fullName: '', email: '', mobile: '', pincode: '', address: '', city: '', state: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Prefill from the signed-in profile — optional, never required.
  useEffect(() => {
    if (!user) return;
    setForm(f => ({
      ...f,
      fullName: f.fullName || user.full_name || '',
      mobile: f.mobile || (user.mobile ?? '').replace(/\D/g, '').slice(-10),
    }));
  }, [user]);

  const shipping = subtotal > 1499 || subtotal === 0 ? 0 : 79;
  const discount = couponApplied ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal + shipping - discount;

  const applyCoupon = () => {
    if (coupon.trim().toUpperCase() === 'TRIO10') {
      setCouponApplied(true);
      setCouponError(null);
    } else {
      setCouponError('That code is not valid.');
      setCouponApplied(false);
    }
  };

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

  const handlePay = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      document.getElementById(Object.keys(e)[0])?.focus();
      return;
    }

    setSubmitting(true);
    setServerError(null);

    try {
      const order = await createOrder({
        items: cart,
        customer: {
          name: form.fullName.trim(),
          mobile: form.mobile,
          email: form.email.trim() || undefined,
          pincode: form.pincode,
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state,
        },
        coupon: couponApplied ? coupon.trim().toUpperCase() : '',
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
      setServerError(err instanceof Error ? err.message : 'Could not start the payment. Please try again.');
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
            <span className="flex items-center gap-1.5"><Truck size={16} /> Free shipping over ₹1499</span>
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
              <p className="text-sm text-red-600 mt-4" role="alert">{serverError}</p>
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
            <p className="text-[11px] text-ink/40 mt-3 text-center">
              You’ll get a UPI QR on the next screen. Nothing is charged until you confirm the payment
              in your UPI app.
            </p>
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
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Tag size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
                  <input value={coupon}
                    onChange={e => { setCoupon(e.target.value); setCouponError(null); }}
                    placeholder="Coupon code"
                    className="w-full text-sm border border-ink/15 rounded-full pl-9 pr-3 py-2.5 focus:outline-none focus:border-ink uppercase"
                    aria-label="Coupon code" />
                </div>
                <button onClick={applyCoupon} className="px-4 py-2.5 rounded-full bg-ink text-ivory text-sm font-medium hover:bg-ink/80">
                  Apply
                </button>
              </div>
              {couponApplied && (
                <p className="text-xs text-lime bg-ink px-3 py-1.5 rounded-full inline-flex items-center gap-1 mb-3">
                  <Check size={12} /> TRIO10 applied — 10% off
                </p>
              )}
              {couponError && <p className="text-xs text-red-600 mb-3">{couponError}</p>}
              <p className="text-[11px] text-ink/40 mb-4">
                Try code <span className="font-semibold">TRIO10</span> for 10% off.
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-ink/60">Subtotal</span><span>{formatINR(subtotal)}</span></div>
                <div className="flex justify-between">
                  <span className="text-ink/60">Shipping</span>
                  <span>{shipping === 0 ? 'Free' : formatINR(shipping)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-lime"><span>Discount</span><span>−{formatINR(discount)}</span></div>
                )}
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

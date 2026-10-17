import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Tag, Check, ArrowLeft, ShieldCheck, Truck, CreditCard, Smartphone, Banknote } from 'lucide-react';
import { useStore, resolveProduct } from '@/store/StoreContext';
import { useAuth, supabase } from '@/store/AuthContext';
import { formatINR } from '@/data/catalog';
import SEO from '@/components/SEO';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Chandigarh', 'Jammu & Kashmir',
];

type PayMethod = 'upi' | 'card' | 'cod';

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

export default function CheckoutPage() {
  const { cart, subtotal, clearCart } = useStore();
  const { user, session } = useAuth();
  const [coupon, setCoupon] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('upi');
  const [form, setForm] = useState<FormState>({
    fullName: '', email: '', mobile: '', pincode: '', address: '', city: '', state: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const shipping = subtotal > 1499 || subtotal === 0 ? 0 : 79;
  const discount = couponApplied ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal + shipping - discount;

  const applyCoupon = () => {
    if (coupon.trim().toUpperCase() === 'TRIO10') { setCouponApplied(true); setCouponError(null); }
    else { setCouponError('That code is not valid.'); setCouponApplied(false); }
  };

  const validate = (): FormErrors => {
    const e: FormErrors = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!/^[6-9]\d{9}$/.test(form.mobile)) e.mobile = 'Enter a valid 10-digit mobile';
    if (!/^\d{6}$/.test(form.pincode)) e.pincode = 'Enter a valid 6-digit PIN code';
    if (!form.address.trim()) e.address = 'Address is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.state) e.state = 'Select your state';
    return e;
  };

  const updateField = (key: keyof FormState, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const handlePlaceOrder = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      const firstField = document.getElementById(Object.keys(e)[0]);
      firstField?.focus();
      return;
    }
    setSubmitting(true);
    const newOrderId = `TW-${Math.floor(Math.random() * 90000 + 10000)}`;

    // If logged in, save order to database
    if (user && session) {
      const orderItems = cart.map(item => {
        const p = resolveProduct(item.productId);
        return { name: p?.name ?? '', color: item.color, size: item.size, qty: item.qty, price: p?.price ?? 0 };
      });
      await supabase.from('orders').insert({
        order_number: newOrderId,
        items: orderItems,
        subtotal,
        shipping,
        discount,
        total,
        status: 'placed',
        shipping_address: { fullName: form.fullName, mobile: form.mobile, pincode: form.pincode, address: form.address, city: form.city, state: form.state },
        payment_method: payMethod,
      });
    }

    setSubmitting(false);
    setOrderId(newOrderId);
    clearCart();
    setPlaced(true);
  };

  if (placed) {
    return (
      <div className="page-container py-24 text-center">
        <SEO title="Order Confirmed" noindex />
        <div className="w-16 h-16 rounded-full bg-lime mx-auto flex items-center justify-center mb-6"><Check size={32} /></div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold mb-3">Order placed!</h1>
        <p className="text-ink/60 max-w-md mx-auto mb-2">Thank you, {form.fullName.split(' ')[0]}. Your order has been confirmed and will be dispatched within 24 hours.</p>
        <p className="text-sm text-ink/50 mb-2">Order #{orderId}</p>
        <p className="text-sm text-ink/50 mb-8">A confirmation has been sent to {form.email}. Estimated delivery in 3–5 business days.</p>
        <Link to="/shop/shop-all" className="inline-block bg-ink text-ivory px-6 py-3 rounded-full text-sm font-medium hover:bg-ink/80">Continue shopping</Link>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="page-container py-24 text-center">
        <SEO title="Empty Bag" noindex />
        <h1 className="font-display text-3xl mb-3">Your bag is empty</h1>
        <p className="text-ink/50 text-sm mb-6">Add some tees before heading to checkout.</p>
        <Link to="/shop/shop-all" className="bg-ink text-ivory px-6 py-3 rounded-full text-sm font-medium hover:bg-ink/80">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="page-container py-10 md:py-16">
      <SEO title="Checkout" noindex />
      <Link to="/shop/shop-all" className="inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink mb-6"><ArrowLeft size={16} /> Continue shopping</Link>
      <h1 className="font-display text-3xl md:text-4xl font-semibold mb-10">Checkout</h1>

      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-8">
          {/* Trust badges */}
          <div className="flex flex-wrap gap-4 text-xs text-ink/50">
            <span className="flex items-center gap-1.5"><ShieldCheck size={16} /> Secure checkout</span>
            <span className="flex items-center gap-1.5"><Truck size={16} /> Free shipping over ₹1499</span>
            <span className="flex items-center gap-1.5"><Lock size={16} /> Your data is encrypted</span>
          </div>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">Contact & Shipping</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field id="fullName" label="Full name" required value={form.fullName}
                onChange={v => updateField('fullName', v)} error={errors.fullName} placeholder="Arjun Sharma" />
              <Field id="email" label="Email" type="email" required value={form.email}
                onChange={v => updateField('email', v)} error={errors.email} placeholder="arjun@email.com" />
              <Field id="mobile" label="Mobile number" type="tel" required value={form.mobile}
                onChange={v => updateField('mobile', v)} error={errors.mobile} placeholder="9876543210" maxLength={10} />
              <Field id="pincode" label="PIN code" required value={form.pincode}
                onChange={v => updateField('pincode', v.replace(/\D/g, '').slice(0, 6))} error={errors.pincode} placeholder="400001" maxLength={6} />
              <div className="sm:col-span-2">
                <Field id="address" label="Address (house no, street, area)" required value={form.address}
                  onChange={v => updateField('address', v)} error={errors.address} placeholder="Flat 12B, Sunrise Apartments, Bandra West" />
              </div>
              <Field id="city" label="City" required value={form.city}
                onChange={v => updateField('city', v)} error={errors.city} placeholder="Mumbai" />
              <div>
                <label htmlFor="state" className="text-xs text-ink/60">State<span className="text-burgundy"> *</span></label>
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

          <section className="p-5 rounded-xl border border-ink/10 bg-stone/20">
            <div className="flex items-center gap-2 mb-4"><Lock size={18} /><h2 className="font-display text-lg font-semibold">Payment Method</h2></div>
            <div className="space-y-3">
              {([
                { id: 'upi' as const, label: 'UPI', desc: 'Google Pay, PhonePe, Paytm', icon: Smartphone },
                { id: 'card' as const, label: 'Credit / Debit Card', desc: 'Visa, Mastercard, RuPay', icon: CreditCard },
                { id: 'cod' as const, label: 'Cash on Delivery', desc: 'Pay when you receive', icon: Banknote },
              ]).map(m => (
                <label key={m.id} className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition ${payMethod === m.id ? 'border-ink bg-ivory' : 'border-ink/10 hover:border-ink/30'}`}>
                  <input type="radio" name="payment" checked={payMethod === m.id} onChange={() => setPayMethod(m.id)}
                    className="accent-ink" />
                  <m.icon size={20} className="text-ink/60" />
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-ink/50">{m.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <button onClick={handlePlaceOrder} disabled={submitting}
              className="mt-5 w-full py-4 rounded-full bg-ink text-ivory font-semibold hover:bg-ink/80 transition disabled:opacity-50">
              {submitting ? 'Processing…' : `Place Order · ${formatINR(total)}`}
            </button>
            <p className="text-[11px] text-ink/40 mt-3 text-center">Demo checkout — no real payment will be processed. Razorpay integration is ready to activate.</p>
          </section>
        </div>

        <aside className="lg:col-span-5">
          <div className="p-6 rounded-xl border border-ink/10 bg-ivory sticky top-24">
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
                  <input value={coupon} onChange={e => { setCoupon(e.target.value); setCouponError(null); }} placeholder="Coupon code"
                    className="w-full text-sm border border-ink/15 rounded-full pl-9 pr-3 py-2.5 focus:outline-none focus:border-ink uppercase" aria-label="Coupon code" />
                </div>
                <button onClick={applyCoupon} className="px-4 py-2.5 rounded-full bg-ink text-ivory text-sm font-medium hover:bg-ink/80">Apply</button>
              </div>
              {couponApplied && <p className="text-xs text-lime bg-ink px-3 py-1.5 rounded-full inline-flex items-center gap-1 mb-3"><Check size={12} /> TRIO10 applied — 10% off</p>}
              {couponError && <p className="text-xs text-red-600 mb-3">{couponError}</p>}
              <p className="text-[11px] text-ink/40 mb-4">Try code <span className="font-semibold">TRIO10</span> for 10% off.</p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-ink/60">Subtotal</span><span>{formatINR(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-ink/60">Shipping</span><span>{shipping === 0 ? 'Free' : formatINR(shipping)}</span></div>
                {discount > 0 && <div className="flex justify-between text-lime"><span>Discount</span><span>−{formatINR(discount)}</span></div>}
                <div className="flex justify-between font-semibold text-base pt-2 border-t border-ink/10"><span>Total</span><span>{formatINR(total)}</span></div>
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

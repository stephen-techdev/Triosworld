import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Package, MapPin, Heart, LogOut, ShoppingBag, Settings, Plus, Trash2, Check, Loader2, Edit3, Phone } from 'lucide-react';
import SEO from '@/components/SEO';
import { useStore } from '@/store/StoreContext';
import { useAuth, supabase } from '@/store/AuthContext';
import { formatINR } from '@/data/catalog';

type Tab = 'profile' | 'orders' | 'wishlist' | 'addresses' | 'settings';

interface Address {
  id: string;
  full_name: string;
  mobile: string;
  pincode: string;
  address_line: string;
  city: string;
  state: string;
  is_default: boolean;
}

interface Order {
  id: string;
  order_number: string;
  items: { name: string; color: string; size: string; qty: number; price: number }[];
  total: number;
  status: string;
  payment_method: string;
  created_at: string;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Chandigarh', 'Jammu & Kashmir',
];

export default function AccountPage() {
  const navigate = useNavigate();
  const { user, session, loading: authLoading, signOut, completeProfile } = useAuth();
  const { wishlist, cartCount } = useStore();
  const [tab, setTab] = useState<Tab>('profile');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', mobile: '', gender: '' });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [addrForm, setAddrForm] = useState({ full_name: '', mobile: '', pincode: '', address_line: '', city: '', state: '' });
  const [addrError, setAddrError] = useState<string | null>(null);
  const [addrLoading, setAddrLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user && !user.mobile) {
      setNeedsProfile(true);
      setProfileForm({ full_name: user.full_name || '', mobile: '', gender: user.gender || '' });
    }
  }, [user]);

  useEffect(() => {
    if (session) {
      supabase.from('addresses').select('*').order('is_default', { ascending: false }).then(({ data }) => {
        if (data) setAddresses(data as Address[]);
      });
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(10).then(({ data }) => {
        if (data) setOrders(data as Order[]);
      });
    }
  }, [session]);

  if (authLoading) {
    return (
      <div className="page-container py-32 text-center">
        <SEO title="My Account" noindex />
        <Loader2 size={32} className="animate-spin mx-auto text-ink/40" />
      </div>
    );
  }

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    if (!profileForm.full_name.trim()) { setProfileError('Full name is required'); return; }
    if (!/^[6-9]\d{9}$/.test(profileForm.mobile.replace(/\D/g, '').slice(-10))) { setProfileError('Enter a valid mobile number'); return; }
    setProfileLoading(true);
    const { error: err } = await completeProfile({
      full_name: profileForm.full_name.trim(),
      mobile: profileForm.mobile.replace(/\D/g, '').slice(-10),
      gender: profileForm.gender || undefined,
    });
    setProfileLoading(false);
    if (err) { setProfileError(err); return; }
    setNeedsProfile(false);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddrError(null);
    if (!addrForm.full_name.trim()) { setAddrError('Full name is required'); return; }
    if (!/^[6-9]\d{9}$/.test(addrForm.mobile.replace(/\D/g, '').slice(-10))) { setAddrError('Enter a valid mobile number'); return; }
    if (!/^\d{6}$/.test(addrForm.pincode)) { setAddrError('Enter a valid 6-digit PIN code'); return; }
    if (!addrForm.address_line.trim()) { setAddrError('Address is required'); return; }
    if (!addrForm.city.trim()) { setAddrError('City is required'); return; }
    if (!addrForm.state) { setAddrError('Select your state'); return; }

    setAddrLoading(true);
    const isFirst = addresses.length === 0;
    const { data, error } = await supabase.from('addresses').insert({
      full_name: addrForm.full_name.trim(),
      mobile: addrForm.mobile.replace(/\D/g, '').slice(-10),
      pincode: addrForm.pincode,
      address_line: addrForm.address_line.trim(),
      city: addrForm.city.trim(),
      state: addrForm.state,
      is_default: isFirst,
    }).select();
    setAddrLoading(false);
    if (error) { setAddrError('Could not save address'); return; }
    if (data) setAddresses(prev => [...prev, data[0] as Address]);
    setAddrForm({ full_name: '', mobile: '', pincode: '', address_line: '', city: '', state: '' });
    setShowAddrForm(false);
  };

  const handleDeleteAddress = async (id: string) => {
    await supabase.from('addresses').delete().eq('id', id);
    setAddresses(prev => prev.filter(a => a.id !== id));
  };

  const handleSetDefault = async (id: string) => {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
    await supabase.from('addresses').update({ is_default: true }).eq('id', id);
    setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === id })));
  };

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'orders', label: 'My Orders', icon: Package },
    { id: 'wishlist', label: 'My Wishlist', icon: Heart },
    { id: 'addresses', label: 'Saved Addresses', icon: MapPin },
    { id: 'settings', label: 'Account Settings', icon: Settings },
  ];

  return (
    <div className="page-container py-10 md:py-16">
      <SEO title="My Account" noindex />

      {/* Complete profile prompt for Google users */}
      {needsProfile && (
        <div className="mb-8 p-6 rounded-xl bg-lime/10 border border-lime/30">
          <h2 className="font-display text-lg font-semibold mb-2">Complete your profile</h2>
          <p className="text-sm text-ink/60 mb-4">We need your mobile number to complete your account.</p>
          <form onSubmit={handleCompleteProfile} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs text-ink/60">Full Name</label>
              <input type="text" value={profileForm.full_name} onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink" />
            </div>
            <div>
              <label className="text-xs text-ink/60">Mobile Number</label>
              <div className="mt-1 flex items-center rounded-lg border border-ink/15 focus-within:border-ink overflow-hidden">
                <span className="px-3 py-2.5 text-sm text-ink/50 border-r border-ink/10 bg-stone/20">+91</span>
                <input type="tel" value={profileForm.mobile} onChange={e => setProfileForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  placeholder="9876543210" inputMode="numeric" className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none" />
              </div>
            </div>
            <div>
              <label className="text-xs text-ink/60">Gender (optional)</label>
              <select value={profileForm.gender} onChange={e => setProfileForm(f => ({ ...f, gender: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink">
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            {profileError && <div className="sm:col-span-2 text-xs text-red-600">{profileError}</div>}
            <button type="submit" disabled={profileLoading} className="sm:col-span-2 py-3 rounded-full bg-ink text-ivory text-sm font-medium hover:bg-ink/80 disabled:opacity-50 flex items-center justify-center gap-2">
              {profileLoading ? <Loader2 size={16} className="animate-spin" /> : <>Complete Profile</>}
            </button>
          </form>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <div className="w-14 h-14 rounded-full bg-ink text-ivory flex items-center justify-center shrink-0">
          {user.avatar_url ? <img src={user.avatar_url} alt={user.full_name} className="w-full h-full rounded-full object-cover" /> : <User size={24} />}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl md:text-3xl font-semibold truncate">{user.full_name}</h1>
          <p className="text-sm text-ink/60 flex items-center gap-1.5"><Phone size={14} /> {user.mobile ? `+91 ${user.mobile}` : 'No mobile number'}</p>
        </div>
        <button onClick={handleSignOut} className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-ink/15 text-sm font-medium hover:bg-ink hover:text-ivory transition">
          <LogOut size={16} /> Logout
        </button>
      </div>

      {/* min-w-0 on both items is essential: grid items default to min-width:auto,
            which let the tab strip size the whole column to 905px and pushed the
            page wider than the viewport. */}
      <div className="grid lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-3 min-w-0">
          {/* On phones the tabs scroll sideways; the fade signals there is more. */}
          <div className="relative">
            <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible no-scrollbar pb-2 lg:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-start">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 snap-start transition ${tab === t.id ? 'bg-ink text-ivory' : 'hover:bg-stone/30 text-ink/70'}`}>
                  <t.icon size={18} /> {t.label}
                </button>
              ))}
              <button onClick={handleSignOut} className="lg:hidden flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 snap-start text-red-600 hover:bg-red-50">
                <LogOut size={18} /> Logout
              </button>
            </nav>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-ivory to-transparent lg:hidden"
            />
          </div>
        </aside>

        {/* Content */}
        <div className="lg:col-span-9 min-w-0">
          {/* Profile */}
          {tab === 'profile' && (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold">My Profile</h2>
              <div className="p-6 rounded-xl border border-ink/10 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-ink/40 uppercase tracking-wide">Full Name</p>
                    <p className="text-sm font-medium mt-1">{user.full_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink/40 uppercase tracking-wide">Mobile</p>
                    <p className="text-sm font-medium mt-1">{user.mobile ? `+91 ${user.mobile}` : 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink/40 uppercase tracking-wide">Gender</p>
                    <p className="text-sm font-medium mt-1 capitalize">{user.gender ? user.gender.replace('_', ' ') : 'Not specified'}</p>
                  </div>
                </div>
              </div>
              <Link to="/checkout" className="inline-flex items-center gap-2 text-sm text-ink/60 hover:text-ink">
                <ShoppingBag size={16} /> {cartCount} item{cartCount !== 1 ? 's' : ''} in bag
              </Link>
            </div>
          )}

          {/* Orders */}
          {tab === 'orders' && (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold">My Orders</h2>
              {orders.length === 0 ? (
                <div className="p-10 rounded-xl border border-ink/10 text-center">
                  <Package size={36} className="mx-auto text-ink/20 mb-4" />
                  <p className="text-ink/60 text-sm mb-4">No orders yet.</p>
                  <Link to="/shop/shop-all" className="inline-block bg-ink text-ivory px-6 py-3 rounded-full text-sm font-medium hover:bg-ink/80">Start Shopping</Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map(o => (
                    <div key={o.id} className="p-5 rounded-xl border border-ink/10">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-medium">Order #{o.order_number}</p>
                          <p className="text-xs text-ink/50">{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <span className="text-xs font-medium px-3 py-1 rounded-full bg-stone/40 capitalize">{o.status}</span>
                      </div>
                      <div className="space-y-1.5 text-sm text-ink/60">
                        {o.items.map((item, i) => (
                          <p key={i}>{item.name} — {item.color}, {item.size}, Qty {item.qty}</p>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between pt-3 border-t border-ink/5">
                        <span className="text-xs text-ink/50 capitalize">{o.payment_method}</span>
                        <span className="text-sm font-semibold">{formatINR(o.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Wishlist */}
          {tab === 'wishlist' && (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold">My Wishlist</h2>
              {wishlist.length === 0 ? (
                <div className="p-10 rounded-xl border border-ink/10 text-center">
                  <Heart size={36} className="mx-auto text-ink/20 mb-4" />
                  <p className="text-ink/60 text-sm mb-4">Your wishlist is empty.</p>
                  <Link to="/shop/shop-all" className="inline-block bg-ink text-ivory px-6 py-3 rounded-full text-sm font-medium hover:bg-ink/80">Browse Products</Link>
                </div>
              ) : (
                <Link to="/wishlist" className="inline-block bg-ink text-ivory px-6 py-3 rounded-full text-sm font-medium hover:bg-ink/80">
                  View {wishlist.length} saved item{wishlist.length !== 1 ? 's' : ''}
                </Link>
              )}
            </div>
          )}

          {/* Addresses */}
          {tab === 'addresses' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">Saved Addresses</h2>
                <button onClick={() => setShowAddrForm(s => !s)} className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-ink/60">
                  <Plus size={16} /> Add New
                </button>
              </div>

              {showAddrForm && (
                <form onSubmit={handleSaveAddress} className="p-5 rounded-xl border border-ink/10 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input type="text" placeholder="Full name" value={addrForm.full_name} onChange={e => setAddrForm(f => ({ ...f, full_name: e.target.value }))} className="rounded-lg border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink" />
                    <input type="tel" placeholder="Mobile" value={addrForm.mobile} onChange={e => setAddrForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="rounded-lg border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink" />
                    <input type="text" placeholder="PIN code" value={addrForm.pincode} onChange={e => setAddrForm(f => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} className="rounded-lg border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink" />
                    <input type="text" placeholder="City" value={addrForm.city} onChange={e => setAddrForm(f => ({ ...f, city: e.target.value }))} className="rounded-lg border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink" />
                    <div className="sm:col-span-2"><input type="text" placeholder="Address (house no, street, area)" value={addrForm.address_line} onChange={e => setAddrForm(f => ({ ...f, address_line: e.target.value }))} className="w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink" /></div>
                    <select value={addrForm.state} onChange={e => setAddrForm(f => ({ ...f, state: e.target.value }))} className="rounded-lg border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink">
                      <option value="">Select state</option>
                      {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {addrError && <p className="text-xs text-red-600">{addrError}</p>}
                  <div className="flex gap-3">
                    <button type="submit" disabled={addrLoading} className="px-6 py-2.5 rounded-full bg-ink text-ivory text-sm font-medium hover:bg-ink/80 disabled:opacity-50 flex items-center gap-2">
                      {addrLoading ? <Loader2 size={16} className="animate-spin" /> : 'Save Address'}
                    </button>
                    <button type="button" onClick={() => setShowAddrForm(false)} className="px-6 py-2.5 rounded-full border border-ink/15 text-sm font-medium hover:bg-stone/30">Cancel</button>
                  </div>
                </form>
              )}

              {addresses.length === 0 && !showAddrForm ? (
                <div className="p-10 rounded-xl border border-ink/10 text-center">
                  <MapPin size={36} className="mx-auto text-ink/20 mb-4" />
                  <p className="text-ink/60 text-sm">No saved addresses yet.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {addresses.map(a => (
                    <div key={a.id} className="p-5 rounded-xl border border-ink/10 relative">
                      {a.is_default && <span className="absolute top-3 right-3 text-xs text-lime bg-ink px-2 py-0.5 rounded-full">Default</span>}
                      <p className="text-sm font-medium">{a.full_name}</p>
                      <p className="text-sm text-ink/60 mt-1">{a.address_line}</p>
                      <p className="text-sm text-ink/60">{a.city}, {a.state} — {a.pincode}</p>
                      <p className="text-sm text-ink/60 mt-1">+91 {a.mobile}</p>
                      <div className="mt-3 flex gap-3">
                        {!a.is_default && <button onClick={() => handleSetDefault(a.id)} className="text-xs text-ink/60 hover:text-ink inline-flex items-center gap-1"><Check size={12} /> Set default</button>}
                        <button onClick={() => handleDeleteAddress(a.id)} className="text-xs text-red-500 hover:text-red-700 inline-flex items-center gap-1"><Trash2 size={12} /> Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings */}
          {tab === 'settings' && (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold">Account Settings</h2>
              <div className="p-6 rounded-xl border border-ink/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Mobile Number</p>
                    <p className="text-xs text-ink/50 mt-0.5">{user.mobile ? `+91 ${user.mobile}` : 'Not set'}</p>
                  </div>
                  <Edit3 size={16} className="text-ink/30" />
                </div>
                <div className="border-t border-ink/5 pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Password</p>
                    <p className="text-xs text-ink/50 mt-0.5">••••••••</p>
                  </div>
                  <Link to="/forgot-password" className="text-xs text-ink/60 hover:text-ink underline">Change</Link>
                </div>
              </div>
              <div className="p-6 rounded-xl border border-red-200 bg-red-50">
                <h3 className="text-sm font-medium text-red-700 mb-1">Sign Out</h3>
                <p className="text-xs text-red-600/70 mb-4">Sign out of your TriosWorld account on this device.</p>
                <button onClick={handleSignOut} className="px-5 py-2.5 rounded-full border border-red-300 text-sm font-medium text-red-700 hover:bg-red-100 inline-flex items-center gap-2">
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

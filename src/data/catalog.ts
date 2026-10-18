export type Gender = 'men';
export type Fit = 'Regular' | 'Oversized' | 'Relaxed' | 'Slim';
export type Fabric = 'Cotton' | 'Cotton Blend' | 'Heavyweight Cotton' | 'French Terry';
export type Badge = 'Bestseller' | 'New' | 'Limited' | 'Essential' | 'Street' | 'Graphic';

export interface Variant {
  color: string;
  hex: string;
  images: string[];
  sizes: { size: string; stock: number }[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  gender: Gender;
  categories: string[];
  price: number;
  mrp: number;
  fit: Fit;
  fabric: Fabric;
  description: string;
  care: string;
  variants: Variant[];
  badge: Badge;
  createdAt: string;
  bestseller: boolean;
  newArrival: boolean;
  /** Set on cards created from the admin dashboard rather than this file. */
  runtime?: boolean;
}

export const COLORS = [
  { name: 'Black', hex: '#171717' },
  { name: 'Ivory', hex: '#F7F5F0' },
  { name: 'Olive', hex: '#5b5f3a' },
  { name: 'Stone', hex: '#DDD8CE' },
  { name: 'Navy', hex: '#1f2a44' },
  { name: 'Lime', hex: '#B7FF43' },
  { name: 'Rust', hex: '#9e4a2e' },
  { name: 'Sage', hex: '#9caf88' },
  { name: 'Sand', hex: '#d8c4a0' },
  { name: 'Cobalt', hex: '#2b4cb8' },
  { name: 'Burgundy', hex: '#5e1f2a' },
  { name: 'Charcoal', hex: '#2d2d2d' },
];

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const allSizes = (stock = 12) => SIZES.map(size => ({ size, stock }));

/*
 * Image strategy:
 * Each variant gets an images[] array. images[0] is the primary/front view.
 * images[1], when present, is a second angle of the SAME model in the SAME shoot.
 * When no same-shoot pair is available, only one image is provided and the
 * hover system falls back to the primary image (no unrelated substitution).
 *
 * Same-shoot pairs verified from Pexels:
 * - BANDAR BAANT series (oversized printed tees, same studio, sequential IDs):
 *   36942017 + 36942018 (black oversized print, same model)
 *   37043496 + 37066864 (black oversized print, same model, different angle)
 *   36986582 + 37232797 (black graphic tee, same studio)
 *   37075908 + 37092621 (white printed tee, same studio)
 *   37186394 + 37247738 (black oversized print, same model)
 * - Ivan Ananiev series (burgundy tee, same model, sequential IDs):
 *   16495749 + 16495754 + 16495750 (burgundy tee, same model)
 * - F1 Digitals series (graphic tee + cap, same model, sequential IDs):
 *   14941588 + 14941596 + 14941605 (same model, same outfit)
 * - Jessica Nunes series (green tee, same model, sequential IDs):
 *   1983925 + 1983926 (green tee, same model)
 */

const makeVariants = (imgs: { color: string; images: string[] }[]) =>
  imgs.map(v => {
    const c = COLORS.find(x => x.name === v.color) ?? COLORS[0];
    return { color: v.color, hex: c.hex, images: v.images, sizes: allSizes() };
  });

export const CATEGORIES = [
  { slug: 'oversized', name: 'Oversized T-Shirts', blurb: 'Relaxed drops, boxy cuts and heavyweight feel.', image: 'https://images.pexels.com/photos/37043496/pexels-photo-37043496.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=800&h=1000' },
  { slug: 'graphics', name: 'Graphic T-Shirts', blurb: 'Original prints that say something.', image: 'https://images.pexels.com/photos/36942017/pexels-photo-36942017.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=800&h=1000' },
  { slug: 'essentials', name: 'Minimal Essentials', blurb: 'The everyday backbone of your rotation.', image: 'https://images.pexels.com/photos/17858295/pexels-photo-17858295.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=800&h=1000' },
  { slug: 'streetwear', name: 'Streetwear', blurb: 'Contemporary relaxed-fit street fashion.', image: 'https://images.pexels.com/photos/27348257/pexels-photo-27348257.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=800&h=1000' },
  { slug: 'regular', name: 'Regular Fit', blurb: 'Clean, classic, never out of place.', image: 'https://images.pexels.com/photos/4319139/pexels-photo-4319139.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=800&h=1000' },
  { slug: 'new-arrivals', name: 'New Arrivals', blurb: 'Fresh in this week.', image: 'https://images.pexels.com/photos/37186394/pexels-photo-37186394.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=800&h=1000' },
];

export const PRODUCTS: Product[] = [
  {
    id: 'p01', slug: 'midnight-oversized-tee',
    name: 'Midnight Oversized Tee',
    gender: 'men', categories: ['oversized', 'men'], price: 899, mrp: 1499, fit: 'Oversized', fabric: 'Heavyweight Cotton',
    description: 'A boxy, drop-shoulder tee cut from 240 GSM heavyweight cotton. Built to hold its shape wash after wash, with a relaxed silhouette that layers cleanly.',
    care: 'Machine wash cold, inside out. Do not bleach. Tumble dry low.',
    badge: 'Bestseller', bestseller: true, newArrival: false, createdAt: '2026-09-20',
    variants: makeVariants([
      { color: 'Black', images: [
        'https://images.pexels.com/photos/37043496/pexels-photo-37043496.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
        'https://images.pexels.com/photos/37066864/pexels-photo-37066864.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
      { color: 'Ivory', images: [
        'https://images.pexels.com/photos/17858295/pexels-photo-17858295.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
        'https://images.pexels.com/photos/17858292/pexels-photo-17858292.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
    ]),
  },
  {
    id: 'p02', slug: 'studio-essentials-tee',
    name: 'Studio Essentials Tee',
    gender: 'men', categories: ['essentials', 'men'], price: 699, mrp: 1099, fit: 'Regular', fabric: 'Cotton',
    description: 'Our signature everyday tee in 180 GSM combed cotton. Soft hand-feel, neat ribbed collar and a clean fit that works for any occasion.',
    care: 'Machine wash cold with similar colours. Dry in shade.',
    badge: 'Essential', bestseller: true, newArrival: false, createdAt: '2026-09-18',
    variants: makeVariants([
      { color: 'Ivory', images: [
        'https://images.pexels.com/photos/17858292/pexels-photo-17858292.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
        'https://images.pexels.com/photos/17858295/pexels-photo-17858295.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
      { color: 'Black', images: [
        'https://images.pexels.com/photos/31750388/pexels-photo-31750388.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
      { color: 'Sage', images: [
        'https://images.pexels.com/photos/15888763/pexels-photo-15888763.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
    ]),
  },
  {
    id: 'p03', slug: 'static-graphic-tee',
    name: 'Static Graphic Tee',
    gender: 'men', categories: ['graphics', 'men'], price: 999, mrp: 1599, fit: 'Regular', fabric: 'Cotton Blend',
    description: 'Front-print graphic tee with a soft-hand plastisol print that will not crack. A statement piece without being loud.',
    care: 'Machine wash cold, inside out. Do not iron print.',
    badge: 'Graphic', bestseller: false, newArrival: true, createdAt: '2026-10-10',
    variants: makeVariants([
      { color: 'Black', images: [
        'https://images.pexels.com/photos/36942017/pexels-photo-36942017.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
        'https://images.pexels.com/photos/36942018/pexels-photo-36942018.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
      { color: 'Charcoal', images: [
        'https://images.pexels.com/photos/14941588/pexels-photo-14941588.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
        'https://images.pexels.com/photos/14941596/pexels-photo-14941596.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
    ]),
  },
  {
    id: 'p05', slug: 'sunset-relaxed-tee',
    name: 'Sunset Relaxed Tee',
    gender: 'men', categories: ['regular', 'men', 'essentials'], price: 799, mrp: 1299, fit: 'Relaxed', fabric: 'Cotton',
    description: 'A relaxed-fit tee with a slightly wider body and a soft, lived-in feel from day one.',
    care: 'Machine wash cold. Tumble dry low.',
    badge: 'New', bestseller: false, newArrival: true, createdAt: '2026-10-14',
    variants: makeVariants([
      { color: 'Rust', images: [
        'https://images.pexels.com/photos/12565322/pexels-photo-12565322.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
      { color: 'Olive', images: [
        'https://images.pexels.com/photos/1983925/pexels-photo-1983925.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
        'https://images.pexels.com/photos/1983926/pexels-photo-1983926.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
    ]),
  },
  {
    id: 'p07', slug: 'heavy-french-terry-tee',
    name: 'Heavy French Terry Tee',
    gender: 'men', categories: ['streetwear', 'oversized'], price: 1199, mrp: 1899, fit: 'Oversized', fabric: 'French Terry',
    description: 'A structured French terry tee with a beefy hand-feel and a boxy shape. Equal parts hoodie energy and tee comfort.',
    care: 'Machine wash cold. Do not bleach.',
    badge: 'Street', bestseller: true, newArrival: false, createdAt: '2026-09-15',
    variants: makeVariants([
      { color: 'Charcoal', images: [
        'https://images.pexels.com/photos/7643904/pexels-photo-7643904.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
      { color: 'Stone', images: [
        'https://images.pexels.com/photos/19395490/pexels-photo-19395490.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
    ]),
  },
  {
    id: 'p08', slug: 'blank-canvas-essential-tee',
    name: 'Blank Canvas Essential Tee',
    gender: 'men', categories: ['essentials', 'men'], price: 599, mrp: 999, fit: 'Regular', fabric: 'Cotton',
    description: 'The no-frills daily tee. Clean finish, neat collar, the right amount of structure without being stiff.',
    care: 'Machine wash cold. Dry in shade.',
    badge: 'Essential', bestseller: true, newArrival: false, createdAt: '2026-09-10',
    variants: makeVariants([
      { color: 'Ivory', images: [
        'https://images.pexels.com/photos/24779116/pexels-photo-24779116.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
      { color: 'Black', images: [
        'https://images.pexels.com/photos/4969205/pexels-photo-4969205.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
      { color: 'Cobalt', images: [
        'https://images.pexels.com/photos/23285867/pexels-photo-23285867.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
    ]),
  },
  {
    id: 'p09', slug: 'after-hours-street-tee',
    name: 'After Hours Street Tee',
    gender: 'men', categories: ['streetwear', 'men', 'oversized'], price: 1099, mrp: 1799, fit: 'Oversized', fabric: 'Heavyweight Cotton',
    description: 'A drop-shoulder street tee with a longline hem and a heavy drape. Made for the night shift.',
    care: 'Machine wash cold, inside out.',
    badge: 'Street', bestseller: false, newArrival: true, createdAt: '2026-10-15',
    variants: makeVariants([
      { color: 'Black', images: [
        'https://images.pexels.com/photos/36986582/pexels-photo-36986582.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
        'https://images.pexels.com/photos/37232797/pexels-photo-37232797.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
      { color: 'Burgundy', images: [
        'https://images.pexels.com/photos/16495749/pexels-photo-16495749.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
        'https://images.pexels.com/photos/16495754/pexels-photo-16495754.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
    ]),
  },
  {
    id: 'p11', slug: 'monochrome-graphic-tee',
    name: 'Monochrome Graphic Tee',
    gender: 'men', categories: ['graphics', 'men'], price: 949, mrp: 1499, fit: 'Regular', fabric: 'Cotton',
    description: 'A bold monochrome front print on a midweight cotton tee. Designed in-house, printed to last.',
    care: 'Machine wash cold, inside out. Do not iron print.',
    badge: 'Graphic', bestseller: true, newArrival: false, createdAt: '2026-09-22',
    variants: makeVariants([
      { color: 'Ivory', images: [
        'https://images.pexels.com/photos/37075908/pexels-photo-37075908.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
        'https://images.pexels.com/photos/37092621/pexels-photo-37092621.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
      { color: 'Black', images: [
        'https://images.pexels.com/photos/14941596/pexels-photo-14941596.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
        'https://images.pexels.com/photos/14941605/pexels-photo-14941605.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
    ]),
  },
  {
    id: 'p13', slug: 'studio-slim-tee',
    name: 'Studio Slim Tee',
    gender: 'men', categories: ['regular', 'men'], price: 749, mrp: 1199, fit: 'Slim', fabric: 'Cotton Blend',
    description: 'A slim-fit tee with a clean, close-to-body cut. Great for layering or wearing on its own.',
    care: 'Machine wash cold.',
    badge: 'Essential', bestseller: false, newArrival: false, createdAt: '2026-09-01',
    variants: makeVariants([
      { color: 'Black', images: [
        'https://images.pexels.com/photos/30124372/pexels-photo-30124372.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
      { color: 'Ivory', images: [
        'https://images.pexels.com/photos/7597494/pexels-photo-7597494.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
    ]),
  },
  {
    id: 'p14', slug: 'french-terry-box-tee',
    name: 'French Terry Box Tee',
    gender: 'men', categories: ['streetwear', 'oversized'], price: 1299, mrp: 1999, fit: 'Oversized', fabric: 'French Terry',
    description: 'Our heaviest tee. A boxy French terry build with a structured shoulder and a clean, raw finish.',
    care: 'Machine wash cold. Reshape and dry flat.',
    badge: 'Limited', bestseller: true, newArrival: true, createdAt: '2026-10-16',
    variants: makeVariants([
      { color: 'Black', images: [
        'https://images.pexels.com/photos/37186394/pexels-photo-37186394.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
        'https://images.pexels.com/photos/37247738/pexels-photo-37247738.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
      { color: 'Stone', images: [
        'https://images.pexels.com/photos/28079571/pexels-photo-28079571.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
    ]),
  },
  {
    id: 'p17', slug: 'street-oversized-tee-men',
    name: 'Street Oversized Tee',
    gender: 'men', categories: ['streetwear', 'oversized', 'men'], price: 999, mrp: 1599, fit: 'Oversized', fabric: 'Heavyweight Cotton',
    description: 'A boxy street tee with an extended shoulder and a heavy 240 GSM body. Built for movement.',
    care: 'Machine wash cold, inside out.',
    badge: 'Street', bestseller: false, newArrival: false, createdAt: '2026-09-12',
    variants: makeVariants([
      { color: 'Black', images: [
        'https://images.pexels.com/photos/37066864/pexels-photo-37066864.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
        'https://images.pexels.com/photos/37043496/pexels-photo-37043496.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
      { color: 'Olive', images: [
        'https://images.pexels.com/photos/1983926/pexels-photo-1983926.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
        'https://images.pexels.com/photos/1983925/pexels-photo-1983925.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
    ]),
  },
  {
    id: 'p18', slug: 'neutral-relaxed-tee',
    name: 'Neutral Relaxed Tee',
    gender: 'men', categories: ['essentials', 'regular', 'men'], price: 749, mrp: 1199, fit: 'Relaxed', fabric: 'Cotton Blend',
    description: 'A relaxed tee in a neutral palette. Pre-shrunk and garment-dyed for a soft, lived-in finish.',
    care: 'Machine wash cold with similar colours.',
    badge: 'Essential', bestseller: false, newArrival: true, createdAt: '2026-10-11',
    variants: makeVariants([
      { color: 'Stone', images: [
        'https://images.pexels.com/photos/19395490/pexels-photo-19395490.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
      { color: 'Sand', images: [
        'https://images.pexels.com/photos/13651272/pexels-photo-13651272.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=600&h=800',
      ]},
    ]),
  },
];

export const COLLECTIONS = [
  { slug: 'shop-all', name: 'Shop All', blurb: 'Every TriosWorld tee, in one place.' },
  { slug: 'men', name: "Men's T-Shirts", blurb: 'Oversized, regular and street cuts for men.' },
  { slug: 'oversized', name: 'Oversized T-Shirts', blurb: 'Boxy fits, drop shoulders, heavyweight feel.' },
  { slug: 'graphics', name: 'Graphic Tees', blurb: 'Original in-house prints and typography.' },
  { slug: 'essentials', name: 'Minimal Essentials', blurb: 'The everyday backbone of your rotation.' },
  { slug: 'streetwear', name: 'Streetwear', blurb: 'Contemporary relaxed-fit street fashion.' },
  { slug: 'new-arrivals', name: 'New Arrivals', blurb: 'Fresh drops, latest prints and fits.' },
  { slug: 'bestsellers', name: 'Bestsellers', blurb: 'What everyone is wearing right now.' },
];

export function discountPercent(p: Product): number {
  return Math.round(((p.mrp - p.price) / p.mrp) * 100);
}

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find(p => p.slug === slug);
}

export function productsForCollection(slug: string): Product[] {
  if (slug === 'shop-all') return PRODUCTS;
  if (slug === 'bestsellers') return PRODUCTS.filter(p => p.bestseller);
  if (slug === 'new-arrivals') return PRODUCTS.filter(p => p.newArrival);
  return PRODUCTS.filter(p => p.categories.includes(slug));
}

export function relatedProducts(p: Product, n = 4): Product[] {
  return PRODUCTS.filter(x => x.id !== p.id && x.categories.some(c => p.categories.includes(c))).slice(0, n);
}

export function searchProducts(q: string): Product[] {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  return PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(t) ||
    p.categories.some(c => c.includes(t)) ||
    p.gender.includes(t) ||
    p.fit.toLowerCase().includes(t) ||
    p.variants.some(v => v.color.toLowerCase().includes(t))
  );
}

export const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

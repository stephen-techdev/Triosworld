import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { PRODUCTS, type Product } from '@/data/catalog';

export interface CartItem {
  productId: string;
  color: string;
  size: string;
  qty: number;
}

interface StoreState {
  cart: CartItem[];
  wishlist: string[];
}

type Action =
  | { type: 'ADD_TO_CART'; item: CartItem }
  | { type: 'UPDATE_QTY'; productId: string; color: string; size: string; qty: number }
  | { type: 'REMOVE_FROM_CART'; productId: string; color: string; size: string }
  | { type: 'CLEAR_CART' }
  | { type: 'TOGGLE_WISHLIST'; productId: string }
  | { type: 'HYDRATE'; state: StoreState };

const STORAGE_KEY = 'triosworld-store-v1';

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const existing = state.cart.find(
        i => i.productId === action.item.productId && i.color === action.item.color && i.size === action.item.size
      );
      if (existing) {
        return {
          ...state,
          cart: state.cart.map(i =>
            i === existing ? { ...i, qty: Math.min(i.qty + action.item.qty, 10) } : i
          ),
        };
      }
      return { ...state, cart: [...state.cart, { ...action.item, qty: Math.min(action.item.qty, 10) }] };
    }
    case 'UPDATE_QTY':
      return {
        ...state,
        cart: state.cart.map(i =>
          i.productId === action.productId && i.color === action.color && i.size === action.size
            ? { ...i, qty: Math.max(1, Math.min(action.qty, 10)) }
            : i
        ),
      };
    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: state.cart.filter(
          i => !(i.productId === action.productId && i.color === action.color && i.size === action.size)
        ),
      };
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    case 'TOGGLE_WISHLIST':
      return {
        ...state,
        wishlist: state.wishlist.includes(action.productId)
          ? state.wishlist.filter(id => id !== action.productId)
          : [...state.wishlist, action.productId],
      };
    case 'HYDRATE':
      return action.state;
    default:
      return state;
  }
}

interface StoreContextValue {
  cart: CartItem[];
  wishlist: string[];
  cartCount: number;
  subtotal: number;
  addToCart: (item: CartItem) => void;
  updateQty: (productId: string, color: string, size: string, qty: number) => void;
  removeFromCart: (productId: string, color: string, size: string) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { cart: [], wishlist: [] });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoreState;
        dispatch({ type: 'HYDRATE', state: { cart: parsed.cart ?? [], wishlist: parsed.wishlist ?? [] } });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const value = useMemo<StoreContextValue>(() => {
    const cartCount = state.cart.reduce((s, i) => s + i.qty, 0);
    const subtotal = state.cart.reduce((s, i) => {
      const p = PRODUCTS.find(x => x.id === i.productId);
      return s + (p ? p.price * i.qty : 0);
    }, 0);
    return {
      cart: state.cart,
      wishlist: state.wishlist,
      cartCount,
      subtotal,
      addToCart: item => dispatch({ type: 'ADD_TO_CART', item }),
      updateQty: (productId, color, size, qty) => dispatch({ type: 'UPDATE_QTY', productId, color, size, qty }),
      removeFromCart: (productId, color, size) => dispatch({ type: 'REMOVE_FROM_CART', productId, color, size }),
      clearCart: () => dispatch({ type: 'CLEAR_CART' }),
      toggleWishlist: productId => dispatch({ type: 'TOGGLE_WISHLIST', productId }),
      isWishlisted: productId => state.wishlist.includes(productId),
    };
  }, [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export function resolveProduct(id: string): Product | undefined {
  return PRODUCTS.find(p => p.id === id);
}

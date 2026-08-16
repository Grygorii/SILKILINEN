'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { trackAddToCart, trackRemoveFromCart } from '@/lib/analytics';

// A cart line is either a regular product OR a bundle — never both. Bundle
// lines set `bundleId` + `includedProducts` (read-only sub-list shown under
// the line in the cart UI) and ignore colour/size. The backend recomputes
// bundle price at checkout — `price` here is just for display.
type IncludedProduct = {
  productId: string;
  name: string;
  quantity: number;
};

type CartItem = {
  productId?: string;
  bundleId?: string;
  includedProducts?: IncludedProduct[];
  name: string;
  price: number;
  colour: string;
  size: string;
  quantity: number;
  stock?: number;
  image?: string;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  cartCount: number;
  updateQuantity: (index: number, delta: number) => void;
};

const CartContext = createContext<CartContextType>({
  cart: [],
  addToCart: () => {},
  removeFromCart: () => {},
  clearCart: () => {},
  cartCount: 0,
  updateQuantity: () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  // The cart cannot be read during SSR, so it hydrates from localStorage after
  // mount. That left a window where the SAVED cart was overwritten by the
  // EMPTY one: effects run in declaration order after the same commit, so the
  // writer below fired with cart === [] before the reader's state update had
  // landed, storing '[]' over a real cart. It self-healed on the next render,
  // but a customer who closed the tab in that instant lost their basket — and
  // under StrictMode's double-invoked effects the window is hit every time.
  //
  // The writer now waits until hydration has actually happened.
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cart');
      if (saved) setCart(JSON.parse(saved));
    } catch { /* corrupt JSON — start with an empty cart rather than crashing */ }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  function addToCart(item: CartItem) {
    // productId is what makes the per-product funnel analysis possible — which
    // pieces people open and never add. Without it those aggregations match
    // nothing and silently return empty.
    trackAddToCart({ name: item.name, price: item.price, productId: item.productId });

    const maxQty = Math.min(item.stock ?? 10, 10);
    const matchFn = (i: CartItem) => {
      if (item.bundleId) return i.bundleId === item.bundleId;
      if (item.productId) return i.productId === item.productId && i.colour === item.colour && i.size === item.size;
      return i.name === item.name && i.colour === item.colour && i.size === item.size;
    };

    // Compute event before setState to avoid side effects in updater
    const existing = cart.find(matchFn);
    let eventName = 'cartItemAdded';
    let eventDetail = item.name;
    if (existing) {
      const desired = existing.quantity + item.quantity;
      const newQty = Math.min(desired, maxQty);
      if (newQty < desired) {
        eventName = 'cartCapped';
        eventDetail = newQty >= 10
          ? 'Maximum 10 per order.'
          : `Only ${newQty} in stock. Cart updated to maximum available.`;
      }
    }

    setCart(prev => {
      const ex = prev.find(matchFn);
      if (ex) {
        const newQty = Math.min(ex.quantity + item.quantity, maxQty);
        return prev.map(i => matchFn(i) ? { ...i, quantity: newQty } : i);
      }
      return [...prev, { ...item, quantity: Math.min(item.quantity, maxQty) }];
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(eventName, { detail: eventDetail }));
    }
  }

  function removeFromCart(index: number) {
    setCart(prev => {
      const item = prev[index];
      if (item) trackRemoveFromCart(item.name, item.price);
      return prev.filter((_, i) => i !== index);
    });
  }

  function clearCart() {
    setCart([]);
  }

  function updateQuantity(index: number, delta: number) {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const maxQty = Math.min(item.stock ?? 10, 10);
      const newQty = Math.min(Math.max(1, item.quantity + delta), maxQty);
      return { ...item, quantity: newQty };
    }));
  }

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, cartCount, updateQuantity }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}

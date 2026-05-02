'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { trackAddToCart, trackRemoveFromCart } from '@/lib/analytics';

type CartItem = {
  name: string;
  price: number;
  colour: string;
  size: string;
  quantity: number;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  cartCount: number;
};

const CartContext = createContext<CartContextType>({
  cart: [],
  addToCart: () => {},
  removeFromCart: () => {},
  clearCart: () => {},
  cartCount: 0,
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) setCart(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  function addToCart(item: CartItem) {
    trackAddToCart({ name: item.name, price: item.price });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cartItemAdded', { detail: item.name }));
    }
    setCart(prev => {
      const existing = prev.find(i => i.name === item.name && i.colour === item.colour && i.size === item.size);
      if (existing) {
        return prev.map(i =>
          i.name === item.name && i.colour === item.colour && i.size === item.size
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
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

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
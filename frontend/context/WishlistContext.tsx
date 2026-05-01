'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type WishlistContextType = {
  wishlist: string[];
  toggle: (id: string) => void;
  isWished: (id: string) => boolean;
  count: number;
};

const WishlistContext = createContext<WishlistContextType>({
  wishlist: [],
  toggle: () => {},
  isWished: () => false,
  count: 0,
});

const KEY = 'silkilinen_wishlist';

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [wishlist, setWishlist] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setWishlist(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const toggle = useCallback((id: string) => {
    setWishlist(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isWished = useCallback((id: string) => wishlist.includes(id), [wishlist]);

  return (
    <WishlistContext.Provider value={{ wishlist, toggle, isWished, count: wishlist.length }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}

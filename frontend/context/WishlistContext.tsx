'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useCustomer } from './CustomerContext';

const API = process.env.NEXT_PUBLIC_API_URL;
const LS_KEY = 'silkilinen_wishlist';

export type WishlistProduct = {
  _id: string;
  name: string;
  price: number;
  image?: string;
  category?: string;
};

type WishlistContextType = {
  wishlist: string[];
  items: WishlistProduct[];
  count: number;
  toggle: (id: string) => void;
  isWished: (id: string) => boolean;
  loading: boolean;
};

const WishlistContext = createContext<WishlistContextType>({
  wishlist: [],
  items: [],
  count: 0,
  toggle: () => {},
  isWished: () => false,
  loading: false,
});

function lsGet(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function lsSet(ids: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(ids));
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { customer, loading: customerLoading } = useCustomer();
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [items, setItems] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const prevCustomerId = useRef<string | null>(null);

  const fetchFromApi = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/customers/me/wishlist`, { credentials: 'include' });
      if (res.ok) {
        const data: WishlistProduct[] = await res.json();
        setItems(data);
        setWishlist(data.map(p => p._id));
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  // Hydrate from localStorage immediately on mount
  useEffect(() => {
    setWishlist(lsGet());
  }, []);

  // Handle auth transitions (login / logout / initial load while logged in)
  useEffect(() => {
    if (customerLoading) return;

    const prevId = prevCustomerId.current;
    const currId = customer?._id ?? null;
    if (prevId === currId) return;
    prevCustomerId.current = currId;

    if (currId) {
      // Logged in: sync any localStorage items then fetch from API
      const localIds = lsGet();
      if (localIds.length > 0) {
        fetch(`${API}/api/customers/me/wishlist/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ids: localIds }),
        }).catch(() => {}).finally(() => {
          lsSet([]);
          fetchFromApi();
        });
      } else {
        fetchFromApi();
      }
    } else if (prevId) {
      // Logged out: revert to localStorage
      setWishlist(lsGet());
      setItems([]);
    }
  }, [customer, customerLoading, fetchFromApi]);

  const toggle = useCallback((id: string) => {
    if (!customer) {
      setWishlist(prev => {
        const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
        lsSet(next);
        return next;
      });
      return;
    }

    const isWishedNow = wishlist.includes(id);
    if (isWishedNow) {
      // Optimistic remove
      setWishlist(prev => prev.filter(x => x !== id));
      setItems(prev => prev.filter(p => p._id !== id));
      fetch(`${API}/api/customers/me/wishlist/${id}`, { method: 'DELETE', credentials: 'include' })
        .catch(() => fetchFromApi()); // revert on network error
    } else {
      // Optimistic add (ID only; fetch to get populated data)
      setWishlist(prev => [...prev, id]);
      fetch(`${API}/api/customers/me/wishlist/${id}`, { method: 'POST', credentials: 'include' })
        .then(() => fetchFromApi())
        .catch(() => setWishlist(prev => prev.filter(x => x !== id)));
    }
  }, [customer, wishlist, fetchFromApi]);

  const isWished = useCallback((id: string) => wishlist.includes(id), [wishlist]);

  return (
    <WishlistContext.Provider value={{ wishlist, items, count: wishlist.length, toggle, isWished, loading }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}

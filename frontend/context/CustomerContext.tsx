'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL;
const CUSTOMER_ID_KEY = 'silkilinen_customer_id';

export type CustomerAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  country?: string;
};

export type Customer = {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  defaultShippingAddress: CustomerAddress | null;
  marketingConsent: boolean;
  emailVerified: boolean;
  wishlist: string[];
  createdAt: string;
};

type CustomerContextType = {
  customer: Customer | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const CustomerContext = createContext<CustomerContextType>({
  customer: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/customers/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCustomer(data);
        localStorage.setItem(CUSTOMER_ID_KEY, data._id);
      } else {
        setCustomer(null);
        localStorage.removeItem(CUSTOMER_ID_KEY);
      }
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signOut = useCallback(async () => {
    await fetch(`${API}/api/customers/logout`, { method: 'POST', credentials: 'include' });
    setCustomer(null);
    localStorage.removeItem(CUSTOMER_ID_KEY);
  }, []);

  return (
    <CustomerContext.Provider value={{ customer, loading, refresh, signOut }}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  return useContext(CustomerContext);
}

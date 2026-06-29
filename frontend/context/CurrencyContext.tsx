'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL;
const STORAGE_KEY = 'slk_currency';

type Currency = { code: string; symbol: string; label: string };

type CurrencyCtx = {
  currency: string;            // selected code, e.g. 'GBP'
  symbol: string;
  rate: number;                // EUR -> selected
  currencies: Currency[];
  setCurrency: (code: string) => void;
  format: (eurAmount: number) => string;   // EUR amount -> "£158.00"
  ready: boolean;
};

const FALLBACK: Currency[] = [
  { code: 'EUR', symbol: '€', label: 'EUR' },
  { code: 'GBP', symbol: '£', label: 'GBP' },
  { code: 'USD', symbol: '$', label: 'USD' },
];

const Ctx = createContext<CurrencyCtx>({
  currency: 'EUR', symbol: '€', rate: 1, currencies: FALLBACK,
  setCurrency: () => {}, format: (e) => `€${e.toFixed(2)}`, ready: false,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState('EUR');
  // Seed with recent fallbacks so a pre-fetch conversion is still about right;
  // /api/rates replaces these with live ECB rates on mount.
  const [rates, setRates] = useState<Record<string, number>>({ EUR: 1, GBP: 0.84, USD: 1.08 });
  const [currencies, setCurrencies] = useState<Currency[]>(FALLBACK);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCurrencyState(saved);
    } catch { /* ignore */ }
    let alive = true;
    fetch(`${API}/api/rates`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive || !d) return;
        if (d.rates) setRates(d.rates);
        if (Array.isArray(d.currencies) && d.currencies.length) setCurrencies(d.currencies);
      })
      .catch(() => {})
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  }, []);

  const meta = currencies.find(c => c.code === currency) || FALLBACK[0];
  const rate = rates[currency] ?? 1;
  const symbol = meta.symbol;

  const format = useCallback((eurAmount: number) => {
    const v = (Number(eurAmount) || 0) * (rates[currency] ?? 1);
    const sym = (currencies.find(c => c.code === currency) || FALLBACK[0]).symbol;
    return `${sym}${v.toFixed(2)}`;
  }, [currency, rates, currencies]);

  return (
    <Ctx.Provider value={{ currency, symbol, rate, currencies, setCurrency, format, ready }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCurrency() {
  return useContext(Ctx);
}

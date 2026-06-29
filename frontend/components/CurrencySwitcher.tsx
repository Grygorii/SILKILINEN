'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCurrency } from '@/context/CurrencyContext';
import styles from './CurrencySwitcher.module.css';

export default function CurrencySwitcher() {
  const { currency, symbol, currencies, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Currency: ${currency}`}
      >
        <span>{currency}</span>
        <span className={styles.sym}>{symbol}</span>
        <ChevronDown size={13} strokeWidth={1.5} className={`${styles.chev} ${open ? styles.chevOpen : ''}`} />
      </button>
      {open && (
        <ul className={styles.menu} role="listbox">
          {currencies.map(c => (
            <li key={c.code}>
              <button
                type="button"
                role="option"
                aria-selected={c.code === currency}
                className={`${styles.item} ${c.code === currency ? styles.itemOn : ''}`}
                onClick={() => { setCurrency(c.code); setOpen(false); }}
              >
                <span>{c.label}</span>
                <span className={styles.sym}>{c.symbol}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

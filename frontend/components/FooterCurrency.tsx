'use client';

import { useCurrency } from '@/context/CurrencyContext';
import styles from './FooterCurrency.module.css';

// Inline currency selector for the footer — the mobile access point (the header
// switcher is desktop-only). Plain toggles, no dropdown, so it sits cleanly at
// the page foot.
export default function FooterCurrency() {
  const { currency, currencies, setCurrency } = useCurrency();
  return (
    <div className={styles.row}>
      <span className={styles.label}>Currency</span>
      <div className={styles.opts}>
        {currencies.map(c => (
          <button
            key={c.code}
            type="button"
            className={`${styles.opt} ${c.code === currency ? styles.optOn : ''}`}
            onClick={() => setCurrency(c.code)}
            aria-pressed={c.code === currency}
          >
            {c.code} <span className={styles.sym}>{c.symbol}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

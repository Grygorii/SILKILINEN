'use client';

import { useState } from 'react';
import { useProductSelection } from './ProductSelectionContext';
import styles from './NotifyWhenBack.module.css';

/**
 * Back-in-stock waitlist form — the ONE owner.
 *
 * This was written inline inside ProductOptions, so only the desktop panel had
 * it. The mobile sticky bar — which IS the call to action on a phone — still
 * fired the `mailto:` the waitlist was built to replace, and that mailto has
 * two failure modes recorded in ProductOptions' own comment: on a device with
 * no mail client configured it does nothing at all, and when it does work it
 * lands in an inbox nobody watches for restocks.
 *
 * So the shop's clearest buying signal — a customer naming the exact piece and
 * size they want — was captured on desktop and dropped on mobile, which is
 * where most of them are.
 *
 * Size and colour come from ProductSelectionContext rather than props: both
 * call sites live inside the provider, and passing them would let the two
 * disagree about what the customer had chosen.
 */
export default function NotifyWhenBack({ productId }: { productId: string }) {
  const { selectedSize, selectedColour } = useProductSelection();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stock-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          email: email.trim(),
          size: selectedSize || '',
          colour: selectedColour || '',
        }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return <p className={styles.done}>We’ll email you the moment it’s back.</p>;
  }

  // Unique per product so two of these on one page (panel + sticky bar) never
  // share an id — a duplicate id points both labels at the first input.
  const inputId = `notify-${productId}`;

  return (
    <form onSubmit={submit} className={styles.form}>
      <label htmlFor={inputId} className="srOnly">Email address for restock notice</label>
      <input
        id={inputId}
        name="notifyEmail"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="you@example.com"
        className={styles.input}
      />
      <button type="submit" disabled={state === 'sending'} className={styles.submit}>
        {state === 'sending' ? 'Adding…' : 'Notify me'}
      </button>
      {state === 'error' && (
        <p className={styles.error}>That didn’t go through. Please try again.</p>
      )}
    </form>
  );
}

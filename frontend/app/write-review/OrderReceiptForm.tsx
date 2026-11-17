'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import styles from './OrderReceiptForm.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Receipt = {
  confirmed: boolean;
  items: { id: string; name: string; href: string }[];
};

async function requestReceipt(action: 'check' | 'confirm', signal?: AbortSignal): Promise<Receipt> {
  const token = window.location.hash.slice(1);
  if (!token) throw new Error('Please open the original link from your order email.');

  const response = await fetch(`${API}/api/reviews/order-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    cache: 'no-store',
    body: JSON.stringify({ token, action }),
    signal,
  });
  if (response.status === 401) throw new Error('This link has expired or is no longer valid.');
  if (!response.ok) throw new Error('We couldn’t open your order. Please try again shortly.');
  return response.json();
}

export default function OrderReceiptForm({ supportEmail, reviewOnly }: { supportEmail: string; reviewOnly: boolean }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    requestReceipt('check', controller.signal).then(data => {
      if (!controller.signal.aborted) setReceipt(data);
    }).catch((err: Error) => {
      if (!controller.signal.aborted) setError(err.message);
    });
    return () => controller.abort();
  }, []);

  async function confirmReceipt() {
    setError('');
    setSaving(true);
    try {
      setReceipt(await requestReceipt('confirm'));
    } catch {
      setError('We couldn’t confirm receipt. Please try again or contact us for help.');
    } finally {
      setSaving(false);
    }
  }

  const canReview = receipt && (reviewOnly || receipt.confirmed);
  return (
    <section className={styles.panel} aria-labelledby="order-receipt-title">
      <p className={styles.brand}>SILKILINEN</p>
      <h1 id="order-receipt-title" aria-live="polite">
        {reviewOnly ? 'Review your order' : receipt?.confirmed ? 'Thank you for confirming' : 'Has your order arrived?'}
      </h1>
      {!receipt && !error && <p role="status">Opening your order…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {receipt && !reviewOnly && !receipt.confirmed && (
        <>
          <p>Let us know if your parcel has reached you.</p>
          <Button onClick={confirmReceipt} disabled={saving}>
            {saving ? 'Confirming…' : 'Yes, I’ve received it'}
          </Button>
        </>
      )}
      {canReview && (
        <>
          {!reviewOnly && <p>We’ve recorded that your order arrived.</p>}
          {receipt.items.length ? (
            <>
              <p>How are you finding your pieces? Choose an item to leave a review.</p>
              <ul className={styles.items}>
                {receipt.items.map(item => <li key={item.id}><a href={item.href}>{item.name}</a></li>)}
              </ul>
            </>
          ) : <p>There are no items awaiting a review for this order.</p>}
        </>
      )}
      <p className={styles.help}>Still waiting or need help? <a href={`mailto:${supportEmail}`}>Contact us</a>.</p>
    </section>
  );
}

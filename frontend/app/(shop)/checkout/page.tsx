'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCart } from '@/context/CartContext';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import styles from './page.module.css';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
const API = process.env.NEXT_PUBLIC_API_URL;

// ── Types ─────────────────────────────────────────────────────────────────────

type ShippingInfo = {
  cost: number;
  label: string;
  isFree: boolean;
};

type OrderSummary = {
  subtotal: number;
  discountCode: string | null;
  discountAmount: number;
  shipping: ShippingInfo;
  total: number;
};

// ── Country options ───────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: 'IE', label: 'Ireland' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'IT', label: 'Italy' },
  { code: 'ES', label: 'Spain' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'BE', label: 'Belgium' },
  { code: 'AT', label: 'Austria' },
  { code: 'SE', label: 'Sweden' },
  { code: 'NO', label: 'Norway' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'DK', label: 'Denmark' },
  { code: 'FI', label: 'Finland' },
  { code: 'PT', label: 'Portugal' },
  { code: 'PL', label: 'Poland' },
];

// ── Payment form ──────────────────────────────────────────────────────────────

function PaymentForm({
  summary,
  onSuccess,
}: {
  summary: OrderSummary;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/success`,
      },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message || 'Payment failed. Please try again.');
      setSubmitting(false);
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.paymentForm}>
      <PaymentElement />
      {error && <p className={styles.payError}>{error}</p>}
      <button type="submit" className={styles.payBtn} disabled={!stripe || submitting}>
        {submitting ? 'Processing…' : `Pay €${summary.total.toFixed(2)}`}
      </button>
    </form>
  );
}

// ── Main checkout page ────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const { cart, clearCart } = useCart();
  const [country, setCountry] = useState('IE');
  const [discountInput, setDiscountInput] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [intentError, setIntentError] = useState('');
  const [discountError, setDiscountError] = useState('');
  const [appliedCode, setAppliedCode] = useState('');

  const createIntent = useCallback(async (discountCode?: string) => {
    if (cart.length === 0) return;
    setLoading(true);
    setIntentError('');
    try {
      const attribution = (() => {
        try { return JSON.parse(localStorage.getItem('attribution') || '{}'); } catch { return {}; }
      })();

      const res = await fetch(`${API}/api/v2/checkout/create-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(i => ({
            productId: i.productId,
            name: i.name,
            quantity: i.quantity,
            colour: i.colour,
            size: i.size,
          })),
          shippingCountry: country,
          discountCode: discountCode || undefined,
          attribution,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setIntentError(err.error || 'Could not initialise checkout');
        return;
      }

      const data = await res.json();
      setClientSecret(data.clientSecret);
      setSummary(data.orderSummary);
      if (data.orderSummary.discountCode) {
        setAppliedCode(data.orderSummary.discountCode);
      }
    } catch {
      setIntentError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [cart, country]);

  // Re-create intent when country changes
  useEffect(() => {
    createIntent(appliedCode || undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  // Initial load
  useEffect(() => {
    createIntent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyDiscount() {
    setDiscountError('');
    if (!discountInput.trim()) return;
    await createIntent(discountInput.trim());
    if (!summary?.discountCode) {
      setDiscountError('Invalid or expired discount code');
    }
  }

  function handleSuccess() {
    clearCart();
    window.location.href = '/success';
  }

  if (cart.length === 0) {
    return (
      <main className={styles.page}>
        <div className={styles.empty}>
          <p>Your cart is empty.</p>
          <a href="/shop" className={styles.shopLink}>← Back to shop</a>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Checkout</h1>

      <div className={styles.layout}>
        {/* Left — payment */}
        <div className={styles.paymentCol}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Shipping destination</h2>
            <select
              className={styles.select}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
              <option value="OTHER">Other country</option>
            </select>
            <p className={styles.hint}>
              Don&apos;t see your country? Select &ldquo;Other country&rdquo; — we ship worldwide.
            </p>
          </section>

          {intentError && (
            <p className={styles.intentError}>{intentError}</p>
          )}

          {clientSecret && summary && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Payment</h2>
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      fontFamily: '"Gill Sans", "Gill Sans MT", Calibri, "Trebuchet MS", sans-serif',
                      colorPrimary: '#1a1916',
                      borderRadius: '0px',
                    },
                  },
                }}
              >
                <PaymentForm summary={summary} onSuccess={handleSuccess} />
              </Elements>
            </section>
          )}

          {loading && !clientSecret && (
            <p className={styles.loadingMsg}>Preparing secure payment…</p>
          )}
        </div>

        {/* Right — order summary */}
        <aside className={styles.summaryCol}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Order summary</h2>
            <ul className={styles.itemList}>
              {cart.map((item, i) => (
                <li key={i} className={styles.item}>
                  <div className={styles.itemMeta}>
                    <p className={styles.itemName}>{item.name}</p>
                    {(item.colour || item.size) && (
                      <p className={styles.itemVariant}>
                        {[item.colour, item.size].filter(Boolean).join(' / ')}
                      </p>
                    )}
                    <p className={styles.itemQty}>Qty: {item.quantity}</p>
                  </div>
                  <p className={styles.itemPrice}>€{(item.price * item.quantity).toFixed(2)}</p>
                </li>
              ))}
            </ul>

            {/* Discount code */}
            <div className={styles.discountRow}>
              <input
                className={styles.discountInput}
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="Discount code"
                onKeyDown={(e) => e.key === 'Enter' && applyDiscount()}
              />
              <button className={styles.discountBtn} onClick={applyDiscount} disabled={loading}>
                Apply
              </button>
            </div>
            {discountError && <p className={styles.discountError}>{discountError}</p>}
            {appliedCode && summary?.discountAmount && summary.discountAmount > 0 && (
              <p className={styles.discountApplied}>{appliedCode} — −€{summary.discountAmount.toFixed(2)}</p>
            )}

            {summary && (
              <div className={styles.totals}>
                <div className={styles.totalRow}>
                  <span>Subtotal</span>
                  <span>€{summary.subtotal.toFixed(2)}</span>
                </div>
                {summary.discountAmount > 0 && (
                  <div className={`${styles.totalRow} ${styles.discount}`}>
                    <span>Discount ({summary.discountCode})</span>
                    <span>−€{summary.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className={styles.totalRow}>
                  <span>Shipping — {summary.shipping.label}</span>
                  <span>{summary.shipping.isFree ? 'FREE' : `€${summary.shipping.cost.toFixed(2)}`}</span>
                </div>
                <div className={`${styles.totalRow} ${styles.grandTotal}`}>
                  <span>Total</span>
                  <span>€{summary.total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

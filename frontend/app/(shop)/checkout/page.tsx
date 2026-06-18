'use client';

import { useState, useEffect, useRef } from 'react';
import { useCart } from '@/context/CartContext';
import { trackBeginCheckout } from '@/lib/analytics';
import { useCustomer } from '@/context/CustomerContext';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  AddressElement,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import Button from '@/components/ui/Button';
import GoogleCheckoutSignIn from '@/components/GoogleCheckoutSignIn';
import styles from './page.module.css';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
const API = process.env.NEXT_PUBLIC_API_URL;

type ShippingInfo = { cost: number; label: string; isFree: boolean };
type OrderSummary = {
  subtotal: number;
  discountCode: string | null;
  discountAmount: number;
  // Specific validation message from the backend when a code is rejected.
  // null when accepted, or when no code was attempted.
  discountError?: string | null;
  shipping: ShippingInfo;
  total: number;
};

// All countries covered by our shipping tiers
const ALLOWED_COUNTRIES = [
  'IE',
  'GB', 'IM', 'JE', 'GG',
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'US', 'CA', 'AU', 'NZ',
  'CH', 'NO', 'IS',
] as const;

// ── Payment + address form (must be inside <Elements>) ────────────────────────

function PaymentForm({
  summary,
  onSuccess,
  onCountryChange,
  defaultEmail,
  defaultName,
  defaultPhone,
  defaultAddress,
  prefillVersion,
  onBeforeSubmit,
}: {
  summary: OrderSummary;
  onSuccess: () => void;
  onCountryChange: (country: string) => void;
  defaultEmail: string;
  defaultName?: string;
  defaultPhone?: string;
  defaultAddress?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } | null;
  // Bump when the signed-in identity changes so AddressElement re-mounts
  // and picks up the new defaultValues (Stripe Elements don't update
  // their defaults after mount).
  prefillVersion: number;
  onBeforeSubmit: (email: string) => Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [emailError, setEmailError] = useState('');

  // Pre-fill when logged-in customer loads after mount
  useEffect(() => {
    if (defaultEmail && !email) setEmail(defaultEmail);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultEmail]);

  // Conservative email regex — must have local@domain.tld with a real
  // TLD. Catches typos ("foo@bar", "foo@bar.") that HTML5 `type=email`
  // sometimes lets through. Won't catch valid-but-rare addresses; if a
  // real customer hits it we tighten or relax later.
  function isValidEmail(value: string): boolean {
    const trimmed = value.trim();
    if (trimmed.length < 5 || trimmed.length > 254) return false;
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(trimmed);
  }

  function handleEmailBlur() {
    if (email.trim() && !isValidEmail(email)) {
      setEmailError('Please enter a valid email address (e.g. you@example.com).');
    } else {
      setEmailError('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address.');
      setError('Please enter a valid email address.');
      return;
    }
    setEmailError('');

    setSubmitting(true);
    setError('');

    // Persist email to PaymentIntent before confirming so webhook can read it
    await onBeforeSubmit(email.trim());

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/success` },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message || 'Payment failed. Please try again.');
      setSubmitting(false);
    } else {
      onSuccess();
    }
  }

  // Build the AddressElement defaultValues from any data we know about
  // the signed-in customer. Stripe's AddressElement reads these on mount
  // only — the parent re-mounts via prefillVersion when sign-in happens
  // mid-checkout so the defaults take effect.
  const addressDefaults = defaultName || defaultAddress
    ? {
        name: defaultName,
        phone: defaultPhone,
        address: {
          line1: defaultAddress?.line1 || '',
          line2: defaultAddress?.line2 || '',
          city: defaultAddress?.city || '',
          state: defaultAddress?.state || '',
          postal_code: defaultAddress?.postal_code || '',
          country: defaultAddress?.country || 'IE',
        },
      }
    : { address: { country: 'IE' as const } };

  return (
    <form onSubmit={handleSubmit} className={styles.paymentForm}>
      <h2 className={styles.sectionTitle}>Contact</h2>
      <div>
        <label className={styles.fieldLabel} htmlFor="checkout-email">
          Email address <span className={styles.req} aria-hidden="true">*</span>
        </label>
        <input
          id="checkout-email"
          type="email"
          required
          className={styles.emailInput}
          value={email}
          onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
          onBlur={handleEmailBlur}
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={!!emailError}
        />
        {emailError && (
          <p style={{ marginTop: 6, fontSize: 12, color: '#c9572a' }}>{emailError}</p>
        )}
      </div>

      <div>
        <h2 className={styles.sectionTitle} style={{ marginBottom: 6 }}>Delivery address</h2>
        <p className={styles.requiredNote}>All fields are required unless shown as optional.</p>
      </div>
      <AddressElement
        key={prefillVersion}
        options={{
          mode: 'shipping',
          allowedCountries: [...ALLOWED_COUNTRIES],
          // Phone is shown but the customer can leave it blank — every
          // other address field stays required by Stripe's per-country
          // rules (name, line1, city, state where applicable, postcode).
          fields: { phone: 'always' },
          validation: { phone: { required: 'never' } },
          defaultValues: addressDefaults,
        }}
        onChange={(event) => {
          const country = event.value?.address?.country;
          if (country) onCountryChange(country);
        }}
      />

      <h2 className={styles.sectionTitle} style={{ marginTop: '28px' }}>Payment</h2>
      <PaymentElement options={{ layout: 'tabs' }} />

      {error && <p className={styles.payError}>{error}</p>}
      <Button
        type="submit"
        variant={(!stripe || submitting) ? 'disabled' : 'primary'}
      >
        {submitting ? 'PROCESSING…' : `PAY €${summary.total.toFixed(2)}`}
      </Button>
    </form>
  );
}

// ── Main checkout page ────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const { cart, clearCart } = useCart();
  const { customer, refresh: refreshCustomer } = useCustomer();
  const [discountInput, setDiscountInput] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [intentError, setIntentError] = useState('');

  // Fire begin_checkout once when the page loads with items (first-party funnel
  // + GA4). Cart subtotal is the right value here — discounts/shipping aren't
  // known yet at this funnel stage.
  const beginCheckoutFired = useRef(false);
  useEffect(() => {
    if (beginCheckoutFired.current || cart.length === 0) return;
    beginCheckoutFired.current = true;
    const value = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const count = cart.reduce((s, i) => s + i.quantity, 0);
    trackBeginCheckout(value, count);
  }, [cart]);

  // Bumped every time the signed-in customer identity changes so the
  // Stripe AddressElement (which doesn't update defaultValues after
  // mount) re-mounts with fresh prefill values.
  const [prefillVersion, setPrefillVersion] = useState(0);
  useEffect(() => {
    if (customer?._id) setPrefillVersion(v => v + 1);
  }, [customer?._id]);
  const [discountError, setDiscountError] = useState('');
  const [appliedCode, setAppliedCode] = useState('');

  // Refs so updateIntent always reads current values without triggering effects
  const paymentIntentIdRef = useRef('');
  const countryRef = useRef('IE');
  const appliedCodeRef = useRef('');

  // Keep appliedCodeRef in sync
  useEffect(() => { appliedCodeRef.current = appliedCode; }, [appliedCode]);

  // Create intent once on mount
  useEffect(() => {
    if (cart.length === 0) return;
    createIntent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createIntent() {
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
          shippingCountry: 'IE',
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
      paymentIntentIdRef.current = data.paymentIntentId;
      setSummary(data.orderSummary);
    } catch {
      setIntentError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Updates the existing PaymentIntent (amount + metadata) without changing
  // clientSecret — so the mounted Elements / AddressElement aren't destroyed.
  async function updateIntent(country: string, discountCode?: string): Promise<OrderSummary | null> {
    const piId = paymentIntentIdRef.current;
    if (!piId) return null;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v2/checkout/update-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId: piId,
          shippingCountry: country,
          // undefined = keep existing; '' = remove; string = apply new code
          discountCode: discountCode !== undefined ? discountCode : (appliedCodeRef.current || undefined),
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      setSummary(data.orderSummary);
      if (data.orderSummary.discountCode) {
        setAppliedCode(data.orderSummary.discountCode);
      }
      return data.orderSummary;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function setIntentEmail(email: string) {
    const piId = paymentIntentIdRef.current;
    if (!piId || !email) return;
    try {
      await fetch(`${API}/api/v2/checkout/update-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId: piId,
          shippingCountry: countryRef.current,
          discountCode: appliedCodeRef.current || undefined,
          email,
        }),
      });
    } catch { /* don't block payment if email update fails */ }
  }

  async function applyDiscount() {
    setDiscountError('');
    if (!discountInput.trim()) return;
    const result = await updateIntent(countryRef.current, discountInput.trim());
    if (!result?.discountCode) {
      // Prefer the specific reason from the backend (expired, already used,
      // minimum order, etc) and only fall back to the generic line when
      // the response shape is unexpected.
      setDiscountError(result?.discountError || 'Invalid or expired discount code');
    }
  }

  function handleCountryChange(country: string) {
    if (country === countryRef.current) return;
    countryRef.current = country;
    updateIntent(country);
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
        {/* Left — address + payment */}
        <div className={styles.paymentCol}>
          {!customer && (
            // Faster checkout for returning customers — pre-fills email
            // and address from the Customer record. Hidden when already
            // signed in to avoid confusion.
            <GoogleCheckoutSignIn onSignedIn={refreshCustomer} />
          )}
          {intentError && <p className={styles.intentError}>{intentError}</p>}

          {clientSecret && summary ? (
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
              <PaymentForm
                summary={summary}
                onSuccess={handleSuccess}
                onCountryChange={handleCountryChange}
                defaultEmail={customer?.email || ''}
                defaultName={customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : undefined}
                defaultPhone={customer?.phone || undefined}
                defaultAddress={customer?.defaultShippingAddress ? {
                  line1:       customer.defaultShippingAddress.line1,
                  line2:       customer.defaultShippingAddress.line2,
                  city:        customer.defaultShippingAddress.city,
                  state:       customer.defaultShippingAddress.county,
                  postal_code: customer.defaultShippingAddress.postcode,
                  country:     customer.defaultShippingAddress.country,
                } : null}
                prefillVersion={prefillVersion}
                onBeforeSubmit={setIntentEmail}
              />
            </Elements>
          ) : loading ? (
            <p className={styles.loadingMsg}>Preparing secure payment…</p>
          ) : null}
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

            <div className={styles.discountRow}>
              <input
                className={styles.discountInput}
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="Discount code"
                onKeyDown={(e) => e.key === 'Enter' && applyDiscount()}
              />
              <div className={styles.discountBtnWrap}>
                <Button
                  variant={loading ? 'disabled' : 'secondary'}
                  onClick={applyDiscount}
                >
                  APPLY
                </Button>
              </div>
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

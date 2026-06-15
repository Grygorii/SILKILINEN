import styles from './page.module.css';

export const metadata = {
  alternates: { canonical: 'https://www.silkilinen.com/shipping' },
  title: 'Shipping',
  description: 'Shipping rates, delivery times, and free shipping thresholds for SILKILINEN. Ships worldwide from Donegal, Ireland.',
};

type Tier = { label: string; cost: number; freeThreshold: number; deliveryMin: number; deliveryMax: number };

// Fallback mirrors the current live defaults, so the page renders correctly
// even if the rates API is briefly unreachable.
const FALLBACK: Tier[] = [
  { label: 'Ireland', cost: 4.99, freeThreshold: 150, deliveryMin: 3, deliveryMax: 5 },
  { label: 'United Kingdom', cost: 14.99, freeThreshold: 150, deliveryMin: 3, deliveryMax: 5 },
  { label: 'Europe', cost: 9.99, freeThreshold: 150, deliveryMin: 5, deliveryMax: 10 },
  { label: 'US / Canada / Australia', cost: 14.99, freeThreshold: 150, deliveryMin: 7, deliveryMax: 14 },
  { label: 'Worldwide', cost: 19.99, freeThreshold: 150, deliveryMin: 10, deliveryMax: 21 },
];

// Region display name + any editorial suffix the page has always shown.
const DISPLAY: Record<string, string> = { Worldwide: 'Rest of world' };
const DELIVERY_NOTE: Record<string, string> = { 'United Kingdom': ' (from Derry, no customs)' };

async function getRates(): Promise<Tier[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/shipping`, { next: { revalidate: 300 } });
    if (!res.ok) return FALLBACK;
    const data = await res.json();
    return Array.isArray(data.tiers) && data.tiers.length ? data.tiers : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export default async function ShippingPage() {
  const tiers = await getRates();
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1>Shipping</h1>
          <p>Everything you need to know about getting your order — calmly and clearly.</p>
        </header>

        <section className={styles.section}>
          <h2>How we ship</h2>
          <p>
            All orders are carefully prepared and dispatched within 1–2 business days of payment
            confirmation.
          </p>
          <p style={{ marginTop: '16px' }}>
            <strong>For UK customers:</strong> We ship across the border from Derry to give
            you fast, customs-free UK delivery. No surprise charges, no waiting for customs
            clearance. Buncrana to Derry is a 25-minute drive — one of the quiet advantages
            of being a Donegal brand.
          </p>
          <p style={{ marginTop: '16px' }}>
            Everywhere else: we ship from Donegal, Ireland.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Shipping rates &amp; free shipping</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Cost</th>
                  <th>Free shipping over</th>
                  <th>Estimated delivery</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map(t => (
                  <tr key={t.label}>
                    <td>{DISPLAY[t.label] || t.label}</td>
                    <td>€{t.cost.toFixed(2)}</td>
                    <td>€{t.freeThreshold}</td>
                    <td>{t.deliveryMin}–{t.deliveryMax} business days{DELIVERY_NOTE[t.label] || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            Delivery times are estimates and may vary during busy periods.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Tracking</h2>
          <p>
            Once your order ships, you&apos;ll receive an email with tracking details. You can
            follow your parcel from our hands to yours.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Customs and duties</h2>
          <p>
            <strong>For UK customers:</strong> No customs charges — we ship from within
            the UK (Derry).
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>For all other non-EU customers</strong> (US, Canada, Australia, etc.):
            Your parcel may be subject to import duties or taxes when it arrives in your
            country. These charges are the responsibility of the customer and are not
            included in our shipping rates. Please check with your local customs office
            if you&apos;re unsure.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Returns</h2>
          <p>
            For returns information, see our{' '}
            <a href="/returns">Returns &amp; Refunds page</a>.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Questions?</h2>
          <p>
            Reach us at <a href="mailto:hello@silkilinen.com">hello@silkilinen.com</a> — we
            respond within one business day.
          </p>
        </section>
      </div>
    </main>
  );
}

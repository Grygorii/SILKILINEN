import styles from './page.module.css';

export const metadata = {
  title: 'Shipping',
  description: 'Shipping rates, delivery times, and free shipping thresholds for SILKILINEN. Ships worldwide from Donegal, Ireland.',
};

export default function ShippingPage() {
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
            All orders are hand-finished and dispatched within 1–2 business days of payment
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
                <tr>
                  <td>Ireland</td>
                  <td>€4.99</td>
                  <td>€150</td>
                  <td>3–5 business days</td>
                </tr>
                <tr>
                  <td>United Kingdom</td>
                  <td>€14.99</td>
                  <td>€250</td>
                  <td>3–5 business days (from Derry, no customs)</td>
                </tr>
                <tr>
                  <td>European Union</td>
                  <td>€9.99</td>
                  <td>€200</td>
                  <td>5–10 business days</td>
                </tr>
                <tr>
                  <td>US / Canada / Australia</td>
                  <td>€14.99</td>
                  <td>€300</td>
                  <td>7–14 business days</td>
                </tr>
                <tr>
                  <td>Rest of world</td>
                  <td>€19.99</td>
                  <td>€400</td>
                  <td>10–21 business days</td>
                </tr>
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

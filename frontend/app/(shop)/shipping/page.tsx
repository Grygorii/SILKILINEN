import styles from './page.module.css';

export const metadata = {
  title: 'Shipping & Returns — SILKILINEN',
  description: 'Shipping rates, delivery times, and returns policy for SILKILINEN.',
};

export default function ShippingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1>Shipping &amp; Returns</h1>
          <p>Everything you need to know about getting your order — and returning it if needed.</p>
        </header>

        <section className={styles.section}>
          <h2>Shipping rates &amp; times</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Cost</th>
                  <th>Estimated delivery</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ireland</td>
                  <td>€4.99</td>
                  <td>3–5 business days</td>
                </tr>
                <tr>
                  <td>European Union</td>
                  <td>€9.99</td>
                  <td>5–10 business days</td>
                </tr>
                <tr>
                  <td>International (US, CA, AU, and more)</td>
                  <td>€14.99</td>
                  <td>7–14 business days</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            All orders are dispatched from Dublin, Ireland within 1–2 business days of payment confirmation.
            Delivery times are estimates and may vary during busy periods.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Returns policy</h2>
          <div className={styles.blocks}>
            <div className={styles.block}>
              <h3>14-day returns</h3>
              <p>
                You have 14 days from the date of delivery to return any item for a full refund.
                Items must be unworn, unwashed, and in their original packaging with all tags attached.
              </p>
            </div>
            <div className={styles.block}>
              <h3>How to return</h3>
              <p>
                Email us at <a href="mailto:hello@silkilinen.com">hello@silkilinen.com</a> with your order
                number and reason for return. We'll send you a return label and instructions within one business day.
              </p>
            </div>
            <div className={styles.block}>
              <h3>Refunds</h3>
              <p>
                Once we receive and inspect your return, your refund will be processed within 5 business days
                to your original payment method. Shipping costs are non-refundable.
              </p>
            </div>
            <div className={styles.block}>
              <h3>Exchanges</h3>
              <p>
                We don't currently offer direct exchanges. Please return your item for a refund and place
                a new order for the preferred size or colour.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2>Questions?</h2>
          <p>
            Reach us any time at <a href="mailto:hello@silkilinen.com">hello@silkilinen.com</a>.
            We aim to respond within one business day.
          </p>
        </section>
      </div>
    </main>
  );
}

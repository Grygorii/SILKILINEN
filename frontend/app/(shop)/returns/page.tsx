import styles from '../legal.module.css';

export const metadata = {
  title: 'Returns & Refunds — SILKILINEN',
  description: '14-day returns policy for SILKILINEN. Free returns, full refunds, easy process.',
};

export default function ReturnsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1>Returns &amp; Refunds</h1>
          <p>We want you to love every piece. If something isn't right, we make it easy to return.</p>
        </header>

        <div className={styles.highlight}>
          Under EU law (Consumer Rights Directive 2011/83/EU), you have the right to cancel your order
          within <strong>14 days of delivery</strong> without giving any reason.
        </div>

        <section className={styles.section}>
          <h2>How to return</h2>
          <p>
            Email us at <a href="mailto:hello@silkilinen.com">hello@silkilinen.com</a> with:
          </p>
          <ul>
            <li>Your order number</li>
            <li>Which item(s) you are returning</li>
            <li>The reason (optional, but helps us improve)</li>
          </ul>
          <p>
            We will respond within one business day with a return address and instructions.
            You do not need to wait for our confirmation before sending the item back —
            the 14-day return window runs from your delivery date.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Condition requirements</h2>
          <p>To be eligible for a full refund, returned items must be:</p>
          <ul>
            <li>Unworn and unwashed</li>
            <li>In original packaging with all tags still attached</li>
            <li>Free from perfume, deodorant, or any other scents</li>
            <li>Returned within 14 days of the date you notified us</li>
          </ul>
          <p>
            Items returned in an unsellable condition may be refused or subject to a partial refund
            at our discretion.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Refunds</h2>
          <p>
            Once we receive and inspect your return, your refund will be issued within <strong>14 days</strong> to
            your original payment method. In practice, most refunds are processed within 3–5 business days.
          </p>
          <p>
            We refund the full product price. Original outbound shipping costs are non-refundable unless
            the item was faulty or we sent the wrong item.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Return shipping costs</h2>
          <p>
            Return shipping is at the customer's expense unless the item is faulty, damaged in transit,
            or we sent the wrong product. We recommend using a tracked service as we cannot be
            responsible for returns lost in transit.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Faulty or incorrect items</h2>
          <p>
            If you receive a faulty, damaged, or incorrect item, email us within <strong>48 hours of delivery</strong> with
            a photo of the issue. We will arrange collection at no cost to you and either resend
            the correct item or issue a full refund including original shipping — your choice.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Exchanges</h2>
          <p>
            We do not offer direct exchanges at this time. To get a different size or colour,
            return your item for a refund and place a new order. This ensures you receive
            your preferred item as quickly as possible.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Questions</h2>
          <p>
            Email <a href="mailto:hello@silkilinen.com">hello@silkilinen.com</a> — we aim
            to respond within one business day, Monday to Friday.
          </p>
        </section>
      </div>
    </main>
  );
}

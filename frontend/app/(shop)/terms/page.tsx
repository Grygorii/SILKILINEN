import styles from '../legal.module.css';

export const metadata = {
  title: 'Terms & Conditions — SILKILINEN',
  description: 'Terms and conditions for purchasing from SILKILINEN, governed by Irish law.',
};

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1>Terms &amp; Conditions</h1>
          <p>Effective date: 1 May 2025 · Governing law: Republic of Ireland</p>
        </header>

        <div className={styles.highlight}>
          By placing an order on silkilinen.vercel.app you agree to these terms. Please read them before purchasing.
        </div>

        <section className={styles.section}>
          <h2>1. About us</h2>
          <p>
            SILKILINEN is a retailer of silk and linen intimates operated from Dublin, Ireland.
            Contact: <a href="mailto:hello@silkilinen.com">hello@silkilinen.com</a>
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. Formation of contract</h2>
          <p>
            A legally binding contract is formed when we send you an order confirmation email. Until that
            point, your order is an offer to purchase and may be declined if a product is unavailable,
            if we identify a pricing error, or if payment cannot be verified.
          </p>
          <p>
            We reserve the right to cancel an order at any time before dispatch, in which case a full
            refund will be issued immediately.
          </p>
        </section>

        <section className={styles.section}>
          <h2>3. Prices and payment</h2>
          <p>
            All prices are displayed in Euro (€). Prices include VAT where applicable under Irish law.
            We accept all major debit and credit cards via Stripe. Payment is taken at the time of order.
          </p>
          <p>
            We reserve the right to correct pricing errors. If we discover an error after your order
            is placed, we will contact you and offer the option to proceed at the correct price or
            receive a full refund.
          </p>
        </section>

        <section className={styles.section}>
          <h2>4. Delivery</h2>
          <p>
            We dispatch orders within 1–2 business days of payment confirmation. Estimated delivery times
            are shown at checkout. We are not responsible for delays caused by couriers, customs, or
            events outside our control. Risk passes to you on delivery.
          </p>
          <p>See our full <a href="/shipping">Shipping Policy</a> for rates and timelines.</p>
        </section>

        <section className={styles.section}>
          <h2>5. Returns and cancellations</h2>
          <p>
            Under the EU Consumer Rights Directive 2011/83/EU, you have 14 days from delivery to
            cancel your order without giving a reason. Items must be returned unworn, unwashed,
            and in original packaging.
          </p>
          <p>See our full <a href="/returns">Returns Policy</a> for how to initiate a return.</p>
        </section>

        <section className={styles.section}>
          <h2>6. Product descriptions</h2>
          <p>
            We make every effort to display product colours and dimensions accurately, but variations
            may occur due to monitor settings and the natural characteristics of silk and linen fibres.
            Minor colour differences are not considered defects.
          </p>
        </section>

        <section className={styles.section}>
          <h2>7. Intellectual property</h2>
          <p>
            All content on this website — including product photography, copy, branding, and design —
            is owned by SILKILINEN. You may not reproduce or redistribute any content without
            prior written permission.
          </p>
        </section>

        <section className={styles.section}>
          <h2>8. Limitation of liability</h2>
          <p>
            To the fullest extent permitted by Irish law, SILKILINEN shall not be liable for any
            indirect, incidental, or consequential losses arising from your use of this site or
            our products. Our total liability to you shall not exceed the amount paid for the
            relevant order. Nothing in these terms limits our liability for death, personal injury,
            or fraud.
          </p>
        </section>

        <section className={styles.section}>
          <h2>9. Governing law and disputes</h2>
          <p>
            These terms are governed by the laws of the Republic of Ireland. Any disputes shall be
            subject to the exclusive jurisdiction of the Irish courts. For EU consumers, you may also
            use the <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">EU Online Dispute Resolution platform</a>.
          </p>
        </section>

        <section className={styles.section}>
          <h2>10. Contact</h2>
          <p>
            For any questions about these terms, email us at <a href="mailto:hello@silkilinen.com">hello@silkilinen.com</a>.
          </p>
        </section>
      </div>
    </main>
  );
}

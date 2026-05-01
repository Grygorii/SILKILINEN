import styles from '../legal.module.css';

export const metadata = {
  title: 'Privacy Policy — SILKILINEN',
  description: 'How SILKILINEN collects, uses, and protects your personal data under GDPR.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1>Privacy Policy</h1>
          <p>Effective date: 1 May 2025 · Last updated: 1 May 2025</p>
        </header>

        <section className={styles.section}>
          <h2>Who we are</h2>
          <p>
            SILKILINEN is an online retailer of silk and linen intimates, operated from Dublin, Ireland.
            We are the data controller for the personal information collected through this website
            (<a href="https://silkilinen.vercel.app">silkilinen.vercel.app</a>).
          </p>
          <p>Contact: <a href="mailto:hello@silkilinen.com">hello@silkilinen.com</a></p>
        </section>

        <section className={styles.section}>
          <h2>What data we collect</h2>
          <p>When you place an order we collect:</p>
          <ul>
            <li>Full name and billing address</li>
            <li>Shipping address</li>
            <li>Email address</li>
            <li>Phone number</li>
            <li>Payment information (processed directly by Stripe — we never see your card details)</li>
          </ul>
          <p>When you browse the site we may collect:</p>
          <ul>
            <li>Anonymised usage data via cookies (pages visited, session duration)</li>
            <li>Device and browser type</li>
            <li>IP address (for fraud prevention)</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>How we use your data</h2>
          <ul>
            <li>To process and fulfil your order</li>
            <li>To send order confirmation and shipping notifications by email</li>
            <li>To handle returns, refunds, and customer service queries</li>
            <li>To comply with legal obligations (tax records, consumer rights)</li>
            <li>To prevent fraud</li>
          </ul>
          <p>
            Our legal basis for processing is <strong>contract performance</strong> (Article 6(1)(b) GDPR)
            for order-related data, and <strong>legitimate interests</strong> (Article 6(1)(f) GDPR)
            for fraud prevention and site analytics.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Third parties we share data with</h2>
          <ul>
            <li><strong>Stripe</strong> — payment processing (PCI-DSS compliant). <a href="https://stripe.com/ie/privacy" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a></li>
            <li><strong>Railway</strong> — backend server hosting</li>
            <li><strong>Vercel</strong> — frontend hosting and CDN</li>
            <li><strong>MongoDB Atlas</strong> — encrypted cloud database for order records</li>
            <li><strong>Cloudinary</strong> — product image storage and delivery</li>
            <li><strong>Resend</strong> — transactional email delivery (order confirmations)</li>
          </ul>
          <p>We do not sell your personal data to any third party.</p>
        </section>

        <section className={styles.section}>
          <h2>Cookies</h2>
          <p>We use the following cookies:</p>
          <ul>
            <li><strong>Essential cookies</strong> — your cart contents are stored in your browser's local storage so items persist between visits. No server-side session cookie is created for shop visitors.</li>
            <li><strong>Analytics cookies</strong> — if you accept all cookies, we may use anonymised analytics to understand how visitors use the site.</li>
          </ul>
          <p>You can manage your cookie preferences via the banner shown on your first visit.</p>
        </section>

        <section className={styles.section}>
          <h2>How long we keep your data</h2>
          <ul>
            <li>Order records are retained for <strong>7 years</strong> as required by Irish Revenue for tax purposes.</li>
            <li>Email correspondence is retained for <strong>2 years</strong>.</li>
            <li>Analytics data is anonymised and retained for <strong>12 months</strong>.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Your rights under GDPR</h2>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
            <li><strong>Rectification</strong> — ask us to correct inaccurate data</li>
            <li><strong>Erasure</strong> — ask us to delete your data (subject to legal retention obligations)</li>
            <li><strong>Portability</strong> — receive your data in a structured, machine-readable format</li>
            <li><strong>Restriction</strong> — ask us to limit processing in certain circumstances</li>
            <li><strong>Objection</strong> — object to processing based on legitimate interests</li>
          </ul>
          <p>
            To exercise any of these rights, email us at <a href="mailto:hello@silkilinen.com">hello@silkilinen.com</a>.
            We will respond within 30 days. If you are unsatisfied with our response, you may lodge a complaint
            with the <a href="https://www.dataprotection.ie/" target="_blank" rel="noopener noreferrer">Data Protection Commission of Ireland</a>.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Material changes will be communicated
            via email if you have placed an order with us. The effective date at the top of this page
            will always reflect the most recent update.
          </p>
        </section>
      </div>
    </main>
  );
}

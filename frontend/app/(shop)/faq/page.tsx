import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'FAQ — SILKILINEN',
  description: 'Answers to common questions about SILKILINEN silk and linen products — materials, sizing, care, shipping, and returns.',
  alternates: { canonical: 'https://silkilinen.com/faq' },
};

const FAQS = [
  {
    q: 'What materials do you use?',
    a: 'We use 100% mulberry silk and premium linen in all our pieces. Our silk is OEKO-TEX certified, free from harmful substances, and sourced from responsible suppliers. Each garment is handmade in small batches to maintain quality.',
  },
  {
    q: 'How do I find my size?',
    a: 'We offer XS–XXL in most styles. Our size guide (linked on each product page) includes bust, waist, and hip measurements. If you are between sizes, we recommend sizing up for a relaxed fit or sizing down for a closer silhouette. Feel free to contact us and we can advise based on your measurements.',
  },
  {
    q: 'How should I care for silk garments?',
    a: 'Hand wash in cold water with a gentle detergent, or dry-clean. Never wring — gently press out excess water and lay flat or hang to dry away from direct sunlight. Iron on the lowest setting while slightly damp, on the reverse side. Specific care instructions are included on each product label.',
  },
  {
    q: 'Do you ship worldwide?',
    a: 'Yes. We ship from Dublin, Ireland to most countries. Standard international shipping typically takes 7–14 business days. Expedited options are available at checkout. Customs duties and import taxes for international orders are the responsibility of the recipient.',
  },
  {
    q: 'What is your return policy?',
    a: 'We accept returns within 14 days of delivery for unworn, unwashed items in original condition. To start a return, contact us at hello@silkilinen.com with your order number. Sale items and personalised pieces are non-refundable. Return shipping costs are the customer\'s responsibility unless the item is faulty.',
  },
  {
    q: 'Can I exchange an item for a different size?',
    a: 'Yes — exchanges are welcome within 14 days of delivery, subject to stock availability. Contact us before returning so we can reserve your preferred size.',
  },
  {
    q: 'How long does it take to process my order?',
    a: 'Orders are processed within 1–3 business days. During busy periods (sale events, gifting seasons) processing may take up to 5 business days. You will receive a shipping confirmation with tracking as soon as your order leaves us.',
  },
  {
    q: 'Do you offer gift wrapping?',
    a: 'All orders are packaged in our signature tissue-wrapped box with a ribbon — suitable for gifting. If you would like a personal note included, add a message in the order notes at checkout.',
  },
  {
    q: 'Is your silk ethically sourced?',
    a: 'We work only with certified suppliers who meet OEKO-TEX Standard 100 requirements. Our production runs in small batches to minimise waste. We are committed to transparency and are happy to answer any questions about our supply chain.',
  },
  {
    q: 'Do you have an Etsy shop?',
    a: 'We do — our Etsy shop is where we first built our customer community. All reviews shown on this site are from verified Etsy purchases. You can now also order directly here for the same quality with faster fulfilment.',
  },
  {
    q: 'I have a question not listed here. How can I contact you?',
    a: 'Reach us at hello@silkilinen.com or via the chat button in the bottom-right corner of this page. We aim to respond within one business day.',
  },
];

export default function FaqPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Support</p>
        <h1 className={styles.title}>Frequently asked questions</h1>
        <div className={styles.list}>
          {FAQS.map(({ q, a }) => (
            <details key={q} className={styles.item}>
              <summary className={styles.question}>{q}</summary>
              <p className={styles.answer}>{a}</p>
            </details>
          ))}
        </div>
        <div className={styles.cta}>
          <p>Still have questions?</p>
          <a href="mailto:hello@silkilinen.com" className={styles.ctaLink}>Email us →</a>
        </div>
      </div>
    </main>
  );
}

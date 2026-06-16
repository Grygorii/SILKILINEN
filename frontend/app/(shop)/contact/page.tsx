import type { Metadata } from 'next';
import styles from './page.module.css';
import { getPageMeta } from '@/lib/pageSeo';

export async function generateMetadata(): Promise<Metadata> {
  const o = await getPageMeta('/contact');
  return {
    alternates: { canonical: 'https://www.silkilinen.com/contact' },
    title: o?.metaTitle ? { absolute: o.metaTitle } : 'Contact',
    description: o?.metaDescription || 'Get in touch with SILKILINEN. Email us at hello@silkilinen.com — we respond within one business day.',
  };
}

export default function ContactPage() {
  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Get in touch.</h1>
        <p>We'd love to hear from you.</p>
      </div>
      <div className={styles.inner}>
        <div className={styles.info}>
          <div className={styles.block}>
            <h3>Email</h3>
            <p>hello@silkilinen.com</p>
          </div>
          <div className={styles.block}>
            <h3>Based in</h3>
            <p>Donegal, Ireland</p>
          </div>
          <div className={styles.block}>
            <h3>Shipping</h3>
            <p>Worldwide</p>
          </div>
        </div>
        <div className={styles.form}>
          <input type="text" placeholder="Your name" />
          <input type="email" placeholder="Email address" />
          <textarea rows={6} placeholder="Your message"></textarea>
          <button>Send message</button>
        </div>
      </div>
    </main>
  );
}
import Link from 'next/link';
import { Truck, RotateCcw, Gift } from 'lucide-react';
import styles from './ReassuranceRow.module.css';

// Three-reassurance row (per docs/reassurance-row-spec.md). Sits just under the
// New Arrivals so a first-time visitor immediately reads "this is a luxury
// service, not a transactional store" — the trust a considered €150+ buyer
// needs before browsing further. Copy uses the spec's recommended defaults;
// edit the ITEMS below to change services/copy.
const ITEMS = [
  { icon: Truck,     headline: 'Free EU Shipping', sub: 'On orders over €150',             href: '/shipping' },
  { icon: RotateCcw, headline: '14-day Returns',    sub: 'Easy exchanges from anywhere',    href: '/returns' },
  { icon: Gift,      headline: 'Gift-Ready',        sub: 'Hand-tied silk ribbon, included', href: '/gift-wrapping' },
];

export default function ReassuranceRow() {
  return (
    <section className={styles.section} aria-label="Our service">
      <div className={styles.row}>
        {ITEMS.map(({ icon: Icon, headline, sub, href }) => (
          <Link key={headline} href={href} className={styles.block}>
            <Icon size={28} strokeWidth={1.5} aria-hidden="true" />
            <h3 className={styles.headline}>{headline}</h3>
            <p className={styles.sub}>{sub}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

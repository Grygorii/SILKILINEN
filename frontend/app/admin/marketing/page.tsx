import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';

const SECTIONS = [
  {
    href: '/admin/marketing/promo-codes',
    category: 'Discounts',
    title: 'Promo Codes',
    description: 'Create and manage discount codes synced with Stripe Checkout',
  },
];

export default function MarketingPage() {
  return (
    <AdminLayout>
      <div style={{ padding: 32, maxWidth: 900 }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 400, color: 'var(--dark)', marginBottom: 6 }}>
          Marketing
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 40 }}>
          Promotions, discounts, and customer communications
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {SECTIONS.map(s => (
            <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
              <div style={{
                border: '1px solid var(--border)',
                background: 'white',
                padding: 24,
                transition: 'box-shadow 0.2s',
                height: '100%',
              }}>
                <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
                  {s.category}
                </p>
                <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 400, color: 'var(--dark)', marginBottom: 8 }}>
                  {s.title}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{s.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}

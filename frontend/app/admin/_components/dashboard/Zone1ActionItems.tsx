'use client';

import { useRouter } from 'next/navigation';
import { Package, AlertTriangle, ShoppingCart, XCircle, ChevronRight } from 'lucide-react';
import Card from '../Card';

type LowStockItem = { productId: string; productName: string; stock: number; linkTo: string };
type Zone1Data = {
  ordersToShip:   { count: number; linkTo: string; label: string };
  lowStock:       LowStockItem[];
  abandonedCarts: { count: number; windowHours: number; linkTo: string };
  failedPayments: { count: number; linkTo: string };
  unreadMessages: null;
};

function ActionRow({
  icon: Icon,
  label,
  href,
  danger = false,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  danger?: boolean;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(href)}
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:          12,
        width:       '100%',
        padding:     '14px 0',
        paddingLeft:  danger ? 10 : 0,
        background:  'none',
        border:      'none',
        borderBottom: '1px solid var(--border)',
        borderLeft:   danger ? '3px solid #c0392b' : 'none',
        cursor:      'pointer',
        textAlign:   'left',
      }}
    >
      <Icon size={18} color={danger ? '#c0392b' : 'var(--muted)'} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: danger ? '#c0392b' : 'var(--dark)' }}>
        {label}
      </span>
      <ChevronRight size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
    </button>
  );
}

export default function Zone1ActionItems({ data }: { data: Zone1Data }) {
  const { ordersToShip, lowStock, abandonedCarts, failedPayments } = data;

  const hasFailedPayments = failedPayments.count > 0;
  const hasOrdersToShip   = ordersToShip.count > 0;
  const hasLowStock       = lowStock.length > 0;
  const hasAbandonedCarts = abandonedCarts.count > 0;
  const allClear = !hasFailedPayments && !hasOrdersToShip && !hasLowStock && !hasAbandonedCarts;

  return (
    <Card title="NEEDS YOUR ATTENTION">
      {allClear ? (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <div style={{ width: 32, height: 1, background: 'var(--border)', margin: '0 auto 16px' }} />
          <p style={{
            fontSize: 15,
            color: 'var(--dark)',
            fontStyle: 'italic',
            fontFamily: "'Cormorant Garamond', Georgia, serif",
          }}>
            Nothing needs you right now. Beautiful.
          </p>
        </div>
      ) : (
        <div>
          {hasFailedPayments && (
            <ActionRow
              icon={XCircle}
              label={`${failedPayments.count} failed payment${failedPayments.count !== 1 ? 's' : ''} this week`}
              href={failedPayments.linkTo}
              danger
            />
          )}
          {hasOrdersToShip && (
            <ActionRow
              icon={Package}
              label={`${ordersToShip.count} ${ordersToShip.label}`}
              href={ordersToShip.linkTo}
            />
          )}
          {hasLowStock && lowStock.map(p => (
            <ActionRow
              key={String(p.productId)}
              icon={AlertTriangle}
              label={`${p.productName} — ${p.stock} left`}
              href={p.linkTo}
            />
          ))}
          {hasAbandonedCarts && (
            <ActionRow
              icon={ShoppingCart}
              label={`${abandonedCarts.count} abandoned cart${abandonedCarts.count !== 1 ? 's' : ''} (>${abandonedCarts.windowHours}h)`}
              href={abandonedCarts.linkTo}
            />
          )}
        </div>
      )}
    </Card>
  );
}

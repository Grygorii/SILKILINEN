'use client';

import { useEffect, useState, use } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL;

type Item = { name: string; colour: string; size: string; quantity: number };
type Order = {
  _id: string;
  orderNumber?: string;
  customerName: string | null;
  shippingAddress: {
    line1?: string; line2?: string; city?: string;
    state?: string; postalCode?: string; country?: string;
  } | null;
  items: Item[];
  customerNote?: string;
  createdAt: string;
};

/**
 * Print-ready packing slip — a clean, parcel-safe document (no prices, so it's
 * gift-safe) that opens in its own bare page and auto-triggers the print
 * dialog. Kept out of AdminLayout deliberately so the admin chrome doesn't
 * bleed into the printout. "Print to PDF" from the browser gives a PDF with
 * zero server-side dependencies.
 */
export default function PackingSlip({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/orders/${id}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setOrder(await res.json());
      } catch {
        setError('Could not load order.');
      }
    })();
  }, [id]);

  // Auto-open the print dialog once the slip has rendered.
  useEffect(() => {
    if (order) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [order]);

  if (error) return <div style={{ padding: 40, fontFamily: 'system-ui' }}>{error}</div>;
  if (!order) return <div style={{ padding: 40, fontFamily: 'system-ui' }}>Loading…</div>;

  const addr = order.shippingAddress;
  const ref = order.orderNumber || order._id.slice(-8).toUpperCase();
  const date = new Date(order.createdAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="slip">
      <style>{`
        @media print { .noprint { display: none !important; } @page { margin: 18mm; } }
        body { background: #fff; }
        .slip { max-width: 680px; margin: 0 auto; padding: 40px; color: #1a1916; font-family: Georgia, 'Times New Roman', serif; }
        .brand { font-size: 26px; letter-spacing: 3px; font-weight: 400; margin: 0; }
        .tagline { font-size: 12px; color: #6b6358; letter-spacing: 1px; margin: 4px 0 0; }
        .meta { display: flex; justify-content: space-between; margin: 28px 0; font-size: 13px; }
        .meta h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b6358; margin: 0 0 6px; font-family: system-ui, sans-serif; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
        th { text-align: left; border-bottom: 2px solid #1a1916; padding: 8px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-family: system-ui, sans-serif; }
        td { padding: 10px 4px; border-bottom: 1px solid #e0d9cc; }
        .qty { text-align: center; width: 60px; }
        .note { margin-top: 24px; padding: 14px 16px; background: #f7f3ec; font-size: 13px; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #6b6358; border-top: 1px solid #e0d9cc; padding-top: 20px; }
        .btn { font-family: system-ui, sans-serif; font-size: 13px; padding: 8px 16px; border: 1px solid #1a1916; background: #1a1916; color: #fff; cursor: pointer; }
      `}</style>

      <div className="noprint" style={{ textAlign: 'right', marginBottom: 16 }}>
        <button className="btn" onClick={() => window.print()}>Print</button>
      </div>

      <p className="brand">SILKILINEN</p>
      <p className="tagline">Packing slip</p>

      <div className="meta">
        <div>
          <h3>Ship to</h3>
          {order.customerName && <div>{order.customerName}</div>}
          {addr?.line1 && <div>{addr.line1}</div>}
          {addr?.line2 && <div>{addr.line2}</div>}
          <div>{[addr?.city, addr?.state, addr?.postalCode].filter(Boolean).join(', ')}</div>
          {addr?.country && <div>{addr.country}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <h3>Order</h3>
          <div>{ref}</div>
          <div style={{ color: '#6b6358' }}>{date}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr><th>Item</th><th>Details</th><th className="qty">Qty</th></tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={i}>
              <td>{it.name}</td>
              <td>{[it.colour, it.size].filter(Boolean).join(' · ') || '—'}</td>
              <td className="qty">{it.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {order.customerNote && (
        <div className="note"><strong>Note:</strong> {order.customerNote}</div>
      )}

      <p className="footer">Thank you — from Donegal, with love.<br />silkilinen.com · hello@silkilinen.com</p>
    </div>
  );
}

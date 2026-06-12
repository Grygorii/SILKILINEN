'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Variant = { colour?: string; size?: string; sku?: string; stockLevel?: number };
type Product = { _id: string; name: string; price: number; variants?: Variant[] };

type Line = {
  productId: string | null;
  name: string;
  price: number;
  colour: string;
  size: string;
  quantity: number;
  variants: Variant[];
};

/**
 * Manual order entry — for phone / Instagram-DM / in-person sales that never
 * touch Stripe checkout. Items come from a live product search; price is
 * editable per line (negotiated prices happen). Totals are recomputed
 * server-side; this form's total is a preview.
 */
export default function NewOrderPage() {
  const router = useRouter();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [addr, setAddr] = useState({ line1: '', line2: '', city: '', state: '', postalCode: '', country: '' });

  const [lines, setLines] = useState<Line[]>([]);
  const [shippingCost, setShippingCost] = useState('0');
  const [status, setStatus] = useState<'paid' | 'pending' | 'processing'>('paid');
  const [internalNote, setInternalNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Product search
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<Product[]>([]);

  useEffect(() => {
    if (search.trim().length < 2) { setMatches([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/admin/products?search=${encodeURIComponent(search.trim())}&status=active,sold_out&limit=6`, { credentials: 'include' });
        const data = await res.json();
        setMatches(Array.isArray(data) ? data : (data.products || []));
      } catch { setMatches([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function addProduct(p: Product) {
    const v = p.variants?.[0];
    setLines(ls => [...ls, {
      productId: p._id,
      name: p.name,
      price: p.price,
      colour: v?.colour || '',
      size: v?.size || '',
      quantity: 1,
      variants: p.variants || [],
    }]);
    setSearch('');
    setMatches([]);
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines(ls => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const subtotal = lines.reduce((s, l) => s + (Number(l.price) || 0) * (l.quantity || 0), 0);
  const ship = Number(shippingCost) || 0;
  const total = subtotal + ship;

  async function save() {
    if (lines.length === 0) { toast('Add at least one item.', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/orders/manual`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
        body: JSON.stringify({
          customerName: customerName.trim() || null,
          customerEmail: customerEmail.trim() || null,
          customerPhone: customerPhone.trim() || null,
          shippingAddress: addr,
          items: lines.map(l => ({
            productId: l.productId, name: l.name, price: Number(l.price),
            colour: l.colour || undefined, size: l.size || undefined, quantity: l.quantity,
          })),
          shippingCost: ship,
          status,
          internalNote: internalNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Could not create order.', 'error'); return; }
      toast(`Order ${data.orderNumber} created.`);
      router.push(`/admin/orders/${data._id}`);
    } catch {
      toast('Network error.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const colourOptions = (l: Line) => [...new Set(l.variants.map(v => v.colour).filter(Boolean))] as string[];
  const sizeOptions = (l: Line) =>
    [...new Set(l.variants.filter(v => !l.colour || v.colour === l.colour).map(v => v.size).filter(Boolean))] as string[];

  return (
    <AdminLayout active="orders">
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push('/admin/orders')}>← Orders</button>
        <h2 className={styles.title}>New manual order</h2>
      </div>
      <p className={styles.hint}>For phone, Instagram-DM or in-person sales. No payment is taken here — record it as Paid if you already received the money.</p>

      <div className={styles.grid}>
        <div>
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Items</h3>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products to add…"
              className={styles.input}
            />
            {matches.length > 0 && (
              <div className={styles.matches}>
                {matches.map(m => (
                  <button key={m._id} className={styles.matchBtn} onClick={() => addProduct(m)}>
                    {m.name} <span className={styles.matchPrice}>€{m.price?.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}

            {lines.length === 0 && <p className={styles.muted}>No items yet — search above to add products.</p>}

            {lines.map((l, i) => (
              <div key={i} className={styles.line}>
                <div className={styles.lineName}>{l.name}</div>
                <div className={styles.lineControls}>
                  {colourOptions(l).length > 0 && (
                    <select value={l.colour} onChange={e => updateLine(i, { colour: e.target.value })} className={styles.select}>
                      {colourOptions(l).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  {sizeOptions(l).length > 0 && (
                    <select value={l.size} onChange={e => updateLine(i, { size: e.target.value })} className={styles.select}>
                      {sizeOptions(l).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  <label className={styles.miniLabel}>Qty
                    <input type="number" min={1} value={l.quantity}
                      onChange={e => updateLine(i, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                      className={styles.numInput} />
                  </label>
                  <label className={styles.miniLabel}>€
                    <input type="number" min={0} step="0.01" value={l.price}
                      onChange={e => updateLine(i, { price: Number(e.target.value) })}
                      className={styles.numInput} />
                  </label>
                  <button className={styles.removeBtn} onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))} aria-label="Remove item">×</button>
                </div>
              </div>
            ))}
          </section>

          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Customer</h3>
            <div className={styles.fieldRow}>
              <input className={styles.input} placeholder="Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
              <input className={styles.input} placeholder="Email (for order emails)" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
            </div>
            <input className={styles.input} placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
          </section>

          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Shipping address</h3>
            <input className={styles.input} placeholder="Address line 1" value={addr.line1} onChange={e => setAddr(a => ({ ...a, line1: e.target.value }))} />
            <input className={styles.input} placeholder="Address line 2 (optional)" value={addr.line2} onChange={e => setAddr(a => ({ ...a, line2: e.target.value }))} />
            <div className={styles.fieldRow}>
              <input className={styles.input} placeholder="City" value={addr.city} onChange={e => setAddr(a => ({ ...a, city: e.target.value }))} />
              <input className={styles.input} placeholder="Postcode" value={addr.postalCode} onChange={e => setAddr(a => ({ ...a, postalCode: e.target.value }))} />
            </div>
            <div className={styles.fieldRow}>
              <input className={styles.input} placeholder="State / county (optional)" value={addr.state} onChange={e => setAddr(a => ({ ...a, state: e.target.value }))} />
              <input className={styles.input} placeholder="Country (e.g. IE)" value={addr.country} onChange={e => setAddr(a => ({ ...a, country: e.target.value }))} />
            </div>
          </section>
        </div>

        <div>
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Summary</h3>
            <div className={styles.sumRow}><span>Subtotal</span><span>€{subtotal.toFixed(2)}</span></div>
            <div className={styles.sumRow}>
              <span>Shipping</span>
              <input type="number" min={0} step="0.01" value={shippingCost} onChange={e => setShippingCost(e.target.value)} className={styles.numInput} />
            </div>
            <div className={`${styles.sumRow} ${styles.sumTotal}`}><span>Total</span><span>€{total.toFixed(2)}</span></div>

            <label className={styles.label}>Payment status</label>
            <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className={styles.select} style={{ width: '100%' }}>
              <option value="paid">Paid (money already received)</option>
              <option value="pending">Pending (awaiting payment)</option>
              <option value="processing">Processing</option>
            </select>

            <label className={styles.label}>Internal note</label>
            <textarea value={internalNote} onChange={e => setInternalNote(e.target.value)} rows={3} className={styles.textarea} placeholder="e.g. Instagram DM sale, paid via Revolut" />

            <button className={styles.saveBtn} onClick={save} disabled={saving || lines.length === 0}>
              {saving ? 'Creating…' : 'Create order'}
            </button>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}

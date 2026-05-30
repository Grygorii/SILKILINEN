'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import AdminErrorBanner from '@/components/AdminErrorBanner';

const API = process.env.NEXT_PUBLIC_API_URL;

type Order = {
  _id: string; orderNumber: string; total: number; status: string;
  createdAt: string; discountCode?: string; items: { name: string; quantity: number }[];
};
type Note = { _id: string; body: string; createdAt: string };
type PromoCode = { _id: string; code: string; type: string; value: number; status: string };
type Customer = {
  _id: string; email: string; firstName: string; lastName: string; phone: string;
  marketingConsent: boolean; emailVerified: boolean; lastLogin: string | null;
  orderCount: number; totalSpend: number; firstOrderAt: string | null; lastOrderAt: string | null;
  country: string; city: string;
  acquisitionSource: string; acquisitionMedium: string; acquisitionCampaign: string; acquiredAt: string | null;
  segments: string[]; tags: string[]; notes: Note[]; customerType: string;
  internalRating: number | null; gdprDeletedAt: string | null; consent: string | null;
  createdAt: string;
};

const SEGMENT_COLORS: Record<string, string> = {
  vip: '#5c35a8', repeat: '#2d7d47', 'first-time': '#1565c0',
  'newsletter-only': '#b07d00', recent: '#00838f', lapsed: '#e65100', 'at-risk': '#c62828',
};
const STATUS_COLORS: Record<string, string> = {
  paid: '#2d7d47', processing: '#1565c0', shipped: '#00838f',
  delivered: '#2d7d47', cancelled: '#c62828', pending: '#b07d00', refunded: '#666',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtMoney(n: number | null | undefined) {
  if (!n) return '€0';
  return `€${n.toFixed(2)}`;
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalSpend, setTotalSpend] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', customerType: 'retail', internalRating: '', tags: '' });

  const [noteInput, setNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [genPromo, setGenPromo] = useState(false);
  const [promoForm, setPromoForm] = useState({ type: 'percentage', value: '10', minOrderValue: '0', validDays: '' });
  const [generatedPromo, setGeneratedPromo] = useState<PromoCode | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/customers/${id}`, { credentials: 'include' });
      const data = await res.json();
      setCustomer(data.customer);
      setOrders(data.orders || []);
      setTotalSpend(data.totalSpend || 0);
      if (data.customer) {
        setEditForm({
          firstName: data.customer.firstName || '',
          lastName: data.customer.lastName || '',
          phone: data.customer.phone || '',
          customerType: data.customer.customerType || 'retail',
          internalRating: data.customer.internalRating != null ? String(data.customer.internalRating) : '',
          tags: (data.customer.tags || []).join(', '),
        });
      }
    } catch (err) {
      console.error('[customer] load failed:', err);
      setLoadError('Could not load customer. Check your connection and try again.');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function saveEdit() {
    await fetch(`${API}/api/admin/customers/${id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: editForm.firstName, lastName: editForm.lastName, phone: editForm.phone,
        customerType: editForm.customerType,
        internalRating: editForm.internalRating ? Number(editForm.internalRating) : null,
        tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      }),
    });
    setEditing(false);
    load();
  }

  async function addNote() {
    if (!noteInput.trim()) return;
    setSavingNote(true);
    await fetch(`${API}/api/admin/customers/${id}/notes`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: noteInput }),
    });
    setNoteInput('');
    setSavingNote(false);
    load();
  }

  async function deleteNote(noteId: string) {
    await fetch(`${API}/api/admin/customers/${id}/notes/${noteId}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  async function generatePromo() {
    const res = await fetch(`${API}/api/admin/customers/${id}/promo-code`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: promoForm.type,
        value: Number(promoForm.value),
        minOrderValue: Number(promoForm.minOrderValue),
        validDays: promoForm.validDays ? Number(promoForm.validDays) : null,
      }),
    });
    const data = await res.json();
    setGeneratedPromo(data);
    setGenPromo(false);
  }

  async function gdprExport() {
    const { downloadBlob } = await import('@/lib/api');
    try {
      await downloadBlob(`/api/admin/customers/${id}/gdpr-export`, `gdpr-export-${id}.json`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    }
  }

  async function gdprDelete() {
    if (!confirm('This will anonymise all PII for this customer. Order history is preserved. This cannot be undone. Continue?')) return;
    await fetch(`${API}/api/admin/customers/${id}/gdpr`, { method: 'DELETE', credentials: 'include' });
    router.push('/admin/customers');
  }

  // Abandoned cart = a pending order older than 2h (#7)
  const abandonedCart = orders.find(o =>
    o.status === 'pending' && Date.now() - new Date(o.createdAt).getTime() > 2 * 3600 * 1000
  );
  const [recoverySent, setRecoverySent] = useState(false);
  async function sendCartRecovery() {
    if (!abandonedCart) return;
    try {
      const res = await fetch(`${API}/api/orders/${abandonedCart._id}/recovery-email`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
      });
      if (res.ok) setRecoverySent(true);
      else { const d = await res.json(); alert(d.error || 'Failed'); }
    } catch { alert('Network error'); }
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 16 };
  const label: React.CSSProperties = { fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 };
  const val: React.CSSProperties = { fontSize: 14, color: 'var(--dark)' };
  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 400, borderBottom: '1px solid var(--border)' };
  const tdStyle: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--dark)', verticalAlign: 'middle' };

  if (loading) {
    return <AdminLayout><div style={{ padding: 28, color: 'var(--muted)', fontSize: 13 }}>Loading…</div></AdminLayout>;
  }
  if (!customer) {
    return (
      <AdminLayout>
        <div style={{ padding: 28 }}>
          <AdminErrorBanner error={loadError} onRetry={load} />
          {!loadError && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Customer not found.</div>}
        </div>
      </AdminLayout>
    );
  }

  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email;

  return (
    <AdminLayout>
      <div style={{ padding: '24px 28px', maxWidth: 1000 }}>

        {/* Back + header */}
        <Link href="/admin/customers" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>← Customers</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '12px 0 20px' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--dark)' }}>{name}</h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>{customer.email}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={gdprExport} style={{ padding: '7px 12px', fontSize: 12, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Export data</button>
            <button onClick={gdprDelete} style={{ padding: '7px 12px', fontSize: 12, border: '1px solid #c0392b', color: '#c0392b', background: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>GDPR delete</button>
          </div>
        </div>

        {/* Segments */}
        {customer.segments?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {customer.segments.map(s => (
              <span key={s} style={{ padding: '3px 10px', fontSize: 10, borderRadius: 2, letterSpacing: '0.8px', textTransform: 'uppercase', background: SEGMENT_COLORS[s] || '#eee', color: 'white' }}>
                {s}
              </span>
            ))}
          </div>
        )}

        {/* At-a-glance stat band */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', marginBottom: 16 }}>
          {[
            { label: 'Orders', value: String(orders.length) },
            { label: 'Lifetime spend', value: fmtMoney(totalSpend) },
            { label: 'First order', value: fmtDate(customer.firstOrderAt) },
            { label: 'Last order', value: fmtDate(customer.lastOrderAt) },
          ].map(({ label: l, value }) => (
            <div key={l} style={{ background: 'white', padding: '14px 18px' }}>
              <p style={label}>{l}</p>
              <p style={{ ...val, fontWeight: 600 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Profile */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>Profile</p>
            {!editing && (
              <button onClick={() => setEditing(true)} style={{ fontSize: 12, border: '1px solid var(--border)', background: 'white', padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
            )}
          </div>
          {editing ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'First name', key: 'firstName' }, { label: 'Last name', key: 'lastName' },
                { label: 'Phone', key: 'phone' }, { label: 'Internal rating (1–5)', key: 'internalRating' },
                { label: 'Tags (comma-separated)', key: 'tags' },
              ].map(({ label: l, key }) => (
                <div key={key}>
                  <p style={label}>{l}</p>
                  <input value={(editForm as Record<string, string>)[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <p style={label}>Customer type</p>
                <select value={editForm.customerType} onChange={e => setEditForm(f => ({ ...f, customerType: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13 }}>
                  {['retail', 'wholesale', 'vip', 'internal'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={saveEdit} style={{ padding: '8px 18px', background: 'var(--dark)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Save</button>
                <button onClick={() => setEditing(false)} style={{ padding: '8px 18px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { l: 'Name', v: name },
                { l: 'Phone', v: customer.phone || '—' },
                { l: 'Type', v: customer.customerType || 'retail' },
                { l: 'Location', v: [customer.city, customer.country].filter(Boolean).join(', ') || '—' },
                { l: 'Email verified', v: customer.emailVerified ? 'Yes' : 'No' },
                { l: 'Marketing consent', v: customer.marketingConsent ? 'Yes' : 'No' },
                { l: 'Internal rating', v: customer.internalRating != null ? `${customer.internalRating}/5` : '—' },
                { l: 'Last login', v: fmtDate(customer.lastLogin) },
                { l: 'Member since', v: fmtDate(customer.createdAt) },
              ].map(({ l, v }) => (
                <div key={l}><p style={label}>{l}</p><p style={val}>{v}</p></div>
              ))}
              {customer.tags?.length > 0 && (
                <div style={{ gridColumn: '1/-1' }}>
                  <p style={label}>Tags</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {customer.tags.map(t => <span key={t} style={{ padding: '2px 8px', background: '#f3f3f3', fontSize: 12, color: 'var(--dark)' }}>{t}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Attribution */}
        <div style={card}>
          <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 16px' }}>Acquisition</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { l: 'Source', v: customer.acquisitionSource || '—' },
              { l: 'Medium', v: customer.acquisitionMedium || '—' },
              { l: 'Campaign', v: customer.acquisitionCampaign || '—' },
              { l: 'Acquired at', v: fmtDate(customer.acquiredAt) },
            ].map(({ l, v }) => (
              <div key={l}><p style={label}>{l}</p><p style={val}>{v}</p></div>
            ))}
          </div>
        </div>

        {/* Abandoned-cart nudge (#7) */}
        {abandonedCart && (
          <div style={{ ...card, background: '#fff8e1', borderColor: '#f0e0a0', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, background: '#b07d00', color: 'white', padding: '3px 8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Abandoned cart</span>
            <span style={{ fontSize: 13, color: 'var(--dark)' }}>
              €{abandonedCart.total.toFixed(2)} pending since {new Date(abandonedCart.createdAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
            </span>
            {recoverySent ? (
              <span style={{ marginLeft: 'auto', fontSize: 13, color: '#2d7d47' }}>✓ Recovery email sent</span>
            ) : (
              <button onClick={sendCartRecovery} style={{ marginLeft: 'auto', padding: '7px 16px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: 'var(--dark)', color: 'white' }}>
                Send recovery email
              </button>
            )}
          </div>
        )}

        {/* Orders */}
        <div style={card}>
          <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 16px' }}>Orders ({orders.length})</p>
          {orders.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>No orders yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Order', 'Date', 'Items', 'Total', 'Status'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o._id}>
                    <td style={tdStyle}>
                      <Link href={`/admin/orders/${o._id}`} style={{ color: 'var(--dark)', textDecoration: 'none', fontWeight: 500 }}>
                        #{o.orderNumber}
                      </Link>
                    </td>
                    <td style={tdStyle}>{fmtDate(o.createdAt)}</td>
                    <td style={tdStyle}>{(o.items || []).map(i => i.name).join(', ')}</td>
                    <td style={tdStyle}>{fmtMoney(o.total)}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 2, background: STATUS_COLORS[o.status] ? STATUS_COLORS[o.status] + '20' : '#f3f3f3', color: STATUS_COLORS[o.status] || '#666', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Notes */}
        <div style={card}>
          <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 16px' }}>Internal notes</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="Add a note…"
              onKeyDown={e => e.key === 'Enter' && addNote()}
              style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13 }} />
            <button onClick={addNote} disabled={savingNote} style={{ padding: '7px 14px', background: 'var(--dark)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
              Add
            </button>
          </div>
          {(customer.notes || []).length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>No notes yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {customer.notes.map(n => (
                <div key={n._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#fafafa', border: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--dark)', margin: 0 }}>{n.body}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{fmtDate(n.createdAt)}</p>
                  </div>
                  <button onClick={() => deleteNote(n._id)} style={{ fontSize: 11, background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer' }}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Generate promo code */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>Personal promo code</p>
            <button onClick={() => { setGenPromo(g => !g); setGeneratedPromo(null); }} style={{ fontSize: 12, border: '1px solid var(--border)', background: 'white', padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
              {genPromo ? 'Cancel' : '+ Generate code'}
            </button>
          </div>

          {generatedPromo && (
            <div style={{ padding: '12px 16px', background: '#e8f5e9', border: '1px solid #2d7d47', marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: '#2d7d47', margin: 0 }}>
                Code created: <strong>{generatedPromo.code}</strong> — {generatedPromo.value}{generatedPromo.type === 'percentage' ? '%' : '€'} off.{' '}
                <Link href={`/admin/promo-codes/${generatedPromo._id}`} style={{ color: '#2d7d47' }}>View in promo codes →</Link>
              </p>
            </div>
          )}

          {genPromo && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <p style={label}>Discount type</p>
                <select value={promoForm.type} onChange={e => setPromoForm(f => ({ ...f, type: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13 }}>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed €</option>
                </select>
              </div>
              <div>
                <p style={label}>Value</p>
                <input value={promoForm.value} onChange={e => setPromoForm(f => ({ ...f, value: e.target.value }))}
                  type="number" min="1"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <p style={label}>Min order (€)</p>
                <input value={promoForm.minOrderValue} onChange={e => setPromoForm(f => ({ ...f, minOrderValue: e.target.value }))}
                  type="number" min="0"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <p style={label}>Valid for (days, blank = forever)</p>
                <input value={promoForm.validDays} onChange={e => setPromoForm(f => ({ ...f, validDays: e.target.value }))}
                  type="number" min="1" placeholder="e.g. 30"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <button onClick={generatePromo} style={{ padding: '8px 18px', background: '#5c35a8', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                  Generate &amp; save
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}

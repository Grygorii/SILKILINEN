'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

type Campaign = {
  _id: string;
  name: string;
  slug: string;
  channel: string;
  status: string;
  spend: number;
  budget: number;
  notes: string;
  startDate?: string;
  endDate?: string;
  spendUpdates: { amount: number; note: string; date: string }[];
  creatives: { name: string; utmContent: string; notes?: string }[];
  stats: {
    visits: number;
    orders: number;
    revenue: number;
    netRevenue: number;
    roas: number | null;
    conversionRate: number | null;
    averageOrderValue: number | null;
    costPerOrder: number | null;
    topProducts: { name: string; units: number; revenue: number }[];
    topCreatives: { utmContent: string; orders: number; revenue: number }[];
    attributedOrders: {
      _id: string; orderNumber: string; createdAt: string;
      total: number; status: string; customerEmail?: string; utmContent?: string; firstItem?: string;
    }[];
  };
};

const VALID_STATUSES = ['draft', 'active', 'paused', 'ended'];

function fmt(n: number) { return `€${n.toFixed(2)}`; }

const cellStyle: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--dark)' };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 400, borderBottom: '1px solid var(--border)' };

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [camp, setCamp] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Spend form
  const [spendAmt, setSpendAmt] = useState('');
  const [spendNote, setSpendNote] = useState('');
  const [addingSpend, setAddingSpend] = useState(false);

  // Creative form
  const [crName, setCrName] = useState('');
  const [crContent, setCrContent] = useState('');
  const [addingCr, setAddingCr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/campaigns/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      setCamp(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(status: string) {
    await fetch(`${API}/api/admin/campaigns/${id}/status`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function addSpend() {
    const amt = parseFloat(spendAmt);
    if (!amt || amt <= 0) return;
    setAddingSpend(true);
    await fetch(`${API}/api/admin/campaigns/${id}/spend`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt, note: spendNote.trim() }),
    });
    setSpendAmt(''); setSpendNote('');
    await load();
    setAddingSpend(false);
  }

  async function addCreative() {
    if (!crName.trim() || !crContent.trim()) return;
    setAddingCr(true);
    const creatives = [...(camp?.creatives || []), { name: crName.trim(), utmContent: crContent.trim() }];
    await fetch(`${API}/api/admin/campaigns/${id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creatives }),
    });
    setCrName(''); setCrContent('');
    await load();
    setAddingCr(false);
  }

  async function duplicate() {
    const res = await fetch(`${API}/api/admin/campaigns/${id}/duplicate`, {
      method: 'POST', credentials: 'include',
    });
    if (res.ok) {
      const dup = await res.json();
      router.push(`/admin/marketing/campaigns/${dup._id}`);
    }
  }

  if (loading) return <AdminLayout><div style={{ padding: 32, fontSize: 13, color: 'var(--muted)' }}>Loading…</div></AdminLayout>;
  if (error)   return <AdminLayout><div style={{ padding: 32, fontSize: 13, color: '#c0392b' }}>{error}</div></AdminLayout>;
  if (!camp)   return null;

  const { stats } = camp;

  const inputStyle: React.CSSProperties = { padding: '9px 12px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, color: 'var(--dark)', background: 'white', outline: 'none' };
  const sectionTitle: React.CSSProperties = { fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14, display: 'block' };

  const utmBase = `https://silkilinen.com?utm_source=${camp.channel}&utm_medium=paid&utm_campaign=${camp.slug}`;

  return (
    <AdminLayout>
      <div style={{ padding: 32, maxWidth: 960 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <Link href="/admin/marketing" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>← Marketing</Link>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, color: 'var(--dark)', marginBottom: 4 }}>
                {camp.name}
              </h1>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>{camp.channel} · slug: <code style={{ fontSize: 12 }}>{camp.slug}</code></p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select value={camp.status} onChange={e => changeStatus(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {VALID_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <button onClick={duplicate} style={{ ...inputStyle, cursor: 'pointer', background: 'none', border: '1px solid var(--border)' }}>
                Duplicate
              </button>
            </div>
          </div>
        </div>

        {/* Stats band */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', marginBottom: 28 }}>
          {[
            ['Visits', stats.visits],
            ['Orders', stats.orders],
            ['Revenue', fmt(stats.revenue)],
            ['Net revenue', fmt(stats.netRevenue)],
            ['ROAS', stats.roas !== null ? `${stats.roas.toFixed(2)}×` : '—'],
            ['Conv. rate', stats.conversionRate !== null ? `${stats.conversionRate}%` : '—'],
            ['Avg order', stats.averageOrderValue !== null ? fmt(stats.averageOrderValue) : '—'],
            ['Cost/order', stats.costPerOrder !== null ? fmt(stats.costPerOrder) : '—'],
          ].map(([label, val]) => (
            <div key={label as string} style={{ background: 'white', padding: '16px 18px' }}>
              <div style={{ fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 20, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* UTM base link */}
        <div style={{ background: '#f5f2ec', border: '1px solid var(--border)', padding: '12px 16px', marginBottom: 28, fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>
          <span style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'inherit', display: 'block', marginBottom: 4 }}>Base UTM link</span>
          {utmBase}
        </div>

        {/* Two-col: spend log + creatives */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
          {/* Spend log */}
          <div style={{ background: 'white', border: '1px solid var(--border)', padding: 20 }}>
            <span style={sectionTitle}>Spend log · total {fmt(camp.spend)}</span>
            {camp.spendUpdates.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>No spend recorded yet.</p>
              : <div style={{ marginBottom: 16 }}>
                {[...camp.spendUpdates].reverse().map((u, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span>{new Date(u.date).toLocaleDateString()}{u.note ? ` — ${u.note}` : ''}</span>
                    <span>{fmt(u.amount)}</span>
                  </div>
                ))}
              </div>
            }
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, flex: '0 0 100px' }} type="number" step="0.01" min="0" placeholder="€ amount" value={spendAmt} onChange={e => setSpendAmt(e.target.value)} />
              <input style={{ ...inputStyle, flex: 1, minWidth: 80 }} placeholder="Note (optional)" value={spendNote} onChange={e => setSpendNote(e.target.value)} />
              <button onClick={addSpend} disabled={addingSpend} style={{ ...inputStyle, cursor: 'pointer', background: 'var(--dark)', color: 'white', border: '1px solid var(--dark)', whiteSpace: 'nowrap' }}>
                {addingSpend ? '…' : 'Add'}
              </button>
            </div>
          </div>

          {/* Creatives */}
          <div style={{ background: 'white', border: '1px solid var(--border)', padding: 20 }}>
            <span style={sectionTitle}>Creatives</span>
            {camp.creatives.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>No creatives added yet.</p>
              : <div style={{ marginBottom: 16 }}>
                {camp.creatives.map((cr, i) => (
                  <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{cr.name}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>utm_content={cr.utmContent}</span>
                    {stats.topCreatives.find(c => c.utmContent === cr.utmContent) && (
                      <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 8 }}>
                        ({stats.topCreatives.find(c => c.utmContent === cr.utmContent)?.orders} orders)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            }
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, flex: 1, minWidth: 100 }} placeholder="Creative name" value={crName} onChange={e => setCrName(e.target.value)} />
              <input style={{ ...inputStyle, flex: 1, minWidth: 100 }} placeholder="utm_content value" value={crContent} onChange={e => setCrContent(e.target.value)} />
              <button onClick={addCreative} disabled={addingCr} style={{ ...inputStyle, cursor: 'pointer', background: 'var(--dark)', color: 'white', border: '1px solid var(--dark)' }}>
                {addingCr ? '…' : 'Add'}
              </button>
            </div>
          </div>
        </div>

        {/* Attributed orders */}
        <span style={sectionTitle}>Attributed orders</span>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 32 }}>
          <thead>
            <tr>
              {['Order', 'Date', 'Total', 'Status', 'Email', 'Creative', 'Product'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.attributedOrders.length === 0
              ? <tr><td colSpan={7} style={{ ...cellStyle, textAlign: 'center', color: 'var(--muted)', padding: '28px 12px' }}>No orders attributed to this campaign yet.</td></tr>
              : stats.attributedOrders.map(o => (
                <tr key={o._id}>
                  <td style={cellStyle}><Link href={`/admin/orders/${o._id}`} style={{ color: 'var(--dark)', textDecoration: 'none' }}>{o.orderNumber}</Link></td>
                  <td style={cellStyle}>{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td style={cellStyle}>{fmt(o.total)}</td>
                  <td style={cellStyle}>{o.status}</td>
                  <td style={cellStyle}>{o.customerEmail || '—'}</td>
                  <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: 11 }}>{o.utmContent || '—'}</td>
                  <td style={cellStyle}>{o.firstItem || '—'}</td>
                </tr>
              ))
            }
          </tbody>
        </table>

        {/* Notes */}
        {camp.notes && (
          <div style={{ background: '#f5f2ec', border: '1px solid var(--border)', padding: '14px 18px', fontSize: 13, color: 'var(--dark)', lineHeight: 1.6 }}>
            <span style={sectionTitle}>Notes</span>
            <p style={{ margin: 0 }}>{camp.notes}</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

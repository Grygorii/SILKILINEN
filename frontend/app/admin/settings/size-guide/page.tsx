'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';
import { toast } from '@/lib/adminToast';

const API = process.env.NEXT_PUBLIC_API_URL;

type Row = { size: string; eu: string; uk: string; bustCm: string; bustIn: string; waistCm: string; waistIn: string; hipCm: string; hipIn: string };

const COLS: { key: keyof Row; label: string }[] = [
  { key: 'size', label: 'Size' }, { key: 'eu', label: 'EU' }, { key: 'uk', label: 'UK' },
  { key: 'bustCm', label: 'Bust cm' }, { key: 'bustIn', label: 'Bust in' },
  { key: 'waistCm', label: 'Waist cm' }, { key: 'waistIn', label: 'Waist in' },
  { key: 'hipCm', label: 'Hip cm' }, { key: 'hipIn', label: 'Hip in' },
];
const BLANK: Row = { size: '', eu: '', uk: '', bustCm: '', bustIn: '', waistCm: '', waistIn: '', hipCm: '', hipIn: '' };

const cell: React.CSSProperties = { width: '100%', padding: '6px 7px', border: '1px solid var(--border, #d9d2c6)', fontSize: 12, background: '#fff' };
const btn: React.CSSProperties = { border: '1px solid var(--border, #cfc7b8)', background: '#fff', padding: '6px 10px', fontSize: 12, cursor: 'pointer' };

export default function SizeGuideEditorPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/size-chart`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.rows) setRows(d.rows); })
      .finally(() => setLoading(false));
  }, []);

  function update(i: number, k: keyof Row, v: string) {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  }
  function remove(i: number) { setRows(prev => prev.filter((_, idx) => idx !== i)); }
  function add() { setRows(prev => [...prev, { ...BLANK }]); }

  async function save() {
    setSaving(true);
    try {
      const clean = rows.filter(r => r.size.trim());
      const res = await fetch(`${API}/api/size-chart`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: clean }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed');
      setRows((await res.json()).rows);
      toast('Size chart saved — live on the storefront.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 900 }}>
        <Link href="/admin/settings" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>← Settings</Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, margin: '8px 0' }}>Size guide</h1>
          <button onClick={save} disabled={saving}
            style={{ background: 'var(--dark, #1a1916)', color: '#fff', border: 'none', padding: '10px 22px', fontSize: 14, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 18px' }}>
          The measurement table on the storefront size guide. Use ranges like “80–84”. Rows without a size are dropped.
        </p>

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
                <thead>
                  <tr>
                    {COLS.map(c => <th key={c.key} style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--muted)', textAlign: 'left', padding: '4px 6px' }}>{c.label}</th>)}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {COLS.map(c => (
                        <td key={c.key} style={{ padding: '3px 4px' }}>
                          <input style={cell} value={r[c.key]} onChange={e => update(i, c.key, e.target.value)} />
                        </td>
                      ))}
                      <td style={{ padding: '3px 4px' }}>
                        <button style={{ ...btn, color: '#b03a2e' }} onClick={() => remove(i)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button style={{ ...btn, marginTop: 12 }} onClick={add}>+ Add row</button>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

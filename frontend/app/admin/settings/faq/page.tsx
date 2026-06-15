'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';
import { toast } from '@/lib/adminToast';

const API = process.env.NEXT_PUBLIC_API_URL;

type Faq = { q: string; a: string };

const input: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid var(--border, #d9d2c6)', fontSize: 14, background: '#fff' };
const card: React.CSSProperties = { border: '1px solid var(--border, #e6e1d8)', background: '#fff', padding: 16, marginBottom: 12 };
const btn: React.CSSProperties = { border: '1px solid var(--border, #cfc7b8)', background: '#fff', padding: '7px 12px', fontSize: 13, cursor: 'pointer' };

export default function FaqEditorPage() {
  const [items, setItems] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/faq`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.items) setItems(d.items); })
      .finally(() => setLoading(false));
  }, []);

  function update(i: number, k: keyof Faq, v: string) {
    setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  }
  function remove(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)); }
  function move(i: number, dir: -1 | 1) {
    setItems(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function add() { setItems(prev => [...prev, { q: '', a: '' }]); }

  async function save() {
    setSaving(true);
    try {
      const clean = items.filter(it => it.q.trim() && it.a.trim());
      const res = await fetch(`${API}/api/faq`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: clean }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed');
      setItems((await res.json()).items);
      toast('FAQ saved — live on the storefront.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 720 }}>
        <Link href="/admin/settings" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>← Settings</Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, margin: '8px 0' }}>FAQ</h1>
          <button onClick={save} disabled={saving}
            style={{ background: 'var(--dark, #1a1916)', color: '#fff', border: 'none', padding: '10px 22px', fontSize: 14, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 18px' }}>
          Edit the questions &amp; answers shown on the storefront FAQ page. Empty rows are dropped on save.
        </p>

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : (
          <>
            {items.map((it, i) => (
              <div key={i} style={card}>
                <input style={{ ...input, fontWeight: 500, marginBottom: 8 }} placeholder="Question"
                  value={it.q} onChange={e => update(i, 'q', e.target.value)} />
                <textarea style={{ ...input, minHeight: 80, resize: 'vertical' }} placeholder="Answer"
                  value={it.a} onChange={e => update(i, 'a', e.target.value)} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button style={btn} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button style={btn} onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
                  <button style={{ ...btn, color: '#b03a2e', marginLeft: 'auto' }} onClick={() => remove(i)}>Remove</button>
                </div>
              </div>
            ))}
            <button style={{ ...btn, marginTop: 4 }} onClick={add}>+ Add question</button>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

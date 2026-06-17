'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';

const API = process.env.NEXT_PUBLIC_API_URL;

type Entry = { _id: string; kind: 'lesson' | 'pitfall' | 'fact' | 'decision'; text: string; detail?: string; source?: string; weight: number; hits: number };
type Stats = { counts: { total: number; lesson: number; pitfall: number; fact: number; decision: number }; top: Entry[] };

const dark = 'var(--dark, #2a2218)';
const muted = 'var(--muted, #8a8680)';
const border = '1px solid var(--border, #e8e2d6)';
const serif = "'Cormorant Garamond', Georgia, serif";

const KIND = {
  lesson:   { label: 'What works', color: '#2d7d47', bg: '#e8f5e9' },
  pitfall:  { label: 'Avoid (we got it wrong)', color: '#b03a2e', bg: '#fdf3f1' },
  fact:     { label: 'Verified fact', color: '#3a6ea5', bg: '#eef3f8' },
  decision: { label: 'Decision to honour', color: '#b8863b', bg: '#fbf3e7' },
} as const;

export default function MemoryPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'decision' | 'fact'>('decision');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/memory`, { credentials: 'include' });
      const data = await res.json();
      if (data?.counts) setStats(data);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function teach() {
    if (!text.trim()) return;
    try {
      const res = await fetch(`${API}/api/admin/memory`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, text: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add');
      setText(''); load(); toast('Archivarius will remember that.', 'success');
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not add', 'error'); }
  }

  const c = stats?.counts;
  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 920 }}>
        <h1 style={{ fontFamily: serif, fontSize: 28, fontWeight: 300, color: dark, margin: 0, letterSpacing: '1px' }}>Archivarius</h1>
        <p style={{ fontSize: 13, color: muted, marginTop: 6, marginBottom: 22, fontStyle: 'italic' }}>
          The house&rsquo;s living memory. The team feeds it; it reinforces what recurs and feeds back wins, mistakes-to-avoid, and verified facts — so the agents get wiser and stop repeating errors.
        </p>

        {c && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
            {[['total', 'Memories'], ['lesson', 'Lessons'], ['pitfall', 'Pitfalls'], ['fact', 'Facts'], ['decision', 'Decisions']].map(([k, lbl]) => (
              <div key={k} style={{ border, padding: '12px 18px', minWidth: 96 }}>
                <div style={{ fontFamily: serif, fontSize: 26, color: dark }}>{c[k as keyof typeof c]}</div>
                <div style={{ fontSize: 11, color: muted, letterSpacing: '0.5px' }}>{lbl}</div>
              </div>
            ))}
          </div>
        )}

        {/* Teach it */}
        <div style={{ background: 'white', border, padding: '16px 18px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={kind} onChange={e => setKind(e.target.value as 'decision' | 'fact')} style={{ padding: '9px 10px', border, fontFamily: 'inherit', fontSize: 13 }}>
            <option value="decision">Decision to honour</option>
            <option value="fact">Verified fact</option>
          </select>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && teach()}
            placeholder="Teach Archivarius — e.g. “Origin is mixed; never claim made-in-Ireland”"
            style={{ flex: 1, minWidth: 260, padding: '9px 12px', border, fontFamily: 'inherit', fontSize: 13.5, color: dark }} />
          <button onClick={teach} style={{ padding: '9px 18px', background: dark, color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Remember</button>
        </div>

        {/* The strongest memory */}
        {stats?.top && stats.top.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {stats.top.map(e => {
              const k = KIND[e.kind];
              return (
                <div key={e._id} style={{ border, borderLeft: `3px solid ${k.color}`, padding: '10px 14px', background: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 13.5, color: dark }}>{e.text}</span>
                    <span style={{ fontSize: 10, color: k.color, background: k.bg, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap', height: 'fit-content' }}>{k.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>
                    {e.source ? `from ${e.source} · ` : ''}reinforced ×{e.hits}{e.weight > e.hits ? ` · weight ${e.weight}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: muted }}>No memory yet — it fills as the agents run and the clerks catch things. Teach it a fact or decision above to start.</p>
        )}
      </div>
    </AdminLayout>
  );
}

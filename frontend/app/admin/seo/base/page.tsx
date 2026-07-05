'use client';

// THE SEO BASE — the founder's "site plan". One table of every indexable URL on
// the shop with its meta title + description (wherever that meta lives), colour-
// coded by snippet-length health, editable inline. Saving routes the change back
// to the right store via PATCH /api/admin/seo-base. This is the place to read the
// whole shop's SEO at a glance and override anything the AI wrote.

import { useState, useEffect, useCallback, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';

const API = process.env.NEXT_PUBLIC_API_URL;

const dark = 'var(--dark, #2a2218)';
const muted = 'var(--muted, #8a8680)';
const border = '1px solid var(--border, #e8e2d6)';
const serif = "'Cormorant Garamond', Georgia, serif";
const health = { good: '#2d7d47', warn: '#b8863b', bad: '#b03a2e' } as const;

type Health = 'good' | 'warn' | 'bad';
type Row = {
  type: 'page' | 'product' | 'category' | 'collection';
  id: string; label: string; url: string;
  title: string; titleLen: number; titleHealth: Health;
  description: string; descLen: number; descHealth: Health;
  note: string;
};
type Filter = 'all' | 'attention' | 'product' | 'category' | 'collection' | 'page';

const TITLE_MAX = 70;
const DESC_MAX = 165;

export default function SeoBasePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  // Local edits keyed by `${type}:${id}` → { title, description }.
  const [edits, setEdits] = useState<Record<string, { title: string; description: string }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/seo-base`, { credentials: 'include' });
      const data = await res.json();
      if (Array.isArray(data.rows)) setRows(data.rows);
    } catch { toast('Could not load the SEO Base.', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const keyOf = (r: Row) => `${r.type}:${r.id}`;

  const counts = useMemo(() => {
    const needsWork = rows.filter(r => r.titleHealth === 'bad' || r.descHealth === 'bad').length;
    return { total: rows.length, needsWork };
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(r => {
      if (filter === 'attention') { if (r.titleHealth !== 'bad' && r.descHealth !== 'bad') return false; }
      else if (filter !== 'all' && r.type !== filter) return false;
      if (needle && !(`${r.label} ${r.url}`.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [rows, filter, q]);

  function setField(r: Row, field: 'title' | 'description', value: string) {
    const k = keyOf(r);
    setEdits(prev => ({
      ...prev,
      [k]: {
        title: field === 'title' ? value : (prev[k]?.title ?? r.title),
        description: field === 'description' ? value : (prev[k]?.description ?? r.description),
      },
    }));
  }

  function current(r: Row) {
    const e = edits[keyOf(r)];
    return { title: e?.title ?? r.title, description: e?.description ?? r.description };
  }
  function isDirty(r: Row) {
    const c = current(r);
    return c.title !== r.title || c.description !== r.description;
  }

  async function save(r: Row) {
    const k = keyOf(r);
    const c = current(r);
    setSavingKey(k);
    try {
      const res = await fetch(`${API}/api/admin/seo-base`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: r.type, id: r.id, metaTitle: c.title, metaDescription: c.description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      // Reflect the saved values (and recompute health) into the row.
      setRows(prev => prev.map(x => x === r ? {
        ...x,
        title: data.metaTitle, titleLen: (data.metaTitle || '').trim().length, titleHealth: titleHealth(data.metaTitle),
        description: data.metaDescription, descLen: (data.metaDescription || '').trim().length, descHealth: descHealth(data.metaDescription),
        note: '',
      } : x));
      setEdits(prev => { const n = { ...prev }; delete n[k]; return n; });
      toast('Saved.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally { setSavingKey(null); }
  }

  const TABS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Everything' },
    { key: 'attention', label: `Needs attention${counts.needsWork ? ` (${counts.needsWork})` : ''}` },
    { key: 'product', label: 'Products' },
    { key: 'category', label: 'Categories' },
    { key: 'collection', label: 'Collections' },
    { key: 'page', label: 'Pages' },
  ];

  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 1080 }}>
        <h1 style={{ fontFamily: serif, fontSize: 28, fontWeight: 300, color: dark, margin: 0, letterSpacing: '1px' }}>SEO Base</h1>
        <p style={{ fontSize: 13, color: muted, marginTop: 6, fontStyle: 'italic', maxWidth: 680 }}>
          Your site plan — every indexable page in one place. Green is healthy, amber is a nudge, red needs a title or
          description. Edit any line; it saves back to wherever that page&apos;s SEO lives.
        </p>

        <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 13, color: muted }}>
          <span><strong style={{ color: dark }}>{counts.total}</strong> pages</span>
          <span style={{ color: counts.needsWork ? health.bad : health.good }}>
            <strong>{counts.needsWork}</strong> missing a title or description
          </span>
        </div>

        {/* Filters + search */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '18px 0 4px' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)} style={{
              padding: '6px 12px', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer',
              border, background: filter === t.key ? dark : '#fff', color: filter === t.key ? '#fff' : dark,
            }}>{t.label}</button>
          ))}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search page or URL…" style={{
            marginLeft: 'auto', padding: '7px 12px', fontSize: 13, fontFamily: 'inherit', border, minWidth: 220,
          }} />
        </div>

        {loading ? (
          <p style={{ color: muted, fontSize: 13, marginTop: 24 }}>Loading the site plan…</p>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {shown.map(r => {
              const c = current(r);
              const tHealth = titleHealth(c.title), dHealth = descHealth(c.description);
              const dirty = isDirty(r);
              const k = keyOf(r);
              return (
                <div key={k} style={{ border, background: '#fff', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: muted, border, padding: '1px 6px' }}>{r.type}</span>
                    <span style={{ fontSize: 14, color: dark, fontWeight: 500 }}>{r.label}</span>
                    <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: '#b8863b' }}>open →</a>
                  </div>

                  <Field
                    label="Meta title" value={c.title} max={TITLE_MAX} healthColor={health[tHealth]}
                    onChange={v => setField(r, 'title', v)} />
                  <Field
                    label="Meta description" value={c.description} max={DESC_MAX} healthColor={health[dHealth]} textarea
                    onChange={v => setField(r, 'description', v)} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                    {r.note && <span style={{ fontSize: 11.5, color: muted, fontStyle: 'italic' }}>{r.note}</span>}
                    <button onClick={() => save(r)} disabled={!dirty || savingKey === k} style={{
                      marginLeft: 'auto', padding: '7px 16px', fontSize: 12.5, fontFamily: 'inherit',
                      border: 'none', background: dirty ? dark : 'var(--border, #e8e2d6)',
                      color: dirty ? '#fff' : muted, cursor: dirty && savingKey !== k ? 'pointer' : 'default',
                    }}>{savingKey === k ? 'Saving…' : (dirty ? 'Save' : 'Saved')}</button>
                  </div>
                </div>
              );
            })}
            {shown.length === 0 && <p style={{ color: muted, fontSize: 13 }}>Nothing matches that filter.</p>}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Field({ label, value, max, healthColor, onChange, textarea }: {
  label: string; value: string; max: number; healthColor: string; onChange: (v: string) => void; textarea?: boolean;
}) {
  const len = (value || '').trim().length;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <label style={{ fontSize: 10.5, letterSpacing: '0.8px', textTransform: 'uppercase', color: muted }}>{label}</label>
        <span style={{ fontSize: 11, color: healthColor, fontVariantNumeric: 'tabular-nums' }}>{len}/{max}</span>
      </div>
      {textarea ? (
        <textarea value={value} maxLength={max} onChange={e => onChange(e.target.value)} rows={2} style={{
          width: '100%', padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5,
          border: `1px solid ${healthColor}`, borderLeftWidth: 3, resize: 'vertical', color: dark,
        }} />
      ) : (
        <input value={value} maxLength={max} onChange={e => onChange(e.target.value)} style={{
          width: '100%', padding: '7px 10px', fontSize: 13, fontFamily: 'inherit',
          border: `1px solid ${healthColor}`, borderLeftWidth: 3, color: dark,
        }} />
      )}
    </div>
  );
}

// Mirror of the backend thresholds so the UI recolours live as you type.
function titleHealth(t: string): Health {
  const n = (t || '').trim().length;
  if (n === 0) return 'bad';
  if (n > 60 || n < 25) return 'warn';
  return 'good';
}
function descHealth(d: string): Health {
  const n = (d || '').trim().length;
  if (n === 0) return 'bad';
  if (n > 160 || n < 70) return 'warn';
  return 'good';
}

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
type AutofixItem = { type: string; label: string; url?: string; filled?: string[]; metaTitle?: string; metaDescription?: string; error?: string };
type AutofixReport = { ran: boolean; applied: number; failed: number; hitLimit: boolean; titles: number; descriptions: number; report: AutofixItem[]; flagged: string };

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
  const [fixing, setFixing] = useState(false);
  const [report, setReport] = useState<AutofixReport | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);           // which row's checks panel is open
  const [focus, setFocus] = useState<Record<string, string>>({});        // per-row focus phrase (ephemeral)

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

  async function runAutofix() {
    setFixing(true); setReport(null);
    try {
      const res = await fetch(`${API}/api/admin/seo-base/autofix`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auto-fix failed');
      setReport(data);
      if (data.applied > 0) toast(`Filled ${data.titles} title${data.titles === 1 ? '' : 's'} + ${data.descriptions} description${data.descriptions === 1 ? '' : 's'}.`, 'success');
      else toast('Nothing missing — every page already has a title and description. ✦', 'success');
      load(); // refresh the table so filled rows turn green
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Auto-fix failed', 'error');
    } finally { setFixing(false); }
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

        <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 13, color: muted, alignItems: 'center', flexWrap: 'wrap' }}>
          <span><strong style={{ color: dark }}>{counts.total}</strong> pages</span>
          <span style={{ color: counts.needsWork ? health.bad : health.good }}>
            <strong>{counts.needsWork}</strong> missing a title or description
          </span>
          <button onClick={runAutofix} disabled={fixing || counts.needsWork === 0} title="Hermes writes a meta title + description for every page that's missing one. Safe: it only fills gaps — never changes URLs or overwrites what you've written."
            style={{
              marginLeft: 'auto', padding: '9px 18px', fontSize: 12.5, fontFamily: 'inherit', whiteSpace: 'nowrap',
              border: 'none', background: counts.needsWork ? dark : 'var(--border, #e8e2d6)',
              color: counts.needsWork ? '#fff' : muted, cursor: fixing || !counts.needsWork ? 'default' : 'pointer', opacity: fixing ? 0.6 : 1,
            }}>{fixing ? 'Hermes is writing… (up to a minute)' : `✦ Auto-fix the ${counts.needsWork || ''} missing`}</button>
        </div>

        {report && (
          <div style={{ marginTop: 16, border, background: '#fff', padding: '16px 18px' }}>
            <div style={{ fontFamily: serif, fontSize: 18, color: dark }}>
              Auto-fix report — filled {report.titles} title{report.titles === 1 ? '' : 's'} + {report.descriptions} description{report.descriptions === 1 ? '' : 's'}
              {report.failed > 0 && <span style={{ color: health.bad, fontSize: 13 }}> · {report.failed} failed</span>}
              {report.hitLimit && <span style={{ color: health.warn, fontSize: 13 }}> · per-run cap hit, run again for the rest</span>}
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {report.report.filter(r => r.filled?.length).slice(0, 40).map((r, i) => (
                <div key={i} style={{ borderLeft: `3px solid ${health.good}`, paddingLeft: 10 }}>
                  <div style={{ fontSize: 12.5, color: dark }}><strong>{r.label}</strong> <span style={{ color: muted }}>· wrote {r.filled?.join(' + ')}</span></div>
                  {r.metaTitle && <div style={{ fontSize: 12, color: muted }}>“{r.metaTitle}”</div>}
                  {r.metaDescription && <div style={{ fontSize: 12, color: muted }}>“{r.metaDescription}”</div>}
                </div>
              ))}
            </div>
            {report.flagged && (
              <p style={{ fontSize: 11.5, color: muted, marginTop: 12, paddingTop: 10, borderTop: border, fontStyle: 'italic' }}>{report.flagged}</p>
            )}
            <button onClick={() => setReport(null)} style={{ marginTop: 10, padding: '5px 12px', fontSize: 12, fontFamily: 'inherit', border, background: '#fff', color: muted, cursor: 'pointer' }}>Dismiss</button>
          </div>
        )}

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
                    <button onClick={() => setOpenKey(openKey === k ? null : k)} style={{
                      marginLeft: r.note ? 0 : 'auto', padding: '7px 12px', fontSize: 12, fontFamily: 'inherit',
                      border, background: '#fff', color: muted, cursor: 'pointer',
                    }}>{openKey === k ? 'Hide checks' : 'Preview & checks'}</button>
                    <button onClick={() => save(r)} disabled={!dirty || savingKey === k} style={{
                      marginLeft: r.note ? 'auto' : 0, padding: '7px 16px', fontSize: 12.5, fontFamily: 'inherit',
                      border: 'none', background: dirty ? dark : 'var(--border, #e8e2d6)',
                      color: dirty ? '#fff' : muted, cursor: dirty && savingKey !== k ? 'pointer' : 'default',
                    }}>{savingKey === k ? 'Saving…' : (dirty ? 'Save' : 'Saved')}</button>
                  </div>

                  {openKey === k && (
                    <SeoChecks
                      title={c.title} description={c.description} url={r.url}
                      phrase={focus[k] || ''} onPhrase={v => setFocus(prev => ({ ...prev, [k]: v }))} />
                  )}
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

// The Yoast-style writing assistant: a live Google snippet preview + a green/
// amber/red checklist. Optional focus phrase — the thing you want the page to
// rank for — checks whether it actually appears where it should. Pure client
// analysis, nothing persisted; it's a writing aid, not a data field.
function SeoChecks({ title, description, url, phrase, onPhrase }: {
  title: string; description: string; url: string; phrase: string; onPhrase: (v: string) => void;
}) {
  const t = (title || '').trim(), d = (description || '').trim();
  // Google shows roughly the first ~60 chars of a title and ~155 of a description.
  const tShown = t.length > 60 ? t.slice(0, 60).trimEnd() + '…' : t;
  const dShown = d.length > 155 ? d.slice(0, 155).trimEnd() + '…' : d;
  let crumb = url;
  try { const u = new URL(url); crumb = (u.host + u.pathname + u.search).replace(/\/$/, '').replace(/\//g, ' › '); } catch { /* keep raw */ }

  const p = phrase.trim().toLowerCase();
  const inText = (s: string) => p && s.toLowerCase().includes(p);
  const checks: { ok: Health; text: string }[] = [
    { ok: t.length === 0 ? 'bad' : t.length > 60 ? 'warn' : t.length < 25 ? 'warn' : 'good',
      text: t.length === 0 ? 'No meta title' : t.length > 60 ? `Title is ${t.length} chars — Google may cut it off (~60)` : t.length < 25 ? `Title is short (${t.length} chars)` : `Title length is good (${t.length})` },
    { ok: d.length === 0 ? 'bad' : d.length > 160 ? 'warn' : d.length < 70 ? 'warn' : 'good',
      text: d.length === 0 ? 'No meta description' : d.length > 160 ? `Description is ${d.length} chars — trimmed at ~160` : d.length < 70 ? `Description is short (${d.length} chars)` : `Description length is good (${d.length})` },
  ];
  if (p) {
    checks.push({ ok: inText(t) ? 'good' : 'warn', text: inText(t) ? 'Focus phrase is in the title' : 'Focus phrase is not in the title' });
    checks.push({ ok: inText(d) ? 'good' : 'warn', text: inText(d) ? 'Focus phrase is in the description' : 'Focus phrase is not in the description' });
    checks.push({ ok: inText(url) ? 'good' : 'warn', text: inText(url) ? 'Focus phrase is in the URL' : 'Focus phrase is not in the URL (changing URLs needs a redirect)' });
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: border }}>
      {/* Google snippet preview */}
      <div style={{ background: '#fff', border, padding: '12px 14px', maxWidth: 600 }}>
        <div style={{ fontSize: 12, color: '#4d5156', marginBottom: 2 }}>{crumb}</div>
        <div style={{ fontSize: 18, color: '#1a0dab', lineHeight: 1.3, fontFamily: 'arial, sans-serif' }}>{tShown || 'Untitled page'}</div>
        <div style={{ fontSize: 13, color: '#4d5156', lineHeight: 1.5, fontFamily: 'arial, sans-serif', marginTop: 2 }}>
          {dShown || <span style={{ fontStyle: 'italic', color: muted }}>No description — Google will invent one from the page.</span>}
        </div>
      </div>

      {/* Focus phrase */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 8px' }}>
        <label style={{ fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', color: muted, whiteSpace: 'nowrap' }}>Focus phrase</label>
        <input value={phrase} onChange={e => onPhrase(e.target.value)} placeholder="e.g. silk bikini brief — what you want this page to rank for"
          style={{ flex: 1, padding: '6px 10px', fontSize: 12.5, fontFamily: 'inherit', border }} />
      </div>

      {/* Checklist */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
        {checks.map((c, i) => (
          <li key={i} style={{ fontSize: 12.5, color: dark, display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ color: health[c.ok], fontSize: 11 }}>●</span> {c.text}
          </li>
        ))}
      </ul>
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

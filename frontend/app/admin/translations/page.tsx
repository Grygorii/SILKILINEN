'use client';

// Admin → Translations. The control room for the multi-language store: run the
// AI translation of the catalogue, watch coverage per language, and (once run)
// spot-check by opening the localized storefront. Backend: /api/admin/translations.

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';

const API = process.env.NEXT_PUBLIC_API_URL;

const dark = 'var(--color-ink)';
const muted = 'var(--color-ink-muted)';
const border = '1px solid var(--color-line)';
const serif = "'Cormorant Garamond', Georgia, serif";
const good = 'var(--color-success)';

type LocaleMeta = { label: string; english: string };
type Summary = {
  configured: boolean;
  locales: Record<string, LocaleMeta>;
  sourceCounts: { product: number; category: number; collection: number };
  translated: Record<string, Record<string, number>>; // locale -> type -> count
  partial: Record<string, Record<string, number>>;
  resources: { type: string; id: string; label: string }[];
};
type EditorData = { source: Record<string, string>; translations: Record<string, { fields: Record<string, string>; source: string }> };

const TYPES: { key: 'product' | 'category' | 'collection'; label: string }[] = [
  { key: 'product', label: 'Products' },
  { key: 'category', label: 'Categories' },
  { key: 'collection', label: 'Collections' },
];

export default function TranslationsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState('');
  const [editor, setEditor] = useState<EditorData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/translations`, { credentials: 'include' });
      if (res.ok) setSummary(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function run(force: boolean) {
    setRunning(true);
    try {
      const res = await fetch(`${API}/api/admin/translations/run`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Translation run failed');
      if (!data.ran) { toast(data.note || 'Set DEEPSEEK_API_KEY to enable translation.', 'info'); return; }
      const parts = [`${data.translated} translated`];
      if (data.exists) parts.push(`${data.exists} already done`);
      if (data.keptManual) parts.push(`${data.keptManual} kept (edited)`);
      if (data.failed) parts.push(`${data.failed} failed`);
      toast(`${parts.join(' · ')}${data.hitLimit ? ' — run again to continue.' : '.'}`, data.failed ? 'info' : 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Translation run failed', 'error');
    } finally { setRunning(false); }
  }

  async function openResource(value: string) {
    setSelected(value); setEditor(null); setDrafts({});
    if (!value) return;
    const [type, id] = value.split(':');
    const res = await fetch(`${API}/api/admin/translations/${type}/${id}`, { credentials: 'include' });
    if (!res.ok) return toast('Could not load this translation.', 'error');
    const data: EditorData = await res.json();
    setEditor(data);
    setDrafts(Object.fromEntries(Object.keys(summary?.locales || {}).map(locale => [locale, { ...(data.translations[locale]?.fields || {}) }])));
  }

  async function saveLocale(locale: string) {
    const [resourceType, resourceId] = selected.split(':');
    setSaving(locale);
    try {
      const res = await fetch(`${API}/api/admin/translations`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resourceType, resourceId, locale, fields: drafts[locale] || {} }) });
      if (!res.ok) throw new Error('Save failed');
      toast(`${summary?.locales[locale]?.label || locale} saved as a manual translation.`, 'success');
      load();
    } catch { toast('Translation could not be saved.', 'error'); }
    finally { setSaving(''); }
  }

  const locales = summary ? Object.entries(summary.locales) : [];
  const totalSources = summary ? summary.sourceCounts.product + summary.sourceCounts.category + summary.sourceCounts.collection : 0;
  const localeTotal = (loc: string) => TYPES.reduce((s, t) => s + (summary?.translated?.[loc]?.[t.key] || 0), 0);

  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 940 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: serif, fontSize: 28, fontWeight: 300, color: dark, margin: 0, letterSpacing: '1px' }}>Translations</h1>
            <p style={{ fontSize: 13, color: muted, marginTop: 6, fontStyle: 'italic', maxWidth: 640 }}>
              Your catalogue in German, French, Italian &amp; Spanish — written natively by the house AI in the brand
              voice, not word-for-word. Run it to fill the store; visitors then see localized content at
              /de/, /fr/, /it/, /es/.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => run(false)} disabled={running || summary?.configured === false} style={{
              padding: '11px 22px', background: dark, color: 'var(--admin-surface)', border: 'none',
              cursor: running ? 'default' : 'pointer', opacity: running ? 0.6 : 1, fontFamily: 'inherit', fontSize: 13, letterSpacing: '0.5px', whiteSpace: 'nowrap',
            }}>{running ? 'Translating… (up to a minute)' : '✦ Translate the catalogue'}</button>
          </div>
        </div>

        {summary?.configured === false && (
          <div style={{ marginTop: 20, padding: '14px 18px', background: 'var(--admin-warning-soft)', border: '1px solid var(--admin-warning-soft)', fontSize: 13, color: 'var(--admin-warning)' }}>
            Translation needs <strong>DEEPSEEK_API_KEY</strong> in Railway (the same key the other AI agents use).
          </div>
        )}

        {loading ? (
          <p style={{ color: muted, fontSize: 13, marginTop: 24 }}>Loading coverage…</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 24 }}>
              {locales.map(([code, meta]) => {
                const done = localeTotal(code);
                // Clamped. The backend used to count translations for archived
                // resources against a live-only denominator, so this rendered
                // 118% with a progress bar past full. That is fixed at source,
                // but a coverage figure is a share of a whole and can never
                // exceed it — a bar that overflows should be impossible here,
                // not merely unlikely.
                const pct = totalSources ? Math.min(100, Math.round((done / totalSources) * 100)) : 0;
                return (
                  <div key={code} style={{ border, background: 'var(--admin-surface)', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 15, color: dark, fontWeight: 500 }}>{meta.label}</span>
                      <span style={{ fontSize: 12, color: pct >= 90 ? good : muted, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--color-line)', borderRadius: 2, margin: '8px 0 10px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: good }} />
                    </div>
                    {TYPES.map(t => (
                      <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: muted, padding: '2px 0' }}>
                        <span>{t.label}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {summary?.translated?.[code]?.[t.key] || 0}/{summary?.sourceCounts?.[t.key] || 0}
                        </span>
                      </div>
                    ))}
                    {TYPES.some(t => (summary?.partial?.[code]?.[t.key] || 0) > 0) && <p style={{ fontSize: 11, color: 'var(--admin-warning)', margin: '8px 0 0' }}>Includes partially translated records</p>}
                  </div>
                );
              })}
            </div>

            <p style={{ fontSize: 12.5, color: muted, marginTop: 20, lineHeight: 1.6 }}>
              Each run translates up to ~40 products (plus all categories &amp; collections) and skips anything already
              done, so <strong>run it a few times</strong> until every language reads 100%. Re-running never overwrites
              a translation you&apos;ve hand-edited. To spot-check, open your storefront at <code>/de/shop</code> (or
              /fr, /it, /es) — the language switcher is in the footer.
            </p>

            <section style={{ marginTop: 30, borderTop: border, paddingTop: 24 }}>
              <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: 22 }}>Review and edit</h2>
              <p style={{ color: muted, fontSize: 13 }}>Choose a catalogue record to compare every source field and correct any language. A saved edit is protected from later AI runs.</p>
              <select value={selected} onChange={e => openResource(e.target.value)} style={{ width: '100%', maxWidth: 520, padding: 10, border, background: 'var(--admin-surface)' }}>
                <option value="">Choose a product, category or collection…</option>
                {summary?.resources?.map(r => <option key={`${r.type}:${r.id}`} value={`${r.type}:${r.id}`}>{r.type} · {r.label}</option>)}
              </select>
              {editor && Object.entries(summary?.locales || {}).map(([locale, meta]) => (
                <div key={locale} style={{ marginTop: 22, padding: 18, border, background: 'var(--admin-surface)' }}>
                  <h3 style={{ marginTop: 0 }}>{meta.label}</h3>
                  {Object.entries(editor.source).filter(([, value]) => value).map(([field, source]) => (
                    <label key={field} style={{ display: 'block', marginTop: 12, fontSize: 12, color: muted }}>
                      {field}<span style={{ display: 'block', padding: '7px 0', color: dark }}>{source}</span>
                      <textarea value={drafts[locale]?.[field] || ''} onChange={e => setDrafts(old => ({ ...old, [locale]: { ...(old[locale] || {}), [field]: e.target.value } }))} rows={field.toLowerCase().includes('description') ? 4 : 2} style={{ width: '100%', padding: 10, border, resize: 'vertical', fontFamily: 'inherit' }} />
                    </label>
                  ))}
                  <button onClick={() => saveLocale(locale)} disabled={saving === locale} style={{ marginTop: 14, padding: '9px 18px', border: 'none', background: dark, color: 'var(--admin-surface)' }}>{saving === locale ? 'Saving…' : `Save ${meta.label}`}</button>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

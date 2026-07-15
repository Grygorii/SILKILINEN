'use client';

// Admin → Translations. The control room for the multi-language store: run the
// AI translation of the catalogue, watch coverage per language, and (once run)
// spot-check by opening the localized storefront. Backend: /api/admin/translations.

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';

const API = process.env.NEXT_PUBLIC_API_URL;

const dark = 'var(--color-ink, #2a2218)';
const muted = 'var(--color-ink-muted, #6b6358)';
const border = '1px solid var(--color-line, #e8e2d6)';
const serif = "'Cormorant Garamond', Georgia, serif";
const good = '#2d7d47';

type LocaleMeta = { label: string; english: string };
type Summary = {
  configured: boolean;
  locales: Record<string, LocaleMeta>;
  sourceCounts: { product: number; category: number; collection: number };
  translated: Record<string, Record<string, number>>; // locale -> type -> count
};

const TYPES: { key: 'product' | 'category' | 'collection'; label: string }[] = [
  { key: 'product', label: 'Products' },
  { key: 'category', label: 'Categories' },
  { key: 'collection', label: 'Collections' },
];

export default function TranslationsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

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
              padding: '11px 22px', background: dark, color: '#fff', border: 'none',
              cursor: running ? 'default' : 'pointer', opacity: running ? 0.6 : 1, fontFamily: 'inherit', fontSize: 13, letterSpacing: '0.5px', whiteSpace: 'nowrap',
            }}>{running ? 'Translating… (up to a minute)' : '✦ Translate the catalogue'}</button>
          </div>
        </div>

        {summary?.configured === false && (
          <div style={{ marginTop: 20, padding: '14px 18px', background: '#fdf6e9', border: '1px solid #e6d9bf', fontSize: 13, color: '#8a6d2f' }}>
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
                const pct = totalSources ? Math.round((done / totalSources) * 100) : 0;
                return (
                  <div key={code} style={{ border, background: '#fff', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 15, color: dark, fontWeight: 500 }}>{meta.label}</span>
                      <span style={{ fontSize: 12, color: pct >= 90 ? good : muted, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--color-line, #e8e2d6)', borderRadius: 2, margin: '8px 0 10px', overflow: 'hidden' }}>
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
          </>
        )}
      </div>
    </AdminLayout>
  );
}

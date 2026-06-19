'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;
const dark = 'var(--dark, #2a2218)';
const muted = 'var(--muted, #8a8680)';
const border = '1px solid var(--border, #e8e2d6)';
const serif = "'Cormorant Garamond', Georgia, serif";

type Sample = { title?: string; price?: number | null; url?: string; type?: string };
type Profile = {
  domain: string; name?: string; platform: string; currency?: string | null;
  productCount: number; productCountCapped?: boolean;
  priceMin?: number | null; priceMax?: number | null; priceAvg?: number | null;
  productTypes?: string[]; sampleProducts?: Sample[]; newest?: Sample[];
  lastScrapedAt?: string; lastError?: string | null;
};
type YourStore = { currency: string; productCount: number; priceMin: number | null; priceMax: number | null; priceAvg: number | null };

const PLATFORM_COLOR: Record<string, string> = { shopify: '#5a8f3d', woocommerce: '#7a5db8', jsonld: '#3d7d8f', other: '#8a8680', unknown: '#c0392b' };
const cur = (sym?: string | null) => (sym === 'GBP' ? '£' : sym === 'USD' ? '$' : sym === 'EUR' ? '€' : '');
function money(p?: Profile) {
  if (p?.priceMin == null) return '—';
  const c = cur(p.currency) || '';
  return p.priceMin === p.priceMax ? `${c}${p.priceMin}` : `${c}${p.priceMin}–${c}${p.priceMax}`;
}
function rel(iso?: string) {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export default function CompetitorsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [your, setYour] = useState<YourStore | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [sort, setSort] = useState<'count' | 'price'>('count');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/growth/competitors/profiles`, { credentials: 'include' });
      const d = await res.json();
      if (d?.profiles) { setProfiles(d.profiles); setYour(d.yourStore); setTotal(d.totalCompetitors || 0); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function scan() {
    setScanning(true);
    try {
      await fetch(`${API}/api/admin/growth/competitors/scan`, { method: 'POST', credentials: 'include' });
    } catch { /* ignore */ }
    // Poll while the background scan populates profiles (~2 min, then stop).
    let ticks = 0;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => { load(); if (++ticks >= 14) { clearInterval(pollRef.current!); setScanning(false); } }, 9000);
  }

  const sorted = [...profiles].sort((a, b) => sort === 'count' ? (b.productCount - a.productCount) : ((b.priceAvg || 0) - (a.priceAvg || 0)));
  const scraped = profiles.filter(p => p.platform !== 'unknown').length;

  return (
    <AdminLayout active="competitors">
      <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: serif, fontSize: 30, fontWeight: 300, color: dark, margin: 0, letterSpacing: '1px' }}>Competitor Intelligence</h1>
            <p style={{ fontSize: 13, color: muted, marginTop: 6, fontStyle: 'italic' }}>
              Live data scraped from every brand we can read — Shopify, WooCommerce, or any site&rsquo;s product schema. Prices, catalogue size, what&rsquo;s new.
            </p>
          </div>
          <button onClick={scan} disabled={scanning} style={{ padding: '10px 18px', background: dark, color: '#faf8f4', border: 'none', cursor: scanning ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', opacity: scanning ? 0.7 : 1 }}>
            {scanning ? 'Scanning…' : '✦ Scan competitors'}
          </button>
        </div>

        {/* Your benchmark */}
        {your && (
          <div style={{ border, background: 'var(--warm-white,#faf8f4)', padding: '14px 18px', margin: '18px 0', display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: muted }}>You</span>
            <span style={{ fontSize: 14, color: dark }}><strong>{your.productCount}</strong> products</span>
            <span style={{ fontSize: 14, color: dark }}>€{your.priceMin}–€{your.priceMax} <span style={{ color: muted }}>(avg €{your.priceAvg})</span></span>
            <span style={{ fontSize: 12.5, color: muted, marginLeft: 'auto' }}>{scraped} of {total} competitors scraped{scanning ? ' · scanning…' : ''}</span>
          </div>
        )}

        {/* Sort */}
        <div style={{ display: 'flex', gap: 8, margin: '0 0 14px' }}>
          {(['count', 'price'] as const).map(s => (
            <button key={s} onClick={() => setSort(s)} style={{ padding: '6px 12px', fontSize: 12, background: sort === s ? dark : 'white', color: sort === s ? '#faf8f4' : dark, border, cursor: 'pointer', fontFamily: 'inherit' }}>
              {s === 'count' ? 'Biggest catalogue' : 'Highest avg price'}
            </button>
          ))}
        </div>

        {loading ? <p style={{ fontSize: 13, color: muted }}>Loading…</p>
          : profiles.length === 0 ? (
            <div style={{ border, padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: dark, margin: 0 }}>No competitor data yet.</p>
              <p style={{ fontSize: 13, color: muted, marginTop: 6 }}>Hit <strong>Scan competitors</strong> — it reads each brand&rsquo;s live store in the background (~1–2 min).</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {sorted.map(p => (
                <div key={p.domain} style={{ border, background: 'white', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <a href={`https://${p.domain}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 15.5, color: dark, fontWeight: 500, textDecoration: 'none' }}>{p.name || p.domain}</a>
                      <span style={{ fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase', color: PLATFORM_COLOR[p.platform] || muted, border: `1px solid ${PLATFORM_COLOR[p.platform] || muted}`, padding: '1px 6px' }}>{p.platform}</span>
                      <span style={{ fontSize: 12, color: muted }}>{p.domain}</span>
                    </div>
                    <span style={{ fontSize: 11, color: muted }}>{p.lastError ? `couldn't read: ${p.lastError}` : rel(p.lastScrapedAt)}</span>
                  </div>
                  {p.platform !== 'unknown' && (
                    <div style={{ display: 'flex', gap: 24, margin: '8px 0 0', flexWrap: 'wrap', fontSize: 13 }}>
                      <span style={{ color: dark }}><strong>{p.productCount}{p.productCountCapped ? '+' : ''}</strong> <span style={{ color: muted }}>products</span></span>
                      <span style={{ color: dark }}>{money(p)} <span style={{ color: muted }}>{p.priceAvg != null ? `· avg ${cur(p.currency)}${p.priceAvg}` : ''}</span></span>
                      {p.newest?.[0]?.title && <span style={{ color: muted }}>newest: <span style={{ color: dark }}>{p.newest[0].title}</span></span>}
                    </div>
                  )}
                  {p.sampleProducts && p.sampleProducts.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: muted, lineHeight: 1.6 }}>
                      {p.sampleProducts.slice(0, 6).map((s, i) => (
                        <span key={i}>{i > 0 ? ' · ' : ''}{s.title}{s.price != null ? ` (${cur(p.currency)}${s.price})` : ''}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>
    </AdminLayout>
  );
}

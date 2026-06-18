'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

type Source = { name: string; status: 'live' | 'off' | 'opportunity'; why: string; action: string; note?: string };
type Group = { category: string; sources: Source[] };
type Data = { groups: Group[]; summary: { live: number; off: number; opportunities: number; total: number }; checkedAt: string };

const dark = 'var(--dark, #2a2218)';
const muted = 'var(--muted, #8a8680)';
const border = '1px solid var(--border, #e8e2d6)';
const serif = "'Cormorant Garamond', Georgia, serif";

const DOT = { live: '#2d7d47', off: '#c0392b', opportunity: '#b8863b' } as const;
const LABEL = { live: 'Live', off: 'Off', opportunity: 'Add to grow' } as const;

export default function ConnectionsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/connections${force ? '?force=true' : ''}`, { credentials: 'include' });
      const d = await res.json();
      if (d?.groups) setData(d);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 920 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: serif, fontSize: 28, fontWeight: 300, color: dark, margin: 0, letterSpacing: '1px' }}>Connections</h1>
            <p style={{ fontSize: 13, color: muted, marginTop: 6, fontStyle: 'italic' }}>
              Every pipe feeding the house — what&rsquo;s on, what&rsquo;s off, and what to add to grow.
            </p>
          </div>
          <button onClick={() => load(true)} disabled={loading} style={{ padding: '9px 16px', background: 'white', color: dark, border, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
            {loading ? 'Checking…' : '↻ Refresh'}
          </button>
        </div>

        {s && (
          <div style={{ display: 'flex', gap: 16, margin: '18px 0 24px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: DOT.live }}>● {s.live} live</span>
            <span style={{ fontSize: 13, color: DOT.off }}>● {s.off} off</span>
            <span style={{ fontSize: 13, color: DOT.opportunity }}>● {s.opportunities} to add</span>
            <span style={{ fontSize: 13, color: muted }}>· {s.total} sources</span>
          </div>
        )}

        {!data && loading ? (
          <p style={{ fontSize: 13, color: muted }}>Checking every connection…</p>
        ) : (
          <div style={{ display: 'grid', gap: 22 }}>
            {data?.groups.map(g => (
              <div key={g.category}>
                <h2 style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: muted, margin: '0 0 10px' }}>{g.category}</h2>
                <div style={{ display: 'grid', gap: 8 }}>
                  {g.sources.map(src => (
                    <div key={src.name} style={{ background: 'white', border, borderLeft: `3px solid ${DOT[src.status]}`, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                        <span style={{ fontSize: 14.5, color: dark, fontWeight: 500 }}>{src.name}</span>
                        <span style={{ fontSize: 11, color: DOT[src.status], whiteSpace: 'nowrap' }}>● {LABEL[src.status]}</span>
                      </div>
                      <p style={{ fontSize: 12.5, color: muted, margin: '3px 0 0', lineHeight: 1.5 }}>{src.why}</p>
                      {src.note && <p style={{ fontSize: 12, color: muted, margin: '4px 0 0', fontStyle: 'italic', lineHeight: 1.5 }}>{src.note}</p>}
                      {src.action && <p style={{ fontSize: 12, color: '#b8863b', margin: '4px 0 0' }}>→ {src.action}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

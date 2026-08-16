'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Where visitors drop, and the screen that addresses each drop.
//
// The funnel was already being computed — services/clickstream.js counted
// distinct sessions per stage — but it was written to feed the AGENTS' prompts,
// so the Chief of Staff could see where customers leak and the founder could
// not. This is that signal, pointed at the person who can act on it.
//
// The bars are secondary. The headline is the biggest leak and its fix link:
// the question being answered is "where do I push?", not "what are my numbers?".

type Stage = {
  key: string;
  label: string;
  count: number;
  lost: number;
  rate: number;
  why: string;
  fix: { label: string; href: string } | null;
};

type Funnel = {
  days: number;
  stages: Stage[];
  biggestLeak: Stage | null;
  overallConversion: number;
  hasData: boolean;
};

const API = process.env.NEXT_PUBLIC_API_URL;

export default function FunnelPanel() {
  const [days, setDays] = useState(14);
  // State carries the window it was fetched for, so "loading" is DERIVED rather
  // than set synchronously inside the effect (which cascades renders). Only the
  // async callbacks touch state.
  const [result, setResult] = useState<{ data: Funnel | null; forDays: number }>({ data: null, forDays: 0 });
  const loading = result.forDays !== days;
  const data = result.data;

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/admin/dashboard/funnel?days=${days}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setResult({ data: d, forDays: days }); })
      .catch(() => { if (!cancelled) setResult({ data: null, forDays: days }); });
    return () => { cancelled = true; };
  }, [days]);

  const top = data?.stages?.[0]?.count || 0;

  return (
    <section
      style={{
        background: 'var(--admin-surface)',
        border: '1px solid var(--admin-line)',
        padding: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--admin-ink)', margin: 0 }}>
          Where people drop
        </h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                background: d === days ? 'var(--admin-ink)' : 'transparent',
                color: d === days ? 'var(--admin-surface)' : 'var(--admin-ink-muted)',
                border: '1px solid var(--admin-line)',
                fontSize: 11,
                padding: '3px 9px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--admin-ink-muted)' }}>Reading the clickstream…</p>
      ) : !data?.hasData ? (
        // Pre-traction, a chart of zeros invites reading noise as signal.
        <p style={{ fontSize: 13, color: 'var(--admin-ink-muted)', margin: 0 }}>
          No visits recorded in this window yet. The funnel fills in as traffic arrives —
          nothing to fix here until then.
        </p>
      ) : (
        <>
          {data.biggestLeak && (
            <div
              style={{
                background: 'var(--admin-warning-soft)',
                borderLeft: '3px solid var(--admin-warning)',
                padding: '10px 12px',
                margin: '12px 0 16px',
              }}
            >
              <p style={{ fontSize: 13, color: 'var(--admin-ink)', margin: 0, fontWeight: 600 }}>
                Biggest leak: {data.biggestLeak.lost} {data.biggestLeak.lost === 1 ? 'person' : 'people'} lost
                before &ldquo;{data.biggestLeak.label}&rdquo;
              </p>
              {data.biggestLeak.why && (
                <p style={{ fontSize: 12.5, color: 'var(--admin-ink-muted)', margin: '4px 0 0' }}>
                  {data.biggestLeak.why}
                </p>
              )}
              {data.biggestLeak.fix && (
                <Link
                  href={data.biggestLeak.fix.href}
                  style={{ fontSize: 12, color: 'var(--admin-ink)', display: 'inline-block', marginTop: 6 }}
                >
                  {data.biggestLeak.fix.label} →
                </Link>
              )}
            </div>
          )}

          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {data.stages.map(s => {
              const width = top ? Math.max(2, Math.round((s.count / top) * 100)) : 0;
              const worst = data.biggestLeak?.key === s.key;
              return (
                <li key={s.key} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                    <span style={{ color: 'var(--admin-ink)' }}>{s.label}</span>
                    <span style={{ color: 'var(--admin-ink-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {s.count}
                      {s.lost > 0 && (
                        <span style={{ color: worst ? 'var(--admin-warning)' : 'var(--admin-ink-muted)' }}>
                          {' '}· −{s.lost} ({100 - s.rate}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--admin-bg)' }}>
                    <div
                      style={{
                        width: `${width}%`,
                        height: '100%',
                        background: worst ? 'var(--admin-warning)' : 'var(--admin-ink)',
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>

          <p style={{ fontSize: 12, color: 'var(--admin-ink-muted)', margin: '12px 0 0' }}>
            {data.overallConversion}% of visitors bought · counted in distinct sessions, last {data.days} days
          </p>
        </>
      )}
    </section>
  );
}

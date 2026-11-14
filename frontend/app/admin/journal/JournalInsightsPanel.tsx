'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatJournalDate } from '@/lib/journalDates';

const API = process.env.NEXT_PUBLIC_API_URL;
const RANGES = [7, 30, 90] as const;

type JournalMetric = {
  id: string;
  title: string;
  slug: string;
  publishedAt: string | null;
  opens: number;
  readers: number;
  read50: number;
  completed: number;
  productClicks: number;
  shopClicks: number;
  cardClicks: number;
  sources: { source: string; readers: number }[];
  google: { clicks: number; impressions: number; ctr: number; position: number } | null;
};

type JournalIdea = {
  kind: 'new' | 'refresh' | 'research';
  title: string;
  topic: string;
  articleId?: string;
  source: string;
  evidence: string;
  action: string;
};

type Insights = {
  days: number;
  firstPartyWindowDays: number;
  googleConnected: boolean;
  summary: { readers: number; opens: number; read50: number; completed: number; cardClicks: number; productClicks: number; shopClicks: number };
  articles: JournalMetric[];
  ideas: JournalIdea[];
};

function plural(value: number, singular: string, pluralWord = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralWord}`;
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div style={{ padding: '15px 16px', border: '1px solid var(--admin-line)', background: 'var(--admin-surface)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.9px', textTransform: 'uppercase', color: 'var(--admin-ink-muted)', marginBottom: 7 }}>{label}</div>
      <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 27, lineHeight: 1, color: 'var(--admin-ink)' }}>{value}</div>
      <div style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--admin-ink-muted)', marginTop: 6 }}>{detail}</div>
    </div>
  );
}

export default function JournalInsightsPanel({ onStartDraft }: { onStartDraft: (topic: string) => void }) {
  const [days, setDays] = useState<typeof RANGES[number]>(30);
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    fetch(`${API}/api/admin/journal/insights?days=${days}`, { credentials: 'include' })
      .then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not load Journal insights.');
        return json as Insights;
      })
      .then(json => { if (current) setData(json); })
      .catch(err => { if (current) setError(err instanceof Error ? err.message : 'Could not load Journal insights.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [days]);

  const rowsWithEvidence = data?.articles.filter(row => (
    row.readers > 0 || row.opens > 0 || row.cardClicks > 0 || row.productClicks > 0 || row.shopClicks > 0 || Boolean(row.google?.impressions)
  )) || [];

  return (
    <section style={{ marginBottom: 36, padding: '24px', border: '1px solid var(--admin-line)', background: 'var(--admin-bg)' }} aria-labelledby="journal-factory-heading">
      <div style={{ display: 'flex', gap: 18, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: '0 0 5px', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--admin-warning)' }}>Decision workspace</p>
          <h2 id="journal-factory-heading" style={{ margin: 0, color: 'var(--admin-ink)', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 25, fontWeight: 400 }}>
            Journal Factory
          </h2>
          <p style={{ margin: '7px 0 0', maxWidth: 630, color: 'var(--admin-ink-muted)', fontSize: 13, lineHeight: 1.55 }}>
            Use consented first-party reading signals and Google evidence to decide what deserves attention next. Every AI action still opens a draft for your review.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }} aria-label="Journal reporting period">
          {RANGES.map(range => (
            <button
              key={range}
              type="button"
              aria-pressed={days === range}
              onClick={() => setDays(range)}
              style={{ padding: '7px 11px', border: '1px solid var(--admin-line)', background: days === range ? 'var(--admin-ink)' : 'var(--admin-surface)', color: days === range ? 'var(--admin-surface)' : 'var(--admin-ink-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}
            >
              {range}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ margin: '22px 0 0', fontSize: 13, color: 'var(--admin-ink-muted)' }}>Loading the evidenceâ€¦</p>
      ) : error ? (
        <p role="alert" style={{ margin: '22px 0 0', fontSize: 13, color: 'var(--admin-danger)' }}>{error}</p>
      ) : data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 10, marginTop: 22 }}>
            <Metric label="Tracked readers" value={data.summary.readers} detail="distinct consented browser sessions" />
            <Metric label="Article opens" value={data.summary.opens} detail="page visits after this release" />
            <Metric label="Article-card clickers" value={data.summary.cardClicks} detail="distinct sessions choosing an article" />
            <Metric label="Reached 50% depth" value={data.summary.read50} detail="scrolled halfway through an article" />
            <Metric label="Reached 90% depth" value={data.summary.completed} detail="scrolled near an article’s end" />
            <Metric label="Product clicks" value={data.summary.productClicks} detail="from an article or its edit" />
            <Metric label="Shop clicks" value={data.summary.shopClicks} detail="from an article call to action" />
          </div>

          <p style={{ margin: '13px 0 0', padding: '10px 12px', background: 'var(--admin-surface)', border: '1px solid var(--admin-line)', color: 'var(--admin-ink-muted)', fontSize: 11, lineHeight: 1.5 }}>
            Article-level reading data starts from this release and is retained for up to {data.firstPartyWindowDays} days. Your excluded owner browser and visitors without analytics consent are not counted. {data.googleConnected ? 'Google Search Console evidence follows Google’s usual reporting delay.' : 'Connect Google Search Console in SEO to add organic clicks and impressions.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(260px, 1fr)', gap: 20, marginTop: 24 }}>
            <div>
              <h3 style={{ margin: '0 0 6px', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 400, color: 'var(--admin-ink)' }}>What readers did</h3>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--admin-ink-muted)', lineHeight: 1.45 }}>Raw evidence, not claims based on a tiny sample.</p>
              {rowsWithEvidence.length === 0 ? (
                <div style={{ padding: '18px', border: '1px solid var(--admin-line)', background: 'var(--admin-surface)', fontSize: 13, color: 'var(--admin-ink-muted)', lineHeight: 1.55 }}>
                  There is no article-level evidence in this {data.days}-day view yet. That is expected until readers reach the updated Journal; it does not mean the articles have no value.
                </div>
              ) : (
                <div style={{ border: '1px solid var(--admin-line)', background: 'var(--admin-surface)', overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 550, fontSize: 12 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--admin-ink-muted)', fontSize: 10, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Article</th>
                        <th style={{ padding: '10px 8px', fontWeight: 500 }}>Readers</th>
                        <th style={{ padding: '10px 8px', fontWeight: 500 }}>Card clicks</th>
                        <th style={{ padding: '10px 8px', fontWeight: 500 }}>Read depth</th>
                        <th style={{ padding: '10px 8px', fontWeight: 500 }}>Clicks</th>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Google</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsWithEvidence.map(row => (
                        <tr key={row.id} style={{ borderTop: '1px solid var(--admin-line)', color: 'var(--admin-ink)' }}>
                          <td style={{ padding: '11px 12px', minWidth: 170 }}>
                            <Link href={`/admin/journal/${row.id}`} style={{ color: 'var(--admin-ink)', textDecoration: 'none', fontWeight: 600 }}>{row.title}</Link>
                            <div style={{ fontSize: 10, color: 'var(--admin-ink-muted)', marginTop: 3 }}>{row.publishedAt ? `Published ${formatJournalDate(row.publishedAt)}` : 'Publication date unavailable'}</div>
                            {row.sources.length > 0 && <div style={{ fontSize: 10, color: 'var(--admin-ink-muted)', marginTop: 3 }}>Sources: {row.sources.map(source => `${source.source} ${source.readers}`).join(' · ')}</div>}
                          </td>
                          <td style={{ padding: '11px 8px' }}>{plural(row.readers, 'reader')}</td>
                          <td style={{ padding: '11px 8px' }}>{plural(row.cardClicks, 'clicker')}</td>
                          <td style={{ padding: '11px 8px' }}>{row.read50} at 50% · {row.completed} at 90%</td>
                          <td style={{ padding: '11px 8px' }}>{row.productClicks} product · {row.shopClicks} shop</td>
                          <td style={{ padding: '11px 12px' }}>{row.google ? `${row.google.clicks} clicks · ${row.google.impressions} impr.` : data.googleConnected ? 'No matching data' : 'Not connected'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 style={{ margin: '0 0 6px', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 400, color: 'var(--admin-ink)' }}>What to write or improve next</h3>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--admin-ink-muted)', lineHeight: 1.45 }}>Ideas must show their evidence before they become a draft.</p>
              {!data.ideas.length ? (
                <div style={{ padding: '18px', border: '1px solid var(--admin-line)', background: 'var(--admin-surface)', fontSize: 13, color: 'var(--admin-ink-muted)', lineHeight: 1.55 }}>
                  No evidence-backed ideas yet. Suggestions appear when Google search evidence or a no-result on-site search gives us a real reason to act.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {data.ideas.map((idea, index) => (
                    <article key={`${idea.kind}-${idea.topic}-${index}`} style={{ padding: '14px', border: '1px solid var(--admin-line)', background: 'var(--admin-surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--admin-warning)', letterSpacing: '0.7px', textTransform: 'uppercase' }}>{idea.kind === 'refresh' ? 'Improve existing article' : idea.kind === 'research' ? 'Research first' : 'New article candidate'}</div>
                          <h4 style={{ margin: '5px 0 0', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, fontWeight: 500, color: 'var(--admin-ink)' }}>{idea.title}</h4>
                        </div>
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: 11, lineHeight: 1.5, color: 'var(--admin-ink-muted)' }}><strong style={{ color: 'var(--admin-ink)' }}>{idea.source}:</strong> {idea.evidence}</p>
                      <p style={{ margin: '6px 0 12px', fontSize: 11, lineHeight: 1.5, color: 'var(--admin-ink-muted)' }}>{idea.action}</p>
                      {idea.kind === 'refresh' && idea.articleId ? (
                        <Link href={`/admin/journal/${idea.articleId}`} style={{ display: 'inline-block', padding: '7px 10px', border: '1px solid var(--admin-warning)', color: 'var(--admin-warning)', fontSize: 11, textDecoration: 'none' }}>Open for refresh</Link>
                      ) : (
                        <button type="button" onClick={() => onStartDraft(idea.topic)} style={{ padding: '7px 10px', border: '1px solid var(--admin-warning)', background: 'var(--admin-surface)', color: 'var(--admin-warning)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>Open AI draft</button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

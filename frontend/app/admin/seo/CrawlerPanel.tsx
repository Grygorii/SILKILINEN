'use client';

// WHO IS CRAWLING THE SHOP (Overview tab, under search performance).
//
// Bot traffic used to be identified at the Vercel proxy and thrown away — right
// for the analytics (Googlebot rendering JS otherwise logs as a "direct" visit
// from a Google data centre and crushes the conversion rate), wrong as a place
// to lose the information entirely. It is recorded to its own collection now.
//
// Three of these rows are decisions rather than trivia: Googlebot at zero on a
// page means it is not being crawled whatever the sitemap claims; GPTBot and
// ClaudeBot are whether AI search can see the catalogue at all; and Ahrefs or
// Semrush volume is competitors watching, worth knowing before a price change.

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL;

const dark = 'var(--color-ink)';
const muted = 'var(--color-ink-muted)';
const border = '1px solid var(--color-line)';
const serif = "'Cormorant Garamond', Georgia, serif";

type Row = { bot: string; hits: number; lastSeen: string };
type PageRow = { page: string; hits: number };
type Data = { days: number; total: number; byBot: Row[]; byPage: PageRow[]; collecting: boolean };

// The crawlers whose absence is worth remarking on. Search engines that must
// see the shop, and the AI assistants that increasingly answer "silk robe".
const NOTABLE = ['Googlebot', 'Bingbot', 'GPTBot', 'ClaudeBot', 'PerplexityBot'];

export default function CrawlerPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/admin/bot-traffic`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) return null;   // never a red box for a nice-to-have
  if (!data) return null;

  const missing = NOTABLE.filter(n => !data.byBot.some(b => b.bot === n));

  return (
    <div style={{ marginTop: 28, paddingTop: 24, borderTop: border }}>
      <p style={{ fontFamily: serif, fontSize: 18, color: dark, marginBottom: 4 }}>
        Who is crawling the shop
      </p>

      {!data.collecting ? (
        // An empty table has two opposite meanings. Say which one this is.
        <p style={{ fontSize: 13, color: muted, lineHeight: 1.6 }}>
          Nothing recorded yet. Crawler traffic started being counted on 9 September 2026 —
          before that it was identified and discarded — so this fills in over the next few days.
          It is not a sign that nobody is crawling the site.
        </p>
      ) : (
        <>
          <p style={{ fontSize: 13, color: muted, marginBottom: 16 }}>
            {data.total.toLocaleString()} crawler requests in the last {data.days} days.
            These are counted separately and never enter your visitor numbers.
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: muted, borderBottom: border }}>
                <th style={{ padding: '6px 0', fontWeight: 500 }}>Crawler</th>
                <th style={{ padding: '6px 0', fontWeight: 500, textAlign: 'right' }}>Requests</th>
                <th style={{ padding: '6px 0', fontWeight: 500, textAlign: 'right' }}>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {data.byBot.map(b => (
                <tr key={b.bot} style={{ borderBottom: border }}>
                  <td style={{ padding: '8px 0', color: dark }}>{b.bot}</td>
                  <td style={{ padding: '8px 0', color: dark, textAlign: 'right' }}>{b.hits.toLocaleString()}</td>
                  <td style={{ padding: '8px 0', color: muted, textAlign: 'right' }}>
                    {new Date(b.lastSeen).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {missing.length > 0 && (
            <p style={{ fontSize: 12, color: muted, lineHeight: 1.6, marginBottom: 16 }}>
              Not seen in this window: <strong style={{ color: dark }}>{missing.join(', ')}</strong>.
              {missing.includes('Googlebot')
                ? ' Googlebot missing over a fortnight is worth investigating — check Search Console → Settings → Crawl stats.'
                : ' AI assistants that never crawl the shop cannot recommend it.'}
            </p>
          )}

          {data.byPage.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: muted, marginBottom: 8 }}>Most crawled pages</p>
              <ul style={{ fontSize: 13, color: dark, listStyle: 'none', padding: 0, margin: 0 }}>
                {data.byPage.map(p => (
                  <li key={p.page} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>{p.page || '—'}</span>
                    <span style={{ color: muted }}>{p.hits.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

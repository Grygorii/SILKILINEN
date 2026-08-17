'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './OpportunitiesPanel.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Kind = 'restock' | 'range' | 'depth' | 'convert' | 'rank' | 'title';

type Proposal = {
  kind: Kind;
  query: string;
  queries?: string[];
  impressions: number;
  clicks: number;
  position: number;
  product: { name: string; stock: number; status: string; waiting?: number; sold?: number } | null;
  headline: string;
  why: string;
  action: string;
};

type Data = { connected: boolean; proposals: Proposal[]; queriesChecked: number };

// How urgent each kind is, matching the order the backend ranks them in
// (utils/demandFit.js KIND_ORDER). Restock and range are a sale that cannot
// happen and a sale we never knew to offer; the rest is presentation.
const TONE: Record<Kind, 'urgent' | 'soon' | 'later'> = {
  restock: 'urgent',
  range: 'urgent',
  depth: 'soon',
  convert: 'soon',
  rank: 'later',
  title: 'later',
};

// What the founder is being asked to do, in one word, so the list can be
// triaged without reading every card.
const KIND_LABEL: Record<Kind, string> = {
  restock: 'Restock',
  range: 'Consider stocking',
  depth: 'Buy depth',
  convert: 'Fix the page',
  rank: 'Ranking work',
  title: 'Rewrite title',
};

export default function OpportunitiesPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/growth/opportunities`, { credentials: 'include' });
      if (res.ok) setData(await res.json());
    } catch {
      // A failed panel must not take the page with it; the empty state below
      // says nothing rather than claiming there is no work to do.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.label}>Opportunities</p>
        <div className={styles.skel}>
          <div className={styles.skelLine} style={{ width: '45%' }} />
          <div className={styles.skelLine} style={{ width: '85%' }} />
          <div className={styles.skelLine} style={{ width: '60%' }} />
        </div>
      </div>
    );
  }

  // Search Console not connected is NOT "no opportunities" — saying nothing
  // would read as a clean bill of health on a shop nobody has looked at.
  if (!data?.connected) {
    return (
      <div className={styles.wrap}>
        <p className={styles.label}>Opportunities</p>
        <div className={styles.quiet}>
          Search Console isn’t connected, so there’s nothing to read demand from yet.
          Connect it on the Dashboard and this fills with what people search for,
          matched against what’s actually on the shelf.
        </div>
      </div>
    );
  }

  const proposals = data.proposals ?? [];

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <p className={styles.label}>Opportunities — demand, matched to the shelf</p>
        <span className={styles.checked}>
          {data.queriesChecked} quer{data.queriesChecked === 1 ? 'y' : 'ies'} checked · last 28 days
        </span>
      </div>

      {proposals.length === 0 ? (
        <div className={styles.quiet}>
          Nothing to act on. Every query with real volume either ranks on page one
          and earns clicks, or is too small to draw a conclusion from — so there is
          no work here worth your week. This list stays quiet on purpose.
        </div>
      ) : (
        <div className={styles.list}>
          {proposals.map((p, i) => {
            const tone = TONE[p.kind] ?? 'later';
            const cardTone = tone === 'urgent' ? styles.cardUrgent : tone === 'soon' ? styles.cardSoon : styles.cardLater;
            const kindTone = tone === 'urgent' ? styles.kindUrgent : tone === 'soon' ? styles.kindSoon : styles.kindLater;
            return (
              <div key={i} className={`${styles.card} ${cardTone}`}>
                <div className={styles.top}>
                  <span className={`${styles.kind} ${kindTone}`}>{KIND_LABEL[p.kind] ?? p.kind}</span>
                  <span className={styles.headline}>{p.headline}</span>
                </div>
                <p className={styles.why}>{p.why}</p>
                <p className={styles.action}>{p.action}</p>
                {/* The evidence, because a proposal to spend money should show
                    its working. */}
                <div className={styles.figures}>
                  <span className={styles.figure}><strong>{p.impressions}</strong> impressions</span>
                  <span className={styles.figure}><strong>{p.clicks}</strong> click{p.clicks === 1 ? '' : 's'}</span>
                  {p.position > 0 && <span className={styles.figure}>position <strong>{p.position}</strong></span>}
                  {p.product && <span className={styles.figure}><strong>{p.product.stock}</strong> in stock</span>}
                  {typeof p.product?.sold === 'number' && (
                    <span className={styles.figure}><strong>{p.product.sold}</strong> sold (28d)</span>
                  )}
                  {typeof p.product?.waiting === 'number' && p.product.waiting > 0 && (
                    <span className={styles.figure}><strong>{p.product.waiting}</strong> on the waitlist</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

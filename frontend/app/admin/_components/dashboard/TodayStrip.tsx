'use client';

import { useEffect, useState } from 'react';
import styles from './TodayStrip.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type TodayData = {
  visitorsToday: number;
  ordersToday: number;
  revenueTodayEUR: number;
  pendingFulfilment: number;
  reviewsPending: number;
  openCarts: number;
  yesterday: { visitors: number; orders: number; revenueEUR: number };
};

// Up/down vs-yesterday indicator. Flat dash when equal or no yesterday baseline.
function Delta({ today, yesterday }: { today: number; yesterday: number }) {
  if (yesterday === 0 || today === yesterday) {
    return <span className={styles.deltaFlat}>–</span>;
  }
  return today > yesterday
    ? <span className={styles.deltaUp}>▲</span>
    : <span className={styles.deltaDown}>▼</span>;
}

// "Today" live pulse strip — today-so-far stats with vs-yesterday indicators.
// Auto-refreshes every minute. Renders nothing if the first fetch fails so a
// backend hiccup never breaks the dashboard.
export default function TodayStrip() {
  const [data, setData] = useState<TodayData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/admin/today`, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    load();
    const interval = setInterval(load, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Never break the dashboard on fetch error (keep stale data if a refresh fails).
  if (failed && !data) return null;

  return (
    <section className={styles.strip}>
      <div className={styles.titleRow}>
        <span className={styles.eyebrow}>Today</span>
        <span className={styles.hint}>live · updates every minute</span>
      </div>
      <div className={styles.tiles}>
        {!data ? (
          [0, 1, 2, 3, 4].map(i => <div key={i} className={styles.skeletonTile} />)
        ) : (
          <>
            <div className={styles.tile}>
              <div className={styles.number}>
                {data.visitorsToday}
                <Delta today={data.visitorsToday} yesterday={data.yesterday.visitors} />
              </div>
              <div className={styles.label}>Visitors today</div>
            </div>
            <div className={styles.tile}>
              <div className={styles.number}>
                {data.ordersToday}
                <Delta today={data.ordersToday} yesterday={data.yesterday.orders} />
              </div>
              <div className={styles.label}>Orders today</div>
            </div>
            <div className={styles.tile}>
              <div className={styles.number}>
                €{data.revenueTodayEUR.toFixed(2)}
                <Delta today={data.revenueTodayEUR} yesterday={data.yesterday.revenueEUR} />
              </div>
              <div className={styles.label}>Revenue today</div>
            </div>
            <a className={styles.tile} href="/admin/orders?status=paid">
              <div className={styles.number}>{data.pendingFulfilment}</div>
              <div className={styles.label}>To fulfil</div>
            </a>
            <a className={styles.tile} href="/admin/reviews">
              <div className={styles.number}>{data.reviewsPending}</div>
              <div className={styles.label}>Reviews waiting</div>
            </a>
          </>
        )}
      </div>
    </section>
  );
}

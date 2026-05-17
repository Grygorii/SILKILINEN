'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type MonthRow = {
  label: string; revenue: number; refunds: number; netRevenue: number;
  stripeFees: number; cogs: number; shippingCosts: number; expenseTotal: number;
  netProfit: number; orderCount: number;
};

type ProductMargin = {
  productId: string; name: string; units: number; revenue: number;
  cogs: number | null; margin: number | null;
};

type SourceMargin = {
  source: string; orders: number; revenue: number; cogs: number; margin: number | null;
};

type Anomaly = {
  type: string; message: string;
  orders?: { _id: string; orderNumber?: string; createdAt: string }[];
  products?: { _id: string; name: string }[];
};

type ReportData = {
  monthlyPL: MonthRow[];
  marginByProduct: ProductMargin[];
  marginBySource: SourceMargin[];
  anomalies: Anomaly[];
};

function fmt(n: number | null) {
  if (n === null) return '—';
  return `€${n.toFixed(2)}`;
}

function marginColor(m: number | null) {
  if (m === null) return styles.tMuted;
  if (m >= 0.4) return styles.marginBarGreen;
  if (m >= 0.2) return styles.marginBarAmber;
  return styles.marginBarRed;
}

export default function FinanceReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/admin/finance/reports`, { credentials: 'include' })
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <AdminLayout active="finance"><p className={styles.loading}>Loading…</p></AdminLayout>;
  if (!data)   return <AdminLayout active="finance"><p className={styles.loading}>Could not load reports.</p></AdminLayout>;

  const { monthlyPL, marginByProduct, marginBySource, anomalies } = data;
  const maxRevenue = Math.max(...monthlyPL.map(m => m.revenue), 1);

  return (
    <AdminLayout active="finance">
      <div className={styles.page}>

        {/* Monthly P&L */}
        <div className={styles.card}>
          <p className={styles.sectionTitle}>Monthly profit & loss</p>
          <div className={styles.plGrid}>
            {monthlyPL.map(m => {
              const revH  = Math.round((m.revenue / maxRevenue) * 110);
              const costH = Math.round(((m.revenue - m.netProfit) / maxRevenue) * 110);
              return (
                <div key={m.label} className={styles.plMonth} title={`${m.label}: Revenue €${m.revenue.toFixed(2)}, Net ${m.netProfit >= 0 ? '+' : ''}€${m.netProfit.toFixed(2)}`}>
                  <div className={`${styles.plNetLine} ${m.netProfit >= 0 ? styles.plNetPos : styles.plNetNeg}`}>
                    {m.netProfit >= 0 ? '+' : '−'}€{Math.abs(m.netProfit).toFixed(0)}
                  </div>
                  <div className={styles.plBars}>
                    <div className={styles.plRevBar}  style={{ height: revH  }} />
                    <div className={styles.plCostBar} style={{ height: costH }} />
                  </div>
                  <div className={styles.plLabel}>{m.label}</div>
                </div>
              );
            })}
          </div>
          <div className={styles.plLegend}>
            <span><span className={styles.plLegendDot} style={{ background: '#c5a572' }}/>Revenue</span>
            <span><span className={styles.plLegendDot} style={{ background: '#e8c9ab' }}/>Total costs</span>
          </div>

          {/* Monthly detail table */}
          <div style={{ overflowX: 'auto', marginTop: 20 }}>
            <table className={styles.marginTable}>
              <thead>
                <tr>
                  <th>Month</th><th>Orders</th><th>Revenue</th><th>Refunds</th>
                  <th>Stripe fees</th><th>COGS</th><th>Expenses</th>
                  <th style={{ textAlign: 'right' }}>Net profit</th>
                </tr>
              </thead>
              <tbody>
                {[...monthlyPL].reverse().map(m => (
                  <tr key={m.label}>
                    <td>{m.label}</td>
                    <td className={styles.tNum}>{m.orderCount}</td>
                    <td className={styles.tNum}>{fmt(m.revenue)}</td>
                    <td className={styles.tNum}>{m.refunds > 0 ? `−€${m.refunds.toFixed(2)}` : '—'}</td>
                    <td className={styles.tNum}>{m.stripeFees > 0 ? `−€${m.stripeFees.toFixed(2)}` : '—'}</td>
                    <td className={styles.tNum}>{m.cogs > 0 ? `−€${m.cogs.toFixed(2)}` : '—'}</td>
                    <td className={styles.tNum}>{m.expenseTotal > 0 ? `−€${m.expenseTotal.toFixed(2)}` : '—'}</td>
                    <td className={`${styles.tNum} ${styles.tRight}`} style={{ fontWeight: 600, color: m.netProfit >= 0 ? '#2e7d32' : '#c62828' }}>
                      {m.netProfit >= 0 ? '+' : '−'}€{Math.abs(m.netProfit).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Margin by product */}
        <div className={styles.card}>
          <p className={styles.sectionTitle}>Margin by product (last 90 days)</p>
          {marginByProduct.length === 0 ? (
            <p className={styles.anomalyNoData}>No orders in last 90 days.</p>
          ) : (
            <table className={styles.marginTable}>
              <thead>
                <tr>
                  <th>Product</th><th>Units sold</th><th>Revenue</th>
                  <th>COGS</th><th>Gross profit</th><th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {marginByProduct.map((p, i) => {
                  const grossProfit = p.cogs !== null ? p.revenue - p.cogs : null;
                  const marginPct   = p.margin !== null ? Math.round(p.margin * 100) : null;
                  return (
                    <tr key={i}>
                      <td>{p.name}</td>
                      <td className={styles.tNum}>{p.units}</td>
                      <td className={styles.tNum}>{fmt(p.revenue)}</td>
                      <td className={styles.tNum}>{p.cogs !== null ? fmt(p.cogs) : <span className={styles.tMuted}>no cost data</span>}</td>
                      <td className={styles.tNum}>{grossProfit !== null ? fmt(grossProfit) : '—'}</td>
                      <td>
                        {marginPct !== null ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              className={`${styles.marginBar} ${marginPct >= 40 ? styles.marginBarGreen : marginPct >= 20 ? styles.marginBarAmber : styles.marginBarRed}`}
                              style={{ width: Math.max(4, marginPct) + 'px' }}
                            />
                            <span style={{ fontSize: 13, color: marginPct >= 40 ? '#2e7d32' : marginPct >= 20 ? '#b8860b' : '#c62828' }}>
                              {marginPct}%
                            </span>
                          </span>
                        ) : <span className={styles.tMuted}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Margin by acquisition source */}
        <div className={styles.card}>
          <p className={styles.sectionTitle}>Revenue by acquisition source (last 90 days)</p>
          {marginBySource.length === 0 ? (
            <p className={styles.anomalyNoData}>No orders in last 90 days.</p>
          ) : (
            <table className={styles.marginTable}>
              <thead>
                <tr>
                  <th>Source</th><th>Orders</th><th>Revenue</th><th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {marginBySource.map((s, i) => {
                  const marginPct = s.margin !== null ? Math.round(s.margin * 100) : null;
                  return (
                    <tr key={i}>
                      <td>{s.source}</td>
                      <td className={styles.tNum}>{s.orders}</td>
                      <td className={styles.tNum}>{fmt(s.revenue)}</td>
                      <td>
                        {marginPct !== null ? (
                          <span style={{ color: marginPct >= 40 ? '#2e7d32' : marginPct >= 20 ? '#b8860b' : '#c62828' }}>
                            {marginPct}%
                          </span>
                        ) : <span className={styles.tMuted}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Anomaly flags */}
        <div className={styles.card}>
          <p className={styles.sectionTitle}>Anomaly flags</p>
          {anomalies.length === 0 ? (
            <p className={styles.anomalyNoData}>No anomalies detected. Data looks clean.</p>
          ) : (
            <div className={styles.anomalyList}>
              {anomalies.map((a, i) => (
                <div key={i} className={styles.anomalyItem}>
                  <span className={styles.anomalyIcon}>⚠</span>
                  <span className={styles.anomalyMsg}>{a.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}

'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type PerOrderRow = {
  _id: string;
  orderNumber?: string;
  createdAt: string;
  total: number;
  cogs: number | null;
  stripeFee: number | null;
  shippingCost: number | null;
  refunded: number;
  netProfit: number | null;
  margin: number | null;
  missingFields: string[];
  items: string[];
};

type Overview = {
  currentMonth: {
    revenue: number; orderCount: number; avgOrder: number;
    stripeFees: number; cogs: number; shippingCost: number; refunded: number;
    marketingSpend: number; otherExpenses: number; netProfit: number;
  };
  last30: {
    revenue: number; orderCount: number; avgOrder: number;
    revenueDelta: number; orderDelta: number;
  };
  perOrderRows: PerOrderRow[];
  expenseBreakdown: { category: string; amount: number; count: number }[];
  prompts: { key: string; message: string; category: string }[];
};

const CAT_LABELS: Record<string, string> = {
  shipping_per_order: 'Shipping / order', materials_silk: 'Silk materials',
  materials_linen: 'Linen materials', materials_other: 'Other materials',
  packaging: 'Packaging', software_saas: 'Software / SaaS',
  marketing_ads: 'Marketing ads', marketing_tools: 'Marketing tools',
  professional_fees: 'Professional fees', studio_workspace: 'Studio / workspace',
  equipment: 'Equipment', bank_payment_fees: 'Bank fees',
  tax_vat: 'VAT', refunds: 'Refunds', other: 'Other',
};

const SEG_COLORS = ['#7a5c2e','#c5a572','#2e7d32','#c62828','#1565c0','#7b1fa2','#e65100','#558b2f'];

function fmt(n: number | null) {
  if (n === null) return '—';
  return `€${Math.abs(n).toFixed(2)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

export default function FinanceOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  // Shipping cost modal
  const [shippingModal, setShippingModal] = useState<PerOrderRow | null>(null);
  const [shippingInput, setShippingInput] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [shippingSaving, setShippingSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/admin/finance/overview`, { credentials: 'include' })
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveShippingCost() {
    if (!shippingModal) return;
    setShippingSaving(true);
    try {
      await fetch(`${API}/api/admin/finance/orders/${shippingModal._id}/shipping-cost`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shippingCost: Number(shippingInput), notes: shippingNotes }),
      });
      // Refresh overview
      const res = await fetch(`${API}/api/admin/finance/overview`, { credentials: 'include' });
      setData(await res.json());
      setShippingModal(null);
    } finally {
      setShippingSaving(false);
    }
  }

  function openShippingModal(row: PerOrderRow) {
    setShippingModal(row);
    setShippingInput(row.shippingCost !== null ? row.shippingCost.toFixed(2) : '');
    setShippingNotes('');
  }

  if (loading) return <AdminLayout active="finance"><p className={styles.loading}>Loading…</p></AdminLayout>;
  if (!data)   return <AdminLayout active="finance"><p className={styles.empty}>Could not load finance data.</p></AdminLayout>;

  const { currentMonth: cm, last30: l30, perOrderRows, expenseBreakdown, prompts } = data;

  const profit = cm.netProfit;
  const heroCls = profit > 0 ? styles.heroBandProfit : profit < 0 ? styles.heroBandLoss : '';
  const verdict = profit > 0
    ? `+€${profit.toFixed(2)} (PROFIT) ✓`
    : profit < 0
    ? `−€${Math.abs(profit).toFixed(2)} (LOSS) ⚠`
    : `€0.00 (BREAK-EVEN)`;

  const totalExpBreakdown = expenseBreakdown.reduce((s, e) => s + e.amount, 0);

  return (
    <AdminLayout active="finance">
      <div className={styles.page}>

        {/* Hero band */}
        <div className={`${styles.heroBand} ${heroCls}`}>
          <p className={styles.heroVerdict} style={{ color: profit > 0 ? '#a5d6a7' : profit < 0 ? '#ef9a9a' : '#f5f0eb' }}>
            {verdict}
          </p>
          <p className={styles.heroSub}>This month · all costs counted · honest</p>
          <div className={styles.heroBreakdown}>
            <span>Revenue</span>        <span>+€{cm.revenue.toFixed(2)}</span>
            <span>Stripe fees</span>    <span>−€{cm.stripeFees.toFixed(2)}</span>
            <span>COGS</span>           <span>−€{cm.cogs.toFixed(2)}</span>
            <span>Shipping costs</span> <span>−€{cm.shippingCost.toFixed(2)}</span>
            <span>Marketing</span>      <span>−€{cm.marketingSpend.toFixed(2)}</span>
            <span>Other expenses</span> <span>−€{cm.otherExpenses.toFixed(2)}</span>
            <span>Refunds given</span>  <span>−€{cm.refunded.toFixed(2)}</span>
            <hr className={styles.heroDivider} />
            <div className={styles.heroNetRow}>
              <span>Net result</span>
              <span style={{ color: profit > 0 ? '#a5d6a7' : profit < 0 ? '#ef9a9a' : 'inherit' }}>
                {profit >= 0 ? '+' : '−'}€{Math.abs(profit).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Last 30 days metrics */}
        <div className={styles.metricRow}>
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>Revenue (30 days)</p>
            <p className={styles.metricVal}>€{l30.revenue.toFixed(2)}</p>
            <p className={`${styles.metricDelta} ${l30.revenueDelta >= 0 ? styles.metricDeltaPos : styles.metricDeltaNeg}`}>
              {l30.revenueDelta >= 0 ? '+' : ''}€{l30.revenueDelta.toFixed(2)} vs prior 30 days
            </p>
          </div>
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>Orders (30 days)</p>
            <p className={styles.metricVal}>{l30.orderCount}</p>
            <p className={`${styles.metricDelta} ${l30.orderDelta >= 0 ? styles.metricDeltaPos : styles.metricDeltaNeg}`}>
              {l30.orderDelta >= 0 ? '+' : ''}{l30.orderDelta} vs prior 30 days
            </p>
          </div>
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>Avg order (30 days)</p>
            <p className={styles.metricVal}>€{l30.avgOrder.toFixed(2)}</p>
          </div>
        </div>

        {/* Expense breakdown */}
        {expenseBreakdown.length > 0 && (
          <div className={styles.breakdownSection}>
            <p className={styles.sectionTitle}>Money out — last 30 days</p>
            {totalExpBreakdown > 0 && (
              <div className={styles.breakdownBar}>
                {expenseBreakdown.map((e, i) => (
                  <div
                    key={e.category}
                    className={styles.breakdownSeg}
                    style={{ width: `${(e.amount / totalExpBreakdown) * 100}%`, background: SEG_COLORS[i % SEG_COLORS.length] }}
                    title={`${CAT_LABELS[e.category] || e.category}: €${e.amount.toFixed(2)}`}
                  />
                ))}
              </div>
            )}
            <div className={styles.breakdownList}>
              {expenseBreakdown.map((e, i) => (
                <div key={e.category} className={styles.breakdownRow}>
                  <span className={styles.breakdownCat}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: SEG_COLORS[i % SEG_COLORS.length], marginRight: 6 }} />
                    {CAT_LABELS[e.category] || e.category}
                    <span className={styles.tMuted} style={{ marginLeft: 4, fontSize: 11 }}>({e.count})</span>
                  </span>
                  <span className={styles.breakdownAmt}>€{e.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
            {prompts.map(p => (
              <p key={p.key} className={styles.breakdownPrompt}>
                {p.message}{' '}
                <a href="/admin/finance/expenses" className={styles.promptLink}>Add them →</a>
              </p>
            ))}
          </div>
        )}

        {/* Per-order table */}
        <div className={styles.tableSection}>
          <p className={styles.sectionTitle}>Per-order profitability</p>
          {perOrderRows.length === 0 ? (
            <p className={styles.empty}>No orders yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>COGS</th>
                    <th>Stripe fee</th>
                    <th>Shipping cost</th>
                    <th>Refunded</th>
                    <th>Net profit</th>
                    <th>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {perOrderRows.map(row => {
                    const isComplete   = row.missingFields.length === 0;
                    const profitCls    = row.netProfit === null ? styles.profitAmber
                      : row.netProfit >= 0 ? styles.profitPos : styles.profitNeg;
                    const tooltip = row.missingFields.length > 0
                      ? `Missing: ${row.missingFields.join(', ')}. Click to add shipping cost.`
                      : undefined;
                    return (
                      <tr
                        key={row._id}
                        onClick={() => row.missingFields.includes('shipping cost') ? openShippingModal(row) : undefined}
                        title={tooltip}
                      >
                        <td>#{row.orderNumber?.slice(-8).toUpperCase() || String(row._id).slice(-8).toUpperCase()}</td>
                        <td>{fmtDate(row.createdAt)}</td>
                        <td className={styles.tNum}>€{row.total.toFixed(2)}</td>
                        <td className={styles.tNum}>{fmt(row.cogs)}</td>
                        <td className={styles.tNum}>{fmt(row.stripeFee)}</td>
                        <td className={styles.tNum}>
                          {row.shippingCost !== null ? `€${row.shippingCost.toFixed(2)}` : <span className={styles.tMuted}>— <button onClick={e => { e.stopPropagation(); openShippingModal(row); }} style={{ fontSize: 11, color: '#7a5c2e', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Add</button></span>}
                        </td>
                        <td className={styles.tNum}>{row.refunded > 0 ? `€${row.refunded.toFixed(2)}` : <span className={styles.tMuted}>—</span>}</td>
                        <td className={profitCls}>
                          {row.netProfit !== null
                            ? `${row.netProfit >= 0 ? '+' : '−'}€${Math.abs(row.netProfit).toFixed(2)}`
                            : <span title={tooltip}>~{isComplete ? '' : '*'}</span>
                          }
                          {!isComplete && <span className={styles.missingDot} title={tooltip}> *</span>}
                        </td>
                        <td className={profitCls}>
                          {row.margin !== null ? `${(row.margin * 100).toFixed(1)}%` : <span className={styles.tMuted}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {shippingModal && (
        <div className={styles.modalOverlay} onClick={() => setShippingModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>Enter shipping cost — #{(shippingModal.orderNumber || shippingModal._id).slice(-8).toUpperCase()}</p>
            <label className={styles.modalLabel}>Actual postage cost (€)</label>
            <input
              className={styles.modalInput}
              type="number" step="0.01" min="0"
              value={shippingInput}
              onChange={e => setShippingInput(e.target.value)}
              autoFocus
            />
            <label className={styles.modalLabel}>Notes (optional)</label>
            <input
              className={styles.modalInput}
              value={shippingNotes}
              onChange={e => setShippingNotes(e.target.value)}
              placeholder="e.g. An Post tracked, 16 May"
            />
            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={() => setShippingModal(null)}>Cancel</button>
              <button className={styles.modalSave} onClick={saveShippingCost} disabled={shippingSaving || !shippingInput}>
                {shippingSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

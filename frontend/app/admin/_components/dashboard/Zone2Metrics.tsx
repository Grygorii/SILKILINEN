'use client';

import Card from '../Card';

type Comparison = { deltaPercent: number | null; direction: string };
type Zone2Data = {
  today:     { revenue: number; orders: number; currency: string };
  thisWeek:  { revenue: number; orders: number; comparison: Comparison & { lastWeekRevenue: number } };
  thisMonth: { revenue: number; orders: number; comparison: Comparison & { lastMonthRevenue: number } };
  last30DaysChart: { date: string; revenue: number }[];
};

function fmtCents(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

function Delta({ comparison }: { comparison: Comparison }) {
  const { deltaPercent, direction } = comparison;
  if (direction === 'neutral' || deltaPercent === null) {
    return <span style={{ fontSize: 11, color: 'var(--muted)' }}>— No comparison yet</span>;
  }
  const color = direction === 'up' ? '#4a7c59' : '#c0392b';
  const arrow = direction === 'up' ? '▲' : '▼';
  const sign  = direction === 'up' && deltaPercent > 0 ? '+' : '';
  return (
    <span style={{ fontSize: 11, color }}>
      {arrow} {sign}{deltaPercent.toFixed(1)}%
    </span>
  );
}

function MetricBlock({
  label,
  revenue,
  orders,
  comparison,
}: {
  label: string;
  revenue: number;
  orders: number;
  comparison?: Comparison;
}) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', padding: 20, flex: 1 }}>
      <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
        {label}
      </p>
      <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 30, fontWeight: 400, color: 'var(--dark)', marginBottom: 4, lineHeight: 1 }}>
        {fmtCents(revenue)}
      </p>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: comparison ? 6 : 0 }}>
        {orders} order{orders !== 1 ? 's' : ''}
      </p>
      {comparison && <Delta comparison={comparison} />}
    </div>
  );
}

function Sparkline({ data }: { data: { date: string; revenue: number }[] }) {
  const values = data.map(d => d.revenue);
  const max    = Math.max(...values, 1);

  if (values.every(v => v === 0)) {
    return (
      <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
          Revenue will appear here once your first order arrives.
        </p>
      </div>
    );
  }

  const W = 1000;
  const H = 100;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * W},${H - (v / max) * H * 0.9}`)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: 80, display: 'block' }}
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--dark, #1a1916)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function Zone2Metrics({ data }: { data: Zone2Data }) {
  const { today, thisWeek, thisMonth, last30DaysChart } = data;

  return (
    <Card title="HOW ARE WE DOING">
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <MetricBlock label="Today"      revenue={today.revenue}     orders={today.orders} />
        <MetricBlock label="This week"  revenue={thisWeek.revenue}  orders={thisWeek.orders}  comparison={thisWeek.comparison} />
        <MetricBlock label="This month" revenue={thisMonth.revenue} orders={thisMonth.orders} comparison={thisMonth.comparison} />
      </div>

      <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
        Revenue — last 30 days
      </p>
      <Sparkline data={last30DaysChart} />
    </Card>
  );
}

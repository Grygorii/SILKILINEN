'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

function fmtAxisDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

// Excel-style daily revenue chart: gridlines, € y-axis, date x-axis, and a hover
// tooltip with the exact amount. Built on recharts (already a dependency).
function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  if (data.length === 0 || data.every(d => d.revenue === 0)) {
    return (
      <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
          Revenue will appear here once your first order arrives.
        </p>
      </div>
    );
  }

  const chartData = data.map(d => ({
    label: fmtAxisDate(d.date),
    euros: Math.round(d.revenue) / 100, // cents → euros
  }));

  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#8A8278' }}
            interval="preserveStartEnd"
            minTickGap={24}
            tickLine={false}
            axisLine={{ stroke: '#E8E2D6' }}
          />
          <YAxis
            tickFormatter={(v: number) => `€${v}`}
            tick={{ fontSize: 10, fill: '#8A8278' }}
            width={48}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v: number) => [`€${v.toFixed(2)}`, 'Revenue']}
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #E8E2D6' }}
            labelStyle={{ fontSize: 11, color: '#8A8278' }}
          />
          <Bar dataKey="euros" fill="#2A2218" radius={[2, 2, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
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
      <RevenueChart data={last30DaysChart} />
    </Card>
  );
}

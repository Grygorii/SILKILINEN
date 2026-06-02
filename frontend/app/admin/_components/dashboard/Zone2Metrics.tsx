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

function fmtAxisCurrency(cents: number): string {
  // Compact y-axis label: cents → "€X" / "€X.Yk". The exact figure for
  // the totals lives on the metric cards above; the chart only needs
  // enough resolution to anchor the eye.
  const euros = cents / 100;
  if (euros >= 1000) return `€${(Math.round(euros / 100) / 10).toFixed(1)}k`;
  return `€${Math.round(euros)}`;
}

function fmtAxisDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function Sparkline({ data }: { data: { date: string; revenue: number }[] }) {
  const values = data.map(d => d.revenue);
  const max    = Math.max(...values, 1);

  if (values.every(v => v === 0)) {
    return (
      <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
          Revenue will appear here once your first order arrives.
        </p>
      </div>
    );
  }

  // Chart geometry — inset left/bottom so axis labels have room.
  const W = 1000;
  const H = 140;
  const padL = 60;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const px = (i: number) => padL + (i / Math.max(values.length - 1, 1)) * innerW;
  const py = (v: number) => padT + (1 - v / max) * innerH;

  const linePoints = values.map((v, i) => `${px(i)},${py(v)}`).join(' ');
  const areaPoints = `${padL},${padT + innerH} ${linePoints} ${padL + innerW},${padT + innerH}`;

  // First / middle / last date labels are enough at 30-day resolution.
  const midIndex = Math.floor((values.length - 1) / 2);
  const dateMarkers = [
    { i: 0,                  iso: data[0]?.date },
    { i: midIndex,           iso: data[midIndex]?.date },
    { i: values.length - 1,  iso: data[values.length - 1]?.date },
  ];

  // Y-axis ticks at 0 / 50 / 100% of max so amounts are readable at a glance.
  const yTicks = [
    { frac: 0,    label: '€0' },
    { frac: 0.5,  label: fmtAxisCurrency(max * 0.5) },
    { frac: 1,    label: fmtAxisCurrency(max) },
  ];

  // Mark the highest day so the eye lands on it immediately.
  const peakValue = Math.max(...values);
  const peakIndex = values.indexOf(peakValue);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: 160, display: 'block', overflow: 'visible' }}
      aria-label="Revenue, last 30 days"
    >
      {yTicks.map(t => {
        const y = padT + (1 - t.frac) * innerH;
        return (
          <g key={t.frac}>
            <line x1={padL} x2={padL + innerW} y1={y} y2={y}
              stroke="var(--color-line, #E8E2D6)" strokeWidth={1}
              strokeDasharray={t.frac === 0 ? '0' : '2 4'}
              vectorEffect="non-scaling-stroke" />
            <text x={padL - 8} y={y + 3} textAnchor="end"
              fontFamily="Jost, sans-serif" fontSize={10}
              fill="var(--color-ink-muted, #8A8278)">
              {t.label}
            </text>
          </g>
        );
      })}

      <polygon points={areaPoints}
        fill="var(--color-ink, #2A2218)"
        opacity={0.06} />

      <polyline
        points={linePoints}
        fill="none"
        stroke="var(--color-ink, #2A2218)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {peakValue > 0 && (
        <g>
          <circle cx={px(peakIndex)} cy={py(peakValue)} r={4}
            fill="var(--color-bg, #FAF8F4)"
            stroke="var(--color-ink, #2A2218)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke" />
          <text x={px(peakIndex)} y={py(peakValue) - 10}
            textAnchor="middle"
            fontFamily="Jost, sans-serif" fontSize={10} fontWeight={500}
            fill="var(--color-ink, #2A2218)">
            {fmtAxisCurrency(peakValue)}
          </text>
        </g>
      )}

      {dateMarkers.map(m => (
        <text key={m.i} x={px(m.i)} y={H - 8}
          textAnchor={m.i === 0 ? 'start' : m.i === values.length - 1 ? 'end' : 'middle'}
          fontFamily="Jost, sans-serif" fontSize={10}
          fill="var(--color-ink-muted, #8A8278)">
          {fmtAxisDate(m.iso)}
        </text>
      ))}
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

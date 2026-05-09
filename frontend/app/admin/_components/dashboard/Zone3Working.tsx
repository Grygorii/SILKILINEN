'use client';

import { useRouter } from 'next/navigation';
import Card from '../Card';

type TopProduct = {
  productId: string; productName: string; imageUrl: string | null;
  unitsSold: number; revenue: number; linkTo: string;
};
type TrafficSource = {
  source: string; displayLabel: string;
  visitors: number; buyers: number; conversionPercent: number;
};
type BestConverting = {
  productId: string; productName: string; imageUrl: string | null;
  conversionPercent: number; linkTo: string;
} | null;

type Zone3Data = {
  topProducts30d:        TopProduct[];
  topTrafficSources30d:  TrafficSource[];
  bestConvertingProduct30d: BestConverting;
};

function fmtCents(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

export default function Zone3Working({ data }: { data: Zone3Data }) {
  const router = useRouter();
  const { topProducts30d, topTrafficSources30d, bestConvertingProduct30d } = data;

  return (
    <Card title="WHAT'S WORKING">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Top products */}
        <div>
          <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
            Top products (30 days)
          </p>
          {topProducts30d.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
              Top products will appear here once you have orders.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topProducts30d.map(p => (
                <button
                  key={String(p.productId)}
                  onClick={() => router.push(p.linkTo)}
                  style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:         10,
                    background: 'none',
                    border:     '1px solid var(--border)',
                    padding:    '10px 12px',
                    cursor:     'pointer',
                    textAlign:  'left',
                    width:      '100%',
                  }}
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.productName} style={{ width: 36, height: 36, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 36, height: 36, background: 'var(--cream)', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: 'var(--dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.productName}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {p.unitsSold} sold · {fmtCents(p.revenue)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right column: traffic sources + best converting */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Traffic sources */}
          <div>
            <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
              Top sources (30 days)
            </p>
            {topTrafficSources30d.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
                Traffic sources will appear here as customers visit.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {topTrafficSources30d.map(s => (
                  <div
                    key={s.source}
                    style={{
                      display:       'flex',
                      alignItems:    'center',
                      gap:            12,
                      padding:       '10px 0',
                      borderBottom:  '1px solid var(--border)',
                      fontSize:       13,
                    }}
                  >
                    <span style={{ flex: 1, color: 'var(--dark)' }}>{s.displayLabel}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>{s.visitors} visitors</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>{s.conversionPercent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Best converting */}
          <div>
            <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
              Best converting
            </p>
            {bestConvertingProduct30d === null ? (
              <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
                Best-converting product surfaces once any product crosses 50 unique visits.
              </p>
            ) : (
              <button
                onClick={() => router.push(bestConvertingProduct30d!.linkTo)}
                style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:         10,
                  background: 'none',
                  border:     '1px solid var(--border)',
                  padding:    '10px 12px',
                  cursor:     'pointer',
                  textAlign:  'left',
                  width:      '100%',
                }}
              >
                {bestConvertingProduct30d.imageUrl ? (
                  <img
                    src={bestConvertingProduct30d.imageUrl}
                    alt={bestConvertingProduct30d.productName}
                    style={{ width: 36, height: 36, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 36, height: 36, background: 'var(--cream)', flexShrink: 0 }} />
                )}
                <div>
                  <p style={{ fontSize: 13, color: 'var(--dark)' }}>{bestConvertingProduct30d.productName}</p>
                  <p style={{ fontSize: 11, color: '#4a7c59' }}>
                    {bestConvertingProduct30d.conversionPercent.toFixed(1)}% of viewers buy
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>

      </div>
    </Card>
  );
}

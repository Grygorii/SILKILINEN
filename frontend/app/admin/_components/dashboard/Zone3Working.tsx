'use client';

import { useRouter } from 'next/navigation';
import Card from '../Card';
import styles from './Zone3Working.module.css';

type TopProduct = {
  productId: string; productName: string; imageUrl: string | null;
  unitsSold: number; revenue: number; linkTo: string;
};
type TrafficSource = {
  source: string; displayLabel: string;
  visitors: number; buyers: number;
  conversionPercent: number | null;
  percentOfTraffic: number | null;
  attributedOrders?: number;
};
type BestConverting = {
  productId: string; productName: string; imageUrl: string | null;
  conversionPercent: number; linkTo: string;
} | null;
type GeoCountry = { country: string; countryCode: string | null; visitors: number; percentOfTraffic: number | null };
type GeoCity    = { city: string; country: string | null; visitors: number; percentOfTraffic: number | null };

type Zone3Data = {
  topProducts30d:           TopProduct[];
  topTrafficSources30d:     TrafficSource[];
  topCountries30d:          GeoCountry[];
  topCities30d:             GeoCity[];
  bestConvertingProduct30d: BestConverting;
  showConversion:           boolean;
  attribution?: { summary: { orders: number; netRevenueEUR: number; linkedOrders: number; unlinkedOrders: number }; orders: { id: string; orderNumber: string; totalEUR: number; sourceLabel: string; basis: string; linkTo: string }[] };
};

function fmtCents(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

export default function Zone3Working({ data }: { data: Zone3Data }) {
  const router = useRouter();
  const { topProducts30d, topTrafficSources30d, bestConvertingProduct30d, showConversion } = data;
  const topCountries30d = data.topCountries30d ?? [];
  const topCities30d    = data.topCities30d    ?? [];

  return (
    <Card title="WHAT'S WORKING">
      {data.attribution && <div style={{ padding: 16, marginBottom: 20, background: 'var(--admin-bg)', fontSize: 13, lineHeight: 1.8 }}>
        <strong>{data.attribution.summary.orders} purchases · €{data.attribution.summary.netRevenueEUR.toFixed(2)} net order value (30 days)</strong><br />
        {data.attribution.summary.linkedOrders} orders linked to browsers; {data.attribution.summary.unlinkedOrders} website orders unlinked.
        {data.attribution.summary.unlinkedOrders > 0 && <> Source conversion is <strong>unknown, not 0%</strong>. Historical default “direct” is not proof of acquisition.</>}
        <details style={{ marginTop: 8 }}><summary style={{ cursor: 'pointer' }}>Where each order came from</summary>
          {data.attribution.orders.map(order => <p key={order.id}><a href={order.linkTo}>{order.orderNumber}</a> · €{order.totalEUR.toFixed(2)} · {order.sourceLabel} <span style={{ color: 'var(--admin-ink-muted)' }}>({order.basis.replaceAll('_', ' ')})</span></p>)}
        </details>
      </div>}
      <div className={styles.grid}>

        {/* Top products */}
        <div>
          <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--admin-ink-muted)', marginBottom: 12 }}>
            Top products (30 days)
          </p>
          {topProducts30d.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--admin-ink-muted)', fontStyle: 'italic' }}>
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
                    border:     '1px solid var(--admin-line)',
                    padding:    '10px 12px',
                    cursor:     'pointer',
                    textAlign:  'left',
                    width:      '100%',
                  }}
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.productName} style={{ width: 36, height: 36, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 36, height: 36, background: 'var(--admin-bg)', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: 'var(--admin-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.productName}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--admin-ink-muted)' }}>
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
            <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--admin-ink-muted)', marginBottom: 12 }}>
              Observed sources (30 days)
            </p>
            {topTrafficSources30d.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--admin-ink-muted)', fontStyle: 'italic' }}>
                Traffic sources will appear here as customers visit.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{ display: 'flex', gap: 12, padding: '4px 0 8px', fontSize: 10, color: 'var(--admin-ink-muted)', letterSpacing: '0.5px' }}>
                  <span style={{ flex: 1 }} />
                  <span style={{ width: 56, textAlign: 'right' }}>% traffic</span>
                  {showConversion && <span style={{ width: 56, textAlign: 'right' }}>conv.</span>}
                </div>
                {topTrafficSources30d.map(s => (
                  <div
                    key={s.source}
                    style={{
                      display:       'flex',
                      alignItems:    'center',
                      gap:            12,
                      padding:       '10px 0',
                      borderBottom:  '1px solid var(--admin-line)',
                      fontSize:       13,
                    }}
                  >
                    <span style={{ flex: 1, color: 'var(--admin-ink)' }}>{s.displayLabel}</span>
                    <span style={{ width: 56, textAlign: 'right', color: 'var(--admin-ink-muted)', fontSize: 12 }}>
                      {s.percentOfTraffic != null ? `${s.percentOfTraffic.toFixed(1)}%` : '—'}
                    </span>
                    {showConversion && (
                      <span style={{ width: 56, textAlign: 'right', color: 'var(--admin-ink-muted)', fontSize: 12 }}>
                        {s.conversionPercent != null ? `${s.conversionPercent.toFixed(1)}%` : 'Unknown'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top countries */}
          {topCountries30d.length > 0 && (
            <div>
              <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--admin-ink-muted)', marginBottom: 12 }}>
                Recorded locations (30 days)
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {topCountries30d.map(c => (
                  <div key={c.country} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--admin-line)', fontSize: 13 }}>
                    <span style={{ flex: 1, color: 'var(--admin-ink)' }}>{c.country}</span>
                    <span style={{ color: 'var(--admin-ink-muted)', fontSize: 12, textAlign: 'right' }}>
                      {c.percentOfTraffic != null ? `${c.percentOfTraffic.toFixed(1)}%` : `${c.visitors}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top cities */}
          {topCities30d.length > 0 && (
            <div>
              <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--admin-ink-muted)', marginBottom: 12 }}>
                Recorded cities (30 days)
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {topCities30d.map(c => (
                  <div key={`${c.city}-${c.country}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--admin-line)', fontSize: 13 }}>
                    <span style={{ flex: 1, color: 'var(--admin-ink)' }}>{c.city}{c.country ? `, ${c.country}` : ''}</span>
                    <span style={{ color: 'var(--admin-ink-muted)', fontSize: 12, textAlign: 'right' }}>
                      {c.percentOfTraffic != null ? `${c.percentOfTraffic.toFixed(1)}%` : `${c.visitors}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Best converting */}
          <div>
            <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--admin-ink-muted)', marginBottom: 12 }}>
              Best converting
            </p>
            {bestConvertingProduct30d === null ? (
              <p style={{ fontSize: 13, color: 'var(--admin-ink-muted)', fontStyle: 'italic' }}>
                Not ranked: reliable product-to-purchase linkage is not yet established. Sales above remain available.
              </p>
            ) : (
              <button
                onClick={() => router.push(bestConvertingProduct30d!.linkTo)}
                style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:         10,
                  background: 'none',
                  border:     '1px solid var(--admin-line)',
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
                  <div style={{ width: 36, height: 36, background: 'var(--admin-bg)', flexShrink: 0 }} />
                )}
                <div>
                  <p style={{ fontSize: 13, color: 'var(--admin-ink)' }}>{bestConvertingProduct30d.productName}</p>
                  <p style={{ fontSize: 11, color: 'var(--admin-success)' }}>
                    {bestConvertingProduct30d.conversionPercent.toFixed(1)}% of viewers buy
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>

      </div>
      <p style={{ marginTop: 16, fontSize: 12, color: 'var(--admin-ink-muted)' }}>Traffic shares use tracked browser IDs, not verified people or timed sessions. Location is not proof of buyer demand or bots. Product sales above are units and gross line values, not order counts or net revenue.</p>
    </Card>
  );
}

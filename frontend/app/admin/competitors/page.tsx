'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Sample = { title?: string; price?: number | null; url?: string; type?: string };
type Profile = {
  domain: string; name?: string; platform: string; currency?: string | null;
  productCount: number; productCountCapped?: boolean;
  priceMin?: number | null; priceMax?: number | null; priceAvg?: number | null;
  productTypes?: string[]; sampleProducts?: Sample[]; newest?: Sample[];
  lastScrapedAt?: string; lastError?: string | null;
};
type YourStore = { currency: string; productCount: number; priceMin: number | null; priceMax: number | null; priceAvg: number | null };
type AdviceEvidence = {
  competitor: string; domain: string; platform: string; currency: string;
  observedPrice: number; priceEur: number; title: string; url: string; scrapedAt?: string | null;
};
type AdviceProduct = {
  product: { id: string; name: string; price: number; category: string; materialComposition: string; momme: string; status: string };
  family: { key: string; label: string } | null;
  cost: { state: 'known' | 'missing' | 'conflict'; unitCost: number | null; marginBeforeFees: number | null };
  sales: { units: number; revenue: number };
  position: { key: 'below' | 'above' | 'aligned' | 'insufficient'; label: string; deltaFromMedian: number | null };
  confidence: { key: 'strong' | 'limited' | 'insufficient'; label: string; reason: string };
  market: {
    band: { low: number; median: number; high: number; min: number; max: number } | null;
    comparableBrands: number; ignoredUnknownCurrency: number; ignoredStale: number; evidence: AdviceEvidence[];
  };
  recommendation: { key: string; title: string; detail: string; testPrice?: number };
  descriptionIdea: string;
  marketingIdea: string;
};
type MarketIdea = { title: string; detail: string; href?: string; createdAt?: string };
type Advice = {
  policy: string;
  method: { minComparableBrands: number; maxProfileAgeDays: number; note: string };
  summary: { products: number; profiles: number; currentProfiles: number; withComparableEvidence: number; costingMissing: number; reviewPriceArchitecture: number; controlledTests: number };
  products: AdviceProduct[];
  marketIdeas?: MarketIdea[];
};

const PLATFORM_COLOR: Record<string, string> = {
  shopify: 'var(--admin-success)', woocommerce: 'var(--admin-info)', jsonld: 'var(--admin-info)', other: 'var(--admin-ink-muted)', unknown: 'var(--admin-danger)',
};

function eur(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);
}

function listedMoney(profile?: Profile) {
  if (profile?.priceMin == null) return '—';
  const min = profile.priceMin;
  const max = profile.priceMax ?? min;
  const range = min === max ? `${min}` : `${min}–${max}`;
  if (!profile.currency) return `${range} listed · currency unconfirmed`;
  try {
    const formatter = new Intl.NumberFormat('en-IE', { style: 'currency', currency: profile.currency, maximumFractionDigits: 2 });
    return min === max ? formatter.format(min) : `${formatter.format(min)}–${formatter.format(max)}`;
  } catch {
    return `${range} ${profile.currency}`;
  }
}

function sourceMoney(item: AdviceEvidence) {
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: item.currency, maximumFractionDigits: 2 }).format(item.observedPrice);
  } catch {
    return `${item.observedPrice} ${item.currency}`;
  }
}

function rel(iso?: string | null) {
  if (!iso) return '';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes <= 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function costLabel(item: AdviceProduct) {
  if (item.cost.state === 'missing') return 'Unit costing missing';
  if (item.cost.state === 'conflict') return 'Cost records disagree';
  return `Unit cost ${eur(item.cost.unitCost)} · ${item.cost.marginBeforeFees}% gross item margin before fees/shipping`;
}

function recommendationTone(key: string) {
  if (key === 'hold_price' || key === 'protect_position') return 'hold';
  if (key === 'collect_more_evidence') return 'insufficient';
  return 'review';
}

function isReview(item: AdviceProduct) {
  return ['review_price_architecture', 'complete_costing_first', 'strengthen_value_proof', 'consider_controlled_test'].includes(item.recommendation.key);
}

export default function CompetitorsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [your, setYour] = useState<YourStore | null>(null);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState<'advice' | 'evidence'>('advice');
  const [filter, setFilter] = useState<'all' | 'review' | 'supported' | 'more'>('all');
  const [sort, setSort] = useState<'count' | 'recent'>('count');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const [profileResult, adviceResult] = await Promise.allSettled([
      fetch(`${API}/api/admin/growth/competitors/profiles`, { credentials: 'include' }),
      fetch(`${API}/api/admin/growth/competitors/advice`, { credentials: 'include' }),
    ]);
    if (profileResult.status === 'fulfilled' && profileResult.value.ok) {
      const data = await profileResult.value.json();
      if (data?.profiles) {
        setProfiles(data.profiles);
        setYour(data.yourStore);
        setTotal(data.totalCompetitors || 0);
      }
    }
    if (adviceResult.status === 'fulfilled' && adviceResult.value.ok) {
      const data = await adviceResult.value.json();
      if (data?.products) setAdvice(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function scan() {
    setScanning(true);
    try {
      await fetch(`${API}/api/admin/growth/competitors/scan`, { method: 'POST', credentials: 'include' });
    } catch { /* The existing evidence stays visible if a background scan cannot begin. */ }
    let ticks = 0;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      load();
      if (++ticks >= 14) {
        clearInterval(pollRef.current!);
        setScanning(false);
      }
    }, 9000);
  }

  const scraped = profiles.filter(profile => profile.platform !== 'unknown').length;
  const sortedProfiles = [...profiles].sort((a, b) => sort === 'count'
    ? b.productCount - a.productCount
    : new Date(b.lastScrapedAt || 0).getTime() - new Date(a.lastScrapedAt || 0).getTime());
  const visibleAdvice = (advice?.products || []).filter(item => {
    if (filter === 'review') return isReview(item);
    if (filter === 'supported') return item.confidence.key !== 'insufficient';
    if (filter === 'more') return item.confidence.key === 'insufficient';
    return true;
  });

  return (
    <AdminLayout active="competitors">
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Competitor Intelligence</h1>
            <p className={styles.intro}>Market evidence, then a calm product-by-product price and positioning review. Being cheaper is never the default move.</p>
          </div>
          <button className={styles.scanButton} onClick={scan} disabled={scanning}>
            {scanning ? 'Scanning…' : '✦ Scan competitors'}
          </button>
        </div>

        {your && (
          <div className={styles.benchmark}>
            <span className={styles.benchmarkLabel}>You</span>
            <span><strong>{your.productCount}</strong> products</span>
            <span>{eur(your.priceMin)}–{eur(your.priceMax)} <span className={styles.productCategory}>(avg {eur(your.priceAvg)})</span></span>
            <span className={styles.scanStatus}>{scraped} of {total} competitors scraped{scanning ? ' · scanning…' : ''}</span>
          </div>
        )}

        <div className={styles.tabs} role="tablist" aria-label="Competitor intelligence view">
          <button className={`${styles.tab} ${tab === 'advice' ? styles.tabActive : ''}`} onClick={() => setTab('advice')} aria-pressed={tab === 'advice'}>Pricing &amp; positioning</button>
          <button className={`${styles.tab} ${tab === 'evidence' ? styles.tabActive : ''}`} onClick={() => setTab('evidence')} aria-pressed={tab === 'evidence'}>Market evidence</button>
        </div>

        {loading ? <p className={styles.loading}>Loading…</p> : tab === 'advice' ? (
          <>
            <section className={styles.advisory} aria-label="How to use these recommendations">
              <h2 className={styles.advisoryTitle}>Price &amp; positioning review</h2>
              <p className={styles.advisoryCopy}>{advice?.policy || 'Advisory only. No product price, description, or campaign change is made here.'}</p>
              <p className={styles.method}>{advice?.method.note || 'A product needs like-for-like, current, currency-confirmed evidence before the page gives a numeric price position.'}</p>
            </section>

            {advice && <div className={styles.metrics}>
              <div className={styles.metric}><p className={styles.metricLabel}>Catalogue products reviewed</p><p className={styles.metricValue}>{advice.summary.products}</p></div>
              <div className={styles.metric}><p className={styles.metricLabel}>Comparable evidence</p><p className={styles.metricValue}>{advice.summary.withComparableEvidence}</p></div>
              <div className={styles.metric}><p className={styles.metricLabel}>Costing to complete</p><p className={styles.metricValue}>{advice.summary.costingMissing}</p></div>
              <div className={styles.metric}><p className={styles.metricLabel}>Price-ladder reviews</p><p className={styles.metricValue}>{advice.summary.reviewPriceArchitecture}</p></div>
            </div>}

            <div className={styles.adviceHeader}>
              <h2 className={styles.sectionTitle}>Every product</h2>
              <span className={styles.adviceCount}>{visibleAdvice.length} shown</span>
            </div>
            <div className={styles.filterRow} aria-label="Filter product recommendations">
              {([
                ['all', 'All products'],
                ['review', 'Needs review'],
                ['supported', 'Comparable evidence'],
                ['more', 'Need more evidence'],
              ] as const).map(([key, label]) => (
                <button key={key} className={`${styles.filter} ${filter === key ? styles.filterActive : ''}`} onClick={() => setFilter(key)} aria-pressed={filter === key}>{label}</button>
              ))}
            </div>

            {!advice ? <div className={styles.empty}><p>Competitor advice is not available yet. Keep the market evidence visible and run a fresh scan when ready.</p></div>
              : visibleAdvice.length === 0 ? <div className={styles.empty}><p>No products match this filter.</p></div>
                : <div className={styles.adviceList}>{visibleAdvice.map(item => (
                  <article key={item.product.id} className={styles.productCard}>
                    <div className={styles.productTop}>
                      <div>
                        <h3 className={styles.productName}>{item.product.name}</h3>
                        <p className={styles.productCategory}>{item.family?.label || item.product.category || 'Product family needs clearer naming'}</p>
                      </div>
                      <span className={styles.price}>{eur(item.product.price)}</span>
                    </div>
                    <div className={styles.productMeta}>
                      <span className={styles.badge} data-tone={item.confidence.key}>{item.confidence.label} evidence</span>
                      <span className={styles.badge} data-tone={recommendationTone(item.recommendation.key)}>{item.position.label}</span>
                      {item.market.band && <span className={styles.position}>Peer band {eur(item.market.band.low)}–{eur(item.market.band.high)} · median {eur(item.market.band.median)}</span>}
                    </div>
                    <p className={styles.recommendation}><strong>{item.recommendation.title}.</strong> {item.recommendation.detail}</p>
                    <p className={styles.dataNote}>{costLabel(item)} · {item.sales.units ? `${item.sales.units} paid unit${item.sales.units === 1 ? '' : 's'} in the last 90 days` : 'No paid-unit signal in the last 90 days'}</p>

                    <details className={styles.review}>
                      <summary>Evidence, description &amp; marketing ideas</summary>
                      <div className={styles.reviewContent}>
                        <div><h3>Why this is safe to say</h3><p>{item.confidence.reason}</p></div>
                        <div><h3>Description focus</h3><p>{item.descriptionIdea}</p></div>
                        <div><h3>Marketing focus</h3><p>{item.marketingIdea}</p></div>
                      </div>
                      {item.market.evidence.length > 0 && <>
                        <h3 className={styles.evidenceHeading}>Current direct references</h3>
                        <ul className={styles.evidenceItems}>
                          {item.market.evidence.map((evidence, index) => (
                            <li key={`${evidence.domain}-${index}`} className={styles.evidenceItem}>
                              <span>{evidence.competitor}: {evidence.url ? <a href={evidence.url} target="_blank" rel="noreferrer">{evidence.title || 'product page'}</a> : evidence.title || 'product sample'}</span>
                              <span>{sourceMoney(evidence)} · ≈ {eur(evidence.priceEur)}</span>
                            </li>
                          ))}
                        </ul>
                      </>}
                      {(item.market.ignoredUnknownCurrency > 0 || item.market.ignoredStale > 0) && <p className={styles.dataNote}>{item.market.ignoredUnknownCurrency > 0 ? `${item.market.ignoredUnknownCurrency} relevant profile${item.market.ignoredUnknownCurrency === 1 ? '' : 's'} excluded because currency is unconfirmed. ` : ''}{item.market.ignoredStale > 0 ? `${item.market.ignoredStale} profile${item.market.ignoredStale === 1 ? '' : 's'} excluded because the scan is over ${advice.method.maxProfileAgeDays} days old.` : ''}</p>}
                      <Link href={`/admin/products/${encodeURIComponent(item.product.id)}`} className={styles.openProduct}>Open product for manual review</Link>
                    </details>
                  </article>
                ))}</div>}

            {advice?.marketIdeas && advice.marketIdeas.length > 0 && <section>
              <h2 className={`${styles.sectionTitle} ${styles.marketIdeasTitle}`}>Market ideas already surfaced</h2>
              <div className={styles.ideaList}>{advice.marketIdeas.map((idea, index) => (
                <article key={`${idea.title}-${index}`} className={styles.marketIdea}>
                  <div className={styles.ideaTop}><h3 className={styles.ideaTitle}>{idea.title}</h3><span className={styles.productCategory}>{rel(idea.createdAt)}</span></div>
                  <p className={styles.ideaDetail}>{idea.detail}</p>
                  {idea.href && <Link href={idea.href} className={styles.marketLink}>Review in Growth Engine</Link>}
                </article>
              ))}</div>
            </section>}
          </>
        ) : (
          <>
            <section className={styles.advisory}>
              <h2 className={styles.advisoryTitle}>Market evidence, not a price mandate</h2>
              <p className={styles.advisoryCopy}>These are observed catalogue figures. They are useful to study the field, but a whole-shop average must not decide the price of one SILKILINEN product.</p>
              <p className={styles.method}>Currency-unconfirmed rows stay visible for research but are excluded from the price-and-positioning recommendations above.</p>
            </section>
            <div className={styles.filterRow}>
              {(['count', 'recent'] as const).map(key => (
                <button key={key} className={`${styles.filter} ${sort === key ? styles.filterActive : ''}`} onClick={() => setSort(key)} aria-pressed={sort === key}>{key === 'count' ? 'Biggest catalogue' : 'Recently scanned'}</button>
              ))}
            </div>
            {profiles.length === 0 ? <div className={styles.empty}><p>No competitor data yet. Scan competitors to collect current, public market evidence.</p></div>
              : <div className={styles.evidenceList}>{sortedProfiles.map(profile => (
                <article key={profile.domain} className={styles.evidenceCard}>
                  <div className={styles.evidenceTop}>
                    <div>
                      <a href={`https://${profile.domain}`} target="_blank" rel="noreferrer" className={styles.productName}>{profile.name || profile.domain}</a>
                      <div className={styles.productMeta}>
                        <span className={styles.badge} style={{ color: PLATFORM_COLOR[profile.platform] || 'var(--admin-ink-muted)', borderColor: PLATFORM_COLOR[profile.platform] || 'var(--admin-ink-muted)' }}>{profile.platform}</span>
                        <span className={styles.productCategory}>{profile.domain}</span>
                      </div>
                    </div>
                    <span className={styles.productCategory}>{profile.lastError ? `couldn’t read: ${profile.lastError}` : rel(profile.lastScrapedAt)}</span>
                  </div>
                  {profile.platform !== 'unknown' && <div className={styles.productMeta}>
                    <span><strong>{profile.productCount}{profile.productCountCapped ? '+' : ''}</strong> products</span>
                    <span>{listedMoney(profile)}{profile.priceAvg != null && profile.currency ? ` · observed avg ${profile.currency} ${profile.priceAvg}` : ''}</span>
                    {profile.newest?.[0]?.title && <span className={styles.productCategory}>newest: {profile.newest[0].title}</span>}
                  </div>}
                  {profile.sampleProducts && profile.sampleProducts.length > 0 && <p className={styles.productDetail}>{profile.sampleProducts.slice(0, 6).map(sample => `${sample.title}${sample.price != null ? ` (${sample.price}${profile.currency ? ` ${profile.currency}` : ''})` : ''}`).join(' · ')}</p>}
                </article>
              ))}</div>}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Offer = { code: string; percent: number; minimumOrderValue: number; validUntil: string | null } | null;

type SavedProduct = {
  productId: string;
  name: string;
  slug: string | null;
  status: string;
  savedAt: string | null;
  completedAt: string | null;
  reminderAttemptedAt: string | null;
  reminderSentAt: string | null;
  eligible: boolean;
};

type WishlistPerson = {
  customerId: string;
  name: string;
  email: string | null;
  marketingConsent: boolean;
  emailVerified: boolean;
  products: SavedProduct[];
};

type WishlistData = {
  summary: {
    accountHolders: number;
    savedItems: number;
    trackedSaves: number;
    readyInSample: number;
    readinessSampleLimit: number;
  };
  automation: {
    delayDays: number;
    offer: Offer;
    emailConfigured: boolean;
    enabled: boolean;
  };
  topProducts: Array<{
    productId: string;
    name: string;
    slug: string | null;
    price: number | null;
    status: string;
    saves: number;
  }>;
  people: WishlistPerson[];
};

function formatDate(value: string | null) {
  if (!value) return 'No recorded date';
  return new Date(value).toLocaleDateString('en-IE', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function customerStatus(person: WishlistPerson) {
  if (person.emailVerified && person.marketingConsent) return 'Verified and opted in';
  if (person.emailVerified) return 'Verified, no marketing consent';
  if (person.marketingConsent) return 'Marketing consent, email not verified';
  return 'Not eligible for marketing email';
}

function reminderStatus(product: SavedProduct) {
  if (product.reminderSentAt) return { text: `Reminder sent ${formatDate(product.reminderSentAt)}`, tone: 'sent' };
  if (product.reminderAttemptedAt) return { text: `Reminder attempted ${formatDate(product.reminderAttemptedAt)}`, tone: 'attempted' };
  if (product.completedAt) return { text: 'No reminder: no longer eligible', tone: 'neutral' };
  if (product.eligible) return { text: 'Ready in the reviewed sample; checked again at the next run', tone: 'ready' };
  if (!product.savedAt) return { text: 'Existing save - not enrolled', tone: 'neutral' };
  return { text: 'Awaiting eligibility checks', tone: 'neutral' };
}

export default function WishlistIntelligencePage() {
  const [data, setData] = useState<WishlistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const request = useCallback(async (signal?: AbortSignal): Promise<WishlistData> => {
    const response = await fetch(`${API}/api/admin/wishlist`, {
      credentials: 'include',
      signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(body?.error || 'Could not load wishlist intelligence.');
    }
    return response.json() as Promise<WishlistData>;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void request(controller.signal)
      .then(nextData => {
        if (!controller.signal.aborted) setData(nextData);
      })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load wishlist intelligence.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [request]);

  function refresh() {
    setLoading(true);
    setError('');
    void request()
      .then(setData)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load wishlist intelligence.'))
      .finally(() => setLoading(false));
  }

  return (
    <AdminLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <Link href="/admin/marketing" className={styles.backLink}>Marketing</Link>
            <h1>Wishlist intelligence</h1>
            <p>Account-held saved pieces, with transparent, consent-led reminder status.</p>
          </div>
          <button className={styles.refreshButton} onClick={refresh} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <section className={styles.notice} aria-label="How wishlist reminders work">
          <h2>What is safe to automate</h2>
          <p>
            Guest wishlist saves stay in the shopper&apos;s browser, so they are anonymous and do not appear here. Only newly timestamped account saves can be considered for a reminder.
          </p>
          <p>
            After {data?.automation.delayDays ?? 7} days, the scheduler rechecks that the account email is verified, marketing consent is present, the item is still saved and active, and no later purchase was made. Existing saves without a recorded date are shown for context but are not enrolled just because they already exist.
          </p>
        </section>

        {loading && !data && <p className={styles.muted} role="status">Loading wishlist intelligence...</p>}

        {error && !data && (
          <div className={styles.errorBox} role="alert">
            <p>{error}</p>
            <button onClick={refresh}>Try again</button>
          </div>
        )}

        {data && (
          <>
            {error && <p className={styles.inlineError} role="alert">{error} Showing the most recently loaded data.</p>}

            <section className={styles.summaryGrid} aria-label="Wishlist summary">
              <div className={styles.metric}>
                <span>Account holders</span>
                <strong>{data.summary.accountHolders.toLocaleString()}</strong>
                <small>with a current saved item</small>
              </div>
              <div className={styles.metric}>
                <span>Saved products</span>
                <strong>{data.summary.savedItems.toLocaleString()}</strong>
                <small>across account wishlists</small>
              </div>
              <div className={styles.metric}>
                <span>Timestamped saves</span>
                <strong>{data.summary.trackedSaves.toLocaleString()}</strong>
                <small>new saves with lifecycle data</small>
              </div>
              <div className={styles.metric}>
                <span>Ready in reviewed sample</span>
                <strong>{data.automation.enabled ? data.summary.readyInSample.toLocaleString() : '—'}</strong>
                <small>{data.automation.enabled ? `up to ${data.summary.readinessSampleLimit} candidates; checked again at the next run` : 'automation needs an offer and email delivery'}</small>
              </div>
            </section>

            <section className={styles.automation} aria-labelledby="automation-title">
              <div>
                <h2 id="automation-title">Automatic reminder settings</h2>
                <p>This page is a view only. It does not send an email on demand.</p>
              </div>
              <dl>
                <div><dt>Wait</dt><dd>{data.automation.delayDays} days from a newly recorded save</dd></div>
                <div><dt>Offer</dt><dd>{data.automation.offer ? `${data.automation.offer.code} - ${data.automation.offer.percent}% off${data.automation.offer.minimumOrderValue > 0 ? ` on orders of €${data.automation.offer.minimumOrderValue.toFixed(2)}+` : ''}${data.automation.offer.validUntil ? `, valid until ${formatDate(data.automation.offer.validUntil)}` : ''}` : 'No active unlimited percentage offer configured'}</dd></div>
                <div><dt>Email delivery</dt><dd className={data.automation.emailConfigured ? styles.configured : styles.notConfigured}>{data.automation.emailConfigured ? 'Configured' : 'Not configured - no reminder can send'}</dd></div>
              </dl>
            </section>

            <section className={styles.section} aria-labelledby="top-products-title">
              <div className={styles.sectionHeading}>
                <div>
                  <h2 id="top-products-title">Most saved products</h2>
                  <p>Current saves on account wishlists, not anonymous guest browser saves.</p>
                </div>
              </div>
              {data.topProducts.length === 0 ? (
                <p className={styles.empty}>No account wishlist data yet.</p>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr><th>Product</th><th>Status</th><th>Current saves</th></tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map(product => (
                        <tr key={product.productId}>
                          <td>
                            <Link href={`/admin/products/${product.productId}`}>{product.name}</Link>
                            {product.price !== null && <span className={styles.subtle}>EUR {product.price.toFixed(2)}</span>}
                          </td>
                          <td><span className={product.status === 'active' ? styles.statusActive : styles.statusMuted}>{product.status}</span></td>
                          <td>{product.saves.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.section} aria-labelledby="people-title">
              <div className={styles.sectionHeading}>
                <div>
                  <h2 id="people-title">People with current account saves</h2>
                  <p>Up to 50 most recently updated account holders. A saved item does not itself create email permission.</p>
                </div>
              </div>
              {data.people.length === 0 ? (
                <p className={styles.empty}>No account-held wishlists yet. Guest saves stay anonymous in the browser.</p>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={`${styles.table} ${styles.peopleTable}`}>
                    <thead>
                      <tr><th>Customer</th><th>Email permission</th><th>Saved products</th></tr>
                    </thead>
                    <tbody>
                      {data.people.map(person => (
                        <tr key={person.customerId}>
                          <td>
                            <Link href={`/admin/customers/${person.customerId}`}>{person.name}</Link>
                            {person.email && <span className={styles.subtle}>{person.email}</span>}
                          </td>
                          <td><span className={person.emailVerified && person.marketingConsent ? styles.statusActive : styles.statusMuted}>{customerStatus(person)}</span></td>
                          <td>
                            <ul className={styles.savedProductList}>
                              {person.products.map(product => {
                                const reminder = reminderStatus(product);
                                return (
                                  <li key={product.productId}>
                                    <div className={styles.productLine}>
                                      <Link href={`/admin/products/${product.productId}`}>{product.name}</Link>
                                      <span className={product.status === 'active' ? styles.statusActive : styles.statusMuted}>{product.status}</span>
                                    </div>
                                    <div className={styles.productMeta}>
                                      <span>Saved {formatDate(product.savedAt)}</span>
                                      <span className={`${styles.reminder} ${styles[`reminder${reminder.tone[0].toUpperCase()}${reminder.tone.slice(1)}`]}`}>{reminder.text}</span>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

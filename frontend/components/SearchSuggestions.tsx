'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { productPath } from '@/lib/urls';
import { cloudinaryUrl } from '@/lib/imageUtils';
import Price from './Price';
import styles from './SearchSuggestions.module.css';

// Live suggestions under the nav search box.
//
// Search was submit-only: type, press enter, land on /shop?q=. That works and
// tells you nothing on the way — a customer typing "robe" has no idea whether
// the shop has two or twenty until the page loads, and a customer typing
// something we call by another name gets an empty page as their first
// impression of the catalogue.
//
// ── The one thing this must NOT do ──
//
// It must never record a search event. SearchTracker fires on the /shop page
// with the query AND its result count, and that feed is what clickstream.js
// hands the agents as "on-site searches — real demand, what visitors typed".
// Zero-result searches become unmet demand, which becomes a `range` proposal in
// the Growth Engine, which reaches the founder as "stock this".
//
// Recording here would post "s", "si", "sil", "silk" — four searches, three of
// them near-certainly zero-result — for every person who types one word. The
// demand signal would fill with prefixes and the advisor would recommend
// stocking them. Suggestions are a UI affordance; only a submitted search is a
// statement of intent.

type Suggestion = {
  _id: string;
  slug?: string;
  name: string;
  price: number;
  images?: { url: string; isPrimary?: boolean }[];
  image?: string;
  totalStock?: number;
  inStock?: boolean;
};

const DEBOUNCE_MS = 200;
const MIN_CHARS = 2;
const MAX_SUGGESTIONS = 6;

export default function SearchSuggestions({
  query,
  onNavigate,
  onSubmitAll,
}: {
  query: string;
  /** Called when a suggestion is opened, so the nav can close its search bar. */
  onNavigate: () => void;
  /** Called for "view all results" — the nav owns the actual navigation. */
  onSubmitAll: () => void;
}) {
  // Results are stored WITH the query they belong to. Two reasons: a late
  // response for an older query can be recognised and ignored, and a query
  // shorter than the minimum needs no state clearing — the results simply do
  // not match the current query, so nothing renders. Clearing state from inside
  // an effect is what causes the cascading re-render this file used to trip.
  const [result, setResult] = useState<{ q: string; list: Suggestion[] } | null>(null);
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  const q = query.trim();
  const items = result && result.q === q ? result.list : null;
  // Clamped at render rather than reset in an effect: when the list shrinks,
  // an out-of-range highlight is simply no highlight.
  const activeIndex = items && active < items.length ? active : -1;

  useEffect(() => {
    if (q.length < MIN_CHARS) return;

    // One in-flight request at a time. Without the abort, a fast typist's
    // earlier, shorter query can resolve LAST and overwrite the results for
    // what they actually typed — suggestions for "sil" showing under "silk".
    const ctrl = new AbortController();

    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/products?q=${encodeURIComponent(q)}&limit=${MAX_SUGGESTIONS}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const list: Suggestion[] = Array.isArray(data) ? data : (data.products ?? []);
        setResult({ q, list: list.slice(0, MAX_SUGGESTIONS) });
      } catch (err) {
        // An aborted request is the expected path on every keystroke, not a
        // failure — leaving the old list up is right, and setting an error
        // state here would flash "nothing found" between letters.
        if ((err as Error)?.name !== 'AbortError') setResult({ q, list: [] });
      }
    }, DEBOUNCE_MS);

    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!items?.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(i => (i + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(i => (i <= 0 ? items.length - 1 : i - 1));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        const el = listRef.current?.querySelectorAll('a')[activeIndex] as HTMLAnchorElement | undefined;
        el?.click();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, activeIndex]);

  if (q.length < MIN_CHARS) return null;

  // No results for THIS query yet — either the debounce has not fired or the
  // request is still out. Render nothing rather than an empty panel, which
  // would read as "no matches" for a query still being typed.
  if (!items) return null;

  return (
    <div className={styles.panel}>
      {items.length === 0 ? (
        <p className={styles.empty}>
          Nothing matches “{q}” yet.{' '}
          <button type="button" className={styles.allLink} onClick={onSubmitAll}>
            Search the whole shop
          </button>
        </p>
      ) : (
        <>
          <ul className={styles.list} role="listbox" aria-label="Search suggestions" ref={listRef}>
            {items.map((p, i) => {
              const img = p.images?.find(x => x.isPrimary)?.url || p.images?.[0]?.url || p.image;
              const soldOut = p.inStock === false || p.totalStock === 0;
              return (
                <li key={p._id} role="option" aria-selected={i === activeIndex}>
                  <Link
                    href={productPath(p)}
                    className={`${styles.row} ${i === activeIndex ? styles.rowActive : ''}`}
                    onClick={onNavigate}
                    onMouseEnter={() => setActive(i)}
                  >
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cloudinaryUrl(img, 80)} alt="" className={styles.thumb} loading="lazy" width={40} height={52} />
                    ) : (
                      <span className={styles.thumbEmpty} aria-hidden="true" />
                    )}
                    <span className={styles.text}>
                      <span className={styles.name}>{p.name}</span>
                      <span className={styles.meta}>
                        <Price eur={Number(p.price)} />
                        {soldOut && <span className={styles.soldOut}>Sold out</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <button type="button" className={styles.viewAll} onClick={onSubmitAll}>
            View all results for “{q}”
          </button>
        </>
      )}
    </div>
  );
}

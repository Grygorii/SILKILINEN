'use client';

import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';

// Records what a visitor searched for ON the site, and crucially how many
// products came back.
//
// trackSearch() existed in lib/analytics and was never called from anywhere, so
// the Event stream held no 'search' rows at all — while clickstream.js was
// telling every agent "On-site SEARCHES (real demand, what visitors typed)" and
// handing them an empty list. The agents were reasoning about demand from a
// signal that was never collected.
//
// `results` is the part worth having. A search that returns NOTHING is the least
// ambiguous signal in the whole shop: someone typed exactly what they wanted to
// buy and we had nothing to show them. That is either a product to stock or —
// more often — a product we DO sell under a name nobody searches for.
//
// The shop page is a server component, so this runs as a child of it and fires
// once per (query, results) pair. The ref guard stops React's strict-mode double
// effect and any re-render from double-counting.
export default function SearchTracker({ query, results }: { query: string; results: number }) {
  const fired = useRef('');

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const key = `${q.toLowerCase()}|${results}`;
    if (fired.current === key) return;
    fired.current = key;

    trackEvent('search', {
      search_term: q,
      results,
      // Denormalised so the aggregation can match on a boolean instead of
      // reasoning about a count, and so the meaning survives if the shape
      // of `results` ever changes.
      no_results: results === 0,
    });
  }, [query, results]);

  return null;
}

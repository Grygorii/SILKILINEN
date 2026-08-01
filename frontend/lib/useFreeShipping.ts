'use client';

import { useEffect, useState } from 'react';

// The free-shipping threshold for client components (cart progress bar, PDP
// reassurance line). Reads the SAME source checkout uses (/api/shipping, which
// serves backend/services/shipping.js + admin overrides) instead of hardcoding
// it — the number was previously duplicated in two components, so changing it
// in Admin → Shipping would have left the cart promising the old threshold
// while checkout charged the new one.
//
// Module-level cache so many components share one request per page load.
const DEFAULT_THRESHOLD = 150;
let cached: number | null = null;
let inflight: Promise<number> | null = null;

function fetchThreshold(): Promise<number> {
  if (inflight) return inflight;
  inflight = fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/shipping`)
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      const vals = (d?.tiers || [])
        .map((t: { freeThreshold?: number }) => t?.freeThreshold)
        .filter((n: unknown): n is number => typeof n === 'number' && Number.isFinite(n));
      const v = vals.length ? Math.min(...vals) : DEFAULT_THRESHOLD;
      cached = v;
      return v;
    })
    .catch(() => DEFAULT_THRESHOLD);
  return inflight;
}

/** Live free-shipping threshold; falls back to the default until loaded. */
export function useFreeShippingThreshold(): number {
  const [value, setValue] = useState<number>(cached ?? DEFAULT_THRESHOLD);
  useEffect(() => {
    let alive = true;
    if (cached !== null) { setValue(cached); return; }
    fetchThreshold().then(v => { if (alive) setValue(v); });
    return () => { alive = false; };
  }, []);
  return value;
}

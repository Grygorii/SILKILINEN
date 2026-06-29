'use client';

import { useState, useEffect } from 'react';

// Shared "is this a UK (GB) visitor?" lookup over /api/geo (Vercel edge header).
// Module-level cache + single in-flight promise so the notice card, announcement
// bar, and shipping badges all share ONE request per page load.
let cached: boolean | null | undefined; // undefined = not yet fetched
let inflight: Promise<boolean | null> | null = null;

function fetchIsUK(): Promise<boolean | null> {
  if (cached !== undefined) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch('/api/geo')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { cached = d ? d.country === 'GB' : null; return cached; })
      .catch(() => { cached = null; return null; });
  }
  return inflight;
}

// Returns null while unknown, then true/false. Treat null as "not UK" for gating.
export function useIsUK(): boolean | null {
  const [isUK, setIsUK] = useState<boolean | null>(cached ?? null);
  useEffect(() => {
    let active = true;
    fetchIsUK().then(v => { if (active) setIsUK(v); });
    return () => { active = false; };
  }, []);
  return isUK;
}

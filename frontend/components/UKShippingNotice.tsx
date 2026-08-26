'use client';

import { useState, useEffect, useCallback } from 'react';
import { useIsUK } from '@/lib/useIsUK';
import { UK_SHIPPING } from '@/lib/ukShipping';
import styles from './UKShippingNotice.module.css';

const STORAGE_KEY = 'slk_uk_notice_dismissed';
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000; // don't re-offer for 30 days once dismissed

// A quiet, geo-targeted note for UK (GB) visitors: their order is dispatched
// from Derry, inside the UK, so nothing is charged at the border. Slides in
// once, ~2s after load, and is dismissible. The copy itself is owned by
// lib/ukShipping.ts. Country comes from /api/geo (Vercel edge header) so
// storefront pages stay statically cached.
export default function UKShippingNotice() {
  const isUK = useIsUK();
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* ignore */ }
    setVisible(false);
  }, []);

  // Preview override: ?uk_preview=1 forces the card to show from any location,
  // so the team can review the design/copy without a UK IP.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('uk_preview')) setVisible(true);
  }, []);

  // Show once for CONFIRMED GB visitors only, ~2s after geo resolves.
  //
  // Deliberately stricter than the badge and the banner, which show on an
  // unknown country too (see shouldShowUkShipping). Those are one quiet line
  // that happens to be irrelevant to a visitor in Paris. This is a dialog that
  // slides over the page and has to be dismissed — showing that to the wrong
  // person because a geo lookup timed out is worse than not showing it. Fail
  // open on a whisper, never on an interruption.
  useEffect(() => {
    if (isUK !== true) return;
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (dismissed && Date.now() - Number(dismissed) < SNOOZE_MS) return;
    } catch { /* ignore */ }
    const showTimer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(showTimer);
  }, [isUK]);

  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') dismiss(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <div className={styles.card} role="dialog" aria-label="Shipping to the UK">
      <button className={styles.close} onClick={dismiss} aria-label="Dismiss">✕</button>
      <p className={styles.heading}>{UK_SHIPPING.cardHeading}</p>
      <p className={styles.body}>{UK_SHIPPING.cardBody}</p>
      <button className={styles.cta} onClick={dismiss}>Continue shopping</button>
    </div>
  );
}

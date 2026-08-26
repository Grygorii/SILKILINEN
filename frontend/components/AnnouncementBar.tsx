'use client';

import { useState, useEffect } from 'react';
import { sanitizeBannerHtml } from '@/lib/sanitizeInline';
import { UK_SHIPPING, useUkShipping } from '@/lib/ukShipping';
import styles from './AnnouncementBar.module.css';

// Shown first in the rotation for UK (GB) visitors — the Etsy campaign angle.
// The line itself lives in lib/ukShipping.ts, which owns every wording of this
// claim; this file used to hold a fourth copy of it.

const INTERVAL = 5000;

// This component no longer carries any copy of its own — it rotates what it is
// given. Fallback copy lives in lib/bannerMessages (the one owner), so a default
// can't quietly stand in for the CMS and contradict it, which is exactly how a
// removed "free shipping over €150" line kept reappearing on slow requests.
export default function AnnouncementBar({ messages }: { messages: string[] }) {
  const showUk = useUkShipping();
  const base = messages;
  // UK visitors see the no-customs line first, then the usual rotation.
  const msgs = showUk ? [UK_SHIPPING.banner, ...base] : base;
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // When geo resolves to GB, jump to the UK line so it's seen straight away.
  useEffect(() => { if (showUk) setIndex(0); }, [showUk]);

  useEffect(() => {
    if (msgs.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % msgs.length);
        setVisible(true);
      }, 400);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [msgs.length]);

  // Admin-authored banner copy — strict inline-only allowlist (keeps the
  // sanitize-html parser out of this client bundle). Only b/strong/i/em/u/br
  // survive, with all attributes stripped.
  const safeHtml = sanitizeBannerHtml(msgs[index]);

  return (
    <div className={styles.bar}>
      <p
        className={`${styles.message} ${visible ? styles.visible : styles.hidden}`}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </div>
  );
}

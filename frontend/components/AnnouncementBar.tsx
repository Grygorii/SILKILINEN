'use client';

import { useState, useEffect } from 'react';
import { sanitizeBannerHtml } from '@/lib/sanitizeInline';
import { useIsUK } from '@/lib/useIsUK';
import styles from './AnnouncementBar.module.css';

// Shown first in the rotation for UK (GB) visitors — the Etsy campaign angle.
const UK_MESSAGE = 'UK orders ship from within the UK — <strong>no customs or duties</strong>';

// Quiet-luxury restraint: the Atelier flagged "free shipping over €150" as a
// promotional/discount line that reads cheap at the very top, and the founder
// removed it. These fallbacks (shown only when no CMS banner messages are set)
// now lead with brand heritage, not a shipping promo.
const DEFAULT_MESSAGES = [
  'An Irish silk & linen brand, based in Donegal',
  'New to Silkilinen? Use code <strong>SILK10</strong> for 10% off',
];

const INTERVAL = 5000;

export default function AnnouncementBar({ messages }: { messages?: string[] }) {
  const isUK = useIsUK();
  const base = messages && messages.length > 0 ? messages : DEFAULT_MESSAGES;
  // UK visitors see the no-customs line first, then the usual rotation.
  const msgs = isUK ? [UK_MESSAGE, ...base] : base;
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // When geo resolves to GB, jump to the UK line so it's seen straight away.
  useEffect(() => { if (isUK) setIndex(0); }, [isUK]);

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

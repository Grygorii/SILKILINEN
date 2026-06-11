'use client';

import { useState, useEffect } from 'react';
import { sanitizeBannerHtml } from '@/lib/sanitizeInline';
import styles from './AnnouncementBar.module.css';

// OvH-style restraint pass — dropped the OEKO-TEX certification line
// because reading like a trust-badge undercuts the luxury voice. Kept the
// two functional lines (shipping + promo) and the brand heritage line
// (Donegal heritage = aspirational, not defensive).
const DEFAULT_MESSAGES = [
  'Free worldwide shipping on orders over <strong>€150</strong>',
  'New to Silkilinen? Use code <strong>SILK10</strong> for 10% off',
  'An Irish silk & linen brand, based in Donegal',
];

const INTERVAL = 5000;

export default function AnnouncementBar({ messages }: { messages?: string[] }) {
  const msgs = messages && messages.length > 0 ? messages : DEFAULT_MESSAGES;
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

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

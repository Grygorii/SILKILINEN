'use client';

import { useState, useEffect } from 'react';
import { sanitizeArticleHtml } from '@/lib/sanitize';
import styles from './AnnouncementBar.module.css';

// OvH-style restraint pass — dropped the OEKO-TEX certification line
// because reading like a trust-badge undercuts the luxury voice. Kept the
// two functional lines (shipping + promo) and the brand heritage line
// (Donegal heritage = aspirational, not defensive).
const DEFAULT_MESSAGES = [
  'Free shipping on orders over <strong>€150</strong> to Ireland 🇮🇪',
  'New to Silkilinen? Use code <strong>SILK10</strong> for 10% off',
  'Made by hand in Donegal — silk and linen, in small batches',
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

  // Admin-authored banner copy — strip script shells + handlers via the
  // shared regex sanitizer. Allowed inline tags (strong/em/b/i/br) pass
  // through untouched since they're not in the strip list.
  const safeHtml = sanitizeArticleHtml(msgs[index]);

  return (
    <div className={styles.bar}>
      <p
        className={`${styles.message} ${visible ? styles.visible : styles.hidden}`}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </div>
  );
}

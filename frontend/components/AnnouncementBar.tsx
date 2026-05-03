'use client';

import { useState, useEffect } from 'react';
import styles from './AnnouncementBar.module.css';

const DEFAULT_MESSAGES = [
  'Free shipping on orders over <strong>€150</strong> to Ireland 🇮🇪',
  'New to Silkilinen? Use code <strong>SILK10</strong> for 10% off',
  'All silk is <strong>OEKO-TEX certified</strong> — gentle on skin',
  'Handmade in Dublin with love',
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

  return (
    <div className={styles.bar}>
      <p
        className={`${styles.message} ${visible ? styles.visible : styles.hidden}`}
        dangerouslySetInnerHTML={{ __html: msgs[index] }}
      />
    </div>
  );
}

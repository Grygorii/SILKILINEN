'use client';

import { useState, useEffect } from 'react';
import styles from './AnnouncementBar.module.css';

const MESSAGES = [
  <>New to Silkilinen? Enjoy <strong>10% off</strong> your first order — use code <strong>SILK10</strong></>,
  <>Free shipping on orders over <strong>€150</strong> to Ireland 🇮🇪</>,
  <>All silk is <strong>OEKO-TEX certified</strong> — gentle on skin</>,
  <>Handmade in Dublin with love</>,
];

const INTERVAL = 5000;

export default function AnnouncementBar() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % MESSAGES.length);
        setVisible(true);
      }, 400);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.bar}>
      <p className={`${styles.message} ${visible ? styles.visible : styles.hidden}`}>
        {MESSAGES[index]}
      </p>
    </div>
  );
}

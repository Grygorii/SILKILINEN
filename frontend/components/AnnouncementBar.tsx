'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './AnnouncementBar.module.css';

const DEFAULT_MESSAGES = [
  'Free shipping on orders over <strong>€150</strong> to Ireland 🇮🇪',
  'New to Silkilinen? Use code <strong>SILK10</strong> for 10% off',
  'All silk is <strong>OEKO-TEX certified</strong> — gentle on skin',
  'Made by hand in Donegal — silk and linen, in small batches',
];

const INTERVAL = 5000;

export default function AnnouncementBar({ messages }: { messages?: string[] }) {
  const msgs = messages && messages.length > 0 ? messages : DEFAULT_MESSAGES;
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [scrollHidden, setScrollHidden] = useState(false);
  const lastScrollY = useRef(0);

  // Rotate messages
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

  // Hide on scroll-down, show on scroll-up (mobile only via CSS)
  useEffect(() => {
    function onScroll() {
      const currentY = window.scrollY;
      const scrollingDown = currentY > lastScrollY.current;
      // Only hide after scrolling past the bar itself
      if (scrollingDown && currentY > 38) {
        setScrollHidden(true);
      } else if (!scrollingDown) {
        setScrollHidden(false);
      }
      lastScrollY.current = currentY;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`${styles.bar} ${scrollHidden ? styles.barHidden : ''}`}>
      <p
        className={`${styles.message} ${visible ? styles.visible : styles.hidden}`}
        dangerouslySetInnerHTML={{ __html: msgs[index] }}
      />
    </div>
  );
}

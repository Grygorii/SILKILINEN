'use client';

import { useRef, useEffect } from 'react';
import AnnouncementBar from './AnnouncementBar';
import Navbar from './Navbar';
import styles from './SiteHeader.module.css';

// `messages` is null when the CMS couldn't be reached — the bar is then omitted
// entirely rather than filled with hardcoded copy (see lib/bannerMessages).
export default function SiteHeader({ messages }: { messages?: string[] | null }) {
  const blockRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const currentY = window.scrollY;
      const scrollingDown = currentY > lastScrollY.current;
      const pastThreshold = currentY > 60;
      if (blockRef.current) {
        blockRef.current.dataset.scrolledDown = String(scrollingDown && pastThreshold);
      }
      lastScrollY.current = currentY;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div ref={blockRef} className={styles.block} data-scrolled-down="false">
      {messages && messages.length > 0 && <AnnouncementBar messages={messages} />}
      <Navbar />
    </div>
  );
}

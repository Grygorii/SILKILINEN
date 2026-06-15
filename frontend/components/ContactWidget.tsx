'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import styles from './ContactWidget.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;
const BLOCKED_PATHS = ['/admin', '/checkout'];

type Social = { key: string; url: string };

// Derive a "@handle" from a profile URL's last path segment.
function handleFromUrl(url: string): string {
  try {
    const seg = new URL(url).pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop();
    return seg ? `@${seg}` : 'Instagram';
  } catch {
    return 'Instagram';
  }
}

export default function ContactWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Instagram comes from the same social API the footer uses, so it can't drift
  // from the real link. Falls back to the known handle if the API is unreachable.
  const [instagram, setInstagram] = useState({ url: 'https://instagram.com/silkilinen', sub: '@silkilinen' });

  useEffect(() => {
    let active = true;
    fetch(`${API}/api/social/platforms`)
      .then(r => (r.ok ? r.json() : []))
      .then((list: Social[]) => {
        if (!active || !Array.isArray(list)) return;
        const ig = list.find(p => p.key === 'instagram' && p.url);
        if (ig) setInstagram({ url: ig.url, sub: handleFromUrl(ig.url) });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const CHANNELS = [
    {
      id: 'email',
      label: 'Email us',
      sub: 'hello@silkilinen.com',
      icon: '✉',
      href: 'mailto:hello@silkilinen.com?subject=Hello%20SILKILINEN',
    },
    {
      id: 'instagram',
      label: 'Instagram',
      sub: instagram.sub,
      icon: '◇',
      href: instagram.url,
    },
  ];

  if (BLOCKED_PATHS.some(p => pathname.startsWith(p))) return null;

  const isProductPage = pathname.startsWith('/product/');

  return (
    <div className={`${styles.root} ${isProductPage ? styles.rootAboveBar : ''}`}>
      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Get in touch</span>
              <button className={styles.panelClose} onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <p className={styles.panelSub}>Choose how you&apos;d like to reach us — we&apos;re happy to help.</p>
            <div className={styles.channels}>
              {CHANNELS.map(ch => (
                <a key={ch.id} href={ch.href} target="_blank" rel="noopener noreferrer" className={styles.channel}>
                  <span className={styles.channelIcon}>{ch.icon}</span>
                  <span className={styles.channelText}>
                    <span className={styles.channelLabel}>{ch.label}</span>
                    <span className={styles.channelSub}>{ch.sub}</span>
                  </span>
                  <span className={styles.channelArrow}>→</span>
                </a>
              ))}
            </div>
            <p className={styles.responseTime}>
              Response time: usually within 24 hours
            </p>
          </div>
        </>
      )}
      <button
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Close contact panel' : 'Contact us'}
      >
        {open ? '✕' : <MessageCircle size={20} strokeWidth={1.5} />}
      </button>
    </div>
  );
}

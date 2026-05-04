'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import styles from './ContactWidget.module.css';

const BLOCKED_PATHS = ['/admin', '/checkout'];

const CHANNELS = [
  {
    id: 'email',
    label: 'Email us',
    sub: 'hello@silkilinen.com',
    icon: '✉',
    href: 'mailto:hello@silkilinen.com?subject=Hello%20SILKILINEN',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    sub: 'Typically replies within the hour',
    icon: 'W',
    href: 'https://wa.me/353000000000?text=Hi%20SILKILINEN%2C%20I%20have%20a%20question%20about%20your%20products.',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    sub: '@silkilinen',
    icon: 'T',
    href: 'https://t.me/silkilinen',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    sub: '@silkilinen',
    icon: '◇',
    href: 'https://instagram.com/silkilinen',
  },
];

export default function ContactWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (BLOCKED_PATHS.some(p => pathname.startsWith(p))) return null;

  return (
    <div className={styles.root}>
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
          </div>
        </>
      )}
      <button
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Close contact panel' : 'Contact us'}
      >
        {open ? '✕' : '?'}
      </button>
    </div>
  );
}

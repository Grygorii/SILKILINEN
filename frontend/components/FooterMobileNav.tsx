'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCookieConsent } from '@/context/CookieConsentContext';
import styles from './Footer.module.css';

const SECTIONS = [
  {
    id: 'shop',
    title: 'SHOP',
    links: [
      { label: 'New arrivals', href: '/shop' },
      { label: 'All products', href: '/shop' },
      { label: 'Robes', href: '/shop?category=robes' },
      { label: 'Pyjamas', href: '/shop?category=pyjamas' },
      { label: 'Sleepwear', href: '/shop?category=sleep-dresses' },
    ],
  },
  {
    id: 'info',
    title: 'INFO',
    links: [
      { label: 'About us', href: '/about' },
      { label: 'Reviews', href: '/reviews' },
      { label: 'Shipping', href: '/shipping' },
      { label: 'Size guide', href: '/size-guide' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    id: 'legal',
    title: 'LEGAL',
    links: [
      { label: 'Privacy policy', href: '/privacy-policy' },
      { label: 'Terms & conditions', href: '/terms' },
      { label: 'Returns & refunds', href: '/returns' },
    ],
    hasCookieLink: true,
  },
] as const;

function CookieAccordionItem() {
  const { openBanner } = useCookieConsent();
  return (
    <button onClick={openBanner} className={styles.mobileNavLink}>
      Cookie preferences
    </button>
  );
}

export default function FooterMobileNav() {
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={styles.mobileNav}>
      {SECTIONS.map(section => {
        const isOpen = open.has(section.id);
        return (
          <div key={section.id} className={styles.accordionSection}>
            <button
              className={styles.accordionTrigger}
              onClick={() => toggle(section.id)}
              aria-expanded={isOpen}
              aria-controls={`footer-${section.id}`}
            >
              <span>{section.title}</span>
              <ChevronDown
                size={14}
                strokeWidth={1.5}
                className={`${styles.accordionCaret} ${isOpen ? styles.accordionCaretOpen : ''}`}
              />
            </button>
            <div
              id={`footer-${section.id}`}
              className={`${styles.accordionContent} ${isOpen ? styles.accordionContentOpen : ''}`}
            >
              <div className={styles.accordionInner}>
                {section.links.map(link => (
                  <a key={link.label} href={link.href} className={styles.mobileNavLink}>
                    {link.label}
                  </a>
                ))}
                {'hasCookieLink' in section && section.hasCookieLink && (
                  <CookieAccordionItem />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

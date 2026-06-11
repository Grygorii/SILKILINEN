'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCookieConsent } from '@/context/CookieConsentContext';
import styles from './Footer.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Section = { id: string; title: string; links: { label: string; href: string }[]; hasCookieLink?: boolean };

const INFO_LINKS = [
  { label: 'About us', href: '/about' },
  { label: 'Reviews', href: '/reviews' },
  { label: 'Shipping', href: '/shipping' },
  { label: 'Size guide', href: '/size-guide' },
  { label: 'Contact', href: '/contact' },
];

const LEGAL_LINKS = [
  { label: 'Privacy policy', href: '/privacy-policy' },
  { label: 'Terms & conditions', href: '/terms' },
  { label: 'Returns & refunds', href: '/returns' },
];

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
  const [cats, setCats] = useState<{ slug: string; label: string }[]>([]);

  useEffect(() => {
    fetch(`${API}/api/categories`)
      .then(r => (r.ok ? r.json() : []))
      .then((data: { slug: string; label: string; count: number }[]) => {
        setCats((Array.isArray(data) ? data : []).filter(c => c.count > 0).slice(0, 6).map(c => ({ slug: c.slug, label: c.label })));
      })
      .catch(() => {});
  }, []);

  // Shop links track the live categories; INFO/LEGAL are static pages.
  const SECTIONS: Section[] = [
    {
      id: 'shop',
      title: 'SHOP',
      links: [
        { label: 'New arrivals', href: '/shop?new=true' },
        { label: 'All products', href: '/shop' },
        ...cats.map(c => ({ label: c.label, href: `/shop?category=${c.slug}` })),
      ],
    },
    { id: 'info', title: 'INFO', links: INFO_LINKS },
    { id: 'legal', title: 'LEGAL', links: LEGAL_LINKS, hasCookieLink: true },
  ];

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

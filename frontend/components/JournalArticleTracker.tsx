'use client';

import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { trackClientEvent, trackVisit } from '@/lib/track';

function linkEvent(href: string): 'journal_product_click' | 'journal_shop_click' | 'journal_article_link_click' | 'journal_outbound_link_click' | null {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;

  try {
    const url = new URL(href, window.location.href);
    if (url.pathname.startsWith('/product/')) return 'journal_product_click';
    if (url.pathname === '/shop' || url.pathname.startsWith('/shop/') || url.pathname.startsWith('/collections/')) return 'journal_shop_click';
    return url.origin === window.location.origin ? 'journal_article_link_click' : 'journal_outbound_link_click';
  } catch {
    return null;
  }
}

// Keeps the Journal's reading signals in the existing first-party analytics
// stream. Consent and owner exclusion remain centrally enforced by lib/track.
export default function JournalArticleTracker({ slug, children }: { slug: string; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const page = `/journal/${slug}`;

  useEffect(() => {
    trackVisit({ page });

    let read50 = false;
    let completed = false;
    let frame: number | null = null;

    function recordProgress() {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const seen = Math.min(rect.height, Math.max(0, window.innerHeight - rect.top));
      const depth = rect.height ? seen / rect.height : 0;

      if (!read50 && depth >= 0.5) {
        read50 = true;
        trackClientEvent('journal_read_50', { article: slug });
      }
      if (!completed && depth >= 0.9) {
        completed = true;
        trackClientEvent('journal_read_complete', { article: slug });
      }
    }

    function queueProgress() {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        recordProgress();
      });
    }

    let hasScrolled = false;
    function onScroll() {
      hasScrolled = true;
      queueProgress();
    }
    function onResize() {
      if (hasScrolled) queueProgress();
    }

    // Do not call recordProgress on mount: a short article can fit inside a
    // viewport before anyone has engaged with it. These are honest scroll-depth
    // signals, not a claim that someone definitely finished reading.
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [page, slug]);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[href]');
    // Components that declare data-track (the shopping edit and product cards)
    // already supply their richer event, so never count their click twice.
    if (!anchor || anchor.closest('[data-track]')) return;

    const href = anchor.getAttribute('href') || '';
    const type = linkEvent(href);
    if (!type) return;
    trackClientEvent(type, { article: slug, href });
  }

  return <div ref={rootRef} data-journal-article={slug} onClick={handleClick}>{children}</div>;
}

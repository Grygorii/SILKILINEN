'use client';

import { useEffect } from 'react';
import { trackClientEvent } from '@/lib/track';

/**
 * One delegated, capture-phase click listener for the whole storefront. Any
 * element marked `data-track="<event>"` (plus optional `data-track-*` props)
 * is recorded to the first-party event stream when clicked — no per-component
 * wiring, no third-party script. Capture phase means it still fires even when a
 * handler calls stopPropagation (e.g. the wishlist heart), and sendBeacon (in
 * trackClientEvent) means it survives the navigation a link click triggers.
 *
 * Mount once, globally. trackClientEvent already ignores /admin.
 */
export default function EventTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const start = e.target as Element | null;
      const el = start && 'closest' in start ? start.closest('[data-track]') : null;
      if (!el) return;
      const type = el.getAttribute('data-track');
      if (!type) return;
      const props: Record<string, string> = {};
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('data-track-')) {
          props[attr.name.slice('data-track-'.length)] = attr.value;
        }
      }
      trackClientEvent(type, props);
    }
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  return null;
}

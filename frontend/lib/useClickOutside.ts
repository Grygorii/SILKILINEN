'use client';

import { useEffect, useRef } from 'react';

/**
 * Closes a popover/dropdown when the user clicks anywhere outside it (or
 * presses Escape). Attach the returned ref to the popover's wrapper element;
 * `onClose` fires only while `active` is true, so the listener costs nothing
 * when the popover is closed.
 */
export function useClickOutside<T extends HTMLElement>(active: boolean, onClose: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    // mousedown (not click) so the popover closes before any other element
    // swallows the event; touchstart covers mobile.
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [active, onClose]);

  return ref;
}

'use client';

import { useState, useEffect } from 'react';

// When a floating utility is allowed to appear.
//
// The first screen of a site is the one thing a visitor did not ask for and
// cannot skip: a photograph, a sentence, and one button. Anything else parked
// on top of it is competing with the only pitch the brand gets. On the homepage
// there were two — the chat bubble bottom-left and the Google Customer Reviews
// badge bottom-right — bracketing "Shop the collection" before anyone had
// decided whether they were interested.
//
// Neither is wrong to exist. Both are wrong to open with. So they wait for one
// of two signals that the visitor is actually engaged:
//
//   SCROLL  — she has moved past the first screen. The real signal: someone who
//             scrolls has decided to look, and support or reassurance is now
//             help rather than interruption.
//   TIME    — a fallback, because someone who reads the hero for half a minute
//             without scrolling may be stuck, and that is exactly when a way to
//             ask a question earns its place.
//
// Whichever comes first, and once revealed it stays revealed — a utility that
// flickered away on scroll-up would be worse than one that never appeared.

export function useDeferredReveal({
  /** Fraction of the viewport height to scroll before revealing. */
  scrollRatio = 0.6,
  delayMs = 20000,
}: { scrollRatio?: number; delayMs?: number } = {}): boolean {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (revealed) return;

    const threshold = () => window.innerHeight * scrollRatio;

    function check() {
      if (window.scrollY > threshold()) setRevealed(true);
    }

    // Someone arriving deep-linked, or returning to a restored scroll position,
    // is already past the first screen — no reason to make them wait.
    check();

    window.addEventListener('scroll', check, { passive: true });
    const timer = setTimeout(() => setRevealed(true), delayMs);
    return () => {
      window.removeEventListener('scroll', check);
      clearTimeout(timer);
    };
  }, [revealed, scrollRatio, delayMs]);

  return revealed;
}

'use client';

import { useEffect, useRef, useState } from 'react';

// The homepage hero VIDEO, loaded LATE on purpose. The hero still image is the
// LCP element; if the video declared preload="auto" it would download the whole
// file in parallel and starve that image, pushing LCP out by seconds on mobile.
// So we render the <video> with NO source until the page's `load` event has
// fired (the LCP image has already painted), then attach the source and play.
// Skipped entirely for prefers-reduced-motion (the CSS also hides it).
export default function HeroVideo({ src, poster, className }: { src: string; poster?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = () => setReady(true);
    if (document.readyState === 'complete') {
      const ric = window.requestIdleCallback || ((cb: () => void) => window.setTimeout(cb, 200));
      const id = ric(start);
      return () => (window.cancelIdleCallback || window.clearTimeout)(id as number);
    }
    window.addEventListener('load', start, { once: true });
    return () => window.removeEventListener('load', start);
  }, []);

  useEffect(() => {
    if (ready && ref.current) {
      ref.current.load();
      ref.current.play().catch(() => { /* autoplay can be refused — the poster stays */ });
    }
  }, [ready]);

  return (
    <video ref={ref} className={className} autoPlay muted loop playsInline preload="none" poster={poster}>
      {ready && <source src={src} />}
    </video>
  );
}

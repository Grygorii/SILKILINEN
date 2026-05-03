'use client';

import { useState, useEffect } from 'react';

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const BREAKPOINTS: { name: Breakpoint; minWidth: number }[] = [
  { name: '2xl', minWidth: 1536 },
  { name: 'xl',  minWidth: 1280 },
  { name: 'lg',  minWidth: 1024 },
  { name: 'md',  minWidth: 768  },
  { name: 'sm',  minWidth: 640  },
  { name: 'xs',  minWidth: 0    },
];

function getBreakpoint(width: number): Breakpoint {
  return BREAKPOINTS.find(bp => width >= bp.minWidth)?.name ?? 'xs';
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>('lg'); // SSR-safe default

  useEffect(() => {
    function update() {
      setBp(getBreakpoint(window.innerWidth));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return bp;
}

// Helpers
export function useIsMobile(): boolean {
  const bp = useBreakpoint();
  return bp === 'xs' || bp === 'sm';
}

export function useIsTablet(): boolean {
  const bp = useBreakpoint();
  return bp === 'md';
}

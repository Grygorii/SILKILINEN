const SESSION_KEY = 'silkilinen_sid';

export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getUtm(search: string) {
  const p = new URLSearchParams(search);
  return {
    source:   p.get('utm_source')   || undefined,
    medium:   p.get('utm_medium')   || undefined,
    campaign: p.get('utm_campaign') || undefined,
    term:     p.get('utm_term')     || undefined,
    content:  p.get('utm_content')  || undefined,
  };
}

function getSource(search: string, referrer: string | null): string {
  const utmSource = new URLSearchParams(search).get('utm_source');
  if (utmSource) return utmSource.toLowerCase();
  if (referrer) {
    const r = referrer.toLowerCase();
    if (r.includes('instagram.com'))                         return 'instagram';
    if (r.includes('facebook.com') || r.includes('fb.com')) return 'facebook';
    if (r.includes('pinterest.com'))                         return 'pinterest';
    if (r.includes('tiktok.com'))                            return 'tiktok';
    if (r.includes('google.com'))                            return 'google';
    if (r.includes('twitter.com') || r.includes('t.co') || r.includes('x.com')) return 'twitter';
    if (r.includes('silkilinen.com'))                        return 'direct';
    return 'referral';
  }
  return 'direct';
}

function detectDevice(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua))                                           return 'tablet';
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua))           return 'mobile';
  return 'desktop';
}

export function trackVisit({ page, productId }: { page: string; productId?: string }) {
  try {
    if (typeof window === 'undefined') return;
    if (window.location.pathname.startsWith('/admin')) return;

    const sessionId = getSessionId();
    const referrer  = document.referrer || null;
    const search    = window.location.search;

    // POST to the Vercel Next.js proxy at /api/track/visit (NOT directly
    // to the Railway backend). The proxy reads Vercel's geo headers
    // (x-vercel-ip-country / x-vercel-ip-city / x-vercel-ip-country-region)
    // and forwards them to the backend in the body — free + instant geo
    // resolution that doesn't depend on the backend's flaky ipapi.co
    // lookup. See frontend/app/api/track/visit/route.ts.
    fetch(`/api/track/visit`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        page,
        productId: productId || undefined,
        source:    getSource(search, referrer),
        utm:       getUtm(search),
        referrer,
        device:    detectDevice(),
      }),
    });
    // Not awaited — fire and forget. Tracking never blocks the customer experience.
  } catch {
    // Silent. Tracking failure is invisible to the customer.
  }
}

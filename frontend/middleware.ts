import { NextRequest, NextResponse } from 'next/server';

// Locale routing. IMPORTANT: the matcher below scopes this middleware to ONLY
// the four locale-prefixed paths (/de, /fr, /it, /es) — the English site never
// invokes it, so current traffic is completely untouched. For a localized URL
// like /de/shop it rewrites to /shop (so the existing routes render) and passes
// the locale to the server via an `x-locale` request header (read by getLocale
// in lib/i18n.ts). Static assets, /_next and /api never start with a locale, so
// they never match.
const LOCALES = ['de', 'fr', 'it', 'es'];

export function middleware(req: NextRequest) {
  const seg = req.nextUrl.pathname.split('/')[1];
  if (!LOCALES.includes(seg)) return NextResponse.next(); // belt-and-suspenders

  const rest = req.nextUrl.pathname.slice(seg.length + 1) || '/';
  const url = req.nextUrl.clone();
  url.pathname = rest;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-locale', seg);
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/(de|fr|it|es)/:path*'],
};

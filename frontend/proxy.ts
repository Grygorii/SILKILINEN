import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next 16 renamed `middleware.ts` → `proxy.ts`. This one file handles BOTH:
//   1. Locale routing for the storefront (/de, /fr, /it, /es), and
//   2. Admin auth gating (/admin/*).
// A real JWT is three base64url segments separated by dots.
const JWT_FORMAT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const LOCALES = ['de', 'fr', 'it', 'es'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const seg = pathname.split('/')[1];

  // 1. Locale routing: rewrite /de/shop → /shop and pass the locale to the app
  //    via an x-locale request header (read by getLocale in lib/i18n-server.ts).
  //    English is unprefixed and never matches, so it's untouched.
  if (LOCALES.includes(seg)) {
    const rest = pathname.slice(seg.length + 1) || '/';
    const url = request.nextUrl.clone();
    url.pathname = rest;
    const headers = new Headers(request.headers);
    headers.set('x-locale', seg);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // 2. Admin auth gate — everything under /admin except the login page.
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = request.cookies.get('token')?.value;
    if (!token || !JWT_FORMAT.test(token)) {
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/(de|fr|it|es)/:path*'],
};

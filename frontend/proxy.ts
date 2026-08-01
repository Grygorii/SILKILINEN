import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next 16 renamed `middleware.ts` → `proxy.ts`. This one file handles BOTH:
//   1. Locale routing for the storefront (/de, /fr, /it, /es), and
//   2. Admin auth gating (/admin/*).
// A real JWT is three base64url segments separated by dots.
const JWT_FORMAT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const LOCALES = ['de', 'fr', 'it', 'es'];
const LOCALE_COOKIE = 'slk_locale';

// Paths that must NEVER be locale-redirected. Checkout/account/success are
// money- and session-critical (a redirect mid-flow risks losing state or a
// Stripe return), admin is English-only, and api/_next/assets aren't pages.
const NO_LOCALE_REDIRECT = [
  '/checkout', '/success', '/cancel', '/account', '/wishlist',
  '/admin', '/api', '/_next', '/preview',
];

// Only redirect real storefront page navigations — never assets or the
// excluded flows above.
function isStorefrontPage(pathname: string): boolean {
  if (NO_LOCALE_REDIRECT.some(p => pathname === p || pathname.startsWith(p + '/'))) return false;
  // Anything with a file extension (.ico, .png, .xml, .txt…) is an asset.
  if (/\.[a-z0-9]+$/i.test(pathname)) return false;
  return true;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const seg = pathname.split('/')[1];

  // 1. Locale routing: rewrite /de/shop → /shop and pass the locale to the app
  //    via an x-locale request header (read by getLocale in lib/i18n-server.ts).
  //    English is unprefixed and never matches, so it's untouched.
  //    Also remember the choice in a cookie so the visitor STAYS in their
  //    language when they click an internal (unprefixed) link — see 1b.
  if (LOCALES.includes(seg)) {
    const rest = pathname.slice(seg.length + 1) || '/';
    const url = request.nextUrl.clone();
    url.pathname = rest;
    const headers = new Headers(request.headers);
    headers.set('x-locale', seg);
    const res = NextResponse.rewrite(url, { request: { headers } });
    if (request.cookies.get(LOCALE_COOKIE)?.value !== seg) {
      res.cookies.set(LOCALE_COOKIE, seg, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    }
    return res;
  }

  // 1b. Locale persistence: someone browsing in German clicks a normal
  //     (unprefixed) internal link — send them to the same page in their
  //     language. Only for real page navigations, and only when a locale
  //     cookie exists, so first-time/English visitors and crawlers (no
  //     cookies) always get the plain English URL. Choosing English in the
  //     switcher writes 'en', which opts out here.
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (saved && LOCALES.includes(saved) && isStorefrontPage(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${saved}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
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
  // Everything except Next internals, the API, and files with an extension.
  // The handler itself decides what to do; storefront pages only get touched
  // when a locale cookie is present (see isStorefrontPage + 1b).
  matcher: ['/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)'],
};

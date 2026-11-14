import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from '../proxy';

describe('storefront locale routing', () => {
  it('saves the language when a shopper opens a translated page directly', () => {
    const response = proxy(new NextRequest('https://www.silkilinen.com/fr/shop?new=true', {
      headers: { 'sec-fetch-mode': 'navigate', cookie: 'slk_locale=en' },
    }));

    expect(response.headers.get('x-middleware-rewrite')).toBe('https://www.silkilinen.com/shop?new=true');
    expect(response.headers.get('x-middleware-request-x-locale')).toBe('fr');
    expect(response.cookies.get('slk_locale')?.value).toBe('fr');
  });

  it.each([
    { 'sec-fetch-mode': 'cors' },
    { 'sec-fetch-mode': 'navigate', 'sec-purpose': 'prefetch;prerender' },
  ])('serves translated content without changing the saved language for %j', headers => {
    const response = proxy(new NextRequest('https://www.silkilinen.com/fr/journal', {
      headers: { ...headers, cookie: 'slk_locale=en' },
    }));

    expect(response.headers.get('x-middleware-request-x-locale')).toBe('fr');
    expect(response.cookies.get('slk_locale')).toBeUndefined();
  });

  it('preserves the query when a saved language redirects an unprefixed shop link', () => {
    const response = proxy(new NextRequest('https://www.silkilinen.com/shop?new=true', {
      headers: { 'sec-fetch-mode': 'navigate', cookie: 'slk_locale=es' },
    }));

    expect(response.headers.get('location')).toBe('https://www.silkilinen.com/es/shop?new=true');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  allowsAnalytics,
  ANALYTICS_SESSION_STORAGE_KEY,
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_PREFERENCES_STORAGE_KEY,
  clearAnalyticsPersistence,
  hasAnalyticsConsent,
} from '@/lib/analyticsConsent';
import { checkoutAnalytics } from '@/lib/checkoutAttribution';
import { getSessionId, trackClientEvent, trackVisit } from '@/lib/track';
import { trackEvent } from '@/lib/analytics';

type MemoryStorage = {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
};

function storage(values: Record<string, string> = {}): MemoryStorage {
  const data = new Map(Object.entries(values));
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    removeItem: vi.fn((key: string) => { data.delete(key); }),
  };
}

function reader(values: Record<string, string>): Pick<Storage, 'getItem'> {
  const data = new Map(Object.entries(values));
  return { getItem: (key: string) => data.get(key) ?? null };
}

function customisedWithoutAnalytics(): { localStorage: MemoryStorage; sessionStorage: MemoryStorage } {
  const localStorage = storage({
    [COOKIE_CONSENT_STORAGE_KEY]: 'customised',
    [COOKIE_PREFERENCES_STORAGE_KEY]: JSON.stringify({ analytics: false }),
    [ANALYTICS_SESSION_STORAGE_KEY]: 'old-browser-id',
  });
  const sessionStorage = storage({ attr_source: 'google' });
  vi.stubGlobal('window', { localStorage, sessionStorage });
  return { localStorage, sessionStorage };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('analytics consent', () => {
  it('accepts only accept-all or an explicit analytics preference', () => {
    expect(allowsAnalytics('accepted')).toBe(true);
    expect(allowsAnalytics('customised', { analytics: true })).toBe(true);
    expect(allowsAnalytics('customised', { analytics: false })).toBe(false);
    expect(allowsAnalytics('customised', {})).toBe(false);
    expect(allowsAnalytics('rejected')).toBe(false);
    expect(allowsAnalytics(null)).toBe(false);
  });

  it('does not treat malformed or incomplete customised preferences as consent', () => {
    expect(hasAnalyticsConsent(reader({
      [COOKIE_CONSENT_STORAGE_KEY]: 'customised',
      [COOKIE_PREFERENCES_STORAGE_KEY]: '{not json}',
    }))).toBe(false);
    expect(hasAnalyticsConsent(reader({
      [COOKIE_CONSENT_STORAGE_KEY]: 'customised',
      [COOKIE_PREFERENCES_STORAGE_KEY]: JSON.stringify({ marketing: true }),
    }))).toBe(false);
  });

  it('does not create or reuse the persistent browser ID without analytics consent', () => {
    const { localStorage } = customisedWithoutAnalytics();

    expect(getSessionId()).toBe('');
    expect(localStorage.getItem).not.toHaveBeenCalledWith(ANALYTICS_SESSION_STORAGE_KEY);
    expect(localStorage.removeItem).toHaveBeenCalledWith(ANALYTICS_SESSION_STORAGE_KEY);
  });

  it('clears browser-level analytics state when consent is withdrawn', () => {
    const localStorage = storage({ [ANALYTICS_SESSION_STORAGE_KEY]: 'old-browser-id' });
    const sessionStorage = storage({ attr_source: 'google', attr_campaign: 'launch' });
    const document = { cookie: '' };
    vi.stubGlobal('window', { localStorage, sessionStorage });
    vi.stubGlobal('document', document);

    clearAnalyticsPersistence();

    expect(localStorage.removeItem).toHaveBeenCalledWith(ANALYTICS_SESSION_STORAGE_KEY);
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('attr_source');
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('attr_campaign');
    expect(document.cookie).toContain(`${ANALYTICS_SESSION_STORAGE_KEY}=;`);
  });

  it('does not send Visit or Event data when analytics was customised off', () => {
    customisedWithoutAnalytics();
    const send = vi.fn();
    vi.stubGlobal('fetch', send);

    trackVisit({ page: 'shop' });
    trackClientEvent('view_item');
    trackEvent('add_to_cart');

    expect(send).not.toHaveBeenCalled();
  });

  it('does not attach browser or acquisition attribution to an order without analytics consent', () => {
    const { localStorage, sessionStorage } = customisedWithoutAnalytics();

    expect(checkoutAnalytics()).toEqual({ attribution: {}, browserSessionId: '' });
    expect(sessionStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalledWith(ANALYTICS_SESSION_STORAGE_KEY);
  });

  it('still creates the reporting identity and attribution after explicit analytics consent', () => {
    const localStorage = storage({ [COOKIE_CONSENT_STORAGE_KEY]: 'accepted' });
    const sessionStorage = storage({ attr_source: 'google', attr_medium: 'organic' });
    vi.stubGlobal('window', { localStorage, sessionStorage });
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('crypto', { randomUUID: () => 'consented-browser-id' });

    expect(checkoutAnalytics()).toEqual({
      attribution: { source: 'google', medium: 'organic' },
      browserSessionId: 'consented-browser-id',
    });
    expect(localStorage.setItem).toHaveBeenCalledWith(ANALYTICS_SESSION_STORAGE_KEY, 'consented-browser-id');
  });

  it('keeps every analytics mount behind the shared consent rule', () => {
    for (const file of [
      'components/AnalyticsLoader.tsx',
      'components/VercelAnalytics.tsx',
      'components/UTMCapture.tsx',
    ]) {
      expect(readFileSync(file, 'utf8')).toContain('allowsAnalytics(consent, preferences)');
    }
  });

  it('clears analytics persistence when the preferences UI saves analytics off', () => {
    const context = readFileSync('context/CookieConsentContext.tsx', 'utf8');
    expect(context).toContain('if (!prefs.analytics) clearAnalyticsPersistence();');
    expect(context).toContain("localStorage.setItem(STORAGE_KEY, 'rejected');\n    clearAnalyticsPersistence();");
  });
});

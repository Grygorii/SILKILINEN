export type CookieConsentValue = 'accepted' | 'rejected' | 'customised' | null;

export type AnalyticsPreferences = {
  analytics?: boolean;
};

export const COOKIE_CONSENT_STORAGE_KEY = 'silkilinen:cookieConsent';
export const COOKIE_PREFERENCES_STORAGE_KEY = 'silkilinen:cookiePrefs';
export const ANALYTICS_SESSION_STORAGE_KEY = 'silkilinen_sid';

const ATTRIBUTION_STORAGE_KEYS = [
  'attr_source',
  'attr_medium',
  'attr_campaign',
  'attr_referrer',
  'attr_landing',
];

export function allowsAnalytics(
  consent: CookieConsentValue,
  preferences?: AnalyticsPreferences | null,
): boolean {
  return consent === 'accepted'
    || (consent === 'customised' && preferences?.analytics === true);
}

export function hasAnalyticsConsent(storage?: Pick<Storage, 'getItem'>): boolean {
  let reader = storage;
  if (!reader) {
    if (typeof window === 'undefined') return false;
    reader = window.localStorage;
  }

  try {
    const consent = reader.getItem(COOKIE_CONSENT_STORAGE_KEY) as CookieConsentValue;
    if (consent === 'accepted') return true;
    if (consent !== 'customised') return false;

    const rawPreferences = reader.getItem(COOKIE_PREFERENCES_STORAGE_KEY);
    if (!rawPreferences) return false;
    return allowsAnalytics(consent, JSON.parse(rawPreferences) as AnalyticsPreferences);
  } catch {
    return false;
  }
}

export function clearAnalyticsPersistence(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(ANALYTICS_SESSION_STORAGE_KEY);
  } catch { /* Storage can be unavailable in privacy-restricted browsers. */ }

  try {
    for (const key of ATTRIBUTION_STORAGE_KEYS) window.sessionStorage.removeItem(key);
  } catch { /* Same: never make a consent choice fail because storage is blocked. */ }

  try {
    document.cookie = `${ANALYTICS_SESSION_STORAGE_KEY}=; path=/; max-age=0; SameSite=Lax`;
  } catch { /* Cookies can be unavailable in privacy-restricted browsers. */ }
}

import { getSessionId } from './track';

type Reader = Pick<Storage, 'getItem'>;
export function readCheckoutAttribution(storage: Reader): Record<string, string> {
  const keys = { source: 'attr_source', medium: 'attr_medium', campaign: 'attr_campaign', referrer: 'attr_referrer', landingPage: 'attr_landing' };
  const result: Record<string, string> = {};
  try {
    for (const [name, key] of Object.entries(keys)) {
      const value = storage.getItem(key);
      if (value) result[name] = value.slice(0, 400);
    }
  } catch { /* Blocked storage must never prevent payment. */ }
  return result;
}

/** Analytics identity is deliberately NOT the server-cart lookup key. */
export function checkoutAnalytics() {
  let attribution: Record<string, string> = {};
  let browserSessionId = '';
  try { attribution = readCheckoutAttribution(window.sessionStorage); } catch { /* storage blocked */ }
  try { browserSessionId = getSessionId(); } catch { /* storage blocked */ }
  return { attribution, browserSessionId };
}

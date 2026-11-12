/** Short-lived, tab-local handoff for Stripe's non-redirect success path.
 * Never log these credentials or send them to analytics. Stripe redirect URLs
 * remain supported; non-redirect payments do not put secrets in the URL.
 */
const KEY = 'silkilinen:pendingConfirmation';
const MAX_AGE = 30 * 60 * 1000;
type Credentials = { paymentIntent: string; clientSecret: string };
type Reader = Pick<Storage, 'getItem' | 'setItem'>;
function valid(c: Credentials): boolean {
  return /^pi_[A-Za-z0-9]+$/.test(c.paymentIntent) && c.clientSecret.startsWith(`${c.paymentIntent}_secret_`) && c.clientSecret.length < 500;
}
export function rememberConfirmation(paymentIntent: string, clientSecret: string, storage?: Reader, now = Date.now()): void {
  try {
    const credentials = { paymentIntent, clientSecret };
    if (valid(credentials)) (storage ?? window.sessionStorage).setItem(KEY, JSON.stringify({ ...credentials, savedAt: now }));
  } catch { /* Optional analytics must never block payment. */ }
}
export function confirmationCredentials(params: Pick<URLSearchParams, 'get'>, storage?: Reader, now = Date.now()): Credentials | null {
  const paymentIntent = params.get('payment_intent');
  const clientSecret = params.get('payment_intent_client_secret');
  if (paymentIntent || clientSecret) {
    const credentials = { paymentIntent: paymentIntent || '', clientSecret: clientSecret || '' };
    return valid(credentials) ? credentials : null;
  }
  try {
    const stored = JSON.parse((storage ?? window.sessionStorage).getItem(KEY) || 'null');
    if (!stored || typeof stored.paymentIntent !== 'string' || typeof stored.clientSecret !== 'string' || typeof stored.savedAt !== 'number') return null;
    const age = now - stored.savedAt;
    return age >= 0 && age < MAX_AGE && valid(stored) ? { paymentIntent: stored.paymentIntent, clientSecret: stored.clientSecret } : null;
  } catch { return null; }
}

/** Use the same secret-gated endpoint for both success-page consumers without URL secrets. */
export function confirmationRequest(api: string, credentials: Credentials): Promise<Response> {
  return fetch(`${api}/api/v2/checkout/confirmation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({ payment_intent: credentials.paymentIntent, client_secret: credentials.clientSecret }),
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
}

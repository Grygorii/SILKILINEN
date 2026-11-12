import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readCheckoutAttribution } from '../lib/checkoutAttribution';
import { rememberConfirmation, confirmationCredentials } from '../lib/purchaseConfirmation';
const source = (file: string) => readFileSync(file, 'utf8');
const memory = () => { const values = new Map<string, string>(); return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k,v); } }; };

describe('checkout reporting without changing payment inputs', () => {
  it('reads the same storage keys written by UTMCapture', () => {
    const store = memory(); store.setItem('attr_source','google'); store.setItem('attr_medium','organic'); store.setItem('attr_landing','/journal/packing');
    expect(readCheckoutAttribution(store)).toEqual({ source:'google', medium:'organic', landingPage:'/journal/packing' });
  });
  it('survives blocked attribution storage', () => {
    expect(readCheckoutAttribution({ getItem: () => { throw Error('blocked'); } })).toEqual({});
  });
  it('bounds attribution values below Stripe metadata limits', () => {
    expect(readCheckoutAttribution({getItem:()=> 'x'.repeat(900)}).source).toHaveLength(400);
  });
  it('separates browsing identity from the server cart selector', () => {
    const checkout = source('app/(shop)/checkout/page.tsx');
    expect(checkout).toContain('browserSessionId,');
    expect(checkout).not.toMatch(/sessionId:\s*getSessionId/);
    expect(checkout).toContain('rememberConfirmation(paymentIntentIdRef.current, clientSecretRef.current)');
  });
});

describe('non-redirect payment confirmation handoff', () => {
  it('recovers confirmation credentials without putting them in a URL', () => {
    const s=memory();rememberConfirmation('pi_demo','pi_demo_secret_demo',s,1000);
    expect(confirmationCredentials(new URLSearchParams(),s,1001)).toEqual({paymentIntent:'pi_demo',clientSecret:'pi_demo_secret_demo'});
  });
  it('expires stale credentials and rejects clock anomalies', () => {
    const s=memory();rememberConfirmation('pi_demo','pi_demo_secret_demo',s,1000);
    expect(confirmationCredentials(new URLSearchParams(),s,1801000)).toBeNull();
    expect(confirmationCredentials(new URLSearchParams(),s,999)).toBeNull();
  });
  it('gives Stripe redirect parameters precedence and rejects mismatches', () => {
    const s=memory();rememberConfirmation('pi_old','pi_old_secret_old',s,1000);
    expect(confirmationCredentials(new URLSearchParams('payment_intent=pi_new&payment_intent_client_secret=pi_new_secret_new'),s,1001)?.paymentIntent).toBe('pi_new');
    expect(confirmationCredentials(new URLSearchParams('payment_intent=pi_new&payment_intent_client_secret=pi_old_secret_old'),s,1001)).toBeNull();
  });
  it('survives unavailable browser storage', () => {
    const s={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')}};
    expect(()=>rememberConfirmation('pi_demo','pi_demo_secret_demo',s)).not.toThrow();
    expect(confirmationCredentials(new URLSearchParams(),s)).toBeNull();
  });
  it('tracks the currency actually charged', () => {
    expect(source('components/PurchaseTracking.tsx')).toContain('json.value, json.currency');
    expect(source('lib/analytics.ts')).toContain("currency: p.currency || 'EUR'");
  });
  it('promotes the product identifier used by product cards', () => {
    expect(source('components/ProductCard.tsx')).toContain('data-track-product=');
    expect(source('components/EventTracker.tsx')).toContain('props.product || props.productId');
  });
  it('mounts visit tracking on journal as well as shop routes', () => {
    expect(source('app/journal/(public)/layout.tsx')).toContain('<RouteTracker />');
    expect(source('app/(shop)/layout.tsx')).toContain('<RouteTracker />');
  });
});

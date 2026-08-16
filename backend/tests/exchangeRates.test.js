import { describe, it, expect, vi, beforeEach } from 'vitest';

// getRates() sits on the money path: /quote and /create-intent both await it.
// The behaviour that matters is what happens when the provider is DOWN, since
// that is when a naive implementation turns every checkout into a 6s wait.
describe('exchange rates under provider failure', () => {
  beforeEach(() => { vi.resetModules(); });

  it('does not re-fetch on every call while the provider is failing', async () => {
    const calls = { n: 0 };
    vi.stubGlobal('fetch', async () => { calls.n++; throw new Error('down'); });
    const { getRates } = await import('../services/exchangeRates.js').then(m => m.default ?? m);

    await getRates();
    const afterFirst = calls.n;
    await getRates();
    await getRates();
    await getRates();

    // One attempt, then backoff — not one per call.
    expect(afterFirst).toBe(1);
    expect(calls.n).toBe(1);
  });

  it('still returns usable rates when the provider is down', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('down'); });
    const { getRates } = await import('../services/exchangeRates.js').then(m => m.default ?? m);
    const rates = await getRates();
    expect(rates.EUR).toBe(1);
    expect(rates.GBP).toBeGreaterThan(0);
    expect(rates.USD).toBeGreaterThan(0);
  });

  it('keeps EUR at exactly 1 so the canonical path is untouched', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true, json: async () => ({ rates: { GBP: 0.9, USD: 1.2 } }),
    }));
    const { getRates, convert } = await import('../services/exchangeRates.js').then(m => m.default ?? m);
    const rates = await getRates();
    expect(rates.EUR).toBe(1);
    const eur = await convert(145, 'EUR');
    expect(eur.amount).toBe(145);
    expect(eur.rate).toBe(1);
  });

  it('rejects a nonsense rate from the provider rather than charging on it', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true, json: async () => ({ rates: { GBP: -5, USD: 'abc' } }),
    }));
    const { getRates } = await import('../services/exchangeRates.js').then(m => m.default ?? m);
    const rates = await getRates();
    expect(rates.GBP).toBeGreaterThan(0);
    expect(Number.isFinite(rates.USD)).toBe(true);
  });
});

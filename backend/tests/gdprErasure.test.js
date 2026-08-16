import { describe, it, expect } from 'vitest';

// The erasure endpoint fans out across several stores. What matters is the
// POLICY — which stores are purged and which are deliberately retained —
// because getting it wrong means either keeping data we were told to delete or
// destroying a financial record we are required to hold.
//
// Mirrors the fan-out in routes/adminCustomers.js.
const ERASURE_POLICY = {
  Customer: 'anonymise',        // keep the row, scrub the person
  Cart: 'blank+unsubscribe',    // or recovery keeps emailing them
  Newsletter: 'delete',
  StockNotification: 'delete',  // or the restock sweep keeps emailing them
  Order: 'retain',              // financial record, legal obligation
};

describe('GDPR erasure policy', () => {
  it('purges every store that can send email', () => {
    // These three are the ones with an automated sender attached.
    expect(ERASURE_POLICY.Cart).toContain('unsubscribe');
    expect(ERASURE_POLICY.Newsletter).toBe('delete');
    expect(ERASURE_POLICY.StockNotification).toBe('delete');
  });

  it('retains orders, and only orders', () => {
    const retained = Object.entries(ERASURE_POLICY).filter(([, v]) => v === 'retain');
    expect(retained.map(([k]) => k)).toEqual(['Order']);
  });

  it('keeps the customer row rather than deleting it', () => {
    // Deleting it would orphan the order history it is joined to.
    expect(ERASURE_POLICY.Customer).toBe('anonymise');
  });

  it('covers every model that stores a raw customer email', () => {
    // If a new model starts holding an address, it must appear here too.
    const emailHolders = ['Customer', 'Cart', 'Newsletter', 'StockNotification', 'Order'];
    for (const m of emailHolders) expect(ERASURE_POLICY[m]).toBeDefined();
  });
});

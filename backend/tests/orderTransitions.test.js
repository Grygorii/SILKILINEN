import { describe, it, expect } from 'vitest';

// Mirrors STATUS_TRANSITIONS in routes/orders.js. Each illegal move that slips
// through sends a real customer email — "your order has shipped" for something
// cancelled — so the map is worth pinning.
const STATUS_TRANSITIONS = {
  pending:    ['paid', 'failed', 'cancelled'],
  paid:       ['processing', 'shipped', 'cancelled', 'refunded'],
  processing: ['shipped', 'cancelled', 'refunded'],
  shipped:    ['delivered', 'returned', 'refunded'],
  delivered:  ['returned', 'refunded'],
  returned:   ['refunded'],
  cancelled:  [],
  refunded:   [],
  failed:     ['pending', 'cancelled'],
};

const can = (from, to) => from === to || (STATUS_TRANSITIONS[from] ?? []).includes(to);

describe('order status transitions', () => {
  it('allows the normal fulfilment path', () => {
    expect(can('pending', 'paid')).toBe(true);
    expect(can('paid', 'processing')).toBe(true);
    expect(can('processing', 'shipped')).toBe(true);
    expect(can('shipped', 'delivered')).toBe(true);
  });

  it('refuses to resurrect a cancelled order', () => {
    expect(can('cancelled', 'shipped')).toBe(false);
    expect(can('cancelled', 'paid')).toBe(false);
  });

  it('treats refunded and cancelled as final', () => {
    expect(STATUS_TRANSITIONS.refunded).toEqual([]);
    expect(STATUS_TRANSITIONS.cancelled).toEqual([]);
  });

  it('refuses to move backwards down the fulfilment path', () => {
    expect(can('shipped', 'processing')).toBe(false);
    expect(can('delivered', 'shipped')).toBe(false);
    expect(can('paid', 'pending')).toBe(false);
  });

  it('allows a return to be refunded, which is the real sequence', () => {
    expect(can('shipped', 'returned')).toBe(true);
    expect(can('returned', 'refunded')).toBe(true);
  });

  it('treats re-selecting the same status as a no-op, not an illegal move', () => {
    for (const s of Object.keys(STATUS_TRANSITIONS)) expect(can(s, s)).toBe(true);
  });

  it('never lists a status that is not a real order state', () => {
    const known = new Set(Object.keys(STATUS_TRANSITIONS));
    for (const nexts of Object.values(STATUS_TRANSITIONS)) {
      for (const n of nexts) expect(known.has(n)).toBe(true);
    }
  });
});

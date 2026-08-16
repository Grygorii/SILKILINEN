import { describe, it, expect } from 'vitest';
import pkg from '../services/funnel.js';
const { detectShifts, MIN_SEGMENT, SHIFT_POINTS } = pkg;

// detectShifts is pure (two arrays in, findings out), so the gates that stop it
// crying wolf can be tested directly — no database needed.
const stage = (key, rate, enteredFrom) => ({
  key, label: key, rate, enteredFrom, count: 0, lost: 0,
  fix: { label: 'x', href: '/x' }, why: '',
});
// Index 0 is the entrance stage and is always skipped.
const withEntrance = rows => [stage('sessions', 100, 999), ...rows];

describe('detectShifts', () => {
  it('reports a material drop', () => {
    const out = detectShifts(
      withEntrance([stage('addedToCart', 20, 100)]),
      withEntrance([stage('addedToCart', 40, 100)]),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: 'addedToCart', delta: -20, direction: 'down' });
  });

  it('ignores movement below the threshold', () => {
    const out = detectShifts(
      withEntrance([stage('addedToCart', 40 - (SHIFT_POINTS - 1), 100)]),
      withEntrance([stage('addedToCart', 40, 100)]),
    );
    expect(out).toEqual([]);
  });

  it('ignores a big swing on a tiny sample', () => {
    // 100% -> 50% is arithmetic on two visitors, not news.
    const out = detectShifts(
      withEntrance([stage('addedToCart', 50, MIN_SEGMENT - 1)]),
      withEntrance([stage('addedToCart', 100, MIN_SEGMENT - 1)]),
    );
    expect(out).toEqual([]);
  });

  it('ignores a swing when only the PREVIOUS window was thin', () => {
    const out = detectShifts(
      withEntrance([stage('addedToCart', 20, 500)]),
      withEntrance([stage('addedToCart', 90, MIN_SEGMENT - 1)]),
    );
    expect(out).toEqual([]);
  });

  it('reports improvements too, worst first', () => {
    const out = detectShifts(
      withEntrance([stage('addedToCart', 60, 100), stage('purchased', 10, 100)]),
      withEntrance([stage('addedToCart', 30, 100), stage('purchased', 45, 100)]),
    );
    expect(out.map(s => s.key)).toEqual(['purchased', 'addedToCart']);
    expect(out[0].direction).toBe('down');
    expect(out[1].direction).toBe('up');
  });

  it('skips stages missing from the previous window', () => {
    expect(detectShifts(withEntrance([stage('startedPayment', 10, 100)]), withEntrance([]))).toEqual([]);
  });
});

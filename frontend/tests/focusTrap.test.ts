import { describe, it, expect } from 'vitest';
import { isKeyboardReachable, type FocusCandidate } from '@/lib/useFocusTrap';

// Nine components render aria-modal="true". Three trapped focus, by three
// hand-rolled copies of the same code; six did not trap it at all. aria-modal
// is a CLAIM that everything outside the dialog is inert — if Tab then walks
// out into the page behind, the attribute has misled the one user who relied
// on it, and a keyboard user ends up typing into a form they cannot see.
//
// The DOM query is a selector string; this is the part that decides, and every
// clause below is a real way to trap focus on something nobody can reach.

const el = (over: Partial<Record<string, unknown>> = {}, attrs: Record<string, string> = {}): FocusCandidate => ({
  hasAttribute: (n: string) => n in attrs,
  getAttribute: (n: string) => (n in attrs ? attrs[n] : null),
  offsetParent: 'parent',
  tagName: 'BUTTON',
  ...over,
});

describe('isKeyboardReachable', () => {
  it('accepts an ordinary visible control', () => {
    expect(isKeyboardReachable(el())).toBe(true);
  });

  it('rejects a disabled control', () => {
    // The browser skips it; a naive `button` selector does not. A dialog whose
    // last control is disabled would trap Tab on an element that cannot focus.
    expect(isKeyboardReachable(el({}, { disabled: '' }))).toBe(false);
  });

  it('rejects anything hidden from assistive technology', () => {
    expect(isKeyboardReachable(el({}, { 'aria-hidden': 'true' }))).toBe(false);
  });

  it('accepts aria-hidden="false", which is not hidden', () => {
    expect(isKeyboardReachable(el({}, { 'aria-hidden': 'false' }))).toBe(true);
  });

  it('rejects tabindex="-1" — focusable by script, not by Tab', () => {
    expect(isKeyboardReachable(el({}, { tabindex: '-1' }))).toBe(false);
  });

  it('accepts a positive or zero tabindex', () => {
    expect(isKeyboardReachable(el({}, { tabindex: '0' }))).toBe(true);
  });

  it('rejects an element with no layout box', () => {
    // offsetParent is null for display:none and everything inside it — a
    // collapsed section would otherwise cycle focus through invisible controls.
    expect(isKeyboardReachable(el({ offsetParent: null }))).toBe(false);
  });

  it('keeps <area>, which is reachable without a layout box of its own', () => {
    expect(isKeyboardReachable(el({ offsetParent: null, tagName: 'AREA' }))).toBe(true);
  });
});

// ── Every dialog that claims modality provides it ─────────────────────────
//
// This is the assertion the unit tests above cannot make. The predicate can be
// perfect and a dialog still ship without using it — which is what had happened
// six times over, quietly, because nothing about a missing focus trap shows up
// on screen. You only find it with a keyboard, and only if you think to try.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sourceFiles } from './helpers/source';

const ROOT = join(__dirname, '..');

// Known exception, named rather than filtered silently: one admin product-page
// dialog is written inline instead of going through components/AdminModal. It
// is behind a login and used by one person. Route it through AdminModal — which
// does trap — and this list goes away.
const EXEMPT = ['app/admin/products/[id]/page.tsx'];

describe('modal dialogs', () => {
  const files = sourceFiles(join(ROOT, 'app'))
    .concat(sourceFiles(join(ROOT, 'components')))
    .map(f => ({ path: f.slice(ROOT.length + 1), src: readFileSync(f, 'utf8') }))
    .filter(f => f.src.includes('aria-modal'));

  it('finds the dialogs to check', () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it('traps focus wherever aria-modal is declared', () => {
    const untrapped = files
      // A CALL, not the identifier: deleting the call leaves the import
      // behind, and a first pass of this test passed on that alone.
      .filter(f => !/useFocusTrap\s*\(/.test(f.src))
      .map(f => f.path)
      .filter(p => !EXEMPT.includes(p));
    expect(untrapped, 'aria-modal claims the page behind is inert; these let Tab walk out of it').toEqual([]);
  });

  it('has no hand-rolled trap left', () => {
    // Three of these existed, byte-identical, and six other dialogs had none.
    // A second implementation is how the two halves drift apart again.
    const rolled = files
      .filter(f => /e\.shiftKey/.test(f.src))
      .map(f => f.path);
    expect(rolled, 'these re-implement the trap instead of using the hook').toEqual([]);
  });
});

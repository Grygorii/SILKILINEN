'use client';

import { useEffect, useRef, type RefObject } from 'react';

// Keyboard behaviour for a dialog — the ONE implementation.
//
// Nine components on this site render something with aria-modal="true". Three
// had a focus trap, hand-rolled, with the same selector string and the same
// 50ms timeout copied between them. Six had none at all, including the size
// chart drawer written earlier today.
//
// aria-modal is a CLAIM about behaviour, not behaviour. It tells assistive
// technology that everything outside this element is inert; if Tab then walks
// straight out into the page behind, the attribute has misled the one user who
// relied on it. A keyboard user ends up typing into a form they cannot see,
// behind a scrim, with no way to tell where they are.
//
// What this does, in the order it matters:
//   1. Remembers what had focus, so it can be given back. Losing focus to
//      <body> on close means the next Tab restarts from the top of the page.
//   2. Moves focus into the dialog, so the first Tab is inside it.
//   3. Keeps Tab and Shift+Tab inside it.
//   4. Restores focus to the trigger on close.
//
// Escape is deliberately NOT handled here. Some dialogs must confirm before
// closing, and a hook that closes them anyway would be worse than no hook.

/** Elements that can hold keyboard focus, before any filtering. */
const CANDIDATES = 'a[href], area[href], button, input, select, textarea, summary, iframe, [tabindex]';

/**
 * The shape of an element this module needs. Narrower than HTMLElement so the
 * predicate below can be tested without a DOM — the test environment here is
 * node, by a deliberate project decision (see vitest.config.mts).
 */
export type FocusCandidate = {
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
  offsetParent: unknown;
  tagName: string;
};

/**
 * Can a keyboard actually land on this?
 *
 * Split out from the query because the query is a selector string a DOM
 * evaluates, while THIS is the part that is easy to get subtly wrong. Each
 * clause is a real trap:
 *   disabled      — matched by a naive `button` selector, skipped by the
 *                   browser. A dialog whose last control is disabled would
 *                   trap Tab on something that cannot take focus.
 *   aria-hidden   — announced to nobody, so focusing it strands a screen
 *                   reader on an element it will not read.
 *   tabindex=-1   — programmatically focusable, deliberately not tabbable.
 *   offsetParent  — null for display:none and everything inside it; a dialog
 *                   with a collapsed section would otherwise cycle focus
 *                   through controls that are not on screen.
 */
export function isKeyboardReachable(el: FocusCandidate): boolean {
  if (el.hasAttribute('disabled')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.getAttribute('tabindex') === '-1') return false;
  // <area> has no layout box of its own but is reachable via its image map.
  if (el.offsetParent === null && el.tagName !== 'AREA') return false;
  return true;
}

/** Everything inside `root` a keyboard can reach, in DOM order. */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(CANDIDATES)).filter(isKeyboardReachable);
}

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  const previous = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    previous.current = document.activeElement as HTMLElement | null;

    // One frame, so the dialog's own opening transition does not fight the
    // scroll that focusing an element causes.
    const raf = requestAnimationFrame(() => {
      const [first] = focusableWithin(root);
      // Nothing focusable inside: focus the dialog itself so the screen reader
      // announces it and Tab starts from here rather than from the page top.
      if (first) first.focus();
      else {
        root.setAttribute('tabindex', '-1');
        root.focus();
      }
    });

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const node = ref.current;
      if (!node) return;
      // Recomputed on every Tab rather than captured once: these dialogs change
      // while open — the size drawer swaps a loading line for a table, the cart
      // loses a row when something is removed.
      const items = focusableWithin(node);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;
      // Focus escaping the dialog entirely (a click on the backdrop, a removed
      // element) is pulled back to the start rather than left outside.
      if (!node.contains(activeEl)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      // Back to whatever opened this. Guarded because the trigger may have been
      // unmounted while the dialog was up.
      const back = previous.current;
      previous.current = null;
      if (back && document.contains(back)) back.focus();
    };
  }, [ref, active]);
}

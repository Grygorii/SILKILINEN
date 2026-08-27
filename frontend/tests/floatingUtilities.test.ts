import { describe, it, expect } from 'vitest';

// §54: one floating utility only, and none of them may cover Add to Bag or the
// mobile sticky CTA. On a product page the bottom edge already belongs to
// StickyBuyBar, so the floating cart is a second cart control on the same
// screen — the chat bubble makes three.
//
// The rule is a path test, kept here rather than inline so the locale case is
// pinned: /de/product/... is still a product page, and a naive startsWith
// check on '/product' would show the bar on every localised PDP.
const isProductPage = (p: string) => /^\/(?:[a-z]{2}\/)?product\//.test(p || '');

describe('floating cart suppression', () => {
  it('hides on a product page', () => {
    expect(isProductPage('/product/silk-robe')).toBe(true);
  });

  it('hides on a localised product page too', () => {
    for (const l of ['de', 'fr', 'it', 'es']) {
      expect(isProductPage(`/${l}/product/silk-robe`), l).toBe(true);
    }
  });

  it('shows everywhere else, including pages whose name starts the same way', () => {
    for (const p of ['/', '/shop', '/collections/the-bridal-edit', '/journal', '/products', '/de/shop', '']) {
      expect(isProductPage(p), p).toBe(false);
    }
  });
});

// ── Bottom-edge clearance tokens ──────────────────────────────────────────
//
// globals.css declares the bottom edge's clearance contract: a fixed element
// down there publishes its height, and everything else reads it. The contract
// has failed twice in the same way, and neither failure was visible in a diff.
//
//   --sticky-buy-h  was declared, the body flag that drives it was set, and no
//                   stylesheet ever read it. The bubble sat on the buy bar for
//                   as long as the buy bar existed.
//   --contact-widget-h did not exist at all, so the mobile hero cleared the
//                   contact bubble with a hand-measured 56px — which is 18px
//                   short of the bubble's actual 74px footprint, so the bubble
//                   covered the corner of "Explore the collection".
//
// Both are the same bug: a declared token with no reader is indistinguishable
// from a token that works. This asserts the other half of every contract.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const GLOBALS = join(ROOT, 'app', 'globals.css');

function cssFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) cssFiles(p, out);
    else if (e.name.endsWith('.css') && p !== GLOBALS) out.push(p);
  }
  return out;
}

describe('bottom-edge clearance tokens', () => {
  const globals = readFileSync(GLOBALS, 'utf8');
  const sheets = cssFiles(ROOT).map(p => readFileSync(p, 'utf8'));
  const elsewhere = sheets.join('\n');

  // Every clearance token globals.css publishes, by name.
  const declared = [...globals.matchAll(/^\s*(--[a-z-]+-(?:bar|buy|widget)-h)\s*:/gm)]
    .map(m => m[1]);

  it('publishes the three known clearance tokens', () => {
    expect(new Set(declared)).toEqual(
      new Set(['--cookie-bar-h', '--sticky-buy-h', '--contact-widget-h']),
    );
  });

  it('has a reader outside globals.css for every one of them', () => {
    for (const token of declared) {
      expect(elsewhere.includes(`var(${token}`), `${token} is declared but nothing reads it`).toBe(true);
    }
  });

  it('keeps the contact bubble sized from the token, not from a number', () => {
    // The hero clears the bubble by reading its published height. If the widget
    // goes back to hardcoding its own size, the two drift apart silently and
    // the hero's clearance is wrong again with nothing to show for it.
    const widget = readFileSync(join(ROOT, 'components', 'ContactWidget.module.css'), 'utf8');
    const from = widget.indexOf('.trigger {');
    const block = widget.slice(from, widget.indexOf('}', from));
    // Both dimensions, not just one — a first pass of this test only checked
    // that the token appeared somewhere in the block, and a `width: 46px` next
    // to a tokenised height sailed past it.
    expect(block, 'a literal size on .trigger').not.toMatch(/(?:width|height)\s*:\s*\d/);
  });
});

// ── The hero fits the screen it is on ─────────────────────────────────────
//
// The site header is FIXED, so .shopContent carries a padding-top of
// --announcement-h + --nav-h and everything inside it starts that far down. A
// hero sized to the full viewport therefore hangs exactly that far below the
// fold — 114px on a phone — and since the hero bottom-aligns its content, the
// part that goes missing is the call to action. Twice now: once as plain `vh`
// against the URL bar, and once as `svh` against the header.
//
// Cheap to get wrong, invisible in a diff, and it costs the only button on the
// first screen a visitor ever sees.
describe('homepage hero height', () => {
  const css = readFileSync(join(ROOT, 'app', '(shop)', 'page.module.css'), 'utf8');
  const hero = css.slice(css.indexOf('.hero {'), css.indexOf('}', css.indexOf('.hero {')));

  it('measures from the small viewport, not the large one', () => {
    expect(hero).toMatch(/height:\s*calc\(100svh/);
  });

  it('subtracts the fixed header rather than assuming the page starts at the top', () => {
    for (const token of ['--announcement-h', '--nav-h']) {
      expect(hero, `${token} is not subtracted from the hero height`).toContain(token);
    }
  });
});

// ── Reduced motion is handled once, globally ──────────────────────────────
//
// Twenty-four stylesheets animate something; ten honoured the preference. The
// per-file opt-in had been missed fourteen times, which is what a per-file
// opt-in does. A visitor who has told their operating system that motion makes
// them ill was still getting scroll reveals, shimmering skeletons and a looping
// ribbon.
describe('reduced motion', () => {
  const globals = readFileSync(GLOBALS, 'utf8');

  it('neutralises animation and transition for everything, not just one selector', () => {
    const block = globals.slice(globals.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toMatch(/\*,\s*\n\s*\*::before,\s*\n\s*\*::after/);
    expect(block).toContain('animation-duration');
    expect(block).toContain('transition-duration');
  });

  it('uses a near-zero duration rather than none', () => {
    // `animation: none` cancels without firing transitionend/animationend, and
    // components that wait on those events would hang.
    const block = globals.slice(globals.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toMatch(/animation-duration:\s*0\.01ms/);
  });
});

// ── Nothing floats over the first screen ──────────────────────────────────
//
// The homepage opened with two fixed utilities on it: the contact bubble
// bottom-left and the Google Customer Reviews badge bottom-right, bracketing
// "Shop the collection" before the visitor had decided she was interested. The
// badge is mounted in the Footer, which reads as harmless until you remember
// that Google's own CSS fixes it to a corner — "in the footer" means "over the
// hero".
//
// Both wait for a sign of engagement now. The rule is easy to forget when a
// third utility is added, and the cost lands on the one screen every visitor
// sees and nobody chose.
describe('floating utilities defer to the first screen', () => {
  const FLOATING = ['ContactWidget.tsx', 'GoogleReviewsBadge.tsx'];

  it('holds every floating utility back until the visitor engages', () => {
    const eager = FLOATING.filter(name => {
      const src = readFileSync(join(ROOT, 'components', name), 'utf8');
      // A CALL, not the import — deleting the call leaves the import behind.
      return !/useDeferredReveal\s*\(/.test(src);
    });
    expect(eager, 'these appear on the first screen, over the hero').toEqual([]);
  });
});

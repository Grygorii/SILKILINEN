'use client';

// The UK shipping claim: ONE owner.
//
// Orders for Great Britain are dispatched from Derry, which is inside the UK,
// so a British customer pays no customs and no import duty. Everything else
// goes from Donegal. That single fact removes the largest objection a UK
// shopper has to buying from an Irish brand after Brexit — and it was written
// five different ways across the site:
//
//   AnnouncementBar   "UK orders ship from within the UK — no customs or duties"
//   UKShippingNotice  "Your order ships from within the UK — no customs charges,
//                      no import duties, no delays at the border."
//   UKShipBadge       "Ships from the UK — no customs or duties"
//   /shipping intro   "We ship across the border from Derry…"
//   /shipping customs "No customs charges — we ship from within the UK (Derry)."
//
// Only the last two name Derry, and they are on the page a hesitant shopper
// never opens. The three that a shopper actually meets said "from the UK",
// which is abstract: it asks them to take an Irish brand's word for it. Naming
// the town is what makes the claim checkable, and checkable is what "clearly
// understand" means.
//
// ── Scope, and why the wording matters ──
//
// Dispatch is from Derry OR Donegal depending on destination, so "ships from
// the UK" is true of a UK ORDER and false of the shop in general. Every line
// below is therefore scoped — "UK orders ship from…" — which makes each one
// true no matter who reads it. That is not pedantry: it is what lets the
// gating below fail safe (see shouldShowUkShipping).

export const UK_SHIPPING = {
  /** Announcement bar. Contains HTML — the bar sanitises before rendering. */
  banner: 'UK orders ship from Derry — <strong>no customs, no duties</strong>',
  /** One line, beside Add to Bag and at checkout. */
  badge: 'UK orders ship from Derry — no customs or duties',
  /** The slide-in card, which addresses a confirmed UK visitor directly. */
  cardHeading: 'For our UK customers',
  cardBody:
    'Your order ships from Derry, inside the UK — no customs charges, no import duties, '
    + 'no wait at the border. Orders everywhere else go from Donegal.',
  /** Where the full explanation lives. */
  href: '/shipping',
} as const;

/**
 * Should a UK shipping line be shown?
 *
 * `isUK` is three-valued and the third value is the whole point:
 *   true   — confirmed GB.
 *   false  — confirmed somewhere else.
 *   null   — we do not know. Either geo has not answered yet, or it failed,
 *            or the deploy has no `x-vercel-ip-country` header at all.
 *
 * The gate used to be `isUK === true`, so every unknown hid the line. That is
 * backwards for reassurance copy. Getting it wrong in one direction shows a
 * true, mildly irrelevant sentence to someone in Paris; getting it wrong in
 * the other direction hides the answer to "will I be charged customs?" from
 * the customer asking it, and that one costs the sale. Since the copy is
 * scoped to "UK orders", showing it to the wrong person is never a false
 * statement — which is what makes failing open safe here.
 *
 * `decided` guards the flicker: on the first render nothing is known yet, and
 * rendering immediately would flash the line at every non-UK visitor for as
 * long as the geo request takes. Callers pass false until geo answers or a
 * short grace period expires, whichever comes first.
 */
export function shouldShowUkShipping(isUK: boolean | null, decided: boolean): boolean {
  if (isUK === true) return true;
  if (isUK === false) return false;
  return decided;
}

import { useState, useEffect } from 'react';
import { useIsUK } from './useIsUK';

/**
 * How long to wait for geo before showing the line anyway.
 *
 * Long enough that a working lookup always wins the race, so a visitor in
 * France never sees the line flash in and out; short enough that a UK visitor
 * whose lookup failed still gets the answer while they are reading the page.
 */
const GRACE_MS = 1200;

/** Whether this visitor should see a UK shipping line. */
export function useUkShipping(): boolean {
  const isUK = useIsUK();
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), GRACE_MS);
    return () => clearTimeout(t);
  }, []);
  return shouldShowUkShipping(isUK, waited);
}

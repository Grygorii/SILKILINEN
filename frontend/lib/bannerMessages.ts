import { getContent } from './content';

// ONE owner for what the announcement bar says. The shop layout and the journal
// layout each used to rebuild this list themselves, byte-identically.
//
// The rule that matters here: **a code default must never make a claim that can
// expire.** No prices, no thresholds, no discount codes, no delivery promises.
// Those belong in the CMS, where the founder can change them. A hardcoded
// "Free worldwide shipping on orders over €150" sat in this fallback for months
// after the offer changed, and surfaced on any request where the CMS call timed
// out — so the site advertised a threshold the founder had already removed and
// could not find anywhere in the admin panel. Only timeless brand copy below.
const SAFE_DEFAULTS = [
  'An Irish silk & linen brand, based in Donegal',
];

/**
 * Messages for the announcement bar, or `null` when the bar should not render.
 *
 * - CMS has messages  → those, in order.
 * - CMS reachable but empty → SAFE_DEFAULTS (a fresh install still gets a bar).
 * - CMS unreachable   → null. Deliberately shows NO bar rather than substituting
 *   copy the founder can't see or edit: a missing bar is a smaller failure than
 *   a confidently wrong one, and it can't contradict the CMS.
 */
export async function getBannerMessages(): Promise<string[] | null> {
  const banner = await getContent('banner');
  if (banner === null) return null;

  const messages = [1, 2, 3, 4]
    .map(i => banner[`banner_message_${i}`]?.value)
    .filter((m): m is string => Boolean(m && m.trim()));

  return messages.length > 0 ? messages : SAFE_DEFAULTS;
}

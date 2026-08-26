import { mommeReading } from './fabricCare';

// The Google Shopping title.
//
// A separate rule from the STOREFRONT product name, and deliberately so. The
// name convention (backend/utils/productName.js) is "Silk [garment] in
// [Colour]" for a human reading a page who already knows whose shop they are
// in. Google's title is matched against a query typed by someone who does not,
// so an attribute in it is a chance to be found rather than a repetition.
//
// ── What this does NOT do, and why ──
//
// It does not prefix the brand. An outside strategy plan asks for
// "SILKILINEN Women's 19 Momme Mulberry Silk Kimono Robe – Sky Blue", but the
// naming convention already settled that question in the opposite direction and
// wrote down its reasoning: the brand is a separate feed attribute (g:brand),
// so repeating it in the title burns characters out of the ~70 Google actually
// renders. That is a real trade-off with a real argument on each side, and
// reversing a decision someone documented is a call for the founders, not a
// silent edit here. Flagged rather than changed.
//
// What it adds is the momme, which is uncontested: it is a factual attribute
// the title currently lacks, people search "19 momme silk robe", and no other
// feed field carries it (g:material takes the fibre, not the weight).

/** Google truncates hard past this; the API rejects longer. */
const MAX = 150;

/**
 * @param name        the product's storefront name, used as-is
 * @param momme       the recorded silk weight, if any
 * @param composition consulted only as a fallback source for the weight
 */
export function feedTitle(name: string, momme?: string | null, composition?: string | null): string {
  const base = String(name || '').trim();
  const weight = mommeReading(momme, composition);
  if (!base) return '';
  // No weight recorded, no weight claimed — the same rule the product page and
  // the card follow. A feed is the last place to start inventing a spec: it is
  // read by a machine that will happily repeat it in an advert.
  if (!weight) return base.slice(0, MAX);

  const suffix = ` — ${weight.value} momme`;
  // Trim the NAME to fit rather than letting a blanket truncation eat the
  // suffix. Cutting the attribute we added and keeping a half-sentence is the
  // worst of both.
  if (base.length + suffix.length <= MAX) return base + suffix;
  return base.slice(0, MAX - suffix.length).trimEnd() + suffix;
}

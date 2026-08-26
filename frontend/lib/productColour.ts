// Which colour, if any, a product card should print under the name.
//
// §9 lists Colour as its own line in the card:
//
//     Silk Kimono Robe
//     Sky Blue
//     19 momme · Mulberry silk
//     €168
//
// Taken literally that is wrong here, because this shop's canonical product
// name already contains the colour. backend/utils/productName.js builds
// "Silk [garment] in [Colour]", so the same card would read:
//
//     Silk Kimono Robe in Sky Blue
//     Sky Blue
//
// which is the fault I pulled off the product page a fortnight ago — the
// fibre stated twice, two lines apart, because each line was written without
// looking at the one above it.
//
// The spec's INTENT is that a visitor scanning a grid of near-identical silk
// can tell the colours apart. That intent is already served when the name
// carries it. So: print the colour only when the name does not already say it.
// Products renamed by scripts/renameProducts.js get nothing; the ones still
// carrying an old name get the line they need. The catalogue is mid-rename, so
// both cases are live right now.

export type ColourSource = {
  name?: string | null;
  /** The display colour, e.g. "Sky Blue". Served by CARD_PROJECTION. */
  colorName?: string | null;
  /** Colour options on the record itself, distinct from sibling colour products. */
  colours?: string[] | null;
};

/** Lowercase, collapse whitespace and hyphens — "Sky-Blue" and "sky blue" are the same word. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[\s-]+/g, ' ').trim();
}

// Not a colour: placeholders some records carry where a colour would go.
const PLACEHOLDERS = new Set(['one colour', 'one color', 'default', 'n/a', 'assorted']);

/**
 * The colour to show on the card, or null to show nothing.
 *
 * Null when: there is no colour; it is a placeholder; the name already
 * contains it; or the record itself holds several colours — in that last case
 * a single line would name one of them and silently misdescribe the rest,
 * and the swatches on the product page do the job properly.
 */
export function cardColour(product: ColourSource): string | null {
  const explicit = (product.colorName ?? '').trim();
  const options = (product.colours ?? []).map(c => String(c).trim()).filter(Boolean);

  // A record with several colours is not one colour, whatever colorName says.
  if (!explicit && options.length > 1) return null;

  const colour = explicit || options[0] || '';
  if (!colour) return null;
  if (PLACEHOLDERS.has(norm(colour))) return null;

  const name = norm(product.name ?? '');
  if (name && name.includes(norm(colour))) return null;

  return colour;
}

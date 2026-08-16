// Colour NAME → swatch hex. One owner for the storefront.
//
// ColourSwatch fell back to --color-surface-warm (a warm beige) whenever a
// product had no colorHex set. That is fine as a "we don't know" placeholder in
// the abstract, and actively misleading in practice: "Silk bikini briefs in
// Black" rendered a cream square. A customer reads that as the colour, not as a
// missing value — it is a confident wrong answer, which is worse than none.
//
// Most products name their colour but never had the hex filled in, so deriving
// from the name fixes the majority without any data entry. The beige
// placeholder still exists for genuinely unknown names.
//
// Shades are approximations of the real silk, chosen to read correctly at
// swatch size rather than to be colour-accurate under studio light.
const COLOUR_HEX: Record<string, string> = {
  black: '#1A1A1A',
  onyx: '#1A1A1A',
  'onyx black': '#1A1A1A',
  white: '#FBFBF9',
  ivory: '#F4EFE4',
  cream: '#F2EADA',
  champagne: '#E8D9BE',
  'bare champagne': '#E5D6C0',
  'pare champagne': '#E5D6C0',
  pearl: '#EFEAE1',
  oyster: '#DED6C8',
  silver: '#C9C9C7',
  blush: '#E8C7C2',
  'pink blush': '#E9C3C4',
  'bare blush': '#E7CAC4',
  pink: '#E7B8BE',
  rose: '#D9A2A2',
  copper: '#B06A3B',
  'sunset copper': '#C0714A',
  garnet: '#7B1F2B',
  'wine red': '#6E1F2A',
  red: '#8E2230',
  sage: '#A8B29B',
  'sage green': '#9FAE95',
  'emerald green': '#2F6B54',
  green: '#4E7A5E',
  aquamarine: '#7FC4C4',
  'sky blue': '#A9C9DD',
  'soft sky blue': '#B3CFE0',
  blue: '#6E8FB0',
  navy: '#26344B',
  charcoal: '#3C3C3C',
  grey: '#9A9A97',
  gray: '#9A9A97',
  gold: '#B08A46',
  bastet: '#2F6B54',
};

/**
 * Hex for a colour name, or null when we genuinely don't recognise it — the
 * caller keeps its placeholder for that case rather than inventing a shade.
 */
export function colourToHex(name?: string | null): string | null {
  if (!name) return null;
  const key = String(name).trim().toLowerCase();
  if (COLOUR_HEX[key]) return COLOUR_HEX[key];
  // "Sunset Copper Silk" and similar — fall back to the longest known colour
  // term contained in the name, so a two-word shade wins over its last word.
  const hit = Object.keys(COLOUR_HEX)
    .filter(k => key.includes(k))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? COLOUR_HEX[hit] : null;
}

// Fabric & care — the ONE rule for turning what the admin stored into what the
// product page shows.
//
// Two jobs, both of which have a wrong answer that costs real money:
//
//   careSteps()  — the founder types care as free text ("Hand wash cold. Lay
//     flat to dry. Do not bleach."). Rendered as one paragraph it reads like a
//     shipping disclaimer; rendered as steps it reads like instructions. The
//     invariant that matters is that EVERY instruction survives the split: a
//     dropped "do not tumble dry" ruins a €300 robe, so an unrecognised phrase
//     is shown with a neutral marker rather than discarded.
//
//   mommeReading() — momme is the number premium silk buyers actually check,
//     and "22 momme" means nothing without knowing that 19 is the everyday
//     weight and 30 is upholstery. The band and the note are the education the
//     figure is useless without.
//
// What this file will NEVER do is invent a momme. It is a per-product physical
// measurement, it feeds the Google Merchant material field, and a plausible
// default would be a fabricated spec on a page whose whole purpose is proving
// the product is what we say it is. No momme stored means no weight shown.
//
// Care is different, and only just: a general silk-care line is a true
// statement about the FABRIC, so it is allowed as a fallback — but only when
// the product itself states a composition we recognise, and it is flagged
// `general` so the page can say whose instruction it is.

export type CareIcon = 'wash' | 'bleach' | 'dry' | 'iron' | 'dryClean' | 'note';

export type CareStep = {
  /** The instruction exactly as written, minus trailing punctuation. */
  text: string;
  /**
   * A CATEGORY marker, never a claim. "Iron on low" and "Do not iron" both
   * carry the iron glyph — the text says which. Encoding the prohibition in
   * the icon instead would mean parsing negation, and a negation parser that
   * gets one case wrong tells the customer to do the opposite of the truth.
   */
  icon: CareIcon;
};

// First match wins, so the order is the rule. `dryClean` precedes `dry`
// because "dry clean only" contains "dry"; classifying it as drying would put
// the one instruction that means "never put this in water" under a tumble-dry
// glyph.
const ICON_PATTERNS: [CareIcon, RegExp][] = [
  ['dryClean', /dry\s*-?\s*clean/i],
  ['bleach', /bleach|whiten/i],
  ['wash', /wash|launder|rinse|soak|deterg/i],
  ['iron', /iron|press|steam/i],
  ['dry', /\bdry|tumble|dryer|air\b|hang|lay flat|line\b/i],
];

function iconFor(text: string): CareIcon {
  for (const [icon, re] of ICON_PATTERNS) if (re.test(text)) return icon;
  return 'note';
}

/**
 * Split free text into one step per instruction.
 *
 * Founders write these as sentences, as newline lists, or as semicolon runs,
 * and often without a final full stop — so all three separators are honoured
 * and a trailing fragment is kept rather than dropped.
 */
function splitInstructions(raw: string): string[] {
  return String(raw)
    .split(/\r?\n+|[;•]+|(?<=[.!])\s+/)
    .map(s => s.replace(/^[\s\-–—*]+/, '').replace(/[\s.;,]+$/, '').trim())
    .filter(Boolean);
}

// General care for the fabrics this shop actually sells. These are statements
// about the material, not about any one garment, which is the only reason they
// are allowed to stand in for something the founder has not written yet.
const SILK_CARE = [
  'Hand wash cold with a pH-neutral silk detergent, or dry clean',
  'Do not bleach — bleach dissolves the protein fibre',
  'Roll in a towel to blot, then dry flat away from direct sun',
  'Iron on the lowest setting while slightly damp, reverse side',
];

const LINEN_CARE = [
  'Machine wash cool on a gentle cycle',
  'Do not bleach',
  'Line dry, or tumble dry low and remove while damp',
  'Iron on medium while damp, or leave the creases — they are the point',
];

export type CareReading = {
  steps: CareStep[];
  /** True when the steps describe the fabric rather than this exact garment. */
  general: boolean;
};

/**
 * @param instructions the product's own careInstructions, if any
 * @param composition  the product's materialComposition, used only to pick a
 *                     general fallback — never to override what was written
 */
export function careSteps(instructions?: string | null, composition?: string | null): CareReading {
  const own = splitInstructions(instructions || '');
  if (own.length) {
    return { steps: own.map(text => ({ text, icon: iconFor(text) })), general: false };
  }

  // Nothing written. Fall back only to a fabric we can actually name — an
  // unrecognised or absent composition yields nothing, because the alternative
  // is guessing how to launder something we cannot identify.
  const m = String(composition || '').toLowerCase();
  const fallback = m.includes('silk') ? SILK_CARE : m.includes('linen') ? LINEN_CARE : null;
  if (!fallback) return { steps: [], general: false };

  return { steps: fallback.map(text => ({ text, icon: iconFor(text) })), general: true };
}

export type MommeReading = {
  value: number;
  /** One-word weight class, for the eye. */
  band: string;
  /** What that weight means in the hand — the education the number needs. */
  note: string;
  /** 0–1 position on the shop's momme scale, for the marker. */
  position: number;
};

// The span worth drawing. Below 12 is scarf chiffon and above 30 is upholstery;
// neither is anything this shop sells, and a scale wide enough to include them
// would squash every real product into the same two millimetres.
const SCALE_MIN = 12;
const SCALE_MAX = 30;

// A weight written inside the composition string, which the admin form's own
// placeholder ("100% Mulberry Silk 19mm Momme") actively invites. Anchored to
// the unit on purpose: a bare first-number grab reads "95% Silk 5% Elastane"
// as 95 momme and prints "Heavyweight" under it — a fabricated spec produced
// by a helpful-looking shortcut.
const MOMME_IN_TEXT = /(\d+(?:\.\d+)?)\s*(?:mm\b|momme\b)/i;

/**
 * Read the stored momme. Returns null — not a default — when no weight was
 * recorded, so the panel shows no weight at all rather than a confident
 * fiction.
 *
 * @param momme       the product's own momme field; a bare number is its
 *                    documented shape, so it is read as written
 * @param composition consulted ONLY when the momme field is empty, and only
 *                    where a number sits against the unit
 */
export function mommeReading(momme?: string | null, composition?: string | null): MommeReading | null {
  const own = String(momme ?? '').match(/\d+(?:\.\d+)?/);
  const borrowed = own ? null : String(composition ?? '').match(MOMME_IN_TEXT);
  const raw = own ? own[0] : borrowed?.[1];
  if (raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;

  const { band, note } =
    value < 16 ? {
      band: 'Light',
      note: 'A fluid, weightless silk that drapes close to the body — made for warm nights and layering.',
    } : value < 20 ? {
      band: 'Classic',
      note: 'The everyday weight of fine silk garments: soft and forgiving, with enough body to hang cleanly.',
    } : value < 25 ? {
      band: 'Substantial',
      note: 'Noticeably denser in the hand, more opaque, and slower to show wear — the weight most luxury houses reserve for their better pieces.',
    } : {
      band: 'Heavyweight',
      note: 'Rare in ready-to-wear. It falls with real weight, resists creasing, and will outlast lighter silks by years.',
    };

  const position = Math.min(1, Math.max(0, (value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)));
  return { value, band, note, position };
}

/**
 * Does this product have any fabric detail worth a panel?
 *
 * One owner, two callers: the PDP asks before rendering the accordion row (an
 * empty accordion is a promise the panel cannot keep), and FabricCare asks
 * again as its own guard. Asking the same question two different ways is how
 * a row appears with nothing behind it.
 */
export function hasFabricDetail(p: {
  materialComposition?: string | null;
  momme?: string | null;
  careInstructions?: string | null;
}): boolean {
  return Boolean(
    (p.materialComposition || '').trim()
    || mommeReading(p.momme, p.materialComposition)
    || careSteps(p.careInstructions, p.materialComposition).steps.length,
  );
}

/**
 * The fibre as a card-length label — "Pure Mulberry silk", not the full
 * composition string.
 *
 * One owner, because it is now read in two places that must agree: the product
 * card and the price-side marks on the PDP. A customer who sees "Pure silk" on
 * the grid and "Pure Mulberry silk" on the page has been told two things about
 * the same garment.
 *
 * Returns null for a composition naming no fibre we recognise — the card then
 * shows nothing rather than echoing an unparsed string into a one-line slot.
 */
export function fibreLabel(composition?: string | null): string | null {
  const m = String(composition || '').toLowerCase();
  if (!m.trim()) return null;
  if (m.includes('mulberry')) return 'Pure Mulberry silk';
  if (m.includes('silk') && m.includes('linen')) return 'Silk & linen';
  if (m.includes('silk')) return 'Pure silk';
  if (m.includes('linen')) return 'Pure linen';
  return null;
}

'use strict';

// THE convention for product names. One owner, so the cleanup script, the admin
// form and any future importer all agree on what a correct name looks like.
//
//     Silk [garment] in [Colour]        "Silk pillowcase in Silver"
//     Silk satin [garment] — [Piece]    "Silk satin scarf — The Grand Tour"
//
// Sentence case for the garment, colour last and capitalised as a shade name,
// no "Silkilinen" prefix — the brand is a separate attribute in the Shopping
// feed, so repeating it burns characters Google actually shows.
//
// The catalogue drifted into three word orders and four capitalisation styles,
// with "Brief" and "Briefs" naming the same garment, because the convention
// lived in whoever typed the name. It lives here now.

const COLOURS = [
  'sunset copper', 'bare champagne', 'pink blush', 'soft sky blue', 'sky blue',
  'wine red', 'sage green', 'champagne', 'aquamarine', 'garnet', 'copper',
  'silver', 'blush', 'cream', 'ivory', 'onyx', 'black', 'white', 'sage',
  'pearl', 'oyster', 'navy', 'charcoal', 'rose', 'pink', 'blue', 'green',
];

// Words that describe the cloth, not the garment. Stripped from the item so
// "Silk Bikini Brief" does not become "Silk silk bikini brief".
const MATERIALS = ['silk satin', 'silk', 'linen'];

// Garments that are inherently plural. "Brief" and "Briefs" both existed for
// the same product; a pair of briefs is a pair.
const ALWAYS_PLURAL = ['brief', 'briefs', 'pyjama', 'pyjamas', 'shorts', 'knickers'];

const titleCase = s => s.replace(/\b[a-z]/g, c => c.toUpperCase());

function parse(product) {
  const original = String(product.name || '').trim();
  let work = original;

  // 1. Drop the brand prefix.
  work = work.replace(/^silkilinen\s+/i, '');

  // 2. Colour: prefer the real field over guessing from prose.
  const fromField = product.colorName || (product.colours || []).find(Boolean) || '';
  let colour = fromField ? String(fromField).trim() : '';
  let matched = '';
  for (const c of COLOURS) {
    const re = new RegExp(`\\b${c}\\b`, 'i');
    if (re.test(work)) { matched = c; break; }
  }
  if (!colour && matched) colour = matched;
  // Strip the colour from the item. Prefer the FULL colour field when it appears
  // in the name: matching only the recognised word left "Silk slip dress in Pare
  // champagne" as "slip dress in pare", because "Pare" is not in COLOURS.
  const strip = [];
  if (colour) strip.push(colour);
  if (matched) strip.push(matched);
  for (const term of strip) {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    work = work.replace(new RegExp(`\\b(in\\s+)?(soft\\s+)?${esc}\\b`, 'ig'), ' ');
  }
  // Any "in" left orphaned by the removal above.
  work = work.replace(/\bin\b\s*$/i, ' ').replace(/\s+in\s+$/i, ' ');

  // 3. A named piece — anything wrapped in quotes, or a leading "The ...".
  let pieceName = '';
  const named = work.match(/\bThe\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/);
  if (named) {
    pieceName = named[0].trim();
    work = work.replace(named[0], ' ');
  }

  // 4. Material.
  let material = 'Silk';
  for (const m of MATERIALS) {
    const re = new RegExp(`\\b${m}\\b`, 'i');
    if (re.test(work)) {
      // Sentence case, not Title Case: "Silk satin", never "Silk Satin".
      material = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
      work = work.replace(new RegExp(`\\b${m}\\b`, 'ig'), ' ');
      break;
    }
  }

  // 5. Whatever survives is the garment.
  let item = work.replace(/\s+/g, ' ').replace(/^[\s,–—-]+|[\s,–—-]+$/g, '').toLowerCase();
  if (ALWAYS_PLURAL.includes(item.split(' ').pop()) && !item.endsWith('s')) item += 's';

  const colourLabel = colour ? titleCase(colour.toLowerCase()) : '';
  let newName = '';
  if (item && pieceName) newName = `${material} ${item} — ${pieceName}`;
  else if (item && colourLabel) newName = `${material} ${item} in ${colourLabel}`;
  else if (item) newName = `${material} ${item}`;

  // Anything we could not resolve into "material + garment" is not safe to
  // rename automatically.
  const review = !item || item.length < 3 || (!colourLabel && !pieceName);

  return { original, newName, colour: colourLabel, item, pieceName, review };
}



/**
 * Does this name follow the convention, and if not, what would?
 *
 * Deliberately advisory, not blocking. A genuinely new kind of product will
 * eventually need a shape this parser has never seen, and a hard validation
 * rule would either stop real work or teach people to write nonsense that
 * satisfies it. The admin shows the suggestion and lets a human decide.
 */
function checkName(name, product = {}) {
  const parsed = parse({ ...product, name });
  const reasons = [];
  const raw = String(name || '').trim();

  if (/^silkilinen\b/i.test(raw)) reasons.push('Starts with the brand — the shop is already Silkilinen.');
  // Title Case across the whole name, ignoring the colour that belongs capitalised.
  const words = raw.split(/\s+/).filter(w => /^[A-Za-z]/.test(w));
  const capped = words.filter(w => /^[A-Z]/.test(w));
  if (words.length >= 3 && capped.length >= words.length - 1) {
    reasons.push('Title Case throughout — sentence case reads as boutique, not marketplace.');
  }
  // Only when we can actually offer the alternative — a reason with no
  // suggestion behind it is a complaint, not help.
  if (!parsed.review && parsed.newName && parsed.newName !== raw) {
    reasons.push('Colour reads better last, as "in <Colour>".');
  }

  // A name we cannot parse is not "wrong" — it may simply be a kind of product
  // the convention was never written for (a gift card, a bundle). Say nothing.
  if (parsed.review && !reasons.length) return { ok: true, suggestion: '', reasons: [] };

  const ok = !parsed.review && parsed.newName === raw;
  return {
    ok,
    // Never suggest something we could not confidently parse.
    suggestion: parsed.review || parsed.newName === raw ? '' : parsed.newName,
    reasons: ok ? [] : reasons,
  };
}

module.exports = { parse, checkName, COLOURS, MATERIALS, ALWAYS_PLURAL };

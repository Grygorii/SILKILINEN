// Which lines belong in the product panel's details grid.
//
// The panel shows two kinds of thing and they must never be confused:
//
//   a CHOICE — more than one colour, more than one size — gets its own control,
//     because the customer has to act on it before she can buy.
//   a FACT — the only colour, the only size, the fit note — gets a row in the
//     details grid, because there is nothing to do with it but read it.
//
// Getting that wrong has cost this page twice. A single size rendered as a
// pressable pill became a second full-width dark bar directly above ADD TO BAG,
// so the page offered two identical slabs and one of them must not be pressed.
// Colour was rendered as a swatch group AND as a row two hundred pixels apart,
// because each was added by someone looking at one block rather than the page.
//
// The rule is therefore stated once, here, and pinned. Order is §22's: colour,
// fit, size.

export type DetailRow = { key: 'colour' | 'fit' | 'size'; label: string; value: string };

export type DetailInput = {
  /** The record's own colour options — a CHOICE when there is more than one. */
  colours?: string[] | null;
  /** The display colour, preferred over `colours` when present. */
  colorName?: string | null;
  fitNote?: string | null;
  sizes?: string[] | null;
};

export function detailRows(input: DetailInput): DetailRow[] {
  const colours = (input.colours ?? []).map(c => String(c).trim()).filter(Boolean);
  const sizes = (input.sizes ?? []).map(z => String(z).trim()).filter(Boolean);
  const rows: DetailRow[] = [];

  // Several colours is a decision and lives in the swatch group, not here.
  if (colours.length <= 1) {
    const colour = (input.colorName ?? '').trim() || colours[0] || '';
    if (colour) rows.push({ key: 'colour', label: 'Colour', value: colour });
  }

  const fit = (input.fitNote ?? '').trim();
  if (fit) rows.push({ key: 'fit', label: 'Fit', value: fit });

  // Several sizes is a decision and lives in the pill group.
  if (sizes.length === 1) rows.push({ key: 'size', label: 'Size', value: sizes[0] });

  return rows;
}

import { describe, it, expect } from 'vitest';
import { careSteps, mommeReading, hasFabricDetail, fibreLabel } from '@/lib/fabricCare';

// Two rules with expensive wrong answers: a care instruction that silently
// disappears, and a momme weight that was never measured.

describe('care steps', () => {
  it('splits the founder\'s sentences into one step each', () => {
    const { steps, general } = careSteps('Hand wash cold. Lay flat to dry. Do not bleach. Iron on low heat.');
    expect(steps.map(s => s.text)).toEqual([
      'Hand wash cold', 'Lay flat to dry', 'Do not bleach', 'Iron on low heat',
    ]);
    expect(general).toBe(false);
  });

  it('handles newline and semicolon lists, and a missing final full stop', () => {
    expect(careSteps('Hand wash cold\nDo not tumble dry').steps).toHaveLength(2);
    expect(careSteps('Hand wash cold; do not bleach').steps).toHaveLength(2);
    // A trailing fragment with no punctuation is an instruction too.
    expect(careSteps('Do not bleach. Iron on low').steps.map(s => s.text)).toContain('Iron on low');
  });

  // The one that ruins a garment.
  it('never drops an instruction it cannot classify', () => {
    const { steps } = careSteps('Hand wash cold. Store rolled, never folded on a crease.');
    expect(steps).toHaveLength(2);
    expect(steps[1]).toEqual({ text: 'Store rolled, never folded on a crease', icon: 'note' });
  });

  it('marks the category, never the prohibition', () => {
    // Both are iron instructions; the TEXT says which. An icon that tried to
    // encode "do not" would have to parse negation, and one wrong case tells
    // the customer to do the opposite of the truth.
    expect(careSteps('Iron on low').steps[0].icon).toBe('iron');
    expect(careSteps('Do not iron').steps[0].icon).toBe('iron');
  });

  it('reads "dry clean only" as dry cleaning, not as drying', () => {
    // It contains the word "dry"; classified as drying it would sit under a
    // tumble-dry glyph while meaning the exact opposite.
    expect(careSteps('Dry clean only').steps[0].icon).toBe('dryClean');
    expect(careSteps('Lay flat to dry').steps[0].icon).toBe('dry');
  });

  it('falls back to fabric care only when the composition names a fabric', () => {
    const silk = careSteps('', '100% Mulberry Silk');
    expect(silk.general).toBe(true);
    expect(silk.steps.length).toBeGreaterThan(0);

    const linen = careSteps(null, 'Washed European Linen');
    expect(linen.general).toBe(true);
    expect(linen.steps[0].text).toMatch(/machine wash/i);
  });

  it('says nothing about a fabric it cannot identify', () => {
    // Guessing how to launder an unknown material is worse than silence.
    expect(careSteps('', 'Recycled blend').steps).toEqual([]);
    expect(careSteps('', '').steps).toEqual([]);
    expect(careSteps(undefined, undefined).steps).toEqual([]);
  });

  it('never lets the fallback override what the founder wrote', () => {
    const { steps, general } = careSteps('Dry clean only.', '100% Mulberry Silk');
    expect(general).toBe(false);
    expect(steps).toEqual([{ text: 'Dry clean only', icon: 'dryClean' }]);
  });
});

describe('momme reading', () => {
  it('reads a plain number and a number with a unit', () => {
    expect(mommeReading('22')?.value).toBe(22);
    expect(mommeReading('22mm')?.value).toBe(22);
    expect(mommeReading('19-22')?.value).toBe(19);
  });

  // The rule this file exists to protect: momme is a measurement, and a
  // plausible default would be a fabricated spec on the page whose job is
  // proving the product is what we claim.
  it('returns nothing rather than a default when no weight was recorded', () => {
    for (const v of ['', '   ', 'heavy', null, undefined]) {
      expect(mommeReading(v)).toBeNull();
    }
    expect(mommeReading('0')).toBeNull();
  });

  it('bands the weight so the number means something', () => {
    expect(mommeReading('14')?.band).toBe('Light');
    expect(mommeReading('19')?.band).toBe('Classic');
    expect(mommeReading('22')?.band).toBe('Substantial');
    expect(mommeReading('30')?.band).toBe('Heavyweight');
  });

  it('keeps the scale marker on the scale', () => {
    // Off-scale values are real (6mm chiffon, 40mm upholstery) and must not
    // render a marker outside the bar.
    expect(mommeReading('6')!.position).toBe(0);
    expect(mommeReading('40')!.position).toBe(1);
    expect(mommeReading('21')!.position).toBeCloseTo(0.5, 1);
  });
});

// The PDP asks this before drawing the accordion row and the panel asks it
// again before rendering. Two callers, one rule — if they ever disagreed, the
// row would open onto nothing.
describe('has fabric detail', () => {
  it('is true when any one of the three is present', () => {
    expect(hasFabricDetail({ materialComposition: '100% Mulberry Silk' })).toBe(true);
    expect(hasFabricDetail({ momme: '22' })).toBe(true);
    expect(hasFabricDetail({ careInstructions: 'Hand wash cold.' })).toBe(true);
  });

  it('is false for a product carrying no fabric detail at all', () => {
    expect(hasFabricDetail({})).toBe(false);
    expect(hasFabricDetail({ materialComposition: '  ', momme: '', careInstructions: '' })).toBe(false);
  });

  it('counts the fabric fallback, so a silk product with no care text still gets a panel', () => {
    expect(hasFabricDetail({ materialComposition: 'Silk' })).toBe(true);
  });
});

// The admin's composition placeholder is "100% Mulberry Silk 19mm Momme", so
// the weight genuinely does get typed into that field.
describe('momme written into the composition', () => {
  it('reads a weight stated against its unit', () => {
    expect(mommeReading('', '100% Mulberry Silk 19mm Momme')?.value).toBe(19);
    expect(mommeReading(null, 'Silk, 22 momme')?.value).toBe(22);
  });

  it('never mistakes a percentage for a weight', () => {
    // The failure this anchor exists for: a bare first-number grab reads this
    // as 95 momme and prints "Heavyweight" beneath it.
    expect(mommeReading('', '95% Silk 5% Elastane')).toBeNull();
    expect(mommeReading('', '100% Mulberry Silk')).toBeNull();
  });

  it('lets the momme field win when both are filled', () => {
    expect(mommeReading('22', '100% Silk 19mm Momme')?.value).toBe(22);
  });
});

// Read by both the product card and the PDP's price-side marks. If they
// disagreed, the grid and the page would describe the same garment two
// different ways.
describe('fibre label', () => {
  it('names the fibre a buyer is paying for', () => {
    expect(fibreLabel('100% Mulberry Silk')).toBe('Pure Mulberry silk');
    expect(fibreLabel('100% Silk')).toBe('Pure silk');
    expect(fibreLabel('Washed European Linen')).toBe('Pure linen');
    expect(fibreLabel('55% Silk 45% Linen')).toBe('Silk & linen');
  });

  it('prefers the more specific claim when both words appear', () => {
    // Mulberry is the one worth saying; "silk and linen" would lose it.
    expect(fibreLabel('100% Mulberry Silk')).toBe('Pure Mulberry silk');
  });

  it('says nothing rather than echoing an unrecognised composition', () => {
    expect(fibreLabel('Recycled blend')).toBeNull();
    expect(fibreLabel('')).toBeNull();
    expect(fibreLabel(null)).toBeNull();
  });
});

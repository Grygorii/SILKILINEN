import { describe, it, expect } from 'vitest';
import { detailRows } from '@/lib/productDetails';

describe('detailRows', () => {
  it('states a one-colour, one-size piece as three plain facts', () => {
    // The eye mask that started this: nothing on the page is a decision, so
    // nothing should wear the shape of a control.
    expect(detailRows({ colorName: 'Cream', fitNote: 'Relaxed', sizes: ['One Size'] }))
      .toEqual([
        { key: 'colour', label: 'Colour', value: 'Cream' },
        { key: 'fit', label: 'Fit', value: 'Relaxed' },
        { key: 'size', label: 'Size', value: 'One Size' },
      ]);
  });

  it('never states a colour that is also a choice', () => {
    // Colour was shown as a swatch group AND as a row 200px apart. A record
    // with two colours must contribute nothing here.
    const rows = detailRows({ colours: ['Ivory', 'Sky Blue'], colorName: 'Ivory', sizes: ['S', 'M'] });
    expect(rows.map(r => r.key)).not.toContain('colour');
  });

  it('never states a size that is also a choice', () => {
    // A single size rendered as a pill became a second dark bar above ADD TO
    // BAG; several sizes must stay in the pill group and out of this list.
    const rows = detailRows({ sizes: ['S', 'M', 'L'], colorName: 'Cream' });
    expect(rows.map(r => r.key)).not.toContain('size');
  });

  it('keeps §22 order — colour, fit, size', () => {
    const rows = detailRows({ colorName: 'Cream', fitNote: 'Relaxed', sizes: ['One Size'] });
    expect(rows.map(r => r.key)).toEqual(['colour', 'fit', 'size']);
  });

  it('prefers the display colour over the options list', () => {
    expect(detailRows({ colours: ['cream'], colorName: 'Cream' })[0].value).toBe('Cream');
  });

  it('omits a row rather than printing an empty one', () => {
    // A blank fit note used to reach the page as a labelled row with nothing
    // after the label.
    expect(detailRows({ fitNote: '   ', sizes: [] })).toEqual([]);
    expect(detailRows({})).toEqual([]);
  });

  it('survives a record with nothing but whitespace in its arrays', () => {
    expect(detailRows({ colours: ['  ', ''], sizes: ['  '] })).toEqual([]);
  });

  it('still names the single colour when the list holds one and colorName is absent', () => {
    expect(detailRows({ colours: ['Emerald Green'] })).toEqual([
      { key: 'colour', label: 'Colour', value: 'Emerald Green' },
    ]);
  });
});

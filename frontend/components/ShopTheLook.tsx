import { apiJson } from '@/lib/apiFetch';
import { companionCategory, canPairWith } from '@/lib/companion';
import ShopTheLookPair from './ShopTheLookPair';

// "Pairs with" — the second piece, offered with one button that adds both.
//
// Server component: it picks the companion at render time so the pair is part
// of the page rather than something that pops in, and so the choosing rule
// never reaches the browser.
//
// The name matters. This is NOT "frequently bought together" — that is a claim
// about order history, and with almost no orders it would be invented social
// proof. "Pairs with" is an editorial recommendation, which is ours to make.

type Candidate = {
  _id: string;
  slug?: string;
  name: string;
  price: number;
  category?: string;
  colours?: string[];
  sizes?: string[];
  images?: { url: string; isPrimary?: boolean }[];
  image?: string;
  inStock?: boolean;
  totalStock?: number;
};

type Anchor = {
  _id: string;
  name: string;
  price: number;
  category?: string;
  colours?: string[];
  sizes?: string[];
  images?: { url: string; isPrimary?: boolean }[];
  image?: string;
  inStock?: boolean;
  totalStock?: number;
};

export default async function ShopTheLook({ product }: { product: Anchor }) {
  const wanted = companionCategory(product.category);
  if (!wanted) return null;

  // The anchor has to be buyable too — offering "add both" from a sold-out
  // page adds one thing and looks broken.
  if (product.inStock === false || product.totalStock === 0) return null;

  const data = await apiJson<{ products?: Candidate[] } | Candidate[]>(
    `${process.env.NEXT_PUBLIC_API_URL}/api/products?category=${encodeURIComponent(wanted)}&limit=12`,
    { next: { revalidate: 300 } },
  ).catch(() => null);
  if (!data) return null;

  const list: Candidate[] = Array.isArray(data) ? data : (data.products ?? []);
  const companion = list.find(c => canPairWith(product, c));
  if (!companion) return null;

  // Only pieces with a single option each. A pair that needs two size pickers
  // and two colour pickers is not a one-button purchase, and silently choosing
  // for the customer is how the wrong size ends up in the bag.
  const simple = (p: { sizes?: string[]; colours?: string[] }) =>
    (p.sizes?.length ?? 0) <= 1 && (p.colours?.length ?? 0) <= 1;
  if (!simple(product) || !simple(companion)) return null;

  return <ShopTheLookPair anchor={product} companion={companion} />;
}

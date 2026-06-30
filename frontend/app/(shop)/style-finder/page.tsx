import type { Metadata } from 'next';
import StyleFinder, { type SFProduct } from './StyleFinder';

export const metadata: Metadata = {
  title: 'Silk Style Finder',
  description:
    'A few quiet questions, and we will gather your silk edit — the pieces made for the way you rest, lounge and dress.',
  alternates: { canonical: 'https://www.silkilinen.com/style-finder' },
};

// Load the catalogue on the SERVER and hand it to the quiz. The quiz used to
// fetch from the browser in its loading step, which failed (→ the "we couldn't
// gather your pieces" screen) whenever the backend was cold or CORS hiccuped.
// Fetching here makes the data reliable; the client only scores it.
async function getProducts(): Promise<SFProduct[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function StyleFinderPage() {
  const products = await getProducts();
  return <StyleFinder initialProducts={products} />;
}

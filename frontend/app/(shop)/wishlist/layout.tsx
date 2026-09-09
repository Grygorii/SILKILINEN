// Private route: crawlable so Google can follow links back out of it, but
// NEVER indexed. robots.txt only disallows /admin and /api, so these pages were
// fully indexable — and a page blocked in robots.txt can still be listed with
// no snippet, which is why this is a noindex META rather than a disallow.
//
// A client component cannot export `metadata`, so the declaration lives in a
// layout beside it.

export const metadata = {
  title: 'Wishlist',
  robots: { index: false, follow: true },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

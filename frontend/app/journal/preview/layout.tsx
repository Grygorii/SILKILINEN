// Draft preview of an unpublished article. It renders the SAME body the live
// article will carry, at a URL Google is free to crawl — robots.txt disallows
// only /admin and /api — so a draft was competing with its own published
// version as a near-duplicate.
//
// The sibling product preview (app/(shop)/preview/[id]) has carried this
// directive all along; this one was missed because it is a client component,
// and a client component cannot export `metadata`. Same reason /checkout and
// /account went uncovered: the declaration has to live in a layout beside the
// page, so the omission looks like nothing at all in the page file.
//
// follow: false as well as index: false — unlike a basket, there is nothing
// here worth crawling onward from that is not already linked from /journal.

export const metadata = {
  title: 'Article preview',
  robots: { index: false, follow: false },
};

export default function JournalPreviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

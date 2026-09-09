// One-click opt-out reached from a signed link in a marketing email. The URL
// carries the signature as a query parameter, so an indexed copy would publish
// a working unsubscribe token for whoever it was minted for — and the page
// itself is a single confirmation line, which is exactly the thin content
// Google reports and nobody wants ranked.
//
// A client component cannot export `metadata`; the declaration lives here.

export const metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
};

export default function UnsubscribeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

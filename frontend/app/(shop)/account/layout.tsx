import AccountGuard from './AccountGuard';

// Private route: crawlable so Google can follow links back out of it, but NEVER
// indexed. robots.txt only disallows /admin and /api, so every page under
// /account — orders, addresses, profile, sign-in — was fully indexable. A
// noindex META rather than a disallow, because a page blocked in robots.txt can
// still be listed with no snippet.
//
// Applies to the whole subtree, which is why it belongs here rather than on
// each page. The auth gate moved to AccountGuard so this file can be a server
// component and declare metadata at all.
export const metadata = {
  title: 'Your account',
  robots: { index: false, follow: true },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AccountGuard>{children}</AccountGuard>;
}

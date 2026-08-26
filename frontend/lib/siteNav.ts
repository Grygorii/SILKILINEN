// The site's secondary navigation, once.
//
// It existed twice, then three times. Footer.tsx held the desktop columns
// inline, FooterMobileNav.tsx kept its own INFO_LINKS and LEGAL_LINKS arrays,
// and the hamburger drawer had neither — it offered SHOP, the categories and
// ABOUT, so the Silk Standard, Style Finder, Journal, size guide, care guide,
// shipping, returns and contact were unreachable from mobile navigation
// entirely. On a phone the drawer IS the navigation, and half the site was not
// in it.
//
// One list, three renderings: desktop columns, a mobile accordion, and the
// drawer. Named for the site rather than the footer now that the drawer reads
// it too — a name that describes only its first caller is how the second
// caller ends up writing its own copy.
//
// The shape follows the UI brief's §19: Shop · Discover · Help · About. The old
// "Info" column carried About, Help and Discover together in a list of seven,
// which is a list rather than a map — someone hunting the care guide scanned
// past Reviews and the Silk Standard to reach it. Splitting it also gives the
// education pages a permanent home in the internal linking, which §68 asks for:
// every page on the site now links to the Standard and the Care Guide.

export type FooterLink = { label: string; href: string };

export type FooterSection = {
  id: string;
  title: string;
  links: FooterLink[];
  /** Renders the cookie-preferences control after the links. */
  hasCookieLink?: boolean;
};

export type ShopCategory = { slug: string; label: string };

/**
 * @param categories live categories, so the Shop column reflects the actual
 *        shape of the catalogue rather than a hardcoded list that goes stale
 *        the first time a category is merged
 */
export function siteSections(categories: ShopCategory[] = []): FooterSection[] {
  return [
    {
      id: 'shop',
      title: 'Shop',
      links: [
        { label: 'New arrivals', href: '/shop?new=true' },
        { label: 'All products', href: '/shop' },
        ...categories.map(c => ({ label: c.label, href: `/shop?category=${c.slug}` })),
        // The short entry point, which 301s to the collection. Worth a footer
        // slot: bridal is the one edit with its own search vocabulary.
        { label: 'Bridal', href: '/bridal' },
      ],
    },
    {
      id: 'discover',
      title: 'Discover',
      links: [
        { label: 'The Silk Standard', href: '/silk-standard' },
        { label: 'Style Finder', href: '/style-finder' },
        { label: 'Journal', href: '/journal' },
        { label: 'Reviews', href: '/reviews' },
      ],
    },
    {
      id: 'help',
      title: 'Help',
      links: [
        { label: 'Shipping', href: '/shipping' },
        { label: 'Returns', href: '/returns' },
        { label: 'Size guide', href: '/size-guide' },
        { label: 'Care guide', href: '/care-guide' },
        { label: 'Contact', href: '/contact' },
      ],
    },
    {
      id: 'about',
      title: 'About',
      links: [
        { label: 'Our story', href: '/about' },
        { label: 'Privacy policy', href: '/privacy-policy' },
        { label: 'Terms & conditions', href: '/terms' },
      ],
      hasCookieLink: true,
    },
  ];
}

import { categoryPath, collectionPath, shopPath } from './urls';

// Shared destinations for the navigation drawer and the storefront footer.

export type FooterLink = { label: string; href: string };

export type FooterSection = {
  id: string;
  title: string;
  links: FooterLink[];
  /** Renders the cookie-preferences control after the links. */
  hasCookieLink?: boolean;
};

export type ShopCategory = { slug: string; label: string };

const allProducts = { label: 'All products', href: shopPath() };
const newArrivals = { label: 'New arrivals', href: shopPath({ isNew: true }) };
const bridal = { label: 'Bridal', href: '/bridal' };
const ourStory = { label: 'Our story', href: '/about' };
const silkStandard = { label: 'The Silk Standard', href: '/silk-standard' };
const styleFinder = { label: 'Style Finder', href: '/style-finder' };
const journal = { label: 'Journal', href: '/journal' };
const reviews = { label: 'Reviews', href: '/reviews' };
const shipping = { label: 'Shipping', href: '/shipping' };
const returns = { label: 'Returns', href: '/returns' };
const sizeGuide = { label: 'Size guide', href: '/size-guide' };
const careGuide = { label: 'Care guide', href: '/care-guide' };
const contact = { label: 'Contact', href: '/contact' };
const legalLinks = [
  { label: 'Privacy policy', href: '/privacy-policy' },
  { label: 'Terms & conditions', href: '/terms' },
];

function categoryLinks(categories: ShopCategory[]): FooterLink[] {
  return categories.map(({ slug, label }) => ({ label, href: categoryPath(slug) }));
}

export function siteSections(categories: ShopCategory[] = []): FooterSection[] {
  return [
    {
      id: 'shop',
      title: 'Shop',
      links: [newArrivals, allProducts, ...categoryLinks(categories), bridal],
    },
    {
      id: 'discover',
      title: 'Discover',
      links: [silkStandard, styleFinder, journal, reviews],
    },
    {
      id: 'help',
      title: 'Help',
      links: [shipping, returns, sizeGuide, careGuide, contact],
    },
    {
      id: 'about',
      title: 'About',
      links: [ourStory, ...legalLinks],
      hasCookieLink: true,
    },
  ];
}

export function footerSections(categories: ShopCategory[], supportEmail: string): FooterSection[] {
  return [
    {
      id: 'explore',
      title: 'Explore SILKILINEN',
      links: [
        { ...allProducts, label: 'Shop all' }, newArrivals,
        { ...bridal, href: collectionPath({ slug: 'the-bridal-edit' }) }, ourStory,
        journal, silkStandard, styleFinder, reviews, ...categoryLinks(categories),
      ],
    },
    {
      id: 'care',
      title: 'Customer care',
      links: [
        { ...shipping, label: 'Delivery' }, returns, sizeGuide, { ...careGuide, label: 'Silk care' },
        { ...contact, label: 'Contact us' }, { label: 'FAQs', href: '/faq' },
        { label: 'Email us', href: `mailto:${supportEmail}` },
      ],
    },
    {
      id: 'legal',
      title: 'Legal',
      links: legalLinks,
      hasCookieLink: true,
    },
  ];
}

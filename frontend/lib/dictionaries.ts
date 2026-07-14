import type { PageLocale } from './i18n';

// UI-chrome strings (the parts NOT stored in the DB). Catalogue content — product
// names, descriptions, category/collection copy — is localised by the backend
// read-merge, so it is NOT duplicated here. This is a starter set for the most
// visible chrome; extend it as more of the UI is wired to t().
export type Dict = {
  nav: { shop: string; journal: string; about: string };
  cta: { explore: string; discoverMore: string; readArticle: string; addToBag: string };
  common: { search: string; account: string; wishlist: string; cart: string; language: string };
};

const DICTS: Record<PageLocale, Dict> = {
  en: {
    nav: { shop: 'Shop', journal: 'Journal', about: 'About' },
    cta: { explore: 'Explore the collection', discoverMore: 'Discover more', readArticle: 'Read article', addToBag: 'Add to bag' },
    common: { search: 'Search', account: 'Account', wishlist: 'Wishlist', cart: 'Cart', language: 'Language' },
  },
  de: {
    nav: { shop: 'Shop', journal: 'Journal', about: 'Über uns' },
    cta: { explore: 'Zur Kollektion', discoverMore: 'Mehr entdecken', readArticle: 'Artikel lesen', addToBag: 'In den Warenkorb' },
    common: { search: 'Suchen', account: 'Konto', wishlist: 'Merkzettel', cart: 'Warenkorb', language: 'Sprache' },
  },
  fr: {
    nav: { shop: 'Boutique', journal: 'Journal', about: 'À propos' },
    cta: { explore: 'Découvrir la collection', discoverMore: 'Découvrir plus', readArticle: 'Lire l’article', addToBag: 'Ajouter au panier' },
    common: { search: 'Rechercher', account: 'Compte', wishlist: 'Favoris', cart: 'Panier', language: 'Langue' },
  },
  it: {
    nav: { shop: 'Negozio', journal: 'Rivista', about: 'Chi siamo' },
    cta: { explore: 'Scopri la collezione', discoverMore: 'Scopri di più', readArticle: 'Leggi l’articolo', addToBag: 'Aggiungi al carrello' },
    common: { search: 'Cerca', account: 'Account', wishlist: 'Preferiti', cart: 'Carrello', language: 'Lingua' },
  },
  es: {
    nav: { shop: 'Tienda', journal: 'Revista', about: 'Nosotros' },
    cta: { explore: 'Descubrir la colección', discoverMore: 'Descubrir más', readArticle: 'Leer artículo', addToBag: 'Añadir a la cesta' },
    common: { search: 'Buscar', account: 'Cuenta', wishlist: 'Favoritos', cart: 'Cesta', language: 'Idioma' },
  },
};

export function getDictionary(locale: PageLocale): Dict {
  return DICTS[locale] || DICTS.en;
}

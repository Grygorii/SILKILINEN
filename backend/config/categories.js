'use strict';

const CATEGORIES = [
  { slug: 'robes',         label: 'Robes' },
  { slug: 'pyjamas',       label: 'Pyjama Sets' },
  { slug: 'sleep-dresses', label: 'Sleep Dresses' },
  { slug: 'lingerie',      label: 'Lingerie' },
  { slug: 'shorts',        label: 'Lounge Shorts' },
  { slug: 'shirts',        label: 'Lounge Shirts' },
  { slug: 'pillowcases',   label: 'Pillowcases' },
  { slug: 'eye-masks',     label: 'Eye Masks' },
  { slug: 'scarves',       label: 'Scarves' },
];

const SLUGS = CATEGORIES.map(c => c.slug);

module.exports = { CATEGORIES, SLUGS };

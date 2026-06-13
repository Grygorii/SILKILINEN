'use strict';

// Lets the human-facing guardians (Prometheus, Maui) see the storefront as a
// visitor does. Best-effort: fetch the live pages on Railway; if they're
// unreachable (sandbox, or the host's bot-shield), fall back to a concise map
// of the experience so the guardians always have something real to judge.

const { fetchReadablePage } = require('./externalData');

const SITE = (process.env.FRONTEND_URL || 'https://www.silkilinen.com').replace(/\/$/, '');
const PAGES = [
  { name: 'Homepage', path: '/' },
  { name: 'Silk Style Finder quiz', path: '/style-finder' },
  { name: 'Shop', path: '/shop' },
];

// Honest map of the journey, used when live pages can't be fetched.
const EXPERIENCE_MAP = `SILKILINEN storefront — a quiet-luxury silk & linen shop.
- Homepage: full-bleed hero image + title/subtitle + "Shop the collection"; a reviews proof strip; New Arrivals carousel; a "Take the Silk Style Finder" band; a reassurance row (free shipping over €150, 14-day returns, gift-ready); featured collections; category tiles; a brand story section ("Born in Donegal"); customer reviews; a journal teaser; newsletter band; Instagram grid; a floating chat widget.
- Style Finder quiz (/style-finder): an intro ("Which silk are you?") → 5 questions (what you're looking for, ideal feel, a colour mood with swatches, silk/linen, who it's for) → a named persona result (e.g. "The Romantic") + a curated product "edit" + optional email capture.
- Shop (/shop): product grid filterable by category; product cards show image, name, price.
- Product page (/product/[id]): images, name, price, colour/size selectors, add to bag, trust row, Drop-a-Hint gifting, description, care.
- Checkout: Stripe payment + express (Apple/Google Pay).
- Voice: considered, warm, quiet luxury; British/Irish English; never claims handmade or made-in-Ireland.`;

async function gatherExperience() {
  const parts = [];
  for (const p of PAGES) {
    const text = await fetchReadablePage(`${SITE}${p.path}`, 2500).catch(() => '');
    if (text && text.length > 200) parts.push(`### ${p.name} (${p.path})\n${text}`);
  }
  return parts.length ? parts.join('\n\n') : EXPERIENCE_MAP;
}

module.exports = { gatherExperience };

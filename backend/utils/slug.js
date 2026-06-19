'use strict';

// Turn a name into a URL-safe slug: "Onyx Black Silk Brief" → "onyx-black-silk-brief".
function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

module.exports = { slugify };

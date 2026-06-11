'use strict';

// Shared allowlist for product writes. Prevents mass-assignment by stripping
// any field not explicitly permitted. Used by both the admin product routes
// and the (admin-auth'd) legacy CRUD routes in routes/products.js.
const PRODUCT_ALLOWED_FIELDS = [
  'name', 'price', 'compareAtPrice', 'description', 'category',
  'colours', 'materialComposition', 'careInstructions', 'momme', 'fitNote',
  'variants', 'totalStock', 'inStock',
  'status', 'keywords', 'metaTitle', 'metaDescription', 'slug',
  'altTextTemplate', 'origin', 'isNewArrival', 'aiPhotoDescriptor',
  'gender', 'ageGroup',
];

function pickProductFields(body) {
  const out = {};
  const stripped = [];
  for (const k of Object.keys(body || {})) {
    if (PRODUCT_ALLOWED_FIELDS.includes(k)) {
      out[k] = body[k];
    } else if (k !== 'images' && k !== 'productVideo' && k !== 'createEmptyDraft') {
      // images/productVideo are managed by dedicated endpoints; createEmptyDraft
      // is a control flag, not a field — don't log those as stripped.
      stripped.push(k);
    }
  }
  if (stripped.length) {
    console.warn('[products] stripped non-allowlisted fields from request body:', stripped);
  }
  return out;
}

module.exports = { PRODUCT_ALLOWED_FIELDS, pickProductFields };

const FAL_CATEGORIES = new Set(['lingerie']);

function shouldUseFal(category) {
  return FAL_CATEGORIES.has(category);
}

module.exports = { FAL_CATEGORIES, shouldUseFal };

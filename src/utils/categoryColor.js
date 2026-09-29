// Maps each ASK category to a token-based accent color, so Discover's
// category tags are scannable at a glance instead of every category
// rendering in the same red-accent text. Falls back to the brand red for
// any category not listed here (keeps this safe if a new category is
// ever added to mocks/categories.js without updating this map).
const CATEGORY_COLOR_VARS = {
  Design: '--c-red-deep',
  Writing: '--c-info',
  Development: '--c-success',
  Photography: '--c-warning',
  Marketing: '--red',
  Tutoring: '--c-category-plum',
  Events: '--burgundy',
}

export function getCategoryColorVar(category) {
  return CATEGORY_COLOR_VARS[category] ?? '--c-red-accent'
}

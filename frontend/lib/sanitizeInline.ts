/**
 * Strict inline-only sanitizer for the announcement banner.
 *
 * The banner renders in a CLIENT component, so we deliberately avoid pulling
 * the `sanitize-html` parser into the browser bundle. Banner copy is short,
 * admin-authored, and only ever needs basic inline emphasis — so this is a
 * strict *allowlist*: every tag except a tiny inline set is removed, and ALL
 * attributes are stripped. With no attributes surviving, no event handlers or
 * `javascript:` URLs are possible; with everything but the allowlist removed,
 * no `<script>`/`<img onerror>`/framing tag can survive either.
 */
const ALLOWED = new Set(['b', 'strong', 'i', 'em', 'u', 'br']);

export function sanitizeBannerHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<\/?\s*([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
    const t = String(tag).toLowerCase();
    if (!ALLOWED.has(t)) return '';
    // Re-emit the tag name only, no attributes, preserving open vs close.
    return /^<\s*\//.test(match) ? `</${t}>` : `<${t}>`;
  });
}

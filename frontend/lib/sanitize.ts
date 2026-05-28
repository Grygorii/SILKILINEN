/**
 * Server-safe HTML sanitizer for SSR-rendered article bodies.
 *
 * Why this exists: `isomorphic-dompurify` brings a jsdom dependency that
 * blows up during Next.js 16 / Turbopack server rendering — both journal
 * article slug pages were returning HTTP 500 because of it. This is a
 * regex-based replacement that runs cleanly in any JS environment
 * (Node, edge, browser) without touching the DOM.
 *
 * Scope of trust: the only input is admin-authored TipTap output (the
 * editor in /admin/journal). TipTap emits a predictable, structured tag
 * set; this sanitizer is sized to that threat model — strip script/iframe
 * /object/embed shells, drop inline event handlers, neuter
 * `javascript:` URLs. NOT a general-purpose XSS scrubber for arbitrary
 * untrusted HTML.
 */
export function sanitizeArticleHtml(html: string): string {
  if (!html) return '';
  return html
    // Drop <script>…</script> and any text content inside it
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    // Drop <style>…</style> (TipTap doesn't emit it; if it ever appears it's hostile)
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    // Strip framing tags that can host hostile content (open or close)
    .replace(/<\/?(iframe|object|embed|frame|frameset|applet|base|link|meta)\b[^>]*>/gi, '')
    // Strip inline event handlers from any tag (onclick, onload, onerror, …)
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    // Neuter javascript:/vbscript:/data: URIs in href/src
    .replace(/(href|src)\s*=\s*"\s*(?:javascript|vbscript|data)\s*:[^"]*"/gi, '$1=""')
    .replace(/(href|src)\s*=\s*'\s*(?:javascript|vbscript|data)\s*:[^']*'/gi, '$1=""');
}

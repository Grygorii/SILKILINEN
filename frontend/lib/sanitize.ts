/**
 * Parser-based HTML sanitizer for SSR-rendered article bodies (journal pages).
 *
 * Uses `sanitize-html` (htmlparser2 under the hood — NO jsdom), so it runs in
 * the Next.js Node server runtime without the build/SSR failures that
 * `isomorphic-dompurify` caused. Unlike the previous regex sanitizer, this is a
 * real tokenizing allowlist: anything not explicitly permitted is dropped, so
 * `<svg onload>`, split/newline event handlers, and nested `<scr<script>ipt>`
 * payloads cannot survive.
 *
 * IMPORTANT: import this only from server components. For the client-side
 * announcement banner use `sanitizeBannerHtml` from `./sanitizeInline`, which
 * keeps this dependency out of the browser bundle.
 */
import sanitizeHtml from 'sanitize-html';

const ARTICLE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'blockquote', 'pre', 'code',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark',
    'ul', 'ol', 'li',
    'a', 'img', 'figure', 'figcaption', 'span', 'div',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  // Strip the tag AND its text content for these (don't leak script source as text).
  nonTextTags: ['script', 'style', 'textarea', 'noscript', 'iframe', 'object', 'embed'],
  // Any link that opens in a new tab gets safe rel.
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, false),
  },
};

export function sanitizeArticleHtml(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html, ARTICLE_OPTIONS);
}

// Serialise a JSON-LD object for embedding in a <script> tag. Escapes '<' as
// its unicode form so a value containing '</script>' can't break out of the
// tag (a latent XSS vector). The data is admin-authored today, so this is
// defence-in-depth — but it's the correct way to inline JSON in HTML.
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

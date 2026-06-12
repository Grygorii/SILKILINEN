// A social link must be an absolute http(s) URL. Admin-supplied values are
// rendered straight into an <a href> (footer + side menu) and the homepage
// Organization `sameAs`, so a malformed entry — e.g. a stray "£" or "$" —
// would emit a same-origin link like /£ that Google then crawls and reports
// as a 404. A "javascript:"/"data:" value would also be an injection vector.
// Accept only real external http(s) URLs.
export function isValidSocialUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

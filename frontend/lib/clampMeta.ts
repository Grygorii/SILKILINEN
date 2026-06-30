// Keep a meta description at Google's ~160-char snippet limit, trimming at a
// word boundary with an ellipsis so it never gets truncated mid-word in results.
export function clampMeta(s: string | undefined | null, max = 160): string {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

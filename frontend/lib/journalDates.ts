export type JournalTimestampSource = {
  status: 'draft' | 'preview' | 'published';
  publishedAt: string | null;
  updatedAt: string;
};

export function timeAgo(iso: string, now = Date.now()): string {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return 'recently';
  const minutes = Math.max(0, Math.floor((now - at) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatJournalDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'date unavailable';
  return date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Published is an editorial fact; updated is working-state information. Keeping
// the two separate prevents a reader or an autosave from making an old article
// look newly published in the Journal library.
export function journalCardTimestamp(article: JournalTimestampSource, now = Date.now()) {
  if (article.status === 'published' && article.publishedAt) {
    const published = formatJournalDate(article.publishedAt);
    return {
      label: `Published ${published}`,
      title: `Published ${published}.`,
    };
  }

  const updated = timeAgo(article.updatedAt, now);
  return { label: `Updated ${updated}`, title: `Last edited ${updated}.` };
}

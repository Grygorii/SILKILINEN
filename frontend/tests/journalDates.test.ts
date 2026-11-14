import { describe, expect, it } from 'vitest';
import { journalCardTimestamp } from '@/lib/journalDates';

describe('Journal library timestamps', () => {
  it('uses the true publication date for a published article, not its last edit', () => {
    const timestamp = journalCardTimestamp({
      status: 'published',
      publishedAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-11-14T11:59:00.000Z',
    }, Date.parse('2026-11-14T12:00:00.000Z'));

    expect(timestamp.label).toContain('Published');
    expect(timestamp.label).toContain('2026');
    expect(timestamp.label).not.toContain('just now');
    expect(timestamp.title).toBeTruthy();
    expect(timestamp.title).not.toContain('Last edited');
  });

  it('keeps relative edit time for work that has not been published', () => {
    const timestamp = journalCardTimestamp({
      status: 'draft',
      publishedAt: null,
      updatedAt: '2026-11-14T10:00:00.000Z',
    }, Date.parse('2026-11-14T12:00:00.000Z'));

    expect(timestamp.label).toBe('Updated 2h ago');
  });
});

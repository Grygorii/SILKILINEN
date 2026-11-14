import { describe, expect, it } from 'vitest';
import pkg from '../services/journalInsights.js';

const { buildJournalIdeas, normaliseJournalDays, topicIsCovered } = pkg;

const articles = [
  { _id: 'article-1', slug: 'how-to-wash-silk', title: 'How to Wash Silk', keywords: ['silk care', 'washing silk'] },
];

describe('Journal Factory evidence', () => {
  it('uses only supported reporting periods', () => {
    expect(normaliseJournalDays('7')).toBe(7);
    expect(normaliseJournalDays('999')).toBe(30);
  });

  it('turns a query already served by a journal article into a refresh, not a duplicate', () => {
    const ideas = buildJournalIdeas({
      articles,
      googleQueries: [{ query: 'how to wash silk', impressions: 140, clicks: 2, position: 12.2 }],
      journalQueryRows: [{ query: 'how to wash silk', page: 'https://www.silkilinen.com/journal/how-to-wash-silk', impressions: 140, clicks: 2, position: 12.2 }],
      siteSearches: [],
    });

    expect(ideas).toHaveLength(1);
    expect(ideas[0]).toMatchObject({ kind: 'refresh', articleId: 'article-1', articleSlug: 'how-to-wash-silk' });
  });

  it('does not suggest an article whose topic is already covered', () => {
    expect(topicIsCovered('how to wash silk care', articles)).toBe(true);
    const ideas = buildJournalIdeas({
      articles,
      googleQueries: [{ query: 'how to wash silk care', impressions: 22, clicks: 0, position: 18 }],
      journalQueryRows: [],
      siteSearches: [],
    });
    expect(ideas).toEqual([]);
  });

  it('marks a no-result on-site search as research before a draft', () => {
    const ideas = buildJournalIdeas({ articles, googleQueries: [], journalQueryRows: [], siteSearches: [{ term: 'silk travel pouch', sessions: 3, searches: 4 }] });
    expect(ideas[0]).toMatchObject({ kind: 'research', topic: 'silk travel pouch', source: 'On-site search' });
  });
});

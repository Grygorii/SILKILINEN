import { describe, it, expect } from 'vitest';
import pkg from '../services/manualHermes.js';
import hermes from '../services/growthAgents/hermes.js';

const {
  HERMES_CONTRACT, buildManualHermesPrompt, validateManualHermesImport, growthActionFor,
} = pkg;
const { createCanonicalPageResolver } = hermes;

function task() {
  return {
    _id: 'hermes-task-123',
    snapshotId: 'snapshot-abc',
    snapshot: {
      preparedAt: '2026-11-14T10:00:00.000Z',
      range: { days: 28, startDate: '2026-10-17', endDate: '2026-11-13', dataState: 'final' },
      totals: { clicks: 3, impressions: 120, position: 14.2 },
      queries: [
        { query: 'silk pillowcase', position: 11.4, impressions: 12, clicks: 1 },
        { query: 'silk robe', position: 8.2, impressions: 22, clicks: 2 },
      ],
      entities: {
        product: [{ ref: 'Silk pillowcase in Champagne', id: 'product-1' }],
        category: [{ ref: 'home', id: 'category-1' }],
        collection: [{ ref: 'sleep', id: 'collection-1' }],
        page: [{ ref: '/journal', id: '/journal' }],
      },
      markets: { minImpressions: 100, basis: 'all', headline: '', rows: [] },
      topPages: [],
      missingMeta: [],
      demandPhrases: [],
      competitorNotes: [],
      cannibalisation: [{ query: 'silk robe', pages: [] }],
    },
  };
}

function response(change = {}) {
  return JSON.stringify({
    contract: HERMES_CONTRACT,
    schemaVersion: 1,
    taskId: 'hermes-task-123',
    snapshotId: 'snapshot-abc',
    state: 'actionable',
    read: 'Silk pillowcase is the clearest early foothold; improve its relevance before broadening the plan.',
    plays: [{
      target: 'silk pillowcase',
      intent: 'transactional',
      kind: 'meta',
      entityType: 'product',
      entityRef: 'Silk pillowcase in Champagne',
      position: 11.4,
      impressions: 12,
      issue: 'The product has a real page-two foothold but its title does not clearly answer the query.',
      action: 'Review the existing product title and description for a more precise silk-pillowcase match.',
      leverage: 'high',
      ...change,
    }],
  });
}

describe('Manual Hermes packets', () => {
  it('shares the live Hermes canonical-page rule, so redirect aliases are not counted as a second page', () => {
    const canonical = createCanonicalPageResolver([
      { _id: 'p1', slug: 'silk-pillowcase-in-sage-green', previousSlugs: ['mulberry-silk-pillowcase-sage-green'] },
    ], [{ slug: 'home' }]);
    expect(canonical('/product/mulberry-silk-pillowcase-sage-green')).toBe('/product/silk-pillowcase-in-sage-green');
    expect(canonical('/shop?category=pillowcases')).toBeNull();
  });

  it('prepares a provider-neutral prompt without leaking internal entity ids', () => {
    const prompt = buildManualHermesPrompt(task());
    expect(prompt).toContain(HERMES_CONTRACT);
    expect(prompt).toContain('snapshot-abc');
    expect(prompt).toContain('QUIET LUXURY');
    expect(prompt).toContain('Silk pillowcase in Champagne');
    expect(prompt).not.toContain('product-1');
  });

  it('accepts one complete response only when task, snapshot, evidence and entity reference all match', () => {
    const checked = validateManualHermesImport(`\`\`\`json\n${response()}\n\`\`\``, task());
    expect(checked.ok).toBe(true);
    expect(checked.read).toContain('clearest early foothold');
    expect(checked.plays[0]).toMatchObject({ key: 'play-1', entityId: 'product-1', position: 11.4, impressions: 12 });
  });

  it('refuses another task or snapshot, invented evidence, out-of-scope refs and extra fields', () => {
    expect(validateManualHermesImport(response({ snapshotId: 'other-snapshot' }), task()).ok).toBe(false);
    expect(validateManualHermesImport(response({ position: 9 }), task()).ok).toBe(false);
    expect(validateManualHermesImport(response({ entityRef: 'Invented product' }), task()).ok).toBe(false);
    const extra = JSON.parse(response());
    extra.lesson = 'Do not import this.';
    expect(validateManualHermesImport(JSON.stringify(extra), task()).ok).toBe(false);
  });

  it('keeps Hermes’ one-entity and no-new-content-for-cannibalised-query guards', () => {
    expect(validateManualHermesImport(response({
      target: 'silk robe', intent: 'informational', kind: 'content', entityType: 'page', entityRef: '/journal', position: 8.2, impressions: 22,
    }), task()).ok).toBe(false);
    const duplicate = JSON.parse(response());
    duplicate.plays.push({ ...duplicate.plays[0], target: 'silk robe', position: 8.2, impressions: 22 });
    expect(validateManualHermesImport(JSON.stringify(duplicate), task()).ok).toBe(false);
  });

  it('builds an approval-queue action only; it contains no catalogue mutation payload', () => {
    const checked = validateManualHermesImport(response(), task());
    const action = growthActionFor(checked.plays[0], task());
    expect(action).toMatchObject({ agent: 'hermes', type: 'seo', status: 'needs_approval' });
    expect(action.meta).toMatchObject({ source: 'manual-ai', entityId: 'product-1', manualHermesSnapshotId: 'snapshot-abc' });
    expect(action).not.toHaveProperty('update');
    expect(action.meta).not.toHaveProperty('metaTitle');
  });
});

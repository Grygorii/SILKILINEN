import { describe, it, expect } from 'vitest';
import workspace from '../services/manualAiWorkspace.js';

const {
  SEO_CONTRACT, buildSeoPrompt, validateSeoImport, snapshotMatches,
} = workspace;

function task() {
  return {
    _id: 'task-123',
    targets: [{
      key: 'product:p1', type: 'product', resourceId: 'p1', label: 'Silk Pillowcase', url: 'https://example.test/product/pillowcase',
      snapshot: {
        metaTitle: 'Old title', metaDescription: 'Old description', updatedAt: new Date('2026-01-01T00:00:00Z'),
        context: { kind: 'product', name: 'Silk Pillowcase', description: 'A 22 momme mulberry silk pillowcase.', materialComposition: '100% Mulberry silk' },
      },
    }],
  };
}

function response(change = {}) {
  return JSON.stringify({
    contract: SEO_CONTRACT, schemaVersion: 1, taskId: 'task-123',
    changes: [{ key: 'product:p1', metaTitle: 'Mulberry Silk Pillowcase, 22 Momme — SILKILINEN', metaDescription: 'A 22 momme mulberry silk pillowcase, cool and smooth against skin, thoughtfully made for a more restful evening routine.', ...change }],
  });
}

describe('Manual AI SEO packets', () => {
  it('creates a self-contained provider-neutral prompt with no editable database id', () => {
    const prompt = buildSeoPrompt(task());
    expect(prompt).toContain(SEO_CONTRACT);
    expect(prompt).toContain('product:p1');
    expect(prompt).toContain('untrusted reference data');
    expect(prompt).not.toContain('resourceId');
  });

  it('accepts a complete code-fenced response and surfaces length warnings for review', () => {
    const result = validateSeoImport(`\`\`\`json\n${response()}\n\`\`\``, task());
    expect(result.ok).toBe(true);
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].metaTitle).toContain('Mulberry Silk');
  });

  it('refuses another task, unknown fields, missing targets and forbidden origin claims', () => {
    expect(validateSeoImport(response({ key: 'product:other' }), task()).ok).toBe(false);
    expect(validateSeoImport(JSON.stringify({ contract: SEO_CONTRACT, schemaVersion: 1, taskId: 'task-123', changes: [{ key: 'product:p1', metaTitle: 'Silk pillowcase made in Ireland', metaDescription: 'A restful silk layer for your pillow.', slug: 'not-allowed' }] }), task()).ok).toBe(false);
    expect(validateSeoImport(JSON.stringify({ contract: SEO_CONTRACT, schemaVersion: 1, taskId: 'task-123', changes: [] }), task()).ok).toBe(false);
  });

  it('does not permit a stale snapshot to overwrite newer metadata', () => {
    const target = task().targets[0];
    expect(snapshotMatches(target, { metaTitle: 'Old title', metaDescription: 'Old description', updatedAt: new Date('2026-01-01T00:00:00Z') })).toBe(true);
    expect(snapshotMatches(target, { metaTitle: 'Someone changed this', metaDescription: 'Old description', updatedAt: new Date('2026-01-02T00:00:00Z') })).toBe(false);
  });
});

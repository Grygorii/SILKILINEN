import { describe, it, expect } from 'vitest';
import workspace from '../services/manualAiWorkspace.js';

const {
  SEO_CONTRACT, buildSeoPrompt, validateSeoImport, snapshotMatches,
} = workspace;
const additional = require('../services/manualAiAdditionalWorkflows');

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

function translationTask() {
  return {
    _id: 'translation-123', taskType: additional.TRANSLATION_TASK, locale: 'fr',
    targets: [{
      key: 'translation:product:p1', type: 'product', resourceId: 'p1', label: 'Silk Pillowcase', url: '/product/pillowcase',
      snapshot: {
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        context: {
          locale: 'fr', sourceFields: {
            name: 'SILKILINEN Silk Pillowcase',
            description: 'A 22 momme silk pillowcase.',
          }, existingFields: {}, existingSource: '', translationUpdatedAt: null,
        },
      },
    }],
  };
}

function copyTask() {
  return {
    _id: 'copy-123', taskType: additional.COPY_TASK,
    targets: [{
      key: 'copy:p1', type: 'product', resourceId: 'p1', label: 'Silk Pillowcase', url: '/product/pillowcase',
      snapshot: {
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        context: {
          name: 'Silk Pillowcase', description: 'A smooth mulberry silk pillowcase.',
          facts: { category: 'home', materialComposition: '100% Mulberry silk', colours: ['Champagne'], momme: '22', fitNote: '', careInstructions: '', certifications: [] },
        },
      },
    }],
  };
}

function imageTask() {
  return {
    _id: 'alt-123', taskType: additional.IMAGE_ALT_TASK,
    targets: [{
      key: 'image:p1:i1', type: 'image', resourceId: 'p1', label: 'Silk slip dress - image 1', url: '/product/slip-dress',
      snapshot: {
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        context: {
          imageId: 'i1', name: 'Silk slip dress',
          image: { url: 'https://example.test/image.jpg', alt: '', associatedColour: 'Champagne', slot: 'hero', cloudinaryPublicId: 'p1/image', order: 0, isPrimary: true },
          facts: { category: 'robes', materialComposition: '100% Mulberry silk', colours: ['Champagne'], momme: '19', fitNote: '' },
        },
      },
    }],
  };
}

describe('Manual AI additional workflow packets', () => {
  it('creates a fixed translation packet and accepts only its selected fields and locale', () => {
    const task = translationTask();
    const prompt = additional.buildWorkflowPrompt(task);
    expect(prompt).toContain('silkilinen.external-ai.translation.v1');
    expect(prompt).toContain('French');
    expect(prompt).not.toContain('resourceId');
    const response = JSON.stringify({
      contract: 'silkilinen.external-ai.translation.v1', schemaVersion: 1, taskId: 'translation-123', locale: 'fr',
      changes: [{ key: 'translation:product:p1', fields: { name: 'Taie d’oreiller en soie SILKILINEN', description: 'Une taie d’oreiller en soie de 22 momme.' } }],
    });
    expect(additional.validateWorkflowImport(response, task).ok).toBe(true);
    expect(additional.validateWorkflowImport(response.replace('"fr"', '"de"'), task).ok).toBe(false);
    expect(additional.validateWorkflowImport(JSON.stringify({
      contract: 'silkilinen.external-ai.translation.v1', schemaVersion: 1, taskId: 'translation-123', locale: 'fr',
      changes: [{ key: 'translation:product:p1', fields: { name: 'Taie SILKILINEN', description: 'Une taie de 22 momme.', price: '20' } }],
    }), task).ok).toBe(false);
  });

  it('only accepts a bounded, factual catalogue-copy paragraph for the exact product', () => {
    const task = copyTask();
    const paragraph = 'The smooth 22 momme mulberry silk surface brings a quiet, considered finish to the bed, with a naturally gentle feel against the skin and a refined Champagne tone that sits easily within a calm evening ritual at home, bringing understated softness to a carefully composed bedroom.';
    const response = JSON.stringify({
      contract: 'silkilinen.external-ai.catalogue-copy.v1', schemaVersion: 1, taskId: 'copy-123',
      changes: [{ key: 'copy:p1', append: paragraph }],
    });
    const checked = additional.validateWorkflowImport(response, task);
    expect(checked.ok).toBe(true);
    expect(checked.proposals[0].text).toBe(paragraph);
    expect(additional.validateWorkflowImport(JSON.stringify({
      contract: 'silkilinen.external-ai.catalogue-copy.v1', schemaVersion: 1, taskId: 'copy-123',
      changes: [{ key: 'copy:p1', append: paragraph, price: '10' }],
    }), task).ok).toBe(false);
  });

  it('only accepts concise reviewed image alt text and detects changed source snapshots', () => {
    const task = imageTask();
    const response = JSON.stringify({
      contract: 'silkilinen.external-ai.image-alt.v1', schemaVersion: 1, taskId: 'alt-123',
      changes: [{ key: 'image:p1:i1', alt: 'Champagne silk slip dress, front view' }],
    });
    expect(additional.validateWorkflowImport(response, task).ok).toBe(true);
    expect(additional.validateWorkflowImport(JSON.stringify({
      contract: 'silkilinen.external-ai.image-alt.v1', schemaVersion: 1, taskId: 'alt-123',
      changes: [{ key: 'image:p1:i1', alt: 'Image of SILKILINEN silk dress' }],
    }), task).ok).toBe(false);
    const target = task.targets[0];
    const unchanged = {
      id: 'p1', imageId: 'i1', name: 'Silk slip dress', updatedAt: new Date('2026-01-01T00:00:00Z'),
      image: { url: 'https://example.test/image.jpg', alt: '', associatedColour: 'Champagne', slot: 'hero', cloudinaryPublicId: 'p1/image', order: 0, isPrimary: true },
      facts: { category: 'robes', materialComposition: '100% Mulberry silk', colours: ['Champagne'], momme: '19', fitNote: '' },
    };
    expect(additional.imageSnapshotMatches(target, unchanged)).toBe(true);
    expect(additional.imageSnapshotMatches(target, { ...unchanged, image: { ...unchanged.image, url: 'https://example.test/replaced.jpg' } })).toBe(false);
  });
});

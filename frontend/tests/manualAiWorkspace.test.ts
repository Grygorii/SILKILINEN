import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const panel = readFileSync('app/admin/seo/ManualAiPanel.tsx', 'utf8');
const seoPage = readFileSync('app/admin/seo/page.tsx', 'utf8');
const manualAiPage = readFileSync('app/admin/manual-ai/page.tsx', 'utf8');
const additional = readFileSync('app/admin/manual-ai/ManualAiAdditionalWorkflows.tsx', 'utf8');
const hermes = readFileSync('app/admin/manual-ai/ManualHermesPanel.tsx', 'utf8');
const adminLayout = readFileSync('components/AdminLayout.tsx', 'utf8');

describe('Manual AI SEO workspace', () => {
  it('has its own left-menu workspace and keeps the workflow review-first', () => {
    expect(manualAiPage).toContain("import ManualAiPanel from '../seo/ManualAiPanel'");
    expect(manualAiPage).toContain('Manual AI');
    expect(adminLayout).toContain("href: '/admin/manual-ai'");
    expect(seoPage).not.toContain("import ManualAiPanel from './ManualAiPanel'");
    expect(panel).toContain('Prepare prompt');
    expect(panel).toContain('Validate response');
    expect(panel).toContain('Apply selected');
    expect(seoPage).toContain('Run connected Hermes');
    expect(seoPage).toContain('Prepare prompt for Codex');
  });

  it('uses the protected server workflow for every mutation', () => {
    expect(panel).toContain('/api/admin/manual-ai/tasks/seo-meta/prepare');
    expect(panel).toContain('/import`');
    expect(panel).toContain('/apply`');
    expect(panel).toContain("'X-CSRF-Token': '1'");
    expect(panel).not.toContain('/api/admin/seo-base`, {\n        method: \'PATCH\'');
  });

  it('keeps Manual Hermes as a separate, review-only hand-off', () => {
    expect(manualAiPage).toContain("import ManualHermesPanel from './ManualHermesPanel'");
    expect(manualAiPage).toContain('<ManualHermesPanel />');
    expect(hermes).toContain('id="hermes"');
    expect(hermes).toContain('/api/admin/manual-ai/hermes/prepare');
    expect(hermes).toContain('/hermes/runs/${task.id}/import');
    expect(hermes).toContain('/hermes/runs/${task.id}/publish');
    expect(hermes).toContain('Copy prompt');
    expect(hermes).toContain('Send selected to SEO review');
    expect(hermes).not.toContain('/api/admin/growth/run');
  });

  it('keeps translations, catalogue copy and image-alt text as separate protected workflows', () => {
    expect(manualAiPage).toContain("import ManualAiAdditionalWorkflows from './ManualAiAdditionalWorkflows'");
    expect(manualAiPage).toContain('<ManualAiAdditionalWorkflows />');
    expect(additional).toContain('translation_v1');
    expect(additional).toContain('catalogue_copy_v1');
    expect(additional).toContain('image_alt_v1');
    expect(additional).toContain('/api/admin/manual-ai/tasks/options/${workflow}');
    expect(additional).toContain('/api/admin/manual-ai/tasks/${config.route}/prepare');
    expect(additional).toContain('/import`');
    expect(additional).toContain('/apply`');
    expect(additional).toContain("'X-CSRF-Token': '1'");
    expect(additional).toContain('Attach these exact images');
    expect(additional).not.toContain('/api/admin/translations`');
    expect(additional).not.toContain('/api/admin/products/');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const panel = readFileSync('app/admin/seo/ManualAiPanel.tsx', 'utf8');
const seoPage = readFileSync('app/admin/seo/page.tsx', 'utf8');
const manualAiPage = readFileSync('app/admin/manual-ai/page.tsx', 'utf8');
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
  });

  it('uses the protected server workflow for every mutation', () => {
    expect(panel).toContain('/api/admin/manual-ai/tasks/seo-meta/prepare');
    expect(panel).toContain('/import`');
    expect(panel).toContain('/apply`');
    expect(panel).toContain("'X-CSRF-Token': '1'");
    expect(panel).not.toContain('/api/admin/seo-base`, {\n        method: \'PATCH\'');
  });
});

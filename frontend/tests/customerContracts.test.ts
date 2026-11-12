import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const source = (path: string) => readFileSync(path, 'utf8');
describe('customer admin HTTP contracts', () => {
  it('uses GET for CSV and personal-data exports', () => {
    expect(source('app/admin/customers/page.tsx')).toContain("'customers.csv', { method: 'GET' }");
    expect(source('app/admin/customers/[id]/page.tsx')).toContain("`gdpr-export-${id}.json`, { method: 'GET' }");
  });
  it('guards stale list responses and uses the server page count', () => {
    const code = source('app/admin/customers/page.tsx');
    expect(code).toContain('activeRequest.current?.abort()');
    expect(code).toContain('sequence !== requestNumber.current');
    expect(code).toContain('disabled={page >= pages}');
    expect(code).toContain('Guest buyer');
  });
  it('uses the CSRF-aware API helper for edits and logout', () => {
    expect(source('app/admin/customers/[id]/page.tsx')).toContain('await api.put(');
    expect(source('context/CustomerContext.tsx')).toContain("await api.post('/api/customers/logout')");
  });
});

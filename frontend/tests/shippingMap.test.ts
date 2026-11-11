import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'components/ShippingMap.tsx'), 'utf8');

describe('ShippingMap', () => {
  it('lists the confirmed shipment destination countries', () => {
    const confirmed = ['Ireland', 'United Kingdom', 'France', 'Germany', 'Austria', 'Italy', 'Denmark', 'Finland', 'United States', 'Canada', 'Australia'];
    for (const country of confirmed) expect(source).toContain(`'${country}'`);
  });

  it('marks routes as illustrative and protects customer privacy', () => {
    expect(source).toContain('Illustrative route');
    expect(source).toContain('Routes are illustrative');
    expect(source).toContain('do not show');
    expect(source).toContain('customer addresses');
  });
});

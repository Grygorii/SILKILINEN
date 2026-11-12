import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { destinationsFor, CONFIRMED_DESTINATIONS, projectLocation, mapView, journeyPath } from '../lib/shippingDestinations';
import { DELIVERY_COUNTRIES } from '../lib/deliveryCountries';
const component = readFileSync('components/ShippingMap.tsx','utf8');

describe('truthful shipping map', () => {
  it('starts with exactly the eleven founder-confirmed countries', () => {
    expect(destinationsFor('shipped').map(d=>d.code).sort()).toEqual(['AT','AU','CA','DE','DK','FI','FR','GB','IE','IT','US']);
    expect(CONFIRMED_DESTINATIONS).toHaveLength(11);
  });
  it('offers precisely the same countries as checkout, not an invented worldwide promise', () => {
    expect(destinationsFor('available').map(d=>d.code)).toEqual([...DELIVERY_COUNTRIES]);
    expect(readFileSync('app/(shop)/checkout/page.tsx','utf8')).toContain('const ALLOWED_COUNTRIES = DELIVERY_COUNTRIES;');
  });
  it('adds confirmed website shipment countries without duplicating or trusting unknown values', () => {
    const actual=destinationsFor('shipped',['FR','NZ','XX','<script>']);
    expect(actual).toHaveLength(12);
    expect(actual.some(d=>d.code==='NZ')).toBe(true);
    expect(destinationsFor('shipped').some(d=>d.code==='NZ')).toBe(false);
  });
  it('keeps country positions inside their view and produces finite routes', () => {
    for (const d of destinationsFor('available')) {
      const [x,y]=projectLocation(d.longitude,d.latitude);
      const [vx,vy,w,h]=mapView(d).split(' ').map(Number);
      expect(x).toBeGreaterThanOrEqual(vx);expect(x).toBeLessThanOrEqual(vx+w);
      expect(y).toBeGreaterThanOrEqual(vy);expect(y).toBeLessThanOrEqual(vy+h);
      expect(journeyPath(d)).not.toMatch(/NaN|Infinity/);
    }
  });
  it('labels possible delivery separately and does not claim live courier tracking', () => {
    expect(component).toContain('not a claim of a past order');
    expect(component).toContain('not a live parcel location');
    expect(component).toContain('do not show customer addresses');
    expect(component).toContain("mode === 'shipped'");
    expect(component).toContain('IntersectionObserver');
    expect(component).toContain('prefers-reduced-motion');
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { captureAcquisition } from '../lib/acquisition';
import { readCheckoutAttribution } from '../lib/checkoutAttribution';
const source=(path:string)=>readFileSync(path,'utf8');
const input={search:'',referrer:'',pathname:'/shop',hostname:'www.silkilinen.com'};
const store=()=>{const values=new Map<string,string>();return{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value)}}};
describe('reporting UI contracts',()=>{
 it('shows missing purchase rate as unknown',()=>{const p=source('app/admin/_components/dashboard/FunnelPanel.tsx');expect(p).toContain('Purchase conversion: unknown');expect(p).toContain('stage.progressed');expect(p).not.toContain('% of visitors bought');});
 it('shows order-level source evidence',()=>{const p=source('app/admin/_components/dashboard/Zone3Working.tsx');expect(p).toContain('unknown, not 0%');expect(p).toContain('Where each order came from');});
 it('shows comparison windows and percentage-point CTR changes',()=>{const p=source('app/admin/_components/dashboard/SearchPerformancePanel.tsx');expect(p).toContain('previousRange.startDate');expect(p).toContain('percentage points');expect(p).toContain('not a fixed page rank');});
 it('marks historical strategies and loads current evidence',()=>{const p=source('app/admin/growth/page.tsx');expect(p).toContain('Historical strategy');expect(p).toContain('90 * 86400000');expect(p).toContain('<EvidencePanel');});
 it('loads Hermes specifically',()=>{expect(source('app/admin/seo/page.tsx')).toContain('/api/admin/growth?agent=hermes');});
 it('labels incomplete and completed replay journeys honestly',()=>{const p=source('app/admin/journeys/page.tsx');expect(p).toContain("'incomplete journeys'");expect(p).toContain("'completed browser journeys'");expect(p).toContain("j.outcome === 'purchased' ? 'paid' : 'stopped'");expect(p).toContain('purchase-page event');expect(p).toContain('manual/offline order');expect(p).toContain('rate unknown');});
 it('makes wishlist reminders consent-safe and honest about sampled readiness',()=>{const p=source('app/admin/marketing/wishlist/page.tsx');expect(p).toContain('Guest wishlist saves stay');expect(p).toContain('email is verified');expect(p).toContain('Existing saves without a recorded date');expect(p).toContain('view only. It does not send an email on demand');expect(p).toContain('minimumOrderValue');expect(p).toContain('validUntil');expect(p).toContain('Ready in reviewed sample');expect(p).toContain('automation needs an offer and email delivery');});
 it('sends signed-in wishlist writes with the CSRF header and reconciles failed writes',()=>{const p=source('context/WishlistContext.tsx');expect((p.match(/X-CSRF-Token/g)||[]).length).toBeGreaterThanOrEqual(3);expect(p).toContain("if (!res.ok) throw new Error('Could not merge wishlist')");expect(p).toContain("if (!res.ok) throw new Error('Could not remove wishlist item')");expect(p).toContain("if (!res.ok) throw new Error('Could not add wishlist item')");});
});
describe('arrival to checkout metadata',()=>{
 it('preserves campaign tags',()=>{const s=store();captureAcquisition(s,{...input,search:'?utm_source=instagram&utm_medium=social&utm_campaign=november'});expect(readCheckoutAttribution(s)).toMatchObject({source:'instagram',medium:'social',campaign:'november',landingPage:'/shop'});});
 it('detects organic Google without storing private referrer query data',()=>{const s=store();captureAcquisition(s,{...input,referrer:'https://www.google.com/search?q=private'});expect(readCheckoutAttribution(s)).toMatchObject({source:'google',medium:'organic',referrer:'https://www.google.com'});});
 it('does not count itself as a referral',()=>{const s=store();captureAcquisition(s,{...input,referrer:'https://www.silkilinen.com/admin/products'});expect(readCheckoutAttribution(s).source).toBe('direct');});
 it('does not overwrite arrival source on internal browsing',()=>{const s=store();captureAcquisition(s,{...input,referrer:'https://www.google.com/'});captureAcquisition(s,{...input,referrer:'https://www.silkilinen.com/shop'});expect(readCheckoutAttribution(s).source).toBe('google');});
 it('survives blocked storage',()=>{expect(()=>captureAcquisition({getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}},input)).not.toThrow();});
});

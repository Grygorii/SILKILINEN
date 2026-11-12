import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildEvidence, evidencePrompt } = require('../services/commerceEvidence');
const { stagesFromEvidence, detectShifts } = require('../services/funnel');
const { searchWindows, searchPriorities } = require('../utils/searchEvidence');
const { freshness, fallbackBriefFields } = require('../services/growthEvidence');
const since = new Date('2026-10-13T00:00:00Z'), until = new Date('2026-11-12T00:00:00Z');
const at = n => new Date(since.getTime() + n * 60000);
const visit = (sid, n = 1, extra = {}) => ({ sessionId: sid, page: 'home', source: 'google', device: 'mobile', createdAt: at(n), ...extra });
const event = (sid, type, n = 2) => ({ sessionId: sid, type, createdAt: at(n) });
const order = (sid, n = 10, extra = {}) => ({ _id: `order-${n}`, browserSessionId: sid, total: 89, status: 'paid', createdAt: at(n), ...extra });
const build = (extra = {}) => buildEvidence({ since, until, ...extra });
describe('order ledger and honest attribution', () => {
  it('keeps two unlinked sales visible and does not turn legacy direct into attribution', () => {
    const e=build({visits:Array.from({length:30},(_,i)=>visit(`b${i}`)),orders:[order(null,10,{total:178,attribution:{source:'direct'}}),order(null,11,{total:90.09})]});
    expect(e.summary).toMatchObject({orders:2,netRevenueEUR:268.09,linkedOrders:0,unlinkedOrders:2,conversionPercent:null});
    expect(e.sources.find(s=>s.source==='google').conversionPercent).toBeNull();
    expect(e.sources.find(s=>s.source==='unknown')).toMatchObject({attributedOrders:2,revenue:26809,visitors:0});
    expect(evidencePrompt(e)).toContain('UNKNOWN; do not say 0%');
  });
  it('joins a paid order by browser ID without a browser purchase event',()=>{
    const e=build({visits:Array.from({length:20},(_,i)=>visit(`b${i}`)),orders:[order('b0')]});
    expect(e.summary).toMatchObject({linkedOrders:1,unlinkedOrders:0,conversionPercent:5});
    expect(e.sources[0]).toMatchObject({source:'google',buyers:1,conversionPercent:5});expect(e.stage.purchased.size).toBe(1);
  });
  it('counts one buyer once despite repeat orders and later source changes',()=>{
    const e=build({visits:[visit('one'),visit('one',3,{source:'direct'})],orders:[order('one'),order('one',11)]});
    expect(e.sources[0]).toMatchObject({source:'google',visitors:1,buyers:1,attributedOrders:2});expect(e.sources.some(s=>s.source==='direct')).toBe(false);
  });
  it('does not match a visit after a sale or include orders outside the period',()=>{
    const e=build({visits:[visit('one',20)],orders:[order('one',10),order('one',12,{createdAt:new Date('2026-09-01')})]});
    expect(e.summary).toMatchObject({orders:1,linkedOrders:0,unlinkedOrders:1});
  });
  it('shows an explicit order source without inventing a conversion denominator',()=>{
    const e=build({orders:[order(null,10,{utm:{source:'pinterest'}})]});expect(e.orders[0]).toMatchObject({source:'pinterest',basis:'recorded_order_source',linked:false});expect(e.sources[0].conversionPercent).toBeNull();
  });
  it('excludes manual sales from website conversion even if a browser ID is present',()=>{
    const e=build({visits:[visit('one')],orders:[order('one',10,{attribution:{source:'manual',medium:'admin'}})]});
    expect(e.summary).toMatchObject({orders:1,manualOrders:1,websiteOrders:0,unlinkedOrders:0});expect(e.orders[0].linked).toBe(false);expect(e.stage.purchased.size).toBe(0);
  });
  it('counts fulfilled purchases and refunds once, not cancelled attempts',()=>{
    const e=build({orders:[order(null,10,{status:'processing'}),order(null,11,{status:'shipped'}),order(null,12,{status:'partially_refunded',refundedAmount:10,costs:{refundedAmount:10}}),order(null,13,{status:'refunded',refundedAmount:89}),order(null,14,{status:'cancelled'}),order(null,15,{status:'failed'})]});
    expect(e.summary).toMatchObject({orders:4,netRevenueEUR:257});
  });
  it('does not classify or discard someone as a bot based only on a city',()=>{
    const e=build({visits:[visit('one',1,{city:'Council Bluffs'}),visit('two',1,{city:'Singapore'})]});expect(e.quality.browsers).toBe(2);expect(e.quality.trafficVerifiedHuman).toBe(false);
  });
});
describe('journey reach and intersections',()=>{
  it('counts product-page visits when view_item is missing',()=>{const e=build({visits:[visit('one',1,{page:'product'})]});expect(e.quality).toMatchObject({productPageBrowsers:1,productPagesWithoutViewEvent:1});expect(stagesFromEvidence(e)[1].count).toBe(1);});
  it('does not divide unrelated stage populations as progression',()=>{const e=build({visits:[visit('one',1,{page:'product'}),visit('two')],events:[event('two','add_to_cart')]});expect(stagesFromEvidence(e)[2]).toMatchObject({count:1,progressed:0,enteredFrom:1,rate:0});});
  it('requires forward chronological order',()=>{const e=build({visits:[visit('one',5,{page:'product'})],events:[event('one','add_to_cart',2)]});expect(stagesFromEvidence(e)[2].progressed).toBe(0);});
  it('keeps a later step when an earlier event is absent',()=>{const e=build({visits:[visit('one')],events:[event('one','begin_checkout',3)]});const stages=stagesFromEvidence(e);expect(stages[2].count).toBe(0);expect(stages[3].count).toBe(1);});
  it('uses null for paid drop-off with missing order links',()=>{const e=build({visits:[visit('one')],events:[event('one','reached_payment')],orders:[order(null)]});expect(stagesFromEvidence(e).at(-1)).toMatchObject({count:0,lost:null,rate:null,reliability:'unlinked_orders'});});
  it('does not compare missing rates as zeros',()=>{expect(detectShifts([{key:'sessions'},{key:'purchased',rate:null,enteredFrom:100}],[{key:'sessions'},{key:'purchased',rate:50,enteredFrom:100}])).toEqual([]);});
});
describe('SEO reporting',()=>{
  it('uses exactly 28 inclusive days with adjacent non-overlapping comparison',()=>{
    const w=searchWindows(28,new Date('2026-11-12T12:00:00Z'));const length=r=>(new Date(r.endDate)-new Date(r.startDate))/86400000+1;
    expect(length(w.current)).toBe(28);expect(length(w.previous)).toBe(28);expect(w.current).toEqual({startDate:'2026-10-14',endDate:'2026-11-10'});expect(new Date(w.current.startDate)-new Date(w.previous.endDate)).toBe(86400000);
  });
  it('uses Pacific dates when UTC is on the next day',()=>{expect(searchWindows(28,new Date('2026-11-12T02:00:00Z')).current.endDate).toBe('2026-11-09');});
  it('ranks shopping review candidates before articles and gates tiny samples',()=>{const rows=searchPriorities([{key:'/journal/silk-care',impressions:1000,ctr:.01,position:10},{key:'/shop?category=robes',impressions:100,ctr:.02,position:12},{key:'/product/tiny',impressions:1,ctr:1,position:1}]);expect(rows).toHaveLength(2);expect(rows[0].kind).toBe('shopping');expect(rows[1].action).toContain('contextual route');});
});
describe('growth freshness and fallback',()=>{
  it('marks the June strategy as historical in November',()=>{expect(freshness({createdAt:'2026-06-19T16:40:17Z'},90,new Date('2026-11-12T12:00:00Z')).status).toBe('stale');});
  it('does not turn purchases, positive clicks or a low price into a pre-launch narrative',()=>{
    const m={orders:{last7:2},revenue:{last7:5},humanVisitors:{last7:40,prev7:30},search:{totals:{clicks:42,impressions:2987}},anomalousOrders30d:1,priceFloorEUR:20,commerce:{summary:{linkedOrders:0,websiteOrders:2,sourceUnresolvedOrders:2}}};
    const b=fallbackBriefFields(m,null,[]);expect(b.headline).toContain('2 ledger purchase');expect(b.whatsWorking).toContain('42 Google clicks');expect(JSON.stringify(b)).not.toMatch(/pre-launch|not real sales|nothing is converting/);expect(()=>fallbackBriefFields({unavailable:true},null)).toThrow(/unavailable/);
  });
});

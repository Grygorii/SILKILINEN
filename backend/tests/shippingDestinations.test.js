import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
const require=createRequire(import.meta.url);
const express=require('express');
const Order=require('../models/Order');
const router=require('../routes/shipping');
let server,base;
beforeAll(async()=>{const app=express();app.use(router);server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;});
afterEach(()=>vi.restoreAllMocks());
afterAll(()=>new Promise(r=>server.close(r)));
describe('public country-only shipment history',()=>{
  it('returns country presence, never order or customer data',async()=>{
    const option=vi.fn().mockResolvedValue([{_id:'FR'},{_id:'IE'},{_id:'<bad>'}]);
    const spy=vi.spyOn(Order,'aggregate').mockReturnValue({option});
    const res=await fetch(`${base}/destinations`);
    expect(res.status).toBe(200);expect(await res.json()).toEqual({countries:['FR','IE']});
    expect(spy.mock.calls[0][0][0].$match.status.$in).toEqual(['shipped','delivered']);
    expect(option).toHaveBeenCalledWith({maxTimeMS:3000});
    expect(res.headers.get('cache-control')).toContain('s-maxage=3600');
  });
  it('returns unavailable instead of inventing destinations when the database fails',async()=>{
    vi.spyOn(Order,'aggregate').mockReturnValue({option:()=>Promise.reject(Error('private internal details'))});
    const res=await fetch(`${base}/destinations`);expect(res.status).toBe(503);
    expect(await res.json()).toEqual({error:'Shipment destinations temporarily unavailable'});
  });
});

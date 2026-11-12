import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const express = require('express');
const retrieve = vi.fn();
const stripePath = require.resolve('stripe');
const OriginalStripe = require('stripe');
require.cache[stripePath].exports = function FakeStripe() { return { paymentIntents: { retrieve } }; };
const { checkoutRouter } = require('../routes/checkoutV2');
require.cache[stripePath].exports = OriginalStripe;
const { csrf } = require('../middleware/csrf');
let server,base;
const paid = { id:'pi_fixture', client_secret:'pi_fixture_secret_fixture', status:'succeeded', amount:9009, currency:'gbp', created:1700000000, shipping:{address:{country:'GB'}}, receipt_email:'buyer@example.invalid' };
beforeAll(async()=>{const app=express();app.use(express.json());app.use(csrf);app.use(checkoutRouter);server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;});
afterAll(()=>new Promise(r=>server.close(r)));
beforeEach(()=>{retrieve.mockReset();retrieve.mockResolvedValue(paid);});
const post=(body,header=true)=>fetch(`${base}/confirmation`,{method:'POST',headers:{'Content-Type':'application/json',...(header?{'X-Requested-With':'XMLHttpRequest'}:{})},body:JSON.stringify(body)});
describe('secret-gated purchase confirmation (mocked Stripe, no payments)',()=>{
  it('returns the charged value and actual currency through a URL with no secret',async()=>{
    const response=await post({payment_intent:paid.id,client_secret:paid.client_secret});
    expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({orderId:'pi_fixture',value:90.09,currency:'GBP',country:'GB'});
    expect(retrieve).toHaveBeenCalledWith('pi_fixture');
    expect(response.url).not.toContain('secret');
  });
  it('rejects an incorrect secret without returning buyer data',async()=>{
    const r=await post({payment_intent:paid.id,client_secret:'wrong'});
    expect(r.status).toBe(403);expect(await r.json()).toEqual({error:'Not authorised'});
  });
  it('does not report pending payments as paid',async()=>{
    retrieve.mockResolvedValue({...paid,status:'processing'});
    const r=await post({payment_intent:paid.id,client_secret:paid.client_secret});expect(r.status).toBe(409);
  });
  it('rejects malformed identifiers before making an API request',async()=>{
    const r=await post({payment_intent:{$ne:null},client_secret:'x'});expect(r.status).toBe(400);expect(retrieve).not.toHaveBeenCalled();
  });
  it('requires the existing CSRF header for POST',async()=>{
    const r=await post({payment_intent:paid.id,client_secret:paid.client_secret},false);expect(r.status).toBe(403);expect(retrieve).not.toHaveBeenCalled();
  });
  it('keeps older deployed clients compatible during the rollout',async()=>{
    const r=await fetch(`${base}/confirmation?payment_intent=pi_fixture&client_secret=pi_fixture_secret_fixture`);
    expect(r.status).toBe(200);
  });
});

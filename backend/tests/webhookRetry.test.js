import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const express = require('express');
const constructEvent = vi.fn();
const stripePath = require.resolve('stripe'); const originalStripe = require('stripe');
require.cache[stripePath].exports = () => ({ webhooks: { constructEvent } });
const { webhookRouter } = require('../routes/checkoutV2');
require.cache[stripePath].exports = originalStripe;
const Order = require('../models/Order');
let server, base;
beforeAll(async () => { const app = express(); app.use(webhookRouter); server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}`; });
afterAll(() => new Promise(r => server.close(r)));
beforeEach(() => { vi.restoreAllMocks(); constructEvent.mockReset(); });
const post = () => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
describe('webhook acknowledgement and retry boundaries (mock Stripe, no charges)', () => {
  it('does not acknowledge failed order persistence as a completed event', async () => {
    constructEvent.mockReturnValue({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_fixture', metadata: {} } } });
    vi.spyOn(Order, 'findOne').mockRejectedValue(new Error('fixture database outage'));
    const response = await post(); expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('fixture database outage');
  });
  it('acknowledges a retry of an already-saved order without creating another', async () => {
    constructEvent.mockReturnValue({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_fixture', metadata: {} } } });
    vi.spyOn(Order, 'findOne').mockResolvedValue({ _id: 'fixture', confirmationEmailSentAt: new Date() });
    const create = vi.spyOn(Order, 'create'); expect((await post()).status).toBe(200); expect(create).not.toHaveBeenCalled();
  });
  it('still rejects invalid signatures', async () => {
    constructEvent.mockImplementation(() => { throw Error('invalid fixture signature'); });
    expect((await post()).status).toBe(400);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mongoose = require('mongoose');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const Newsletter = require('../models/Newsletter');
const marketingRouter = require('../routes/marketingDashboard');
const { csrf } = require('../middleware/csrf');
const { tryStartMongo } = require('./mongo');

const mongo = await tryStartMongo();
let server;
let base;
const adminCookie = `token=${jwt.sign({ role: 'admin', userId: '012345678901234567890123' }, process.env.JWT_SECRET)}`;

function request(path) {
  return fetch(`${base}${path}`, { headers: { Cookie: adminCookie } });
}

beforeAll(async () => {
  if (!mongo) return;
  await mongoose.connect(mongo.uri, { dbName: 'marketing_subscribers_tests' });
  await Newsletter.init();
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrf);
  app.use('/api/admin/marketing', marketingRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}, 60000);

afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongo) {
    await mongoose.disconnect();
    await mongo.stop();
  }
});

beforeEach(async () => {
  if (mongo) await Newsletter.deleteMany({});
});

describe.skipIf(!mongo)('Marketing subscriber records', () => {
  it('keeps audit records out of founder counts, lists, and CSV exports', async () => {
    await Newsletter.create([
      { email: 'shopper@example.test', source: 'popup', subscribedAt: new Date('2026-01-03'), discountCodeUsed: true },
      { email: 'audit-test@silkilinen-qa.invalid', source: 'audit', subscribedAt: new Date('2026-01-04') },
      { email: 'unsubscribed@example.test', source: 'website', isUnsubscribed: true },
    ]);

    const summaryResponse = await request('/api/admin/marketing/subscribers');
    const summary = await summaryResponse.json();
    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.headers.get('cache-control')).toContain('no-store');
    expect(summary).toMatchObject({ total: 1, unsubscribed: 1, auditExcluded: 1, bySource: [{ source: 'popup', count: 1 }] });
    expect(summary).not.toHaveProperty('recent');

    const listResponse = await request('/api/admin/marketing/subscribers/recent');
    const list = await listResponse.json();
    expect(listResponse.headers.get('cache-control')).toContain('no-store');
    expect(list.subscribers).toHaveLength(1);
    expect(list.subscribers[0]).toMatchObject({ email: 'shopper@example.test', source: 'popup', discountCodeUsed: true });

    const csvResponse = await request('/api/admin/marketing/subscribers/export.csv');
    const csv = await csvResponse.text();
    expect(csvResponse.headers.get('cache-control')).toContain('no-store');
    expect(csv).toContain('"shopper@example.test","popup","2026-01-03T00:00:00.000Z"');
    expect(csv).not.toContain('audit-test@silkilinen-qa.invalid');
    expect(csv).not.toContain('unsubscribed@example.test');
  });
});

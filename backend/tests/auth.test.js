import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import express from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const User = require('../models/User.js');
const authRouter = require('../routes/auth.js');
const { tryStartMongo } = require('./mongo.js');

// Resolved before the suites are declared so an unavailable binary SKIPS them
// rather than failing them — see tests/mongo.js for why that matters.
const mongo = await tryStartMongo();

let app;

// The hooks are top-level (both suites below share them) so each one returns
// early when there is no MongoDB: a top-level hook still runs even when every
// test in the file is skipped.
beforeAll(async () => {
  if (!mongo) return;
  await mongoose.connect(mongo.uri);

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
});

afterAll(async () => {
  if (!mongo) return;
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  if (!mongo) return;
  await User.deleteMany({});
});

async function post(path, body) {
  // Tests don't go through pino-http, the global error middleware, or the
  // network — call the express app directly via a tiny supertest-style
  // helper so we don't need supertest as a dep just for this.
  return new Promise((resolve, reject) => {
    const req = {
      method: 'POST',
      url: path,
      body,
      headers: { 'content-type': 'application/json' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      get(name) { return this.headers[name.toLowerCase()]; },
    };
    let statusCode = 200;
    const cookies = {};
    const headers = {};
    const res = {
      statusCode,
      // Express reaches past the res methods a route calls: application.handle
      // hands unmatched requests to finalhandler, which uses the raw
      // ServerResponse surface. Without these the suite died with
      // "res.setHeader is not a function" before any assertion ran — invisible
      // locally, because the mongod binary cannot be downloaded here and the
      // whole suite skips. CI was the first place it ever executed.
      headersSent: false,
      setHeader(name, value) { headers[String(name).toLowerCase()] = value; return this; },
      getHeader(name) { return headers[String(name).toLowerCase()]; },
      removeHeader(name) { delete headers[String(name).toLowerCase()]; },
      getHeaderNames() { return Object.keys(headers); },
      writeHead(code, hdrs) {
        this.statusCode = code; statusCode = code;
        if (hdrs) for (const [k, v] of Object.entries(hdrs)) this.setHeader(k, v);
        return this;
      },
      end(payload) {
        this.headersSent = true;
        resolve({ status: this.statusCode, body: payload, cookies, headers });
      },
      status(code) { this.statusCode = code; statusCode = code; return this; },
      cookie(name, value) { cookies[name] = value; return this; },
      json(payload) { this.headersSent = true; resolve({ status: this.statusCode, body: payload, cookies, headers }); },
      send(payload) { this.headersSent = true; resolve({ status: this.statusCode, body: payload, cookies, headers }); },
    };
    app(req, res, err => err && reject(err));
  });
}

describe.skipIf(!mongo)('POST /api/auth/login', () => {
  it('rejects unknown email with 401', async () => {
    const res = await post('/api/auth/login', { email: 'nobody@example.com', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/incorrect/i);
  });

  it('rejects wrong password with 401', async () => {
    await User.create({ email: 'admin@example.com', password: 'CorrectHorse', role: 'admin' });
    const res = await post('/api/auth/login', { email: 'admin@example.com', password: 'WrongHorse' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/incorrect/i);
  });

  it('rejects non-admin user with 403', async () => {
    await User.create({ email: 'user@example.com', password: 'CorrectHorse', role: 'customer' });
    const res = await post('/api/auth/login', { email: 'user@example.com', password: 'CorrectHorse' });
    expect(res.status).toBe(403);
  });

  it('returns a bootstrap nonce (NOT the JWT) on success', async () => {
    await User.create({ email: 'admin@example.com', password: 'CorrectHorse', role: 'admin' });
    const res = await post('/api/auth/login', { email: 'admin@example.com', password: 'CorrectHorse' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // F4: must NOT include the JWT in the body any more.
    expect(res.body.token).toBeUndefined();
    expect(typeof res.body.bootstrap).toBe('string');
    expect(res.body.bootstrap.length).toBeGreaterThan(20);
    // Should still set the Railway-domain cookie.
    expect(res.cookies.token).toBeDefined();
  });

  it('uses the same generic error for missing-user and wrong-password (no enumeration)', async () => {
    await User.create({ email: 'admin@example.com', password: 'CorrectHorse', role: 'admin' });
    const a = await post('/api/auth/login', { email: 'nobody@example.com', password: 'x' });
    const b = await post('/api/auth/login', { email: 'admin@example.com', password: 'wrong' });
    expect(a.body.error).toBe(b.body.error);
  });
});

describe.skipIf(!mongo)('POST /api/auth/redeem-bootstrap', () => {
  it('rejects an unknown nonce with 401', async () => {
    const res = await post('/api/auth/redeem-bootstrap', { bootstrap: 'definitely-not-issued' });
    expect(res.status).toBe(401);
  });

  it('rejects a missing nonce with 401', async () => {
    const res = await post('/api/auth/redeem-bootstrap', {});
    expect(res.status).toBe(401);
  });

  it('exchanges a fresh bootstrap for the JWT exactly once', async () => {
    await User.create({ email: 'admin@example.com', password: 'CorrectHorse', role: 'admin' });
    const login = await post('/api/auth/login', { email: 'admin@example.com', password: 'CorrectHorse' });
    expect(login.status).toBe(200);

    const first = await post('/api/auth/redeem-bootstrap', { bootstrap: login.body.bootstrap });
    expect(first.status).toBe(200);
    expect(typeof first.body.token).toBe('string');
    expect(first.body.token.split('.').length).toBe(3); // looks like a JWT

    // Single-use: second attempt with the same nonce must fail.
    const second = await post('/api/auth/redeem-bootstrap', { bootstrap: login.body.bootstrap });
    expect(second.status).toBe(401);
  });
});

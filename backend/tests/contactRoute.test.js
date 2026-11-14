import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const email = require('../services/email');
const sendContactMessage = vi.spyOn(email, 'sendContactMessage');
const contactRouter = require('../routes/contact');

let server;
let base;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/contact', contactRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise(resolve => server.close(resolve)));

beforeEach(() => {
  sendContactMessage.mockReset();
  sendContactMessage.mockResolvedValue(true);
});

async function submit(body) {
  return fetch(`${base}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/contact', () => {
  it('delivers a valid message without creating a marketing record', async () => {
    const response = await submit({
      name: '  Aoife Visitor ',
      email: ' AOIFE@EXAMPLE.TEST ',
      message: 'Could you help with sizing?',
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true });
    expect(sendContactMessage).toHaveBeenCalledWith({
      name: 'Aoife Visitor',
      email: 'aoife@example.test',
      message: 'Could you help with sizing?',
    });
  });

  it('rejects invalid or oversized visitor fields before attempting delivery', async () => {
    const invalid = await submit({ name: '', email: 'not-an-email', message: '' });
    expect(invalid.status).toBe(400);
    expect(sendContactMessage).not.toHaveBeenCalled();

    const tooLong = await submit({
      name: 'A'.repeat(121),
      email: 'visitor@example.test',
      message: 'Hello',
    });
    expect(tooLong.status).toBe(400);
    expect(sendContactMessage).not.toHaveBeenCalled();
  });

  it('quietly acknowledges a bot that fills the hidden website field', async () => {
    const response = await submit({
      name: '',
      email: 'not-an-email',
      message: '',
      website: 'https://spam.example.test',
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true });
    expect(sendContactMessage).not.toHaveBeenCalled();
  });

  it('returns an honest fallback status when sending is not configured or fails', async () => {
    sendContactMessage.mockResolvedValueOnce(false);
    const unavailable = await submit({ name: 'Aoife', email: 'aoife@example.test', message: 'Hello' });
    expect(unavailable.status).toBe(503);
    expect((await unavailable.json()).error).toMatch(/email hello@silkilinen\.com/i);

    sendContactMessage.mockRejectedValueOnce(new Error('fixture provider outage'));
    const failed = await submit({ name: 'Aoife', email: 'aoife@example.test', message: 'Hello' });
    expect(failed.status).toBe(502);
    expect((await failed.json()).error).not.toContain('fixture provider outage');
  });
});

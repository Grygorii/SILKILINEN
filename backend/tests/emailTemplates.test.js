import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const messages = [];
const { sendContactMessage, sendMagicLink, sendWinbackReminder, sendWishlistReminder } = await import('../services/email.js');

beforeEach(() => {
  messages.length = 0;
  vi.stubEnv('RESEND_API_KEY', 'fixture-resend-key');
  vi.stubEnv('BACKEND_URL', 'https://api.example.test');
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
    messages.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ id: 'fixture-email' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('marketing email templates', () => {
  it('sends a transactional magic link without referencing marketing unsubscribe state', async () => {
    await expect(sendMagicLink({ email: 'shopper@example.test', link: 'https://www.example.test/sign-in' })).resolves.toBeUndefined();
    expect(messages).toHaveLength(1);
    expect(messages[0].html).not.toContain('Unsubscribe from offers');
  });

  it('gives marketing messages a one-click opt-out header and visible link', async () => {
    await sendWinbackReminder({ email: 'shopper@example.test', firstName: '<Anna>', customerId: '012345678901234567890123' });
    await sendWishlistReminder({
      email: 'shopper@example.test',
      firstName: '<Anna>',
      customerId: '012345678901234567890123',
      product: { name: '<Silk brief>', slug: 'silk-brief' },
      offer: { code: 'SILK10', percent: 10, minimumOrderValue: 25, validUntil: '2026-12-31T12:00:00.000Z' },
    });

    expect(messages).toHaveLength(2);
    for (const message of messages) {
      expect(message.headers['List-Unsubscribe']).toContain('https://api.example.test/api/customers/unsubscribe?cid=');
      expect(message.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
      expect(message.html).toContain('Unsubscribe from offers');
    }
    expect(messages[1].html).toContain('&lt;Silk brief&gt;');
    expect(messages[1].html).not.toContain('<Silk brief>');
    expect(messages[1].html).toContain('Offer valid until 31 December 2026');
    expect(messages[1].html).toContain('orders of €25.00 or more');
  });

  it('does not report a reminder as sent when Resend returns an error result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Mailbox rejected' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(sendWishlistReminder({
      email: 'shopper@example.test',
      customerId: '012345678901234567890123',
      product: { name: 'Silk brief', slug: 'silk-brief' },
      offer: { code: 'SILK10', percent: 10 },
    })).rejects.toThrow('Mailbox rejected');
  });

  it('sends contact messages only to the fixed studio recipient and escapes visitor copy', async () => {
    vi.stubEnv('ADMIN_EMAIL', 'studio@example.test');

    await expect(sendContactMessage({
      name: '<Aoife>',
      email: 'visitor@example.test',
      message: 'Could I ask about <sizing>?\nThank you.',
    })).resolves.toBe(true);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      to: 'studio@example.test',
      reply_to: 'visitor@example.test',
      subject: 'New message from the SILKILINEN contact page',
    });
    expect(messages[0].html).toContain('&lt;Aoife&gt;');
    expect(messages[0].html).toContain('&lt;sizing&gt;?');
    expect(messages[0].html).toContain('<br>Thank you.');
    expect(messages[0].html).not.toContain('<Aoife>');
  });
});

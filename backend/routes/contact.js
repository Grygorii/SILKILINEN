'use strict';

const express = require('express');
const { publicWriteRateLimit } = require('../middleware/rateLimits');
const { sendContactMessage } = require('../services/email');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 3000;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Contact is intentionally a small transactional path: a message reaches the
// studio inbox, but it never creates a customer profile or marketing consent.
// The hidden field is a quiet bot trap. We answer it like a normal success so
// an automated sender cannot learn how to work around it.
router.post('/', publicWriteRateLimit, async function contact(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const honeypot = cleanText(body.website);
  if (honeypot) return res.status(201).json({ success: true });

  const name = cleanText(body.name);
  const email = cleanText(body.email).toLowerCase();
  const message = cleanText(body.message);

  if (!name || name.length > MAX_NAME_LENGTH || !EMAIL_RE.test(email) || email.length > MAX_EMAIL_LENGTH || !message || message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: 'Please add your name, a valid email address, and a message.' });
  }

  try {
    const sent = await sendContactMessage({ name, email, message });
    if (!sent) {
      return res.status(503).json({
        error: 'Our contact service is temporarily unavailable. Please email hello@silkilinen.com instead.',
      });
    }
    return res.status(201).json({ success: true });
  } catch (err) {
    // Do not expose email-provider details to visitors. The request logger
    // retains the useful operational context without recording the message.
    if (req.log) req.log.error({ err }, 'contact message delivery failed');
    else console.error('[contact] message delivery failed:', err.message);
    return res.status(502).json({
      error: 'We could not send your message just now. Please email hello@silkilinen.com instead.',
    });
  }
});

module.exports = router;

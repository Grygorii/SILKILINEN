'use strict';

const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

// 5 requests per 10 minutes — magic link, Google OAuth
const authRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: 'Too many attempts. Please try again in 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  requestWasSuccessful: (_req, res) => res.statusCode < 500,
  skipFailedRequests: true,
});

// 10 requests per hour — newsletter subscribe, contact form
const publicWriteRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  requestWasSuccessful: (_req, res) => res.statusCode < 500,
  skipFailedRequests: true,
});

// 30 requests per hour — drop-a-hint and similar light writes
const lightRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  requestWasSuccessful: (_req, res) => res.statusCode < 500,
  skipFailedRequests: true,
});

module.exports = { authRateLimit, publicWriteRateLimit, lightRateLimit };

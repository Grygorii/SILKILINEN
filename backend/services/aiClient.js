'use strict';

// Single shared DeepSeek client (the OpenAI-compatible SDK pointed at DeepSeek).
// Every AI service and growth-agent used to construct its own byte-for-byte
// identical client — 19 copies of the same apiKey/baseURL. Centralised here so
// the provider, endpoint, and any future timeout/retry/cost policy live in one
// place. Per-agent MODEL selection stays in each file (it genuinely varies).
const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'not-set',
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
});

module.exports = client;

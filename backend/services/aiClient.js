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

// Shared cost policy: a persistent (restart-surviving) daily cap on DeepSeek
// spend, applied here so EVERY service and growth-agent that uses this client
// inherits it in one place — the per-route hourly limiters are in-memory and
// reset on each Railway deploy, so they can't enforce a daily ceiling. Default
// 500 calls/day, override with DEEPSEEK_DAILY_LIMIT. Callers already await
// create() inside try/catch, so an over-limit throw surfaces as a normal AI
// error rather than crashing.
const { enforceDailyCap } = require('./aiCostCap');
const rawCreate = client.chat.completions.create.bind(client.chat.completions);
client.chat.completions.create = function (...args) {
  return enforceDailyCap('deepseek', { envVar: 'DEEPSEEK_DAILY_LIMIT', fallback: 500 })
    .then(() => rawCreate(...args));
};

module.exports = client;

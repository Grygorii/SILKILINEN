'use strict';

// Self-Test — the machine proves itself. Pings every pipe the Growth Engine
// depends on (AI, database, the outside internet, Search Console, Merchant
// Center) and reports each agent's real status, so the founder (and Claude,
// via a screenshot) can see at a glance that everything is alive and
// delivering. Cheap by design: it PINGS dependencies rather than re-running
// all ten agents — a few seconds, a handful of tokens.

const OpenAI = require('openai');
const SystemState = require('../models/SystemState');
const { describeAgents } = require('./growthEngine');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'not-set',
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
});
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

// ok: true (green), false (red), null (amber — optional/not-connected).
async function check(name, fn, optional = false) {
  const t = Date.now();
  try {
    const r = await fn();
    return { name, ok: r.ok === undefined ? true : r.ok, detail: r.detail, ms: Date.now() - t };
  } catch (e) {
    return { name, ok: optional ? null : false, detail: e.message || 'failed', ms: Date.now() - t };
  }
}

async function runSelfTest() {
  const checks = await Promise.all([
    // 1. The brain's engine.
    check('AI engine (DeepSeek)', async () => {
      if (!process.env.DEEPSEEK_API_KEY) throw new Error('No API key set in the environment');
      const res = await client.chat.completions.create(
        { model: MODEL, messages: [{ role: 'user', content: 'Reply with one word: ok' }], max_tokens: 5, temperature: 0 },
        { timeout: 15000, maxRetries: 0 },
      );
      const txt = (res.choices[0]?.message?.content || '').trim();
      if (!txt) throw new Error('empty response');
      return { detail: `responded "${txt.slice(0, 20)}"` };
    }),

    // 2. The memory.
    check('Database', async () => {
      await SystemState.findOne().lean();
      return { detail: 'connected' };
    }),

    // 3. The outside world (used by the scouts/demand radar).
    check('Outside internet (Google)', async () => {
      const { googleAutocomplete } = require('./externalData');
      const suggestions = await googleAutocomplete('silk pillowcase', 'IE');
      if (!suggestions.length) throw new Error('no response (may be rate-limited this moment)');
      return { detail: `reachable — ${suggestions.length} live suggestions` };
    }),

    // 4. Search Console (optional — amber if not connected).
    check('Google Search Console', async () => {
      const gsc = require('./searchConsole');
      const connected = await gsc.isConnected();
      return { ok: connected ? true : null, detail: connected ? 'connected' : 'not connected (optional)' };
    }, true),

    // 5. Merchant Center (optional — amber if not configured).
    check('Merchant Center', async () => {
      const mc = require('./merchantCenter');
      const configured = mc.isConfigured();
      return { ok: configured ? true : null, detail: configured ? 'configured' : 'not configured (optional)' };
    }, true),
  ]);

  let agents = [];
  try { agents = await describeAgents(); } catch { /* leave empty */ }

  return {
    ranAt: new Date().toISOString(),
    checks,
    agents: agents.map(a => ({ label: a.label, enabled: a.enabled, lastRun: a.lastRun })),
    summary: {
      passed: checks.filter(c => c.ok === true).length,
      failed: checks.filter(c => c.ok === false).length,
      optional: checks.filter(c => c.ok === null).length,
    },
  };
}

module.exports = { runSelfTest };

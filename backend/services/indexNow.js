'use strict';

// IndexNow — instant-indexing ping. Tells Bing / Yandex (and every IndexNow
// participant) the moment a URL is published or changed, so new products and
// articles get crawled in minutes instead of waiting for an organic crawl.
// Free, no account: the key is a public token served at https://<host>/<key>.txt
// (frontend/public/<key>.txt). Google doesn't use IndexNow, but Bing powers
// Copilot / ChatGPT search, so this is real incremental visibility.
//
// Fire-and-forget and fail-soft — indexing is a bonus and must never block or
// break a save.

const SystemState = require('../models/SystemState');
const KEY = process.env.INDEXNOW_KEY || 'dc1dfa43baff3a057f22f080ab65acfc';
const SITE = (process.env.PUBLIC_SITE_URL || 'https://www.silkilinen.com').replace(/\/$/, '');
const HOST = SITE.replace(/^https?:\/\//, '');
const LAST_KEY = 'indexnow_last_submit';

// Records the most recent submission so admin can show "last submitted" without
// waiting on Bing's laggy tab.
async function recordLastSubmit(count, source) {
  await SystemState.findOneAndUpdate(
    { key: LAST_KEY },
    { value: { at: new Date().toISOString(), count, source } },
    { upsert: true },
  ).catch(() => {});
}

async function getLastSubmit() {
  const doc = await SystemState.findOne({ key: LAST_KEY }).lean().catch(() => null);
  return doc?.value || null;
}

// Submit one or more absolute or site-relative URLs. Records the submission
// unless record:false (the bulk resubmit records the total itself, so its chunks
// don't each overwrite the count).
async function pingIndexNow(urls, { source = 'auto', record = true } = {}) {
  try {
    const list = (Array.isArray(urls) ? urls : [urls])
      .filter(Boolean)
      .map(u => (u.startsWith('http') ? u : `${SITE}${u.startsWith('/') ? '' : '/'}${u}`))
      .slice(0, 100); // IndexNow caps a single submission at 10k; we never need many
    if (!list.length) return;

    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: list }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) { console.warn(`[indexnow] HTTP ${res.status} for ${list.length} url(s)`); return; }
    if (record) await recordLastSubmit(list.length, source);
  } catch (err) {
    console.warn('[indexnow] ping failed:', err.message);
  }
}

module.exports = { pingIndexNow, getLastSubmit, recordLastSubmit };

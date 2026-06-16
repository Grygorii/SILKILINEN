'use strict';

// Editable SEO for static storefront pages (home, journal, contact, about…).
// Their meta lives in code, so Hermes could only FLAG page fixes. This stores a
// per-path override { metaTitle, metaDescription } the pages read at render time
// and the Rebuild SEO pipeline can write — so page blocks become applicable too.
// One small map under SystemState 'pageSeo', cached, loaded at boot.

const SystemState = require('../models/SystemState');

const KEY = 'pageSeo';
// The paths the agent may edit (must match the wired pages' generateMetadata).
const EDITABLE_PATHS = ['/', '/journal', '/contact', '/about'];

let cache = {};

async function loadPageSeo() {
  try {
    const doc = await SystemState.findOne({ key: KEY }).lean();
    cache = (doc && typeof doc.value === 'object' && doc.value) || {};
  } catch (err) {
    console.warn('[pageSeo] load failed:', err.message);
    cache = {};
  }
  return cache;
}

function getAllPageSeo() { return { ...cache }; }
function getPageSeo(path) { return cache[path] || null; }

async function savePageSeo(path, meta) {
  const p = String(path || '').trim();
  if (!EDITABLE_PATHS.includes(p)) throw new Error(`Not an editable page path: ${p}`);
  const next = {
    ...cache,
    [p]: {
      metaTitle: String(meta?.metaTitle || '').slice(0, 70),
      metaDescription: String(meta?.metaDescription || '').slice(0, 165),
    },
  };
  await SystemState.findOneAndUpdate({ key: KEY }, { value: next }, { upsert: true });
  cache = next;
  return cache[p];
}

module.exports = { loadPageSeo, getAllPageSeo, getPageSeo, savePageSeo, EDITABLE_PATHS };

'use strict';

// Editable size chart — the measurement table used to be hardcoded in the
// storefront size-guide page. Stored as rows under SystemState 'sizeChart';
// getSizeChart() falls back to DEFAULT_SIZE_CHART so the page is never empty.
// Cached in memory, refreshed on save and at boot. (The page's editorial copy —
// how-to-measure, fit notes — stays in code; only the reference table is DB.)

const SystemState = require('../models/SystemState');

const KEY = 'sizeChart';

const COLS = ['size', 'eu', 'uk', 'bustCm', 'bustIn', 'waistCm', 'waistIn', 'hipCm', 'hipIn'];

const DEFAULT_SIZE_CHART = [
  { size: 'XS', eu: '34', uk: '8',  bustCm: '80–84',  bustIn: '31.5–33',  waistCm: '62–66', waistIn: '24.5–26', hipCm: '88–92',   hipIn: '34.5–36' },
  { size: 'S',  eu: '36', uk: '10', bustCm: '84–88',  bustIn: '33–34.5',  waistCm: '66–70', waistIn: '26–27.5', hipCm: '92–96',   hipIn: '36–38' },
  { size: 'M',  eu: '38', uk: '12', bustCm: '88–92',  bustIn: '34.5–36',  waistCm: '70–74', waistIn: '27.5–29', hipCm: '96–100',  hipIn: '38–39.5' },
  { size: 'L',  eu: '40', uk: '14', bustCm: '92–96',  bustIn: '36–38',    waistCm: '74–78', waistIn: '29–30.5', hipCm: '100–104', hipIn: '39.5–41' },
  { size: 'XL', eu: '42', uk: '16', bustCm: '96–100', bustIn: '38–39.5',  waistCm: '78–82', waistIn: '30.5–32', hipCm: '104–108', hipIn: '41–42.5' },
];

let cache = null;

function sanitise(value) {
  if (!Array.isArray(value)) return null;
  const rows = value
    .map(r => {
      const row = {};
      for (const c of COLS) row[c] = String(r?.[c] ?? '').trim().slice(0, 40);
      return row;
    })
    .filter(r => r.size) // a row needs at least a size label
    .slice(0, 30);
  return rows.length ? rows : null;
}

async function loadSizeChart() {
  try {
    const doc = await SystemState.findOne({ key: KEY }).lean();
    cache = sanitise(doc && doc.value);
  } catch (err) {
    console.warn('[sizeChart] load failed, using defaults:', err.message);
    cache = null;
  }
  return getSizeChart();
}

function getSizeChart() {
  return cache && cache.length ? cache : DEFAULT_SIZE_CHART;
}

async function saveSizeChart(rows) {
  const clean = sanitise(rows) || [];
  await SystemState.findOneAndUpdate({ key: KEY }, { value: clean }, { upsert: true });
  cache = clean.length ? clean : null;
  return getSizeChart();
}

module.exports = { getSizeChart, saveSizeChart, loadSizeChart, DEFAULT_SIZE_CHART, COLS };

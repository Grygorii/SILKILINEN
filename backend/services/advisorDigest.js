'use strict';

// Weekly advisor digest. Keeps the dashboard "alive" even when nobody opens it:
// once a week it emails the founder the store's top priorities. Cadence is
// enforced via a SystemState timestamp (not a weekly setInterval) so deploys /
// restarts can't silently skip or double-send.

const SystemState = require('../models/SystemState');
const { buildRecommendations } = require('./advisor');
const { sendAdvisorDigest } = require('./email');

const STATE_KEY = 'advisorDigestLastSentAt';
const WEEK = 7 * 24 * 60 * 60 * 1000;

async function getLastSentAt() {
  const doc = await SystemState.findOne({ key: STATE_KEY }).lean();
  return doc?.value ? new Date(doc.value) : null;
}

async function setLastSentAt(date) {
  await SystemState.findOneAndUpdate(
    { key: STATE_KEY },
    { value: date.toISOString() },
    { upsert: true }
  );
}

// Returns a small result object describing what happened, so both the cron log
// and the manual /send-test endpoint can report it instead of failing silently.
async function runAdvisorDigest({ force = false } = {}) {
  if (!process.env.RESEND_API_KEY || !process.env.ADMIN_EMAIL) {
    return { sent: false, reason: 'Email not configured (need RESEND_API_KEY + ADMIN_EMAIL).' };
  }

  if (!force) {
    const last = await getLastSentAt();
    if (last && Date.now() - last.getTime() < WEEK) {
      return { sent: false, reason: 'Already sent within the last 7 days.' };
    }
  }

  const recommendations = await buildRecommendations();
  await sendAdvisorDigest({ recommendations, generatedAt: new Date().toISOString() });
  await setLastSentAt(new Date());
  return { sent: true, count: recommendations.length };
}

module.exports = { runAdvisorDigest };

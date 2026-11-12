'use strict';
const crypto = require('crypto');
const SystemState = require('../models/SystemState');
// The same lease protects manual, scheduled and inter-agent calls. Owner checks
// prevent an old worker from releasing a newer worker's lock.
async function withWorkflowLease(name, fn) {
  const key = `workflowLease:${name}`, holder = crypto.randomUUID(), ttl = 20 * 60000;
  try {
    const lock = await SystemState.findOneAndUpdate(
      { key, $or: [{ 'value.until': { $lte: Date.now() } }, { 'value.until': { $exists: false } }] },
      { $set: { value: { holder, until: Date.now() + ttl, startedAt: new Date().toISOString() } } },
      { upsert: true, returnDocument: 'after' });
    if (lock?.value?.holder !== holder) return { busy: true };
  } catch (error) { if (error.code === 11000) return { busy: true }; throw error; }
  let lost = false;
  const timer = setInterval(() => {
    SystemState.updateOne({ key, 'value.holder': holder }, { $set: { 'value.until': Date.now() + ttl } })
      .then(result => { if (!result.matchedCount) lost = true; }).catch(() => { lost = true; });
  }, 60000);
  timer.unref();
  const assertLease = () => { if (lost) throw new Error('Workflow lease lost; remaining work stopped'); };
  try { return await fn(assertLease); }
  finally {
    clearInterval(timer);
    await SystemState.updateOne({ key, 'value.holder': holder }, { $set: { 'value.until': 0, 'value.finishedAt': new Date().toISOString() } }).catch(() => {});
  }
}
module.exports = { withWorkflowLease };

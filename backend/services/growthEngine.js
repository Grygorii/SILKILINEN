'use strict';

// The Growth Engine — an autonomous marketing brain that pulses on a
// schedule. Each registered agent is a specialist (content writer, social
// drafter, newsletter drafter, watchdog) with its own cadence. The engine
// runs them when due, records everything they do as GrowthActions (the
// founder-visible pulse log), and never lets one agent's failure stop the
// others. Output that goes public (articles, posts, emails) is created as
// DRAFTS needing one-click approval — the engine works, the founder stays
// in control.

const SystemState = require('../models/SystemState');
const GrowthAction = require('../models/GrowthAction');
const { withWorkflowLease } = require('./workflowLease');

const SETTINGS_KEY = 'growthEngineSettings';
const LASTRUN_KEY = 'growthEngineLastRun';
const ATTEMPTS_KEY = 'growthEngineAttempts';

// Registered specialist agents. Each module exports:
//   { name, label, description, cadenceHours, defaultEnabled, run }
// run() returns an array of action objects:
//   { type, title, detail?, href?, status?, meta? }
const AGENTS = [
  require('./growthAgents/demandScout'),
  require('./growthAgents/competitorScout'),
  require('./growthAgents/storefrontScout'),
  require('./growthAgents/eureka'),
  require('./growthAgents/prometheus'),
  require('./growthAgents/maui'),
  require('./growthAgents/contentWriter'),
  require('./growthAgents/socialDrafter'),
  require('./growthAgents/newsletterDrafter'),
  require('./growthAgents/hermes'),
  require('./growthAgents/watchdog'),
  // The clerks run LAST — they audit and fact-check everything the agents
  // above just produced. Order matters: within one pulse the engine writes
  // each agent's actions before the next runs, so the clerks see this run's
  // fresh output.
  require('./growthAgents/logicClerk'),
  require('./growthAgents/reasoningClerk'),
];

async function getState(key) {
  const doc = await SystemState.findOne({ key }).lean();
  return (doc && doc.value) || {};
}

async function setState(key, value) {
  await SystemState.findOneAndUpdate({ key }, { value }, { upsert: true });
}

async function getSettings() {
  const saved = await getState(SETTINGS_KEY);
  const settings = {};
  for (const a of AGENTS) {
    settings[a.name] = { enabled: saved[a.name]?.enabled ?? a.defaultEnabled };
  }
  return settings;
}

async function setAgentEnabled(name, enabled) {
  if (!AGENTS.some(a => a.name === name)) throw new Error(`Unknown agent: ${name}`);
  await SystemState.updateOne({ key: SETTINGS_KEY }, { $set: { [`value.${name}.enabled`]: Boolean(enabled) } }, { upsert: true });
}

async function describeAgents() {
  const [settings, lastRuns, attempts] = await Promise.all([getSettings(), getState(LASTRUN_KEY), getState(ATTEMPTS_KEY)]);
  return AGENTS.map(a => ({
    name: a.name,
    label: a.label,
    description: a.description,
    cadenceHours: a.cadenceHours,
    enabled: settings[a.name].enabled,
    lastRun: lastRuns[a.name] || null,
    lastAttempt: attempts[a.name] || null,
  }));
}

/**
 * Run due agents (or a specific one / all when forced).
 * Returns { ran: [names], actionCount }.
 */
async function runGrowthEngine({ force = false, only = null } = {}) {
  if (only && !AGENTS.some(agent => agent.name === only)) throw new Error('Unknown growth agent');
  return withWorkflowLease('growth-pulse', async assertLease => {
    const [settings, lastRuns, attempts] = await Promise.all([getSettings(), getState(LASTRUN_KEY), getState(ATTEMPTS_KEY)]);
    const ran = [], failed = [], skipped = []; let actionCount = 0;
    for (const agent of AGENTS) {
      assertLease();
      if ((only && agent.name !== only) || !settings[agent.name].enabled) continue;
      const last = lastRuns[agent.name] ? new Date(lastRuns[agent.name]).getTime() : 0, attempt = attempts[agent.name];
      const retry = attempt && attempt.status !== 'succeeded' && Date.now() - new Date(attempt.at).getTime() >= 3600000;
      const backingOff = attempt && attempt.status !== 'succeeded' && !retry;
      if (!force && (backingOff || (!retry && Date.now() - last < agent.cadenceHours * 3600000))) { skipped.push(agent.name); continue; }
      let status = 'succeeded', detail = '';
      try {
        const actions = (await agent.run()) || [];
        if (!Array.isArray(actions)) throw new Error('Agent returned an invalid action list');
        assertLease();
        for (const action of actions) {
          if (!action?.title || typeof action.title !== 'string') throw new Error('Agent action is missing a title');
          const degraded = action.type === 'error' || action.status === 'error' || /couldn.t|could not|unavailable|not configured|failed to|could not reach/i.test(action.title);
          if (degraded) { status = 'degraded'; detail = action.title.slice(0, 200); }
          if (action.status === 'needs_approval' && await GrowthAction.exists({ agent: agent.name, title: action.title, href: action.href || '', status: 'needs_approval', createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } })) continue;
          await GrowthAction.create({ agent: agent.name, type: action.type || 'info', title: action.title,
            detail: action.detail || '', href: action.href || '', status: degraded ? 'error' : action.status || 'info', meta: action.meta });
          actionCount++;
        }
        if (status === 'succeeded') { ran.push(agent.name); await SystemState.updateOne({ key: LASTRUN_KEY }, { $set: { [`value.${agent.name}`]: new Date().toISOString() } }, { upsert: true }); }
        else failed.push({ agent: agent.name, status, detail });
      } catch (error) {
        status = 'failed'; detail = 'Agent failed; review backend logs before retrying.';
        failed.push({ agent: agent.name, status, detail });
        console.error(`[growth] ${agent.name} failed`, error.code || error.name);
        await GrowthAction.create({ agent: agent.name, type: 'error', title: `${agent.label} could not complete`, detail, status: 'error' }).catch(() => {});
      }
      await SystemState.updateOne({ key: ATTEMPTS_KEY }, { $set: { [`value.${agent.name}`]: { at: new Date().toISOString(), status, detail } } }, { upsert: true });
    }
    return { ran, failed, skipped, actionCount };
  });
}
module.exports = { runGrowthEngine, getSettings, setAgentEnabled, describeAgents };

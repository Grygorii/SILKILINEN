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

const SETTINGS_KEY = 'growthEngineSettings';
const LASTRUN_KEY = 'growthEngineLastRun';

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
  const saved = await getState(SETTINGS_KEY);
  saved[name] = { ...(saved[name] || {}), enabled: Boolean(enabled) };
  await setState(SETTINGS_KEY, saved);
}

async function describeAgents() {
  const [settings, lastRuns] = await Promise.all([getSettings(), getState(LASTRUN_KEY)]);
  return AGENTS.map(a => ({
    name: a.name,
    label: a.label,
    description: a.description,
    cadenceHours: a.cadenceHours,
    enabled: settings[a.name].enabled,
    lastRun: lastRuns[a.name] || null,
  }));
}

/**
 * Run due agents (or a specific one / all when forced).
 * Returns { ran: [names], actionCount }.
 */
async function runGrowthEngine({ force = false, only = null } = {}) {
  const [settings, lastRuns] = await Promise.all([getSettings(), getState(LASTRUN_KEY)]);
  const now = Date.now();
  const ran = [];
  let actionCount = 0;

  for (const agent of AGENTS) {
    if (only && agent.name !== only) continue;
    if (!settings[agent.name].enabled) continue;
    const last = lastRuns[agent.name] ? new Date(lastRuns[agent.name]).getTime() : 0;
    const due = now - last >= agent.cadenceHours * 3600 * 1000;
    if (!force && !due) continue;

    try {
      const actions = (await agent.run()) || [];
      for (const act of actions) {
        await GrowthAction.create({
          agent: agent.name,
          type: act.type || 'info',
          title: act.title,
          detail: act.detail || '',
          href: act.href || '',
          status: act.status || 'info',
          meta: act.meta,
        });
        actionCount++;
      }
      ran.push(agent.name);
    } catch (err) {
      console.error(`[growth] agent ${agent.name} failed:`, err.message);
      await GrowthAction.create({
        agent: agent.name,
        type: 'error',
        title: `${agent.label} hit an error`,
        detail: err.message.slice(0, 300),
        status: 'error',
      }).catch(() => {});
    }

    lastRuns[agent.name] = new Date().toISOString();
    await setState(LASTRUN_KEY, lastRuns);
  }

  // Archivarius learns from this pulse — the clerks/watchdog flags become
  // pitfalls the agents will see (and avoid) next cycle — then stays sharp.
  await require('./archivarius').tick().catch(() => {});

  return { ran, actionCount };
}

module.exports = { runGrowthEngine, getSettings, setAgentEnabled, describeAgents };

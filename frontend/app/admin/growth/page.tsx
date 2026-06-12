'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import AdminErrorBanner from '@/components/AdminErrorBanner';
import { toast } from '@/lib/adminToast';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Agent = {
  name: string;
  label: string;
  description: string;
  cadenceHours: number;
  enabled: boolean;
  lastRun: string | null;
};

type GrowthAction = {
  _id: string;
  agent: string;
  type: string;
  title: string;
  detail: string;
  href?: string | null;
  status: 'done' | 'needs_approval' | 'info' | 'error';
  createdAt: string;
};

function cadenceLabel(h: number) {
  if (h === 168) return 'weekly';
  if (h === 72) return 'every 3 days';
  if (h === 24) return 'daily';
  return `every ${h}h`;
}

function timeAgo(iso: string | null | undefined) {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function dotClass(status: GrowthAction['status']) {
  if (status === 'needs_approval') return styles.dotGold;
  if (status === 'error') return styles.dotError;
  return styles.dotMuted;
}

export default function GrowthEnginePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [actions, setActions] = useState<GrowthAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pulsing, setPulsing] = useState(false);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(''); }
    try {
      const res = await fetch(`${API}/api/admin/growth`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Could not load the growth engine (${res.status}).`);
      const data = await res.json();
      setAgents(data.agents || []);
      setActions(data.actions || []);
      setError('');
    } catch (e: unknown) {
      if (!silent) setError(e instanceof Error ? e.message : 'Could not load the growth engine.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Keep the feed alive — quiet refresh every minute.
  useEffect(() => {
    const id = setInterval(() => { load(true); }, 60_000);
    return () => clearInterval(id);
  }, [load]);

  async function toggleAgent(agent: Agent) {
    const next = !agent.enabled;
    setAgents(prev => prev.map(a => (a.name === agent.name ? { ...a, enabled: next } : a)));
    try {
      const res = await fetch(`${API}/api/admin/growth/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
        body: JSON.stringify({ agent: agent.name, enabled: next }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (Array.isArray(data.agents)) setAgents(data.agents);
    } catch {
      setAgents(prev => prev.map(a => (a.name === agent.name ? { ...a, enabled: agent.enabled } : a)));
      toast(`Could not ${next ? 'enable' : 'disable'} ${agent.label}.`, 'error');
    }
  }

  async function run(agentName?: string) {
    if (agentName) setRunningAgent(agentName);
    else setPulsing(true);
    try {
      const res = await fetch(`${API}/api/admin/growth/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
        body: JSON.stringify(agentName ? { agent: agentName } : {}),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const ran: string[] = data.ran || [];
      toast(`Ran ${ran.length} agent(s) — ${data.actionCount ?? 0} new action(s).`);
      await load(true);
    } catch {
      toast('The engine could not pulse — try again.', 'error');
    } finally {
      if (agentName) setRunningAgent(null);
      else setPulsing(false);
    }
  }

  const labelByName = new Map(agents.map(a => [a.name, a.label]));
  const feed = [...actions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <AdminLayout active="growth">
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1>Growth Engine</h1>
            <p>
              An autonomous marketing team that pulses while you sleep — writing SEO articles,
              drafting social posts and newsletters, and watching the shop. Anything public is a
              draft until you approve it.
            </p>
          </div>
          <button
            type="button"
            className={styles.pulseBtn}
            onClick={() => run()}
            disabled={pulsing || loading}
          >
            {pulsing ? 'Pulsing…' : 'Pulse now'}
          </button>
        </div>

        {error && !loading && <AdminErrorBanner error={error} onRetry={() => { load(); }} />}

        {loading ? (
          <>
            <div className={styles.agentsGrid}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={styles.skelCard}>
                  <div className={styles.skelLine} style={{ width: '55%' }} />
                  <div className={styles.skelLine} style={{ width: '90%' }} />
                  <div className={styles.skelLine} style={{ width: '40%' }} />
                </div>
              ))}
            </div>
            <div className={styles.skelFeed}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className={styles.skelLine} style={{ width: `${88 - i * 9}%` }} />
              ))}
            </div>
          </>
        ) : !error && (
          <>
            {/* Agents */}
            <p className={styles.sectionLabel}>The team</p>
            <div className={styles.agentsGrid}>
              {agents.map(agent => (
                <div
                  key={agent.name}
                  className={`${styles.agentCard} ${agent.enabled ? '' : styles.agentCardOff}`}
                >
                  <div className={styles.agentTop}>
                    <span className={styles.agentName}>{agent.label}</span>
                    <button
                      type="button"
                      className={`${styles.toggle} ${agent.enabled ? styles.toggleOn : ''}`}
                      onClick={() => toggleAgent(agent)}
                      aria-pressed={agent.enabled}
                      aria-label={`${agent.enabled ? 'Disable' : 'Enable'} ${agent.label}`}
                    >
                      <span className={styles.knob} />
                    </button>
                  </div>
                  <p className={styles.agentDesc}>{agent.description}</p>
                  <div className={styles.agentFoot}>
                    <span className={styles.agentMeta}>
                      {cadenceLabel(agent.cadenceHours)} · last run {timeAgo(agent.lastRun)}
                    </span>
                    <button
                      type="button"
                      className={styles.runBtn}
                      onClick={() => run(agent.name)}
                      disabled={runningAgent !== null || pulsing}
                    >
                      {runningAgent === agent.name ? 'Running…' : 'Run'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Competitors the Scout studies */}
            <CompetitorEditor />

            {/* The Pulse feed */}
            <div className={styles.feedHeader}>
              <p className={styles.sectionLabel}>The Pulse</p>
              <span className={styles.live}>
                <span className={styles.liveDot} aria-hidden />
                live
              </span>
            </div>
            {feed.length === 0 ? (
              <div className={styles.empty}>
                The engine hasn&rsquo;t pulsed yet — press Pulse now to wake it.
              </div>
            ) : (
              <ul className={styles.feed}>
                {feed.map(action => (
                  <li
                    key={action._id}
                    className={`${styles.feedRow} ${
                      action.status === 'needs_approval' ? styles.feedRowApproval : ''
                    }`}
                  >
                    <span className={`${styles.dot} ${dotClass(action.status)}`} aria-hidden />
                    <div className={styles.feedBody}>
                      <div className={styles.feedTop}>
                        <span className={styles.agentChip}>
                          {labelByName.get(action.agent) || action.agent}
                        </span>
                        <span className={styles.feedTitle}>{action.title}</span>
                      </div>
                      {action.detail && <p className={styles.feedDetail}>{action.detail}</p>}
                      <span className={styles.feedTime}>{timeAgo(action.createdAt)}</span>
                    </div>
                    {action.href && (
                      <a href={action.href} className={styles.reviewLink}>
                        Review →
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

type Competitor = { name: string; domain: string };

// Editor for the list of brands the Competitor Scout studies. Seeded with
// real defaults on the backend; the founder adds or removes their own.
function CompetitorEditor() {
  const [list, setList] = useState<Competitor[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/growth/competitors`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.competitors) setList(d.competitors); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function save(next: Competitor[]) {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/growth/competitors`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
        body: JSON.stringify({ competitors: next }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Could not save.', 'error'); return; }
      setList(data.competitors);
      toast('Competitor list saved.');
    } catch {
      toast('Network error.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function add() {
    if (!name.trim()) return;
    const next = [...list, { name: name.trim(), domain: domain.trim() }];
    setName(''); setDomain('');
    save(next);
  }

  if (!loaded) return null;

  return (
    <div className={styles.competitorBox}>
      <p className={styles.sectionLabel}>The enemies — who the Scout studies</p>
      <div className={styles.competitorList}>
        {list.map((c, i) => (
          <span key={`${c.name}-${i}`} className={styles.competitorChip}>
            {c.name}
            {c.domain ? <span className={styles.competitorDomain}> · {c.domain}</span> : null}
            <button
              type="button"
              aria-label={`Remove ${c.name}`}
              className={styles.competitorRemove}
              onClick={() => save(list.filter((_, idx) => idx !== i))}
              disabled={saving}
            >×</button>
          </span>
        ))}
        {list.length === 0 && <span className={styles.competitorEmpty}>No competitors yet — add one.</span>}
      </div>
      <div className={styles.competitorAdd}>
        <input
          className={styles.competitorInput}
          placeholder="Brand name (e.g. Olivia von Halle)"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
        />
        <input
          className={styles.competitorInput}
          placeholder="website (optional, e.g. oliviavonhalle.com)"
          value={domain}
          onChange={e => setDomain(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
        />
        <button type="button" className={styles.runBtn} onClick={add} disabled={saving || !name.trim()}>Add</button>
      </div>
    </div>
  );
}

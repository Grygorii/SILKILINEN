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

type NorthStar = {
  metric: string;
  target: number;
  deadline?: string | null;
  note?: string | null;
  setAt?: string;
} | null;

type MetricDef = { key: string; label: string; unit: string };

// Da Vinci's masterwork — the conductor's 90-day symphony.
type Composition = {
  _id: string;
  vision: string;
  grandIdea?: { title?: string; what?: string; why?: string } | null;
  movements: { title: string; theme: string; moves: string[] }[];
  closing?: string;
  createdAt: string;
} | null;

// The AI Star's live read on pace — it notices drift and speaks.
type StarStatus = {
  current: number | null;
  target: number;
  pct: number | null;
  label: string;
  pace: 'measuring' | 'on track' | 'drifting' | 'achieved' | 'no deadline';
  guidance: string;
  deadline?: string | null;
} | null;

type Brief = {
  _id: string;
  headline: string;
  northStar: {
    metric: string;
    target: number;
    current: number;
    pct: number | null;
    label: string;
    deadline?: string | null;
  } | null;
  progress: string;
  whatChanged: string;
  whatsWorking: string;
  marketRead?: string;
  moves: { title: string; agent: string; why: string }[];
  founderActions: string[];
  buildIdeas: { title: string; source: string; why: string }[];
  createdAt: string;
} | null;

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

function briefDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-IE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(iso));
  } catch {
    return '';
  }
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

  // Brain — AI Star + Co-CEO brief
  const [northStar, setNorthStar] = useState<NorthStar>(null);
  const [starStatus, setStarStatus] = useState<StarStatus>(null);
  const [metrics, setMetrics] = useState<MetricDef[]>([]);
  const [brief, setBrief] = useState<Brief>(null);
  const [brainLoading, setBrainLoading] = useState(true);
  const [brainError, setBrainError] = useState(false);
  const [briefBusy, setBriefBusy] = useState(false);
  const [composition, setComposition] = useState<Composition>(null);
  const [davinciBusy, setDavinciBusy] = useState(false);

  const loadBrain = useCallback(async () => {
    setBrainLoading(true);
    setBrainError(false);
    try {
      const res = await fetch(`${API}/api/admin/growth/brain`, { credentials: 'include' });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setNorthStar(data.northStar ?? null);
      setStarStatus(data.status ?? null);
      setMetrics(data.metrics ?? []);
      setBrief(data.brief ?? null);
      setComposition(data.composition ?? null);
    } catch {
      setBrainError(true);
    } finally {
      setBrainLoading(false);
    }
  }, []);

  useEffect(() => { loadBrain(); }, [loadBrain]);

  async function saveNorthStar(body: {
    metric: string;
    target: number;
    deadline?: string;
    note?: string;
  }) {
    const res = await fetch(`${API}/api/admin/growth/north-star`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setNorthStar(data.northStar ?? null);
    toast('AI Star set \u2014 I\u2019m watching your pace now.');
  }

  async function unleashDaVinci() {
    setDavinciBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/growth/davinci`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Da Vinci stumbled — unleash again.', 'error'); return; }
      setComposition(data.composition ?? null);
      toast('Da Vinci has composed the masterwork.');
      load(true); // the background pulse will be dropping fresh notes into the feed
    } catch {
      toast('Network error — unleash again.', 'error');
    } finally {
      setDavinciBusy(false);
    }
  }

  async function newBrief() {
    setBriefBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/growth/brief`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setBrief(data.brief ?? null);
      toast('Fresh brief ready.');
    } catch {
      toast('Could not write a brief — try again.', 'error');
    } finally {
      setBriefBusy(false);
    }
  }

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
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button
              type="button"
              className={styles.davinciBtn}
              onClick={unleashDaVinci}
              disabled={davinciBusy}
              title="Make every agent play as one and compose the 90-day masterwork"
            >
              {davinciBusy ? 'The studio is composing…' : '✺ Unleash Da Vinci'}
            </button>
            <button
              type="button"
              className={styles.pulseBtn}
              onClick={() => run()}
              disabled={pulsing || loading}
            >
              {pulsing ? 'Pulsing…' : 'Pulse now'}
            </button>
          </div>
        </div>

        <DaVinciSection composition={composition} busy={davinciBusy} />

        {/* AI Star + Co-CEO brief */}
        <NorthStarSection
          loading={brainLoading}
          error={brainError}
          onRetry={loadBrain}
          northStar={northStar}
          starStatus={starStatus}
          metrics={metrics}
          brief={brief}
          onSave={saveNorthStar}
        />
        {!brainLoading && !brainError && (
          <BriefSection brief={brief} busy={briefBusy} onNewBrief={newBrief} />
        )}

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
                      action.type === 'eureka'
                        ? styles.feedRowEureka
                        : action.status === 'needs_approval' ? styles.feedRowApproval : ''
                    }`}
                  >
                    <span className={`${styles.dot} ${dotClass(action.status)}`} aria-hidden />
                    <div className={styles.feedBody}>
                      <div className={styles.feedTop}>
                        <span className={action.type === 'eureka' ? styles.eurekaChip : styles.agentChip}>
                          {action.type === 'eureka' ? '💡 Eureka' : (labelByName.get(action.agent) || action.agent)}
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
  const [discovering, setDiscovering] = useState(false);

  async function discover() {
    setDiscovering(true);
    try {
      const res = await fetch(`${API}/api/admin/growth/competitors/discover`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': '1' },
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Discovery failed.', 'error'); return; }
      if (data.competitors) setList(data.competitors);
      toast(
        data.added > 0
          ? `Found ${data.added} new brand${data.added === 1 ? '' : 's'} — now studying ${data.total} across your markets.`
          : `No new brands this run — already studying ${data.total}.`,
      );
    } catch {
      toast('Network error.', 'error');
    } finally {
      setDiscovering(false);
    }
  }

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <p className={styles.sectionLabel} style={{ margin: 0 }}>The enemies — who the Scout studies ({list.length})</p>
        <button
          type="button"
          onClick={discover}
          disabled={discovering || saving}
          style={{
            fontSize: 12, padding: '7px 14px', cursor: discovering ? 'default' : 'pointer',
            border: '1px solid var(--dark, #2a2218)', background: 'var(--dark, #2a2218)', color: '#fff',
            opacity: discovering ? 0.6 : 1, whiteSpace: 'nowrap',
          }}
          title="Let the AI find silk & sleepwear brands across every market you ship to, verify they're live, and add them"
        >
          {discovering ? 'Searching the market…' : '✨ Auto-discover competitors'}
        </button>
      </div>
      <div className={styles.competitorList} style={{ marginTop: 12 }}>
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

/* ── Da Vinci — the conductor's masterwork ───────────────── */

function DaVinciSection({ composition, busy }: { composition: Composition; busy: boolean }) {
  if (busy && !composition) {
    return (
      <div className={styles.davinci}>
        <p className={styles.davinciEyebrow}>✺ Da Vinci is composing</p>
        <p className={styles.davinciComposing}>
          Every voice at once — the demand scout, the inventor, the scouts, the brief — gathered into one score.
          This takes a minute.
        </p>
      </div>
    );
  }
  if (!composition) return null;
  return (
    <div className={styles.davinci}>
      <div className={styles.davinciHead}>
        <p className={styles.davinciEyebrow}>✺ Da Vinci — the masterwork</p>
        <span className={styles.davinciDate}>{briefDate(composition.createdAt)}</span>
      </div>
      <p className={styles.davinciVision}>{composition.vision}</p>

      {composition.grandIdea?.title && (
        <div className={styles.grandIdea}>
          <span className={styles.grandIdeaLabel}>The Grand Idea</span>
          <h3 className={styles.grandIdeaTitle}>{composition.grandIdea.title}</h3>
          {composition.grandIdea.what && <p className={styles.grandIdeaText}>{composition.grandIdea.what}</p>}
          {composition.grandIdea.why && <p className={styles.grandIdeaWhy}>{composition.grandIdea.why}</p>}
        </div>
      )}

      {composition.movements?.length > 0 && (
        <div className={styles.movements}>
          {composition.movements.map((m, i) => (
            <div key={i} className={styles.movement}>
              <div className={styles.movementHead}>
                <span className={styles.movementNo}>{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h4 className={styles.movementTitle}>{m.title}</h4>
                  {m.theme && <p className={styles.movementTheme}>{m.theme}</p>}
                </div>
              </div>
              <ul className={styles.movementMoves}>
                {(m.moves || []).map((mv, j) => <li key={j}>{mv}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}

      {composition.closing && <p className={styles.davinciClosing}>{composition.closing}</p>}
    </div>
  );
}

/* ── North Star ─────────────────────────────────────────── */

type NorthStarSectionProps = {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  northStar: NorthStar;
  starStatus: StarStatus;
  metrics: MetricDef[];
  brief: Brief;
  onSave: (body: { metric: string; target: number; deadline?: string; note?: string }) => Promise<void>;
};

function NorthStarSection({ loading, error, onRetry, northStar, starStatus, metrics, brief, onSave }: NorthStarSectionProps) {
  const [editing, setEditing] = useState(false);

  if (loading) {
    return (
      <div className={styles.northStar}>
        <div className={styles.skelLine} style={{ width: '40%', height: 16 }} />
        <div className={styles.skelLine} style={{ width: '70%', marginTop: 14 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.northStar}>
        <span className={styles.brainRetryText}>Couldn&rsquo;t load your AI Star.</span>
        <button type="button" className={styles.runBtn} onClick={onRetry}>Retry</button>
      </div>
    );
  }

  // No goal yet, or editing → show form.
  if (!northStar || editing) {
    return (
      <div className={styles.northStar}>
        {!northStar && (
          <>
            <p className={styles.northStarEyebrow}>Your AI Star</p>
            <h2 className={styles.northStarPrompt}>Set your AI Star</h2>
            <p className={styles.northStarHint}>
              One number that matters most. Your AI Star points the whole engine at it — and tells you the moment you drift.
            </p>
          </>
        )}
        <NorthStarForm
          metrics={metrics}
          initial={northStar}
          onCancel={northStar ? () => setEditing(false) : undefined}
          onSave={async (body) => { await onSave(body); setEditing(false); }}
        />
      </div>
    );
  }

  // Goal set → headline + progress bar.
  const ns = brief?.northStar;
  const metricLabel = ns?.label
    || metrics.find(m => m.key === northStar.metric)?.label
    || northStar.metric;
  const deadline = northStar.deadline ? ` by ${northStar.deadline}` : '';
  const pct = ns?.pct ?? null;
  const fill = pct === null ? 0 : Math.min(pct, 100);

  return (
    <div className={styles.northStar}>
      <div className={styles.northStarHead}>
        <p className={styles.northStarEyebrow}>AI Star</p>
        <button type="button" className={styles.runBtn} onClick={() => setEditing(true)}>Edit</button>
      </div>
      <h2 className={styles.northStarGoal}>
        {northStar.target} {metricLabel}{deadline}
      </h2>
      <div className={styles.progressWrap}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${fill}%` }} />
        </div>
        <span className={styles.progressNums}>
          {pct === null
            ? 'measuring…'
            : `${ns?.current ?? 0} / ${northStar.target} (${Math.round(pct)}%)`}
        </span>
      </div>
      {starStatus?.guidance ? (
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12,
            padding: '10px 12px', fontSize: 13, lineHeight: 1.55,
            background: starStatus.pace === 'drifting' ? '#fdf6e9' : 'var(--cream, #f5f2ec)',
            border: `1px solid ${starStatus.pace === 'drifting' ? '#ecdcb6' : 'var(--border, #e8e2d6)'}`,
            color: 'var(--dark, #2a2218)',
          }}
        >
          <span aria-hidden style={{ flexShrink: 0 }}>
            {starStatus.pace === 'drifting' ? '⚠' : starStatus.pace === 'achieved' ? '★' : '✦'}
          </span>
          <span>
            <strong style={{ textTransform: 'capitalize' }}>{starStatus.pace}</strong>
            {' — '}{starStatus.guidance}
          </span>
        </div>
      ) : null}
      {northStar.note ? <p className={styles.northStarNote}>{northStar.note}</p> : null}
    </div>
  );
}

type NorthStarFormProps = {
  metrics: MetricDef[];
  initial: NorthStar;
  onCancel?: () => void;
  onSave: (body: { metric: string; target: number; deadline?: string; note?: string }) => Promise<void>;
};

function NorthStarForm({ metrics, initial, onCancel, onSave }: NorthStarFormProps) {
  const [metric, setMetric] = useState(initial?.metric || metrics[0]?.key || '');
  const [target, setTarget] = useState(initial?.target != null ? String(initial.target) : '');
  const [deadline, setDeadline] = useState(initial?.deadline || '');
  const [note, setNote] = useState(initial?.note || '');
  const [saving, setSaving] = useState(false);

  async function submit() {
    const t = Number(target);
    if (!metric || !Number.isFinite(t) || t <= 0) return;
    setSaving(true);
    try {
      await onSave({ metric, target: t, deadline: deadline || undefined, note: note.trim() || undefined });
    } catch {
      toast('Could not set your North Star — try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.nsForm}>
      <select
        className={styles.nsSelect}
        value={metric}
        onChange={e => setMetric(e.target.value)}
        aria-label="Metric"
      >
        {metrics.map(m => (
          <option key={m.key} value={m.key}>{m.label}</option>
        ))}
      </select>
      <input
        className={styles.nsInput}
        type="number"
        min={0}
        placeholder="Target"
        value={target}
        onChange={e => setTarget(e.target.value)}
        aria-label="Target"
      />
      <input
        className={styles.nsInput}
        type="month"
        value={deadline}
        onChange={e => setDeadline(e.target.value)}
        aria-label="By when"
      />
      <input
        className={`${styles.nsInput} ${styles.nsNote}`}
        type="text"
        placeholder="Note (optional)"
        value={note}
        onChange={e => setNote(e.target.value)}
        aria-label="Note"
      />
      <button
        type="button"
        className={styles.nsSetBtn}
        onClick={submit}
        disabled={saving || !metric || !target}
      >
        {saving ? 'Saving…' : 'Set goal'}
      </button>
      {onCancel && (
        <button type="button" className={styles.runBtn} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      )}
    </div>
  );
}

/* ── The Co-CEO brief ───────────────────────────────────── */

function BriefSection({ brief, busy, onNewBrief }: { brief: Brief; busy: boolean; onNewBrief: () => void }) {
  return (
    <section className={styles.briefSection}>
      <div className={styles.briefHead}>
        <div>
          <p className={styles.briefEyebrow}>This week&rsquo;s brief</p>
          {brief && <p className={styles.briefDate}>{briefDate(brief.createdAt)}</p>}
        </div>
        <button
          type="button"
          className={styles.newBriefBtn}
          onClick={onNewBrief}
          disabled={busy}
        >
          {busy ? 'Thinking…' : 'New brief'}
        </button>
      </div>

      {!brief ? (
        <div className={styles.briefEmpty}>
          No brief yet — press New brief and your Chief of Staff will study the numbers and report.
        </div>
      ) : (
        <article className={styles.briefDoc}>
          <h2 className={styles.briefHeadline}>{brief.headline}</h2>

          <BriefPassage label="Progress" text={brief.progress} />
          <BriefPassage label="What changed" text={brief.whatChanged} />
          <BriefPassage label="What's working" text={brief.whatsWorking} />
          {brief.marketRead && <BriefPassage label="The market" text={brief.marketRead} />}

          {brief.moves.length > 0 && (
            <div className={styles.briefBlock}>
              <p className={styles.briefBlockLabel}>This week&rsquo;s moves</p>
              <ul className={styles.movesList}>
                {brief.moves.map((m, i) => (
                  <li key={i} className={styles.moveRow}>
                    <span className={styles.moveAgent}>{m.agent}</span>
                    <div className={styles.moveBody}>
                      <span className={styles.moveTitle}>{m.title}</span>
                      <span className={styles.moveWhy}>{m.why}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {brief.founderActions.length > 0 && (
            <div className={styles.briefBlock}>
              <p className={styles.briefBlockLabel}>Your moves</p>
              <ul className={styles.founderList}>
                {brief.founderActions.map((a, i) => (
                  <li key={i} className={styles.founderItem}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {brief.buildIdeas.length > 0 && (
            <div className={styles.briefBlock}>
              <p className={styles.briefBlockLabel}>Worth building</p>
              <div className={styles.ideaGrid}>
                {brief.buildIdeas.map((idea, i) => (
                  <div key={i} className={styles.ideaCard}>
                    <div className={styles.ideaTop}>
                      <span className={styles.ideaTitle}>{idea.title}</span>
                      <span className={styles.ideaSource}>{idea.source}</span>
                    </div>
                    <p className={styles.ideaWhy}>{idea.why}</p>
                    <span className={styles.ideaBuild}>Tell Claude to build this.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>
      )}
    </section>
  );
}

function BriefPassage({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div className={styles.passage}>
      <p className={styles.passageLabel}>{label}</p>
      <p className={styles.passageText}>{text}</p>
    </div>
  );
}

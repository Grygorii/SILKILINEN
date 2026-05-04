'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type AgentStatus = 'pending' | 'running' | 'done' | 'error';

type AgentResult = {
  status: AgentStatus;
  duration?: number;
  findingsCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  error?: string;
};

type Finding = {
  severity: 'critical' | 'warning' | 'info';
  agent: 'navigation' | 'journeys' | 'consistency';
  title: string;
  detail?: string;
  location?: string;
  suggestion?: string;
  status: 'open' | 'fixed' | 'wont_fix';
};

type Audit = {
  _id: string;
  runAt: string;
  completedAt?: string;
  duration?: number;
  status: 'running' | 'completed' | 'failed';
  agents: {
    navigation: AgentResult;
    journeys: AgentResult;
    consistency: AgentResult;
  };
  findings: Finding[];
  triggeredBy?: string;
};

type AuditSummary = Omit<Audit, 'findings'>;

const AGENT_LABELS: Record<string, string> = {
  navigation: 'Navigation & Routing',
  journeys: 'User Journeys',
  consistency: 'Cross-Surface Consistency',
};

function fmt(ms?: number) {
  if (!ms) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function AgentCard({ name, result }: { name: string; result: AgentResult }) {
  const statusClass =
    result.status === 'done' ? styles.statusDone
    : result.status === 'running' ? styles.statusRunning
    : result.status === 'error' ? styles.statusError
    : styles.statusPending;

  return (
    <div className={styles.agentCard}>
      <div className={styles.agentCardHeader}>
        <span className={styles.agentName}>{AGENT_LABELS[name]}</span>
        <span className={`${styles.agentStatus} ${statusClass}`}>{result.status}</span>
      </div>
      {result.status === 'running' && <div className={styles.progressBar}><div className={styles.progressFill} /></div>}
      {(result.status === 'done' || result.status === 'error') && (
        <div className={styles.agentCounts}>
          <span className={styles.countCritical}>{result.criticalCount} critical</span>
          <span className={styles.countWarning}>{result.warningCount} warning</span>
          <span className={styles.countInfo}>{result.infoCount} info</span>
          {result.duration && <span className={styles.countDuration}>{fmt(result.duration)}</span>}
        </div>
      )}
      {result.status === 'error' && result.error && (
        <p className={styles.agentError}>{result.error}</p>
      )}
    </div>
  );
}

function FindingRow({
  finding,
  idx,
  auditId,
  onStatusChange,
}: {
  finding: Finding;
  idx: number;
  auditId: string;
  onStatusChange: (idx: number, status: Finding['status']) => void;
}) {
  const [updating, setUpdating] = useState(false);

  async function setStatus(status: Finding['status']) {
    setUpdating(true);
    try {
      await fetch(`${API}/api/admin/site-audit/${auditId}/findings/${idx}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include',
      });
      onStatusChange(idx, status);
    } finally {
      setUpdating(false);
    }
  }

  const sevClass =
    finding.severity === 'critical' ? styles.sevCritical
    : finding.severity === 'warning' ? styles.sevWarning
    : styles.sevInfo;

  return (
    <div className={`${styles.findingRow} ${finding.status !== 'open' ? styles.findingResolved : ''}`}>
      <div className={styles.findingLeft}>
        <span className={`${styles.sevBadge} ${sevClass}`}>{finding.severity}</span>
        <div className={styles.findingContent}>
          <p className={styles.findingTitle}>{finding.title}</p>
          {finding.location && <p className={styles.findingLocation}>{finding.location}</p>}
          {finding.detail && <p className={styles.findingDetail}>{finding.detail}</p>}
          {finding.suggestion && <p className={styles.findingSuggestion}>Fix: {finding.suggestion}</p>}
        </div>
      </div>
      <div className={styles.findingActions}>
        {finding.status === 'open' ? (
          <>
            <button
              className={styles.btnFixed}
              onClick={() => setStatus('fixed')}
              disabled={updating}
            >Fixed</button>
            <button
              className={styles.btnWontFix}
              onClick={() => setStatus('wont_fix')}
              disabled={updating}
            >Won&apos;t fix</button>
          </>
        ) : (
          <span className={styles.resolvedLabel}>
            {finding.status === 'fixed' ? 'Fixed' : "Won't fix"}
            <button className={styles.undoBtn} onClick={() => setStatus('open')} disabled={updating}>undo</button>
          </span>
        )}
      </div>
    </div>
  );
}

export default function SiteAuditPage() {
  const [history, setHistory] = useState<AuditSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'critical'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  const loadHistory = useCallback(async () => {
    const res = await fetch(`${API}/api/admin/site-audit`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setHistory(data);
    }
  }, []);

  const loadAudit = useCallback(async (id: string) => {
    const res = await fetch(`${API}/api/admin/site-audit/${id}`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setAudit(data);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!selectedId) return;
    loadAudit(selectedId);
  }, [selectedId, loadAudit]);

  // Poll while audit is running
  useEffect(() => {
    if (!audit || audit.status !== 'running') return;
    const timer = setInterval(() => loadAudit(audit._id), 3000);
    return () => clearInterval(timer);
  }, [audit, loadAudit]);

  async function triggerAudit() {
    setRunning(true);
    try {
      const res = await fetch(`${API}/api/admin/site-audit`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const { auditId } = await res.json();
        await loadHistory();
        setSelectedId(auditId);
      }
    } finally {
      setRunning(false);
    }
  }

  function handleStatusChange(idx: number, status: Finding['status']) {
    if (!audit) return;
    const findings = [...audit.findings];
    findings[idx] = { ...findings[idx], status };
    setAudit({ ...audit, findings });
  }

  const filteredFindings = audit?.findings.filter(f => {
    if (agentFilter !== 'all' && f.agent !== agentFilter) return false;
    if (filter === 'open') return f.status === 'open';
    if (filter === 'critical') return f.severity === 'critical' && f.status === 'open';
    return true;
  }) ?? [];

  const openCritical = audit?.findings.filter(f => f.severity === 'critical' && f.status === 'open').length ?? 0;

  return (
    <AdminLayout active="site-audit">
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Site Audit</h1>
            <p className={styles.subtitle}>Automated checks for navigation, user journeys, and data consistency</p>
          </div>
          <button className={styles.runBtn} onClick={triggerAudit} disabled={running || audit?.status === 'running'}>
            {running ? 'Starting…' : audit?.status === 'running' ? 'Running…' : 'Run Audit'}
          </button>
        </div>

        <div className={styles.body}>
          {/* Sidebar: history */}
          <aside className={styles.sidebar}>
            <h2 className={styles.sidebarTitle}>History</h2>
            {history.length === 0 && <p className={styles.empty}>No audits yet</p>}
            {history.map(a => (
              <button
                key={a._id}
                className={`${styles.historyItem} ${selectedId === a._id ? styles.historyActive : ''}`}
                onClick={() => setSelectedId(a._id)}
              >
                <span className={styles.historyTime}>{timeAgo(a.runAt)}</span>
                <span className={`${styles.historyStatus} ${a.status === 'completed' ? styles.statusDone : a.status === 'running' ? styles.statusRunning : styles.statusError}`}>
                  {a.status}
                </span>
              </button>
            ))}
          </aside>

          {/* Main content */}
          <main className={styles.main}>
            {!selectedId && (
              <div className={styles.emptyState}>
                <p>Run an audit to inspect your site</p>
              </div>
            )}

            {audit && (
              <>
                {/* Agent summary cards */}
                <div className={styles.agentCards}>
                  {(['navigation', 'journeys', 'consistency'] as const).map(name => (
                    <AgentCard key={name} name={name} result={audit.agents[name]} />
                  ))}
                </div>

                {audit.status === 'completed' && (
                  <>
                    {openCritical > 0 && (
                      <div className={styles.criticalBanner}>
                        {openCritical} critical issue{openCritical > 1 ? 's' : ''} need attention
                      </div>
                    )}

                    {/* Filters */}
                    <div className={styles.filters}>
                      <div className={styles.filterGroup}>
                        {(['all', 'open', 'critical'] as const).map(f => (
                          <button
                            key={f}
                            className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
                            onClick={() => setFilter(f)}
                          >
                            {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'Critical'}
                          </button>
                        ))}
                      </div>
                      <div className={styles.filterGroup}>
                        {(['all', 'navigation', 'journeys', 'consistency'] as const).map(a => (
                          <button
                            key={a}
                            className={`${styles.filterBtn} ${agentFilter === a ? styles.filterActive : ''}`}
                            onClick={() => setAgentFilter(a)}
                          >
                            {a === 'all' ? 'All agents' : AGENT_LABELS[a]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Findings list */}
                    <div className={styles.findings}>
                      {filteredFindings.length === 0 && (
                        <p className={styles.empty}>No findings match this filter</p>
                      )}
                      {filteredFindings.map((finding, i) => {
                        const realIdx = audit.findings.indexOf(finding);
                        return (
                          <FindingRow
                            key={i}
                            finding={finding}
                            idx={realIdx}
                            auditId={audit._id}
                            onStatusChange={handleStatusChange}
                          />
                        );
                      })}
                    </div>

                    <p className={styles.auditMeta}>
                      Completed {audit.completedAt ? timeAgo(audit.completedAt) : '—'} · Total duration {fmt(audit.duration)}
                    </p>
                  </>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </AdminLayout>
  );
}

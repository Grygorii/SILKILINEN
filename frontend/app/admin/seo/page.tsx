'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';
import SeoHealthPanel from '../_components/dashboard/SeoHealthPanel';
import SearchPerformancePanel from '../_components/dashboard/SearchPerformancePanel';
import RebuildSeoModal from './RebuildSeoModal';
import SeoBasePanel from './SeoBasePanel';
import SubmitIndexNowButton from '@/components/SubmitIndexNowButton';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

// The SEO command centre — one home for everything that decides whether Google
// shows the shop and whether people click. It composes the existing health and
// Search Console panels, surfaces Hermes' (the search-performance agent's)
// recommendations, and gathers the one-click fixes in a single place.
type Tab = 'overview' | 'recommendations' | 'base' | 'fix';

type Action = {
  _id: string;
  agent: string;
  type: string;
  title: string;
  detail?: string;
  href?: string;
  status?: string;
  createdAt: string;
};
type Agent = { name: string; label: string; enabled: boolean; lastRun: string | null };

function timeAgo(iso?: string) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SeoHubPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [hermes, setHermes] = useState<Action[]>([]);
  const [hermesAgent, setHermesAgent] = useState<Agent | null>(null);
  const [running, setRunning] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  const loadHermes = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/growth`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const actions: Action[] = Array.isArray(data.actions) ? data.actions : [];
      // Show only the LATEST run's recommendations, deduped — not the whole
      // accumulated history (which piles up and repeats across runs). A run
      // writes its actions in one burst, so keep those within ~5 min of the
      // newest, deduped by title.
      const mine = actions
        .filter(a => a.agent === 'hermes')
        .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
      let latest: Action[] = [];
      if (mine.length) {
        const newest = new Date(mine[0].createdAt).getTime();
        const seen = new Set<string>();
        latest = mine
          .filter(a => newest - new Date(a.createdAt).getTime() < 5 * 60 * 1000)
          .filter(a => { if (seen.has(a.title)) return false; seen.add(a.title); return true; });
      }
      setHermes(latest);
      const ag = (Array.isArray(data.agents) ? data.agents : []).find((a: Agent) => a.name === 'hermes');
      setHermesAgent(ag || null);
    } catch { /* leave as-is */ }
  }, []);

  useEffect(() => { loadHermes(); }, [loadHermes]);

  async function runHermes() {
    setRunning(true);
    try {
      const res = await fetch(`${API}/api/admin/growth/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'hermes' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Run failed');
      }
      toast('Hermes is mapping your search footholds…', 'success');
      // Give the run a moment to write its actions, then refresh.
      setTimeout(loadHermes, 1500);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Could not run Hermes.', 'error');
    } finally {
      setRunning(false);
    }
  }

  const flagCount = hermes.filter(a => a.status === 'needs_approval').length;

  return (
    <AdminLayout>
      <div className={styles.header}>
        <h1 className={styles.title}>SEO</h1>
        <p className={styles.intro}>
          One place for everything that decides whether Google shows the shop and whether people click —
          your live search performance, the health of the signals Google reads, Hermes&rsquo; recommendations,
          and the one-click fixes.
        </p>
        <SubmitIndexNowButton />
      </div>

      <div className={styles.tabs} role="tablist">
        <button
          className={`${styles.tab} ${tab === 'overview' ? styles.tabActive : ''}`}
          onClick={() => setTab('overview')}
          role="tab"
          aria-selected={tab === 'overview'}
        >
          Overview
        </button>
        <button
          className={`${styles.tab} ${tab === 'recommendations' ? styles.tabActive : ''}`}
          onClick={() => setTab('recommendations')}
          role="tab"
          aria-selected={tab === 'recommendations'}
        >
          Recommendations
          {flagCount > 0 && <span className={styles.tabCount}>{flagCount}</span>}
        </button>
        <button
          className={`${styles.tab} ${tab === 'base' ? styles.tabActive : ''}`}
          onClick={() => setTab('base')}
          role="tab"
          aria-selected={tab === 'base'}
        >
          Base
        </button>
        <button
          className={`${styles.tab} ${tab === 'fix' ? styles.tabActive : ''}`}
          onClick={() => setTab('fix')}
          role="tab"
          aria-selected={tab === 'fix'}
        >
          Fix-it
        </button>
      </div>

      {tab === 'overview' && (
        <div className={styles.panel}>
          <SearchPerformancePanel />
          <SeoHealthPanel />
        </div>
      )}

      {tab === 'recommendations' && (
        <div className={styles.panel}>
          <div>
            <div className={styles.recHead}>
              <div>
                <p className={styles.title} style={{ fontSize: 18 }}>Hermes &middot; the Pathfinder</p>
                <p className={styles.intro}>
                  The search-performance agent reads your real Search Console data and turns it into a ranked
                  plan — striking-distance queries to push onto page one, pages seen but not clicked, and meta gaps.
                  {hermesAgent?.lastRun && <> Last mapped {timeAgo(hermesAgent.lastRun)}.</>}
                </p>
              </div>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={runHermes} disabled={running}>
                {running ? 'Running…' : 'Run Hermes now'}
              </button>
            </div>

            {hermes.length === 0 ? (
              <div className={styles.empty} style={{ marginTop: 16 }}>
                No recommendations yet. Press <strong>Run Hermes now</strong> — he&rsquo;ll map the searches people
                already use to find you. (Needs Search Console connected and a few impressions to work with.)
              </div>
            ) : (
              <div className={styles.recList}>
                {hermes.map(a => (
                  <div key={a._id} className={`${styles.recRow} ${a.status === 'needs_approval' ? styles.recRowFlag : ''}`}>
                    <p className={styles.recTitle}>{a.title}</p>
                    {a.detail && <p className={styles.recDetail}>{a.detail}</p>}
                    <p className={styles.recTime} style={{ marginTop: 8 }}>{timeAgo(a.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'base' && (
        <div className={styles.panel}>
          <SeoBasePanel />
        </div>
      )}

      {tab === 'fix' && (
        <div className={styles.panel}>
          <div>
            <p className={styles.title} style={{ fontSize: 18 }}>Deliver Hermes&rsquo; plan</p>
            <p className={styles.intro}>
              Two ways to fix, and they don&rsquo;t overlap. To simply <strong>fill in blank</strong> meta titles and
              descriptions, use the Base tab —
              its Auto-fix does that in one click.{' '}
              <button onClick={() => setTab('base')} style={{ background: 'none', border: 'none', padding: 0, color: '#b8863b', font: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>Go to Base →</button>.
              This tab is for Hermes&rsquo; <strong>strategic</strong> plan:
              rewriting meta to win clicks, and his content moves — each verified against live Search Console data and
              paused for your approval. (URLs are left untouched; changing them safely needs redirects.)
            </p>

            <div className={styles.card} style={{ marginTop: 14, borderLeft: '3px solid #b8863b' }}>
              <p className={styles.cardTitle}>✦ Rebuild SEO — deliver Hermes&rsquo; plan</p>
              <p className={styles.cardText}>
                Hermes is the brain; this is the hands. It loads Hermes&rsquo; latest plan and delivers it block by
                block (each step verified against live data): it writes the exact meta Hermes asked for on each
                product/category/collection — pausing for your approval before anything goes live — and drafts the
                paragraph for his content fixes so you just place it. Run Hermes first (Recommendations tab) if
                there&rsquo;s no plan yet.
              </p>
              <div className={styles.cardActions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setRebuilding(true)}>
                  Rebuild SEO
                </button>
                <button className={styles.btn} onClick={() => setTab('overview')}>Merchant &amp; feed health →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rebuilding && <RebuildSeoModal onClose={() => setRebuilding(false)} />}
    </AdminLayout>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';
import SeoHealthPanel from '../_components/dashboard/SeoHealthPanel';
import SearchPerformancePanel from '../_components/dashboard/SearchPerformancePanel';
import RebuildSeoModal from './RebuildSeoModal';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

// The SEO command centre — one home for everything that decides whether Google
// shows the shop and whether people click. It composes the existing health and
// Search Console panels, surfaces Hermes' (the search-performance agent's)
// recommendations, and gathers the one-click fixes in a single place.
type Tab = 'overview' | 'recommendations' | 'fix';

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
  const [fixing, setFixing] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  const loadHermes = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/growth`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const actions: Action[] = Array.isArray(data.actions) ? data.actions : [];
      setHermes(actions.filter(a => a.agent === 'hermes'));
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

  async function generateMissingProductSeo() {
    setFixing(true);
    try {
      const res = await fetch(`${API}/api/admin/products/bulk-generate-seo`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      toast(data.message || 'SEO generated.', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Could not generate product SEO.', 'error');
    } finally {
      setFixing(false);
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

      {tab === 'fix' && (
        <div className={styles.panel}>
          <div>
            <p className={styles.title} style={{ fontSize: 18 }}>One-click fixes</p>
            <p className={styles.intro}>
              Polish the words Google reads. Everything here is approve-first — generated drafts you review before
              they go live. (URLs are left untouched; changing them safely needs redirects.)
            </p>

            <div className={styles.card} style={{ marginTop: 14, borderLeft: '3px solid #b8863b' }}>
              <p className={styles.cardTitle}>✦ Rebuild SEO — deliver Hermes&rsquo; plan</p>
              <p className={styles.cardText}>
                Hermes is the brain; this is the hands. It loads Hermes&rsquo; latest plan and delivers it block by
                block (the Clerks&rsquo; blockchain line): it writes the exact meta Hermes asked for on each
                product/category/collection — pausing for your approval before anything goes live — and flags the
                content fixes (a paragraph, a link) for you. Run Hermes first if there&rsquo;s no plan yet.
              </p>
              <div className={styles.cardActions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setRebuilding(true)}>
                  Rebuild SEO
                </button>
              </div>
            </div>

            <p className={styles.intro} style={{ marginTop: 22 }}>Or fix individually:</p>
            <div className={styles.cards}>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Products missing SEO</p>
                <p className={styles.cardText}>
                  Generate a meta title + description for every product still missing one, in the brand voice.
                </p>
                <div className={styles.cardActions}>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={generateMissingProductSeo} disabled={fixing}>
                    {fixing ? 'Generating…' : 'Generate missing SEO'}
                  </button>
                  <a className={styles.btn} href="/admin/products?issues=no-seo">Review →</a>
                </div>
              </div>

              <div className={styles.card}>
                <p className={styles.cardTitle}>Category pages</p>
                <p className={styles.cardText}>
                  Each category page (/shop?category=…) can generate its own meta title + description, grounded in the
                  products on it.
                </p>
                <div className={styles.cardActions}>
                  <a className={styles.btn} href="/admin/categories">Open categories →</a>
                </div>
              </div>

              <div className={styles.card}>
                <p className={styles.cardTitle}>Collections</p>
                <p className={styles.cardText}>
                  Curated edits with their own pages. Each collection can generate its own meta title + description
                  in the editor.
                </p>
                <div className={styles.cardActions}>
                  <a className={styles.btn} href="/admin/collections">Open collections →</a>
                </div>
              </div>

              <div className={styles.card}>
                <p className={styles.cardTitle}>Merchant &amp; feed</p>
                <p className={styles.cardText}>
                  The product feed and sitemap Google reads. Check their health and Merchant Center status on the
                  Overview tab.
                </p>
                <div className={styles.cardActions}>
                  <button className={styles.btn} onClick={() => setTab('overview')}>See health →</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {rebuilding && <RebuildSeoModal onClose={() => setRebuilding(false)} />}
    </AdminLayout>
  );
}

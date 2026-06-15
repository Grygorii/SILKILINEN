'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

// Rebuild SEO — Hermes' hands. Hermes (the search-performance agent) is the
// brain: it analyses every SEO-relevant page and produces a ranked, structured
// plan. This pipeline LOADS that plan and delivers it, block by block (the
// Clerks' blockchain line), pausing for the founder's nod before any page-level
// meta goes live:
//   • meta findings on a resolved product/category/collection → generate the
//     exact meta Hermes asked for (his goal is passed as guidance) → apply on
//     approval.
//   • content findings (a paragraph, an internal link) and unresolved pages →
//     surfaced as "flagged for you" (a field can't hold them; the Content
//     Writer / founder actions them).

type Status = 'pending' | 'generating' | 'review' | 'applied' | 'skipped' | 'flagged' | 'error';
type Draft = { metaTitle: string; metaDescription: string };
type PlanItem = {
  ref: string;
  kind: 'meta' | 'content';
  entityType: string;
  entityId: string | null;
  slug: string | null;
  label: string;
  target: string;
  action: string;
  leverage: string;
  applicable: boolean;
  verified: boolean;
  warnings: string[];
};
type Block = PlanItem & { status: Status; draft?: Draft; result?: string; error?: string };
type Decision = 'approve' | 'reject';

const BASE: Record<string, string> = { product: 'products', category: 'categories', collection: 'collections' };
const APPLY_METHOD: Record<string, string> = { product: 'PUT', category: 'PATCH', collection: 'PATCH' };

export default function RebuildSeoModal({ onClose }: { onClose: () => void }) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [phase, setPhase] = useState<'loading' | 'no-plan' | 'running' | 'review' | 'done'>('loading');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [summary, setSummary] = useState('');
  const [runningHermes, setRunningHermes] = useState(false);

  const decisionRef = useRef<((d: Decision) => void) | null>(null);
  const cancelled = useRef(false);
  const started = useRef(false);

  const waitForDecision = useCallback(() => new Promise<Decision>(resolve => { decisionRef.current = resolve; }), []);
  const patch = useCallback((i: number, p: Partial<Block>) => {
    setBlocks(bs => bs.map((b, idx) => (idx === i ? { ...b, ...p } : b)));
  }, []);

  function decide(d: Decision) {
    const r = decisionRef.current;
    decisionRef.current = null;
    setPhase('running');
    r?.(d);
  }

  const start = useCallback(async () => {
    cancelled.current = false;

    async function fetchPlan(): Promise<PlanItem[]> {
      const res = await fetch(`${API}/api/admin/growth/hermes-plan`, { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.plan) ? data.plan : [];
    }

    async function generate(entityType: string, id: string, guidance: string): Promise<Draft> {
      const res = await fetch(`${API}/api/admin/${BASE[entityType]}/${id}/generate-seo`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guidance }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      return { metaTitle: data.seo?.metaTitle || '', metaDescription: data.seo?.metaDescription || '' };
    }

    async function apply(entityType: string, id: string, draft: Draft) {
      const res = await fetch(`${API}/api/admin/${BASE[entityType]}/${id}`, {
        method: APPLY_METHOD[entityType], credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metaTitle: draft.metaTitle, metaDescription: draft.metaDescription }),
      });
      if (!res.ok) throw new Error('Apply failed');
    }

    const plan = await fetchPlan();
    if (cancelled.current) return;
    if (!plan.length) { setPhase('no-plan'); return; }

    const chain: Block[] = plan.map(p => ({ ...p, status: 'pending' }));
    setBlocks(chain);
    setPhase('running');

    let applied = 0, skipped = 0, flagged = 0, failed = 0;
    for (let i = 0; i < chain.length; i++) {
      if (cancelled.current) return;
      setActiveIndex(i);
      const b = chain[i];
      try {
        if (!b.applicable || b.kind === 'content' || !b.entityId) {
          flagged++;
          patch(i, { status: 'flagged', result: `Flagged for you: ${b.action}` });
          continue;
        }
        patch(i, { status: 'generating', result: 'Writing the meta Hermes asked for…' });
        const draft = await generate(b.entityType, b.entityId, `${b.target ? `Rank for "${b.target}". ` : ''}${b.action}`);
        if (cancelled.current) return;
        patch(i, { status: 'review', draft });
        setPhase('review');
        const decision = await waitForDecision();
        if (cancelled.current) return;
        if (decision === 'approve') {
          patch(i, { status: 'generating', result: 'Applying…' });
          await apply(b.entityType, b.entityId, draft);
          applied++;
          patch(i, { status: 'applied', result: 'Applied to the live page.' });
        } else {
          skipped++;
          patch(i, { status: 'skipped', result: 'Skipped — left unchanged.' });
        }
      } catch (e) {
        failed++;
        patch(i, { status: 'error', error: e instanceof Error ? e.message : 'Failed' });
      }
    }

    setActiveIndex(-1);
    setPhase('done');
    const parts = [`${applied} applied`];
    if (flagged) parts.push(`${flagged} flagged for you`);
    if (skipped) parts.push(`${skipped} skipped`);
    if (failed) parts.push(`${failed} failed`);
    setSummary(`Hermes' plan delivered: ${parts.join(' · ')}.`);
  }, [patch, waitForDecision]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
    return () => { cancelled.current = true; decisionRef.current?.('reject'); };
  }, [start]);

  async function runHermes() {
    setRunningHermes(true);
    try {
      await fetch(`${API}/api/admin/growth/run`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'hermes' }),
      });
    } catch { /* ignore */ }
    setRunningHermes(false);
    started.current = false;
    setPhase('loading');
    start();
  }

  const doneCount = blocks.filter(b => ['applied', 'skipped', 'flagged', 'error'].includes(b.status)).length;

  function nodeClass(b: Block) {
    if (b.status === 'applied') return styles.nodeDone;
    if (b.status === 'skipped' || b.status === 'error') return styles.nodeSkip;
    if (b.status === 'generating') return styles.nodeRun;
    if (b.status === 'review' || b.status === 'flagged') return styles.nodeActive;
    return '';
  }

  return (
    <div className={styles.modalOverlay} onClick={() => { if (phase === 'done' || phase === 'no-plan') onClose(); }}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div>
            <h2 className={styles.modalTitle}>Rebuilding SEO — Hermes&rsquo; plan</h2>
            <p className={styles.modalSub}>
              Hermes analysed the site; this delivers his plan block by block. Meta fixes pause for your nod before
              they go live; content fixes (a paragraph, a link) are flagged for you.
            </p>
          </div>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close" disabled={phase === 'review'}>×</button>
        </div>

        {phase === 'loading' && <p className={styles.progressLine}>Loading Hermes&rsquo; plan…</p>}

        {phase === 'no-plan' && (
          <div className={styles.empty} style={{ marginTop: 16 }}>
            Hermes hasn&rsquo;t mapped a plan yet. Run him first — he reads your Search Console data and decides what to fix.
            <div className={styles.reviewActions} style={{ justifyContent: 'center', marginTop: 14 }}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={runHermes} disabled={runningHermes}>
                {runningHermes ? 'Hermes is mapping…' : 'Run Hermes now'}
              </button>
            </div>
          </div>
        )}

        {(phase === 'running' || phase === 'review' || phase === 'done') && (
          <>
            <p className={styles.progressLine}>
              {phase === 'done' ? 'Plan delivered' : `Block ${Math.min(doneCount + 1, blocks.length)} of ${blocks.length}`}
            </p>
            <div className={styles.chain}>
              {blocks.map((b, i) => (
                <div key={b.ref} className={`${styles.block} ${i === activeIndex ? styles.blockActive : ''}`}>
                  <span className={`${styles.blockNode} ${nodeClass(b)}`} />
                  <div className={styles.blockMain}>
                    <p className={styles.blockLabel}>
                      {b.entityType}: {b.label} <span className={styles.blockRef}>[{b.ref}]</span>
                    </p>
                    {/* The Clerks' check on this recommendation, before you act. */}
                    {b.verified ? (
                      <p className={styles.blockState} style={{ color: '#1a6b3c' }}>✓ Verified — entity live, query in Search Console</p>
                    ) : (
                      b.warnings?.length > 0 && (
                        <p className={styles.blockState} style={{ color: '#b8863b' }}>⚠ {b.warnings.join(' · ')}</p>
                      )
                    )}
                    {(b.result || b.error) && (
                      <p className={styles.blockState} style={b.status === 'error' ? { color: '#b03a2e' } : undefined}>
                        {b.error ? `Error: ${b.error}` : b.result}
                      </p>
                    )}
                    {b.status === 'review' && b.draft && i === activeIndex && (
                      <div className={styles.reviewBox}>
                        {b.target && <p className={styles.blockState} style={{ marginTop: 0, marginBottom: 8 }}>Hermes&rsquo; goal: {b.action}</p>}
                        <div className={styles.reviewField}>
                          <p className={styles.reviewK}>Meta title</p>
                          <p className={styles.reviewV}>{b.draft.metaTitle}</p>
                        </div>
                        <div className={styles.reviewField}>
                          <p className={styles.reviewK}>Meta description</p>
                          <p className={styles.reviewV}>{b.draft.metaDescription}</p>
                        </div>
                        <div className={styles.reviewActions}>
                          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => decide('approve')}>Approve &amp; apply</button>
                          <button className={styles.btn} onClick={() => decide('reject')}>Reject</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {phase === 'done' && (
          <div className={styles.summaryBox}>
            <p style={{ margin: 0 }}>{summary}</p>
            <div className={styles.reviewActions} style={{ marginTop: 12 }}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

// The "Rebuild SEO" pipeline — one button that walks every SEO finding as a
// chain, block by block (the Clerks' blockchain idea), and pauses to ask the
// founder's nod on page-level changes before applying. Pure orchestration over
// endpoints that already exist:
//   products → POST /products/bulk-generate-seo (fills only missing, preserves)
//   category → POST /categories/:id/generate-seo (draft) → PATCH to apply
//   collection → POST /collections/:id/generate-seo (draft) → PATCH to apply
//
// Gap-filling product metas runs automatically (low risk). Page-level category
// & collection metas pause for Approve / Reject, since they're few and the
// founder asked to see them.

type Status = 'pending' | 'generating' | 'review' | 'applied' | 'skipped' | 'error';
type Draft = { metaTitle: string; metaDescription: string };
type Block = {
  ref: string;
  kind: 'products' | 'category' | 'collection';
  label: string;
  status: Status;
  targetId?: string;
  draft?: Draft;
  result?: string;
  error?: string;
};

type Decision = 'approve' | 'reject';

// Small, deterministic hash so each block carries a ref that chains onto the
// previous one — the visible "blockchain line" from the first fix to the last.
function chainHash(prev: string, seed: string): string {
  let h = 0x811c9dc5;
  const s = prev + seed;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8);
}

type RawCat = { _id: string; label?: string; name?: string; slug: string; metaTitle?: string; metaDescription?: string };

export default function RebuildSeoModal({ onClose }: { onClose: () => void }) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [phase, setPhase] = useState<'scanning' | 'running' | 'review' | 'done'>('scanning');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [summary, setSummary] = useState('');

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

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function getJson(path: string) {
      const res = await fetch(`${API}${path}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Could not load ${path}`);
      return res.json();
    }

    async function scan(): Promise<Block[]> {
      const [cats, colls] = await Promise.all([
        getJson('/api/admin/categories').catch(() => []),
        getJson('/api/admin/collections').catch(() => []),
      ]);
      const missing = (x: RawCat) => !x.metaTitle || !x.metaDescription;
      const catMiss: RawCat[] = (Array.isArray(cats) ? cats : []).filter(missing);
      const collMiss: RawCat[] = (Array.isArray(colls) ? colls : []).filter(missing);

      const raw: Omit<Block, 'ref'>[] = [
        { kind: 'products', label: 'Products missing meta', status: 'pending' },
        ...catMiss.map(c => ({ kind: 'category' as const, label: `Category: ${c.label || c.slug}`, status: 'pending' as const, targetId: c._id })),
        ...collMiss.map(c => ({ kind: 'collection' as const, label: `Collection: ${c.name || c.slug}`, status: 'pending' as const, targetId: c._id })),
      ];
      let prev = '00000000';
      return raw.map(b => { const ref = chainHash(prev, b.label); prev = ref; return { ...b, ref }; });
    }

    async function applyGenerated(kind: 'category' | 'collection', id: string, draft: Draft) {
      const base = kind === 'category' ? 'categories' : 'collections';
      const res = await fetch(`${API}/api/admin/${base}/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metaTitle: draft.metaTitle, metaDescription: draft.metaDescription }),
      });
      if (!res.ok) throw new Error('Apply failed');
    }

    async function generate(kind: 'category' | 'collection', id: string): Promise<Draft> {
      const base = kind === 'category' ? 'categories' : 'collections';
      const res = await fetch(`${API}/api/admin/${base}/${id}/generate-seo`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      return { metaTitle: data.seo?.metaTitle || '', metaDescription: data.seo?.metaDescription || '' };
    }

    async function run(chain: Block[]) {
      let applied = 0, skipped = 0, failed = 0;
      setPhase('running');

      for (let i = 0; i < chain.length; i++) {
        if (cancelled.current) return;
        setActiveIndex(i);
        const block = chain[i];

        try {
          if (block.kind === 'products') {
            patch(i, { status: 'generating', result: 'Generating & filling missing product meta…' });
            const res = await fetch(`${API}/api/admin/products/bulk-generate-seo`, { method: 'POST', credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Bulk generation failed');
            if ((data.updated || 0) > 0) applied++; else skipped++;
            patch(i, { status: (data.updated || 0) > 0 ? 'applied' : 'skipped', result: data.message || 'Done.' });
          } else {
            patch(i, { status: 'generating', result: 'Writing meta in the brand voice…' });
            const draft = await generate(block.kind, block.targetId!);
            if (cancelled.current) return;
            patch(i, { status: 'review', draft });
            setPhase('review');
            const decision = await waitForDecision();
            if (cancelled.current) return;
            if (decision === 'approve') {
              patch(i, { status: 'generating', result: 'Applying…' });
              await applyGenerated(block.kind, block.targetId!, draft);
              applied++;
              patch(i, { status: 'applied', result: 'Applied to the live page.' });
            } else {
              skipped++;
              patch(i, { status: 'skipped', result: 'Skipped — left unchanged.' });
            }
          }
        } catch (e) {
          failed++;
          patch(i, { status: 'error', error: e instanceof Error ? e.message : 'Failed' });
        }
      }

      setActiveIndex(-1);
      setPhase('done');
      const parts = [`${applied} applied`];
      if (skipped) parts.push(`${skipped} skipped`);
      if (failed) parts.push(`${failed} failed`);
      setSummary(chain.length === 1 && applied === 0 && skipped <= 1 && !failed
        ? 'Nothing to fix — your category, collection and product meta are already complete.'
        : `Chain complete: ${parts.join(' · ')}.`);
    }

    (async () => {
      try {
        const chain = await scan();
        setBlocks(chain);
        await run(chain);
      } catch (e) {
        setSummary(e instanceof Error ? e.message : 'Could not build the SEO chain.');
        setPhase('done');
      }
    })();

    return () => { cancelled.current = true; decisionRef.current?.('reject'); };
  }, [patch, waitForDecision]);

  const doneCount = blocks.filter(b => ['applied', 'skipped', 'error'].includes(b.status)).length;

  function nodeClass(b: Block) {
    if (b.status === 'applied') return styles.nodeDone;
    if (b.status === 'skipped' || b.status === 'error') return styles.nodeSkip;
    if (b.status === 'generating') return styles.nodeRun;
    if (b.status === 'review') return styles.nodeActive;
    return '';
  }

  return (
    <div className={styles.modalOverlay} onClick={() => { if (phase === 'done') onClose(); }}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div>
            <h2 className={styles.modalTitle}>Rebuilding SEO</h2>
            <p className={styles.modalSub}>
              Walking every finding as one chain, from first to last. Missing product meta is filled automatically;
              page-level category &amp; collection meta pauses for your nod before it goes live.
            </p>
          </div>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close" disabled={phase === 'review'}>×</button>
        </div>

        <p className={styles.progressLine}>
          {phase === 'scanning' ? 'Scanning for findings…'
            : phase === 'done' ? 'Chain complete'
            : `Block ${Math.min(doneCount + 1, blocks.length)} of ${blocks.length}`}
        </p>

        <div className={styles.chain}>
          {blocks.map((b, i) => (
            <div key={b.ref} className={`${styles.block} ${i === activeIndex ? styles.blockActive : ''}`}>
              <span className={`${styles.blockNode} ${nodeClass(b)}`} />
              <div className={styles.blockMain}>
                <p className={styles.blockLabel}>
                  {b.label} <span className={styles.blockRef}>[{b.ref}]</span>
                </p>
                {(b.result || b.error) && (
                  <p className={styles.blockState} style={b.status === 'error' ? { color: '#b03a2e' } : undefined}>
                    {b.error ? `Error: ${b.error}` : b.result}
                  </p>
                )}

                {b.status === 'review' && b.draft && i === activeIndex && (
                  <div className={styles.reviewBox}>
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

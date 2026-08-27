'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusTrap } from '@/lib/useFocusTrap';
import Link from 'next/link';
import SizeChartTable from './SizeChartTable';
import { FALLBACK_SIZE_ROWS, type SizeRow } from '@/lib/sizeChart';
import styles from './SizeChartDrawer.module.css';

// §48: "On product pages, open this in a drawer/modal instead of leaving the
// product page."
//
// The link was `target="_blank"` to /size-guide. On a desktop that is a new tab
// to come back from; on a phone it is a whole context switch away from the buy
// decision, and getting back means finding the right tab. A shopper checking
// whether M is her size has not changed her mind about the robe — the page
// should not behave as though she has.
//
// Rows are fetched on FIRST OPEN, not on mount: most visitors never open this,
// and the product page has better things to spend a request on. Once loaded
// they are kept, so reopening is instant.
export default function SizeChartDrawer({ label = 'Sizing chart', className }: {
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SizeRow[] | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // aria-modal below is a claim that the page behind is inert. This is what
  // makes it true for a keyboard.
  useFocusTrap(panelRef, open);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open || rows) return;
    let active = true;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/size-chart`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!active) return;
        // An empty or unreachable chart still shows the reference table rather
        // than a spinner that never resolves — the numbers a customer needs are
        // the same ones the size guide would have shown her.
        setRows(Array.isArray(d?.rows) && d.rows.length ? d.rows : FALLBACK_SIZE_ROWS);
      })
      .catch(() => { if (active) setRows(FALLBACK_SIZE_ROWS); });
    return () => { active = false; };
  }, [open, rows]);

  // Escape closes, and the page behind stops scrolling while it is up.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {label}
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={close} />
          <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-label="Size guide">
            <div className={styles.head}>
              <p className={styles.title}>Size guide</p>
              <button type="button" className={styles.close} onClick={close} aria-label="Close size guide">✕</button>
            </div>

            <div className={styles.body}>
              {rows === null ? (
                <p className={styles.muted}>Loading measurements…</p>
              ) : (
                <SizeChartTable rows={rows} />
              )}

              {/* The one line that answers the question people actually open
                  this for. It is on the size guide too; here it is the point. */}
              <p className={styles.note}>
                Between sizes? We recommend sizing up — our robes are cut generously,
                and silk is more forgiving with room than without it.
              </p>

              <p className={styles.note}>
                <Link href="/size-guide" className={styles.link} onClick={close}>
                  How to measure, and fit notes by garment →
                </Link>
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

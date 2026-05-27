'use client';

import { useId, useState } from 'react';
import styles from './Accordion.module.css';

// 56px row, 1px bottom hairline, label left in section-label type, chevron
// right. Open state rotates chevron 180° and fades content in over 320ms.
// Each AccordionItem is independent — no exclusive radio behaviour (multiple
// can be open at once if the user keeps clicking).

export function AccordionGroup({ children }: { children: React.ReactNode }) {
  return <div className={styles.group}>{children}</div>;
}

export function AccordionItem({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(o => !o)}
        className={styles.row}
      >
        <span>{label}</span>
        <span className={`${styles.chev} ${open ? styles.chevOpen : ''}`} aria-hidden="true">
          <svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M3 5l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-hidden={!open}
        className={`${styles.content} ${open ? styles.contentOpen : ''}`}
      >
        <div className={styles.contentInner}>{children}</div>
      </div>
    </div>
  );
}

// Convenience for the COMPOSITION / CUT / ORIGIN sub-headings inside an item
export function AccordionSubLabel({ children }: { children: React.ReactNode }) {
  return <div className={styles.sub}>{children}</div>;
}

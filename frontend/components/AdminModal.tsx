'use client';

import { useEffect, useRef } from 'react';
import { useFocusTrap } from '@/lib/useFocusTrap';

/**
 * Minimal admin modal — replaces the old browser prompt()/alert() flows
 * (category reassignment, product pickers, rejection reasons) with an
 * accessible inline dialog: Escape closes, backdrop click closes, and focus is
 * trapped inside while it is open.
 *
 * The focus half used to be `ref.current?.focus()` — which moves focus in but
 * does not keep it there, so the next Tab left the dialog for the admin page
 * behind it while aria-modal claimed that page was inert.
 */
export default function AdminModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Mounted only while open, so the trap is always active. One line here covers
  // every admin dialog, since they all render through this component.
  useFocusTrap(ref, true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(26,25,22,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-bg)', width: '100%', maxWidth: 460,
          border: '1px solid var(--color-line)', boxShadow: '0 10px 40px rgba(26,25,22,0.2)',
          padding: 24, borderRadius: 2, outline: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--color-ink)' }}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--color-ink-muted)', padding: 4 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

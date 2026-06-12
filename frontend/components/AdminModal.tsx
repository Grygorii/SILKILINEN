'use client';

import { useEffect, useRef } from 'react';

/**
 * Minimal admin modal — replaces the old browser prompt()/alert() flows
 * (category reassignment, product pickers, rejection reasons) with an
 * accessible inline dialog: Escape closes, backdrop click closes, focus
 * moves into the dialog on open.
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    // Move focus into the dialog so keyboard users land inside it.
    ref.current?.focus();
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
          background: '#fff', width: '100%', maxWidth: 460,
          border: '1px solid #e0d9cc', boxShadow: '0 10px 40px rgba(26,25,22,0.2)',
          padding: 24, borderRadius: 2, outline: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: '#2a2218' }}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b6358', padding: 4 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

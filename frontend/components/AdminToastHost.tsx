'use client';

import { useEffect, useState } from 'react';
import { ADMIN_TOAST_EVENT, type ToastKind } from '@/lib/adminToast';

type Toast = { id: number; message: string; kind: ToastKind };

const COLORS: Record<ToastKind, { bg: string; border: string; fg: string }> = {
  success: { bg: '#eef7ee', border: '#bfe3bf', fg: '#1a6b3c' },
  error:   { bg: '#fdf0ef', border: '#f0c8c2', fg: '#b03a2e' },
  info:    { bg: '#f5f2ec', border: '#e0d9cc', fg: '#2a2218' },
};

let nextId = 1;

/** Renders toasts dispatched via lib/adminToast. Mounted once in AdminLayout. */
export default function AdminToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function onToast(e: Event) {
      const { message, kind } = (e as CustomEvent).detail as { message: string; kind: ToastKind };
      const id = nextId++;
      setToasts(prev => [...prev.slice(-3), { id, message, kind }]);
      // Errors linger longer — they carry information the founder needs to read.
      const ttl = kind === 'error' ? 7000 : 4000;
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ttl);
    }
    window.addEventListener(ADMIN_TOAST_EVENT, onToast);
    return () => window.removeEventListener(ADMIN_TOAST_EVENT, onToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380,
      }}
    >
      {toasts.map(t => {
        const c = COLORS[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            style={{
              background: c.bg, border: `1px solid ${c.border}`, color: c.fg,
              padding: '10px 14px', fontSize: 13, lineHeight: 1.5,
              display: 'flex', alignItems: 'flex-start', gap: 10,
              boxShadow: '0 4px 14px rgba(26,25,22,0.12)', borderRadius: 2,
              whiteSpace: 'pre-line',
            }}
          >
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              aria-label="Dismiss"
              style={{ background: 'none', border: 'none', color: c.fg, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

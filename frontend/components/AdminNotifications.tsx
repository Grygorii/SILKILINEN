'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './AdminNotifications.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;
const POLL_MS = 30_000;

type Toast = { id: number; message: string };

function chaChing() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(1400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
  } catch { /* AudioContext blocked — silent fail */ }
}

export default function AdminNotifications() {
  const lastCount = useRef<number | null>(null);
  const nextId = useRef(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(message: string) {
    const id = ++nextId.current;
    setToasts(prev => [...prev, { id, message }]);
    chaChing();
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
  }

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`${API}/api/orders/stats`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const count: number = data.totalOrders ?? 0;
        if (lastCount.current !== null && count > lastCount.current) {
          const n = count - lastCount.current;
          addToast(`New order${n > 1 ? `s (${n})` : ''} just came in`);
        }
        lastCount.current = count;
      } catch { /* network error — ignore */ }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.stack}>
      {toasts.map(t => (
        <div key={t.id} className={styles.toast}>
          <span className={styles.icon}>🛍</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

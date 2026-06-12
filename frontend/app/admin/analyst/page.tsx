'use client';

import { useEffect, useRef, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Msg = { role: 'user' | 'assistant'; content: string; toolsUsed?: string[] };

const SUGGESTIONS = [
  'How are sales this month compared to last month?',
  'Which product makes the most revenue?',
  'Where do my visitors come from?',
  'What should I restock first?',
  'What is my conversion rate this month?',
  'How much profit did I make in the last 30 days?',
  'Which discount codes are actually being used?',
  'Who are my best customers?',
];

const TOOL_LABELS: Record<string, string> = {
  sales_summary: 'Sales',
  top_products: 'Top products',
  sales_by_country: 'Countries',
  traffic_summary: 'Traffic',
  conversion: 'Conversion',
  stock_report: 'Inventory',
  finance_summary: 'Finance',
  customers_summary: 'Customers',
  promo_performance: 'Promo codes',
  recent_orders: 'Recent orders',
};

/**
 * "Ask your store" — chat with an analyst that answers from the shop's real
 * data. The AI never queries the database directly: it picks from a fixed
 * set of read-only reports on the backend, and writes its answer only from
 * those numbers, so figures always match the dashboard.
 */
export default function AnalystPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput('');
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/analyst/ask`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
        body: JSON.stringify({ question: q, history }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.ok ? data.answer : (data.error || 'Something went wrong — try again.'),
        toolsUsed: res.ok ? data.toolsUsed : undefined,
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error — try again in a moment.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminLayout active="analyst">
      <div className={styles.header}>
        <h2 className={styles.title}>Ask your store</h2>
        <p className={styles.subtitle}>
          Answers come straight from your live data — sales, traffic, inventory, finance — so the numbers always match the dashboard.
        </p>
      </div>

      <div className={styles.chatWrap}>
        <div className={styles.thread}>
          {messages.length === 0 && (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>What would you like to know?</p>
              <div className={styles.suggestions}>
                {SUGGESTIONS.map(s => (
                  <button key={s} className={styles.suggestion} onClick={() => send(s)} disabled={busy}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? styles.userMsg : styles.aiMsg}>
              <div className={styles.msgBody}>{m.content}</div>
              {m.toolsUsed && m.toolsUsed.length > 0 && (
                <div className={styles.toolRow}>
                  {m.toolsUsed.map(t => (
                    <span key={t} className={styles.toolChip}>{TOOL_LABELS[t] || t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {busy && (
            <div className={styles.aiMsg}>
              <div className={`${styles.msgBody} ${styles.thinking}`}>Looking at your data…</div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className={styles.inputRow}
          onSubmit={e => { e.preventDefault(); send(input); }}
        >
          <input
            className={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="e.g. How did the pillowcases sell this month?"
            disabled={busy}
          />
          <button type="submit" className={styles.sendBtn} disabled={busy || !input.trim()}>
            {busy ? '…' : 'Ask'}
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}

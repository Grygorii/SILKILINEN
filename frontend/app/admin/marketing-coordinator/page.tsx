'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';

const API = process.env.NEXT_PUBLIC_API_URL;

type Task = { _id: string; text: string; href?: string; agent?: string; done: boolean };
type Play = { _id: string; channel: string; agent: string; title: string; rationale: string; tasks: Task[] };
type Plan = {
  _id: string; mode: 'interactive' | 'weekly'; goal: string; focus?: string;
  objective: string; insight: string; audience: string; engagedAgents: string[];
  plays: Play[]; timeline: string; successMetric: string; verdict: string;
  status: string; createdAt: string;
};

const dark = 'var(--dark, #2a2218)';
const muted = 'var(--muted, #8a8680)';
const border = '1px solid var(--border, #e8e2d6)';
const serif = "'Cormorant Garamond', Georgia, serif";

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export default function MarketingCoordinatorPage() {
  const [goal, setGoal] = useState('');
  const [focus, setFocus] = useState('');
  const [busy, setBusy] = useState(false);
  const [weekly, setWeekly] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [history, setHistory] = useState<Plan[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/marketing-coordinator`, { credentials: 'include' });
      const data = await res.json();
      if (Array.isArray(data)) setHistory(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function coordinate() {
    if (!goal.trim()) { toast('Give the Coordinator a goal first.', 'error'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/marketing-coordinator`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim(), focus: focus.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not build a plan');
      setPlan(data);
      loadHistory();
      toast('Coordinated plan ready.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not build a plan', 'error');
    } finally { setBusy(false); }
  }

  async function runWeekly() {
    setWeekly(true);
    try {
      const res = await fetch(`${API}/api/admin/marketing-coordinator/weekly`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Weekly run failed');
      if (data.plan) { setPlan(data.plan); loadHistory(); toast('Weekly plan written.', 'success'); }
      else toast('Weekly plan already current (runs once a week).', 'info');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Weekly run failed', 'error');
    } finally { setWeekly(false); }
  }

  async function toggleTask(planId: string, taskId: string, done: boolean) {
    // Optimistic
    setPlan(p => p && p._id === planId ? {
      ...p, plays: p.plays.map(pl => ({ ...pl, tasks: pl.tasks.map(t => t._id === taskId ? { ...t, done } : t) })),
    } : p);
    try {
      await fetch(`${API}/api/admin/marketing-coordinator/${planId}/task/${taskId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done }),
      });
    } catch { /* optimistic stays */ }
  }

  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 980 }}>
        <h1 style={{ fontFamily: serif, fontSize: 28, fontWeight: 300, color: dark, margin: 0, letterSpacing: '1px' }}>
          Marketing Coordinator
        </h1>
        <p style={{ fontSize: 13, color: muted, marginTop: 6, marginBottom: 24, fontStyle: 'italic' }}>
          The team lead. Give it a goal — it engages the right specialists, composes one coordinated plan, and the clerk verifies it.
        </p>

        {/* Brief */}
        <div style={{ background: 'white', border, padding: '20px 22px', marginBottom: 24 }}>
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="The goal — e.g. “Grow sleep-dress sales for summer” or “Launch the copper silk robe”"
            rows={2}
            style={{ width: '100%', padding: '10px 12px', border, fontFamily: serif, fontSize: 18, color: dark, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={focus}
              onChange={e => setFocus(e.target.value)}
              placeholder="Focus (optional) — a product, category or channel"
              style={{ flex: 1, minWidth: 220, padding: '9px 12px', border, fontFamily: 'inherit', fontSize: 13, color: dark }}
            />
            <button onClick={coordinate} disabled={busy} style={{
              padding: '10px 22px', background: dark, color: 'white', border: 'none',
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit', fontSize: 13, letterSpacing: '0.5px',
            }}>{busy ? 'Coordinating… (~30s)' : 'Coordinate'}</button>
            <button onClick={runWeekly} disabled={weekly} title="Generate the autonomous weekly plan now (also runs on a weekly cron)" style={{
              padding: '10px 18px', background: 'white', color: dark, border, cursor: weekly ? 'default' : 'pointer',
              opacity: weekly ? 0.6 : 1, fontFamily: 'inherit', fontSize: 13,
            }}>{weekly ? 'Running…' : '↻ Weekly plan'}</button>
          </div>
        </div>

        {plan && <PlanView plan={plan} onToggle={toggleTask} />}

        {/* History */}
        {history.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontFamily: serif, fontSize: 18, color: dark, marginBottom: 12 }}>Recent plans</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {history.map(h => (
                <button key={h._id} onClick={() => setPlan(h)} style={{
                  textAlign: 'left', background: 'white', border, padding: '12px 16px', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 14, color: dark }}>{h.objective || h.goal}</span>
                    <span style={{ fontSize: 11, color: muted, whiteSpace: 'nowrap' }}>
                      {h.mode === 'weekly' ? 'weekly' : 'brief'} · {timeAgo(h.createdAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function PlanView({ plan, onToggle }: { plan: Plan; onToggle: (p: string, t: string, d: boolean) => void }) {
  return (
    <div style={{ background: 'white', border, padding: '24px 26px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <h2 style={{ fontFamily: serif, fontSize: 22, fontWeight: 400, color: dark, margin: 0, lineHeight: 1.3 }}>{plan.objective}</h2>
        <span style={{ fontSize: 11, color: muted, whiteSpace: 'nowrap' }}>{plan.mode === 'weekly' ? 'Weekly plan' : 'Brief'}</span>
      </div>
      {plan.insight && <p style={{ fontSize: 14, color: dark, marginTop: 10, lineHeight: 1.6 }}><strong style={{ color: muted, fontWeight: 400 }}>Insight — </strong>{plan.insight}</p>}
      {plan.audience && <p style={{ fontSize: 13, color: muted, marginTop: 4 }}>Audience: {plan.audience}</p>}

      {plan.engagedAgents?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '14px 0' }}>
          <span style={{ fontSize: 11, color: muted, alignSelf: 'center' }}>Engaged:</span>
          {plan.engagedAgents.map(a => (
            <span key={a} style={{ fontSize: 11, padding: '2px 9px', borderRadius: 2, background: '#f3efe8', color: dark }}>{a}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
        {plan.plays.map(play => (
          <div key={play._id} style={{ borderLeft: '2px solid #d9a6a0', paddingLeft: 14 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#b8863b' }}>{play.channel}</span>
              <span style={{ fontSize: 15, color: dark, fontWeight: 500 }}>{play.title}</span>
              {play.agent && <span style={{ fontSize: 11, color: muted }}>· {play.agent}</span>}
            </div>
            {play.rationale && <p style={{ fontSize: 12, color: muted, margin: '4px 0 8px', lineHeight: 1.5 }}>{play.rationale}</p>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 5 }}>
              {play.tasks.map(t => (
                <li key={t._id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={t.done} onChange={e => onToggle(plan._id, t._id, e.target.checked)} style={{ marginTop: 3, cursor: 'pointer' }} />
                  <span style={{ color: t.done ? muted : dark, textDecoration: t.done ? 'line-through' : 'none' }}>
                    {t.text}
                    {t.href && <a href={t.href} style={{ marginLeft: 8, fontSize: 11, color: '#b8863b' }}>open →</a>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24, marginTop: 18, flexWrap: 'wrap' }}>
        {plan.timeline && <span style={{ fontSize: 12, color: muted }}><strong style={{ fontWeight: 500, color: dark }}>Timeline:</strong> {plan.timeline}</span>}
        {plan.successMetric && <span style={{ fontSize: 12, color: muted }}><strong style={{ fontWeight: 500, color: dark }}>Success:</strong> {plan.successMetric}</span>}
      </div>
      {plan.verdict && (
        <p style={{ fontSize: 12, color: muted, marginTop: 14, paddingTop: 12, borderTop: border, fontStyle: 'italic' }}>
          ✓ {plan.verdict}
        </p>
      )}
    </div>
  );
}

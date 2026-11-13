'use client';

// A provider-neutral, review-first hand-off for people who want to use a
// ChatGPT, Claude, Codex or Gemini subscription instead of a live API key.
// The browser never receives authority to write arbitrary fields: it can only
// prepare a server-owned task, import a validated response, then explicitly ask
// the server to apply checked SEO proposals.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/adminToast';

const API = process.env.NEXT_PUBLIC_API_URL;
const border = '1px solid var(--admin-line)';
const ink = 'var(--admin-ink)';
const muted = 'var(--admin-ink-muted)';

type Row = { type: 'page' | 'product' | 'category' | 'collection'; id: string; label: string; url: string; title: string; description: string; titleHealth: string; descHealth: string };
type Proposal = { metaTitle: string; metaDescription: string; warnings: string[]; appliedAt?: string | null; stale?: boolean };
type TaskTarget = { key: string; type: string; resourceId: string; label: string; url: string; snapshot: { metaTitle: string; metaDescription: string }; proposal: Proposal | null };
type Task = { id: string; taskType: string; status: string; provider: string; createdAt: string; importedAt?: string; lastAppliedAt?: string; targets: TaskTarget[] };
type Capability = { id: string; label: string; status: 'ready' | 'next'; description: string };

function date(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function proposalKeys(task: Task | null) {
  return task?.targets.filter(target => target.proposal && !target.proposal.appliedAt && !target.proposal.stale).map(target => target.key) || [];
}

export default function ManualAiPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [history, setHistory] = useState<Task[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState('');
  const [response, setResponse] = useState('');
  const [checking, setChecking] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [applyKeys, setApplyKeys] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [base, tasks] = await Promise.all([
        fetch(`${API}/api/admin/seo-base`, { credentials: 'include' }),
        fetch(`${API}/api/admin/manual-ai/tasks`, { credentials: 'include' }),
      ]);
      const baseData = await base.json();
      const taskData = await tasks.json();
      if (Array.isArray(baseData.rows)) setRows(baseData.rows);
      if (Array.isArray(taskData.capabilities)) setCapabilities(taskData.capabilities);
      if (Array.isArray(taskData.runs)) setHistory(taskData.runs);
    } catch { toast('Could not load the Manual AI workspace.', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const catalogueRows = useMemo(() => rows.filter(row => row.type !== 'page'), [rows]);
  const attention = useMemo(() => catalogueRows.filter(row => row.titleHealth === 'bad' || row.descHealth === 'bad'), [catalogueRows]);
  const visibleRows = showAll ? catalogueRows : attention;

  function toggle(key: string) {
    setSelected(previous => previous.includes(key)
      ? previous.filter(item => item !== key)
      : previous.length >= 20 ? (toast('A prompt can contain up to 20 catalogue pages.', 'info'), previous) : [...previous, key]);
  }

  function selectAttention() {
    setSelected(attention.slice(0, 20).map(row => `${row.type}:${row.id}`));
  }

  async function prepare() {
    if (!selected.length) return;
    setPreparing(true); setErrors([]); setResponse(''); setApplyKeys([]);
    try {
      const targets = selected.map(key => { const [type, id] = key.split(':'); return { type, id }; });
      const res = await fetch(`${API}/api/admin/manual-ai/tasks/seo-meta/prepare`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' }, body: JSON.stringify({ targets }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not prepare the prompt.');
      setTask(data.task); setPrompt(data.prompt); setHistory(previous => [data.task, ...previous.filter(item => item.id !== data.task.id)]);
      toast(`Prompt ready for ${data.itemCount} catalogue page${data.itemCount === 1 ? '' : 's'}.`, 'success');
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not prepare the prompt.', 'error'); }
    finally { setPreparing(false); }
  }

  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); toast('Prompt copied. Paste it into the AI you prefer.', 'success'); }
    catch { toast('Your browser could not copy it. Select the prompt and copy it manually.', 'info'); }
  }

  async function resume(id: string) {
    try {
      const res = await fetch(`${API}/api/admin/manual-ai/tasks/${id}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open this task.');
      setTask(data.task); setPrompt(data.prompt); setErrors([]); setResponse(''); setApplyKeys(proposalKeys(data.task));
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not open this task.', 'error'); }
  }

  async function validateResponse() {
    if (!task || !response.trim()) return;
    setChecking(true); setErrors([]);
    try {
      const res = await fetch(`${API}/api/admin/manual-ai/tasks/${task.id}/import`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' }, body: JSON.stringify({ response, provider }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (Array.isArray(data.errors)) {
          setErrors(data.errors);
          toast(data.error || 'The response did not pass the safety check.', 'error');
          return;
        }
        throw new Error(data.error || 'The response did not pass validation.');
      }
      setTask(data.task); setApplyKeys(proposalKeys(data.task)); setHistory(previous => [data.task, ...previous.filter(item => item.id !== data.task.id)]);
      toast('Response verified. Review every change before applying it.', 'success');
    } catch (error) { toast(error instanceof Error ? error.message : 'The response did not pass validation.', 'error'); }
    finally { setChecking(false); }
  }

  function toggleApply(key: string) {
    setApplyKeys(previous => previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key]);
  }

  async function applySelected() {
    if (!task || !applyKeys.length) return;
    setApplying(true);
    try {
      const res = await fetch(`${API}/api/admin/manual-ai/tasks/${task.id}/apply`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' }, body: JSON.stringify({ keys: applyKeys }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not apply the selected changes.');
      setTask(data.task); setApplyKeys(proposalKeys(data.task)); setHistory(previous => [data.task, ...previous.filter(item => item.id !== data.task.id)]);
      const applied = data.report?.filter((item: { status: string }) => item.status === 'applied').length || 0;
      const stale = data.report?.filter((item: { status: string }) => item.status === 'stale').length || 0;
      toast(applied ? `${applied} SEO change${applied === 1 ? '' : 's'} published.${stale ? ` ${stale} need a fresh prompt.` : ''}` : 'Nothing was published; check the review status.', applied ? 'success' : 'info');
      load();
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not apply the selected changes.', 'error'); }
    finally { setApplying(false); }
  }

  return (
    <div>
      <section style={{ border, background: 'var(--admin-surface)', padding: 18 }}>
        <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 21, color: ink }}>Manual AI workspace</h2>
        <p style={{ margin: '7px 0 0', color: muted, fontSize: 13, lineHeight: 1.55, maxWidth: 760 }}>
          Use any AI subscription you already have. This workspace prepares the facts, checks the response against the selected pages,
          and never publishes anything until you choose the individual changes to apply.
        </p>
        <ol style={{ margin: '14px 0 0', paddingLeft: 20, color: ink, fontSize: 13, lineHeight: 1.75 }}>
          <li>Select up to 20 catalogue pages.</li>
          <li>Copy the prepared prompt into Codex, Claude, ChatGPT, Gemini, or another AI.</li>
          <li>Paste its JSON response here. The system validates it before you see a review.</li>
          <li>Tick the exact changes you approve, then apply them.</li>
        </ol>
      </section>

      <section style={{ marginTop: 18, border, padding: 18, background: 'var(--admin-surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: ink }}>1. Choose catalogue pages</h3>
            <p style={{ margin: '4px 0 0', color: muted, fontSize: 12.5 }}>SEO metadata is ready first. Static pages stay in Base for now because their effective page copy has a different source of truth.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setShowAll(value => !value)} style={buttonStyle(false)}>{showAll ? 'Show missing only' : 'Show all catalogue pages'}</button>
            <button onClick={selectAttention} style={buttonStyle(false)}>Select missing ({Math.min(attention.length, 20)})</button>
            <button onClick={prepare} disabled={!selected.length || preparing} style={buttonStyle(true, !selected.length || preparing)}>{preparing ? 'Preparing…' : `Prepare prompt (${selected.length})`}</button>
          </div>
        </div>
        {loading ? <p style={{ color: muted, fontSize: 13 }}>Loading catalogue pages…</p> : (
          <div style={{ marginTop: 12, display: 'grid', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
            {visibleRows.map(row => {
              const key = `${row.type}:${row.id}`;
              return <label key={key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid var(--admin-line)', padding: '9px 10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} />
                <span style={{ flex: 1 }}><strong style={{ color: ink, fontSize: 13 }}>{row.label}</strong><span style={{ color: muted, fontSize: 11.5 }}> · {row.type}</span><br /><span style={{ color: muted, fontSize: 11.5 }}>{row.title || 'Missing title'} · {row.description || 'Missing description'}</span></span>
              </label>;
            })}
            {!visibleRows.length && <p style={{ color: muted, fontSize: 13 }}>No catalogue pages need attention.</p>}
          </div>
        )}
      </section>

      {task && (
        <>
          <section style={{ marginTop: 18, border, padding: 18, background: 'var(--admin-surface)' }}>
            <h3 style={{ margin: 0, fontSize: 16, color: ink }}>2. Use your AI, then paste its answer</h3>
            <p style={{ margin: '4px 0 10px', color: muted, fontSize: 12.5 }}>Task {task.id.slice(-8)} · prepared {date(task.createdAt)}. The prompt contains only the selected catalogue context and strict return format.</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <button onClick={copyPrompt} style={buttonStyle(false)}>Copy prompt</button>
              <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(prompt)}`} download={`silkilinen-seo-prompt-${task.id}.txt`} style={{ ...buttonStyle(false), textDecoration: 'none' }}>Download prompt</a>
            </div>
            <textarea readOnly value={prompt} rows={11} aria-label="Prepared AI prompt" style={textareaStyle} />
            <label style={labelStyle}>AI used (optional)<input value={provider} onChange={event => setProvider(event.target.value)} placeholder="e.g. Codex, Claude, Gemini" maxLength={80} style={inputStyle} /></label>
            <label style={labelStyle}>Paste the AI&apos;s JSON response<textarea value={response} onChange={event => setResponse(event.target.value)} rows={10} placeholder='{"contract":"silkilinen.external-ai.seo-meta.v1", ...}' style={textareaStyle} /></label>
            {errors.length > 0 && <ul style={{ margin: '10px 0', paddingLeft: 20, color: 'var(--admin-danger)', fontSize: 12.5 }}>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
            <button onClick={validateResponse} disabled={!response.trim() || checking || task.status === 'applied' || task.status === 'partially_applied'} style={buttonStyle(true, !response.trim() || checking || task.status === 'applied' || task.status === 'partially_applied')}>{checking ? 'Checking response…' : 'Validate response'}</button>
          </section>

          {task.targets.some(target => target.proposal) && (
            <section style={{ marginTop: 18, border, padding: 18, background: 'var(--admin-surface)' }}>
              <h3 style={{ margin: 0, fontSize: 16, color: ink }}>3. Review before publishing</h3>
              <p style={{ margin: '4px 0 12px', color: muted, fontSize: 12.5 }}>Only checked proposals will be applied. Before publishing, the system checks that the original page has not changed since this prompt was made.</p>
              <div style={{ display: 'grid', gap: 12 }}>
                {task.targets.map(target => target.proposal && <article key={target.key} style={{ border, padding: 12, borderLeft: `3px solid ${target.proposal.stale ? 'var(--admin-warning)' : target.proposal.appliedAt ? 'var(--admin-success)' : 'var(--admin-info)'}` }}>
                  <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: target.proposal.appliedAt || target.proposal.stale ? 'default' : 'pointer' }}>
                    <input type="checkbox" checked={applyKeys.includes(target.key)} disabled={Boolean(target.proposal.appliedAt || target.proposal.stale)} onChange={() => toggleApply(target.key)} />
                    <span><strong style={{ color: ink, fontSize: 13 }}>{target.label}</strong><span style={{ color: muted, fontSize: 11.5 }}> · {target.type}</span></span>
                  </label>
                  <Diff label="Title" before={target.snapshot.metaTitle} after={target.proposal.metaTitle} />
                  <Diff label="Description" before={target.snapshot.metaDescription} after={target.proposal.metaDescription} />
                  {target.proposal.warnings.map(warning => <p key={warning} style={{ margin: '7px 0 0', color: 'var(--admin-warning)', fontSize: 12 }}>{warning}</p>)}
                  {target.proposal.stale && <p style={{ margin: '7px 0 0', color: 'var(--admin-warning)', fontSize: 12 }}>This page changed after the prompt was made. Prepare a fresh prompt before applying it.</p>}
                  {target.proposal.appliedAt && <p style={{ margin: '7px 0 0', color: 'var(--admin-success)', fontSize: 12 }}>Published {date(target.proposal.appliedAt)}.</p>}
                </article>)}
              </div>
              <button onClick={applySelected} disabled={!applyKeys.length || applying} style={{ ...buttonStyle(true, !applyKeys.length || applying), marginTop: 14 }}>{applying ? 'Applying selected changes…' : `Apply selected (${applyKeys.length})`}</button>
            </section>
          )}
        </>
      )}

      {history.length > 0 && <section style={{ marginTop: 18 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14, color: ink }}>Recent prompt hand-offs</h3>
        <div style={{ display: 'grid', gap: 6 }}>{history.slice(0, 5).map(item => <button key={item.id} onClick={() => resume(item.id)} style={{ ...buttonStyle(false), textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{item.targets.length} catalogue page{item.targets.length === 1 ? '' : 's'} · {item.status.replace('_', ' ')}</span><span style={{ color: muted }}>{date(item.createdAt)} · resume →</span></button>)}</div>
      </section>}

      {capabilities.filter(capability => capability.status === 'next').length > 0 && <section style={{ marginTop: 20, borderTop: border, paddingTop: 16 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: ink }}>Next workflows using this same protected process</h3>
        <p style={{ margin: '5px 0 0', fontSize: 12.5, color: muted }}>These will be added one at a time with their own field rules—never as a broad “AI can edit anything” connection.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>{capabilities.filter(capability => capability.status === 'next').map(capability => <span key={capability.id} title={capability.description} style={{ border, padding: '6px 9px', fontSize: 12, color: muted }}>{capability.label} · next</span>)}</div>
      </section>}
    </div>
  );
}

function Diff({ label, before, after }: { label: string; before: string; after: string }) {
  return <div style={{ marginTop: 9, display: 'grid', gridTemplateColumns: 'minmax(100px, 0.8fr) minmax(0, 1.2fr)', gap: 9, fontSize: 12.5 }}>
    <span style={{ color: muted }}>{label}</span>
    <span style={{ color: muted, textDecoration: before === after ? 'none' : 'line-through' }}>{before || '—'}</span>
    <span style={{ gridColumn: '2', color: ink }}>{after}</span>
  </div>;
}

function buttonStyle(primary: boolean, disabled = false): React.CSSProperties {
  return { appearance: 'none', border: primary ? '1px solid var(--admin-ink)' : border, background: primary ? 'var(--admin-ink)' : 'var(--admin-surface)', color: primary ? 'var(--admin-surface)' : ink, padding: '8px 12px', fontSize: 12.5, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 };
}
const textareaStyle: React.CSSProperties = { display: 'block', boxSizing: 'border-box', width: '100%', marginTop: 5, padding: 10, border, color: ink, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, lineHeight: 1.45, resize: 'vertical', background: 'var(--admin-surface)' };
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, padding: 8, border, fontFamily: 'inherit', color: ink, background: 'var(--admin-surface)' };
const labelStyle: React.CSSProperties = { display: 'block', marginTop: 12, color: muted, fontSize: 12 };

'use client';

// Manual Hermes keeps the data-reading half of Hermes on the server, but lets
// the founder use any external AI subscription for the reasoning. It can only
// publish selected recommendations into SEO review; it never edits shop copy.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/adminToast';

const API = process.env.NEXT_PUBLIC_API_URL;
const border = '1px solid var(--admin-line)';
const ink = 'var(--admin-ink)';
const muted = 'var(--admin-ink-muted)';

type HermesPlay = {
  key?: string;
  id?: string;
  target?: string;
  query?: string;
  intent?: string;
  kind?: string;
  entityType?: string;
  entityRef?: string;
  clicks?: number | null;
  impressions?: number | null;
  ctr?: number | null;
  position?: number | null;
  issue?: string;
  action?: string;
  leverage?: string;
  warnings?: string[];
  stale?: boolean;
  held?: boolean;
  status?: string;
  publishedAt?: string | null;
};

type HermesPlan = { read?: string; plays?: HermesPlay[] };
type HermesTask = {
  id: string;
  taskType?: string;
  status: string;
  provider?: string;
  createdAt: string;
  importedAt?: string;
  publishedAt?: string;
  read?: string;
  plays?: HermesPlay[];
  recommendations?: HermesPlay[];
  plan?: HermesPlan;
};

function date(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function playsFor(task: HermesTask | null) {
  if (!task) return [];
  return task.plays || task.plan?.plays || task.recommendations || [];
}

function readFor(task: HermesTask | null) {
  return task?.read || task?.plan?.read || '';
}

function playKey(play: HermesPlay, index: number) {
  return play.key || play.id || `${play.entityRef || play.target || play.query || 'recommendation'}:${index}`;
}

function isFrozen(play: HermesPlay) {
  return Boolean(play.publishedAt || play.stale || play.held || play.status === 'held' || play.status === 'published');
}

function resultCount(report: unknown, status: string) {
  return Array.isArray(report) ? report.filter(item => item && typeof item === 'object' && (item as { status?: string }).status === status).length : 0;
}

export default function ManualHermesPanel() {
  const [history, setHistory] = useState<HermesTask[]>([]);
  const [task, setTask] = useState<HermesTask | null>(null);
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState('');
  const [response, setResponse] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetch(`${API}/api/admin/manual-ai/hermes/runs`, { credentials: 'include' });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || 'Could not load Manual Hermes tasks.');
      setHistory(Array.isArray(data.runs) ? data.runs : Array.isArray(data.tasks) ? data.tasks : []);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not load Manual Hermes tasks.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const plays = useMemo(() => playsFor(task), [task]);

  async function prepare() {
    setPreparing(true); setErrors([]); setResponse(''); setSelectedKeys([]); setProvider('');
    try {
      const result = await fetch(`${API}/api/admin/manual-ai/hermes/prepare`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' }, body: '{}',
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || 'Could not prepare the live Search Console brief.');
      setTask(data.task); setPrompt(data.prompt || '');
      setHistory(previous => [data.task, ...previous.filter(item => item.id !== data.task.id)]);
      toast('Live Hermes brief ready. Copy it into the AI you prefer.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not prepare the live Search Console brief.', 'error');
    } finally {
      setPreparing(false);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      toast('Prompt copied. Paste it into Codex, ChatGPT, Claude, Gemini, or another AI.', 'success');
    } catch {
      toast('Your browser could not copy it. Select the prompt and copy it manually.', 'info');
    }
  }

  async function resume(id: string) {
    try {
      const result = await fetch(`${API}/api/admin/manual-ai/hermes/runs/${id}`, { credentials: 'include' });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || 'Could not open this Hermes task.');
      setTask(data.task); setPrompt(data.prompt || ''); setErrors([]); setResponse(''); setProvider(data.task?.provider || ''); setSelectedKeys([]);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not open this Hermes task.', 'error');
    }
  }

  async function validateResponse() {
    if (!task || !response.trim()) return;
    setChecking(true); setErrors([]);
    try {
      const result = await fetch(`${API}/api/admin/manual-ai/hermes/runs/${task.id}/import`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' }, body: JSON.stringify({ response, provider }),
      });
      const data = await result.json();
      if (!result.ok) {
        if (Array.isArray(data.errors)) {
          setErrors(data.errors);
          toast(data.error || 'The response did not pass the safety check.', 'error');
          return;
        }
        throw new Error(data.error || 'The response did not pass validation.');
      }
      setTask(data.task); setSelectedKeys([]);
      setHistory(previous => [data.task, ...previous.filter(item => item.id !== data.task.id)]);
      toast('Plan verified. Choose the recommendations you want to send to SEO review.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'The response did not pass validation.', 'error');
    } finally {
      setChecking(false);
    }
  }

  function togglePlay(key: string) {
    setSelectedKeys(previous => previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key]);
  }

  async function publishSelected() {
    if (!task || !selectedKeys.length) return;
    setPublishing(true);
    try {
      const result = await fetch(`${API}/api/admin/manual-ai/hermes/runs/${task.id}/publish`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' }, body: JSON.stringify({ keys: selectedKeys }),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || 'Could not send the selected recommendations to SEO review.');
      setTask(data.task); setSelectedKeys([]);
      setHistory(previous => [data.task, ...previous.filter(item => item.id !== data.task.id)]);
      const published = resultCount(data.report, 'published');
      const stale = resultCount(data.report, 'stale');
      toast(published
        ? `${published} recommendation${published === 1 ? '' : 's'} sent to SEO review.${stale ? ` ${stale} need a new brief.` : ''}`
        : 'Nothing was sent; check the recommendation status.', published ? 'success' : 'info');
      void load();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not send the selected recommendations to SEO review.', 'error');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section id="hermes" style={{ marginTop: 24 }}>
      <div style={{ border, background: 'var(--admin-surface)', padding: 18 }}>
        <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 21, color: ink }}>Manual Hermes</h2>
        <p style={{ margin: '7px 0 0', color: muted, fontSize: 13, lineHeight: 1.55, maxWidth: 780 }}>
          Use this when Hermes&apos; server-side AI connection is unavailable or paused. The shop still prepares a fresh, read-only Search Console and store brief; you choose the AI that reasons over it.
        </p>
        <ol style={{ margin: '14px 0 0', paddingLeft: 20, color: ink, fontSize: 13, lineHeight: 1.75 }}>
          <li>Prepare a new live brief. This does not call an AI or change your SEO.</li>
          <li>Copy the prompt here, to Codex, ChatGPT, Claude, Gemini, or another AI.</li>
          <li>Paste the exact JSON plan back. The shop checks its evidence and scope.</li>
          <li>Select individual recommendations to place in SEO review. Nothing is changed automatically.</li>
        </ol>
      </div>

      <section style={{ marginTop: 18, border, padding: 18, background: 'var(--admin-surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: ink }}>1. Prepare a live Hermes brief</h3>
            <p style={{ margin: '4px 0 0', color: muted, fontSize: 12.5, maxWidth: 760 }}>
              The server reads the currently connected Search Console and shop facts first. If a connection is missing, it will tell you rather than invent data.
            </p>
          </div>
          <button onClick={prepare} disabled={preparing} style={buttonStyle(true, preparing)}>{preparing ? 'Preparing live brief…' : 'Prepare live Hermes brief'}</button>
        </div>
      </section>

      {task && <>
        <section style={{ marginTop: 18, border, padding: 18, background: 'var(--admin-surface)' }}>
          <h3 style={{ margin: 0, color: ink, fontSize: 16 }}>2. Use your AI, then paste its plan</h3>
          <p style={{ margin: '4px 0 10px', color: muted, fontSize: 12.5 }}>Task {task.id.slice(-8)} · prepared {date(task.createdAt)}. The prompt has the exact response format and only the current evidence Hermes needs.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <button onClick={copyPrompt} style={buttonStyle(false)}>Copy prompt</button>
            <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(prompt)}`} download={`silkilinen-hermes-prompt-${task.id}.txt`} style={{ ...buttonStyle(false), textDecoration: 'none' }}>Download prompt</a>
          </div>
          <textarea readOnly value={prompt} rows={12} aria-label="Prepared Manual Hermes prompt" style={textareaStyle} />
          <label style={labelStyle}>AI used (optional)<input value={provider} onChange={event => setProvider(event.target.value)} placeholder="e.g. Codex, ChatGPT, Claude, Gemini" maxLength={80} style={inputStyle} /></label>
          <label style={labelStyle}>Paste the AI&apos;s JSON plan<textarea value={response} onChange={event => setResponse(event.target.value)} rows={11} placeholder='{"contract":"silkilinen.external-ai.hermes.v1", ...}' style={textareaStyle} /></label>
          {errors.length > 0 && <ul style={{ margin: '10px 0', paddingLeft: 20, color: 'var(--admin-danger)', fontSize: 12.5 }}>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
          <button onClick={validateResponse} disabled={!response.trim() || checking || task.status === 'published' || task.status === 'partially_published'} style={buttonStyle(true, !response.trim() || checking || task.status === 'published' || task.status === 'partially_published')}>{checking ? 'Checking plan…' : 'Validate plan'}</button>
        </section>

        {readFor(task) && <section style={{ marginTop: 18, border, padding: 18, background: 'var(--admin-surface)' }}>
          <h3 style={{ margin: 0, color: ink, fontSize: 16 }}>Hermes&apos; read</h3>
          <p style={{ margin: '8px 0 0', color: ink, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{readFor(task)}</p>
        </section>}

        {plays.length > 0 && <section style={{ marginTop: 18, border, padding: 18, background: 'var(--admin-surface)' }}>
          <h3 style={{ margin: 0, color: ink, fontSize: 16 }}>3. Choose recommendations for SEO review</h3>
          <p style={{ margin: '4px 0 12px', color: muted, fontSize: 12.5 }}>
            Sending a recommendation to SEO review does not change a page, a URL, a product or a price. It simply places the selected evidence-backed work in the existing SEO review queue.
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            {plays.map((play, index) => {
              const key = playKey(play, index);
              const frozen = isFrozen(play);
              const target = play.target || play.query || 'Search opportunity';
              const metrics = [
                typeof play.clicks === 'number' ? `${play.clicks} clicks` : '',
                typeof play.impressions === 'number' ? `${play.impressions} impressions` : '',
                typeof play.ctr === 'number' ? `${play.ctr.toFixed(1)}% CTR` : '',
                typeof play.position === 'number' ? `avg. position ${play.position.toFixed(1)}` : '',
              ].filter(Boolean).join(' · ');
              return <article key={key} style={{ border, padding: 12, borderLeft: `3px solid ${play.stale || play.held ? 'var(--admin-warning)' : play.publishedAt || play.status === 'published' ? 'var(--admin-success)' : 'var(--admin-info)'}` }}>
                <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: frozen ? 'default' : 'pointer' }}>
                  <input type="checkbox" checked={selectedKeys.includes(key)} disabled={frozen} onChange={() => togglePlay(key)} />
                  <span style={{ flex: 1 }}>
                    <strong style={{ color: ink, fontSize: 13 }}>{target}</strong>
                    <span style={{ color: muted, fontSize: 11.5 }}> · {[play.kind, play.intent, play.leverage && `${play.leverage} leverage`].filter(Boolean).join(' · ')}</span>
                    {metrics && <span style={{ display: 'block', marginTop: 4, color: muted, fontSize: 11.5 }}>{metrics}</span>}
                  </span>
                </label>
                {(play.entityType || play.entityRef) && <p style={{ margin: '9px 0 0', color: muted, fontSize: 12 }}>Current page: {play.entityType || 'page'} {play.entityRef || 'not supplied'}</p>}
                {play.issue && <Detail label="What Hermes saw" value={play.issue} />}
                {play.action && <Detail label="Recommended next step" value={play.action} />}
                {(play.warnings || []).map(warning => <p key={warning} style={{ margin: '7px 0 0', color: 'var(--admin-warning)', fontSize: 12 }}>{warning}</p>)}
                {play.held && <p style={{ margin: '7px 0 0', color: 'var(--admin-warning)', fontSize: 12 }}>Held back because another page may already split this search signal. Review consolidation first.</p>}
                {play.stale && <p style={{ margin: '7px 0 0', color: 'var(--admin-warning)', fontSize: 12 }}>The source changed after this brief was prepared. Prepare a new live brief.</p>}
                {play.publishedAt && <p style={{ margin: '7px 0 0', color: 'var(--admin-success)', fontSize: 12 }}>Sent to SEO review {date(play.publishedAt)}.</p>}
              </article>;
            })}
          </div>
          <button onClick={publishSelected} disabled={!selectedKeys.length || publishing} style={{ ...buttonStyle(true, !selectedKeys.length || publishing), marginTop: 14 }}>{publishing ? 'Sending to SEO review…' : `Send selected to SEO review (${selectedKeys.length})`}</button>
        </section>}
      </>}

      <section style={{ marginTop: 20 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14, color: ink }}>Recent Manual Hermes briefs</h3>
        {loading ? <p style={{ color: muted, fontSize: 13 }}>Loading Hermes hand-offs…</p> : history.length ? <div style={{ display: 'grid', gap: 6 }}>{history.slice(0, 5).map(item => <button key={item.id} onClick={() => resume(item.id)} style={{ ...buttonStyle(false), textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{item.status.replaceAll('_', ' ')}</span><span style={{ color: muted }}>{date(item.createdAt)} · resume →</span></button>)}</div> : <p style={{ color: muted, fontSize: 13 }}>No Manual Hermes brief has been prepared yet.</p>}
      </section>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <p style={{ margin: '9px 0 0', fontSize: 12.5, lineHeight: 1.5, color: ink }}><span style={{ color: muted }}>{label}: </span>{value}</p>;
}

function buttonStyle(primary: boolean, disabled = false): React.CSSProperties {
  return { appearance: 'none', border: primary ? '1px solid var(--admin-ink)' : border, background: primary ? 'var(--admin-ink)' : 'var(--admin-surface)', color: primary ? 'var(--admin-surface)' : ink, padding: '8px 12px', fontSize: 12.5, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 };
}

const textareaStyle: React.CSSProperties = { display: 'block', boxSizing: 'border-box', width: '100%', marginTop: 5, padding: 10, border, color: ink, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, lineHeight: 1.45, resize: 'vertical', background: 'var(--admin-surface)' };
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, padding: 8, border, fontFamily: 'inherit', color: ink, background: 'var(--admin-surface)' };
const labelStyle: React.CSSProperties = { display: 'block', marginTop: 12, color: muted, fontSize: 12 };

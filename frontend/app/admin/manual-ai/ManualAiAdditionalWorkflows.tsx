'use client';

// Separate, review-first hand-offs for the non-SEO tasks. The common screen is
// only a presentation layer: every prompt, response validator and write owner
// remains a distinct server-side workflow.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/adminToast';

const API = process.env.NEXT_PUBLIC_API_URL;
const border = '1px solid var(--admin-line)';
const ink = 'var(--admin-ink)';
const muted = 'var(--admin-ink-muted)';

type WorkflowId = 'translation_v1' | 'catalogue_copy_v1' | 'image_alt_v1';
type Option = { type: string; id: string; imageId?: string; label: string; detail: string; imageUrl?: string };
type Fields = Record<string, string>;
type Proposal = { fields?: Fields | null; text?: string; warnings: string[]; appliedAt?: string | null; stale?: boolean };
type TaskTarget = { key: string; type: string; resourceId: string; label: string; url: string; snapshot: Record<string, unknown>; proposal: Proposal | null };
type Task = { id: string; taskType: WorkflowId; locale?: string; status: string; provider: string; createdAt: string; targets: TaskTarget[] };

const WORKFLOWS: Record<WorkflowId, { label: string; route: string; contract: string; limit: number; description: string }> = {
  translation_v1: {
    label: 'Translations', route: 'translation', contract: 'silkilinen.external-ai.translation.v1', limit: 10,
    description: 'Translate selected live catalogue records into one language. Any founder-edited translation remains protected.',
  },
  catalogue_copy_v1: {
    label: 'Catalogue copy', route: 'catalogue-copy', contract: 'silkilinen.external-ai.catalogue-copy.v1', limit: 5,
    description: 'Add one reviewed, factual paragraph to selected product descriptions. Prices, stock, slugs and product facts stay protected.',
  },
  image_alt_v1: {
    label: 'Image alt text', route: 'image-alt', contract: 'silkilinen.external-ai.image-alt.v1', limit: 5,
    description: 'Write alt text only for the exact selected product images that are still missing it.',
  },
};

function optionKey(option: Option) { return option.imageId ? `${option.id}:${option.imageId}` : `${option.type}:${option.id}`; }

function date(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function proposalKeys(task: Task | null) {
  return task?.targets.filter(target => target.proposal && !target.proposal.appliedAt && !target.proposal.stale).map(target => target.key) || [];
}

function workflowName(id: WorkflowId) { return WORKFLOWS[id].label.toLowerCase(); }

function fields(value: unknown) { return value && typeof value === 'object' && !Array.isArray(value) ? value as Fields : {}; }

export default function ManualAiAdditionalWorkflows() {
  const [workflow, setWorkflow] = useState<WorkflowId>('translation_v1');
  const [options, setOptions] = useState<Option[]>([]);
  const [locales, setLocales] = useState<string[]>([]);
  const [locale, setLocale] = useState('fr');
  const [selected, setSelected] = useState<string[]>([]);
  const [history, setHistory] = useState<Task[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState('');
  const [response, setResponse] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [applyKeys, setApplyKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);

  const config = WORKFLOWS[workflow];

  const load = useCallback(async () => {
    try {
      const [optionsResponse, tasksResponse] = await Promise.all([
        fetch(`${API}/api/admin/manual-ai/tasks/options/${workflow}`, { credentials: 'include' }),
        fetch(`${API}/api/admin/manual-ai/tasks?taskType=${workflow}`, { credentials: 'include' }),
      ]);
      const optionsData = await optionsResponse.json();
      const tasksData = await tasksResponse.json();
      if (!optionsResponse.ok) throw new Error(optionsData.error || 'Could not load this workflow.');
      if (!tasksResponse.ok) throw new Error(tasksData.error || 'Could not load this workflow history.');
      setOptions(Array.isArray(optionsData.targets) ? optionsData.targets : []);
      setLocales(Array.isArray(optionsData.locales) ? optionsData.locales : []);
      if (Array.isArray(optionsData.locales) && optionsData.locales.length && !optionsData.locales.includes(locale)) setLocale(optionsData.locales[0]);
      setHistory(Array.isArray(tasksData.runs) ? tasksData.runs : []);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not load this Manual AI workflow.', 'error');
    } finally {
      setLoading(false);
    }
  }, [locale, workflow]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const selectedOptions = useMemo(() => {
    const selectedSet = new Set(selected);
    return options.filter(option => selectedSet.has(optionKey(option)));
  }, [options, selected]);

  function changeWorkflow(next: WorkflowId) {
    setLoading(true); setWorkflow(next); setSelected([]); setTask(null); setPrompt(''); setResponse(''); setErrors([]); setApplyKeys([]); setProvider('');
  }

  function toggle(option: Option) {
    const key = optionKey(option);
    setSelected(previous => previous.includes(key)
      ? previous.filter(item => item !== key)
      : previous.length >= config.limit ? (toast(`A ${workflowName(workflow)} prompt can contain up to ${config.limit} items.`, 'info'), previous) : [...previous, key]);
  }

  async function prepare() {
    if (!selectedOptions.length) return;
    setPreparing(true); setErrors([]); setResponse(''); setApplyKeys([]);
    try {
      const targets = selectedOptions.map(option => ({ type: option.type, id: option.id, imageId: option.imageId }));
      const payload = workflow === 'translation_v1' ? { locale, targets } : { targets };
      const result = await fetch(`${API}/api/admin/manual-ai/tasks/${config.route}/prepare`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' }, body: JSON.stringify(payload),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || 'Could not prepare the prompt.');
      setTask(data.task); setPrompt(data.prompt); setHistory(previous => [data.task, ...previous.filter(item => item.id !== data.task.id)]);
      toast(`Prompt ready for ${data.itemCount} ${data.itemCount === 1 ? 'item' : 'items'}.`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not prepare the prompt.', 'error');
    } finally {
      setPreparing(false);
    }
  }

  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); toast('Prompt copied. Paste it into the AI you prefer.', 'success'); }
    catch { toast('Your browser could not copy it. Select the prompt and copy it manually.', 'info'); }
  }

  async function resume(id: string) {
    try {
      const result = await fetch(`${API}/api/admin/manual-ai/tasks/${id}`, { credentials: 'include' });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || 'Could not open this task.');
      setTask(data.task); setPrompt(data.prompt); setErrors([]); setResponse(''); setApplyKeys(proposalKeys(data.task));
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not open this task.', 'error');
    }
  }

  async function validateResponse() {
    if (!task || !response.trim()) return;
    setChecking(true); setErrors([]);
    try {
      const result = await fetch(`${API}/api/admin/manual-ai/tasks/${task.id}/import`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' }, body: JSON.stringify({ response, provider }),
      });
      const data = await result.json();
      if (!result.ok) {
        if (Array.isArray(data.errors)) { setErrors(data.errors); toast(data.error || 'The response did not pass the safety check.', 'error'); return; }
        throw new Error(data.error || 'The response did not pass validation.');
      }
      setTask(data.task); setApplyKeys(proposalKeys(data.task)); setHistory(previous => [data.task, ...previous.filter(item => item.id !== data.task.id)]);
      toast('Response verified. Review every change before applying it.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'The response did not pass validation.', 'error');
    } finally {
      setChecking(false);
    }
  }

  function toggleApply(key: string) {
    setApplyKeys(previous => previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key]);
  }

  async function applySelected() {
    if (!task || !applyKeys.length) return;
    setApplying(true);
    try {
      const result = await fetch(`${API}/api/admin/manual-ai/tasks/${task.id}/apply`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' }, body: JSON.stringify({ keys: applyKeys }),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || 'Could not apply the selected changes.');
      setTask(data.task); setApplyKeys(proposalKeys(data.task)); setHistory(previous => [data.task, ...previous.filter(item => item.id !== data.task.id)]);
      const applied = data.report?.filter((item: { status: string }) => item.status === 'applied').length || 0;
      const stale = data.report?.filter((item: { status: string }) => item.status === 'stale').length || 0;
      toast(applied ? `${applied} change${applied === 1 ? '' : 's'} published.${stale ? ` ${stale} need a fresh prompt.` : ''}` : 'Nothing was published; check the review status.', applied ? 'success' : 'info');
      load();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not apply the selected changes.', 'error');
    } finally {
      setApplying(false);
    }
  }

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ border, background: 'var(--admin-surface)', padding: 18 }}>
        <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 21, color: ink }}>Other reviewed workflows</h2>
        <p style={{ margin: '7px 0 0', color: muted, fontSize: 13, lineHeight: 1.55, maxWidth: 760 }}>
          Each workflow has a separate prompt, safety check and approval step. None gives an AI a general ability to change your shop.
        </p>
        <div role="tablist" aria-label="Manual AI workflows" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {(Object.keys(WORKFLOWS) as WorkflowId[]).map(id => <button key={id} role="tab" aria-selected={workflow === id} onClick={() => changeWorkflow(id)} style={buttonStyle(workflow === id)}>{WORKFLOWS[id].label}</button>)}
        </div>
      </div>

      <section style={{ marginTop: 18, border, padding: 18, background: 'var(--admin-surface)' }}>
        <h3 style={{ margin: 0, color: ink, fontSize: 16 }}>1. Choose what to review</h3>
        <p style={{ margin: '4px 0 12px', color: muted, fontSize: 12.5 }}>{config.description}</p>
        {workflow === 'translation_v1' && <label style={labelStyle}>Language
          <select aria-label="Translation language" value={locale} onChange={event => { setLoading(true); setLocale(event.target.value); }} style={inputStyle}>
            {locales.map(code => <option key={code} value={code}>{({ de: 'German', fr: 'French', it: 'Italian', es: 'Spanish' } as Record<string, string>)[code] || code}</option>)}
          </select>
        </label>}
        {loading ? <p style={{ color: muted, fontSize: 13 }}>Loading available items…</p> : <div style={{ marginTop: 12, display: 'grid', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
          {options.map(option => <label key={optionKey(option)} style={{ display: 'flex', gap: 10, alignItems: 'center', border, padding: '8px 10px', cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.includes(optionKey(option))} onChange={() => toggle(option)} />
            {option.imageUrl && <>
              {/* Cloudinary URLs are selected at runtime; this small admin preview is not an LCP image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={option.imageUrl} alt="" width={46} height={46} style={{ width: 46, height: 46, objectFit: 'cover', border }} />
            </>}
            <span><strong style={{ color: ink, fontSize: 13 }}>{option.label}</strong><br /><span style={{ color: muted, fontSize: 11.5 }}>{option.detail}</span></span>
          </label>)}
          {!options.length && <p style={{ color: muted, fontSize: 13 }}>There is nothing waiting for this workflow right now.</p>}
        </div>}
        <button onClick={prepare} disabled={!selectedOptions.length || preparing} style={{ ...buttonStyle(true, !selectedOptions.length || preparing), marginTop: 14 }}>{preparing ? 'Preparing…' : `Prepare prompt (${selectedOptions.length})`}</button>
      </section>

      {task && <>
        <section style={{ marginTop: 18, border, padding: 18, background: 'var(--admin-surface)' }}>
          <h3 style={{ margin: 0, color: ink, fontSize: 16 }}>2. Use your AI, then paste its answer</h3>
          <p style={{ margin: '4px 0 10px', color: muted, fontSize: 12.5 }}>Task {task.id.slice(-8)} · prepared {date(task.createdAt)}. The prompt contains only the selected records and strict return format.</p>
          {task.taskType === 'image_alt_v1' && <ImageAttachmentReminder targets={task.targets} />}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <button onClick={copyPrompt} style={buttonStyle(false)}>Copy prompt</button>
            <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(prompt)}`} download={`silkilinen-${task.taskType}-prompt-${task.id}.txt`} style={{ ...buttonStyle(false), textDecoration: 'none' }}>Download prompt</a>
          </div>
          <textarea readOnly value={prompt} rows={11} aria-label="Prepared AI prompt" style={textareaStyle} />
          <label style={labelStyle}>AI used (optional)<input value={provider} onChange={event => setProvider(event.target.value)} placeholder="e.g. Codex, Claude, Gemini" maxLength={80} style={inputStyle} /></label>
          <label style={labelStyle}>Paste the AI&apos;s JSON response<textarea value={response} onChange={event => setResponse(event.target.value)} rows={10} placeholder={`{"contract":"${WORKFLOWS[task.taskType].contract}", ...}`} style={textareaStyle} /></label>
          {errors.length > 0 && <ul style={{ margin: '10px 0', paddingLeft: 20, color: 'var(--admin-danger)', fontSize: 12.5 }}>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
          <button onClick={validateResponse} disabled={!response.trim() || checking || task.status === 'applied' || task.status === 'partially_applied'} style={buttonStyle(true, !response.trim() || checking || task.status === 'applied' || task.status === 'partially_applied')}>{checking ? 'Checking response…' : 'Validate response'}</button>
        </section>

        {task.targets.some(target => target.proposal) && <section style={{ marginTop: 18, border, padding: 18, background: 'var(--admin-surface)' }}>
          <h3 style={{ margin: 0, fontSize: 16, color: ink }}>3. Review before publishing</h3>
          <p style={{ margin: '4px 0 12px', color: muted, fontSize: 12.5 }}>Only checked proposals will be applied. The source is read again immediately before each change is published.</p>
          <div style={{ display: 'grid', gap: 12 }}>{task.targets.map(target => target.proposal && <ReviewCard key={target.key} taskType={task.taskType} target={target} checked={applyKeys.includes(target.key)} onToggle={() => toggleApply(target.key)} />)}</div>
          <button onClick={applySelected} disabled={!applyKeys.length || applying} style={{ ...buttonStyle(true, !applyKeys.length || applying), marginTop: 14 }}>{applying ? 'Applying selected changes…' : `Apply selected (${applyKeys.length})`}</button>
        </section>}
      </>}

      {history.length > 0 && <section style={{ marginTop: 20 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14, color: ink }}>Recent {workflowName(workflow)} hand-offs</h3>
        <div style={{ display: 'grid', gap: 6 }}>{history.slice(0, 5).map(item => <button key={item.id} onClick={() => resume(item.id)} style={{ ...buttonStyle(false), textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{item.targets.length} item{item.targets.length === 1 ? '' : 's'} · {item.status.replace('_', ' ')}</span><span style={{ color: muted }}>{date(item.createdAt)} · resume →</span></button>)}</div>
      </section>}
    </section>
  );
}

function ImageAttachmentReminder({ targets }: { targets: TaskTarget[] }) {
  return <div style={{ margin: '10px 0', borderLeft: '3px solid var(--admin-info)', padding: '8px 10px', color: ink, fontSize: 12.5, lineHeight: 1.5 }}>
    Attach these exact images to the external AI before asking it for alt text. A copied prompt alone does not prove that an AI has seen a photo.
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>{targets.map(target => {
      const image = target.snapshot.image as { url?: string } | undefined;
      return image?.url ? <a key={target.key} href={image.url} target="_blank" rel="noreferrer" style={{ color: ink }}>Open {target.label} ↗</a> : null;
    })}</div>
  </div>;
}

function ReviewCard({ taskType, target, checked, onToggle }: { taskType: WorkflowId; target: TaskTarget; checked: boolean; onToggle: () => void }) {
  const proposal = target.proposal!;
  const frozen = Boolean(proposal.appliedAt || proposal.stale);
  return <article style={{ border, padding: 12, borderLeft: `3px solid ${proposal.stale ? 'var(--admin-warning)' : proposal.appliedAt ? 'var(--admin-success)' : 'var(--admin-info)'}` }}>
    <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: frozen ? 'default' : 'pointer' }}>
      <input type="checkbox" checked={checked} disabled={frozen} onChange={onToggle} />
      <span><strong style={{ color: ink, fontSize: 13 }}>{target.label}</strong><span style={{ color: muted, fontSize: 11.5 }}> · {taskType === 'translation_v1' ? String(target.snapshot.locale || '').toUpperCase() : taskType === 'catalogue_copy_v1' ? 'description' : 'image alt text'}</span></span>
    </label>
    {taskType === 'translation_v1' && <TranslationDiff target={target} proposal={proposal} />}
    {taskType === 'catalogue_copy_v1' && <Diff label="Current description" before={String(target.snapshot.description || '')} after={proposal.text || ''} afterLabel="Approved paragraph to add" />}
    {taskType === 'image_alt_v1' && <AltDiff target={target} proposal={proposal} />}
    {proposal.warnings.map(warning => <p key={warning} style={{ margin: '7px 0 0', color: 'var(--admin-warning)', fontSize: 12 }}>{warning}</p>)}
    {proposal.stale && <p style={{ margin: '7px 0 0', color: 'var(--admin-warning)', fontSize: 12 }}>This source changed after the prompt was made. Prepare a fresh prompt before applying it.</p>}
    {proposal.appliedAt && <p style={{ margin: '7px 0 0', color: 'var(--admin-success)', fontSize: 12 }}>Published {date(proposal.appliedAt)}.</p>}
  </article>;
}

function TranslationDiff({ target, proposal }: { target: TaskTarget; proposal: Proposal }) {
  const source = fields(target.snapshot.sourceFields);
  const current = fields(target.snapshot.existingFields);
  return <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>{Object.keys(source).map(field => <Diff key={field} label={field} before={current[field] || ''} after={proposal.fields?.[field] || ''} />)}</div>;
}

function AltDiff({ target, proposal }: { target: TaskTarget; proposal: Proposal }) {
  const image = target.snapshot.image as { url?: string; alt?: string } | undefined;
  return <div style={{ marginTop: 10 }}>
    {image?.url && <>
      {/* Cloudinary URLs are selected at runtime; this is a small admin review preview. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt="" width={110} height={110} style={{ width: 110, height: 110, objectFit: 'cover', border, float: 'right', marginLeft: 12 }} />
    </>}
    <Diff label="Current alt text" before={image?.alt || ''} after={proposal.text || ''} />
  </div>;
}

function Diff({ label, before, after, afterLabel = 'Proposed' }: { label: string; before: string; after: string; afterLabel?: string }) {
  return <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'minmax(110px, 0.8fr) minmax(0, 1.2fr)', gap: 9, fontSize: 12.5 }}>
    <span style={{ color: muted }}>{label}</span>
    <span style={{ color: muted }}>{before || '—'}</span>
    <span style={{ gridColumn: '2', color: ink }}><span style={{ color: muted }}>{afterLabel}: </span>{after}</span>
  </div>;
}

function buttonStyle(primary: boolean, disabled = false): React.CSSProperties {
  return { appearance: 'none', border: primary ? '1px solid var(--admin-ink)' : border, background: primary ? 'var(--admin-ink)' : 'var(--admin-surface)', color: primary ? 'var(--admin-surface)' : ink, padding: '8px 12px', fontSize: 12.5, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 };
}
const textareaStyle: React.CSSProperties = { display: 'block', boxSizing: 'border-box', width: '100%', marginTop: 5, padding: 10, border, color: ink, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, lineHeight: 1.45, resize: 'vertical', background: 'var(--admin-surface)' };
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, padding: 8, border, fontFamily: 'inherit', color: ink, background: 'var(--admin-surface)' };
const labelStyle: React.CSSProperties = { display: 'block', marginTop: 12, color: muted, fontSize: 12 };

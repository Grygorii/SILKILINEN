'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './AiPhotoshoot.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

// ── Tiers ────────────────────────────────────────────────────────────────────
const TIER_COSTS   = { standard: 0.05, hd: 0.13, premium: 0.24 } as const;
const TIER_LABELS  = { standard: '1K',  hd: '2K',  premium: '4K'  } as const;
type TierKey = keyof typeof TIER_COSTS;

// ── Workflow presets (mirrors backend) ───────────────────────────────────────
type JobSpec = { position: string; tier: TierKey; label: string };
type WorkflowKey = 'quick_add' | 'standard' | 'full_launch' | 'custom';

const WORKFLOW_PRESETS: Record<Exclude<WorkflowKey, 'custom'>, {
  label: string; count: number; description: string; note: string; jobs: JobSpec[];
}> = {
  quick_add: {
    label: 'Quick Add', count: 1,
    description: 'Just a thumbnail for the shop grid.',
    note: 'Good for: testing new products, quick listings.',
    jobs: [{ position: 'thumbnail', tier: 'standard', label: 'Shop card' }],
  },
  standard: {
    label: 'Standard', count: 3,
    description: 'Shop thumbnail + 2 product page angles.',
    note: 'Good for: most products, balanced quality and cost.',
    jobs: [
      { position: 'thumbnail', tier: 'standard', label: 'Shop card' },
      { position: 'front',     tier: 'hd',       label: 'Product page hero' },
      { position: 'detail',    tier: 'hd',       label: 'Detail close-up' },
    ],
  },
  full_launch: {
    label: 'Full Launch', count: 4,
    description: 'Thumbnail + hero + side + detail close-up.',
    note: 'Good for: featured products, hero items.',
    jobs: [
      { position: 'thumbnail', tier: 'standard', label: 'Shop card' },
      { position: 'front',     tier: 'premium',  label: 'Product page hero' },
      { position: 'side',      tier: 'hd',       label: 'Side angle' },
      { position: 'detail',    tier: 'hd',       label: 'Detail close-up' },
    ],
  },
};

const ALL_POSITIONS: JobSpec[] = [
  { position: 'thumbnail', tier: 'standard', label: 'Shop card' },
  { position: 'front',     tier: 'hd',       label: 'Product page hero' },
  { position: 'side',      tier: 'hd',       label: 'Side angle' },
  { position: 'detail',    tier: 'hd',       label: 'Detail close-up' },
  { position: 'lifestyle', tier: 'hd',       label: 'Lifestyle' },
];

const QUICK_FEEDBACK = [
  'Different pose',
  'Brighter lighting',
  'Closer crop',
  'More elegant expression',
  'Show garment detail',
  'Different background',
];

// ── Types ────────────────────────────────────────────────────────────────────
type ModelSummary = {
  _id: string;
  name: string;
  heritage: string;
  referenceImageUrl: string;
  active: boolean;
};

type PhotoState = {
  url: string;
  status: 'pending' | 'approved';
  iterations: number;
  label: string;
  tier: TierKey;
  resolution?: { width: number; height: number };
};

type Props = {
  productId: string;
  productCategory: string;
  onPhotoApproved: (url: string) => void;
};

function presetCost(workflow: WorkflowKey, customJobs: JobSpec[]): number {
  if (workflow === 'custom') return customJobs.reduce((s, j) => s + TIER_COSTS[j.tier], 0);
  return WORKFLOW_PRESETS[workflow].jobs.reduce((s, j) => s + TIER_COSTS[j.tier], 0);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AiPhotoshoot({ productId, productCategory, onPhotoApproved }: Props) {
  const [expanded, setExpanded]             = useState(false);
  const [showTooltip, setShowTooltip]       = useState(false);
  const [models, setModels]                 = useState<ModelSummary[]>([]);
  const [sessionId, setSessionId]           = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [suggestedModel, setSuggestedModel] = useState<ModelSummary | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [photoStates, setPhotoStates]       = useState<Record<string, PhotoState>>({});
  const [totalCost, setTotalCost]           = useState(0);

  const [workflow, setWorkflow]             = useState<WorkflowKey>('standard');
  const [customSelected, setCustomSelected] = useState<Set<string>>(new Set(['thumbnail', 'front']));
  const [customTier, setCustomTier]         = useState<TierKey>('hd');

  const [generating, setGenerating]         = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [improvingPosition, setImprovingPosition] = useState<string | null>(null);
  const [improveFeedback, setImproveFeedback] = useState('');
  const [iterating, setIterating]           = useState(false);
  const [costWarning, setCostWarning]       = useState(false);
  const [costBlocked, setCostBlocked]       = useState(false);
  const [forceOverride, setForceOverride]   = useState(false);
  const [error, setError]                   = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Onboarding: show once per browser
  useEffect(() => {
    if (!expanded) return;
    if (typeof window !== 'undefined' && !localStorage.getItem('silkilinen_ai_photoshoot_seen')) {
      setShowTooltip(true);
    }
  }, [expanded]);

  function dismissTooltip() {
    setShowTooltip(false);
    if (typeof window !== 'undefined') localStorage.setItem('silkilinen_ai_photoshoot_seen', '1');
  }

  useEffect(() => {
    if (!expanded) return;
    fetch(`${API}/api/ai-models`)
      .then(r => (r.ok ? r.json() : []))
      .then((data: ModelSummary[]) => setModels(data.filter(m => m.active)))
      .catch(() => {});
  }, [expanded]);

  // Derived: custom jobs from selected positions + tier
  const customJobs: JobSpec[] = Array.from(customSelected).map(pos => {
    const base = ALL_POSITIONS.find(p => p.position === pos)!;
    return { ...base, tier: pos === 'thumbnail' ? 'standard' : customTier };
  });

  const currentJobs = workflow === 'custom' ? customJobs : WORKFLOW_PRESETS[workflow].jobs;
  const estimatedCost = presetCost(workflow, customJobs);

  const hasPhotos = Object.keys(photoStates).length > 0;
  const hasApproved = Object.values(photoStates).some(p => p.status === 'approved');
  const isWorking = creatingSession || generating || iterating;

  // ── Upload ──────────────────────────────────────────────────────────────────
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 3 - uploadedPhotos.length);
    for (const file of files) {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`${API}/api/products/upload`, { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      if (data.url) setUploadedPhotos(p => [...p, data.url]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function toggleCustomPosition(pos: string) {
    setCustomSelected(prev => {
      const next = new Set(prev);
      if (next.has(pos)) next.delete(pos); else next.add(pos);
      return next;
    });
  }

  // ── Apply API results ───────────────────────────────────────────────────────
  function applyGenerateResult(
    results: { position: string; url?: string; label?: string; tier?: string; resolution?: { width: number; height: number } }[]
  ) {
    setPhotoStates(prev => {
      const next = { ...prev };
      for (const r of results) {
        if (r.url) {
          const job = currentJobs.find(j => j.position === r.position);
          next[r.position] = {
            url: r.url,
            status: 'pending',
            iterations: prev[r.position]?.iterations || 0,
            label:    r.label || job?.label || r.position,
            tier:     (r.tier as TierKey) || job?.tier || 'hd',
            resolution: r.resolution,
          };
        }
      }
      return next;
    });
  }

  // ── Generate ────────────────────────────────────────────────────────────────
  async function startGeneration() {
    if (uploadedPhotos.length === 0) { setError('Upload at least one product photo first.'); return; }
    setError('');

    let sid = sessionId;
    if (!sid) {
      setCreatingSession(true);
      try {
        const res = await fetch(`${API}/api/ai-photos/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ productId, modelId: selectedModelId || undefined, inputPhotoUrls: uploadedPhotos }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        sid = data.sessionId;
        setSessionId(sid);
        setSuggestedModel(data.selectedModel);
        if (!selectedModelId) setSelectedModelId(data.selectedModel._id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create session');
        setCreatingSession(false);
        return;
      }
      setCreatingSession(false);
    }

    setGenerating(true);
    try {
      const body = workflow === 'custom'
        ? { positions: customJobs, forceOverride }
        : { preset: workflow, forceOverride };

      const res = await fetch(`${API}/api/ai-photos/sessions/${sid}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'SESSION_COST_LIMIT') { setCostBlocked(true); setTotalCost(data.totalCost); setError(data.message); return; }
        throw new Error(data.error);
      }

      applyGenerateResult(data.results || []);
      setTotalCost(data.totalCost);
      if (data.costWarning) setCostWarning(true);
      if (data.costBlocked) setCostBlocked(true);
      setForceOverride(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  // ── Approve ─────────────────────────────────────────────────────────────────
  async function approvePhoto(position: string) {
    if (!sessionId) return;
    const res = await fetch(`${API}/api/ai-photos/sessions/${sessionId}/approve-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ position }),
    });
    const data = await res.json();
    if (res.ok) {
      setPhotoStates(s => ({ ...s, [position]: { ...s[position]!, status: 'approved' } }));
      onPhotoApproved(data.url);
    }
  }

  // ── Regenerate single photo ──────────────────────────────────────────────────
  async function handleRegenerate() {
    if (!sessionId || !improvingPosition) return;
    setIterating(true);
    setError('');
    try {
      const photo = photoStates[improvingPosition];
      const res = await fetch(`${API}/api/ai-photos/sessions/${sessionId}/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          position: improvingPosition,
          feedback: improveFeedback || null,
          tier: photo?.tier,
          forceOverride,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'SESSION_COST_LIMIT') { setCostBlocked(true); setTotalCost(data.totalCost); setError(data.message); return; }
        throw new Error(data.error);
      }
      setPhotoStates(s => ({
        ...s,
        [improvingPosition]: {
          ...s[improvingPosition]!,
          url: data.url,
          status: 'pending',
          iterations: (s[improvingPosition]?.iterations || 0) + 1,
          resolution: data.resolution,
        },
      }));
      setTotalCost(data.totalCost);
      if (data.costWarning) setCostWarning(true);
      if (data.costBlocked) setCostBlocked(true);
      setImprovingPosition(null);
      setImproveFeedback('');
      setForceOverride(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed');
    } finally {
      setIterating(false);
    }
  }

  // ── Finalize ─────────────────────────────────────────────────────────────────
  async function finalize() {
    if (!sessionId) return;
    const res = await fetch(`${API}/api/ai-photos/sessions/${sessionId}/finalize`, { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (res.ok) {
      onPhotoApproved(data.productImageUrl);
      alert(`Done — ${data.approvedCount} photo(s) saved. Session total: €${(data.totalCost || 0).toFixed(2)}`);
    } else {
      setError(data.error);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={styles.section}>
      <button className={styles.toggle} onClick={() => setExpanded(e => !e)}>
        <span>✨ AI Photoshoot</span>
        <span className={styles.toggleRight}>
          {totalCost > 0 && <span className={styles.sessionCostBadge}>€{totalCost.toFixed(2)}</span>}
          <span className={styles.toggleChevron}>{expanded ? '▲' : '▼'}</span>
        </span>
      </button>

      {expanded && (
        <div className={styles.body}>

          {/* ── Onboarding tooltip ──────────────────────────── */}
          {showTooltip && (
            <div className={styles.tooltip}>
              <div className={styles.tooltipSteps}>
                <span><strong>1.</strong> Upload 2–3 product photos (any angle)</span>
                <span><strong>2.</strong> Choose a workflow — Standard is a good start</span>
                <span><strong>3.</strong> Aoife is auto-selected — switch model if you like</span>
                <span><strong>4.</strong> Click Generate — allow 30–60 s per photo</span>
                <span><strong>5.</strong> Approve the good ones, regenerate the rest individually</span>
              </div>
              <button className={styles.tooltipClose} onClick={dismissTooltip}>Got it →</button>
            </div>
          )}

          {/* ── Upload zone ─────────────────────────────────── */}
          <div className={styles.uploadZone}>
            <p className={styles.uploadLabel}>
              Product photos <span className={styles.uploadHint}>(2–3 recommended — front, back, detail)</span>
            </p>
            <div className={styles.thumbRow}>
              {uploadedPhotos.map((url, i) => (
                <div key={i} className={styles.thumb}>
                  <img src={url} alt="" className={styles.thumbImg} />
                  <button className={styles.thumbRemove} onClick={() => setUploadedPhotos(p => p.filter((_, j) => j !== i))} disabled={isWorking}>✕</button>
                </div>
              ))}
              {uploadedPhotos.length < 3 && (
                <button className={styles.uploadAdd} onClick={() => fileInputRef.current?.click()} disabled={isWorking}>
                  <span>+</span>
                  <span className={styles.uploadAddLabel}>Add photo</span>
                </button>
              )}
            </div>
            <input type="file" accept="image/*" multiple ref={fileInputRef} className={styles.hiddenInput} onChange={handleUpload} />
          </div>

          {/* ── Model selector ───────────────────────────────── */}
          <div className={styles.modelRow}>
            <div className={styles.modelCard}>
              {suggestedModel?.referenceImageUrl
                ? <img src={suggestedModel.referenceImageUrl} className={styles.modelThumb} alt={suggestedModel.name} />
                : <div className={styles.modelThumbEmpty}>👤</div>}
              <div>
                <p className={styles.modelName}>{suggestedModel?.name || 'Auto-select on generate'}</p>
                {suggestedModel?.heritage && <p className={styles.modelHeritage}>{suggestedModel.heritage}</p>}
              </div>
            </div>
            {models.length > 0 && (
              <div className={styles.overrideWrap}>
                <p className={styles.overrideLabel}>Override model</p>
                <select className={styles.overrideSelect} value={selectedModelId} onChange={e => setSelectedModelId(e.target.value)} disabled={!!sessionId || isWorking}>
                  <option value="">Auto-select</option>
                  {models.map(m => <option key={m._id} value={m._id}>{m.name} — {m.heritage}</option>)}
                </select>
                {sessionId && <p className={styles.overrideNote}>Model locked once session starts</p>}
              </div>
            )}
          </div>

          {/* ── Workflow presets + generate (only before first generation) ── */}
          {!hasPhotos && (
            <>
              <div className={styles.workflowSection}>
                <p className={styles.workflowHeading}>PHOTOSHOOT WORKFLOW</p>

                {(Object.entries(WORKFLOW_PRESETS) as [Exclude<WorkflowKey, 'custom'>, typeof WORKFLOW_PRESETS[Exclude<WorkflowKey, 'custom'>]][]).map(([key, preset]) => {
                  const cost = preset.jobs.reduce((s, j) => s + TIER_COSTS[j.tier], 0);
                  return (
                    <label key={key} className={`${styles.workflowOption} ${workflow === key ? styles.workflowActive : ''}`}>
                      <input type="radio" name="workflow" value={key} checked={workflow === key} onChange={() => setWorkflow(key)} className={styles.workflowRadio} />
                      <div className={styles.workflowBody}>
                        <span className={styles.workflowTitle}>
                          {preset.label} ({preset.count} photo{preset.count !== 1 ? 's' : ''})
                          <span className={styles.workflowCost}> — €{cost.toFixed(2)}</span>
                        </span>
                        <span className={styles.workflowDesc}>{preset.description}</span>
                        <span className={styles.workflowNote}>{preset.note}</span>
                      </div>
                    </label>
                  );
                })}

                <label className={`${styles.workflowOption} ${workflow === 'custom' ? styles.workflowActive : ''}`}>
                  <input type="radio" name="workflow" value="custom" checked={workflow === 'custom'} onChange={() => setWorkflow('custom')} className={styles.workflowRadio} />
                  <div className={styles.workflowBody}>
                    <span className={styles.workflowTitle}>
                      Custom — pick individually
                      {workflow === 'custom' && customJobs.length > 0 && (
                        <span className={styles.workflowCost}> — €{estimatedCost.toFixed(2)}</span>
                      )}
                    </span>
                  </div>
                </label>

                {workflow === 'custom' && (
                  <div className={styles.customPanel}>
                    {ALL_POSITIONS.map(pos => (
                      <label key={pos.position} className={styles.customOption}>
                        <input type="checkbox" checked={customSelected.has(pos.position)} onChange={() => toggleCustomPosition(pos.position)} className={styles.customCheckbox} />
                        <span className={styles.customOptionLabel}>{pos.label}</span>
                        <span className={styles.customOptionMeta}>
                          {pos.position === 'thumbnail'
                            ? `Standard 1K — €${TIER_COSTS.standard.toFixed(2)}`
                            : `${customTier.charAt(0).toUpperCase() + customTier.slice(1)} ${TIER_LABELS[customTier]} — €${TIER_COSTS[customTier].toFixed(2)}`}
                        </span>
                      </label>
                    ))}
                    <div className={styles.customTierRow}>
                      <span className={styles.overrideLabel}>Quality for non-thumbnail shots</span>
                      <select className={styles.overrideSelect} value={customTier} onChange={e => setCustomTier(e.target.value as TierKey)}>
                        <option value="standard">Standard (1K) — €0.05 each</option>
                        <option value="hd">HD (2K) — €0.13 each</option>
                        <option value="premium">Premium (4K) — €0.24 each</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.generateRow}>
                <button
                  className={styles.generateBtn}
                  onClick={startGeneration}
                  disabled={isWorking || uploadedPhotos.length === 0 || (costBlocked && !forceOverride) || (workflow === 'custom' && customJobs.length === 0)}
                >
                  {creatingSession
                    ? 'Setting up session…'
                    : generating
                    ? `Generating — ~${currentJobs.length * 45}s…`
                    : `Generate Photoshoot — €${estimatedCost.toFixed(2)}`}
                </button>
                <div className={styles.costInfo}>
                  {totalCost > 0 && <>
                    <span className={styles.costFigure}>€{totalCost.toFixed(2)}</span>
                    <span className={styles.costLabel}>session cost</span>
                  </>}
                  {costWarning && !costBlocked && <span className={styles.costWarn}>⚠ Approaching €5 limit</span>}
                  {costBlocked && (
                    <span className={styles.costOver}>
                      ⛔ €10 limit
                      <button className={styles.overrideBtn} onClick={() => { setForceOverride(true); setCostBlocked(false); setError(''); }}>Admin override</button>
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {error && <p className={styles.error}>{error}</p>}

          {/* ── Results ──────────────────────────────────────── */}
          {hasPhotos && (
            <>
              <div className={styles.resultsGrid}>
                {Object.entries(photoStates).map(([pos, photo]) => {
                  const isImproving = improvingPosition === pos;
                  return (
                    <div key={pos} className={`${styles.resultCard} ${photo.status === 'approved' ? styles.resultApproved : ''}`}>
                      <div className={styles.resultHeader}>
                        <span className={styles.resultLabel}>{photo.label}</span>
                        <div className={styles.resultMeta}>
                          <span className={styles.resBadge}>{TIER_LABELS[photo.tier]}</span>
                          <span className={styles.costBadge}>€{TIER_COSTS[photo.tier].toFixed(2)}</span>
                        </div>
                        {photo.iterations > 0 && <span className={styles.iterBadge}>×{photo.iterations}</span>}
                        {photo.status === 'approved' && <span className={styles.approvedMark}>✓</span>}
                      </div>

                      <div className={styles.resultImgWrap}>
                        <img src={photo.url} alt={photo.label} className={styles.resultImg} />
                      </div>

                      <div className={styles.resultActions}>
                        {photo.status === 'approved' ? (
                          <span className={styles.approvedLabel}>Approved</span>
                        ) : (
                          <button className={styles.approveBtn} onClick={() => approvePhoto(pos)} disabled={isWorking}>✓ Approve</button>
                        )}
                        <button
                          className={`${styles.improveBtn} ${isImproving ? styles.improveBtnActive : ''}`}
                          onClick={() => { setImprovingPosition(isImproving ? null : pos); setImproveFeedback(''); }}
                          disabled={isWorking}
                        >
                          ↺ Regenerate
                        </button>
                      </div>

                      {isImproving && (
                        <div className={styles.feedbackPanel}>
                          <div className={styles.quickTaps}>
                            {QUICK_FEEDBACK.map(fb => (
                              <button key={fb} className={`${styles.quickBtn} ${improveFeedback === fb ? styles.quickBtnActive : ''}`} onClick={() => setImproveFeedback(fb)}>
                                {fb}
                              </button>
                            ))}
                          </div>
                          <textarea className={styles.customInput} rows={2} placeholder="Or type custom feedback…" value={improveFeedback} onChange={e => setImproveFeedback(e.target.value)} />
                          <p className={styles.regenCostNote}>
                            Cost: €{TIER_COSTS[photo.tier].toFixed(2)} ({TIER_LABELS[photo.tier]})
                          </p>
                          <button className={styles.regenerateBtn} onClick={handleRegenerate} disabled={iterating}>
                            {iterating ? 'Regenerating…' : 'Regenerate →'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {costWarning && !costBlocked && <p className={styles.costWarn}>⚠ Session approaching €5 limit</p>}
              {costBlocked && (
                <p className={styles.costOver}>
                  ⛔ Session reached €10 limit
                  <button className={styles.overrideBtn} onClick={() => { setForceOverride(true); setCostBlocked(false); setError(''); }}>Admin override</button>
                </p>
              )}

              <button className={styles.resetLink} onClick={() => { setPhotoStates({}); setImprovingPosition(null); }} disabled={isWorking}>
                ← Change workflow / generate more
              </button>
            </>
          )}

          {/* ── Finalize ─────────────────────────────────────── */}
          {hasApproved && (
            <div className={styles.finalizeRow}>
              <button className={styles.finalizeBtn} onClick={finalize} disabled={isWorking}>
                Add approved photos to product →
              </button>
              <span className={styles.finalizeNote}>Session total: €{totalCost.toFixed(2)}</span>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

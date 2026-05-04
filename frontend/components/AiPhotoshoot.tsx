'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './AiPhotoshoot.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

const POSITIONS = ['front', 'side', 'detail', 'lifestyle'] as const;
type Position = typeof POSITIONS[number];

const POSITION_LABELS: Record<Position, string> = {
  front: 'Front',
  side: 'Side',
  detail: 'Detail',
  lifestyle: 'Lifestyle',
};

const QUICK_FEEDBACK = [
  'Different pose',
  'Brighter lighting',
  'Closer crop',
  'More elegant expression',
  'Show garment detail',
  'Different background',
];

const QUALITY_TIERS = {
  auto:     { label: 'Auto (position defaults)', estimatedCost: null },
  standard: { label: 'Standard (1K, ~€0.05)',    estimatedCost: 0.05 },
  hd:       { label: 'HD (2K, ~€0.13)',           estimatedCost: 0.13 },
  premium:  { label: 'Premium (4K, ~€0.24)',      estimatedCost: 0.24 },
};

type TierKey = keyof typeof QUALITY_TIERS;

type ModelSummary = {
  _id: string;
  name: string;
  heritage: string;
  referenceImageUrl: string;
  active: boolean;
};

type ValidationChecks = {
  resolution: boolean;
  fileSize: boolean;
  aspectRatio: boolean;
  notBlank: boolean;
};

type PhotoState = {
  url: string;
  status: 'pending' | 'approved';
  iterations: number;
  forReview?: boolean;
  validationPassed?: boolean;
  qualityTier?: TierKey;
  retryCount?: number;
  resolution?: { width: number; height: number };
  fileSize?: number;
  validationChecks?: ValidationChecks;
  hasFace?: boolean;
  identitySimilarity?: number | null;
  identityMatchStatus?: 'good' | 'warning' | 'drifted' | null;
};

type Props = {
  productId: string;
  productCategory: string;
  onPhotoApproved: (url: string) => void;
};

function fmtBytes(b: number) {
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(b / 1000)} KB`;
}

function ValidationStrip({ photo, modelName }: { photo: PhotoState; modelName?: string }) {
  if (!photo.resolution && !photo.validationChecks) return null;
  const { resolution, fileSize, validationChecks: vc, hasFace, identitySimilarity, identityMatchStatus: idm, qualityTier, retryCount } = photo;

  function chk(ok: boolean | undefined, label: string) {
    if (ok === undefined) return null;
    const cls = ok ? styles.vPass : styles.vFail;
    const icon = ok ? '✓' : '✗';
    return <span className={cls}>{icon} {label}</span>;
  }

  const idPct = identitySimilarity !== null && identitySimilarity !== undefined
    ? Math.round(identitySimilarity * 100)
    : null;
  const idCls = idm === 'good' ? styles.vPass : idm === 'warning' ? styles.vWarn : idm === 'drifted' ? styles.vFail : '';

  return (
    <div className={styles.validationStrip}>
      {resolution && (
        <span className={vc?.resolution ? styles.vPass : styles.vFail}>
          {vc?.resolution ? '✓' : '✗'} {resolution.width}×{resolution.height}
          {qualityTier && qualityTier !== 'auto' ? ` (${QUALITY_TIERS[qualityTier]?.label?.split(' ')[0]})` : ''}
        </span>
      )}
      {fileSize !== undefined && chk(vc?.fileSize, fmtBytes(fileSize))}
      {hasFace !== undefined && (
        <span className={hasFace ? styles.vPass : styles.vWarn}>
          {hasFace ? '✓ Face' : '⚠ No face'}
        </span>
      )}
      {idPct !== null && modelName && (
        <span className={idCls}>
          {idm === 'good' ? '✓' : idm === 'warning' ? '⚠' : '✗'} {modelName} {idPct}%
        </span>
      )}
      {!!retryCount && (
        <span className={styles.vRetry}>↺ {retryCount} {retryCount === 1 ? 'retry' : 'retries'}</span>
      )}
    </div>
  );
}

export default function AiPhotoshoot({ productId, productCategory, onPhotoApproved }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [suggestedModel, setSuggestedModel] = useState<ModelSummary | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [photoStates, setPhotoStates] = useState<Partial<Record<Position, PhotoState>>>({});
  const [totalCost, setTotalCost] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [improvingPosition, setImprovingPosition] = useState<Position | null>(null);
  const [improveFeedback, setImproveFeedback] = useState('');
  const [iterating, setIterating] = useState(false);
  const [costWarning, setCostWarning] = useState(false);
  const [costBlocked, setCostBlocked] = useState(false);
  const [forceOverride, setForceOverride] = useState(false);
  const [error, setError] = useState('');
  const [qualityTier, setQualityTier] = useState<TierKey>('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!expanded) return;
    fetch(`${API}/api/ai-models`)
      .then(r => (r.ok ? r.json() : []))
      .then((data: ModelSummary[]) => setModels(data.filter(m => m.active)))
      .catch(() => {});
  }, [expanded]);

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

  function removeUploadedPhoto(idx: number) {
    setUploadedPhotos(p => p.filter((_, i) => i !== idx));
  }

  function applyGenerateResult(results: { position: string; url?: string; error?: string; [key: string]: unknown }[]) {
    setPhotoStates(prev => {
      const next = { ...prev };
      for (const r of results) {
        if (r.url) {
          next[r.position as Position] = {
            url: r.url as string,
            status: 'pending',
            iterations: prev[r.position as Position]?.iterations || 0,
            forReview: r.forReview as boolean | undefined,
            validationPassed: r.validationPassed as boolean | undefined,
            qualityTier: r.qualityTier as TierKey | undefined,
            retryCount: r.retryCount as number | undefined,
            resolution: r.resolution as { width: number; height: number } | undefined,
            fileSize: r.fileSize as number | undefined,
            validationChecks: r.validationChecks as ValidationChecks | undefined,
            hasFace: r.hasFace as boolean | undefined,
            identitySimilarity: r.identitySimilarity as number | null | undefined,
            identityMatchStatus: r.identityMatchStatus as 'good' | 'warning' | 'drifted' | null | undefined,
          };
        }
      }
      return next;
    });
  }

  async function startGeneration() {
    if (uploadedPhotos.length === 0) {
      setError('Upload at least one product photo first.');
      return;
    }
    setError('');

    let sid = sessionId;

    if (!sid) {
      setCreatingSession(true);
      try {
        const res = await fetch(`${API}/api/ai-photos/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            productId,
            modelId: selectedModelId || undefined,
            inputPhotoUrls: uploadedPhotos,
          }),
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
      const res = await fetch(`${API}/api/ai-photos/sessions/${sid}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          positions: ['front', 'side', 'detail', 'lifestyle'],
          forceOverride,
          tier: qualityTier,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'SESSION_COST_LIMIT') {
          setCostBlocked(true);
          setTotalCost(data.totalCost);
          setError(data.message);
          return;
        }
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

  async function approvePhoto(position: Position) {
    if (!sessionId) return;
    const res = await fetch(`${API}/api/ai-photos/sessions/${sessionId}/approve-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ position }),
    });
    const data = await res.json();
    if (res.ok) {
      setPhotoStates(s => ({ ...s, [position]: { ...s[position]!, status: 'approved', forReview: false } }));
      onPhotoApproved(data.url);
    }
  }

  async function handleIterate() {
    if (!sessionId || !improvingPosition || !improveFeedback) return;
    setIterating(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/ai-photos/sessions/${sessionId}/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          position: improvingPosition,
          feedback: improveFeedback,
          forceOverride,
          tier: qualityTier === 'auto' ? undefined : qualityTier,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'SESSION_COST_LIMIT') {
          setCostBlocked(true);
          setTotalCost(data.totalCost);
          setError(data.message);
          return;
        }
        throw new Error(data.error);
      }

      setPhotoStates(s => ({
        ...s,
        [improvingPosition]: {
          url: data.url,
          status: 'pending',
          iterations: (s[improvingPosition]?.iterations || 0) + 1,
          forReview: data.forReview,
          validationPassed: data.validationPassed,
          qualityTier: data.qualityTier,
          retryCount: data.retryCount,
          resolution: data.resolution,
          fileSize: data.fileSize,
          validationChecks: data.validationChecks,
          hasFace: data.hasFace,
          identitySimilarity: data.identitySimilarity,
          identityMatchStatus: data.identityMatchStatus,
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

  async function finalize() {
    if (!sessionId) return;
    const res = await fetch(`${API}/api/ai-photos/sessions/${sessionId}/finalize`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) {
      onPhotoApproved(data.productImageUrl);
      let msg = `Done — ${data.approvedCount} approved photo(s) saved.`;
      if (data.costBreakdown) {
        msg += ` Total: €${(data.totalCost || 0).toFixed(2)}`;
        if (data.failedRetries > 0) {
          msg += ` (incl. €${(data.costBreakdown.retries || 0).toFixed(2)} in retries)`;
        }
      }
      alert(msg);
    } else {
      setError(data.error);
    }
  }

  const hasApproved = Object.values(photoStates).some(p => p?.status === 'approved');
  const hasPhotos = Object.keys(photoStates).length > 0;
  const isWorking = creatingSession || generating || iterating;

  // Estimated cost for current quality selection (4 positions)
  const tierCost = qualityTier === 'auto'
    ? null
    : (QUALITY_TIERS[qualityTier]?.estimatedCost ?? null);
  const estimatedTotal = tierCost !== null ? tierCost * 4 : null;

  return (
    <div className={styles.section}>
      <button className={styles.toggle} onClick={() => setExpanded(e => !e)}>
        <span>✨ AI Photoshoot</span>
        <span className={styles.toggleChevron}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className={styles.body}>

          {/* ── Upload zone ─────────────────────────────────── */}
          <div className={styles.uploadZone}>
            <p className={styles.uploadLabel}>Product photos <span className={styles.uploadHint}>(2–3 recommended — front, back, detail)</span></p>
            <div className={styles.thumbRow}>
              {uploadedPhotos.map((url, i) => (
                <div key={i} className={styles.thumb}>
                  <img src={url} alt="" className={styles.thumbImg} />
                  <button className={styles.thumbRemove} onClick={() => removeUploadedPhoto(i)} disabled={isWorking}>✕</button>
                </div>
              ))}
              {uploadedPhotos.length < 3 && (
                <button className={styles.uploadAdd} onClick={() => fileInputRef.current?.click()} disabled={isWorking}>
                  <span>+</span>
                  <span className={styles.uploadAddLabel}>Add photo</span>
                </button>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              ref={fileInputRef}
              className={styles.hiddenInput}
              onChange={handleUpload}
            />
          </div>

          {/* ── Model selector ───────────────────────────────── */}
          <div className={styles.modelRow}>
            <div className={styles.modelCard}>
              {suggestedModel?.referenceImageUrl ? (
                <img src={suggestedModel.referenceImageUrl} className={styles.modelThumb} alt={suggestedModel.name} />
              ) : (
                <div className={styles.modelThumbEmpty}>👤</div>
              )}
              <div>
                <p className={styles.modelName}>{suggestedModel?.name || 'Auto-select on generate'}</p>
                {suggestedModel?.heritage && <p className={styles.modelHeritage}>{suggestedModel.heritage}</p>}
              </div>
            </div>
            {models.length > 0 && (
              <div className={styles.overrideWrap}>
                <p className={styles.overrideLabel}>Override model</p>
                <select
                  className={styles.overrideSelect}
                  value={selectedModelId}
                  onChange={e => setSelectedModelId(e.target.value)}
                  disabled={!!sessionId || isWorking}
                >
                  <option value="">Auto-select</option>
                  {models.map(m => (
                    <option key={m._id} value={m._id}>{m.name} — {m.heritage}</option>
                  ))}
                </select>
                {sessionId && <p className={styles.overrideNote}>Model locked once session starts</p>}
              </div>
            )}
          </div>

          {/* ── Quality selector ─────────────────────────────── */}
          <div className={styles.qualityRow}>
            <div className={styles.qualityWrap}>
              <p className={styles.overrideLabel}>Quality</p>
              <select
                className={styles.qualitySelect}
                value={qualityTier}
                onChange={e => setQualityTier(e.target.value as TierKey)}
                disabled={isWorking}
              >
                {(Object.keys(QUALITY_TIERS) as TierKey[]).map(k => (
                  <option key={k} value={k}>{QUALITY_TIERS[k].label}</option>
                ))}
              </select>
            </div>
            {estimatedTotal !== null && (
              <p className={styles.qualityEstimate}>
                Estimated: €{estimatedTotal.toFixed(2)} for 4 shots
              </p>
            )}
          </div>

          {/* ── Generate row ─────────────────────────────────── */}
          <div className={styles.generateRow}>
            <button
              className={styles.generateBtn}
              onClick={startGeneration}
              disabled={isWorking || uploadedPhotos.length === 0 || (costBlocked && !forceOverride)}
            >
              {creatingSession
                ? 'Setting up session…'
                : generating
                ? 'Generating — this takes ~30–60 s…'
                : hasPhotos
                ? 'Regenerate all 4 positions'
                : estimatedTotal !== null
                ? `Generate (€${estimatedTotal.toFixed(2)})`
                : 'Generate photoshoot'}
            </button>
            <div className={styles.costInfo}>
              <span className={styles.costFigure}>€{totalCost.toFixed(2)}</span>
              <span className={styles.costLabel}>session cost</span>
              {costWarning && !costBlocked && <span className={styles.costWarn}>⚠ Approaching €5 limit</span>}
              {costBlocked && (
                <span className={styles.costOver}>
                  ⛔ €10 limit
                  <button className={styles.overrideBtn} onClick={() => { setForceOverride(true); setCostBlocked(false); setError(''); }}>
                    Admin override
                  </button>
                </span>
              )}
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          {/* ── Results grid ─────────────────────────────────── */}
          {hasPhotos && (
            <div className={styles.resultsGrid}>
              {POSITIONS.map(pos => {
                const photo = photoStates[pos];
                const isImproving = improvingPosition === pos;
                return (
                  <div key={pos} className={`${styles.resultCard} ${photo?.forReview ? styles.resultReview : photo?.status === 'approved' ? styles.resultApproved : ''}`}>
                    <div className={styles.resultHeader}>
                      <span className={styles.resultPos}>{POSITION_LABELS[pos]}</span>
                      {photo && photo.iterations > 0 && (
                        <span className={styles.iterBadge}>×{photo.iterations}</span>
                      )}
                      {photo?.status === 'approved' && <span className={styles.approvedMark}>✓</span>}
                    </div>

                    <div className={styles.resultImgWrap}>
                      {photo?.url ? (
                        <img src={photo.url} alt={`${pos} view`} className={styles.resultImg} />
                      ) : (
                        <div className={styles.resultPlaceholder}>Pending</div>
                      )}
                    </div>

                    {photo && (
                      <ValidationStrip photo={photo} modelName={suggestedModel?.name} />
                    )}

                    {photo?.forReview && (
                      <div className={styles.reviewBanner}>
                        ⚠ Failed validation — review before using
                      </div>
                    )}

                    {photo?.url && (
                      <div className={styles.resultActions}>
                        {photo.forReview ? (
                          <>
                            <button className={styles.useAnywayBtn} onClick={() => approvePhoto(pos)} disabled={isWorking}>
                              Use this image
                            </button>
                            <button
                              className={`${styles.improveBtn} ${isImproving ? styles.improveBtnActive : ''}`}
                              onClick={() => { setImprovingPosition(isImproving ? null : pos); setImproveFeedback(''); }}
                              disabled={isWorking}
                            >
                              ↺ Regenerate
                            </button>
                          </>
                        ) : photo.status === 'approved' ? (
                          <span className={styles.approvedLabel}>Approved</span>
                        ) : (
                          <>
                            <button className={styles.approveBtn} onClick={() => approvePhoto(pos)} disabled={isWorking}>
                              ✓ Approve
                            </button>
                            <button
                              className={`${styles.improveBtn} ${isImproving ? styles.improveBtnActive : ''}`}
                              onClick={() => { setImprovingPosition(isImproving ? null : pos); setImproveFeedback(''); }}
                              disabled={isWorking}
                            >
                              ↺ Improve
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {isImproving && (
                      <div className={styles.feedbackPanel}>
                        <div className={styles.quickTaps}>
                          {QUICK_FEEDBACK.map(fb => (
                            <button
                              key={fb}
                              className={`${styles.quickBtn} ${improveFeedback === fb ? styles.quickBtnActive : ''}`}
                              onClick={() => setImproveFeedback(fb)}
                            >
                              {fb}
                            </button>
                          ))}
                        </div>
                        <textarea
                          className={styles.customInput}
                          rows={2}
                          placeholder="Or type custom feedback…"
                          value={improveFeedback}
                          onChange={e => setImproveFeedback(e.target.value)}
                        />
                        <button
                          className={styles.regenerateBtn}
                          onClick={handleIterate}
                          disabled={iterating || !improveFeedback}
                        >
                          {iterating ? 'Regenerating…' : 'Regenerate →'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Finalize ─────────────────────────────────────── */}
          {hasApproved && (
            <div className={styles.finalizeRow}>
              <button className={styles.finalizeBtn} onClick={finalize} disabled={isWorking}>
                Add approved photos to product →
              </button>
              <span className={styles.finalizeNote}>Sets product main image to the approved front photo</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

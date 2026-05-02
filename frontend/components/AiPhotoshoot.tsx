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
};

type Props = {
  productId: string;
  productCategory: string;
  onPhotoApproved: (url: string) => void;
};

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

  async function startGeneration() {
    if (uploadedPhotos.length === 0) {
      setError('Upload at least one product photo first.');
      return;
    }
    setError('');

    let sid = sessionId;
    let model = suggestedModel;

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
        model = data.selectedModel;
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

      const newStates = { ...photoStates };
      for (const result of (data.results || [])) {
        newStates[result.position as Position] = { url: result.url, status: 'pending', iterations: 0 };
      }
      setPhotoStates(newStates);
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
      setPhotoStates(s => ({ ...s, [position]: { ...s[position]!, status: 'approved' } }));
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
        body: JSON.stringify({ position: improvingPosition, feedback: improveFeedback, forceOverride }),
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
      alert(`Done — ${data.approvedCount} approved photo(s) saved. Product image updated.`);
    } else {
      setError(data.error);
    }
  }

  const hasApproved = Object.values(photoStates).some(p => p?.status === 'approved');
  const hasPhotos = Object.keys(photoStates).length > 0;
  const isWorking = creatingSession || generating || iterating;

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
                  <div key={pos} className={`${styles.resultCard} ${photo?.status === 'approved' ? styles.resultApproved : ''}`}>
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

                    {photo?.url && (
                      <div className={styles.resultActions}>
                        {photo.status === 'approved' ? (
                          <span className={styles.approvedLabel}>Approved</span>
                        ) : (
                          <button className={styles.approveBtn} onClick={() => approvePhoto(pos)} disabled={isWorking}>
                            ✓ Approve
                          </button>
                        )}
                        <button
                          className={`${styles.improveBtn} ${isImproving ? styles.improveBtnActive : ''}`}
                          onClick={() => {
                            setImprovingPosition(isImproving ? null : pos);
                            setImproveFeedback('');
                          }}
                          disabled={isWorking}
                        >
                          ↺ Improve
                        </button>
                      </div>
                    )}

                    {/* Feedback panel inline below card */}
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

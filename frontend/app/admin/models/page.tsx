'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type AiModel = {
  _id: string;
  name: string;
  heritage: string;
  description: string;
  prompt: string;
  referenceImageUrl: string;
  useCases: string[];
  market: string[];
  active: boolean;
  locked: boolean;
};

const BLANK: Omit<AiModel, '_id'> = {
  name: '', heritage: '', description: '', prompt: '',
  referenceImageUrl: '', useCases: [], market: [],
  active: true, locked: false,
};

const USE_CASE_OPTIONS = ['shorts', 'dresses', 'robes', 'shirts', 'scarves', 'lingerie', 'sleepwear', 'accessories'];
const MARKET_OPTIONS = ['IE', 'GB', 'EU', 'US', 'CA', 'AU'];

export default function ModelsPage() {
  const [models, setModels] = useState<AiModel[]>([]);
  const [editing, setEditing] = useState<Partial<AiModel> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [genCost, setGenCost] = useState(0);

  async function load() {
    const res = await fetch(`${API}/api/ai-models`, { credentials: 'include' });
    if (res.ok) setModels(await res.json());
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing({ ...BLANK });
    setIsNew(true);
  }

  function openEdit(m: AiModel) {
    setEditing({ ...m });
    setIsNew(false);
  }

  function closeModal() {
    setEditing(null);
    setIsNew(false);
  }

  function setField(field: string, value: string | boolean | string[]) {
    setEditing(e => e ? { ...e, [field]: value } : e);
  }

  function toggleArrayField(field: 'useCases' | 'market', value: string) {
    setEditing(e => {
      if (!e) return e;
      const arr = (e[field] as string[]) || [];
      return { ...e, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? `${API}/api/ai-models` : `${API}/api/ai-models/${editing._id}`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editing),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
      closeModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this model? This cannot be undone.')) return;
    await fetch(`${API}/api/ai-models/${id}`, { method: 'DELETE', credentials: 'include' });
    await load();
  }

  async function handleToggleLock(model: AiModel) {
    await fetch(`${API}/api/ai-models/${model._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ locked: !model.locked }),
    });
    await load();
  }

  async function handleToggleActive(model: AiModel) {
    await fetch(`${API}/api/ai-models/${model._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ active: !model.active }),
    });
    await load();
  }

  async function handleGenerateReference(model: AiModel) {
    if (model.locked) return alert('Unlock the model before regenerating.');
    if (!confirm(`Generate a new reference photo for "${model.name}"? This will cost approximately €0.05.`)) return;
    setGeneratingId(model._id);
    try {
      const res = await fetch(`${API}/api/ai-models/${model._id}/generate-reference`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGenCost(c => c + (data.cost || 0.05));
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <AdminLayout active="models">
      <div className={styles.header}>
        <h2>AI Models</h2>
        <div className={styles.headerRight}>
          {genCost > 0 && <span className={styles.costBadge}>Session cost: €{genCost.toFixed(2)}</span>}
          <button className={styles.addBtn} onClick={openNew}>+ Add model</button>
        </div>
      </div>

      <div className={styles.grid}>
        {models.map(model => (
          <div key={model._id} className={`${styles.card} ${!model.active ? styles.cardInactive : ''}`}>
            <div className={styles.cardPhoto}>
              {model.referenceImageUrl ? (
                <img src={model.referenceImageUrl} alt={model.name} className={styles.refImg} />
              ) : (
                <div className={styles.noPhoto}>No reference photo</div>
              )}
              <div className={styles.cardBadges}>
                {model.locked && <span className={styles.badge}>🔒 Locked</span>}
                {!model.active && <span className={`${styles.badge} ${styles.badgeInactive}`}>Inactive</span>}
              </div>
            </div>
            <div className={styles.cardBody}>
              <h3 className={styles.modelName}>{model.name}</h3>
              {model.heritage && <p className={styles.modelHeritage}>{model.heritage}</p>}
              {model.useCases.length > 0 && (
                <p className={styles.useCases}>{model.useCases.join(' · ')}</p>
              )}
            </div>
            <div className={styles.cardActions}>
              <button
                className={styles.actionBtn}
                onClick={() => handleGenerateReference(model)}
                disabled={generatingId === model._id}
              >
                {generatingId === model._id ? 'Generating…' : '✨ Reference photo'}
              </button>
              <div className={styles.actionRow}>
                <button className={styles.editBtn} onClick={() => openEdit(model)}>Edit</button>
                <button
                  className={styles.lockBtn}
                  onClick={() => handleToggleLock(model)}
                  title={model.locked ? 'Unlock model' : 'Lock model'}
                >
                  {model.locked ? '🔓' : '🔒'}
                </button>
                <button
                  className={styles.activeBtn}
                  onClick={() => handleToggleActive(model)}
                  title={model.active ? 'Deactivate' : 'Activate'}
                >
                  {model.active ? 'Active' : 'Inactive'}
                </button>
                <button className={styles.deleteBtn} onClick={() => handleDelete(model._id)}>✕</button>
              </div>
            </div>
          </div>
        ))}
        {models.length === 0 && (
          <p className={styles.empty}>No AI models yet. Add your first brand model to get started.</p>
        )}
      </div>

      {editing && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{isNew ? 'Add AI model' : `Edit — ${editing.name}`}</h3>
              <button className={styles.modalClose} onClick={closeModal}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Name <span className={styles.req}>*</span></label>
                  <input value={editing.name || ''} onChange={e => setField('name', e.target.value)} placeholder="e.g. Aoife" />
                </div>
                <div className={styles.field}>
                  <label>Heritage</label>
                  <input value={editing.heritage || ''} onChange={e => setField('heritage', e.target.value)} placeholder="e.g. Irish-Nigerian" />
                </div>
              </div>

              <div className={styles.field}>
                <label>Description</label>
                <input value={editing.description || ''} onChange={e => setField('description', e.target.value)} placeholder="Brief description of the model's look and feel" />
              </div>

              <div className={styles.field}>
                <label>Prompt <span className={styles.req}>*</span></label>
                <textarea
                  rows={4}
                  value={editing.prompt || ''}
                  onChange={e => setField('prompt', e.target.value)}
                  placeholder="The locked text description used in every generation. Be specific: age, features, tone, hair, expression…"
                />
                <span className={styles.hint}>This is sent verbatim to Gemini. The more specific, the more consistent your results.</span>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Use cases</label>
                  <div className={styles.checkGroup}>
                    {USE_CASE_OPTIONS.map(uc => (
                      <label key={uc} className={styles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={(editing.useCases || []).includes(uc)}
                          onChange={() => toggleArrayField('useCases', uc)}
                        />
                        {uc}
                      </label>
                    ))}
                  </div>
                </div>
                <div className={styles.field}>
                  <label>Markets</label>
                  <div className={styles.checkGroup}>
                    {MARKET_OPTIONS.map(m => (
                      <label key={m} className={styles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={(editing.market || []).includes(m)}
                          onChange={() => toggleArrayField('market', m)}
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.toggleLabel}>
                  <input type="checkbox" checked={!!editing.active} onChange={e => setField('active', e.target.checked)} />
                  Active (available for photoshoots)
                </label>
                <label className={styles.toggleLabel}>
                  <input type="checkbox" checked={!!editing.locked} onChange={e => setField('locked', e.target.checked)} />
                  Locked (prevent prompt changes)
                </label>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={closeModal}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !editing.name || !editing.prompt}>
                {saving ? 'Saving…' : isNew ? 'Create model' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

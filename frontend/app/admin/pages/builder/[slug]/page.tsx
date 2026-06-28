'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';
import BlockRenderer, { BLOCK_DEFS, BLOCK_BY_TYPE, type Block, type FieldDef } from '@/components/blocks/BlockRenderer';

const API = process.env.NEXT_PUBLIC_API_URL;
const dark = 'var(--dark, #2a2218)';
const muted = 'var(--muted, #8a8680)';
const border = '1px solid var(--border, #e8e2d6)';
const serif = "'Cormorant Garamond', Georgia, serif";

function uid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `b_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
}

export default function PageBuilder({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/page-builder/${slug}`, { credentials: 'include' });
      const d = await res.json();
      setBlocks(Array.isArray(d.blocks) ? d.blocks : []);
      setStatus(d.status === 'published' ? 'published' : 'draft');
    } catch { /* empty */ } finally { setLoading(false); }
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  const selected = blocks.find(b => b.id === selectedId) || null;

  function addBlock(type: string) {
    const def = BLOCK_BY_TYPE[type];
    if (!def) return;
    const block: Block = { id: uid(), type, props: { ...def.defaultProps } };
    setBlocks(bs => {
      const idx = selectedId ? bs.findIndex(b => b.id === selectedId) : bs.length - 1;
      const at = idx >= 0 ? idx + 1 : bs.length;
      return [...bs.slice(0, at), block, ...bs.slice(at)];
    });
    setSelectedId(block.id);
  }
  function updateProp(key: string, value: unknown) {
    setBlocks(bs => bs.map(b => b.id === selectedId ? { ...b, props: { ...b.props, [key]: value } } : b));
  }
  function move(id: string, dir: -1 | 1) {
    setBlocks(bs => {
      const i = bs.findIndex(b => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function remove(id: string) {
    setBlocks(bs => bs.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  async function save(publish: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/page-builder/${slug}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks, status: publish ? 'published' : status }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      if (publish) setStatus('published');
      toast(publish ? 'Published — your live page now uses this layout.' : 'Draft saved.', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally { setSaving(false); }
  }

  async function uploadImage(file: File, key: string) {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`${API}/api/admin/page-builder/upload`, { method: 'POST', credentials: 'include', body: fd });
    if (!res.ok) { toast('Upload failed', 'error'); return; }
    const d = await res.json();
    updateProp(key, d.url);
  }

  return (
    <AdminLayout active="pages">
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 0px)' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderBottom: border, background: 'var(--warm-white,#faf8f4)' }}>
          <Link href="/admin/pages" style={{ fontSize: 13, color: muted, textDecoration: 'none' }}>← Pages</Link>
          <h1 style={{ fontFamily: serif, fontSize: 22, fontWeight: 300, color: dark, margin: 0, textTransform: 'capitalize' }}>{slug} — Page builder</h1>
          <span style={{ fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', color: status === 'published' ? '#5a8f3d' : muted, border, padding: '2px 8px' }}>{status}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: muted }}>View page ↗</a>
            <button onClick={() => save(false)} disabled={saving} style={{ padding: '9px 16px', background: 'white', color: dark, border, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Save draft</button>
            <button onClick={() => save(true)} disabled={saving} style={{ padding: '9px 18px', background: dark, color: '#faf8f4', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase' }}>{saving ? '…' : 'Publish'}</button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Canvas */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
            {loading ? <p style={{ padding: 40, color: muted }}>Loading…</p>
              : blocks.length === 0 ? (
                <div style={{ padding: 80, textAlign: 'center', color: muted }}>
                  <p style={{ fontSize: 15 }}>Empty page. Add a block from the right to begin.</p>
                </div>
              ) : blocks.map(b => {
                const isSel = b.id === selectedId;
                return (
                  <div key={b.id} onClick={() => setSelectedId(b.id)} style={{ position: 'relative', outline: isSel ? `2px solid ${dark}` : '2px solid transparent', cursor: 'pointer' }}>
                    {/* hover/selected controls */}
                    <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 5, display: isSel ? 'flex' : 'none', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => move(b.id, -1)} title="Move up" style={ctl}>↑</button>
                      <button onClick={() => move(b.id, 1)} title="Move down" style={ctl}>↓</button>
                      <button onClick={() => remove(b.id)} title="Delete" style={{ ...ctl, color: '#c0392b' }}>✕</button>
                    </div>
                    <div style={{ padding: b.type === 'hero' ? 0 : '32px 0', pointerEvents: 'none' }}>
                      {BLOCK_BY_TYPE[b.type]?.render(b.props || {})}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Side panel */}
          <aside style={{ width: 320, borderLeft: border, background: 'var(--warm-white,#faf8f4)', overflowY: 'auto', padding: '18px 18px 60px' }}>
            <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: muted, margin: '0 0 10px' }}>Add block</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
              {BLOCK_DEFS.map(d => (
                <button key={d.type} onClick={() => addBlock(d.type)} style={{ padding: '10px 8px', border, background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: dark }}>+ {d.label}</button>
              ))}
            </div>

            {selected ? (
              <>
                <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: muted, margin: '0 0 10px' }}>Edit · {BLOCK_BY_TYPE[selected.type]?.label}</p>
                {BLOCK_BY_TYPE[selected.type]?.fields.map((f: FieldDef) => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: muted, display: 'block', marginBottom: 4 }}>{f.label}</label>
                    {f.kind === 'textarea' ? (
                      <textarea value={String(selected.props[f.key] ?? '')} onChange={e => updateProp(f.key, e.target.value)} rows={4} style={inp} />
                    ) : f.kind === 'select' ? (
                      <select value={String(selected.props[f.key] ?? '')} onChange={e => updateProp(f.key, e.target.value)} style={inp}>
                        {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : f.kind === 'image' ? (
                      <div>
                        {selected.props[f.key] ? <img src={String(selected.props[f.key])} alt="" style={{ width: '100%', borderRadius: 3, marginBottom: 6, display: 'block' }} /> : null}
                        <input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) uploadImage(file, f.key); e.target.value = ''; }} style={{ fontSize: 12 }} />
                        {selected.props[f.key] ? <button onClick={() => updateProp(f.key, '')} style={{ display: 'block', marginTop: 6, fontSize: 11, color: muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Remove image</button> : null}
                      </div>
                    ) : (
                      <input type="text" value={String(selected.props[f.key] ?? '')} onChange={e => updateProp(f.key, e.target.value)} style={inp} />
                    )}
                  </div>
                ))}
              </>
            ) : (
              <p style={{ fontSize: 12.5, color: muted, lineHeight: 1.6 }}>Click a block on the page to edit it, or add a new one above.</p>
            )}
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}

const ctl: React.CSSProperties = { width: 26, height: 26, border: '1px solid #ddd', background: 'rgba(255,255,255,0.95)', cursor: 'pointer', fontSize: 13, lineHeight: 1, color: '#2a2218' };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #e8e2d6', background: 'white', fontFamily: 'inherit', fontSize: 13, color: '#2a2218', boxSizing: 'border-box' };

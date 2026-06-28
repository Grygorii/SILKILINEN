'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL;

// ── In-page (WYSIWYG) editing ─────────────────────────────────────────────────
// The real storefront page renders normally. When a logged-in admin opens it with
// ?edit=1, an edit layer activates: editable text/images light up and can be
// changed in place, saving to the same SiteContent keys. No iframe, no rebuild —
// you edit the actual page.

const Ctx = createContext<{ editing: boolean }>({ editing: false });
export const useInlineEdit = () => useContext(Ctx);

export function InlineEditProvider({ children }: { children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('edit') !== '1') return;
    // Only real admins get the edit layer (saves are admin-gated server-side too).
    fetch(`${API}/api/auth/me`, { credentials: 'include' })
      .then(r => { if (r.ok) setEditing(true); })
      .catch(() => {});
  }, []);
  return (
    <Ctx.Provider value={{ editing }}>
      {children}
      {editing && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, background: '#2a2218', color: '#faf8f4', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, fontFamily: 'Helvetica, Arial, sans-serif' }}>
          <strong style={{ letterSpacing: '0.5px' }}>Editing this page</strong>
          <span style={{ opacity: 0.8 }}>Click any highlighted text or image to change it — it saves instantly.</span>
          <button onClick={() => { window.location.href = window.location.pathname; }} style={{ marginLeft: 'auto', background: '#faf8f4', color: '#2a2218', border: 'none', padding: '7px 16px', cursor: 'pointer', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase' }}>Done</button>
        </div>
      )}
    </Ctx.Provider>
  );
}

const OUTLINE = '1px dashed rgba(180,140,70,0.9)';
async function putContent(key: string, value: string) {
  const r = await fetch(`${API}/api/content/${key}`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  if (!r.ok) throw new Error('save failed');
}

// Editable text — renders `value` in the given element; in edit mode, click to
// edit it in place (inherits the surrounding styling), saves on blur/Enter.
// `href` is forwarded when `as="a"` so a real link keeps working when not editing
// (and is suppressed while editing so the click opens the editor instead).
export function EditableText({
  contentKey, value, as = 'span', className, multiline = false, href, style,
}: { contentKey: string; value: string; as?: React.ElementType; className?: string; multiline?: boolean; href?: string; style?: React.CSSProperties }) {
  const { editing } = useInlineEdit();
  const [v, setV] = useState(value);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setV(value); }, [value]);

  const Tag = as as React.ElementType;
  const anchor = as === 'a' && href ? { href } : {};
  if (!editing) return <Tag className={className} style={style} {...anchor}>{v}</Tag>;

  async function commit() {
    setSaving(true);
    try {
      await putContent(contentKey, draft);
      setV(draft);
      setOpen(false);
    } catch {
      alert('Could not save your change — please try again.'); // keep the editor open
    } finally {
      setSaving(false);
    }
  }

  if (open) {
    const field = multiline
      ? <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)} rows={5} style={{ font: 'inherit', color: 'inherit', width: '100%', background: 'rgba(255,255,255,0.95)', border: '1px solid #c0a060', padding: 6, boxSizing: 'border-box' }} />
      : <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setOpen(false); }} style={{ font: 'inherit', color: 'inherit', width: '100%', background: 'rgba(255,255,255,0.95)', border: '1px solid #c0a060', padding: '2px 6px', boxSizing: 'border-box' }} />;
    return (
      <Tag className={className}>
        {field}
        <span style={{ display: 'block', marginTop: 6 }}>
          <button onClick={commit} disabled={saving} style={btn(true)}>{saving ? '…' : 'Save'}</button>
          <button onClick={() => setOpen(false)} style={btn(false)}>Cancel</button>
        </span>
      </Tag>
    );
  }
  return (
    <Tag className={className} onClick={(e: React.MouseEvent) => { e.preventDefault(); setDraft(v); setOpen(true); }} title="Click to edit" style={{ ...style, outline: OUTLINE, outlineOffset: 3, cursor: 'pointer' }}>
      {v}
    </Tag>
  );
}

function btn(primary: boolean): React.CSSProperties {
  return { font: '12px Helvetica, Arial, sans-serif', letterSpacing: '0.5px', padding: '5px 12px', marginRight: 6, cursor: 'pointer', border: 'none', background: primary ? '#2a2218' : 'transparent', color: primary ? '#faf8f4' : '#8a8680' };
}

// Editable image — in edit mode, an overlay "Change photo" button lets you upload
// a new one, saving to the same content key. Renders children unchanged (no extra
// wrapper) so `<Image fill>` keeps the existing section as its positioning
// context; the overlay button is absolutely positioned against that same section
// (the storefront hero / story columns are already `position: relative`).
export function EditableImage({
  contentKey, section = 'homepage', children,
}: { contentKey: string; section?: string; children: React.ReactNode }) {
  const { editing } = useInlineEdit();
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  if (!editing) return <>{children}</>;

  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const up = await fetch(`${API}/api/content/upload?section=${section}&key=${contentKey}`, { method: 'POST', credentials: 'include', body: fd });
      if (!up.ok) throw new Error();
      const { url } = await up.json();
      await putContent(contentKey, url);
      window.location.reload(); // simplest reliable way to reflect the new image
    } catch {
      alert('Could not upload that image — please try again.');
    } finally { setUploading(false); }
  }

  return (
    <>
      {children}
      <button onClick={() => ref.current?.click()} disabled={uploading} style={{ position: 'absolute', top: 14, left: 14, zIndex: 6, background: 'rgba(42,34,24,0.92)', color: '#faf8f4', border: OUTLINE, padding: '8px 15px', cursor: 'pointer', fontSize: 12, letterSpacing: '0.5px' }}>
        {uploading ? 'Uploading…' : '↑ Change photo'}
      </button>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
    </>
  );
}

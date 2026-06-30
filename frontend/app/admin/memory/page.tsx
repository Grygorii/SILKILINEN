'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';

const API = process.env.NEXT_PUBLIC_API_URL;

type Entry = { _id: string; kind: 'lesson' | 'pitfall' | 'fact' | 'decision'; text: string; detail?: string; source?: string; weight: number; hits: number };
type Stats = { counts: { total: number; lesson: number; pitfall: number; fact: number; decision: number }; top: Entry[] };
type Ref = { _id: string; title?: string; refType?: string; refSource?: string; text: string; tags?: string[] };

const dark = 'var(--dark, #2a2218)';
const muted = 'var(--muted, #8a8680)';
const border = '1px solid var(--border, #e8e2d6)';
const serif = "'Cormorant Garamond', Georgia, serif";

const KIND = {
  lesson:   { label: 'What works', color: '#2d7d47', bg: '#e8f5e9' },
  pitfall:  { label: 'Avoid (we got it wrong)', color: '#b03a2e', bg: '#fdf3f1' },
  fact:     { label: 'Verified fact', color: '#3a6ea5', bg: '#eef3f8' },
  decision: { label: 'Decision to honour', color: '#b8863b', bg: '#fbf3e7' },
} as const;

export default function MemoryPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'decision' | 'fact'>('decision');

  // Library state
  const [refs, setRefs] = useState<Ref[]>([]);
  const [refMode, setRefMode] = useState<'link' | 'book'>('link');
  const [url, setUrl] = useState('');
  const [refTitle, setRefTitle] = useState('');
  const [refAuthor, setRefAuthor] = useState('');
  const [refText, setRefText] = useState('');
  const [refTags, setRefTags] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [savingRef, setSavingRef] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/memory`, { credentials: 'include' });
      const data = await res.json();
      if (data?.counts) setStats(data);
    } catch { /* ignore */ }
  }, []);
  const loadRefs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/memory/library`, { credentials: 'include' });
      const data = await res.json();
      if (Array.isArray(data)) setRefs(data);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); loadRefs(); }, [load, loadRefs]);

  async function summarize() {
    if (!url.trim()) return;
    setSummarizing(true);
    try {
      const res = await fetch(`${API}/api/admin/memory/library/summarize`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not summarize');
      setRefTitle(data.title || '');
      setRefText(data.text || '');
      setRefTags((data.tags || []).join(', '));
      toast('Distilled — edit the principles, then save.', 'success');
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not summarize', 'error'); }
    finally { setSummarizing(false); }
  }

  async function saveRef() {
    if (!refText.trim()) { toast('Add the key principles for the agents to apply.', 'error'); return; }
    setSavingRef(true);
    try {
      const refSource = refMode === 'link' ? url.trim() : refAuthor.trim();
      const res = await fetch(`${API}/api/admin/memory/library`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: refTitle.trim(), refType: refMode, refSource, text: refText.trim(), tags: refTags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setUrl(''); setRefTitle(''); setRefAuthor(''); setRefText(''); setRefTags('');
      loadRefs(); toast('Saved to the library — the agents will use it.', 'success');
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not save', 'error'); }
    finally { setSavingRef(false); }
  }

  async function removeRef(id: string) {
    if (!confirm('Remove this reference from the library?')) return;
    try {
      await fetch(`${API}/api/admin/memory/library/${id}`, { method: 'DELETE', credentials: 'include' });
      loadRefs();
    } catch { /* ignore */ }
  }

  async function teach() {
    if (!text.trim()) return;
    try {
      const res = await fetch(`${API}/api/admin/memory`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, text: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add');
      setText(''); load(); toast('Archivarius will remember that.', 'success');
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not add', 'error'); }
  }

  const c = stats?.counts;
  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 920 }}>
        <h1 style={{ fontFamily: serif, fontSize: 28, fontWeight: 300, color: dark, margin: 0, letterSpacing: '1px' }}>Archivarius</h1>
        <p style={{ fontSize: 13, color: muted, marginTop: 6, marginBottom: 22, fontStyle: 'italic' }}>
          The house&rsquo;s living memory. The team feeds it; it reinforces what recurs and feeds back wins, mistakes-to-avoid, and verified facts — so the agents get wiser and stop repeating errors.
        </p>

        {c && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
            {[['total', 'Memories'], ['lesson', 'Lessons'], ['pitfall', 'Pitfalls'], ['fact', 'Facts'], ['decision', 'Decisions']].map(([k, lbl]) => (
              <div key={k} style={{ border, padding: '12px 18px', minWidth: 96 }}>
                <div style={{ fontFamily: serif, fontSize: 26, color: dark }}>{c[k as keyof typeof c]}</div>
                <div style={{ fontSize: 11, color: muted, letterSpacing: '0.5px' }}>{lbl}</div>
              </div>
            ))}
          </div>
        )}

        {/* Teach it */}
        <div style={{ background: 'white', border, padding: '16px 18px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={kind} onChange={e => setKind(e.target.value as 'decision' | 'fact')} style={{ padding: '9px 10px', border, fontFamily: 'inherit', fontSize: 13 }}>
            <option value="decision">Decision to honour</option>
            <option value="fact">Verified fact</option>
          </select>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && teach()}
            placeholder="Teach Archivarius — e.g. “Origin is mixed; never claim made-in-Ireland”"
            style={{ flex: 1, minWidth: 260, padding: '9px 12px', border, fontFamily: 'inherit', fontSize: 13.5, color: dark }} />
          <button onClick={teach} style={{ padding: '9px 18px', background: dark, color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Remember</button>
        </div>

        {/* The strongest memory */}
        {stats?.top && stats.top.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {stats.top.map(e => {
              const k = KIND[e.kind];
              return (
                <div key={e._id} style={{ border, borderLeft: `3px solid ${k.color}`, padding: '10px 14px', background: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 13.5, color: dark }}>{e.text}</span>
                    <span style={{ fontSize: 10, color: k.color, background: k.bg, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap', height: 'fit-content' }}>{k.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>
                    {e.source ? `from ${e.source} · ` : ''}reinforced ×{e.hits}{e.weight > e.hits ? ` · weight ${e.weight}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: muted }}>No memory yet — it fills as the agents run and the clerks catch things. Teach it a fact or decision above to start.</p>
        )}

        {/* ── Library ── */}
        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: serif, fontSize: 22, fontWeight: 300, color: dark, margin: '0 0 4px', letterSpacing: '0.5px' }}>Library</h2>
          <p style={{ fontSize: 13, color: muted, margin: '0 0 16px', fontStyle: 'italic' }}>
            Curate the sources the agents learn from — paste a link (we distil it into principles) or add a book with your key takeaways. Tagged references flow into the relevant agents&rsquo; reasoning.
          </p>

          <div style={{ background: 'white', border, padding: '16px 18px', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['link', 'book'] as const).map(m => (
                <button key={m} onClick={() => setRefMode(m)} style={{ padding: '7px 16px', border, background: refMode === m ? dark : 'white', color: refMode === m ? 'white' : muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, textTransform: 'capitalize' }}>{m}</button>
              ))}
            </div>

            {refMode === 'link' ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste a URL — e.g. the Google SEO Starter Guide"
                    style={{ flex: 1, minWidth: 260, padding: '9px 12px', border, fontFamily: 'inherit', fontSize: 13.5, color: dark }} />
                  <button onClick={summarize} disabled={summarizing || !url.trim()} style={{ padding: '9px 16px', background: '#b8863b', color: 'white', border: 'none', cursor: summarizing || !url.trim() ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, opacity: summarizing || !url.trim() ? 0.6 : 1 }}>{summarizing ? 'Distilling…' : '✦ Distil with AI'}</button>
                </div>
                <input value={refTitle} onChange={e => setRefTitle(e.target.value)} placeholder="Source name (auto-filled)"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border, fontFamily: 'inherit', fontSize: 13.5, color: dark, marginBottom: 10 }} />
              </>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <input value={refTitle} onChange={e => setRefTitle(e.target.value)} placeholder="Book title"
                  style={{ flex: 2, minWidth: 200, padding: '9px 12px', border, fontFamily: 'inherit', fontSize: 13.5, color: dark }} />
                <input value={refAuthor} onChange={e => setRefAuthor(e.target.value)} placeholder="Author"
                  style={{ flex: 1, minWidth: 140, padding: '9px 12px', border, fontFamily: 'inherit', fontSize: 13.5, color: dark }} />
              </div>
            )}

            <textarea value={refText} onChange={e => setRefText(e.target.value)} rows={4}
              placeholder={refMode === 'link' ? 'Key principles the agents should apply (auto-filled — edit freely)' : 'Your key takeaways — the principles agents should apply from this book'}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border, fontFamily: 'inherit', fontSize: 13, color: dark, resize: 'vertical', marginBottom: 10, lineHeight: 1.6 }} />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={refTags} onChange={e => setRefTags(e.target.value)} placeholder="Tags (comma separated): seo, content, imagery…"
                style={{ flex: 1, minWidth: 200, padding: '9px 12px', border, fontFamily: 'inherit', fontSize: 13, color: dark }} />
              <button onClick={saveRef} disabled={savingRef} style={{ padding: '9px 20px', background: dark, color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>{savingRef ? 'Saving…' : 'Add to library'}</button>
            </div>
          </div>

          {refs.length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {refs.map(r => (
                <div key={r._id} style={{ border, borderLeft: '3px solid #b8863b', padding: '12px 14px', background: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 14, color: dark, fontWeight: 500 }}>
                      {r.title || (r.refType === 'book' ? 'Book' : 'Link')}
                      <span style={{ fontSize: 10, color: muted, marginLeft: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{r.refType}</span>
                    </span>
                    <button onClick={() => removeRef(r._id)} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: 12 }}>Remove</button>
                  </div>
                  {r.refSource && (
                    <div style={{ fontSize: 11.5, color: muted, marginTop: 2, wordBreak: 'break-all' }}>
                      {r.refType === 'link' && /^https?:/.test(r.refSource)
                        ? <a href={r.refSource} target="_blank" rel="noopener noreferrer" style={{ color: '#3a6ea5' }}>{r.refSource}</a>
                        : r.refSource}
                    </div>
                  )}
                  <p style={{ fontSize: 13, color: '#4f4a42', margin: '8px 0 0', lineHeight: 1.6 }}>{r.text}</p>
                  {r.tags && r.tags.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {r.tags.map((t, i) => <span key={i} style={{ fontSize: 10, color: muted, border, padding: '2px 8px', borderRadius: 10 }}>{t}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: muted }}>No references yet — add a link or a book above and the agents will start applying it.</p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TiptapLink from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Underline from '@tiptap/extension-underline';
import Typography from '@tiptap/extension-typography';

const API = process.env.NEXT_PUBLIC_API_URL;

type Article = {
  _id: string; title: string; slug: string; excerpt: string; body: string;
  heroImage: { url: string; alt: string; caption: string };
  author: string; status: 'draft' | 'preview' | 'published';
  publishedAt: string | null; scheduledFor: string | null;
  metaTitle: string; metaDescription: string; keywords: string[];
  readingTimeMinutes: number | null; viewCount: number; updatedAt: string;
};

const STATUS_COLORS = {
  draft: { bg: '#f3f3f3', color: '#555' },
  preview: { bg: '#ede7f6', color: '#5c35a8' },
  published: { bg: '#e8f5e9', color: '#2d7d47' },
};

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export default function JournalEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [seoForm, setSeoForm] = useState({ slug: '', metaTitle: '', metaDescription: '', keywords: '', author: 'Sabreen' });
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const excerptRef = useRef<HTMLDivElement>(null);
  const heroFileRef = useRef<HTMLInputElement>(null);
  const inlineImageRef = useRef<HTMLInputElement>(null);
  const [uploadingHero, setUploadingHero] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Typography,
      TiptapLink.configure({ openOnClick: false }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
      CharacterCount,
    ],
    content: '',
    onUpdate: () => {
      scheduleAutosave();
    },
  });

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => doAutosave(), 3000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doAutosave = useCallback(async () => {
    if (!editor) return;
    setSaving(true);
    await fetch(`${API}/api/admin/journal/${id}/autosave`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, excerpt, body: editor.getHTML() }),
    });
    setSavedAt(new Date());
    setSaving(false);
  }, [editor, id, title, excerpt]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${API}/api/admin/journal/${id}`, { credentials: 'include' });
      const data: Article = await res.json();
      setArticle(data);
      setTitle(data.title || '');
      setExcerpt(data.excerpt || '');
      setSeoForm({
        slug: data.slug || '',
        metaTitle: data.metaTitle || '',
        metaDescription: data.metaDescription || '',
        keywords: (data.keywords || []).join(', '),
        author: data.author || 'Sabreen',
      });
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (editor && article?.body !== undefined) {
      editor.commands.setContent(article.body || '');
    }
  }, [editor, article]);

  // Sync title/excerpt contentEditable divs from article state (skip if user is actively typing)
  useEffect(() => {
    if (!article) return;
    if (titleRef.current && document.activeElement !== titleRef.current) {
      titleRef.current.textContent = article.title || '';
    }
    if (excerptRef.current && document.activeElement !== excerptRef.current) {
      excerptRef.current.textContent = article.excerpt || '';
    }
  }, [article]);

  async function handleHeroUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHero(true);
    const form = new FormData();
    form.append('file', file);
    const uploadRes = await fetch(`${API}/api/admin/journal/upload`, {
      method: 'POST', credentials: 'include', body: form,
    });
    const { url } = await uploadRes.json();
    await fetch(`${API}/api/admin/journal/${id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heroImage: { url, alt: title, caption: '' } }),
    });
    setArticle(a => a ? { ...a, heroImage: { url, alt: title, caption: '' } } : a);
    setUploadingHero(false);
  }

  async function handleInlineImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const uploadRes = await fetch(`${API}/api/admin/journal/upload`, {
      method: 'POST', credentials: 'include', body: form,
    });
    const { url } = await uploadRes.json();
    editor?.chain().focus().setImage({ src: url }).run();
    if (inlineImageRef.current) inlineImageRef.current.value = '';
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        doAutosave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [doAutosave]);

  async function save(status?: string) {
    if (!editor) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      title, excerpt, body: editor.getHTML(),
      slug: seoForm.slug, metaTitle: seoForm.metaTitle,
      metaDescription: seoForm.metaDescription,
      keywords: seoForm.keywords.split(',').map(k => k.trim()).filter(Boolean),
      author: seoForm.author,
    };
    if (status) body.status = status;
    const res = await fetch(`${API}/api/admin/journal/${id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setArticle(data);
    setSavedAt(new Date());
    setSaving(false);
  }

  async function openPreview() {
    await save('preview');
    const res = await fetch(`${API}/api/admin/journal/${id}/preview-token`, { credentials: 'include' });
    const { token } = await res.json();
    window.open(`/journal/preview?token=${token}`, '_blank');
  }

  async function publish() {
    if (!confirm('Publish this article? It will be visible on the live site.')) return;
    await save('published');
    setJustPublished(true);
  }

  async function unpublish() {
    await save('draft');
    setJustPublished(false);
  }

  if (loading || !article) {
    return (
      <AdminLayout>
        <div style={{ padding: 40, color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
      </AdminLayout>
    );
  }

  const st = STATUS_COLORS[article.status];
  const wordCount = editor ? editor.storage.characterCount?.words() ?? 0 : 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 230));

  return (
    <AdminLayout>
      <div style={{ minHeight: '100vh', background: '#faf9f7' }}>

        {/* Sticky top bar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'white', borderBottom: '1px solid var(--border)',
          padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <Link href="/admin/journal" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none', flexShrink: 0 }}>
            ← Journal
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 2, letterSpacing: '0.8px', textTransform: 'uppercase', background: st.bg, color: st.color }}>
              {article.status}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {saving ? 'Saving…' : savedAt ? `Saved ${timeAgo(savedAt.toISOString())}` : ''}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => save('draft')} style={{ padding: '7px 14px', fontSize: 12, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
              Save draft
            </button>
            <button onClick={openPreview} style={{ padding: '7px 14px', fontSize: 12, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
              Preview ↗
            </button>
            {article.status === 'published' ? (
              <button onClick={unpublish} style={{ padding: '7px 14px', fontSize: 12, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontFamily: 'inherit', color: '#c0392b' }}>
                Unpublish
              </button>
            ) : (
              <button onClick={publish} style={{ padding: '7px 14px', fontSize: 12, background: 'var(--dark)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Publish
              </button>
            )}
          </div>
        </div>

        {/* Publish-success confirmation — shows the live URL so the founder
            knows the article actually went public + can grab the link. */}
        {justPublished && article.status === 'published' && (
          <div style={{
            background: '#e6f4ec', borderBottom: '1px solid #b7e0c7', color: '#1f6b3b',
            padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 13,
          }}>
            <span>✓ Published live at</span>
            <a
              href={`/journal/${article.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1f6b3b', fontWeight: 600, textDecoration: 'underline' }}
            >
              silkilinen.com/journal/{article.slug}
            </a>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(`https://silkilinen.com/journal/${article.slug}`);
                setCopiedUrl(true);
                setTimeout(() => setCopiedUrl(false), 2000);
              }}
              style={{ padding: '3px 10px', fontSize: 11, border: '1px solid #1f6b3b', background: 'transparent', color: '#1f6b3b', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {copiedUrl ? 'Copied!' : 'Copy link'}
            </button>
            <button
              onClick={() => setJustPublished(false)}
              style={{ marginLeft: 'auto', padding: '3px 8px', fontSize: 11, border: 'none', background: 'transparent', color: '#1f6b3b', cursor: 'pointer', fontFamily: 'inherit' }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Canvas */}
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 120px' }}>

          {/* Hero image */}
          <div style={{
            width: '100%', height: 280, background: '#f0ede8',
            border: article.heroImage?.url ? 'none' : '2px dashed #d0c9be',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 40, overflow: 'hidden', position: 'relative',
          }}>
            {article.heroImage?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={article.heroImage.url} alt={article.heroImage.alt || title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#a09380', marginBottom: 12 }}>
                  {uploadingHero ? 'Uploading…' : 'Add hero image'}
                </p>
                <input ref={heroFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleHeroUpload} />
                <button
                  onClick={() => heroFileRef.current?.click()}
                  disabled={uploadingHero}
                  style={{ border: '1px solid #d0c9be', padding: '6px 18px', fontFamily: 'inherit', fontSize: 12, background: 'transparent', cursor: 'pointer' }}
                >
                  Choose file
                </button>
              </div>
            )}
            {article.heroImage?.url && (
              <button onClick={async () => {
                await fetch(`${API}/api/admin/journal/${id}`, {
                  method: 'PUT', credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ heroImage: { url: '', alt: '', caption: '' } }),
                });
                setArticle(a => a ? { ...a, heroImage: { url: '', alt: '', caption: '' } } : a);
              }} style={{
                position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)',
                color: 'white', border: 'none', padding: '4px 10px', cursor: 'pointer', fontSize: 12,
              }}>
                Remove
              </button>
            )}
          </div>

          {/* Title */}
          <div
            ref={titleRef}
            contentEditable
            suppressContentEditableWarning
            onInput={e => { setTitle(e.currentTarget.textContent || ''); scheduleAutosave(); }}
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 'clamp(32px, 5vw, 48px)',
              fontWeight: 300,
              lineHeight: 1.2,
              color: 'var(--dark)',
              outline: 'none',
              marginBottom: 20,
              letterSpacing: '0.5px',
            }}
            data-placeholder="Article title"
          />

          {/* Excerpt */}
          <div
            ref={excerptRef}
            contentEditable
            suppressContentEditableWarning
            onInput={e => { setExcerpt(e.currentTarget.textContent || ''); scheduleAutosave(); }}
            style={{
              fontSize: 17,
              fontStyle: 'italic',
              color: '#6b5f52',
              lineHeight: 1.6,
              outline: 'none',
              marginBottom: 40,
              borderBottom: '1px solid var(--border)',
              paddingBottom: 24,
            }}
            data-placeholder="A line or two about what this is…"
          />

          {/* Toolbar */}
          {editor && (
            <div style={{
              display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap',
              padding: '8px 12px', background: 'white', border: '1px solid var(--border)',
              position: 'sticky', top: 57, zIndex: 50,
            }}>
              {[
                { label: 'B', title: 'Bold', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), style: { fontWeight: 700 } },
                { label: 'I', title: 'Italic', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), style: { fontStyle: 'italic' } },
                { label: 'U', title: 'Underline', action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline'), style: { textDecoration: 'underline' } },
              ].map(({ label, title, action, active, style }) => (
                <button key={label} onClick={action} title={title} style={{
                  padding: '4px 10px', fontSize: 13, border: '1px solid var(--border)',
                  background: active ? 'var(--dark)' : 'white', color: active ? 'white' : 'var(--dark)',
                  cursor: 'pointer', fontFamily: 'inherit', ...style,
                }}>
                  {label}
                </button>
              ))}
              <span style={{ width: 1, background: 'var(--border)', margin: '2px 4px' }} />
              {[
                { label: 'H2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
                { label: 'H3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
              ].map(({ label, action, active }) => (
                <button key={label} onClick={action} style={{
                  padding: '4px 10px', fontSize: 12, border: '1px solid var(--border)',
                  background: active ? 'var(--dark)' : 'white', color: active ? 'white' : 'var(--dark)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {label}
                </button>
              ))}
              <span style={{ width: 1, background: 'var(--border)', margin: '2px 4px' }} />
              <button onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote" style={{ padding: '4px 10px', fontSize: 13, border: '1px solid var(--border)', background: editor.isActive('blockquote') ? 'var(--dark)' : 'white', color: editor.isActive('blockquote') ? 'white' : 'var(--dark)', cursor: 'pointer' }}>&ldquo;</button>
              <button onClick={() => editor.chain().focus().toggleBulletList().run()} style={{ padding: '4px 10px', fontSize: 13, border: '1px solid var(--border)', background: editor.isActive('bulletList') ? 'var(--dark)' : 'white', color: editor.isActive('bulletList') ? 'white' : 'var(--dark)', cursor: 'pointer' }}>•</button>
              <button onClick={() => editor.chain().focus().toggleOrderedList().run()} style={{ padding: '4px 10px', fontSize: 13, border: '1px solid var(--border)', background: editor.isActive('orderedList') ? 'var(--dark)' : 'white', color: editor.isActive('orderedList') ? 'white' : 'var(--dark)', cursor: 'pointer' }}>1.</button>
              <button onClick={() => {
                const url = window.prompt('URL:');
                if (url) editor.chain().focus().setLink({ href: url }).run();
              }} style={{ padding: '4px 10px', fontSize: 13, border: '1px solid var(--border)', background: editor.isActive('link') ? 'var(--dark)' : 'white', color: editor.isActive('link') ? 'white' : 'var(--dark)', cursor: 'pointer' }}>🔗</button>
              <button onClick={() => editor.chain().focus().setHorizontalRule().run()} style={{ padding: '4px 10px', fontSize: 13, border: '1px solid var(--border)', background: 'white', color: 'var(--muted)', cursor: 'pointer' }}>—</button>
              <>
                <input ref={inlineImageRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleInlineImageUpload} />
                <button onClick={() => inlineImageRef.current?.click()} title="Insert image" style={{ padding: '4px 10px', fontSize: 12, border: '1px solid var(--border)', background: 'white', color: 'var(--muted)', cursor: 'pointer' }}>
                  + Image
                </button>
              </>
            </div>
          )}

          {/* Body editor */}
          <div style={{
            fontSize: 17, lineHeight: 1.8, color: '#2a2520',
            fontFamily: "'Cormorant Garamond', Georgia, serif",
          }}>
            <style>{`
              .tiptap { outline: none; min-height: 400px; }
              .tiptap p { margin-bottom: 1.2em; }
              .tiptap h2 { font-size: 1.6em; font-weight: 400; margin: 1.4em 0 0.6em; letter-spacing: 0.5px; }
              .tiptap h3 { font-size: 1.3em; font-weight: 400; margin: 1.2em 0 0.5em; }
              .tiptap blockquote { border-left: 3px solid #c8bfb0; padding-left: 20px; font-style: italic; color: #6b5f52; margin: 1.5em 0; }
              .tiptap img { max-width: 100%; height: auto; margin: 1.5em 0; }
              .tiptap ul, .tiptap ol { padding-left: 1.5em; margin-bottom: 1em; }
              .tiptap li { margin-bottom: 0.4em; }
              .tiptap hr { border: none; border-top: 1px solid #d0c9be; margin: 2em 0; }
              .tiptap a { color: #5c35a8; text-decoration: underline; }
              .tiptap p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #b0a898; pointer-events: none; float: left; height: 0; }
            `}</style>
            <EditorContent editor={editor} />
          </div>

          {/* Word count */}
          {editor && (
            <div style={{ marginTop: 24, textAlign: 'right', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.3px' }}>
              {wordCount} words · {readTime} min read
            </div>
          )}

          {/* Optional details (SEO) */}
          <div style={{ marginTop: 48, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
            <button onClick={() => setSeoOpen(o => !o)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, color: 'var(--muted)', letterSpacing: '0.8px', textTransform: 'uppercase', padding: 0,
            }}>
              {seoOpen ? '▾' : '▸'} Optional details
            </button>

            {seoOpen && (
              <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
                {[
                  { label: 'Slug', key: 'slug', placeholder: 'auto-generated from title' },
                  { label: 'Meta title', key: 'metaTitle', placeholder: 'defaults to article title' },
                  { label: 'Meta description', key: 'metaDescription', placeholder: 'defaults to excerpt' },
                  { label: 'Keywords (comma-separated)', key: 'keywords', placeholder: 'silk, linen, care guide…' },
                  { label: 'Author', key: 'author', placeholder: 'Sabreen' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{label}</label>
                    <input
                      value={(seoForm as Record<string, string>)[key]}
                      onChange={e => setSeoForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
                {article.readingTimeMinutes && (
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>Reading time: ~{article.readingTimeMinutes} min (auto-calculated)</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

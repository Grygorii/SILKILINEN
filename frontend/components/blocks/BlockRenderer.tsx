import React from 'react';

// ── The block system ──────────────────────────────────────────────────────────
// Each block type declares: a label, its default props, the fields the builder
// shows to edit it, and how it renders. Add a new block by adding one entry here
// — the builder picks it up automatically. Render functions are pure (props →
// JSX) so they work in both the storefront (server) and the builder (client).

export type Block = { id: string; type: string; props: Record<string, unknown> };
export type FieldDef = {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'image' | 'url' | 'select';
  options?: string[];
};
export type BlockDef = {
  type: string;
  label: string;
  defaultProps: Record<string, unknown>;
  fields: FieldDef[];
  render: (props: Record<string, unknown>) => React.ReactNode;
};

const dark = 'var(--dark, #2a2218)';
const muted = 'var(--muted, #8a8680)';
const serif = "'Cormorant Garamond', Georgia, serif";
const s = (v: unknown, d = '') => (v == null ? d : String(v));

export const BLOCK_DEFS: BlockDef[] = [
  {
    type: 'hero',
    label: 'Hero',
    defaultProps: { title: 'Pure silk, pure comfort.', subtitle: 'Silk & linen intimates', buttonText: 'Shop the collection', buttonHref: '/shop', imageUrl: '' },
    fields: [
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'subtitle', label: 'Subtitle', kind: 'text' },
      { key: 'buttonText', label: 'Button text', kind: 'text' },
      { key: 'buttonHref', label: 'Button link', kind: 'url' },
      { key: 'imageUrl', label: 'Background image', kind: 'image' },
    ],
    render: (p) => (
      <section style={{ position: 'relative', minHeight: 520, display: 'flex', alignItems: 'center', padding: '0 8%', background: p.imageUrl ? `center/cover no-repeat url(${s(p.imageUrl)})` : '#e9e3d8', color: p.imageUrl ? '#fff' : dark }}>
        {p.imageUrl ? <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.28), rgba(0,0,0,0))' }} /> : null}
        <div style={{ position: 'relative', maxWidth: 560 }}>
          <h1 style={{ fontFamily: serif, fontWeight: 300, fontSize: 'clamp(40px, 6vw, 72px)', margin: 0, lineHeight: 1.05 }}>{s(p.title)}</h1>
          {p.subtitle ? <p style={{ fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', margin: '14px 0 0' }}>{s(p.subtitle)}</p> : null}
          {p.buttonText ? <a href={s(p.buttonHref, '/shop')} style={{ display: 'inline-block', marginTop: 26, padding: '13px 28px', background: dark, color: '#faf8f4', fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', textDecoration: 'none' }}>{s(p.buttonText)}</a> : null}
        </div>
      </section>
    ),
  },
  {
    type: 'heading',
    label: 'Heading',
    defaultProps: { text: 'A section heading', align: 'center' },
    fields: [
      { key: 'text', label: 'Text', kind: 'text' },
      { key: 'align', label: 'Align', kind: 'select', options: ['left', 'center', 'right'] },
    ],
    render: (p) => (
      <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: 'clamp(28px, 4vw, 44px)', color: dark, textAlign: (s(p.align, 'center') as 'left' | 'center' | 'right'), margin: '8px 0', padding: '0 8%' }}>{s(p.text)}</h2>
    ),
  },
  {
    type: 'text',
    label: 'Text',
    defaultProps: { text: 'Write something considered and warm here.', align: 'center' },
    fields: [
      { key: 'text', label: 'Text', kind: 'textarea' },
      { key: 'align', label: 'Align', kind: 'select', options: ['left', 'center', 'right'] },
    ],
    render: (p) => (
      <p style={{ fontSize: 15, lineHeight: 1.9, color: muted, maxWidth: 680, margin: '0 auto', padding: '0 8%', textAlign: (s(p.align, 'center') as 'left' | 'center' | 'right') }}>{s(p.text)}</p>
    ),
  },
  {
    type: 'image',
    label: 'Image',
    defaultProps: { url: '', alt: '', caption: '' },
    fields: [
      { key: 'url', label: 'Image', kind: 'image' },
      { key: 'alt', label: 'Alt text', kind: 'text' },
      { key: 'caption', label: 'Caption', kind: 'text' },
    ],
    render: (p) => (
      <figure style={{ margin: '0 auto', maxWidth: 1000, padding: '0 8%' }}>
        {p.url ? <img src={s(p.url)} alt={s(p.alt)} style={{ width: '100%', display: 'block' }} /> : <div style={{ aspectRatio: '16/9', background: '#ede8df' }} />}
        {p.caption ? <figcaption style={{ fontSize: 12, color: muted, textAlign: 'center', marginTop: 8 }}>{s(p.caption)}</figcaption> : null}
      </figure>
    ),
  },
  {
    type: 'imageText',
    label: 'Image + Text',
    defaultProps: { imageUrl: '', heading: 'Crafted with care', text: 'A sentence or two of warm, specific copy about this piece or idea.', imageSide: 'left' },
    fields: [
      { key: 'imageUrl', label: 'Image', kind: 'image' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'text', label: 'Text', kind: 'textarea' },
      { key: 'imageSide', label: 'Image side', kind: 'select', options: ['left', 'right'] },
    ],
    render: (p) => {
      const img = p.imageUrl ? <img src={s(p.imageUrl)} alt={s(p.heading)} style={{ width: '100%', display: 'block' }} /> : <div style={{ aspectRatio: '4/5', background: '#ede8df' }} />;
      const txt = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 6%' }}>
          <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: 'clamp(26px, 3vw, 38px)', color: dark, margin: 0 }}>{s(p.heading)}</h2>
          <p style={{ fontSize: 15, lineHeight: 1.9, color: muted, marginTop: 14 }}>{s(p.text)}</p>
        </div>
      );
      const right = s(p.imageSide, 'left') === 'right';
      return (
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, maxWidth: 1200, margin: '0 auto' }}>
          {right ? <>{txt}{img}</> : <>{img}{txt}</>}
        </section>
      );
    },
  },
  {
    type: 'button',
    label: 'Button',
    defaultProps: { text: 'Shop now', href: '/shop', align: 'center' },
    fields: [
      { key: 'text', label: 'Text', kind: 'text' },
      { key: 'href', label: 'Link', kind: 'url' },
      { key: 'align', label: 'Align', kind: 'select', options: ['left', 'center', 'right'] },
    ],
    render: (p) => (
      <div style={{ textAlign: (s(p.align, 'center') as 'left' | 'center' | 'right'), padding: '0 8%' }}>
        <a href={s(p.href, '/shop')} style={{ display: 'inline-block', padding: '13px 28px', background: dark, color: '#faf8f4', fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', textDecoration: 'none' }}>{s(p.text)}</a>
      </div>
    ),
  },
  {
    type: 'spacer',
    label: 'Spacer',
    defaultProps: { size: 'medium' },
    fields: [{ key: 'size', label: 'Size', kind: 'select', options: ['small', 'medium', 'large'] }],
    render: (p) => <div style={{ height: s(p.size) === 'small' ? 24 : s(p.size) === 'large' ? 96 : 56 }} />,
  },
];

export const BLOCK_BY_TYPE: Record<string, BlockDef> = Object.fromEntries(BLOCK_DEFS.map(d => [d.type, d]));

// Renders a list of blocks. Each block sits in a band with vertical rhythm
// (except the hero, which is full-bleed).
export default function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map(b => {
        const def = BLOCK_BY_TYPE[b.type];
        if (!def) return null;
        return (
          <div key={b.id} style={{ padding: b.type === 'hero' ? 0 : '40px 0' }}>
            {def.render(b.props || {})}
          </div>
        );
      })}
    </>
  );
}

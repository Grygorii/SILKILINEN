'use client';

import { useState, useRef, useEffect } from 'react';

// Dependency-free crop & resize popup for product photos. The picked image sits
// behind a fixed aspect-ratio frame; drag to pan, slide to zoom, pick a ratio —
// then it exports a clean ~1600px JPEG that flows into the normal upload. Handles
// one or many selected files in sequence. No libraries (avoids a risky dep on
// this custom Next build); pure canvas + pointer events.

type Props = { files: File[]; onComplete: (out: File[]) => void; onClose: () => void };

const ASPECTS: { label: string; value: number }[] = [
  { label: 'Original', value: 0 },
  { label: 'Square', value: 1 },
  { label: '4 : 5', value: 4 / 5 },
  { label: '3 : 4', value: 3 / 4 },
  { label: '16 : 9', value: 16 / 9 },
];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export default function ImageCropModal({ files, onComplete, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<File[]>([]);
  const [src, setSrc] = useState('');
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [aspect, setAspect] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const file = files[index];

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSrc(url);
    setZoom(1); setPan({ x: 0, y: 0 }); setAspect(0); setNat({ w: 0, h: 0 });
    const im = new Image();
    im.onload = () => setNat({ w: im.naturalWidth, h: im.naturalHeight });
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const effAspect = aspect || (nat.w && nat.h ? nat.w / nat.h : 1);
  const MAXW = 380, MAXH = 440;
  let vw = MAXW, vh = MAXW / effAspect;
  if (vh > MAXH) { vh = MAXH; vw = MAXH * effAspect; }

  const baseScale = nat.w && nat.h ? Math.max(vw / nat.w, vh / nat.h) : 1;
  const scale = baseScale * zoom;
  const dispW = nat.w * scale, dispH = nat.h * scale;
  const maxPanX = Math.max(0, (dispW - vw) / 2);
  const maxPanY = Math.max(0, (dispH - vh) / 2);
  const px = clamp(pan.x, -maxPanX, maxPanX);
  const py = clamp(pan.y, -maxPanY, maxPanY);

  function onDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px, py };
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setPan({
      x: clamp(drag.current.px + (e.clientX - drag.current.x), -maxPanX, maxPanX),
      y: clamp(drag.current.py + (e.clientY - drag.current.y), -maxPanY, maxPanY),
    });
  }
  function onUp() { drag.current = null; }

  async function cropCurrent(): Promise<File> {
    const longEdge = 1600;
    const ow = effAspect >= 1 ? longEdge : Math.round(longEdge * effAspect);
    const oh = Math.round(ow / effAspect);
    const canvas = document.createElement('canvas');
    canvas.width = ow; canvas.height = oh;
    const ctx = canvas.getContext('2d');
    if (!ctx || !imgRef.current) return file;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ow, oh);
    const k = ow / vw;            // viewport → output scale
    ctx.scale(k, k);
    const x = vw / 2 + px - dispW / 2;
    const y = vh / 2 + py - dispH / 2;
    ctx.drawImage(imgRef.current, x, y, dispW, dispH);
    const blob: Blob | null = await new Promise(r => canvas.toBlob(b => r(b), 'image/jpeg', 0.9));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  }

  async function advance(useOriginal: boolean) {
    setBusy(true);
    const out = useOriginal ? file : await cropCurrent();
    const next = [...results, out];
    setBusy(false);
    if (index + 1 >= files.length) onComplete(next);
    else { setResults(next); setIndex(i => i + 1); }
  }

  if (!file) return null;
  const last = index + 1 >= files.length;

  return (
    <div style={overlay} onClick={busy ? undefined : onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 18, color: '#1a1916' }}>Crop &amp; resize</h3>
          <button onClick={onClose} disabled={busy} style={closeBtn} aria-label="Close">×</button>
        </div>
        {files.length > 1 && <p style={{ margin: '0 0 10px', fontSize: 12, color: '#8a8680' }}>Photo {index + 1} of {files.length}</p>}

        {/* Aspect ratios */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {ASPECTS.map(a => (
            <button key={a.label} onClick={() => { setAspect(a.value); setPan({ x: 0, y: 0 }); }}
              style={{ ...chip, ...(aspect === a.value ? chipOn : null) }}>{a.label}</button>
          ))}
        </div>

        {/* Crop viewport */}
        <div
          style={{ width: vw, height: vh, margin: '0 auto', overflow: 'hidden', position: 'relative', background: '#000', touchAction: 'none', cursor: 'grab', userSelect: 'none' }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img ref={imgRef} src={src} alt="" draggable={false}
              style={{ position: 'absolute', left: '50%', top: '50%', width: dispW, height: dispH, maxWidth: 'none', transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))` }} />
          )}
        </div>

        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 4px' }}>
          <span style={{ fontSize: 12, color: '#8a8680' }}>Zoom</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
        </div>
        <p style={{ fontSize: 11, color: '#aca8a2', margin: '4px 0 14px' }}>Drag the photo to reposition. Exports a clean 1600px JPEG.</p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => advance(true)} disabled={busy} style={ghostBtn}>Use original</button>
          <button onClick={() => advance(false)} disabled={busy || !nat.w} style={primaryBtn}>
            {busy ? 'Working…' : last ? 'Crop & add' : 'Crop & next'}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(26,25,22,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', zIndex: 2000, overflowY: 'auto' };
const modal: React.CSSProperties = { background: '#fbf8f2', border: '1px solid #e6e1d8', padding: '22px 24px 24px', width: '100%', maxWidth: 460, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' };
const closeBtn: React.CSSProperties = { background: 'none', border: 'none', fontSize: 24, lineHeight: 1, color: '#8a8680', cursor: 'pointer' };
const chip: React.CSSProperties = { border: '1px solid #cfc7b8', background: '#fff', padding: '5px 11px', fontSize: 12, cursor: 'pointer', color: '#1a1916' };
const chipOn: React.CSSProperties = { background: '#1a1916', color: '#fff', borderColor: '#1a1916' };
const primaryBtn: React.CSSProperties = { background: '#1a1916', color: '#fff', border: 'none', padding: '9px 18px', fontSize: 13, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { background: '#fff', color: '#1a1916', border: '1px solid #cfc7b8', padding: '9px 16px', fontSize: 13, cursor: 'pointer' };

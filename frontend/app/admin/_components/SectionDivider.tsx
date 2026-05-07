export default function SectionDivider({ label }: { label?: string }) {
  if (!label) {
    return <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '32px 0' }} />;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '32px 0' }}>
      <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
      <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', flexShrink: 0 }}>
        {label}
      </span>
      <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
    </div>
  );
}

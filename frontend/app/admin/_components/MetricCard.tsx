export default function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div style={{ background: 'var(--admin-surface)', border: '1px solid var(--admin-line)', padding: 24 }}>
      <p style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--admin-ink-muted)', marginBottom: 12 }}>
        {label}
      </p>
      <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 34, fontWeight: 400, color: 'var(--admin-ink)', marginBottom: 6, lineHeight: 1 }}>
        {value}
      </p>
      {sub && <span style={{ fontSize: 12, color: 'var(--admin-ink-muted)' }}>{sub}</span>}
    </div>
  );
}

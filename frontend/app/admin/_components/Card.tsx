export default function Card({
  title,
  children,
  style,
}: {
  title?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', padding: 24, ...style }}>
      {title && (
        <p style={{
          fontSize: 11,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginBottom: 16,
        }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

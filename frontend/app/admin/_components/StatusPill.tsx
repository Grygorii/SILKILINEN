type Status = 'healthy' | 'warning' | 'critical' | 'info';

const PALETTE: Record<string, { bg: string; color: string }> = {
  healthy:  { bg: '#d4edda', color: '#155724' },
  warning:  { bg: '#fff3cd', color: '#856404' },
  critical: { bg: '#f8d7da', color: '#721c24' },
  info:     { bg: '#d1ecf1', color: '#0c5460' },
};

export default function StatusPill({ status }: { status: Status | string }) {
  const p = PALETTE[status] ?? PALETTE.info;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      borderRadius: 3,
      background: p.bg,
      color: p.color,
    }}>
      {status}
    </span>
  );
}

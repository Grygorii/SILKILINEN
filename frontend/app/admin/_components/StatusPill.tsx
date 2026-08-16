type Status = 'healthy' | 'warning' | 'critical' | 'info';

const PALETTE: Record<string, { bg: string; color: string }> = {
  healthy:  { bg: 'var(--admin-success-soft)', color: 'var(--admin-success)' },
  warning:  { bg: 'var(--admin-warning-soft)', color: 'var(--admin-warning)' },
  critical: { bg: 'var(--admin-danger-soft)', color: 'var(--admin-danger)' },
  info:     { bg: 'var(--admin-info-soft)', color: 'var(--admin-info)' },
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

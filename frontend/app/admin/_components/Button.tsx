type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, React.CSSProperties> = {
  primary:   { background: 'var(--dark)', color: 'var(--warm-white)', border: 'none' },
  secondary: { background: 'none', border: '1px solid var(--border)', color: 'var(--dark)' },
  ghost:     { background: 'none', border: 'none', color: 'var(--muted)', padding: '6px 12px' },
};

export default function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: Variant;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 22px',
        fontFamily: "'Jost', sans-serif",
        fontSize: 12,
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'opacity 0.2s',
        ...VARIANTS[variant],
      }}
    >
      {children}
    </button>
  );
}

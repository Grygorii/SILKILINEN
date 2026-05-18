type Props = { size?: number; strokeWidth?: number; className?: string };

export function Package({ size = 24, strokeWidth = 1.5, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* box body */}
      <path d="M3 12h18v9H3V12z" />
      {/* lid — 2px gap above box creates "hovering open" read */}
      <path d="M2 7h20v3H2V7z" />
      {/* lid centre crease */}
      <line x1="12" y1="7" x2="12" y2="10" />
      {/* box depth line */}
      <line x1="3" y1="16.5" x2="21" y2="16.5" />
    </svg>
  );
}

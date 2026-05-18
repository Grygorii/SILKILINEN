type Props = { size?: number; strokeWidth?: number; className?: string };

export function Envelope({ size = 24, strokeWidth = 1.5, className }: Props) {
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
      {/* envelope body */}
      <path d="M2 5h20v14H2V5z" />
      {/* V-fold flap */}
      <path d="M2 5l10 8 10-8" />
    </svg>
  );
}

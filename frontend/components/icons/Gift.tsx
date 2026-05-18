type Props = { size?: number; strokeWidth?: number; className?: string };

export function Gift({ size = 24, strokeWidth = 1.5, className }: Props) {
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
      <path d="M3 10h18v11H3V10z" />
      {/* vertical ribbon */}
      <line x1="12" y1="10" x2="12" y2="21" />
      {/* bow — left loop */}
      <path d="M12 10C9 10 6 8 8 5C10 2 12 6 12 10" />
      {/* bow — right loop (mirror) */}
      <path d="M12 10C15 10 18 8 16 5C14 2 12 6 12 10" />
    </svg>
  );
}

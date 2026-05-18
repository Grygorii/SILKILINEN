type Props = { size?: number; strokeWidth?: number; className?: string };

export function Address({ size = 24, strokeWidth = 1.5, className }: Props) {
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
      {/* roof — pitched gable */}
      <path d="M3 11L12 3l9 8" />
      {/* walls — left, base, right (open at top where roof connects) */}
      <path d="M3 11v10h18V11" />
      {/* open doorway */}
      <path d="M10 21v-6h4v6" />
    </svg>
  );
}

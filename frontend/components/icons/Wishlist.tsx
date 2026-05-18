type Props = { size?: number; strokeWidth?: number; className?: string };

export function Wishlist({ size = 24, strokeWidth = 1.5, className }: Props) {
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
      {/* leaf outline — pointed at top, curved on both sides, pointed at base */}
      <path d="M12 4C17 8 17 18 12 21C7 18 7 8 12 4Z" />
      {/* stem */}
      <line x1="12" y1="21" x2="12" y2="23" />
    </svg>
  );
}

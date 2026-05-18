type Props = { size?: number; strokeWidth?: number; className?: string };

export function Bag({ size = 24, strokeWidth = 1.5, className }: Props) {
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
      {/* bag body */}
      <path d="M5 10h14v11H5V10z" />
      {/* left handle — arch above bag body */}
      <path d="M7 10C7 5 11 4 11 10" />
      {/* right handle — arch above bag body (mirror) */}
      <path d="M17 10C17 5 13 4 13 10" />
    </svg>
  );
}

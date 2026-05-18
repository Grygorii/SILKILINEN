type Props = { size?: number; strokeWidth?: number; className?: string };

export function Profile({ size = 24, strokeWidth = 1.5, className }: Props) {
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
      {/* head */}
      <circle cx="12" cy="8" r="4" />
      {/* shoulders — gentler arc than standard user icon */}
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

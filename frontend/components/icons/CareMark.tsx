type Props = { size?: number; strokeWidth?: number; className?: string };

export function CareMark({ size = 24, strokeWidth = 1.5, className }: Props) {
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
      {/* care label tag body — rectangle with rounded right end */}
      <path d="M4 7h13a5 5 0 0 1 0 10H4V7z" />
      {/* eyelet near straight edge */}
      <circle cx="7.5" cy="12" r="1.5" />
    </svg>
  );
}

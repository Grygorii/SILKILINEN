'use client';

import styles from './OptionPill.module.css';

// Size choices can be cleared by pressing the selected button again.
export function OptionPill({
  selected,
  disabled,
  onSelect,
  children,
  ariaLabel,
}: {
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={!!selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      className={styles.pill}
    >
      <span>{children}</span>
    </button>
  );
}

// Auto-fitting grid wrapper — keeps two sizes balanced and six sizes balanced
// without bespoke layout per product.
export function OptionPillGroup({
  children,
  ariaLabel,
}: {
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={styles.grid}>
      {children}
    </div>
  );
}

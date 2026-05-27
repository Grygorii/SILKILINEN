'use client';

import styles from './OptionPill.module.css';

// Single pill — for sizes, generic options. States: default / selected /
// disabled (sold out). 44px min hit target, charcoal fill on select,
// line-through on disabled.
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
      role="radio"
      aria-checked={!!selected}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      className={[
        styles.pill,
        selected ? styles.selected : '',
        disabled ? styles.disabled : '',
      ].filter(Boolean).join(' ')}
    >
      {children}
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
    <div role="radiogroup" aria-label={ariaLabel} className={styles.grid}>
      {children}
    </div>
  );
}

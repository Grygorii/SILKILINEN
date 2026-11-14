'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'disabled';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

// The single button component for the storefront. Three variants:
//   - primary  (filled charcoal) — default
//   - secondary (outlined)
//   - disabled (warm-beige fill, 0.5 text opacity, inert)
// Full-width by default; wrap in a sized container if you need otherwise.
const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const isDisabled = variant === 'disabled' || disabled;
  const variantClass =
    variant === 'secondary' ? styles.secondary
    : variant === 'disabled' ? styles.disabledPrimary
    : styles.primary;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      className={[styles.btn, variantClass, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <span>{children}</span>
    </button>
  );
});

export default Button;

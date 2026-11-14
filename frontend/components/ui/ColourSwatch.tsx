'use client';

import { colourToHex } from '@/lib/colourHex';
import styles from './ColourSwatch.module.css';

export type Swatch = {
  name: string;
  hex?: string | null;
  soldOut?: boolean;
};

// One labelled square — replaces the text-cube row.
//
// When a product carries no colorHex, the shade is derived from its NAME before
// falling back to the neutral placeholder. Falling straight through to
// surface-warm meant "Silk bikini briefs in Black" rendered a CREAM square —
// a confident wrong answer, which a customer reads as the colour rather than as
// missing data. The placeholder now only appears for names we truly don't know.
export function ColourSwatch({
  swatch,
  selected,
  onSelect,
  soldOutLabel = 'sold out',
}: {
  swatch: Swatch;
  selected?: boolean;
  onSelect?: () => void;
  soldOutLabel?: string;
}) {
  const bg = swatch.hex || colourToHex(swatch.name) || 'var(--color-surface-warm)';
  return (
    <button
      type="button"
      role="radio"
      aria-checked={!!selected}
      aria-label={swatch.name + (swatch.soldOut ? ` (${soldOutLabel})` : '')}
      disabled={swatch.soldOut}
      onClick={swatch.soldOut ? undefined : onSelect}
      style={{ background: bg }}
      className={[
        styles.swatch,
        selected ? styles.selected : '',
        swatch.soldOut ? styles.soldOut : '',
      ].filter(Boolean).join(' ')}
    />
  );
}

// Labelled group — uppercase section label, the colon, then the active swatch
// name. Mirrors the proposal layout exactly.
export function ColourSwatchGroup({
  swatches,
  selectedName,
  onSelect,
  label = 'Colour',
  ariaLabel = label,
  soldOutLabel,
}: {
  swatches: Swatch[];
  selectedName?: string;
  onSelect?: (name: string) => void;
  label?: string;
  ariaLabel?: string;
  soldOutLabel?: string;
}) {
  return (
    <div>
      <div className={styles.label}>
        <span>{label} ·</span>
        <span className={styles.labelName}>{selectedName || swatches[0]?.name || ''}</span>
      </div>
      <div role="radiogroup" aria-label={ariaLabel} className={styles.row}>
        {swatches.map(s => (
          <ColourSwatch
            key={s.name}
            swatch={s}
            selected={selectedName === s.name}
            onSelect={() => onSelect?.(s.name)}
            soldOutLabel={soldOutLabel}
          />
        ))}
      </div>
    </div>
  );
}

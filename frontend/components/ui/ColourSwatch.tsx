'use client';

import styles from './ColourSwatch.module.css';

export type Swatch = {
  name: string;
  hex?: string | null;
  soldOut?: boolean;
};

// One labelled square — replaces the text-cube row. Fallback fill is
// surface-warm when hex is missing, so the layout never collapses.
export function ColourSwatch({
  swatch,
  selected,
  onSelect,
}: {
  swatch: Swatch;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const bg = swatch.hex || 'var(--color-surface-warm)';
  return (
    <button
      type="button"
      role="radio"
      aria-checked={!!selected}
      aria-label={swatch.name + (swatch.soldOut ? ' (sold out)' : '')}
      aria-disabled={swatch.soldOut || undefined}
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
}: {
  swatches: Swatch[];
  selectedName?: string;
  onSelect?: (name: string) => void;
}) {
  return (
    <div>
      <div className={styles.label}>
        <span>Colour ·</span>
        <span className={styles.labelName}>{selectedName || swatches[0]?.name || ''}</span>
      </div>
      <div role="radiogroup" aria-label="Colour" className={styles.row}>
        {swatches.map(s => (
          <ColourSwatch
            key={s.name}
            swatch={s}
            selected={selectedName === s.name}
            onSelect={() => onSelect?.(s.name)}
          />
        ))}
      </div>
    </div>
  );
}

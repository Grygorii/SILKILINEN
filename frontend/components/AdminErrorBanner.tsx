'use client';

/**
 * Standard error banner for admin pages — replaces the historical
 * pattern of swallowing fetch errors into an empty array (which made
 * "the API is down" look identical to "no data yet").
 *
 * Pass the error string + a retry callback. The banner renders inline
 * above the table/content area; the retry button calls the supplied
 * loader. Self-contained styling so it drops into any admin page
 * without a CSS-module dependency.
 */
export default function AdminErrorBanner({ error, onRetry }: { error: string; onRetry: () => void }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      style={{
        padding: '12px 16px',
        background: '#fdf0ed',
        border: '1px solid #f5c2bb',
        color: '#c0392b',
        fontSize: 13,
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span>{error}</span>
      <button
        type="button"
        onClick={onRetry}
        style={{
          padding: '4px 12px',
          border: '1px solid #c0392b',
          background: 'transparent',
          color: '#c0392b',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 12,
          letterSpacing: '0.5px',
        }}
      >
        Try again
      </button>
    </div>
  );
}

// Route-level loading state. There was no loading.tsx anywhere in the app, so
// navigating to a route whose server component was still fetching from Railway
// left the PREVIOUS page on screen, frozen and fully interactive — a customer
// could click a product, see nothing happen, and click again.
//
// A skeleton rather than a spinner: it reserves the same shape the content will
// occupy, so the page settles instead of jumping, and it reads as the shop
// arriving rather than the site working. Portrait 2:3 tiles match ProductCard's
// enforced ratio, so the transition into real cards is dimensionally identical.
//
// Kept token-only and CSS-only — no client component, no JS, so it can render
// the instant navigation starts.
export default function ShopLoading() {
  return (
    <div style={{ padding: '48px 6%' }} aria-busy="true" aria-live="polite">
      <span className="srOnly">Loading…</span>

      {/* Title line */}
      <div
        style={{
          height: 34,
          width: 'min(280px, 60%)',
          margin: '0 auto 40px',
          borderRadius: 2,
          background: 'var(--color-surface)',
          animation: 'skeletonPulse 1.4s ease-in-out infinite',
        }}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 24,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div
              style={{
                aspectRatio: '2 / 3',
                background: 'var(--color-surface)',
                animation: 'skeletonPulse 1.4s ease-in-out infinite',
                // Staggered so the grid breathes as a whole rather than
                // flashing in lockstep, which reads as a broken repaint.
                animationDelay: `${(i % 4) * 0.12}s`,
              }}
            />
            <div
              style={{
                height: 12,
                width: '70%',
                marginTop: 14,
                background: 'var(--color-surface)',
                animation: 'skeletonPulse 1.4s ease-in-out infinite',
                animationDelay: `${(i % 4) * 0.12}s`,
              }}
            />
            <div
              style={{
                height: 12,
                width: '35%',
                marginTop: 8,
                background: 'var(--color-surface)',
                animation: 'skeletonPulse 1.4s ease-in-out infinite',
                animationDelay: `${(i % 4) * 0.12}s`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// The admin's card shell. This existed with zero adopters across 63 pages, and
// the likely reason is visible in its old signature: a title string and nothing
// else, so any panel needing a control in its header — a range toggle, a
// refresh — had to abandon it and hand-roll the whole box. `action` fixes that.
//
// The title renders as an h2 because the admin is a real document: every page
// has an h1, and panels sitting under it are sections, not paragraphs styled to
// look like headings.
export default function Card({
  title,
  action,
  children,
  style,
}: {
  title?: string;
  /** Rendered on the header's right — range toggles, refresh, links. */
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
      style={{
        // Was a literal 'white', which is why the workspace palette never
        // reached it. Tokens only.
        background: 'var(--admin-surface)',
        border: '1px solid var(--admin-line)',
        padding: 24,
        ...style,
      }}
    >
      {(title || action) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
          }}
        >
          {title && (
            <h2
              style={{
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: 'var(--admin-ink-muted)',
                margin: 0,
                fontWeight: 600,
              }}
            >
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

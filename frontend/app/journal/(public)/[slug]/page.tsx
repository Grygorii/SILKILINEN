// [DEBUG STEP 2] Strip to absolute minimum — no fetch, no metadata, no
// notFound, no awaits beyond unwrapping params. If THIS 500s, the cause
// is in the layout, the segment config, or another file in the route
// segment (opengraph-image.tsx, etc.) — not in this page module.

export default async function JournalArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px' }}>
      <h1>journal slug debug</h1>
      <p>slug: {slug}</p>
    </main>
  );
}

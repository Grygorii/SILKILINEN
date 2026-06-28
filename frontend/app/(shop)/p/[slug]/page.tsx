import BlockRenderer, { type Block } from '@/components/blocks/BlockRenderer';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getLayout(slug: string) {
  try {
    const res = await fetch(`${API}/api/page-layout/${slug}`, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// Renders a page built in the visual page builder. Lives inside the (shop) layout
// so it has the storefront nav + footer. Until a layout is published, shows a
// gentle placeholder (the live homepage at "/" is a separate, untouched page).
export default async function FlexiblePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const layout = await getLayout(slug);
  const blocks: Block[] = Array.isArray(layout?.blocks) ? layout.blocks : [];

  if (blocks.length === 0) {
    return <main style={{ padding: '120px 24px', textAlign: 'center', color: 'var(--muted, #8a8680)' }}>This page hasn’t been published yet.</main>;
  }
  return <main><BlockRenderer blocks={blocks} /></main>;
}

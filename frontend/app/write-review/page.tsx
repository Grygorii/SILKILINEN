import type { Metadata } from 'next';
import { Suspense } from 'react';
import WriteReviewForm from './WriteReviewForm';

export const metadata: Metadata = {
  title: 'Write a review',
  description: 'Share your thoughts on your Silkilinen purchase.',
  // Token-gated submission flow — not useful in search, opt out of indexing.
  robots: { index: false, follow: false },
};

export default function WriteReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <main
      style={{
        minHeight: '70vh',
        padding: '80px 24px 120px',
        background: 'var(--color-bg, #FAF8F4)',
      }}
    >
      <Suspense fallback={<div style={{ textAlign: 'center', fontFamily: 'Jost, sans-serif', color: '#8A8278' }}>Loading…</div>}>
        <WriteReviewLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function WriteReviewLoader({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <WriteReviewForm token={token || ''} />;
}

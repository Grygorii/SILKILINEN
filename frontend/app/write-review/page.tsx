import type { Metadata } from 'next';
import { Suspense } from 'react';
import WriteReviewForm from './WriteReviewForm';
import OrderReceiptForm from './OrderReceiptForm';
import { getSiteSettings } from '@/lib/settings';

type ReviewParams = Promise<{ token?: string; receipt?: string }>;

export const metadata: Metadata = {
  title: 'Your SILKILINEN order',
  description: 'Confirm receipt or share a review of your order.',
  referrer: 'no-referrer',
  // Token-gated submission flow — not useful in search, opt out of indexing.
  robots: { index: false, follow: false },
};

export default function WriteReviewPage({
  searchParams,
}: {
  searchParams: ReviewParams;
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

async function WriteReviewLoader({ searchParams }: { searchParams: ReviewParams }) {
  const { token, receipt } = await searchParams;
  if (receipt === '1' || receipt === 'review') {
    const { supportEmail } = await getSiteSettings();
    return <OrderReceiptForm supportEmail={supportEmail} reviewOnly={receipt === 'review'} />;
  }
  return <WriteReviewForm token={token || ''} />;
}

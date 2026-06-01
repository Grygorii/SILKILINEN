import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BundlePageClient from './BundlePageClient';

const API = process.env.NEXT_PUBLIC_API_URL;

type BundleProduct = {
  _id: string;
  name: string;
  slug?: string;
  price: number;
  images?: { url: string; isPrimary?: boolean; alt?: string }[];
};

export type BundleData = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  heroImage?: { url: string; alt?: string } | null;
  discountPercent: number;
  originalTotal: number;
  bundlePrice: number;
  savings: number;
  products: BundleProduct[];
  metaTitle?: string;
  metaDescription?: string;
};

async function getBundle(slug: string): Promise<BundleData | null> {
  try {
    const res = await fetch(`${API}/api/bundles/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await getBundle(slug);
  if (!bundle) return { title: 'Bundle Not Found' };

  const title = bundle.metaTitle || `${bundle.name} — SILKILINEN`;
  const description = bundle.metaDescription || bundle.description
    || `Save €${bundle.savings.toFixed(0)} on the ${bundle.name} bundle at SILKILINEN. Pure silk and linen, shipped worldwide from Donegal.`;

  return {
    title,
    description,
    alternates: { canonical: `https://silkilinen.com/bundles/${slug}` },
    openGraph: {
      title,
      description,
      url: `https://silkilinen.com/bundles/${slug}`,
      siteName: 'SILKILINEN',
    },
  };
}

export default async function BundlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bundle = await getBundle(slug);
  if (!bundle) notFound();
  return <BundlePageClient bundle={bundle} />;
}

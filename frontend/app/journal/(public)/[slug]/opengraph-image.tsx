import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';
import { brand } from '@/lib/brand';
import { isValidImageUrl } from '@/lib/imageUtils';

export const runtime = 'nodejs';
export const alt = 'Silkilinen Journal';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getArticle(slug: string) {
  try {
    const res = await fetch(`${API}/api/journal/slug/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [font, article] = await Promise.all([
    readFile(path.join(process.cwd(), 'public/fonts/cormorant-garamond-400.ttf')),
    getArticle(slug),
  ]);

  const title: string = article?.title || 'The Journal';
  const heroUrl: string | null = isValidImageUrl(article?.heroImage?.url) ? article.heroImage.url : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: brand.og.bg,
        }}
      >
        {/* Hero image (full bleed, darkened) */}
        {heroUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroUrl}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            {/* Gradient overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(30,24,18,0.82) 0%, rgba(30,24,18,0.30) 60%, rgba(30,24,18,0.10) 100%)',
              }}
            />
          </>
        )}

        {/* Text — bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: 64,
            left: 72,
            right: 72,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Journal label */}
          <span
            style={{
              fontFamily: 'Cormorant Garamond',
              fontSize: 14,
              fontWeight: 400,
              color: heroUrl ? 'rgba(250,248,244,0.7)' : brand.og.muted,
              letterSpacing: '0.25em',
            }}
          >
            SILKILINEN JOURNAL
          </span>

          {/* Article title */}
          <span
            style={{
              fontFamily: 'Cormorant Garamond',
              fontSize: 52,
              fontWeight: 400,
              color: heroUrl ? '#faf8f4' : brand.og.ink,
              lineHeight: 1.15,
              letterSpacing: '0.02em',
            }}
          >
            {title.length > 60 ? title.slice(0, 58) + '…' : title}
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Cormorant Garamond',
          data: font,
          weight: 400,
          style: 'normal',
        },
      ],
    }
  );
}

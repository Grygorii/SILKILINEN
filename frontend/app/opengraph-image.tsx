import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';
import { brand } from '@/lib/brand';

export const runtime = 'nodejs';
export const alt = 'Silkilinen — Pure Silk & Linen Intimates';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const font = await readFile(
    path.join(process.cwd(), 'public/fonts/cormorant-garamond-400.ttf')
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: brand.og.bg,
          gap: 20,
        }}
      >
        {/* Wordmark */}
        <span
          style={{
            fontFamily: 'Cormorant Garamond',
            fontSize: 72,
            fontWeight: 400,
            color: brand.og.ink,
            letterSpacing: '0.18em',
          }}
        >
          {brand.name}
        </span>

        {/* Divider */}
        <div
          style={{
            width: 60,
            height: 1,
            background: brand.og.muted,
          }}
        />

        {/* Tagline */}
        <span
          style={{
            fontFamily: 'Cormorant Garamond',
            fontSize: 22,
            fontWeight: 400,
            color: brand.og.muted,
            letterSpacing: '0.12em',
          }}
        >
          {brand.tagline}
        </span>
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

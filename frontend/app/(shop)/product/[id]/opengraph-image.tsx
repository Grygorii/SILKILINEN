import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';
import { brand } from '@/lib/brand';

export const runtime = 'nodejs';
export const alt = 'Silkilinen product';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getProduct(id: string) {
  try {
    const res = await fetch(`${API}/api/products/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [font, product] = await Promise.all([
    readFile(path.join(process.cwd(), 'public/fonts/cormorant-garamond-400.woff2')),
    getProduct(id),
  ]);

  const imageUrl: string | null =
    product?.images?.find((i: { isPrimary?: boolean }) => i.isPrimary)?.url ||
    product?.images?.[0]?.url ||
    product?.image ||
    null;

  const productName: string = product?.name || 'Silkilinen';
  const price: string | null = product?.price != null ? `€${product.price}` : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: brand.og.bg,
        }}
      >
        {/* Left — product image */}
        <div
          style={{
            width: '50%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ece7df',
            overflow: 'hidden',
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span
              style={{
                fontFamily: 'Cormorant Garamond',
                fontSize: 18,
                color: brand.og.muted,
                letterSpacing: '0.1em',
              }}
            >
              SILKILINEN
            </span>
          )}
        </div>

        {/* Right — text panel */}
        <div
          style={{
            width: '50%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '0 60px',
            gap: 20,
          }}
        >
          {/* Brand */}
          <span
            style={{
              fontFamily: 'Cormorant Garamond',
              fontSize: 14,
              fontWeight: 400,
              color: brand.og.muted,
              letterSpacing: '0.25em',
            }}
          >
            SILKILINEN
          </span>

          {/* Product name */}
          <span
            style={{
              fontFamily: 'Cormorant Garamond',
              fontSize: 44,
              fontWeight: 400,
              color: brand.og.ink,
              lineHeight: 1.15,
              letterSpacing: '0.02em',
            }}
          >
            {productName}
          </span>

          {/* Divider */}
          <div style={{ width: 40, height: 1, background: brand.og.muted }} />

          {/* Price */}
          {price && (
            <span
              style={{
                fontFamily: 'Cormorant Garamond',
                fontSize: 26,
                fontWeight: 400,
                color: brand.og.muted,
                letterSpacing: '0.05em',
              }}
            >
              {price}
            </span>
          )}
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

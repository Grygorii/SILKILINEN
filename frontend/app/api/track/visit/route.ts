import { NextRequest, NextResponse } from 'next/server';
import { isBot } from '@/lib/isBot';

const API = process.env.NEXT_PUBLIC_API_URL;

export const runtime = 'nodejs';

/**
 * Visit-tracking proxy. The browser POSTs here instead of going directly
 * to the Railway backend. We're the first hop on Vercel, so we read the
 * `x-vercel-ip-country` / `x-vercel-ip-city` / `x-vercel-ip-country-region`
 * headers Vercel attaches to every incoming request, and forward them
 * to the backend in the body as a `geo` object.
 *
 * Why: the previous flow had the browser POST directly to Railway, which
 * left the backend with only a remote IP to geolocate via ipapi.co. That
 * call silently failed on timeouts or rate-limits (e.g. yesterday's
 * Warsaw visit) and the Visit doc got saved with no country/city — which
 * then dropped out of the admin dashboard's "Top countries / cities"
 * aggregations. Vercel's headers are instant, free, and reliable, so
 * the ipapi.co path is now a fallback for direct-backend hits / dev /
 * the rare case Vercel doesn't supply the header.
 *
 * Also forwards X-Forwarded-For so the backend can still resolve the
 * original client IP for its sha256 hash (analytics dedup) and the
 * ipapi.co fallback.
 */
export async function POST(req: NextRequest) {
  if (!API) {
    return NextResponse.json({ ok: true });
  }

  // Drop crawler/scraper/headless traffic before it ever reaches the backend.
  // This proxy is the one hop that sees the visitor's real User-Agent, so it's
  // the right chokepoint — keeps Googlebot et al. out of the visit analytics
  // (otherwise their JS-rendered page loads log as "direct" visits from
  // Google's data centres and skew traffic + conversion).
  if (isBot(req.headers.get('user-agent'))) {
    return NextResponse.json({ ok: true });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Vercel header reference: https://vercel.com/docs/edge-network/headers
  // The city header is URL-encoded for non-ASCII names (e.g. "S%C3%A3o%20Paulo").
  const countryCode = req.headers.get('x-vercel-ip-country');
  const cityRaw     = req.headers.get('x-vercel-ip-city');
  const region      = req.headers.get('x-vercel-ip-country-region');

  let city: string | null = null;
  if (cityRaw) {
    try { city = decodeURIComponent(cityRaw); } catch { city = cityRaw; }
  }

  const geo = (countryCode || city)
    ? { countryCode: countryCode || null, city, region: region || null }
    : null;

  // Pull the original client IP from the standard forwarded headers so the
  // backend's req.ip resolves correctly (Express trust proxy reads X-Forwarded-For).
  const xff = req.headers.get('x-forwarded-for')
    || req.headers.get('x-real-ip')
    || '';

  try {
    await fetch(`${API}/api/track/visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(xff ? { 'X-Forwarded-For': xff } : {}),
      },
      body: JSON.stringify({ ...body, geo }),
      // Don't block the response on tracking — fire and let the backend persist.
      signal: AbortSignal.timeout(4000),
    }).catch(() => { /* tracking failures must never bubble up to the user */ });
  } catch { /* same */ }

  return NextResponse.json({ ok: true });
}

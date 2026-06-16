import { NextRequest, NextResponse } from 'next/server';
import { isBot } from '@/lib/isBot';

const API = process.env.NEXT_PUBLIC_API_URL;

export const runtime = 'nodejs';

/**
 * First-party event proxy. The browser POSTs clickstream events here (same
 * origin as the storefront) instead of to a third-party analytics domain — so
 * ad-blockers can't drop them and the data lands in our own DB. Mirrors the
 * visit proxy: this is the one hop that sees the real User-Agent, so it's where
 * we filter out crawlers before they pollute the event stream.
 */
export async function POST(req: NextRequest) {
  if (!API) return NextResponse.json({ ok: true });
  if (isBot(req.headers.get('user-agent'))) return NextResponse.json({ ok: true });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    await fetch(`${API}/api/track/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    }).catch(() => { /* tracking must never bubble up to the user */ });
  } catch { /* same */ }

  return NextResponse.json({ ok: true });
}

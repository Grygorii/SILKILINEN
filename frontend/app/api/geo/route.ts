import { NextRequest, NextResponse } from 'next/server';

// Returns the visitor's country from Vercel's edge geo header, so client widgets
// (e.g. the UK shipping notice) can geo-target WITHOUT reading the header in a
// layout — which would force every storefront page to render dynamically. This
// tiny endpoint is the only dynamic part; the pages stay statically cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const country = req.headers.get('x-vercel-ip-country') || null;
  return NextResponse.json({ country });
}

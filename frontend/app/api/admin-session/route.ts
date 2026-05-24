import { NextRequest, NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL;

// GET /api/admin-session — validates the Vercel-domain session cookie.
// Used by the login page to check "am I already logged in?" without
// touching the Railway domain (which the browser can't read from JS).
export async function GET(request: NextRequest) {
  const token = request.cookies.get('token');
  if (!token?.value) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const res = await fetch(`${API}/api/auth/me`, {
      headers: { Cookie: `token=${token.value}` },
      cache: 'no-store',
    });
    if (res.ok) return NextResponse.json({ ok: true });
  } catch {}
  return NextResponse.json({ ok: false }, { status: 401 });
}

// POST /api/admin-session — sets a Vercel-domain httpOnly token cookie
// after the browser has called Railway /api/auth/login. Railway's
// Set-Cookie applies to the Railway domain only, so Next.js middleware
// and Server Components can't see it.
//
// The browser hands us a single-use 60-second bootstrap nonce (NOT the
// JWT itself). We exchange it server-to-server with Railway for the
// actual JWT, then set our own first-party cookie. The JWT never
// appears in browser-visible network traffic or storage.
export async function POST(request: NextRequest) {
  const { bootstrap } = await request.json();
  if (!bootstrap || typeof bootstrap !== 'string') {
    return NextResponse.json({ error: 'Missing bootstrap nonce' }, { status: 400 });
  }

  let token: string;
  try {
    const exchangeRes = await fetch(`${API}/api/auth/redeem-bootstrap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': '1', // F8: server-to-server still goes through CSRF middleware
      },
      body: JSON.stringify({ bootstrap }),
      cache: 'no-store',
    });
    if (!exchangeRes.ok) {
      return NextResponse.json({ error: 'Invalid or expired bootstrap' }, { status: 401 });
    }
    const data = await exchangeRes.json();
    if (!data?.token || typeof data.token !== 'string') {
      return NextResponse.json({ error: 'Bootstrap exchange returned no token' }, { status: 503 });
    }
    token = data.token;
  } catch {
    return NextResponse.json({ error: 'Bootstrap exchange failed' }, { status: 503 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60,
    path: '/',
  });
  return response;
}

// DELETE /api/admin-session — clears the Vercel-domain cookie on logout
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
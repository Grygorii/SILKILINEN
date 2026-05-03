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
// after the browser has already called Railway /api/auth/login.
// Railway's Set-Cookie applies to the Railway domain only, so
// Next.js middleware and Server Components can't see it. We receive the
// JWT from the login response body and reissue it as a first-party cookie.
export async function POST(request: NextRequest) {
  const { token } = await request.json();
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
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

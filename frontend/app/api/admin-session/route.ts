import { NextRequest, NextResponse } from 'next/server';

// POST /api/admin-session — sets a Vercel-domain httpOnly token cookie
// after the browser has already called Railway /api/auth/login.
// This is needed because Railway's Set-Cookie applies to the Railway domain,
// not to silkilinen.vercel.app, so Next.js middleware and Server Components
// can't see it. We receive the JWT from the login response body and reissue
// it as a first-party Vercel-domain cookie.
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
    maxAge: 24 * 60 * 60, // 24h — matches Railway token expiry
    path: '/',
  });
  return response;
}

// DELETE /api/admin-session — clears the Vercel-domain token cookie on logout
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

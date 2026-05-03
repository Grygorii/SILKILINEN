import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL;

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token');

  // No Vercel-domain cookie → only /admin/login reaches here (middleware guards the rest).
  // Let the login page render without validation.
  if (!token) {
    return <>{children}</>;
  }

  // Token present: validate it against the backend before rendering any admin page.
  try {
    const res = await fetch(`${API}/api/auth/me`, {
      headers: { Cookie: `token=${token.value}` },
      cache: 'no-store',
    });
    if (!res.ok) redirect('/admin/login');
  } catch {
    redirect('/admin/login');
  }

  return <>{children}</>;
}

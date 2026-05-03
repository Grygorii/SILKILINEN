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

  if (token) {
    // Validate the token against the backend — catches expired/tampered tokens
    // that the Edge middleware (cookie presence check) would miss.
    try {
      const res = await fetch(`${API}/api/auth/me`, {
        headers: { Cookie: `token=${token.value}` },
        cache: 'no-store',
      });
      if (!res.ok) redirect('/admin/login');
    } catch {
      redirect('/admin/login');
    }
  }
  // No token: middleware already redirects all /admin/* except /admin/login,
  // so we only reach here for the login page itself.

  return <>{children}</>;
}

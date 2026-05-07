import { redirect } from 'next/navigation';

export default function SiteAuditRedirect() {
  redirect('/admin/settings/advanced/site-audit');
}

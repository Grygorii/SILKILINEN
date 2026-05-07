import { redirect } from 'next/navigation';

export default function ModelsRedirect() {
  redirect('/admin/settings/advanced/ai-models');
}

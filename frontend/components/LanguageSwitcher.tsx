'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ALL_LOCALES, LOCALE_LABELS, LOCALES, localeHref, type PageLocale } from '@/lib/i18n';

// Language selector. Reads the current locale from the URL prefix (the rewrite
// keeps /de/… in the address bar) and navigates to the same page in the chosen
// language — English is the unprefixed URL.
export default function LanguageSwitcher({ className }: { className?: string }) {
  const pathname = usePathname() || '/';
  const router = useRouter();

  const seg = pathname.split('/')[1];
  const current: PageLocale = (LOCALES as readonly string[]).includes(seg) ? (seg as PageLocale) : 'en';
  const bare = current === 'en' ? pathname : (pathname.slice(current.length + 1) || '/');

  return (
    <select
      aria-label="Language"
      className={className}
      value={current}
      onChange={e => router.push(localeHref(e.target.value as PageLocale, bare))}
      style={{
        background: 'none', border: '1px solid var(--color-line)', color: 'inherit',
        font: 'inherit', fontSize: 12, letterSpacing: '0.5px', padding: '6px 10px', cursor: 'pointer',
      }}
    >
      {ALL_LOCALES.map(l => (
        <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
      ))}
    </select>
  );
}

'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ALL_LOCALES, LOCALE_LABELS, LOCALES, localeHref, type PageLocale } from '@/lib/i18n';
import styles from './LanguageSwitcher.module.css';

// Language selector. Reads the current locale from the URL prefix (the rewrite
// keeps /de/… in the address bar) and navigates to the same page in the chosen
// language — English is the unprefixed URL.
export default function LanguageSwitcher({ className }: { className?: string }) {
  const pathname = usePathname() || '/';
  const router = useRouter();

  const seg = pathname.split('/')[1];
  const current: PageLocale = (LOCALES as readonly string[]).includes(seg) ? (seg as PageLocale) : 'en';
  const bare = current === 'en' ? pathname : (pathname.slice(current.length + 1) || '/');

  // Write the choice to the same cookie the proxy reads, so the visitor stays
  // in this language as they browse. Picking English stores 'en', which opts
  // out of the locale redirect entirely.
  function choose(next: PageLocale) {
    document.cookie = `slk_locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.push(localeHref(next, bare));
  }

  return (
    <span className={`${styles.row} ${className || ''}`}>
      <span className={styles.label}>Language</span>
      <select
        aria-label="Language"
        className={styles.select}
        value={current}
        onChange={e => choose(e.target.value as PageLocale)}
      >
        {ALL_LOCALES.map(l => (
          <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
        ))}
      </select>
    </span>
  );
}

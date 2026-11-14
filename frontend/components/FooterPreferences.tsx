'use client';

import { useCurrency } from '@/context/CurrencyContext';
import { ALL_LOCALES, LOCALE_LABELS, localeFromPathname, localeHref, type PageLocale } from '@/lib/i18n';
import styles from './Footer.module.css';

type FooterPreferencesProps = {
  locale: PageLocale;
  languageLabel: string;
  currencyLabel: string;
};

export default function FooterPreferences({ locale, languageLabel, currencyLabel }: FooterPreferencesProps) {
  const { currency, currencies, setCurrency } = useCurrency();

  function chooseLanguage(next: PageLocale) {
    const { pathname, search, hash } = window.location;
    const current = localeFromPathname(pathname);
    if (next === current) return;

    const bare = current === 'en' ? pathname : pathname.slice(current.length + 1) || '/';
    document.cookie = `slk_locale=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.assign(localeHref(next, bare) + search + hash);
  }

  return (
    <div className={styles.preferences}>
      <div className={styles.choice}>
        <select name="language" aria-label={languageLabel} value={locale} onChange={event => chooseLanguage(event.target.value as PageLocale)}>
          {ALL_LOCALES.map(language => (
            <option key={language} value={language} lang={language}>{LOCALE_LABELS[language]}</option>
          ))}
        </select>
        <span className={styles.caret} aria-hidden="true" />
      </div>
      <span className={styles.separator} aria-hidden="true">·</span>
      <div className={styles.choice}>
        <select name="currency" aria-label={currencyLabel} value={currency} onChange={event => setCurrency(event.target.value)}>
          {currencies.map(({ code, symbol }) => (
            <option key={code} value={code}>{code} {symbol}</option>
          ))}
        </select>
        <span className={styles.caret} aria-hidden="true" />
      </div>
    </div>
  );
}

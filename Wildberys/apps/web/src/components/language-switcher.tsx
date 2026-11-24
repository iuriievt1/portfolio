'use client';

import { customerLanguages } from '@bluberi/i18n/locales';
import { LanguageSwitch } from '@bluberi/ui/components/language-switch';
import { useLocale } from 'next-intl';

import { Link, usePathname } from '../i18n/navigation';

/** Switches the page a person is on between Czech and English. */
export function LanguageSwitcher({ label }: { readonly label: string }) {
  const pathname = usePathname();

  return (
    <LanguageSwitch
      label={label}
      languages={customerLanguages}
      current={useLocale()}
      link={({ locale }, props) => <Link key={locale} href={pathname} locale={locale} {...props} />}
    />
  );
}

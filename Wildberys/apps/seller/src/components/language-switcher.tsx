'use client';

import { customerLanguages } from '@bluberi/i18n/locales';
import { LanguageSwitch } from '@bluberi/ui/components/language-switch';
import { useLocale } from 'next-intl';
import { Suspense } from 'react';

import { Link, usePathname } from '../i18n/navigation';

interface LanguageSwitcherProps {
  readonly label: string;
}

/** Switches the page a person is on between Czech and English. */
export function LanguageSwitcher({ label }: LanguageSwitcherProps) {
  return (
    // A page with an id in its address is prepared before the id is known. Until the address
    // is there, the switch is drawn with the start of the portal behind it.
    <Suspense fallback={<SwitchTo label={label} pathname="/" />}>
      <SwitchOfThisPage label={label} />
    </Suspense>
  );
}

function SwitchOfThisPage({ label }: LanguageSwitcherProps) {
  return <SwitchTo label={label} pathname={usePathname()} />;
}

function SwitchTo({ label, pathname }: LanguageSwitcherProps & { readonly pathname: string }) {
  return (
    <LanguageSwitch
      label={label}
      languages={customerLanguages}
      current={useLocale()}
      link={({ locale }, props) => <Link key={locale} href={pathname} locale={locale} {...props} />}
    />
  );
}

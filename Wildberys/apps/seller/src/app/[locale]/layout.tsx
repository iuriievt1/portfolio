import '../globals.css';

import { PageFade } from '@bluberi/ui/components/page-fade';
import { manrope } from '@bluberi/ui/fonts';
import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { routing } from '../../i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html lang={locale} className={manrope.variable}>
      <body>
        {/* Tells client components the language. The texts stay on the server: pages hand them over as props. */}
        <NextIntlClientProvider messages={null}>
          <PageFade>{children}</PageFade>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

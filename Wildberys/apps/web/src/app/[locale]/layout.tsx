import '../globals.css';

import { berryMarkUrl } from '@bluberi/ui/brand-mark';
import { PageFade } from '@bluberi/ui/components/page-fade';
import { manrope } from '@bluberi/ui/fonts';
import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { CookieBanner } from '../../components/cookie-banner';
import { routing } from '../../i18n/routing';
import { siteUrl } from '../../settings';

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
    // Turns the paths in the metadata of every page into full addresses.
    metadataBase: new URL(siteUrl()),
    // A page with a title of its own gets the name of the store after it.
    title: { default: t('home.title'), template: `%s | ${t('siteName')}` },
    description: t('home.description'),
    applicationName: t('siteName'),
    // A phone must not turn a price or a company number into a link that dials.
    formatDetection: { telephone: false },
    // The berry of the brand guide. Browsers that cannot draw it take the ".ico" file.
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '48x48' },
        { url: berryMarkUrl, type: 'image/svg+xml' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    // Links to a place on the page scroll to it smoothly. A change of page still starts at the top.
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`scroll-smooth motion-reduce:scroll-auto ${manrope.variable}`}
    >
      <body>
        {/* Tells client components the language. The texts stay on the server: pages hand them over as props. */}
        <NextIntlClientProvider messages={null}>
          {/* First on the page for the keyboard and for screen readers. It is drawn over the bottom of the screen. */}
          <CookieBanner />
          <PageFade>{children}</PageFade>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

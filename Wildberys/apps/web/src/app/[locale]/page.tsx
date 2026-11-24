import type { Metadata } from 'next';
import { hasLocale, useLocale, useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { AppBand } from '../../components/landing/app-band';
import { Categories } from '../../components/landing/categories';
import { Delivery } from '../../components/landing/delivery';
import { Hero } from '../../components/landing/hero';
import { Products } from '../../components/landing/products';
import { Sellers } from '../../components/landing/sellers';
import { SiteFooter } from '../../components/site-footer';
import { SiteHeader } from '../../components/site-header';
import { routing } from '../../i18n/routing';
import { pageMetadata } from '../../seo/page-metadata';
import { StructuredData } from '../../seo/structured-data';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'metadata' });

  return pageMetadata({
    locale,
    path: '/',
    title: t('home.title'),
    titleIsWhole: true,
    description: t('home.description'),
    siteName: t('siteName'),
    socialImageAlt: t('socialImage'),
  });
}

/**
 * The landing page: what Bluberi is and what it sells, how fast it delivers, the app
 * and the way in for sellers.
 */
export default function LandingPage() {
  const t = useTranslations('metadata');
  const locale = useLocale();

  return (
    <>
      <StructuredData
        locale={locale}
        siteName={t('siteName')}
        description={t('home.description')}
      />
      <SiteHeader />
      <main className="overflow-x-clip">
        <Hero />
        <Categories />
        <Products />
        <Delivery />
        <AppBand />
        <Sellers />
      </main>
      <SiteFooter />
    </>
  );
}

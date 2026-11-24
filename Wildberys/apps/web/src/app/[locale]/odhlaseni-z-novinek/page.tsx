import type { Metadata } from 'next';
import { hasLocale, useMessages, useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Paragraph, TextPage } from '../../../components/text-page';
import { UnsubscribeForm } from '../../../components/unsubscribe-form';
import { routing } from '../../../i18n/routing';
import { unsubscribe } from '../../../newsletter/actions';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/odhlaseni-z-novinek'>): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'unsubscribe' });

  // A page that only takes an email off the list has no place in search results.
  return { title: t('title'), description: t('text'), robots: { index: false, follow: true } };
}

/**
 * Where a person takes back the consent to get news by email. Taking it back
 * has to be as easy as giving it: an email and one button, as in the footer.
 */
export default function UnsubscribePage() {
  const t = useTranslations('unsubscribe');
  const messages = useMessages();

  return (
    <TextPage title={t('title')}>
      <Paragraph>{t('text')}</Paragraph>
      <UnsubscribeForm
        labels={{
          ...messages.unsubscribe,
          home: messages.site.actions.backHome,
          errors: messages.footer.newsletter.errors,
        }}
        leave={unsubscribe}
      />
    </TextPage>
  );
}

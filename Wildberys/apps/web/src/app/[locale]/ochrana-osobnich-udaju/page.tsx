import { operator } from '@bluberi/i18n/operator';
import type { Metadata } from 'next';
import { hasLocale, useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { CookieSettingsButton } from '../../../components/cookie-consent';
import { textLink } from '../../../components/layout';
import { BulletList, Paragraph, TextPage, TextSection } from '../../../components/text-page';
import { Link } from '../../../i18n/navigation';
import { routing } from '../../../i18n/routing';
import { cookiesAnchor, privacyPolicyPath, unsubscribePath } from '../../../paths';
import { pageMetadata } from '../../../seo/page-metadata';
import { analyticsId } from '../../../settings';

/** The Czech authority that watches over personal data. A complaint goes there. */
const supervisoryAuthorityUrl = 'https://uoou.gov.cz';

/** What the policy says about the news by email, each point with its question in bold. */
const newsletterPoints = [
  'data',
  'purpose',
  'basis',
  'retention',
  'voluntary',
  'withdrawal',
] as const;

/** What the policy says about the registration of a seller, each point with its question in bold. */
const sellerRegistrationPoints = [
  'data',
  'documents',
  'messages',
  'purpose',
  'basis',
  'retention',
  'payouts',
  'public',
  'voluntary',
] as const;

/** What the policy says about the measuring of visits, each point with its question in bold. */
const analyticsPoints = [
  'data',
  'purpose',
  'basis',
  'retention',
  'processor',
  'voluntary',
  'withdrawal',
] as const;

const rights = [
  'access',
  'rectification',
  'erasure',
  'restriction',
  'portability',
  'withdrawal',
] as const;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/ochrana-osobnich-udaju'>): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale });

  return pageMetadata({
    locale,
    path: privacyPolicyPath,
    title: t('privacy.title'),
    description: t('metadata.privacy.description'),
    siteName: t('metadata.siteName'),
    socialImageAlt: t('metadata.socialImage'),
  });
}

/**
 * The privacy policy. It describes what the website does with personal data today,
 * one part per kind of processing: a wave that adds processing adds its part here.
 */
export default function PrivacyPolicyPage() {
  const t = useTranslations('privacy');
  // The parts about the measuring of visits stand only where the store measures.
  const measuring = analyticsId() !== undefined;
  // Who the texts name.
  const values = {
    name: operator.name,
    registrationNumber: operator.registrationNumber,
    address: operator.address,
    email: operator.privacyEmail,
  };
  // How the marked parts of a text are drawn.
  const marks = {
    b: (chunks: ReactNode) => <strong className="font-extrabold text-berry-950">{chunks}</strong>,
    mail: (chunks: ReactNode) => (
      <a href={`mailto:${operator.privacyEmail}`} className={textLink}>
        {chunks}
      </a>
    ),
    removal: (chunks: ReactNode) => (
      <Link href={unsubscribePath} className={textLink}>
        {chunks}
      </Link>
    ),
    settings: (chunks: ReactNode) => (
      <CookieSettingsButton className={textLink}>{chunks}</CookieSettingsButton>
    ),
    authority: (chunks: ReactNode) => (
      <a href={supervisoryAuthorityUrl} className={textLink}>
        {chunks}
      </a>
    ),
  };

  return (
    <TextPage title={t('title')} note={t('effective')}>
      <Paragraph>{t('intro')}</Paragraph>

      <TextSection title={t('controller.title')}>
        <Paragraph>{t('controller.text', values)}</Paragraph>
        <Paragraph>{t.rich('controller.contact', { ...values, ...marks })}</Paragraph>
      </TextSection>

      <TextSection title={t('newsletter.title')}>
        <Paragraph>{t('newsletter.intro')}</Paragraph>
        {newsletterPoints.map((point) => (
          <Paragraph key={point}>
            {t.rich(`newsletter.${point}`, { ...values, ...marks })}
          </Paragraph>
        ))}
      </TextSection>

      <TextSection title={t('sellerRegistration.title')}>
        <Paragraph>{t('sellerRegistration.intro')}</Paragraph>
        {sellerRegistrationPoints.map((point) => (
          <Paragraph key={point}>{t.rich(`sellerRegistration.${point}`, marks)}</Paragraph>
        ))}
      </TextSection>

      <TextSection title={t('browser.title')} id={cookiesAnchor}>
        <Paragraph>{t('browser.intro')}</Paragraph>
        <BulletList>
          <li>{t('browser.language')}</li>
          {measuring ? <li>{t('browser.consent')}</li> : null}
          <li>{t('browser.form')}</li>
        </BulletList>
        <Paragraph>{t('browser.necessary')}</Paragraph>
        {measuring ? <Paragraph>{t('browser.optional')}</Paragraph> : null}
      </TextSection>

      {measuring ? (
        <TextSection title={t('analytics.title')}>
          <Paragraph>{t('analytics.intro')}</Paragraph>
          {analyticsPoints.map((point) => (
            <Paragraph key={point}>
              {t.rich(`analytics.${point}`, { ...values, ...marks })}
            </Paragraph>
          ))}
        </TextSection>
      ) : null}

      <TextSection title={t('recipients.title')}>
        <Paragraph>{t('recipients.none')}</Paragraph>
        <Paragraph>{t('recipients.processors')}</Paragraph>
        <Paragraph>{t('recipients.payments')}</Paragraph>
        <Paragraph>{t('recipients.transfers')}</Paragraph>
        {measuring ? <Paragraph>{t('recipients.analytics')}</Paragraph> : null}
        <Paragraph>{t('recipients.authorities')}</Paragraph>
      </TextSection>

      <TextSection title={t('rights.title')}>
        <Paragraph>{t('rights.intro')}</Paragraph>
        <BulletList>
          {rights.map((right) => (
            <li key={right}>{t(`rights.${right}`)}</li>
          ))}
        </BulletList>
        <Paragraph>{t.rich('rights.how', { ...values, ...marks })}</Paragraph>
        <Paragraph>{t('rights.automated')}</Paragraph>
      </TextSection>

      <TextSection title={t('complaint.title')}>
        <Paragraph>{t.rich('complaint.text', marks)}</Paragraph>
      </TextSection>

      <TextSection title={t('children.title')}>
        <Paragraph>{t('children.text')}</Paragraph>
      </TextSection>

      <TextSection title={t('changes.title')}>
        <Paragraph>{t('changes.text')}</Paragraph>
        <Paragraph>{t('languages')}</Paragraph>
      </TextSection>
    </TextPage>
  );
}

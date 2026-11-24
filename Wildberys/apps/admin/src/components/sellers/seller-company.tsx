import type { ModeratedCompany } from '@bluberi/api-client';
import { getLocale, getTranslations } from 'next-intl/server';

import { addressLine, countryNamer } from '../../sellers/address';
import { CardSection } from '../card-section';
import { Fact, Facts } from '../facts';

/** The company of a seller as it was registered, and how it was checked then. */
export async function SellerCompany({ company }: { readonly company: ModeratedCompany }) {
  const t = await getTranslations('sellers.card');
  const countryName = countryNamer(await getLocale());

  return (
    <CardSection title={t('company.title')}>
      <Facts>
        <Fact label={t('company.country')}>{countryName(company.countryCode)}</Fact>
        <Fact label={t('company.registrationNumber')}>{company.registrationNumber}</Fact>
        <Fact label={t('company.legalForm')}>{t(`company.legalForms.${company.legalForm}`)}</Fact>
        <Fact label={t('company.vatNumber')}>{company.vatNumber ?? t('no')}</Fact>
        <Fact label={t('company.vatPayer')}>{t(company.isVatPayer ? 'yes' : 'no')}</Fact>
        <Fact label={t('company.address')}>{addressLine(company.address, countryName)}</Fact>
        <Fact label={t('company.check')}>{t(`company.checks.${company.check}`)}</Fact>
      </Facts>
    </CardSection>
  );
}

import type { ModeratedStore } from '@bluberi/api-client';
import { getLocale, getTranslations } from 'next-intl/server';

import { addressLine, countryNamer } from '../../sellers/address';
import { CardNote, CardSection } from '../card-section';
import { Fact, Facts } from '../facts';
import { SoldSections } from './sold-sections';

/** The store the seller set up in the registration. Null until the seller reaches that step. */
export async function SellerStore({ store }: { readonly store: ModeratedStore | null }) {
  const t = await getTranslations('sellers.card.store');
  const countryName = countryNamer(await getLocale());

  return (
    <CardSection title={t('title')}>
      {store ? (
        <Facts>
          <Fact label={t('name')}>{store.name}</Fact>
          <Fact label={t('slug')}>{store.slug}</Fact>
          <Fact label={t('categories')}>
            {store.categories.length > 0 ? (
              <SoldSections sections={store.categories} wholeSection={t('wholeSection')} />
            ) : (
              t('noCategories')
            )}
          </Fact>
          <Fact label={t('returnAddress')}>{addressLine(store.returnAddress, countryName)}</Fact>
        </Facts>
      ) : (
        <CardNote>{t('missing')}</CardNote>
      )}
    </CardSection>
  );
}

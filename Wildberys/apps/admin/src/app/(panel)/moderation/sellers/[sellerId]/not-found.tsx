import { PageTitle } from '@bluberi/ui/components/app-shell';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { textLinkClasses } from '../../../../../components/text-link';
import { sellersPath } from '../../../../../sellers/paths';

/** Shown in place of the card when no seller has the id in the address, for example after a draft was deleted. */
export default async function SellerNotFound() {
  const t = await getTranslations('sellers.card.notFound');

  return (
    <>
      <PageTitle>{t('title')}</PageTitle>
      <p className="text-sm font-semibold text-gray-600">{t('text')}</p>
      <Link href={sellersPath} className={`self-start text-sm ${textLinkClasses}`}>
        {t('back')}
      </Link>
    </>
  );
}

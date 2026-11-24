import { PageTitle } from '@bluberi/ui/components/app-shell';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { getUser } from '../../../../auth/current-user';
import { SellerList } from '../../../../components/sellers/seller-list';
import { SellerTabs } from '../../../../components/sellers/seller-tabs';
import { getSellerCounts, getSellersPage } from '../../../../sellers/moderation';
import { sellerTabOf } from '../../../../sellers/paths';

/** The check of sellers: the registrations that wait for the team, and the sellers in every other status. */
export default function SellersPage({ searchParams }: PageProps<'/moderation/sellers'>) {
  // Who may open the section and what is on the list depend on the request, so the page streams in.
  return (
    <Suspense fallback={null}>
      <Sellers searchParams={searchParams} />
    </Suspense>
  );
}

async function Sellers({ searchParams }: Pick<PageProps<'/moderation/sellers'>, 'searchParams'>) {
  const user = await getUser();
  const t = await getTranslations();

  // The menu hides the section from people who may not open it. This covers a link typed by hand.
  if (!user || user.platformAccess.sellers === 'none') {
    return <PageTitle>{t('shell.noAccessTitle')}</PageTitle>;
  }

  const { status, cursor: cursorParam } = await searchParams;
  const tab = sellerTabOf(status);
  const cursor = typeof cursorParam === 'string' ? cursorParam : undefined;
  const [counts, page] = await Promise.all([getSellerCounts(), getSellersPage(tab, cursor)]);

  return (
    <>
      <PageTitle>{t('nav.items.sellers')}</PageTitle>
      <SellerTabs active={tab} counts={counts} />
      <SellerList tab={tab} page={page} cursor={cursor} />
    </>
  );
}

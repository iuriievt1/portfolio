import { PageTitle } from '@bluberi/ui/components/app-shell';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { getUser } from '../../../auth/current-user';
import { ListCard, listCell, listRow } from '../../../components/list-card';
import { getNewsletterPage } from '../../../marketing/newsletter';

/** Marketing. For now it holds the people who signed up for news by email in the footer of the store. */
export default function MarketingPage({ searchParams }: PageProps<'/marketing'>) {
  // Who may open the section and what is on the list depend on the request, so the page streams in.
  return (
    <Suspense fallback={null}>
      <Marketing searchParams={searchParams} />
    </Suspense>
  );
}

async function Marketing({ searchParams }: Pick<PageProps<'/marketing'>, 'searchParams'>) {
  const user = await getUser();
  const t = await getTranslations();

  // The menu hides the section from people who may not open it. This covers a link typed by hand.
  if (!user || user.platformAccess.marketing === 'none') {
    return <PageTitle>{t('shell.noAccessTitle')}</PageTitle>;
  }

  const { cursor: cursorParam } = await searchParams;
  const cursor = typeof cursorParam === 'string' ? cursorParam : undefined;
  const page = await getNewsletterPage(cursor);
  const format = await getFormatter();

  return (
    <>
      <PageTitle>{t('nav.items.marketing')}</PageTitle>
      <ListCard
        title={t('marketing.newsletter.title')}
        text={t('marketing.newsletter.text')}
        columns={[
          t('marketing.newsletter.email'),
          t('marketing.newsletter.language'),
          t('marketing.newsletter.consentedAt'),
        ]}
        note={
          !page
            ? { text: t('lists.error'), failed: true }
            : page.items.length === 0
              ? { text: t('marketing.newsletter.empty'), failed: false }
              : undefined
        }
        paging={{
          path: '/marketing',
          cursor,
          nextCursor: page?.nextCursor,
          first: t('lists.first'),
          next: t('lists.next'),
        }}
      >
        {page?.items.map((signUp) => (
          <tr key={signUp.id} className={listRow}>
            <td className={`break-all ${listCell}`}>{signUp.email}</td>
            <td className={listCell}>{t(`lists.languages.${signUp.locale}`)}</td>
            <td className={`whitespace-nowrap tabular-nums ${listCell}`}>
              {format.dateTime(new Date(signUp.consentedAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </td>
          </tr>
        ))}
      </ListCard>
    </>
  );
}

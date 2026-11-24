import { PageTitle } from '@bluberi/ui/components/app-shell';
import { buttonClasses } from '@bluberi/ui/components/button';
import { InboxHeader, InboxList, InboxPanes } from '@bluberi/ui/components/inbox';
import { Headset, PenLine } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { localizedPath } from '../../../../i18n/paths';
import { loadOlderConversations } from '../../../../messages/actions';
import { getInbox, newMessagePath } from '../../../../messages/messages';
import { inboxRowsOf } from '../../../../messages/rows';

/**
 * The inbox of the seller, drawn like a mail app: the conversations on the left,
 * the open one, or a new letter, on the right.
 */
export default async function MessagesLayout({
  children,
  params,
}: LayoutProps<'/[locale]/zpravy'>) {
  const { locale } = await params;
  const t = await getTranslations();

  return (
    <>
      <PageTitle>{t('nav.items.zpravy')}</PageTitle>
      <InboxPanes
        list={
          <>
            <InboxHeader
              title={t('messages.inbox')}
              action={
                <Link
                  href={localizedPath(newMessagePath, locale)}
                  className={buttonClasses({ size: 'sm' })}
                >
                  <PenLine />
                  {t('messages.new')}
                </Link>
              }
            />
            {/* Who wrote depends on the request, so the list streams in. */}
            <Suspense fallback={null}>
              <Conversations locale={locale} />
            </Suspense>
          </>
        }
      >
        {children}
      </InboxPanes>
    </>
  );
}

async function Conversations({ locale }: { readonly locale: string }) {
  const inbox = await getInbox();
  const t = await getTranslations('messages');

  if (!inbox) {
    return <p className="p-4 text-sm font-semibold text-gray-600">{t('unavailable')}</p>;
  }

  if (inbox.items.length === 0) {
    return <p className="p-4 text-sm font-semibold text-gray-600">{t('empty')}</p>;
  }

  return (
    <InboxList
      rows={await inboxRowsOf(inbox.items, locale)}
      nextCursor={inbox.nextCursor}
      // Today every conversation of a seller is with the Bluberi team.
      avatar={<Headset />}
      olderLabel={t('older')}
      loadOlder={loadOlderConversations.bind(null, locale)}
    />
  );
}

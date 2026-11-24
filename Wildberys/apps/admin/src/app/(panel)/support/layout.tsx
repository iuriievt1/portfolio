import { PageTitle } from '@bluberi/ui/components/app-shell';
import { InboxHeader, InboxList, InboxPanes } from '@bluberi/ui/components/inbox';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { getUser } from '../../../auth/current-user';
import { loadOlderConversations } from '../../../support/actions';
import { getTeamInbox, readsConversations } from '../../../support/inbox';
import { inboxRowsOf } from '../../../support/rows';

/**
 * The inbox of the team, drawn like a mail app: the conversations with sellers on the left,
 * the open one on the right.
 */
export default async function SupportLayout({ children }: LayoutProps<'/support'>) {
  const t = await getTranslations();

  return (
    <>
      <PageTitle>{t('nav.items.supportTickets')}</PageTitle>
      <InboxPanes
        list={
          <>
            <InboxHeader title={t('support.inbox')} />
            {/* Who wrote depends on the request, so the list streams in. */}
            <Suspense fallback={null}>
              <Conversations />
            </Suspense>
          </>
        }
      >
        {children}
      </InboxPanes>
    </>
  );
}

async function Conversations() {
  const user = await getUser();
  const t = await getTranslations('support');
  const note = 'p-4 text-sm font-semibold text-gray-600';

  // The menu shows the section to the whole team. This covers a person without a role, and a link typed by hand.
  if (!user || !readsConversations(user.platformAccess)) {
    return <p className={note}>{t('noAccess')}</p>;
  }

  const inbox = await getTeamInbox();

  if (!inbox) {
    return <p className={note}>{t('unavailable')}</p>;
  }

  if (inbox.items.length === 0) {
    return <p className={note}>{t('empty')}</p>;
  }

  return (
    <InboxList
      rows={await inboxRowsOf(inbox.items)}
      nextCursor={inbox.nextCursor}
      olderLabel={t('older')}
      loadOlder={loadOlderConversations}
    />
  );
}

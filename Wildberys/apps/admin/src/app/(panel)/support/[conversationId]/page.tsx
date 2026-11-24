import { ReplyBox, ThreadFrame } from '@bluberi/ui/components/inbox';
import { Store } from 'lucide-react';
import { getMessages, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { getUser } from '../../../../auth/current-user';
import { textLinkClasses } from '../../../../components/text-link';
import { sellerPath } from '../../../../sellers/paths';
import {
  loadEarlierMessages,
  markTeamConversationRead,
  sendTeamMessage,
} from '../../../../support/actions';
import {
  getTeamConversation,
  inboxPath,
  messageMaxLength,
  readsConversations,
  writesToSellers,
} from '../../../../support/inbox';
import { entriesOf } from '../../../../support/rows';
import { sellerName, subjectOf } from '../../../../support/texts';

/** One conversation of the inbox of the team: what the two sides wrote, and the answer of the team under it. */
export default function ConversationPage({ params }: PageProps<'/support/[conversationId]'>) {
  return (
    // The conversation depends on the request, so it streams in.
    <Suspense fallback={null}>
      <Thread params={params} />
    </Suspense>
  );
}

async function Thread({ params }: Pick<PageProps<'/support/[conversationId]'>, 'params'>) {
  const { conversationId } = await params;
  const user = await getUser();
  const t = await getTranslations('support');
  const note = (text: string) => (
    <ThreadFrame title={t('inbox')} backHref={inboxPath} backLabel={t('back')}>
      <p className="text-sm font-semibold text-gray-600">{text}</p>
    </ThreadFrame>
  );

  if (!user || !readsConversations(user.platformAccess)) {
    return note(t('noAccess'));
  }

  const conversation = await getTeamConversation(conversationId);

  if (conversation === null) {
    notFound();
  }

  if (!conversation) {
    return note(t('unavailable'));
  }

  const { errors } = (await getMessages()).support;
  const writes = writesToSellers(user.platformAccess);
  const newestUnread = conversation.messages.find(
    ({ side, readAt }) => side === 'SELLER' && readAt === null,
  );
  const closed = conversation.open ? t('readOnly') : t('closed');

  return (
    <ThreadFrame
      title={subjectOf(conversation, t('registration'))}
      subtitle={sellerName(conversation.seller)}
      backHref={inboxPath}
      backLabel={t('back')}
      entries={await entriesOf(conversation.messages)}
      earlier={
        conversation.nextCursor
          ? { label: t('earlier'), load: loadEarlierMessages.bind(null, conversation.id) }
          : undefined
      }
      unseenLabel={t('unseen')}
      // Opening the conversation reads what the seller wrote, and so does a message that comes while it is open.
      // Only a person who may answer reads for the team.
      unread={
        writes && newestUnread
          ? {
              newest: newestUnread.id,
              read: markTeamConversationRead.bind(null, conversation.id),
            }
          : undefined
      }
      aside={
        <Link
          href={sellerPath(conversation.seller.id)}
          className={`inline-flex flex-none items-center gap-1.5 text-[13px] [&_svg]:size-4 ${textLinkClasses}`}
        >
          <Store />
          {t('sellerCard')}
        </Link>
      }
      footer={
        writes && conversation.open ? (
          <ReplyBox
            label={t('replyLabel')}
            sendLabel={t('send')}
            maxLength={messageMaxLength}
            errors={errors}
            send={sendTeamMessage.bind(null, conversation.id)}
          />
        ) : (
          <p className="px-1 text-sm font-semibold text-gray-600">{closed}</p>
        )
      }
    />
  );
}

import { buttonClasses } from '@bluberi/ui/components/button';
import { ReplyBox, ThreadFrame } from '@bluberi/ui/components/inbox';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMessages as getTexts, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { requestedDocumentsPath } from '../../../../../auth/config';
import { localizedPath } from '../../../../../i18n/paths';
import {
  loadEarlierMessages,
  markConversationRead,
  sendMessage,
} from '../../../../../messages/actions';
import { getConversation, messageMaxLength, messagesPath } from '../../../../../messages/messages';
import { entriesOf } from '../../../../../messages/rows';
import { subjectOf } from '../../../../../messages/texts';
import { getRegistration } from '../../../../../registration/registration';

/** One conversation of the inbox: what the two sides wrote, and the answer of the seller under it. */
export default function ConversationPage({
  params,
}: PageProps<'/[locale]/zpravy/[conversationId]'>) {
  return (
    // The conversation depends on the request, so it streams in.
    <Suspense fallback={null}>
      <Thread params={params} />
    </Suspense>
  );
}

async function Thread({ params }: Pick<PageProps<'/[locale]/zpravy/[conversationId]'>, 'params'>) {
  const { locale, conversationId } = await params;
  const conversation = await getConversation(conversationId);
  const t = await getTranslations('messages');

  if (conversation === null) {
    notFound();
  }

  const back = localizedPath(messagesPath, locale);

  if (!conversation) {
    return (
      <ThreadFrame title={t('inbox')} backHref={back} backLabel={t('back')}>
        <p className="text-sm font-semibold text-gray-600">{t('unavailable')}</p>
      </ThreadFrame>
    );
  }

  const newestUnread = conversation.messages.find(
    ({ side, readAt }) => side === 'TEAM' && readAt === null,
  );
  const registration = await getRegistration();
  const { errors } = await getTexts();
  const waitsForDocuments = registration?.seller?.status === 'DOCUMENTS_REQUESTED';
  const newestRequest = conversation.messages.find(
    ({ kind }) => kind === 'DOCUMENTS_REQUESTED',
  )?.id;
  const entries = (await entriesOf(conversation.messages, locale)).map((entry) =>
    // The newest request for documents leads to where they are added, while the team still waits.
    waitsForDocuments && entry.id === newestRequest
      ? {
          ...entry,
          action: (
            <Link
              href={localizedPath(requestedDocumentsPath, locale)}
              className={`${buttonClasses({ size: 'sm' })} mt-1 self-start`}
            >
              {t('addDocuments')}
            </Link>
          ),
        }
      : entry,
  );

  return (
    <ThreadFrame
      title={subjectOf(conversation, t('registration'))}
      subtitle={t('team')}
      backHref={back}
      backLabel={t('back')}
      entries={entries}
      earlier={
        conversation.nextCursor
          ? {
              label: t('earlier'),
              load: loadEarlierMessages.bind(null, locale, conversation.id),
            }
          : undefined
      }
      unseenLabel={t('unseen')}
      // Opening the conversation reads what Bluberi wrote in it, and so does a message that comes while it is open.
      unread={
        newestUnread
          ? {
              newest: newestUnread.id,
              read: markConversationRead.bind(null, conversation.id),
            }
          : undefined
      }
      footer={
        conversation.open ? (
          <ReplyBox
            label={t('replyLabel')}
            sendLabel={t('send')}
            maxLength={messageMaxLength}
            errors={errors}
            send={sendMessage.bind(null, conversation.id)}
          />
        ) : (
          <p className="px-1 text-sm font-semibold text-gray-600">{t('closed')}</p>
        )
      }
    />
  );
}

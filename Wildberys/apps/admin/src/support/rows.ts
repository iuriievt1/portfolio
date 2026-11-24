import type { TeamConversationRow, TeamSellerMessageView } from '@bluberi/api-client';
import type { ConversationEntry } from '@bluberi/ui/components/conversation';
import type { InboxRowData } from '@bluberi/ui/components/inbox';
import { getFormatter, getNow, getTranslations } from 'next-intl/server';

import { dayAndTime } from '../sellers/formats';
import { conversationPath } from './inbox';
import { previewOf, sellerName, subjectOf, timeOf } from './texts';

// The first page of the inbox and of a conversation is drawn with the page, the later ones come
// through a server action. Both are built here, so they read the same.

/** The conversations as the rows of the inbox. */
export async function inboxRowsOf(
  conversations: readonly TeamConversationRow[],
): Promise<InboxRowData[]> {
  const t = await getTranslations('support');
  const format = await getFormatter();
  const now = await getNow();

  return conversations.map((conversation) => ({
    id: conversation.id,
    href: conversationPath(conversation.id),
    sender: sellerName(conversation.seller),
    subject: subjectOf(conversation, t('registration')),
    preview: previewOf(conversation.lastMessage, {
      team: t('team'),
      decisions: {
        DOCUMENTS_REQUESTED: t('decisions.DOCUMENTS_REQUESTED'),
        APPROVED: t('decisions.APPROVED'),
        REJECTED: t('decisions.REJECTED'),
      },
    }),
    time: timeOf(format, new Date(conversation.lastMessageAt), now),
    unread: conversation.unreadCount,
  }));
}

/** The messages of a conversation, which come newest first, as its entries, oldest first. */
export async function entriesOf(
  messages: readonly TeamSellerMessageView[],
): Promise<ConversationEntry[]> {
  const t = await getTranslations('support');
  const format = await getFormatter();

  return messages.toReversed().map((message) => ({
    id: message.id,
    mine: message.side === 'TEAM',
    caption: `${message.authorEmail} · ${format.dateTime(new Date(message.createdAt), dayAndTime)}`,
    body: message.body,
    title: message.kind === 'TEXT' ? undefined : t(`decisions.${message.kind}`),
  }));
}

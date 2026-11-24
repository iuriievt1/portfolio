import type { ConversationRow, SellerMessageView } from '@bluberi/api-client';
import type { ConversationEntry } from '@bluberi/ui/components/conversation';
import type { InboxRowData } from '@bluberi/ui/components/inbox';
import { getFormatter, getNow, getTranslations } from 'next-intl/server';

import { localizedPath, toLocale } from '../i18n/paths';
import { conversationPath } from './messages';
import { previewOf, subjectOf, timeOf } from './texts';

// The first page of the inbox and of a conversation is drawn with the page, the later ones come
// through a server action. Both are built here, in the language that is named, so they read the same.

/** The conversations as the rows of the inbox. */
export async function inboxRowsOf(
  conversations: readonly ConversationRow[],
  language: string,
): Promise<InboxRowData[]> {
  const locale = toLocale(language);
  const t = await getTranslations({ locale, namespace: 'messages' });
  const format = await getFormatter({ locale });
  const now = await getNow({ locale });

  return conversations.map((conversation) => ({
    id: conversation.id,
    href: localizedPath(conversationPath(conversation.id), locale),
    sender: t('team'),
    subject: subjectOf(conversation, t('registration')),
    preview: previewOf(conversation.lastMessage, {
      you: t('you'),
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
  messages: readonly SellerMessageView[],
  language: string,
): Promise<ConversationEntry[]> {
  const locale = toLocale(language);
  const t = await getTranslations({ locale, namespace: 'messages' });
  const format = await getFormatter({ locale });

  return messages.toReversed().map((message) => {
    const mine = message.side === 'SELLER';
    const time = format.dateTime(new Date(message.createdAt), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return {
      id: message.id,
      mine,
      caption: `${mine ? t('you') : t('team')} · ${time}`,
      body: message.body,
      title: message.kind === 'TEXT' ? undefined : t(`decisions.${message.kind}`),
    };
  });
}
